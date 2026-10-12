import { NextResponse } from 'next/server';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { revisarAccesos, tieneMembresia } from '@/lib/accesos';
import { baseDeDatos, COLECCIONES } from '@/lib/firebase-servidor';
import { borrarFicha, despublicarFicha, guardarFicha, leerFicha, listarFichas, ocultarFicha } from '@/lib/fichas';
import { exigirAdmin, exigirSesion } from '@/lib/permisos';

/**
 * El onboarding y la ficha del mapa «Localiza tu terapeuta».
 *
 *   GET                 → lo suyo: { ok, nombre, foto, esMiembro, onboarding, perfil, ficha }
 *   GET ?todas=1        → (Sorela) { ok, fichas: FilaFicha[] }
 *   POST { accion, perfil?, ficha?, consentimiento? }
 *        'guardar'      → guarda lo que llega (perfil y borrador de la ficha; si
 *                         ya está publicada, también la copia de la web)
 *        'publicar'     → la publica: SALE SOLA si cumple, sin aprobación
 *        'despublicar'  → la quita de la web (retira el permiso)
 *        'completar'    → onboarding terminado (+100 puntos)
 *        'saltar'       → «Más tarde»: no se vuelve a abrir sola
 *   PATCH { uid, ocultar }  → (Sorela) ocultar o volver a enseñar una ficha
 *   DELETE [?uid=]          → borrar la ficha (la propia; Sorela, cualquiera)
 *
 * Los errores de datos vuelven como { ok: false, errores: { campo: texto } }
 * con el texto listo para enseñar debajo de su campo.
 *
 * El uid sale SIEMPRE de la sesión, nunca del cuerpo: cada una solo toca lo
 * suyo. Lo de Sorela va por las puertas de lib/permisos.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{6,128}$/;
const PRIVADO = { 'Cache-Control': 'private, no-store' };
const ACCIONES = ['guardar', 'publicar', 'despublicar', 'completar', 'saltar'] as const;
type Accion = (typeof ACCIONES)[number];

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const iso = (v: unknown) => ((v as Timestamp | undefined)?.toDate?.() ?? null)?.toISOString() ?? null;
const objeto = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/* Lo que se puede cambiar del perfil interno: las mismas reglas que
   PATCH /api/perfiles, y también aquí solo cambia lo que llega. */
const CAMPOS_PERFIL = { bio: 400, especialidad: 80, ciudad: 80, instagram: 40 } as const;

async function guardarPerfil(uid: string, crudo: unknown): Promise<Record<string, string>> {
  const c = objeto(crudo);
  if (!c) return {};
  const cambios: Record<string, string> = {};
  for (const [campo, max] of Object.entries(CAMPOS_PERFIL)) {
    if (!(campo in c)) continue;
    cambios[campo] =
      campo === 'instagram'
        ? texto(c[campo], max).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '')
        : campo === 'bio'
          ? String(c[campo] ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max)
          : texto(c[campo], max);
  }
  if (Object.keys(cambios).length)
    await baseDeDatos()
      .collection('perfiles')
      .doc(uid)
      .set({ ...cambios, actualizado: FieldValue.serverTimestamp() }, { merge: true });
  return cambios;
}

export async function GET(peticion: Request) {
  if (new URL(peticion.url).searchParams.get('todas') === '1') {
    const g = await exigirAdmin();
    if (g.error) return g.error;
    return NextResponse.json({ ok: true, fichas: await listarFichas() }, { headers: PRIVADO });
  }

  const g = await exigirSesion();
  if (g.error) return g.error;
  const uid = g.sesion.uid;
  const db = baseDeDatos();
  const [usuario, perfil, ficha] = await Promise.all([
    db.collection(COLECCIONES.usuarios).doc(uid).get(),
    db.collection('perfiles').doc(uid).get(),
    leerFicha(uid),
  ]);
  const u = usuario.data() ?? {};
  const p = perfil.data() ?? {};
  const o = objeto(u.onboarding) ?? {};

  return NextResponse.json(
    {
      ok: true,
      nombre: String(u.nombre || g.sesion.nombre || ''),
      foto: typeof u.foto === 'string' && u.foto.startsWith('data:image/') ? u.foto : null,
      esMiembro: u.rol === 'sorela' || tieneMembresia(revisarAccesos(u.accesos)),
      onboarding: { version: Number(o.version) || 0, completado: iso(o.completado), saltado: iso(o.saltado) },
      perfil: {
        bio: String(p.bio ?? ''),
        especialidad: String(p.especialidad ?? ''),
        ciudad: String(p.ciudad ?? ''),
        instagram: String(p.instagram ?? ''),
      },
      ficha,
    },
    { headers: PRIVADO }
  );
}

