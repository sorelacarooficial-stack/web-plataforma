import 'server-only';
import { cache } from 'react';
import { baseDeDatos, hayFirebase } from './firebase-servidor';
import { COLECCION_PUBLICAS, inicialesDe, slugDe, type FichaPublica } from './fichas-tipos';
import { ciudadesDe, type CiudadConFichas } from './terapeutas';

/**
 * Las fichas de «Localiza tu terapeuta», del lado del servidor: lo que leen
 * las páginas públicas (/terapeutas, la ficha de cada una, las páginas de
 * ciudad) y el mapa del sitio.
 *
 * Lee SOLO `terapeutas_publicas`, la copia pública que escribe lib/fichas.ts
 * al publicar y borra al despublicar, ocultar o borrar. El maestro privado
 * (`fichas/{uid}`), con el consentimiento y lo que ella decide no enseñar,
 * no se toca desde aquí: así una página pública no puede filtrar por error un
 * dato privado, porque ni siquiera lo tiene.
 *
 * Nunca lanza. Sin credenciales (al compilar en local, en una vista previa)
 * o si Firestore no contesta, devuelve una lista vacía: la página sale con el
 * mapa vacío en vez de romper la compilación o dar un 500.
 *
 * Las funciones van envueltas en `cache` de React: la página y sus metadatos
 * piden lo mismo en la misma petición, y así Firestore se lee una sola vez.
 * Lo que dura la página entre lecturas lo dice el `revalidate` de cada ruta
 * (ISR), y lib/fichas.ts la rehace al momento con `revalidatePath`.
 */

/** Un slug válido: el mismo formato que fabrica `slugDe`. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const texto = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Las fechas llegan en ISO (así las escribe lib/fichas.ts); por si acaso, también un Timestamp. */
function iso(v: unknown): string {
  if (typeof v === 'string') return v;
  const d = (v as { toDate?: () => Date } | null)?.toDate?.();
  return d ? d.toISOString() : '';
}

/**
 * Del documento a la ficha, sin fiarse de la forma. Lo escribe nuestro propio
 * servidor, pero una página pública no puede caerse porque un campo venga mal:
 * lo que falta se rellena vacío, y una ficha sin nombre o sin ciudad no se
 * enseña.
 */
function aFicha(id: string, v: FirebaseFirestore.DocumentData): FichaPublica | null {
  const nombre = texto(v.nombre, 80);
  const ciudad = texto(v.ciudad, 80);
  if (!SLUG.test(id) || !nombre || !ciudad) return null;
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  const pais = texto(v.pais, 4).toUpperCase();
  return {
    slug: id,
    uid: texto(v.uid, 128),
    nombre,
    iniciales: texto(v.iniciales, 4) || inicialesDe(nombre),
    centro: texto(v.centro, 100),
    frase: texto(v.frase, 120),
    sobre: texto(v.sobre, 600),
    especialidad: texto(v.especialidad, 80),
    tratamientos: Array.isArray(v.tratamientos) ? v.tratamientos.map((t: unknown) => texto(t, 60)).filter(Boolean) : [],
    pais,
    paisNombre: texto(v.paisNombre, 60),
    ciudad,
    ciudadSlug: SLUG.test(texto(v.ciudadSlug, 90)) ? texto(v.ciudadSlug, 90) : slugDe(ciudad),
    cp: texto(v.cp, 12),
    direccion: texto(v.direccion, 140),
    lat: Number.isFinite(lat) ? lat : NaN,
    lng: Number.isFinite(lng) ? lng : NaN,
    precision: v.precision === 'exacta' ? 'exacta' : 'ciudad',
    whatsapp: /^\+[1-9]\d{7,14}$/.test(texto(v.whatsapp, 20)) ? texto(v.whatsapp, 20) : '',
    instagram: /^[A-Za-z0-9._]{1,30}$/.test(texto(v.instagram, 40)) ? texto(v.instagram, 40) : '',
    web: /^https:\/\//i.test(texto(v.web, 220)) ? texto(v.web, 220) : '',
    foto: /^https:\/\//i.test(texto(v.foto, 1000)) ? texto(v.foto, 1000) : null,
    actualizado: iso(v.actualizado),
    publicadaEl: iso(v.publicadaEl),
  };
}

/** Por ciudad y, dentro de cada ciudad, por nombre: un directorio se lee así. */
const orden = (a: FichaPublica, b: FichaPublica) =>
  a.ciudad.localeCompare(b.ciudad, 'es') || a.nombre.localeCompare(b.nombre, 'es');

/** Todas las fichas publicadas. Si la base no contesta, ninguna. */
export const listarFichasPublicas = cache(async (): Promise<FichaPublica[]> => {
  if (!hayFirebase()) return [];
  try {
    const l = await baseDeDatos().collection(COLECCION_PUBLICAS).limit(2000).get();
    return l.docs
      .map((d) => aFicha(d.id, d.data()))
      .filter((f): f is FichaPublica => f !== null)
      .sort(orden);
  } catch (e) {
    console.error('[fichas-publicas] no se han podido leer las fichas', e);
    return [];
  }
});

/** Una ficha por su slug, o null si no existe (o no está publicada). */
export const fichaPublica = cache(async (slug: string): Promise<FichaPublica | null> => {
  if (!hayFirebase() || !SLUG.test(slug) || slug.length > 90) return null;
  try {
    const d = await baseDeDatos().collection(COLECCION_PUBLICAS).doc(slug).get();
    return d.exists ? aFicha(d.id, d.data() ?? {}) : null;
  } catch (e) {
    console.error('[fichas-publicas] no se ha podido leer la ficha', slug, e);
    return null;
  }
});

/** Las ciudades con al menos una ficha, en orden alfabético, con cuántas hay. */
export const ciudadesConFichas = cache(async (): Promise<CiudadConFichas[]> => ciudadesDe(await listarFichasPublicas()));

/**
 * Las fichas de una ciudad. Sale de la lista completa (que ya está en caché
 * en esa petición) y no de una consulta aparte: la página de ciudad pide
 * también las demás ciudades, y así es una sola lectura.
 */
export const fichasDeCiudad = cache(async (ciudadSlug: string): Promise<FichaPublica[]> => {
  if (!SLUG.test(ciudadSlug)) return [];
  return (await listarFichasPublicas()).filter((f) => f.ciudadSlug === ciudadSlug);
});
