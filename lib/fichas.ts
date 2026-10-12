import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { revalidatePath } from 'next/cache';
import { revisarAccesos, tieneMembresia } from './accesos';
import { aplicacion, baseDeDatos, COLECCIONES, hayFirebase } from './firebase-servidor';
import { geocodificar } from './geocodificar';
import {
  COLECCION_FICHAS,
  COLECCION_PUBLICAS,
  FICHA_VACIA,
  TEXTO_CONSENTIMIENTO,
  VERSION_CONSENTIMIENTO,
  contactosLimpios,
  fichaPublicaDe,
  mezclarFicha,
  paisNombreDe,
  revisarFicha,
  slugDe,
  type DatosFicha,
  type ErroresFicha,
  type EstadoFicha,
  type Ficha,
  type FilaFicha,
  type Precision,
} from './fichas-tipos';

/**
 * Las fichas del mapa, del lado del servidor: guardar, publicar, quitar,
 * ocultar y borrar.
 *
 * La ficha SALE SOLA al publicar, sin que Sorela la apruebe una a una: si
 * cumple (miembro, permiso explícito, datos completos y sin promesas de salud)
 * se publica en el momento. Sorela la puede ocultar después; mientras está
 * oculta por ella, volver a publicar no la saca.
 *
 * Todo lo que se escribe pasa por aquí, y aquí se decide qué se copia a la web:
 * la copia pública (`terapeutas_publicas/{slug}`) se escribe ENTERA cada vez
 * con `fichaPublicaDe`, nunca a trozos, para que un campo que se deja de
 * enseñar desaparezca de verdad y no se quede colgando de la versión anterior.
 *
 * La foto pública es una COPIA del avatar, subida a Storage con un enlace
 * permanente: el avatar vive en Firestore como imagen pequeña y no sirve para
 * una web. Se sube solo al publicar —nunca antes del permiso— y se borra al
 * quitar la ficha.
 */

