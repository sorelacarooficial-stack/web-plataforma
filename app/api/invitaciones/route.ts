import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import {
  CODIGO,
  ETIQUETA_QUE_DA,
  QUE_DA,
  aInvitacion,
  caducaDentroDe,
  docInvitacion,
  estadoDe,
  type QueDa,
} from '@/lib/invitaciones';
import { alCrearInvitacion } from '@/lib/automatizar';
import { CURSO_DIVINE } from '@/lib/accesos';
import { ID, accesoGuardado, aConvocatoria, coleccion as coleccionConvocatorias } from '@/lib/convocatorias';
import { anularEnlaces } from '@/lib/convocatorias-acceso';
import { hoyISO } from '@/lib/convocatorias-tipos';

/**
 * Los enlaces de invitación, del lado de Sorela.
 *
 *   GET                              → { invitaciones: [...], convocatorias: [...] }
 *   POST { que, nombre?, correo?, convocatoria?, inscrita?, nivel? } → { invitacion, enlace }
 *
 * Es el ÚNICO sitio donde se crean accesos con enlace, al curso y a la
 * membresía. El del curso lleva la convocatoria que ha comprado (sus fechas
 * le salen en la agenda) y el nivel: «precurso» si solo ha dejado el abono,
 * «completo» si ha pagado todo. Con una inscrita elegida, su fila de la
 * convocatoria queda enlazada y, al marcarla «Pagado», se le abre todo.
 *   DELETE ?codigo=…                 → la anula, si nadie la ha usado
 *
 * Ver lib/invitaciones.ts para qué es y por qué es seguro.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

async function exigirAdmin() {
  if (!hayFirebase()) return { error: NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 }) };
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (sesion.rol !== 'sorela') return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  return { sesion };
}

/** El enlace entero, con la dirección desde la que se ha pedido. */
const enlaceDe = (peticion: Request, codigo: string) =>
  `${new URL(peticion.url).origin}/registro?invitacion=${codigo}`;

