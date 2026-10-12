import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual, type Sesion } from '@/lib/sesion-servidor';
import { tieneMembresia } from '@/lib/accesos';
import { COLECCION_ACTIVIDAD, Cuentas, esMes, mesDe, type CampoStats } from '@/lib/actividad';
import { NIVELES, PUNTOS, nivelDe } from '@/lib/puntos-tipos';
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
 *   GET                       → publicaciones, ranking del mes (con su nivel),
 *                               tu puesto y tus puntos del mes, próxima clase
 *   GET ?id=…                 → una publicación con sus respuestas
 *   POST { accion, … }        → publicar, responder, meGusta, fijar, resolver,
 *                               borrar, proximaClase
 *
 * QUIÉN: lee quien tiene la Comunidad Divine o un curso (las alumnas la ven
 * de visita); escribe quien tiene la Comunidad, y Sorela, que además modera:
 * fija, marca resuelto y borra lo que haga falta. Lo PROPIO se puede borrar
 * siempre, aunque ya no se tenga la Comunidad: es suyo.
 *
 * PUNTOS: publicar +20, responder a OTRA +10, cada «me gusta» de OTRA +2. Van
 * al ranking del mes y a los contadores de cada una (lib/actividad.ts), en el
 * MISMO lote que el contenido. Al borrar se resta lo mismo, en el mes en que
 * se sumó. Cada publicación y respuesta guarda lo que aportó (`aporte`) y cada
 * «me gusta» que puntuó guarda su mes: así la resta es exacta.
 *
 * Las fotos son privadas como el material del curso: se guardan sin enlace
 * público y se dan con direcciones que caducan.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POSTS = 'comunidad_posts';
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const RUTA_IMAGEN = /^comunidad\/[A-Za-z0-9_-]{1,80}\/[a-f0-9]{16}\.webp$/;
const VIGENCIA_MS = 60 * 60 * 1000;
/* Firestore admite 500 escrituras por lote. Se deja margen. */
const MAX_LOTE = 450;
/* Lo que daban publicar y responder antes de los puntos nuevos. Lo escrito
   entonces no lleva `aporte`: al borrarlo se resta lo que sumó entonces. */
const ANTES = { publicacion: 3, respuesta: 2 } as const;
const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const fecha = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.().toISOString() ?? null;
const nombreDe = (v: FirebaseFirestore.DocumentData) => String(v.nombre || String(v.correo || '').split('@')[0] || 'Terapeuta');

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
      nombre: nombreDe(v),
      foto: typeof v.foto === 'string' && v.foto.length < 400_000 ? v.foto : null,
      esSorela: v.rol === 'sorela',
    });
  }
  return mapa;
}

const anonima = (uid: string): Autora => ({ uid, nombre: 'Terapeuta', foto: null, esSorela: false });