const bucket = () =>
  getStorage(aplicacion()).bucket(process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`);

const fichas = () => baseDeDatos().collection(COLECCION_FICHAS);
const publicas = () => baseDeDatos().collection(COLECCION_PUBLICAS);

/** Cuántas veces al día se puede preguntar al servicio de mapas por una misma persona. */
const GEO_MAX_DIA = 30;

const AVATAR = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/;

export const TEXTO_SIN_LUGAR = 'No he podido situar esa dirección en el mapa. Revisa la ciudad o el código postal.';

/* --------------------------------------------------------------- lectura */

const iso = (v: unknown): string | null =>
  v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate().toISOString() : null;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Lo que ella escribió, tal como está guardado. */
function datosDe(v: DocumentData): DatosFicha {
  return mezclarFicha(FICHA_VACIA, {
    nombre: v.nombre,
    centro: v.centro,
    frase: v.frase,
    sobre: v.sobre,
    especialidad: v.especialidad,
    tratamientos: Array.isArray(v.tratamientos) ? v.tratamientos : [],
    pais: v.pais ?? 'ES',
    ciudad: v.ciudad,
    cp: v.cp,
    direccion: v.direccion,
    mostrarDireccion: v.mostrarDireccion === true,
    whatsapp: v.whatsapp,
    instagram: v.instagram,
    web: v.web,
  });
}

const estadoDe = (v: unknown): EstadoFicha => (v === 'publicada' || v === 'oculta' ? v : 'borrador');

function fichaDe(uid: string, v: DocumentData): Ficha {
  const d = datosDe(v);
  const c = v.consentimiento;
  return {
    ...d,
    uid,
    estado: estadoDe(v.estado),
    ocultaPorSorela: v.ocultaPorSorela === true,
    slug: typeof v.slug === 'string' && v.slug ? v.slug : null,
    paisNombre: paisNombreDe(d.pais),
    lat: num(v.lat),
    lng: num(v.lng),
    precision: v.precision === 'exacta' ? 'exacta' : 'ciudad',
    foto: typeof v.foto === 'string' && v.foto ? v.foto : null,
    consentimiento:
      c && typeof c === 'object' && c.version
        ? { fecha: iso(c.fecha) ?? '', version: String(c.version), texto: String(c.texto ?? '') }
        : null,
    creado: iso(v.creado),
    actualizado: iso(v.actualizado),
    publicadaEl: iso(v.publicadaEl),
  };
}

/** La ficha de una persona, o null si nunca ha guardado ninguna. */
export async function leerFicha(uid: string): Promise<Ficha | null> {
  if (!hayFirebase()) return null;
  const d = await fichas().doc(uid).get();
  return d.exists ? fichaDe(uid, d.data() ?? {}) : null;
}

/** Todas, para la pantalla de Sorela: lo último que se ha movido, arriba. */
export async function listarFichas(): Promise<FilaFicha[]> {
  if (!hayFirebase()) return [];
  const todas = await fichas().get();
  return todas.docs
    .map((doc) => {
      const v = doc.data();
      return {
        uid: doc.id,
        nombre: String(v.nombre || 'Sin nombre'),
        estado: estadoDe(v.estado),
        ocultaPorSorela: v.ocultaPorSorela === true,
        ciudad: String(v.ciudad ?? ''),
        slug: typeof v.slug === 'string' && v.slug ? v.slug : null,
        actualizado: iso(v.actualizado),
        paisNombre: paisNombreDe(String(v.pais ?? '')),
        foto: typeof v.foto === 'string' && v.foto ? v.foto : null,
        motivo: v.estado !== 'publicada' && v.despublicada?.motivo ? String(v.despublicada.motivo) : null,
      };
    })
    .sort((a, b) => (b.actualizado ?? '').localeCompare(a.actualizado ?? ''));
}

/* -------------------------------------------------------------- ayudas */

/** Las páginas públicas que enseñan esta ficha se rehacen en la próxima visita. */
function refrescarWeb(slug: string | null, ciudades: string[]) {
  try {
    revalidatePath('/terapeutas');
    if (slug) revalidatePath(`/terapeutas/${slug}`);
    for (const c of new Set(ciudades.filter((x) => x.trim()).map((x) => slugDe(x)))) revalidatePath(`/terapeutas/en/${c}`);
    revalidatePath('/sitemap.xml');
  } catch (e) {
    // Fuera de una petición (un guion, el cron) no hay nada que refrescar: la
    // página se rehará sola a los cinco minutos.
    console.error('[fichas] no se ha podido refrescar la web:', (e as Error).message);
  }
}

/** Qué se le pregunta al mapa: sin calle si no la enseña. Si cambia, hay que volver a situarla. */
const claveLugar = (d: DatosFicha) =>
  JSON.stringify(d.mostrarDireccion && d.direccion ? [d.pais, d.ciudad, d.cp, d.direccion] : [d.pais, d.ciudad]).toLowerCase();

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * El slug se fija la primera vez que se publica (`nombre-ciudad`, con -2, -3…
 * si ya existe) y no cambia nunca: es la dirección que ella comparte y la que
 * Google tiene guardada. Se reserva en una transacción para que dos fichas que
 * se publican a la vez con el mismo nombre no se queden con el mismo.
 */
async function reservarSlug(uid: string, nombre: string, ciudad: string): Promise<string> {
  const db = baseDeDatos();
  const base = slugDe(`${nombre} ${ciudad}`);
  for (let n = 1; n <= 40; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const libre = await db.runTransaction(async (t) => {
      const [usadas, publica] = await Promise.all([
        t.get(fichas().where('slug', '==', slug).limit(2)),
        t.get(publicas().doc(slug)),
      ]);
      if (usadas.docs.some((d) => d.id !== uid)) return false;
      if (publica.exists && publica.get('uid') !== uid) return false;
      t.set(fichas().doc(uid), { slug }, { merge: true });
      return true;
    });
    if (libre) return slug;
  }
  // Cuarenta tocayas en la misma ciudad no va a pasar; si pasa, no se queda sin ficha.
  return `${base}-${uid.slice(0, 6).toLowerCase()}`;
}

/**
 * La foto pública a partir del avatar. Se nombra por su huella: si el avatar no
 * ha cambiado, no se vuelve a subir; si ha cambiado, se sube la nueva y se
 * borra la anterior. Sin avatar, sin foto (la web pinta sus iniciales).
 *
 * Si Storage falla, la ficha se publica igual con las iniciales: es mejor que
 * dejarla sin publicar por una foto.
 */
async function fotoPublica(uid: string, avatar: unknown, antes: DocumentData): Promise<{ foto: string | null; fotoRuta: string | null }> {
  const rutaAntes = typeof antes.fotoRuta === 'string' && antes.fotoRuta ? antes.fotoRuta : null;
  const quitarAnterior = async () => {
    if (rutaAntes) await bucket().file(rutaAntes).delete().catch(() => null);
  };
  const m = typeof avatar === 'string' ? AVATAR.exec(avatar) : null;
  if (!m) {
    await quitarAnterior();
    return { foto: null, fotoRuta: null };
  }
  const huella = createHash('sha1').update(String(avatar)).digest('hex').slice(0, 20);
  const ruta = `publico/terapeutas/${uid}/${huella}.webp`;
  if (ruta === rutaAntes && typeof antes.foto === 'string' && antes.foto) return { foto: antes.foto, fotoRuta: ruta };
  try {
    const webp = await sharp(Buffer.from(m[2], 'base64'))
      .rotate()
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 86 })
      .toBuffer();
    const token = randomUUID();
    const b = bucket();
    await b.file(ruta).save(webp, {
      contentType: 'image/webp',
      metadata: { cacheControl: 'public, max-age=31536000, immutable', metadata: { firebaseStorageDownloadTokens: token } },
    });
    await quitarAnterior();
    return {
      foto: `https://firebasestorage.googleapis.com/v0/b/${b.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`,
      fotoRuta: ruta,
    };
  } catch (e) {
    console.error('[fichas] no se ha podido subir la foto pública:', (e as Error).message);
    await quitarAnterior();
    return { foto: null, fotoRuta: null };
  }
}

