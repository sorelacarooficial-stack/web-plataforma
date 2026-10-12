import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { FieldValue, Timestamp, type DocumentData, type DocumentReference } from 'firebase-admin/firestore';
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
 * quitar, ocultar o borrar la ficha.
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
    /* Y las fichas de las DEMÁS: cada una enseña a sus compañeras de ciudad en
       «Otras terapeutas en…» (nombre, frase, foto). Sin esto, una ficha
       retirada seguiría saliendo ahí, con la foto ya borrada y un enlace a un
       404, hasta que cada página caducara. Marca todas, y cada una se rehace
       solo cuando alguien la visita. Con el grupo `(web)` delante: así se llama
       el archivo de la página, y revalidatePath no quita los grupos. */
    revalidatePath('/(web)/terapeutas/[slug]', 'page');
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

/**
 * La copia pública ENTERA a partir del maestro. Se escribe siempre en la misma
 * transacción que el maestro: así nunca queda una ficha «oculta» o «borrador»
 * con su copia en la web, ni al revés.
 *
 * Sin coordenadas (ver «soloQuita» en guardarFicha) van NaN, no 0: el mapa se
 * salta los puntos sin coordenadas, y un 0 la pondría en mitad del Atlántico.
 */
function publicaDe(uid: string, v: DocumentData) {
  const ahora = new Date().toISOString();
  return fichaPublicaDe({
    ...datosDe(v),
    uid,
    slug: String(v.slug),
    foto: typeof v.foto === 'string' && v.foto ? v.foto : null,
    lat: num(v.lat) ?? NaN,
    lng: num(v.lng) ?? NaN,
    precision: v.precision === 'exacta' ? 'exacta' : 'ciudad',
    actualizado: ahora,
    publicadaEl: iso(v.publicadaEl) ?? ahora,
  });
}

/* La constancia del permiso: fuera de la ficha, para poder acreditarlo aunque
   la ficha se borre (lo promete la política de privacidad). */
const COLECCION_CONSENTIMIENTOS = 'consentimientos_ficha';

/**
 * Copia el permiso (dado o retirado) a su colección aparte. El id sale de la
 * fecha en que lo dio: guardar dos veces el mismo permiso no lo duplica, y
 * cada vez que lo vuelve a dar queda su propia constancia. Va en el lote o la
 * transacción de quien llama.
 */
function apuntarConstancia(
  poner: (ref: DocumentReference, datos: DocumentData) => void,
  uid: string,
  v: DocumentData,
  c: unknown,
  retirado: Timestamp | null
) {
  if (!c || typeof c !== 'object') return;
  const x = c as Record<string, unknown>;
  const fecha = x.fecha instanceof Timestamp ? x.fecha : null;
  if (!fecha || !x.version) return;
  const r = x.retirado instanceof Timestamp ? x.retirado : retirado;
  poner(baseDeDatos().collection(COLECCION_CONSENTIMIENTOS).doc(`${uid}_${fecha.toMillis()}`), {
    uid,
    nombre: String(v.nombre ?? ''),
    version: String(x.version),
    texto: String(x.texto ?? ''),
    fecha,
    retirado: r,
    guardado: FieldValue.serverTimestamp(),
  });
}

/** Puede salir en el mapa: miembro de la Comunidad, o Sorela. */
function puedePublicar(u: DocumentData | undefined): boolean {
  if (!u) return false;
  return u.rol === 'sorela' || tieneMembresia(revisarAccesos(u.accesos));
}

/* ---------------------------------------------------------- escritura */

export type ResultadoFicha = { ok: true; ficha: Ficha } | { ok: false; errores: ErroresFicha };

const OTRA_VEZ: ResultadoFicha = { ok: false, errores: { general: 'No se ha podido guardar. Inténtalo otra vez.' } };