export async function POST(peticion: Request) {
  const g = await exigirSesion();
  if (g.error) return g.error;
  const uid = g.sesion.uid;
  const c = objeto(await peticion.json().catch(() => null)) ?? {};
  const accion = c.accion as Accion;
  if (!ACCIONES.includes(accion)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const usuarios = baseDeDatos().collection(COLECCIONES.usuarios);

  if (accion === 'saltar') {
    // Con merge, el mapa se mezcla: si ya lo había terminado, `completado` se queda.
    await usuarios.doc(uid).set({ onboarding: { version: 1, saltado: FieldValue.serverTimestamp() } }, { merge: true });
    return NextResponse.json({ ok: true });
  }

  if (accion === 'despublicar') {
    await despublicarFicha(uid, 'propia');
    return NextResponse.json({ ok: true, ficha: await leerFicha(uid) });
  }

  const perfil = await guardarPerfil(uid, c.perfil);

  if (accion === 'completar') {
    /* Terminar suma puntos: se pide al menos la ciudad, que está en los dos
       caminos (miembro y no miembro). Lo demás es opcional. */
    const [p, f, u] = await Promise.all([
      baseDeDatos().collection('perfiles').doc(uid).get(),
      leerFicha(uid),
      usuarios.doc(uid).get(),
    ]);
    if (!String(p.get('ciudad') ?? '').trim() && !f?.ciudad)
      return NextResponse.json({ ok: false, errores: { ciudad: 'Escribe tu ciudad para terminar.' } }, { status: 400 });
    // La primera vez que lo termina es la que cuenta: volver a pasar por aquí
    // para cambiar la ficha no mueve la fecha.
    if (!u.get('onboarding.completado'))
      await usuarios.doc(uid).set({ onboarding: { version: 1, completado: FieldValue.serverTimestamp() } }, { merge: true });
    return NextResponse.json({ ok: true });
  }

  if (accion === 'guardar') {
    if (!objeto(c.ficha)) return NextResponse.json({ ok: true, perfil, ficha: await leerFicha(uid) });
    const r = await guardarFicha(uid, c.ficha);
    if (!r.ok) return NextResponse.json({ ok: false, errores: r.errores }, { status: 400 });
    return NextResponse.json({ ok: true, perfil, ficha: r.ficha });
  }

  // publicar
  const r = await guardarFicha(uid, objeto(c.ficha) ?? {}, { publicar: true, consentimiento: c.consentimiento === true });
  if (!r.ok) return NextResponse.json({ ok: false, errores: r.errores }, { status: r.errores.permiso ? 403 : 400 });
  const enLaWeb = r.ficha.estado === 'publicada' && r.ficha.slug;
  return NextResponse.json({ ok: true, perfil, ficha: r.ficha, enlace: enLaWeb ? `/terapeutas/${r.ficha.slug}` : null });
}

export async function PATCH(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = objeto(await peticion.json().catch(() => null)) ?? {};
  const uid = texto(c.uid, 128);
  if (!ID.test(uid) || typeof c.ocultar !== 'boolean') return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const r = await ocultarFicha(uid, c.ocultar);
  if (!r.ok) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  return NextResponse.json({ ok: true, estado: r.estado });
}

export async function DELETE(peticion: Request) {
  const g = await exigirSesion();
  if (g.error) return g.error;
  const uid = texto(new URL(peticion.url).searchParams.get('uid'), 128) || g.sesion.uid;
  if (!ID.test(uid)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  if (uid !== g.sesion.uid && g.sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  /* Si la borra ella y Sorela la tenía oculta, la marca de Sorela se queda
     (ver borrarFicha): borrar y volver a publicar no puede saltarse el «Ocultar». */
  await borrarFicha(uid, { propia: g.sesion.rol !== 'sorela' });
  return NextResponse.json({ ok: true });
}