/** Escribe la copia pública ENTERA a partir del maestro (ya guardado). */
async function escribirPublica(uid: string, v: DocumentData) {
  const slug = String(v.slug);
  const ahora = new Date().toISOString();
  await publicas()
    .doc(slug)
    .set(
      fichaPublicaDe({
        ...datosDe(v),
        uid,
        slug,
        foto: typeof v.foto === 'string' && v.foto ? v.foto : null,
        lat: Number(v.lat),
        lng: Number(v.lng),
        precision: v.precision === 'exacta' ? 'exacta' : 'ciudad',
        actualizado: ahora,
        publicadaEl: iso(v.publicadaEl) ?? ahora,
      })
    );
}

/** Puede salir en el mapa: miembro de la Comunidad, o Sorela. */
function puedePublicar(u: DocumentData | undefined): boolean {
  if (!u) return false;
  return u.rol === 'sorela' || tieneMembresia(revisarAccesos(u.accesos));
}

/* ---------------------------------------------------------- escritura */

export type ResultadoFicha = { ok: true; ficha: Ficha } | { ok: false; errores: ErroresFicha };

/**
 * Guarda lo que llega (solo esas claves) y, con `publicar`, la publica.
 *
 * Al publicar (o al guardar una ficha que ya está en la web) se exige que esté
 * completa, se sitúa en el mapa si ha cambiado el sitio, se fija el slug, se
 * copia la foto y se escribe la copia pública. Sin publicar, solo se guarda el
 * borrador: nada sale de la plataforma.
 */
