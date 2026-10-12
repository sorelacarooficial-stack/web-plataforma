import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual, type Sesion } from '@/lib/sesion-servidor';
import { tieneMembresia } from '@/lib/accesos';
import {
  CATEGORIAS_COMUNIDAD,
  type Autora,
  type CategoriaComunidad,
  type Publicacion,
  type Respuesta,
} from '@/lib/comunidad-tipos';

/**
 * La comunidad de terapeutas.
 *
 *   GET                       → publicaciones, ranking del mes, próxima clase
 *   GET ?id=…                 → una publicación con sus respuestas
 *   POST { accion, … }        → publicar, responder, meGusta, fijar, resolver,
 *                               borrar, proximaClase
 *
 * QUIÉN: lee quien tiene la Comunidad Divine o un curso (las alumnas la ven
 * de visita); escribe quien tiene la Comunidad, y Sorela, que además modera:
 * fija, marca resuelto y borra lo que haga falta.
 *
 * Las fotos son privadas como el material del curso: se guardan sin enlace
 * público y se dan con direcciones que caducan.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POSTS = 'comunidad_posts';
const ACTIVIDAD = 'comunidad_actividad';
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const RUTA_IMAGEN = /^comunidad\/[A-Za-z0-9_-]{1,80}\/[a-f0-9]{16}\.webp$/;
const VIGENCIA_MS = 60 * 60 * 1000;
const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const fecha = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.().toISOString() ?? null;
const mesDe = (d = new Date()) => d.toISOString().slice(0, 7);

type Permisos = { sesion: Sesion; leer: boolean; escribir: boolean; modera: boolean };

async function permisos(): Promise<Permisos | NextResponse> {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol === 'sorela') return { sesion, leer: true, escribir: true, modera: true };
  const accesos = await accesosDe(sesion.uid);
  const miembro = tieneMembresia(accesos);
  return { sesion, leer: accesos.length > 0, escribir: miembro, modera: false };
}

function almacen() {
  return getStorage(aplicacion()).bucket(
    process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`
  );
}

async function firmar(rutas: string[]): Promise<string[]> {
  const caduca = Date.now() + VIGENCIA_MS;
  return Promise.all(
    rutas.map((r) =>
      almacen()
        .file(r)
        .getSignedUrl({ version: 'v4', action: 'read', expires: caduca })
        .then(([u]) => u)
        .catch(() => '')
    )
  ).then((l) => l.filter(Boolean));
}

/** Nombre y foto de cada autora, leídos de su ficha: así siempre están al día. */
async function autorasDe(uids: string[]): Promise<Map<string, Autora>> {
  const unicos = [...new Set(uids)].filter((u) => ID.test(u));
  const mapa = new Map<string, Autora>();
  if (!unicos.length) return mapa;
  const docs = await baseDeDatos().getAll(...unicos.map((u) => baseDeDatos().collection(COLECCIONES.usuarios).doc(u)));
  for (const d of docs) {
    const v = d.data() ?? {};
    mapa.set(d.id, {
      uid: d.id,
      nombre: String(v.nombre || String(v.correo || '').split('@')[0] || 'Terapeuta'),
      foto: typeof v.foto === 'string' && v.foto.length < 400_000 ? v.foto : null,
      esSorela: v.rol === 'sorela',
    });
  }
  return mapa;
}

const anonima = (uid: string): Autora => ({ uid, nombre: 'Terapeuta', foto: null, esSorela: false });

async function aPublicacion(d: FirebaseFirestore.DocumentSnapshot, autoras: Map<string, Autora>, yo: string): Promise<Publicacion> {
  const v = d.data() ?? {};
  const meGusta = (v.meGusta ?? {}) as Record<string, boolean>;
  return {
    id: d.id,
    autora: autoras.get(v.autor) ?? anonima(v.autor),
    categoria: (CATEGORIAS_COMUNIDAD as readonly string[]).includes(v.categoria) ? v.categoria : 'Caso',
    titulo: String(v.titulo ?? ''),
    texto: String(v.texto ?? ''),
    imagenes: await firmar(Array.isArray(v.imagenes) ? v.imagenes : []),
    creado: fecha(v.creado),
    ultimaActividad: fecha(v.ultimaActividad) ?? fecha(v.creado),
    respuestas: Number(v.respuestas) || 0,
    meGusta: Object.values(meGusta).filter(Boolean).length,
    loHeDado: Boolean(meGusta[yo]),
    fijada: Boolean(v.fijada),
    resuelta: Boolean(v.resuelta),
    respondioSorela: Boolean(v.respondioSorela),
    esMia: v.autor === yo,
  };
}

/* Contadores por persona para los logros (lib/logros.ts): cuántas veces ha
   publicado, respondido y cuántos «me gusta» ha recibido. Nunca rompen nada. */
async function contar(uid: string, campo: 'publicaciones' | 'respuestas' | 'meGustaRecibidos', n = 1) {
  await baseDeDatos()
    .collection(COLECCIONES.usuarios)
    .doc(uid)
    .set({ stats: { [campo]: FieldValue.increment(n) } }, { merge: true })
    .catch(() => null);
}

