import { origenDe } from './metricas';

/**
 * La llegada que manda un formulario (lib/llegada.ts), revisada y traducida
 * en el servidor. Lo que viene del navegador puede traer cualquier cosa, así
 * que se recorta y se queda solo con lo que sirve para el CRM:
 *
 *   fuente   → «Instagram», «Google», «WhatsApp», «Directo»…
 *   campana  → el utm_campaign, si el enlace lo traía
 *   entrada  → la primera página que vio
 *   pagina   → la página donde rellenó el formulario
 */

export type Procedencia = { fuente: string; campana?: string; entrada?: string; pagina?: string };

const PROPIO = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com').hostname.replace(/^www\./, '');
  } catch {
    return 'sorelacarodivine.com';
  }
})();

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const ruta = (v: unknown) => {
  const r = texto(v, 120);
  return r.startsWith('/') ? r : '';
};

export function procedenciaDe(llegada: unknown): Procedencia | null {
  if (!llegada || typeof llegada !== 'object') return null;
  const l = llegada as Record<string, unknown>;
  const fuente = origenDe(texto(l.ref, 300), texto(l.utm, 60), PROPIO) || 'Directo';
  const campana = texto(l.campana, 60);
  const entrada = ruta(l.entrada);
  const pagina = ruta(l.pagina);
  return {
    fuente,
    ...(campana ? { campana } : {}),
    ...(entrada ? { entrada } : {}),
    ...(pagina ? { pagina } : {}),
  };
}