export async function guardarFicha(
  uid: string,
  datos: unknown,
  { publicar = false, consentimiento = false }: { publicar?: boolean; consentimiento?: boolean } = {}
): Promise<ResultadoFicha> {
  if (!hayFirebase()) return { ok: false, errores: { general: 'La plataforma no está configurada.' } };
  const db = baseDeDatos();
  const ref = fichas().doc(uid);
  const [usuario, previa] = await Promise.all([db.collection(COLECCIONES.usuarios).doc(uid).get(), ref.get()]);
  if (!usuario.exists) return { ok: false, errores: { general: 'No encuentro tu cuenta.' } };
  const u = usuario.data() ?? {};
  const antes = previa.data() ?? {};

  const base = previa.exists ? datosDe(antes) : { ...FICHA_VACIA, nombre: String(u.nombre ?? '').trim().slice(0, 60) };
  const d = mezclarFicha(base, datos);
  const estadoAntes = estadoDe(antes.estado);
  const yaPublicada = estadoAntes === 'publicada';
  const completa = publicar || yaPublicada;

  const errores = revisarFicha(d, completa);
  const consentimientoVigente = antes.consentimiento?.version === VERSION_CONSENTIMIENTO;
  if (publicar) {
    if (!puedePublicar(u)) errores.permiso = 'Para salir en el mapa necesitas tener activa la Comunidad Divine.';
    if (!consentimientoVigente && !consentimiento)
      errores.consentimiento = 'Para publicar tu ficha tienes que marcar la casilla que dice que aceptas que se publique.';
  }
  if (Object.keys(errores).length) return { ok: false, errores };
  Object.assign(d, contactosLimpios(d));

  /* El sitio en el mapa: solo se pregunta cuando va a salir en la web y algo
     de la ubicación ha cambiado. En un borrador que cambia de ciudad se
     olvidan las coordenadas viejas y se calculan al publicar. */
  const clave = claveLugar(d);
  let lat = num(antes.lat);
  let lng = num(antes.lng);
  let precision: Precision = antes.precision === 'exacta' ? 'exacta' : 'ciudad';
  let geo = antes.geo && antes.geo.dia === hoy() ? { dia: hoy(), n: Number(antes.geo.n) || 0 } : { dia: hoy(), n: 0 };
  const cambiaSitio = clave !== antes.geoClave || lat === null || lng === null;
  if (cambiaSitio) {
    if (completa) {
      if (geo.n >= GEO_MAX_DIA)
        return { ok: false, errores: { [d.mostrarDireccion ? 'direccion' : 'ciudad']: 'Has probado muchas direcciones hoy. Vuelve a intentarlo mañana.' } };
      geo = { dia: geo.dia, n: geo.n + 1 };
      const lugar = await geocodificar({
        pais: d.pais,
        paisNombre: paisNombreDe(d.pais),
        ciudad: d.ciudad,
        cp: d.cp,
        direccion: d.direccion,
        exacta: d.mostrarDireccion && Boolean(d.direccion),
      });
      if (!lugar) {
        await ref.set({ geo }, { merge: true }).catch(() => null);
        return { ok: false, errores: { [d.mostrarDireccion ? 'direccion' : 'ciudad']: TEXTO_SIN_LUGAR } };
      }
      ({ lat, lng, precision } = lugar);
    } else {
      lat = null;
      lng = null;
      precision = 'ciudad';
    }
  }

  const ocultaPorSorela = antes.ocultaPorSorela === true;
  const estado: EstadoFicha = publicar ? (ocultaPorSorela ? 'oculta' : 'publicada') : estadoAntes;
  const enLaWeb = estado === 'publicada';
  const slug = typeof antes.slug === 'string' && antes.slug ? antes.slug : publicar ? await reservarSlug(uid, d.nombre, d.ciudad) : null;
  const foto = enLaWeb ? await fotoPublica(uid, u.foto, antes) : { foto: antes.foto ?? null, fotoRuta: antes.fotoRuta ?? null };

  const nuevo: DocumentData = {
    uid,
    estado,
    ocultaPorSorela,
    slug,
    ...d,
    paisNombre: paisNombreDe(d.pais),
    lat,
    lng,
    precision,
    geoClave: lat === null ? null : clave,
    geo,
    foto: foto.foto,
    fotoRuta: foto.fotoRuta,
    actualizado: FieldValue.serverTimestamp(),
  };
  if (!previa.exists) nuevo.creado = FieldValue.serverTimestamp();
  if (publicar && !consentimientoVigente)
    nuevo.consentimiento = { fecha: Timestamp.now(), version: VERSION_CONSENTIMIENTO, texto: TEXTO_CONSENTIMIENTO };
  if (publicar && !antes.publicadaEl) nuevo.publicadaEl = Timestamp.now();
  if (publicar) nuevo.despublicada = FieldValue.delete();
  await ref.set(nuevo, { merge: true });

  if (enLaWeb) {
    const guardada = (await ref.get()).data() ?? {};
    await escribirPublica(uid, guardada);
    refrescarWeb(slug, [d.ciudad, base.ciudad]);
  }
  const ficha = await leerFicha(uid);
  return ficha ? { ok: true, ficha } : { ok: false, errores: { general: 'No se ha podido guardar.' } };
}

/**
 * La quita de la web y la deja como borrador.
 *
 *   · 'propia': ella la quita. Eso es retirar el permiso: se guarda cuándo lo
 *     retiró y, para volver a salir, tendrá que darlo otra vez.
 *   · 'sin-membresia': se le ha quitado la Comunidad. El permiso sigue dado; si
 *     vuelve, publica con un botón. Si resulta que sí tiene membresía (o es
 *     Sorela), no se hace nada: así se puede llamar sin miedo.
 */
export async function despublicarFicha(uid: string, motivo: 'propia' | 'sin-membresia' | string): Promise<void> {
  if (!hayFirebase()) return;
  const ref = fichas().doc(uid);
  const previa = await ref.get();
  if (!previa.exists) return;
  const v = previa.data() ?? {};
  if (motivo === 'sin-membresia') {
    const u = (await baseDeDatos().collection(COLECCIONES.usuarios).doc(uid).get()).data();
    if (puedePublicar(u)) return;
  }

  const cambios: DocumentData = {
    actualizado: FieldValue.serverTimestamp(),
    despublicada: { motivo, fecha: Timestamp.now() },
  };
  if (v.estado === 'publicada' || v.estado === 'oculta') cambios.estado = 'borrador';
  if (motivo === 'propia' && v.consentimiento) {
    cambios.consentimiento = null;
    cambios.consentimientoRetirado = { ...v.consentimiento, retirado: Timestamp.now() };
  }
  await ref.set(cambios, { merge: true });

  if (typeof v.slug === 'string' && v.slug) await publicas().doc(v.slug).delete().catch(() => null);
  // La foto pública solo existe para la web: fuera de ella, no se guarda.
  if (typeof v.fotoRuta === 'string' && v.fotoRuta) {
    await bucket().file(v.fotoRuta).delete().catch(() => null);
    await ref.set({ foto: null, fotoRuta: null }, { merge: true });
  }
  refrescarWeb(v.slug ?? null, [String(v.ciudad ?? '')]);
}

