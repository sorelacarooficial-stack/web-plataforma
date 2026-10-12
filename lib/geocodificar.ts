import 'server-only';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from './firebase-servidor';

/**
 * De una dirección escrita a un punto en el mapa.
 *
 * Se hace en el servidor y al publicar, nunca desde el navegador: así el
 * servicio de mapas no ve quién pregunta, y una terapeuta no puede colocarse
 * a mano en otra ciudad mandando unas coordenadas inventadas.
 *
 * Se usa Nominatim (OpenStreetMap). Es gratis y no pide cuenta, pero tiene sus
 * normas: identificarse con un User-Agent propio, no pasar de una consulta por
 * segundo y guardar lo que ya se ha preguntado. Por eso cada respuesta se
 * guarda en `geocache/{sha1}`: la misma ciudad se pregunta una vez en la vida.
 * `GEOCODER_URL` permite cambiar de servicio sin tocar el código, siempre que
 * hable el mismo idioma (format=jsonv2).
 *
 * PRIVACIDAD: si ella no quiere enseñar su dirección, NO se manda la dirección.
 * Se pregunta solo por la ciudad y el país, y lo que se guarda es el centro de
 * la ciudad. La calle de su casa no sale de la plataforma ni en coordenadas.
 */

const URL_POR_DEFECTO = 'https://nominatim.openstreetmap.org/search';
const AGENTE = 'SorelaCaroDivine/1.0 (hola@sorelacarodivine.com)';
const ESPERA_MS = 6000;
const COLECCION_CACHE = 'geocache';

export type Lugar = { lat: number; lng: number; precision: 'exacta' | 'ciudad' };

export type Consulta = {
  /** Código de país ('ES'). */
  pais: string;
  /** Nombre del país, para que la búsqueda libre lo tenga escrito. */
  paisNombre: string;
  ciudad: string;
  cp?: string;
  direccion?: string;
  /** Solo si quiere enseñar la dirección. Si no, se ignoran calle y código postal. */
  exacta: boolean;
};

/** El texto que se busca. Sin dirección si no es exacta, aunque la haya escrito. */
function textoDe(c: Consulta): string {
  const ciudad = [c.exacta ? c.cp : '', c.ciudad].filter(Boolean).join(' ');
  return [c.exacta ? c.direccion : '', ciudad, c.paisNombre].filter((x) => x && x.trim()).join(', ');
}

const redondear = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Las coordenadas, o null si no se ha encontrado (o el servicio no contesta).
 * Nunca lanza: quien llama decide qué texto enseñar.
 */
export async function geocodificar(c: Consulta): Promise<Lugar | null> {
  const q = textoDe(c);
  if (!q || !c.ciudad.trim()) return null;
  const precision: Lugar['precision'] = c.exacta ? 'exacta' : 'ciudad';
  const clave = createHash('sha1')
    .update(JSON.stringify({ q: q.toLowerCase(), pais: c.pais.toLowerCase(), precision }))
    .digest('hex');

  const cache = hayFirebase() ? baseDeDatos().collection(COLECCION_CACHE).doc(clave) : null;
  if (cache) {
    try {
      const d = await cache.get();
      const lat = d.get('lat');
      const lng = d.get('lng');
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng, precision };
    } catch {
      /* sin caché: se pregunta */
    }
  }

  const url = new URL(process.env.GEOCODER_URL || URL_POR_DEFECTO);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('accept-language', 'es');
  if (/^[A-Z]{2}$/.test(c.pais)) url.searchParams.set('countrycodes', c.pais.toLowerCase());
  url.searchParams.set('q', q);

  let lugar: Lugar | null = null;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': AGENTE, Accept: 'application/json' },
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const lista = (await r.json()) as unknown;
    const primero = Array.isArray(lista) ? (lista[0] as { lat?: unknown; lon?: unknown } | undefined) : undefined;
    const lat = Number(primero?.lat);
    const lng = Number(primero?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    // Cinco decimales son un metro: más no aporta y es más de lo que hace falta saber.
    lugar = { lat: redondear(lat, 5), lng: redondear(lng, 5), precision };
  } catch (e) {
    console.error('[geocodificar] el servicio de mapas no ha contestado:', (e as Error).message);
    return null;
  }

  if (cache && lugar) {
    // Se guarda sin el texto de la dirección: la clave ya la identifica y así la
    // caché no es una lista de domicilios.
    await cache.set({ lat: lugar.lat, lng: lugar.lng, precision, creado: FieldValue.serverTimestamp() }).catch(() => null);
  }
  return lugar;
}
