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

/**
 * Los enlaces de invitación, del lado de Sorela.
 *
 *   GET                              → { invitaciones: [...] }   las últimas 60
 *   POST { que, nombre?, correo? }   → { invitacion, enlace }
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
  const lista = await baseDeDatos().collection(COLECCIONES.invitaciones).orderBy('creado', 'desc').limit(60).get();
  return NextResponse.json({
    ok: true,
    invitaciones: lista.docs.map((d) => ({ ...aInvitacion(d.id, d.data()), enlace: enlaceDe(peticion, d.id) })),
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
  const nombre = recortar(cuerpo.nombre, 120) || null;
  const correo = recortar(cuerpo.correo, 200).toLowerCase() || null;

  const errores: Record<string, string> = {};
  if (que.length === 0) errores.que = 'Elige qué le das: la formación, la comunidad o las dos.';
  if (correo && !CORREO.test(correo)) errores.correo = 'Ese correo no tiene forma de correo.';
  if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });

  const codigo = randomBytes(24).toString('base64url');
  await docInvitacion(codigo).set({
    que,
    nombre,
    correo,
    creadoPor: g.sesion.uid,
    creado: FieldValue.serverTimestamp(),
    caduca: caducaDentroDe(),
    usada: null,
    anulada: false,
  });
  const d = await docInvitacion(codigo).get();
  const invitacion = aInvitacion(codigo, d.data() ?? {});
  const enlace = enlaceDe(peticion, codigo);
  /* Con correo, el enlace le sale por correo directamente. Se espera a saber
     si ha salido para que la pantalla diga «enviado» solo si es verdad. */
  const envio = await alCrearInvitacion({
    codigo,
    correo,
    nombre,
    que: que.map((q) => ETIQUETA_QUE_DA[q]),
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