/**
 * Guarda lo que llega (solo esas claves) y, con `publicar`, la publica.
 *
 * Al publicar (o al guardar una ficha que ya está en la web) se exige que esté
 * completa, se sitúa en el mapa si ha cambiado el sitio, se fija el slug, se
 * copia la foto y se escribe la copia pública. Sin publicar, solo se guarda el
 * borrador: nada sale de la plataforma.
 *
 * Lo lento (situarla en el mapa, hasta 6 s; subir la foto) va antes de
 * escribir, y la escritura final va en una transacción que vuelve a leer la
 * ficha: si mientras tanto Sorela la ha ocultado, o se ha quitado de la web por
 * otro lado (ella desde otra pestaña, o al perder la Comunidad), NO se pisa:
 * se vuelve a empezar con lo que hay ahora (`vuelta`).
 */
export async function guardarFicha(
  uid: string,
  datos: unknown,
  opciones: { publicar?: boolean; consentimiento?: boolean } = {},
  vuelta = 0
): Promise<ResultadoFicha> {
  const { publicar = false, consentimiento = false } = opciones;
  if (!hayFirebase()) return { ok: false, errores: { general: 'La plataforma no está configurada.' } };
  if (vuelta > 3) return OTRA_VEZ;
  const db = baseDeDatos();
  const ref = fichas().doc(uid);
  const usuarioRef = db.collection(COLECCIONES.usuarios).doc(uid);
  const [usuario, previa] = await Promise.all([usuarioRef.get(), ref.get()]);
  if (!usuario.exists) return { ok: false, errores: { general: 'No encuentro tu cuenta.' } };
  const u = usuario.data() ?? {};
  const antes = previa.data() ?? {};
  const estadoAntes = estadoDe(antes.estado);
  const yaPublicada = estadoAntes === 'publicada';

  /* Sigue en la web alguien que ya no puede salir (se le quitó la Comunidad y
     falló quitarla en ese momento, o se cruzó con un guardado): se quita
     ahora, y lo que ha escrito se guarda en la vuelta siguiente como borrador
     (o, si quería publicar, recibe el aviso de que no puede). */
  if (yaPublicada && !puedePublicar(u)) {
    await despublicarFicha(uid, 'sin-membresia');
    return guardarFicha(uid, datos, opciones, vuelta + 1);
  }

  /* La marca que deja Sorela cuando una ficha oculta se borra (ver borrarFicha)
     no tiene datos: se empieza como si no hubiera ficha. */
  const conDatos = previa.exists && typeof antes.nombre === 'string';
  const base = conDatos ? datosDe(antes) : { ...FICHA_VACIA, nombre: String(u.nombre ?? '').trim().slice(0, 60) };
  const d = mezclarFicha(base, datos);
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
  const exacta = d.mostrarDireccion && Boolean(d.direccion);
  let lat = num(antes.lat);
  let lng = num(antes.lng);
  let precision: Precision = antes.precision === 'exacta' ? 'exacta' : 'ciudad';
  let geo = antes.geo && antes.geo.dia === hoy() ? { dia: hoy(), n: Number(antes.geo.n) || 0 } : { dia: hoy(), n: 0 };
  /* Dejar de enseñar la calle de una ficha que ya está en la web no puede
     depender del servicio de mapas: si no contesta (o ya ha preguntado mucho
     hoy), la calle, el código postal y el punto exacto se quitan igual y la
     ficha se queda sin punto en el mapa hasta que se pueda situar la ciudad.
     Mientras siga sin punto, lo mismo: guardar no se bloquea por eso. */
  const soloQuita = yaPublicada && !exacta && (antes.precision === 'exacta' || lat === null || lng === null);
  const cambiaSitio = clave !== antes.geoClave || lat === null || lng === null;
  if (cambiaSitio) {
    if (completa) {
      const agotado = geo.n >= GEO_MAX_DIA;
      if (agotado && !soloQuita)
        return { ok: false, errores: { [d.mostrarDireccion ? 'direccion' : 'ciudad']: 'Has probado muchas direcciones hoy. Vuelve a intentarlo mañana.' } };
      if (!agotado) geo = { dia: geo.dia, n: geo.n + 1 };
      const lugar = await geocodificar({
        pais: d.pais,
        paisNombre: paisNombreDe(d.pais),
        ciudad: d.ciudad,
        cp: d.cp,
        direccion: d.direccion,
        exacta,
        soloCache: agotado,
      });
      if (lugar) ({ lat, lng, precision } = lugar);
      else if (soloQuita) {
        lat = null;
        lng = null;
        precision = 'ciudad';
      } else {
        await ref.set({ geo }, { merge: true }).catch(() => null);
        return { ok: false, errores: { [d.mostrarDireccion ? 'direccion' : 'ciudad']: TEXTO_SIN_LUGAR } };
      }
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
  // La foto pública solo se toca si va a la web: en un borrador no se reescribe lo que haya.
  const foto = enLaWeb ? await fotoPublica(uid, u.foto, antes) : null;

  /* `ocultaPorSorela` no va aquí: esa marca solo la escribe ocultarFicha (una
     ficha nueva arranca en false, dentro de la transacción). */
  const nuevo: DocumentData = {
    uid,
    estado,
    slug,
    ...d,
    paisNombre: paisNombreDe(d.pais),
    lat,
    lng,
    precision,
    geoClave: lat === null ? null : clave,
    geo,
    ...(foto ?? {}),
    actualizado: FieldValue.serverTimestamp(),
  };
  if (!conDatos) nuevo.creado = FieldValue.serverTimestamp();
  if (publicar && !consentimientoVigente)
    nuevo.consentimiento = { fecha: Timestamp.now(), version: VERSION_CONSENTIMIENTO, texto: TEXTO_CONSENTIMIENTO };
  if (publicar && !antes.publicadaEl) nuevo.publicadaEl = Timestamp.now();
  if (publicar) nuevo.despublicada = FieldValue.delete();

  const escrita = await db.runTransaction(async (t) => {
    const [ahora, uAhora] = await t.getAll(ref, usuarioRef);
    const a = ahora.data() ?? {};
    // Ha cambiado por otro lado mientras se preparaba: se vuelve a empezar.
    if (estadoDe(a.estado) !== estadoAntes || (a.ocultaPorSorela === true) !== ocultaPorSorela) return false;
    if (enLaWeb && !puedePublicar(uAhora.data())) return false;
    t.set(ref, a.ocultaPorSorela === undefined ? { ...nuevo, ocultaPorSorela: false } : nuevo, { merge: true });
    if (enLaWeb) t.set(publicas().doc(String(slug)), publicaDe(uid, { ...a, ...nuevo }));
    return true;
  });
  if (!escrita) {
    // La foto que se acaba de subir no la va a usar nadie: la vuelta siguiente decide otra vez.
    if (foto?.fotoRuta && foto.fotoRuta !== antes.fotoRuta) await bucket().file(foto.fotoRuta).delete().catch(() => null);
    return guardarFicha(uid, datos, opciones, vuelta + 1);
  }

  if (enLaWeb) refrescarWeb(slug, [d.ciudad, base.ciudad]);
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
 *
 * El maestro y la copia pública cambian JUNTOS, en una transacción: o se quita
 * de la web y queda como borrador, o no cambia nada y el error llega a quien
 * llamó, que puede reintentar. Antes se escribía el maestro y después se
 * borraba la copia tragándose el error: si fallaba, la ficha decía «borrador»
 * y seguía en la web con sus datos, sin que nadie lo viera.
 */
export async function despublicarFicha(uid: string, motivo: 'propia' | 'sin-membresia' | string): Promise<void> {
  if (!hayFirebase()) return;
  const db = baseDeDatos();
  const ref = fichas().doc(uid);
  if (motivo === 'sin-membresia') {
    const u = (await db.collection(COLECCIONES.usuarios).doc(uid).get()).data();
    if (puedePublicar(u)) return;
  }

  const v = await db.runTransaction(async (t) => {
    const previa = await t.get(ref);
    if (!previa.exists) return null;
    const v = previa.data() ?? {};
    const cambios: DocumentData = {
      actualizado: FieldValue.serverTimestamp(),
      despublicada: { motivo, fecha: Timestamp.now() },
      // La foto pública solo existe para la web: fuera de ella, no se guarda.
      foto: null,
      fotoRuta: null,
    };
    if (v.estado === 'publicada' || v.estado === 'oculta') cambios.estado = 'borrador';
    if (motivo === 'propia' && v.consentimiento) {
      const retirado = Timestamp.now();
      cambios.consentimiento = null;
      cambios.consentimientoRetirado = { ...v.consentimiento, retirado };
      apuntarConstancia((r, datos) => t.set(r, datos, { merge: true }), uid, v, v.consentimiento, retirado);
    }
    t.set(ref, cambios, { merge: true });
    if (typeof v.slug === 'string' && v.slug) t.delete(publicas().doc(v.slug));
    return v;
  });
  if (!v) return;

  if (typeof v.fotoRuta === 'string' && v.fotoRuta) await bucket().file(v.fotoRuta).delete().catch(() => null);
  refrescarWeb(v.slug ?? null, [String(v.ciudad ?? '')]);
}

/**
 * Sorela la oculta o la vuelve a enseñar. Al enseñarla se comprueba otra vez
 * que puede salir (sigue siendo miembro, sigue el permiso, está completa): si
 * no, se queda como borrador y es ella quien la publica cuando pueda.
 *
 * Como en despublicarFicha, maestro y copia pública van en una transacción. Al
 * ocultarla se borra también la foto pública: su dirección ya estuvo en la web
 * (og:image, sitemap) y seguiría sirviéndose. Al volver a enseñarla se sube
 * otra vez desde el avatar.
 */
export async function ocultarFicha(uid: string, ocultar: boolean): Promise<{ ok: boolean; estado: EstadoFicha | null }> {
  if (!hayFirebase()) return { ok: false, estado: null };
  const db = baseDeDatos();
  const ref = fichas().doc(uid);

  if (ocultar) {
    const r = await db.runTransaction(async (t) => {
      const previa = await t.get(ref);
      if (!previa.exists) return null;
      const v = previa.data() ?? {};
      const slug = typeof v.slug === 'string' && v.slug ? v.slug : null;
      const estadoAntes = estadoDe(v.estado);
      const estado: EstadoFicha = estadoAntes === 'publicada' ? 'oculta' : estadoAntes;
      t.set(ref, { ocultaPorSorela: true, estado, foto: null, fotoRuta: null, actualizado: FieldValue.serverTimestamp() }, { merge: true });
      if (slug) t.delete(publicas().doc(slug));
      return { v, slug, estado };
    });
    if (!r) return { ok: false, estado: null };
    if (typeof r.v.fotoRuta === 'string' && r.v.fotoRuta) await bucket().file(r.v.fotoRuta).delete().catch(() => null);
    refrescarWeb(r.slug, [String(r.v.ciudad ?? '')]);
    return { ok: true, estado: r.estado };
  }

  const previa = await ref.get();
  if (!previa.exists) return { ok: false, estado: null };
  const v = previa.data() ?? {};
  const slug = typeof v.slug === 'string' && v.slug ? v.slug : null;
  const estadoAntes = estadoDe(v.estado);

  if (estadoAntes !== 'oculta') {
    await ref.set({ ocultaPorSorela: false, actualizado: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, estado: estadoAntes };
  }

  const u = (await db.collection(COLECCIONES.usuarios).doc(uid).get()).data();
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
  const mostrada = await db.runTransaction(async (t) => {
    const a = (await t.get(ref)).data();
    // Si mientras tanto ha cambiado (la ha borrado, la ha quitado ella…), no se publica.
    if (!a || estadoDe(a.estado) !== 'oculta' || a.ocultaPorSorela !== true) return false;
    const cambios = { ocultaPorSorela: false, estado: 'publicada', ...foto, actualizado: FieldValue.serverTimestamp() };
    t.set(ref, cambios, { merge: true });
    t.set(publicas().doc(String(slug)), publicaDe(uid, { ...a, ...cambios }));
    return true;
  });
  if (!mostrada) {
    if (foto.fotoRuta && foto.fotoRuta !== v.fotoRuta) await bucket().file(foto.fotoRuta).delete().catch(() => null);
    return { ok: false, estado: null };
  }
  refrescarWeb(slug, [String(v.ciudad ?? '')]);
  return { ok: true, estado: 'publicada' };
}

/**
 * Borra la ficha entera: la copia pública, la foto pública y el maestro. Lo
 * usan el botón de Sorela, la propia terapeuta y el borrado de cuenta. Si no
 * había ficha, no pasa nada.
 *
 * Antes de borrar, la constancia del permiso (cuándo lo dio, qué texto aceptó
 * y cuándo lo retiró) se copia a su colección aparte: la política promete
 * guardarla para poder acreditarlo, y es justo lo que se perdería.
 *
 * `propia`: la borra ella. Si Sorela la había ocultado, de lo que escribió no
 * queda nada, pero la marca de Sorela SÍ se queda (un maestro vacío con
 * `ocultaPorSorela`): si no, borrar y volver a publicar sería la manera de
 * saltarse el «Ocultar». El borrado de cuenta y el de Sorela lo quitan todo.
 */
export async function borrarFicha(uid: string, { propia = false }: { propia?: boolean } = {}): Promise<void> {
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
  if (previa.exists) {
    const lote = baseDeDatos().batch();
    const poner = (r: DocumentReference, datos: DocumentData) => lote.set(r, datos, { merge: true });
    apuntarConstancia(poner, uid, v, v.consentimiento, Timestamp.now());
    apuntarConstancia(poner, uid, v, v.consentimientoRetirado, null);
    if (propia && v.ocultaPorSorela === true)
      lote.set(ref, { uid, estado: 'borrador', ocultaPorSorela: true, slug: null, actualizado: FieldValue.serverTimestamp() });
    else lote.delete(ref);
    await lote.commit();
  }
  if (previa.exists || sueltas.size) refrescarWeb(slug, [String(v.ciudad ?? '')]);
}

/**
 * Para cuando cambia el avatar fuera del onboarding (la foto de arriba): si la
 * ficha está en la web, se vuelve a copiar la foto (o se quita, si la ha
 * quitado). Si no está en la web y le quedó una copia pública de la foto, se
 * borra: fuera de la web no se guarda.
 */
export async function actualizarFotoFicha(uid: string): Promise<void> {
  if (!hayFirebase()) return;
  const db = baseDeDatos();
  const ref = fichas().doc(uid);
  const v = (await ref.get()).data();
  if (!v) return;
  if (v.estado !== 'publicada' || !v.slug) {
    if (typeof v.fotoRuta === 'string' && v.fotoRuta) {
      await bucket().file(v.fotoRuta).delete().catch(() => null);
      await ref.set({ foto: null, fotoRuta: null }, { merge: true });
    }
    return;
  }
  const u = (await db.collection(COLECCIONES.usuarios).doc(uid).get()).data();
  const foto = await fotoPublica(uid, u?.foto, v);
  const escrita = await db.runTransaction(async (t) => {
    const a = (await t.get(ref)).data();
    // Si mientras tanto la han quitado de la web, no se vuelve a publicar.
    if (!a || a.estado !== 'publicada' || a.slug !== v.slug) return false;
    const cambios = { ...foto, actualizado: FieldValue.serverTimestamp() };
    t.set(ref, cambios, { merge: true });
    t.set(publicas().doc(String(v.slug)), publicaDe(uid, { ...a, ...cambios }));
    return true;
  });
  if (!escrita) {
    if (foto.fotoRuta && foto.fotoRuta !== v.fotoRuta) await bucket().file(foto.fotoRuta).delete().catch(() => null);
    return;
  }
  refrescarWeb(v.slug, [String(v.ciudad ?? '')]);
}
