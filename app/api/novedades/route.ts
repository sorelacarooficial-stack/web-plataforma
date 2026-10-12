import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * Lo que ha pasado, para los avisos flotantes del panel de Sorela.
 *
 *   GET ?desde=<ISO>  → { ahora, novedades: [...] }
 *
 * Junta en una lista lo que ha ido llegando desde `desde`: contactos nuevos de
 * la web, gente que se registra o que entra con su enlace, acuerdos firmados,
 * y lo que tiene en la agenda en la próxima hora. El panel lo pide al entrar
 * («mientras no estabas») y luego cada minuto.
 *
 * Solo lee. No marca nada como visto: eso lo lleva el navegador, que es quien
 * sabe qué avisos ha enseñado ya.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Vista = 'leads' | 'cuentas' | 'acuerdos' | 'agenda' | 'comunidad';
export type Novedad = {
  id: string;
  tipo: 'contacto' | 'registro' | 'invitacion' | 'acuerdo' | 'cita' | 'comunidad';
  titulo: string;
  texto: string;
  cuando: string;
  ir: Vista;
};

const MAX_ATRAS_MS = 7 * 24 * 60 * 60 * 1000;
const PROXIMA_HORA_MS = 60 * 60 * 1000;

const ORIGENES: Record<string, string> = {
  'formacion-registro': 'se ha registrado desde la web',
  'comunidad-registro': 'se ha registrado desde la web',
};

/** «Ana López» → «Ana López»; sin nombre, la parte del correo antes de la @. */
const quien = (nombre: unknown, correo: unknown) =>
  String(nombre || '').trim() || String(correo || '').split('@')[0] || 'Alguien';

const fechaDe = (v: unknown): string | null => {
  const t = (v as { toDate?: () => Date })?.toDate?.();
  return t ? t.toISOString() : typeof v === 'string' ? v : null;
};