async function sumarActividad(autora: Autora, puntos: number) {
  if (autora.esSorela) return; // el ranking es de las terapeutas
  await baseDeDatos()
    .collection(ACTIVIDAD)
    .doc(mesDe())
    .set({ [autora.uid]: { nombre: autora.nombre, puntos: FieldValue.increment(puntos) } }, { merge: true });
}

export async function GET(peticion: Request) {
  const p = await permisos();
  if (p instanceof NextResponse) return p;
  if (!p.leer) return NextResponse.json({ ok: false, motivo: 'sin-acceso' }, { status: 403 });
  const db = baseDeDatos();
  const yo = p.sesion.uid;
  const id = new URL(peticion.url).searchParams.get('id');

  if (id) {
    if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
    const ref = db.collection(POSTS).doc(id);
    const [d, rs] = await Promise.all([ref.get(), ref.collection('respuestas').orderBy('creado', 'asc').limit(200).get()]);
    if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
    const autoras = await autorasDe([d.data()?.autor, ...rs.docs.map((r) => r.data().autor)]);
    const respuestas: Respuesta[] = rs.docs.map((r) => {
      const v = r.data();
      const mg = (v.meGusta ?? {}) as Record<string, boolean>;
      return {
        id: r.id,
        autora: autoras.get(v.autor) ?? anonima(v.autor),
        texto: String(v.texto ?? ''),
        creado: fecha(v.creado),
        meGusta: Object.values(mg).filter(Boolean).length,
        loHeDado: Boolean(mg[yo]),
        esMia: v.autor === yo,
      };
    });
    return NextResponse.json({ ok: true, publicacion: await aPublicacion(d, autoras, yo), respuestas });
  }

  const [lista, actividad, ajustes, admins] = await Promise.all([
    db.collection(POSTS).orderBy('ultimaActividad', 'desc').limit(60).get(),
    db.collection(ACTIVIDAD).doc(mesDe()).get(),
    db.collection(COLECCIONES.ajustes).doc('comunidad').get(),
    db.collection(COLECCIONES.usuarios).where('rol', '==', 'sorela').limit(5).get(),
  ]);
  /* Quién firma la bienvenida: la cuenta de Sorela, con su foto si la tiene. */
  const ficha = admins.docs.map((d) => d.data()).sort((a, b) => Number(Boolean(b.foto)) - Number(Boolean(a.foto)))[0];
  const sorela = {
    nombre: String(ficha?.nombre || 'Sorela Caro'),
    foto: typeof ficha?.foto === 'string' && ficha.foto.length < 400_000 ? ficha.foto : null,
  };
  const autoras = await autorasDe(lista.docs.map((d) => d.data().autor));
  const publicaciones = await Promise.all(lista.docs.map((d) => aPublicacion(d, autoras, yo)));
  // Las fijadas, arriba; el resto por última actividad.
  publicaciones.sort((a, b) => Number(b.fijada) - Number(a.fijada));

  const ranking = Object.entries((actividad.data() ?? {}) as Record<string, { nombre?: string; puntos?: number }>)
    .map(([uid, v]) => ({ uid, nombre: String(v.nombre ?? 'Terapeuta'), puntos: Number(v.puntos) || 0 }))
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 5);

  const pc = ajustes.data()?.proximaClase;
  const proximaClase =
    pc?.cuando && new Date(pc.cuando).getTime() > Date.now() - 3 * 3600_000
      ? { titulo: String(pc.titulo ?? 'Clase en vivo'), cuando: String(pc.cuando), enlace: p.escribir ? String(pc.enlace ?? '') : '' }
      : null;

  return NextResponse.json({
    ok: true,
    puedeEscribir: p.escribir,
    modera: p.modera,
    yo: { uid: yo, nombre: p.sesion.nombre ?? '', foto: p.sesion.foto ?? null },
    publicaciones,
    ranking,
    proximaClase,
    sorela,
  });
}