async function aPublicacion(d: FirebaseFirestore.DocumentSnapshot, autoras: Map<string, Autora>, yo: string): Promise<Publicacion> {
  const v = d.data() ?? {};
  const meGusta = (v.meGusta ?? {}) as Record<string, unknown>;
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

/* ==========================================================================
   Lo que aporta cada cosa, para poder restarlo al borrarla
   ========================================================================== */

type Aporte = { mes: string; puntos: number; cuenta: boolean };

/**
 * Lo que sumó una publicación o respuesta: los puntos del ranking (y en qué
 * mes) y si contó en los contadores de su autora. Lo nuevo lo lleva apuntado;
 * lo de antes se deduce con las reglas de entonces (`legado`).
 */
function aporteDe(v: FirebaseFirestore.DocumentData, legado: { puntos: number; cuenta: boolean }): Aporte {
  const a = (v.aporte ?? null) as Partial<Aporte> | null;
  if (a && esMes(a.mes)) return { mes: a.mes, puntos: Number(a.puntos) || 0, cuenta: a.cuenta !== false };
  const creado = (v.creado as { toDate?: () => Date } | undefined)?.toDate?.();
  return { mes: mesDe(creado ?? new Date()), ...legado };
}

/**
 * Resta a su autora lo que dio algo que se borra: el contador, los puntos del
 * ranking y los «me gusta» de otras que recibió. Los «me gusta» que puntuaron
 * llevan su mes como valor (ver «meGusta» en el POST); los de antes, `true`,
 * nunca dieron puntos de ranking y solo restan del contador.
 */
function restarContenido(c: Cuentas, v: FirebaseFirestore.DocumentData, aporte: Aporte, campo: CampoStats) {
  const autor = String(v.autor ?? '');
  if (aporte.cuenta) c.contar(autor, campo, -1);
  if (aporte.puntos) c.puntuar({ uid: autor }, -aporte.puntos, aporte.mes);
  for (const [quien, valor] of Object.entries((v.meGusta ?? {}) as Record<string, unknown>)) {
    if (!valor || quien === autor) continue;
    c.contar(autor, 'meGustaRecibidos', -1);
    if (esMes(valor)) c.puntuar({ uid: autor }, -PUNTOS.meGusta, valor);
  }
}

/** Quién de estas sigue teniendo ficha, y si es Sorela. */
async function fichasDe(uids: string[]): Promise<Map<string, { sorela: boolean }>> {
  const db = baseDeDatos();
  const unicos = [...new Set(uids)].filter((u) => ID.test(u));
  const mapa = new Map<string, { sorela: boolean }>();
  if (!unicos.length) return mapa;
  const docs = await db.getAll(...unicos.map((u) => db.collection(COLECCIONES.usuarios).doc(u)));
  for (const d of docs) if (d.exists) mapa.set(d.id, { sorela: d.get('rol') === 'sorela' });
  return mapa;
}

/**
 * Borra una publicación con todas sus respuestas y resta lo que aportaron.
 *
 * Por tandas de como mucho MAX_LOTE escrituras: cada tanda borra unas
 * respuestas Y resta lo suyo a la vez, así que si una tanda falla a medias, lo
 * que queda vivo sigue contando y lo borrado ya no. Al reintentar se sigue
 * desde ahí sin restar nada dos veces. La publicación va la última.
 */
async function borrarPublicacion(ref: FirebaseFirestore.DocumentReference, v: FirebaseFirestore.DocumentData) {
  const db = baseDeDatos();
  const autor = String(v.autor ?? '');
  const rs = await ref.collection('respuestas').get();
  const fichas = await fichasDe([autor, ...rs.docs.map((r) => String(r.get('autor') ?? ''))]);
  const vivas = new Set(fichas.keys());
  const esSorela = (uid: string) => fichas.get(uid)?.sorela === true;

  let lote = db.batch();
  let cuentas = new Cuentas();
  let borradas = 0;
  const cerrar = async () => {
    if (!borradas) return;
    cuentas.volcar((r, d) => lote.set(r, d, { merge: true }), vivas);
    lote.update(ref, { respuestas: FieldValue.increment(-borradas) });
    await lote.commit();
    lote = db.batch();
    cuentas = new Cuentas();
    borradas = 0;
  };
  for (const r of rs.docs) {
    const rv = r.data();
    const ra = String(rv.autor ?? '');
    restarContenido(cuentas, rv, aporteDe(rv, { puntos: ra !== autor && !esSorela(ra) ? ANTES.respuesta : 0, cuenta: true }), 'respuestas');
    lote.delete(r.ref);
    borradas++;
    // Margen para lo que puede sumar la siguiente (su autora y los meses de sus «me gusta»).
    if (borradas + cuentas.escrituras >= MAX_LOTE - 10) await cerrar();
  }
  await cerrar();

  const final = db.batch();
  const c = new Cuentas();
  restarContenido(c, v, aporteDe(v, { puntos: esSorela(autor) ? 0 : ANTES.publicacion, cuenta: true }), 'publicaciones');
  c.volcar((r, d) => final.set(r, d, { merge: true }), vivas);
  final.delete(ref);
  await final.commit();
}

/**
 * Borra una respuesta, en transacción: el contador de la publicación baja una
 * sola vez aunque se pulse dos veces, y si era la única de Sorela, la
 * publicación vuelve a «sin responder».
 */
async function borrarRespuesta(ref: FirebaseFirestore.DocumentReference, rid: string, ra: string): Promise<boolean> {
  const db = baseDeDatos();
  const r = ref.collection('respuestas').doc(rid);
  const fichaRef = ID.test(ra) ? db.collection(COLECCIONES.usuarios).doc(ra) : null;
  return db.runTransaction(async (t) => {
    const [rd, pd, fd] = await t.getAll(r, ref, ...(fichaRef ? [fichaRef] : []));
    if (!rd.exists || !pd.exists) return false; // otra petición se ha adelantado
    const rv = rd.data() ?? {};
    const pv = pd.data() ?? {};
    const viva = Boolean(fd?.exists);
    const deSorela = fd?.get('rol') === 'sorela';
    let respondio = Boolean(pv.respondioSorela);
    if (deSorela && respondio) {
      const sorelas = await t.get(db.collection(COLECCIONES.usuarios).where('rol', '==', 'sorela').limit(10));
      const ids = sorelas.docs.map((d) => d.id);
      const otras = ids.length ? await t.get(ref.collection('respuestas').where('autor', 'in', ids).limit(2)) : null;
      respondio = Boolean(otras?.docs.some((d) => d.id !== rid));
    }
    const c = new Cuentas();
    const legado = { puntos: ra !== pv.autor && !deSorela ? ANTES.respuesta : 0, cuenta: true };
    restarContenido(c, rv, aporteDe(rv, legado), 'respuestas');
    t.delete(r);
    t.update(ref, { respuestas: Math.max(0, (Number(pv.respuestas) || 0) - 1), respondioSorela: respondio });
    c.volcar((x, d) => t.set(x, d, { merge: true }), new Set(viva ? [ra] : []));
    return true;
  });
}

/* ==========================================================================
   El ranking del mes
   ========================================================================== */

type FilaRanking = { uid: string; nombre: string; puntos: number; nivel: { n: number; nombre: string } | null };

/** Su nivel según la foto fija que guarda lib/logros.ts (no se recalcula aquí). */
function nivelBreve(u: FirebaseFirestore.DocumentData): { n: number; nombre: string } | null {
  if (typeof u.puntosTotal === 'number') {
    const e = nivelDe(u.puntosTotal);
    return { n: e.n, nombre: e.nombre };
  }
  const x = NIVELES.find((l) => l.n === u.nivel);
  return x ? { n: x.n, nombre: x.nombre } : null;
}

async function rankingDelMes(
  actividad: FirebaseFirestore.DocumentSnapshot,
  yo: string,
  soySorela: boolean
): Promise<{ ranking: FilaRanking[]; mio: { puesto: number | null; puntos: number } | null }> {
  const db = baseDeDatos();
  const mapa = (actividad.data() ?? {}) as Record<string, { nombre?: unknown; puntos?: unknown }>;
  const orden = Object.entries(mapa)
    .map(([uid, v]) => ({ uid, nombre: String(v?.nombre ?? ''), puntos: Math.round(Number(v?.puntos) || 0) }))
    .filter((x) => x.puntos > 0 && ID.test(x.uid))
    .sort((a, b) => b.puntos - a.puntos);
  /* Se miran unas pocas más de cinco: alguna puede tener ya la cuenta borrada
     (o ser Sorela), y esas no salen. De las que salen, nombre y nivel al día. */
  const candidatas = orden.slice(0, 8);
  const fichas = candidatas.length ? await db.getAll(...candidatas.map((x) => db.collection(COLECCIONES.usuarios).doc(x.uid))) : [];
  const fuera = new Set<string>();
  const datos = new Map<string, FirebaseFirestore.DocumentData>();
  for (const d of fichas) {
    if (!d.exists || d.get('rol') === 'sorela') fuera.add(d.id);
    else datos.set(d.id, d.data() ?? {});
  }
  const limpia = orden.filter((x) => !fuera.has(x.uid));
  const ranking = limpia.slice(0, 5).map((x) => {
    const u = datos.get(x.uid);
    return { uid: x.uid, nombre: u ? nombreDe(u) : x.nombre || 'Terapeuta', puntos: x.puntos, nivel: u ? nivelBreve(u) : null };
  });
  if (soySorela) return { ranking, mio: null };
  const i = limpia.findIndex((x) => x.uid === yo);
  return { ranking, mio: { puesto: i >= 0 ? i + 1 : null, puntos: Math.max(0, Math.round(Number(mapa[yo]?.puntos) || 0)) } };
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
      const mg = (v.meGusta ?? {}) as Record<string, unknown>;
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
    db.collection(COLECCION_ACTIVIDAD).doc(mesDe()).get(),
    db.collection(COLECCIONES.ajustes).doc('comunidad').get(),
    db.collection(COLECCIONES.usuarios).where('rol', '==', 'sorela').limit(5).get(),
  ]);
  /* Quién firma la bienvenida: la cuenta de Sorela, con su foto si la tiene. */
  const ficha = admins.docs.map((d) => d.data()).sort((a, b) => Number(Boolean(b.foto)) - Number(Boolean(a.foto)))[0];
  const sorela = {
    nombre: String(ficha?.nombre || 'Sorela Caro'),
    foto: typeof ficha?.foto === 'string' && ficha.foto.length < 400_000 ? ficha.foto : null,
  };
  const [autoras, { ranking, mio }] = await Promise.all([
    autorasDe(lista.docs.map((d) => d.data().autor)),
    rankingDelMes(actividad, yo, p.modera),
  ]);
  const publicaciones = await Promise.all(lista.docs.map((d) => aPublicacion(d, autoras, yo)));
  // Las fijadas, arriba; el resto por última actividad.
  publicaciones.sort((a, b) => Number(b.fijada) - Number(a.fijada));

  const pc = ajustes.data()?.proximaClase;
  const proximaClase =
    pc?.cuando && new Date(pc.cuando).getTime() > Date.now() - 3 * 3600_000
      ? { titulo: String(pc.titulo ?? 'Clase en vivo'), cuando: String(pc.cuando), enlace: p.escribir ? String(pc.enlace ?? '') : '' }
      : null;

  return NextResponse.json({
    ok: true,
    puedeEscribir: p.escribir,
    modera: p.modera,
    /* Quién eres (para escribir) y cómo vas este mes. Sorela no puntúa: a
       ella le llega `puesto: null, puntos: 0` y `puntua: false`. */
    yo: { uid: yo, nombre: p.sesion.nombre ?? '', foto: p.sesion.foto ?? null, puntua: mio !== null, puesto: mio?.puesto ?? null, puntos: mio?.puntos ?? 0 },
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
  const rid = typeof c.rid === 'string' && ID.test(c.rid) ? c.rid : null;
  const no = (motivo: string, status = 403) => NextResponse.json({ ok: false, motivo }, { status });

  /* «Me gusta» lo puede dar quien lee; lo demás, quien escribe.
     Todo en una transacción: el «me gusta», el contador de quien lo recibe y
     su punto del ranking. Darse «me gusta» a una misma no cuenta, y a Sorela
     no le suma ranking. El valor guardado es el MES si puntuó (para restarlo
     en ese mismo mes) y `true` si no. */
  if (accion === 'meGusta') {
    if (!p.leer || !ref) return no('sin-acceso');
    const objetivo = rid ? ref.collection('respuestas').doc(rid) : ref;
    const r = await db.runTransaction(async (t) => {
      const d = await t.get(objetivo);
      if (!d.exists) return null;
      const v = d.data() ?? {};
      const autor = String(v.autor ?? '');
      const previo = ((v.meGusta ?? {}) as Record<string, unknown>)[yo];
      const dado = Boolean(previo);
      const ajena = ID.test(autor) && autor !== yo;
      const ficha = ajena ? await t.get(db.collection(COLECCIONES.usuarios).doc(autor)) : null;
      const viva = Boolean(ficha?.exists);
      const cuentas = new Cuentas();
      if (dado) {
        t.update(objetivo, { [`meGusta.${yo}`]: FieldValue.delete() });
        if (viva) {
          cuentas.contar(autor, 'meGustaRecibidos', -1);
          if (esMes(previo)) cuentas.puntuar({ uid: autor }, -PUNTOS.meGusta, previo);
        }
      } else {
        const puntua = viva && ficha?.get('rol') !== 'sorela';
        const mes = mesDe();
        t.update(objetivo, { [`meGusta.${yo}`]: puntua ? mes : true });
        if (viva) cuentas.contar(autor, 'meGustaRecibidos', 1);
        if (puntua) cuentas.puntuar({ uid: autor, nombre: nombreDe(ficha?.data() ?? {}) }, PUNTOS.meGusta, mes);
      }
      cuentas.volcar((x, datos) => t.set(x, datos, { merge: true }));
      return { dado: !dado };
    });
    if (r === null) return no('no-existe', 404);
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

  /* Borrar: la autora, SIEMPRE (aunque ya no tenga la Comunidad: lo que
     escribió es suyo), y Sorela, todo. Por eso va antes de mirar si escribe. */
  if (accion === 'borrar') {
    if (!ref) return no('datos', 400);
    if (rid) {
      const rd = await ref.collection('respuestas').doc(rid).get();
      if (!rd.exists) return no('no-existe', 404);
      const ra = String(rd.get('autor') ?? '');
      if (!p.modera && ra !== yo) return no('sin-permiso');
      if (!(await borrarRespuesta(ref, rid, ra))) return no('no-existe', 404);
      return NextResponse.json({ ok: true });
    }
    const d = await ref.get();
    if (!d.exists) return no('no-existe', 404);
    const v = d.data() ?? {};
    if (!p.modera && v.autor !== yo) return no('sin-permiso');
    await borrarPublicacion(ref, v);
    for (const ruta of Array.isArray(v.imagenes) ? v.imagenes : []) await almacen().file(String(ruta)).delete().catch(() => {});
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
    const mes = mesDe();
    const puntos = autora.esSorela ? 0 : PUNTOS.publicacion;
    const lote = db.batch();
    lote.set(nueva, {
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
      aporte: { mes, puntos },
    });
    new Cuentas()
      .contar(yo, 'publicaciones', 1)
      .puntuar(autora, puntos, mes)
      .volcar((x, d) => lote.set(x, d, { merge: true }));
    await lote.commit();
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
    const mes = mesDe();
    // Responder en lo propio no cuenta: el mérito es echar una mano a otra.
    const cuenta = !esAutora;
    const puntos = cuenta && !autora.esSorela ? PUNTOS.respuesta : 0;
    const lote = db.batch();
    lote.set(r, { autor: yo, texto, creado: FieldValue.serverTimestamp(), meGusta: {}, aporte: { mes, puntos, cuenta } });
    lote.update(ref, {
      respuestas: FieldValue.increment(1),
      ultimaActividad: FieldValue.serverTimestamp(),
      ...(p.modera ? { respondioSorela: true } : {}),
    });
    const cuentas = new Cuentas().puntuar(autora, puntos, mes);
    if (cuenta) cuentas.contar(yo, 'respuestas', 1);
    cuentas.volcar((x, datos) => lote.set(x, datos, { merge: true }));
    await lote.commit();
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

  return no('datos', 400);
}