export async function GET(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });

  const ahora = Date.now();
  const pedido = new Date(new URL(peticion.url).searchParams.get('desde') ?? '').getTime();
  const desde = new Date(Number.isNaN(pedido) ? ahora - 24 * 3600_000 : Math.max(pedido, ahora - MAX_ATRAS_MS));
  const ts = Timestamp.fromDate(desde);
  const db = baseDeDatos();
  const novedades: Novedad[] = [];

  // Cada fuente por su lado: si una falla, las demás siguen avisando.
  const fuentes = await Promise.allSettled([
    db.collection(COLECCIONES.contactos).where('creado', '>', ts).orderBy('creado', 'desc').limit(20).get(),
    db.collection(COLECCIONES.usuarios).where('creado', '>', ts).orderBy('creado', 'desc').limit(20).get(),
    db.collection('acuerdos').where('firmadoEl', '>', desde.toISOString()).orderBy('firmadoEl', 'desc').limit(20).get(),
    db
      .collection(COLECCIONES.usuarios)
      .doc(sesion.uid)
      .collection(COLECCIONES.agenda)
      .where('cuando', '>=', Timestamp.fromMillis(ahora))
      .where('cuando', '<=', Timestamp.fromMillis(ahora + PROXIMA_HORA_MS))
      .orderBy('cuando', 'asc')
      .limit(5)
      .get(),
  ]);
  const [contactos, usuarios, acuerdos, agenda] = fuentes.map((f) => (f.status === 'fulfilled' ? f.value : null));
  fuentes.forEach((f, i) => f.status === 'rejected' && console.error('[novedades] fuente', i, f.reason));

  for (const d of contactos?.docs ?? []) {
    const v = d.data();
    // Quien se registra ya sale abajo, como cuenta: no se avisa dos veces.
    if (v.registrada || v.origen === 'invitacion' || ORIGENES[v.origen]) continue;
    novedades.push({
      id: `contacto:${d.id}`,
      tipo: 'contacto',
      titulo: 'Nuevo contacto',
      texto: `${quien(v.nombre, v.correo)}${v.ciudad ? ` · ${v.ciudad}` : ''} ha dejado sus datos en la web.`,
      cuando: fechaDe(v.creado) ?? desde.toISOString(),
      ir: 'leads',
    });
  }

  for (const d of usuarios?.docs ?? []) {
    const v = d.data();
    if (v.altaPor !== 'registro' && v.altaPor !== 'invitacion') continue;
    const n = quien(v.nombre, v.correo);
    novedades.push(
      v.altaPor === 'invitacion'
        ? {
            id: `invitacion:${d.id}`,
            tipo: 'invitacion',
            titulo: 'Ha entrado con su enlace',
            texto: `${n} ya tiene su cuenta y su acceso.`,
            cuando: fechaDe(v.creado) ?? desde.toISOString(),
            ir: 'cuentas',
          }
        : {
            id: `registro:${d.id}`,
            tipo: 'registro',
            titulo: 'Registro nuevo',
            texto: `${n} se ha creado una cuenta${v.pide === 'curso' ? ' y pide la formación' : v.pide === 'comunidad' ? ' y pide la Comunidad' : ''}. Todavía no tiene acceso.`,
            cuando: fechaDe(v.creado) ?? desde.toISOString(),
            ir: 'cuentas',
          }
    );
  }

  // Quien ya tenía cuenta y canjea un enlace no crea ficha nueva: sale aquí.
  try {
    const usadas = await db
      .collection(COLECCIONES.invitaciones)
      .where('usada.en', '>', ts)
      .orderBy('usada.en', 'desc')
      .limit(20)
      .get();
    for (const d of usadas.docs) {
      const u = d.data().usada ?? {};
      if (novedades.some((n) => n.id === `invitacion:${u.uid}`)) continue;
      novedades.push({
        id: `invitacion:${u.uid}:${d.id}`,
        tipo: 'invitacion',
        titulo: 'Ha usado su enlace',
        texto: `${quien(u.nombre, u.correo)} ya tiene su nuevo acceso.`,
        cuando: fechaDe(u.en) ?? desde.toISOString(),
        ir: 'cuentas',
      });
    }
  } catch (e) {
    console.error('[novedades] invitaciones', e);
  }

  // La comunidad: lo que publican las terapeutas (lo de Sorela no se avisa a ella misma).
  try {
    const posts = await db.collection('comunidad_posts').where('creado', '>', ts).orderBy('creado', 'desc').limit(20).get();
    const autoras = posts.docs.map((d) => d.data().autor).filter((a) => a && a !== sesion.uid);
    const fichas = autoras.length
      ? new Map((await db.getAll(...[...new Set(autoras)].map((u) => db.collection(COLECCIONES.usuarios).doc(u)))).map((f) => [f.id, f.data() ?? {}]))
      : new Map();
    for (const d of posts.docs) {
      const v = d.data();
      if (v.autor === sesion.uid) continue;
      const f = fichas.get(v.autor) ?? {};
      novedades.push({
        id: `comunidad:${d.id}`,
        tipo: 'comunidad',
        titulo: v.categoria === 'Duda' ? 'Una duda en la comunidad' : 'Nueva publicación',
        texto: `${quien(f.nombre, f.correo)}: «${String(v.titulo ?? '').slice(0, 80)}»`,
        cuando: fechaDe(v.creado) ?? desde.toISOString(),
        ir: 'comunidad',
      });
    }
  } catch (e) {
    console.error('[novedades] comunidad', e);
  }

  for (const d of acuerdos?.docs ?? []) {
    const v = d.data();
    novedades.push({
      id: `acuerdo:${d.id}`,
      tipo: 'acuerdo',
      titulo: 'Acuerdo firmado',
      texto: `${quien([v.nombre, v.apellidos].filter(Boolean).join(' '), v.correo)} ha firmado el acuerdo de confidencialidad.`,
      cuando: String(v.firmadoEl),
      ir: 'acuerdos',
    });
  }

  for (const d of agenda?.docs ?? []) {
    const v = d.data();
    if (v.estado && v.estado !== 'Pendiente') continue;
    const cuando = fechaDe(v.cuando) ?? new Date(ahora).toISOString();
    const min = Math.max(0, Math.round((new Date(cuando).getTime() - ahora) / 60000));
    novedades.push({
      id: `cita:${d.id}`,
      tipo: 'cita',
      titulo: min <= 1 ? 'Empieza ya' : `Dentro de ${min} min`,
      texto: String(v.titulo || 'Algo apuntado en tu agenda'),
      cuando,
      ir: 'agenda',
    });
  }

  novedades.sort((a, b) => b.cuando.localeCompare(a.cuando));
  return NextResponse.json(
    { ok: true, ahora: new Date(ahora).toISOString(), novedades },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
