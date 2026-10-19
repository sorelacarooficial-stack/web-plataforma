/**
 * Las métricas de la web, del lado del servidor.
 *
 * Son propias y sin cookies: no hay Google Analytics ni nada de terceros, así
 * que no hace falta pedir permiso con un banner. Lo que se guarda son
 * CONTADORES por día —cuántas visitas, de qué país, desde dónde llegan— y no
 * a cada persona. La IP no se guarda nunca: solo se usa, mezclada con el
 * navegador y el MES, para contar personas distintas sin contar dos veces a
 * quien vuelve dentro del mes. Ese resumen cambia cada mes y se borra al
 * cerrarlo, así que no sirve para seguir a nadie de un mes a otro.
 *
 * Lo que se mide desde un ordenador de pruebas va a otras colecciones, para
 * no ensuciar los números de verdad.
 */

const PRODUCCION = process.env.VERCEL_ENV === 'production';

export const COLECCION_DIAS = PRODUCCION ? 'metricas_dias' : 'metricas_dias_prueba';
export const COLECCION_VIDEOS = PRODUCCION ? 'metricas_videos' : 'metricas_videos_prueba';
/** Los resúmenes del mes para no contar dos veces a la misma persona. */
export const COLECCION_MESES = PRODUCCION ? 'metricas_meses' : 'metricas_meses_prueba';

/** El día en España, `2026-10-12`: lo que importa es el día de Sorela, no el de Londres. */
export function diaDe(fecha = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

export function horaDe(fecha = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(fecha);
}

/** De dónde llega alguien, en palabras. */
export function origenDe(referente: string, utm: string, propio: string): string {
  const u = utm.trim().toLowerCase();
  if (u) {
    // Los enlaces de los anuncios llevan utm_source=meta (lib/meta-campana.ts).
    if (u === 'meta' || u === 'meta_ads') return 'Anuncios de Meta';
    if (u.includes('insta') || u === 'ig') return 'Instagram';
    if (u.includes('whats') || u === 'wa') return 'WhatsApp';
    if (u.includes('face') || u === 'fb') return 'Facebook';
    if (u.includes('tiktok')) return 'TikTok';
    if (u.includes('mail') || u.includes('correo')) return 'Correo';
    return u.slice(0, 30);
  }
  let host = '';
  try {
    host = new URL(referente).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'Directo';
  }
  if (!host || host === propio || host.endsWith(`.${propio}`)) return '';
  const tabla: [RegExp, string][] = [
    [/(^|\.)google\./, 'Google'],
    [/instagram\.com$/, 'Instagram'],
    [/(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
    [/(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
    [/tiktok\.com$/, 'TikTok'],
    [/(youtube\.com|youtu\.be)$/, 'YouTube'],
    [/(t\.co|x\.com|twitter\.com)$/, 'X'],
    [/linkedin\.com$/, 'LinkedIn'],
    [/bing\.com$/, 'Bing'],
    [/(duckduckgo\.com)$/, 'DuckDuckGo'],
    [/(mail\.google\.com|outlook|yahoo)/, 'Correo'],
  ];
  for (const [re, nombre] of tabla) if (re.test(host)) return nombre;
  return host.slice(0, 40);
}

export function dispositivoDe(ua: string): 'Móvil' | 'Tablet' | 'Ordenador' {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'Tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'Móvil';
  return 'Ordenador';
}

/** Robots, vistas previas de enlaces y navegadores automáticos: no cuentan. */
export const esRobot = (ua: string) =>
  !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pingdom|monitor|curl|wget|python|node-fetch|axios/i.test(ua);

/** Una clave que Firestore acepte sin sorpresas y que se lea bien. */
export const claveLimpia = (t: string, max = 80) =>
  t.replace(/[\u0000-\u001f]/g, '').replace(/[.#$[\]/]/g, '·').trim().slice(0, max) || '—';

/** De `/formaciones?x=1` a `/formaciones`, y la portada como «/». */
export function rutaLimpia(ruta: string): string {
  const r = ruta.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return r.slice(0, 120);
}