/**
 * Sorela la oculta o la vuelve a enseñar. Al enseñarla se comprueba otra vez
 * que puede salir (sigue siendo miembro, sigue el permiso, está completa): si
 * no, se queda como borrador y es ella quien la publica cuando pueda.
 */
export async function ocultarFicha(uid: string, ocultar: boolean): Promise<{ ok: boolean; estado: EstadoFicha | null }> {
  if (!hayFirebase()) return { ok: false, estado: null };
  const ref = fichas().doc(uid);
  const previa = await ref.get();
  if (!previa.exists) return { ok: false, estado: null };
  const v = previa.data() ?? {};
  const slug = typeof v.slug === 'string' && v.slug ? v.slug : null;
  const estadoAntes = estadoDe(v.estado);

  if (ocultar) {
    const estado: EstadoFicha = estadoAntes === 'publicada' ? 'oculta' : estadoAntes;
    await ref.set({ ocultaPorSorela: true, estado, actualizado: FieldValue.serverTimestamp() }, { merge: true });
    if (slug) await publicas().doc(slug).delete().catch(() => null);
    refrescarWeb(slug, [String(v.ciudad ?? '')]);
    return { ok: true, estado };
  }

  if (estadoAntes !== 'oculta') {
    await ref.set({ ocultaPorSorela: false, actualizado: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, estado: estadoAntes };
  }

  const u = (await baseDeDatos().collection(COLECCIONES.usuarios).doc(uid).get()).data();
  const sigueValiendo =
    puedePublicar(u) &&
    v.consentimiento?.version === VERSION_CONSENTIMIENTO &&
    slug !== null &&
    num(v.lat) !== null &&
    num(v.lng) !== null &&
    Object.keys(revisarFicha(datosDe(v), true)).length === 0;
  if (!sigueValiendo) {
    await ref.set({ ocultaPorSorela: false, estado: 'borrador', actualizado: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, estado: 'borrador' };
  }
  const foto = await fotoPublica(uid, u?.foto, v);
  await ref.set(
    { ocultaPorSorela: false, estado: 'publicada', ...foto, actualizado: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await escribirPublica(uid, (await ref.get()).data() ?? {});
  refrescarWeb(slug, [String(v.ciudad ?? '')]);
  return { ok: true, estado: 'publicada' };
}

/**
 * Borra la ficha entera: la copia pública, la foto pública y el maestro. Lo
 * usan el botón de Sorela, la propia terapeuta y el borrado de cuenta. Si no
 * había ficha, no pasa nada.
 */
export async function borrarFicha(uid: string): Promise<void> {
  if (!hayFirebase()) return;
  const ref = fichas().doc(uid);
  const previa = await ref.get();
  const v = previa.data() ?? {};
  const slug = typeof v.slug === 'string' && v.slug ? v.slug : null;
  if (slug) await publicas().doc(slug).delete();
  // Por si quedó alguna copia con otro nombre (no debería): todas las de este uid.
  const sueltas = await publicas().where('uid', '==', uid).get();
  await Promise.all(sueltas.docs.map((d) => d.ref.delete()));
  await bucket().deleteFiles({ prefix: `publico/terapeutas/${uid}/` }).catch(() => null);
  if (previa.exists) await ref.delete();
  if (previa.exists || sueltas.size) refrescarWeb(slug, [String(v.ciudad ?? '')]);
}

/**
 * Para cuando cambia el avatar fuera del onboarding (la foto de arriba): si la
 * ficha está en la web, se vuelve a copiar la foto (o se quita, si la ha
 * quitado). Si no está publicada, no hace nada.
 */
export async function actualizarFotoFicha(uid: string): Promise<void> {
  if (!hayFirebase()) return;
  const ref = fichas().doc(uid);
  const v = (await ref.get()).data();
  if (!v || v.estado !== 'publicada' || !v.slug) return;
  const u = (await baseDeDatos().collection(COLECCIONES.usuarios).doc(uid).get()).data();
  const foto = await fotoPublica(uid, u?.foto, v);
  await ref.set({ ...foto, actualizado: FieldValue.serverTimestamp() }, { merge: true });
  await escribirPublica(uid, { ...v, ...foto });
  refrescarWeb(v.slug, [String(v.ciudad ?? '')]);
}