export async function GET(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const [lista, convs] = await Promise.all([
    baseDeDatos().collection(COLECCIONES.invitaciones).orderBy('creado', 'desc').limit(60).get(),
    coleccionConvocatorias().get(),
  ]);
  /* Las convocatorias que aún no han terminado, con sus inscritas, para
     elegir en el formulario a qué fechas y a quién va el enlace. */
  const hoy = hoyISO();
  const convocatorias = convs.docs
    .map((d) => aConvocatoria(d.id, d.data()))
    .filter((c) => c.fin >= hoy)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((c) => ({
      id: c.id,
      ciudad: c.ciudad,
      inicio: c.inicio,
      fin: c.fin,
      inscritas: c.inscritas.map((i) => ({ id: i.id, nombre: i.nombre, correo: i.correo, estado: i.estado, acceso: i.acceso.estado })),
    }));
  return NextResponse.json({
    ok: true,
    invitaciones: lista.docs.map((d) => ({ ...aInvitacion(d.id, d.data()), enlace: enlaceDe(peticion, d.id) })),
    convocatorias,
  });
}

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const que = [...new Set(Array.isArray(cuerpo.que) ? cuerpo.que : [])].filter((q): q is QueDa =>
    QUE_DA.includes(q as QueDa)
  );
  let nombre = recortar(cuerpo.nombre, 120) || null;
  let correo = recortar(cuerpo.correo, 200).toLowerCase() || null;
  const conCurso = que.includes('curso');
  const convocatoria = conCurso && typeof cuerpo.convocatoria === 'string' && ID.test(cuerpo.convocatoria) ? cuerpo.convocatoria : null;
  const inscrita = convocatoria && typeof cuerpo.inscrita === 'string' && ID.test(cuerpo.inscrita) ? cuerpo.inscrita : null;

  const errores: Record<string, string> = {};
  if (que.length === 0) errores.que = 'Elige qué le das: el curso, la membresía o las dos.';

  /* La convocatoria y la inscrita, de verdad. Sin pedirle a Sorela que
     vuelva a escribir lo que ya está en la inscrita. */
  let previo: string | null = null;
  let estadoPago: string | null = null;
  if (convocatoria) {
    const c = await coleccionConvocatorias().doc(convocatoria).get();
    if (!c.exists) errores.convocatoria = 'Esa convocatoria ya no existe.';
    else if (inscrita) {
      const x = c.get(`inscritas.${inscrita}`) as FirebaseFirestore.DocumentData | undefined;
      if (!x) errores.inscrita = 'Esa persona ya no está en la convocatoria.';
      else {
        nombre = nombre || (typeof x.nombre === 'string' ? x.nombre.trim() : null) || null;
        correo = correo || (typeof x.correo === 'string' ? x.correo.trim().toLowerCase() : null) || null;
        estadoPago = typeof x.estado === 'string' ? x.estado : null;
        const a = accesoGuardado(x.acceso);
        if (a?.tipo === 'enlace') previo = a.codigo;
      }
    }
  }
  /* El nivel: lo elige Sorela; si no, sale del pago de la inscrita (solo
     «Pagado» abre todo). Sin inscrita y sin elegir, precurso: es lo seguro. */
  const nivel = !conCurso
    ? null
    : cuerpo.nivel === 'completo' || cuerpo.nivel === 'precurso'
      ? cuerpo.nivel
      : estadoPago === 'pagado'
        ? 'completo'
        : 'precurso';
  if (correo && !CORREO.test(correo)) errores.correo = 'Ese correo no tiene forma de correo.';
  if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });

  const codigo = randomBytes(24).toString('base64url');
  const caduca = caducaDentroDe();
  await docInvitacion(codigo).set({
    que,
    nombre,
    correo,
    creadoPor: g.sesion.uid,
    creado: FieldValue.serverTimestamp(),
    caduca,
    usada: null,
    anulada: false,
    ...(nivel ? { nivel } : {}),
    ...(convocatoria ? { convocatoria } : {}),
    ...(inscrita ? { inscrita } : {}),
  });
  if (convocatoria && inscrita) {
    // Su fila de la convocatoria dice «Enlace sin usar», y el de antes deja de valer.
    await coleccionConvocatorias()
      .doc(convocatoria)
      .update({
        [`inscritas.${inscrita}.acceso`]: { tipo: 'enlace', codigo, creado: new Date().toISOString(), caduca: caduca.toDate().toISOString() },
        actualizada: FieldValue.serverTimestamp(),
      })
      .catch((e) => console.error('[invitaciones] no se ha podido enlazar la inscrita', e));
    if (previo && previo !== codigo) await anularEnlaces([previo]);
  }
  const d = await docInvitacion(codigo).get();
  const invitacion = aInvitacion(codigo, d.data() ?? {});
  const enlace = enlaceDe(peticion, codigo);
  /* Con correo, el enlace le sale por correo directamente. Se espera a saber
     si ha salido para que la pantalla diga «enviado» solo si es verdad. */
  const envio = await alCrearInvitacion({
    codigo,
    correo,
    nombre,
    que: que.map((q) => (q === 'curso' && nivel === 'precurso' ? `el precurso de la ${CURSO_DIVINE}` : ETIQUETA_QUE_DA[q])),
    caduca: invitacion.caduca,
    enlace,
  });
  return NextResponse.json({
    ok: true,
    invitacion: { ...invitacion, enlace },
    correo: envio ? envio.estado : null,
  });
}

export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const codigo = new URL(peticion.url).searchParams.get('codigo') ?? '';
  if (!CODIGO.test(codigo)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const ref = docInvitacion(codigo);
  const r = await baseDeDatos().runTransaction(async (t) => {
    const d = await t.get(ref);
    if (!d.exists) return 'no-existe';
    const estado = estadoDe(d.data() ?? {});
    // Una usada no se anula: el acceso ya está dado y se quita desde su cuenta.
    if (estado === 'usada') return 'usada';
    t.update(ref, { anulada: true });
    return 'ok';
  });
  if (r !== 'ok') return NextResponse.json({ ok: false, motivo: r }, { status: 409 });
  return NextResponse.json({ ok: true });
}
