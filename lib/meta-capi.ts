import 'server-only';
import { createHash } from 'node:crypto';

/**
 * API de conversiones de Meta: avisa a Meta, desde el servidor, de que alguien
 * se ha apuntado a la lista de espera de la masterclass.
 *
 * Por qué así y no con el píxel: la web no usa cookies de terceros ni banner
 * (ver lib/metricas.ts), y no lo va a necesitar. Aquí no se instala nada en el
 * navegador de nadie. Solo cuando la persona MANDA el formulario, el servidor
 * le dice a Meta «ha habido un registro» con el correo y el teléfono cifrados
 * (SHA‑256, Meta nunca los ve en claro) y, si venía de un anuncio, el fbclid
 * del enlace. Con eso los anuncios aprenden a quién enseñarse.
 *
 * Variables en Vercel:
 *   META_DATASET_ID   → el conjunto de datos «Comunidad Divine» (968080569683493)
 *   META_CAPI_TOKEN   → el token generado en Administrador de eventos
 *   META_TEST_CODE    → opcional: el código de «Probar eventos», solo para probar
 *
 * Si faltan, no hace nada. Nunca rompe el registro: falla en silencio (con
 * aviso en los registros de Vercel) y con un tope de tiempo.
 */

const VERSION = 'v21.0';
const TOPE_MS = 3000;

const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const limpio = (t: unknown) => String(t ?? '').trim().toLowerCase();

export const hayMeta = () => Boolean(process.env.META_DATASET_ID && process.env.META_CAPI_TOKEN);

export type Registro = {
  correo: string;
  nombre?: string | null;
  whatsapp?: string | null;
  /** El fbclid del enlace del anuncio, si lo había. */
  fbclid?: string | null;
  /** Cuándo llegó a la web (ms). Si falta, ahora. */
  llegadaMs?: number | null;
  ip?: string | null;
  navegador?: string | null;
  /** La página donde se apuntó. */
  url?: string | null;
  /** Qué formulario: comunidad, inicio… */
  origen?: string | null;
};

/** Solo dígitos, con prefijo: Meta lo pide así antes de cifrar. 9 cifras españolas → 34 delante. */
function telefono(t: unknown): string {
  const d = String(t ?? '').replace(/\D/g, '').replace(/^00/, '');
  if (!d) return '';
  return /^[67]\d{8}$/.test(d) ? `34${d}` : d;
}

/** El fbc que entiende Meta: fb.1.<cuándo>.<fbclid>. */
const fbc = (fbclid: string, ms: number) => `fb.1.${ms}.${fbclid}`;

/**
 * Manda el evento Lead. Devuelve true si Meta lo aceptó. El `event_id` va
 * fijo por persona (su correo cifrado): si alguien se apunta dos veces, Meta
 * no cuenta dos registros.
 */
export async function avisarRegistro(r: Registro): Promise<boolean> {
  if (!hayMeta()) return false;
  const correo = limpio(r.correo);
  if (!correo.includes('@')) return false;

  const nombre = limpio(r.nombre).split(/\s+/)[0] ?? '';
  const tel = telefono(r.whatsapp);
  const ahora = Math.floor(Date.now() / 1000);
  const llegada = r.llegadaMs && r.llegadaMs > 0 && r.llegadaMs <= Date.now() ? r.llegadaMs : Date.now();

  const user_data: Record<string, unknown> = {
    em: [sha(correo)],
    external_id: [sha(correo)],
    ...(tel ? { ph: [sha(tel)] } : {}),
    ...(nombre ? { fn: [sha(nombre.normalize('NFD').replace(/[̀-ͯ]/g, ''))] } : {}),
    ...(r.ip && r.ip !== 'desconocida' ? { client_ip_address: r.ip } : {}),
    ...(r.navegador ? { client_user_agent: r.navegador.slice(0, 400) } : {}),
    ...(r.fbclid ? { fbc: fbc(r.fbclid, llegada) } : {}),
  };

  const cuerpo = {
    data: [
      {
        event_name: 'Lead',
        event_time: ahora,
        event_id: `lead-${sha(correo).slice(0, 32)}`,
        action_source: 'website',
        event_source_url: r.url || 'https://sorelacarodivine.com/comunidad',
        user_data,
        custom_data: { content_name: 'Masterclass La nueva era de las manos', lead_origen: r.origen ?? 'web' },
      },
    ],
    ...(process.env.META_TEST_CODE ? { test_event_code: process.env.META_TEST_CODE } : {}),
  };

  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), TOPE_MS);
  try {
    const res = await fetch(
      `https://graph.facebook.com/${VERSION}/${process.env.META_DATASET_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN!)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: ctrl.signal }
    );
    if (!res.ok) {
      console.warn('[meta-capi] Meta ha rechazado el evento:', res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[meta-capi] no se ha podido avisar a Meta:', e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(reloj);
  }
}