export async function POST(peticion: Request) {
  const p = await permisos();
  if (p instanceof NextResponse) return p;
  let c: Record<string, unknown>;
  try {
    c = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const db = baseDeDatos();
  const yo = p.sesion.uid;
  const accion = String(c.accion ?? '');
  const id = typeof c.id === 'string' && ID.test(c.id) ? c.id : null;
  const ref = id ? db.collection(POSTS).doc(id) : null;
  const no = (motivo: string, status = 403) => NextResponse.json({ ok: false, motivo }, { status });

  /* «Me gusta» lo puede dar quien lee; lo demás, quien escribe. */
  if (accion === 'meGusta') {
    if (!p.leer || !ref) return no('sin-acceso');
    const rid = typeof c.rid === 'string' && ID.test(c.rid) ? c.rid : null;
    const objetivo = rid ? ref.collection('respuestas').doc(rid) : ref;
    const r = await db.runTransaction(async (t) => {
      const d = await t.get(objetivo);
      if (!d.exists) return null;
      const dado = Boolean(d.data()?.meGusta?.[yo]);
      t.update(objetivo, { [`meGusta.${yo}`]: !dado });
      return { dado: !dado, autor: String(d.data()?.autor ?? '') };
    });
    if (r === null) return no('no-existe', 404);
    if (r.autor && r.autor !== yo) await contar(r.autor, 'meGustaRecibidos', r.dado ? 1 : -1);
    return NextResponse.json({ ok: true, loHeDado: r.dado });
  }

  if (accion === 'proximaClase') {
    if (!p.modera) return no('sin-permiso');
    const cuando = recortar(c.cuando, 40);
    const enlace = recortar(c.enlace, 400);
    if (cuando && Number.isNaN(new Date(cuando).getTime())) return no('fecha', 400);
    if (enlace && !/^https:\/\//.test(enlace)) return no('enlace', 400);
    await db
      .collection(COLECCIONES.ajustes)
      .doc('comunidad')
      .set({ proximaClase: cuando ? { titulo: recortar(c.titulo, 120) || 'Clase en vivo', cuando: new Date(cuando).toISOString(), enlace } : null }, { merge: true });
    return NextResponse.json({ ok: true });
  }

  if (!p.escribir) return no('sin-acceso');
  const [yoAutora] = [...(await autorasDe([yo])).values()];
  const autora = yoAutora ?? { uid: yo, nombre: p.sesion.nombre ?? 'Terapeuta', foto: null, esSorela: p.modera };

  if (accion === 'publicar') {
    const categoria = String(c.categoria) as CategoriaComunidad;
    const titulo = recortar(c.titulo, 140);
    const texto = recortar(c.texto, 5000);
    const imagenes = (Array.isArray(c.imagenes) ? c.imagenes : [])
      .map((x) => String(x))
      .filter((x) => RUTA_IMAGEN.test(x) && x.startsWith(`comunidad/${yo}/`))
      .slice(0, 4);
    const errores: Record<string, string> = {};
    if (!(CATEGORIAS_COMUNIDAD as readonly string[]).includes(categoria)) errores.categoria = 'Elige de qué va.';
    if (categoria === 'Anuncio' && !p.modera) errores.categoria = 'Los anuncios son solo de Sorela.';
    if (titulo.length < 3) errores.titulo = 'Ponle un título corto.';
    if (texto.length < 5 && !imagenes.length) errores.texto = 'Cuéntalo un poco.';
    if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
    const nueva = db.collection(POSTS).doc();
    await nueva.set({
      autor: yo,
      categoria,
      titulo,
      texto,
      imagenes,
      creado: FieldValue.serverTimestamp(),
      ultimaActividad: FieldValue.serverTimestamp(),
      respuestas: 0,
      meGusta: {},
      fijada: categoria === 'Anuncio',
      resuelta: false,
      respondioSorela: false,
    });
    await sumarActividad(autora, 3);
    await contar(yo, 'publicaciones');
    return NextResponse.json({ ok: true, id: nueva.id });
  }

  if (!ref) return no('datos', 400);
  const d = await ref.get();
  if (!d.exists) return no('no-existe', 404);
  const v = d.data() ?? {};
  const esAutora = v.autor === yo;

  if (accion === 'responder') {
    const texto = recortar(c.texto, 3000);
    if (texto.length < 2) return NextResponse.json({ ok: false, motivo: 'datos', errores: { texto: 'Escribe tu respuesta.' } }, { status: 400 });
    const r = ref.collection('respuestas').doc();
    const lote = db.batch();
    lote.set(r, { autor: yo, texto, creado: FieldValue.serverTimestamp(), meGusta: {} });
    lote.update(ref, {
      respuestas: FieldValue.increment(1),
      ultimaActividad: FieldValue.serverTimestamp(),
      ...(p.modera ? { respondioSorela: true } : {}),
    });
    await lote.commit();
    if (!esAutora) await sumarActividad(autora, 2);
    await contar(yo, 'respuestas');
    return NextResponse.json({ ok: true, rid: r.id });
  }

  if (accion === 'fijar') {
    if (!p.modera) return no('sin-permiso');
    await ref.update({ fijada: !v.fijada });
    return NextResponse.json({ ok: true });
  }

  if (accion === 'resolver') {
    if (!p.modera && !esAutora) return no('sin-permiso');
    await ref.update({ resuelta: !v.resuelta });
    return NextResponse.json({ ok: true });
  }

  if (accion === 'borrar') {
    const rid = typeof c.rid === 'string' && ID.test(c.rid) ? c.rid : null;
    if (rid) {
      const r = ref.collection('respuestas').doc(rid);
      const rd = await r.get();
      if (!rd.exists) return no('no-existe', 404);
      if (!p.modera && rd.data()?.autor !== yo) return no('sin-permiso');
      await r.delete();
      await ref.update({ respuestas: FieldValue.increment(-1) });
      return NextResponse.json({ ok: true });
    }
    if (!p.modera && !esAutora) return no('sin-permiso');
    const rs = await ref.collection('respuestas').get();
    const lote = db.batch();
    rs.docs.forEach((x) => lote.delete(x.ref));
    lote.delete(ref);
    await lote.commit();
    for (const ruta of Array.isArray(v.imagenes) ? v.imagenes : []) await almacen().file(String(ruta)).delete().catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return no('datos', 400);
}
