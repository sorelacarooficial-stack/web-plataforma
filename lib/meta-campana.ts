import 'server-only';
import { baseDeDatos, COLECCIONES, hayFirebase } from './firebase-servidor';

/**
 * La campaña de Meta de la masterclass, en números: lo que se ha gastado
 * (sale de Meta) y cuánta gente se ha apuntado de verdad (sale de Firestore,
 * de los contactos que llegaron con utm_campaign=mc_6nov).
 *
 * Se cuentan las dos cosas a propósito. Meta dice cuántos registros cree que
 * ha traído; la web dice cuántos han entrado. No coinciden nunca del todo
 * (atribución, bloqueadores, gente que vuelve otro día), y el número que
 * manda para decidir es el de la web: es gente con nombre y correo.
 *
 * Variables en Vercel:
 *   META_ADS_TOKEN     → token de un usuario del sistema con permiso ads_read.
 *                        Si no está, se usa META_CAPI_TOKEN: es el mismo usuario
 *                        del sistema, con «Ver rendimiento» sobre Sorela Publi.
 *   META_CAMPANA_ID    → opcional; por defecto la campaña de la masterclass.
 * Sin token, el resumen sale solo con los registros de la web.
 */

export const CAMPANA_UTM = 'mc_6nov';
const VERSION = 'v21.0';
/** MC 6 nov · Registros web · CAPI, en la cuenta Sorela Publi. */
const CAMPANA_MASTERCLASS = '120254915227270427';
const tokenAds = () => process.env.META_ADS_TOKEN || process.env.META_CAPI_TOKEN || '';
const campanaId = () => process.env.META_CAMPANA_ID || CAMPANA_MASTERCLASS;
/** Coste por registro a partir del cual algo se está pagando caro. */
export const CPL_OBJETIVO = 1.2;
const FIN = new Date('2026-11-06T18:00:00+01:00');

export type FilaMeta = { nombre: string; gasto: number; impresiones: number; clics: number; leadsMeta: number; frecuencia: number };
export type Resumen = {
  hayMeta: boolean;
  gasto: number;
  impresiones: number;
  alcance: number;
  clics: number;
  leadsMeta: number;
  registros: number;
  registrosHoy: number;
  registrosAyer: number;
  coste: number | null;
  ctr: number | null;
  conjuntos: FilaMeta[];
  anuncios: (FilaMeta & { registros: number })[];
  porDia: { dia: string; registros: number; gasto: number }[];
  diasQuedan: number;
  ideas: string[];
  error?: string;
};

const n = (v: unknown) => Number(v ?? 0) || 0;
const leads = (acciones: unknown) => {
  if (!Array.isArray(acciones)) return 0;
  const a = acciones.find((x) => ['offsite_conversion.fb_pixel_lead', 'lead'].includes(x?.action_type));
  return n(a?.value);
};
const diaMadrid = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

async function graph(ruta: string, q: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${VERSION}/${ruta}`);
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', tokenAds());
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `Meta ${r.status}`);
  return (j.data ?? []) as Record<string, unknown>[];
}

const fila = (x: Record<string, unknown>, nombre: string): FilaMeta => ({
  nombre,
  gasto: n(x.spend),
  impresiones: n(x.impressions),
  clics: n(x.inline_link_clicks),
  leadsMeta: leads(x.actions),
  frecuencia: n(x.frequency),
});

/** Los registros de la web que vinieron de la campaña. */
async function registrosWeb() {
  if (!hayFirebase()) return [] as { dia: string; anuncio: string }[];
  const r = await baseDeDatos().collection(COLECCIONES.contactos).where('campana', '==', CAMPANA_UTM).get();
  return r.docs.map((d) => {
    const v = d.data();
    const creado: Date = v.creado?.toDate?.() ?? new Date();
    return { dia: diaMadrid(creado), anuncio: String(v.anuncio ?? '') };
  });
}

export async function resumenCampana(): Promise<Resumen> {
  const hayMeta = Boolean(tokenAds());
  const web = await registrosWeb().catch(() => []);
  const hoy = diaMadrid(new Date());
  const ayer = diaMadrid(new Date(Date.now() - 864e5));

  const r: Resumen = {
    hayMeta,
    gasto: 0,
    impresiones: 0,
    alcance: 0,
    clics: 0,
    leadsMeta: 0,
    registros: web.length,
    registrosHoy: web.filter((w) => w.dia === hoy).length,
    registrosAyer: web.filter((w) => w.dia === ayer).length,
    coste: null,
    ctr: null,
    conjuntos: [],
    anuncios: [],
    porDia: [],
    diasQuedan: Math.max(0, Math.ceil((FIN.getTime() - Date.now()) / 864e5)),
    ideas: [],
  };

  const gastoDia = new Map<string, number>();
  if (hayMeta) {
    const id = campanaId();
    const campos = 'spend,impressions,reach,inline_link_clicks,actions,frequency';
    try {
      const [total, conjuntos, anuncios, dias] = await Promise.all([
        graph(`${id}/insights`, { fields: campos, date_preset: 'maximum' }),
        graph(`${id}/insights`, { fields: `adset_name,${campos}`, level: 'adset', date_preset: 'maximum' }),
        graph(`${id}/insights`, { fields: `ad_name,${campos}`, level: 'ad', date_preset: 'maximum', limit: '50' }),
        graph(`${id}/insights`, { fields: 'spend', date_preset: 'maximum', time_increment: '1' }),
      ]);
      const t = total[0] ?? {};
      r.gasto = n(t.spend);
      r.impresiones = n(t.impressions);
      r.alcance = n(t.reach);
      r.clics = n(t.inline_link_clicks);
      r.leadsMeta = leads(t.actions);
      r.conjuntos = conjuntos.map((x) => fila(x, String(x.adset_name)));
      /* El utm_content de cada anuncio es su clave (a1-foto-es…); el nombre
         en Meta es «A1 · Foto · ES». Se casan por las dos primeras piezas. */
      r.anuncios = anuncios.map((x) => {
        const nombre = String(x.ad_name);
        const clave = nombre.split('·')[0].trim().toLowerCase();
        const region = /latam|caliente/i.test(nombre) ? '-la' : '-es';
        return { ...fila(x, nombre), registros: web.filter((w) => w.anuncio.startsWith(clave) && w.anuncio.endsWith(region)).length };
      });
      for (const d of dias) gastoDia.set(String(d.date_start), n(d.spend));
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      /* El token de la API de conversiones puede no tener permiso de lectura de
         anuncios: se dice claro qué hacer en vez de enseñar el error de Meta. */
      r.error = /permission|permiso|(#10)|(#200)|ads_read/i.test(m)
        ? 'El token no tiene permiso para leer el gasto. Hace falta un token con ads_read en META_ADS_TOKEN.'
        : m;
    }
  }

  const todosLosDias = new Set([...gastoDia.keys(), ...web.map((w) => w.dia)]);
  r.porDia = [...todosLosDias]
    .sort()
    .map((dia) => ({ dia, gasto: gastoDia.get(dia) ?? 0, registros: web.filter((w) => w.dia === dia).length }));
  r.coste = r.registros > 0 && r.gasto > 0 ? r.gasto / r.registros : null;
  r.ctr = r.impresiones > 0 ? (r.clics / r.impresiones) * 100 : null;
  r.ideas = ideas(r);
  return r;
}

const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/** Qué haría yo hoy, por reglas: las mismas cada día, sin adivinar. */
function ideas(r: Resumen): string[] {
  const s: string[] = [];
  if (!r.hayMeta) return ['Falta el token de Meta en Vercel (META_CAPI_TOKEN o META_ADS_TOKEN). Mientras, solo se ven los registros.'];
  if (r.gasto === 0) return ['La campaña aún no ha gastado: revisa que esté activa en el Administrador de anuncios.'];

  for (const a of r.anuncios) {
    if (a.gasto >= CPL_OBJETIVO * 4 && a.registros === 0)
      s.push(`«${a.nombre}» lleva ${eur(a.gasto)} sin ningún registro: pausarlo y dejar el presupuesto a los que sí convierten.`);
  }
  const ganador = [...r.anuncios].filter((a) => a.registros >= 3).sort((a, b) => a.gasto / a.registros - b.gasto / b.registros)[0];
  if (ganador) s.push(`El que mejor funciona es «${ganador.nombre}» (${eur(ganador.gasto / ganador.registros)} por registro). Merece una variante nueva con el mismo gancho.`);

  if (r.coste !== null && r.coste > CPL_OBJETIVO * 1.5)
    s.push(`Cada registro cuesta ${eur(r.coste)}, por encima de lo esperado (${eur(CPL_OBJETIVO)}). Si el CTR es bajo, el problema es el anuncio; si es alto, la página.`);
  if (r.ctr !== null && r.ctr < 0.8) s.push(`Solo ${r.ctr.toFixed(2).replace('.', ',')} % de quien ve el anuncio hace clic: probar un gancho más directo en los primeros 2 segundos.`);
  if (r.ctr !== null && r.ctr >= 1.5 && r.coste !== null && r.coste > CPL_OBJETIVO)
    s.push('Hacen clic pero no se apuntan: revisar que /comunidad diga lo mismo que el anuncio («Antes de tocar», gratis, la fecha) y que el formulario se vea sin bajar.');
  for (const c of r.conjuntos) {
    if (/caliente/i.test(c.nombre) && c.frecuencia > 3.5)
      s.push(`El público caliente ya ha visto los anuncios ${c.frecuencia.toFixed(1).replace('.', ',')} veces de media: cambiar la pieza o bajar su presupuesto.`);
  }
  if (r.leadsMeta > 0 && r.registros > 0 && r.leadsMeta < r.registros * 0.5)
    s.push('Meta ve menos de la mitad de los registros reales: revisar en Administrador de eventos que lleguen los Lead de la API de conversiones.');
  if (r.diasQuedan <= 4 && r.diasQuedan > 0) s.push('Última semana: sube el conjunto caliente y no bajes el presupuesto, que los registros se concentran al final.');
  if (!s.length) s.push('Va según lo previsto. No tocar nada hoy: cada cambio reinicia el aprendizaje de Meta.');
  return s.slice(0, 4);
}

/** El correo de las 10:00 para Sorela. */
export function correoResumen(r: Resumen) {
  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
  const lineas = [
    `Gastado: ${eur(r.gasto)}`,
    `Registros desde los anuncios: ${r.registros} (ayer ${r.registrosAyer})`,
    `Coste por registro: ${r.coste !== null ? eur(r.coste) : '—'}`,
    `Personas alcanzadas: ${r.alcance.toLocaleString('es-ES')} · clics: ${r.clics.toLocaleString('es-ES')}${r.ctr !== null ? ` (${r.ctr.toFixed(2).replace('.', ',')} %)` : ''}`,
    `Quedan ${r.diasQuedan} días para la masterclass.`,
  ];
  const anuncios = r.anuncios
    .sort((a, b) => b.registros - a.registros || b.gasto - a.gasto)
    .map((a) => `· ${a.nombre}: ${a.registros} registros, ${eur(a.gasto)}`);
  const texto = [
    `Buenos días, Sorela. Así va la campaña de la masterclass (${hoy}):`,
    '',
    ...lineas,
    '',
    ...(anuncios.length ? ['Por anuncio:', ...anuncios, ''] : []),
    'Qué haría hoy:',
    ...r.ideas.map((i) => `· ${i}`),
    '',
    'El detalle está en la plataforma, en Métricas.',
  ].join('\n');

  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const cifra = (k: string, v: string) =>
    `<td style="padding:14px 16px;background:#f4efe7;border-radius:14px"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6c645a">${k}</div><div style="font-size:24px;font-weight:600;color:#141210;margin-top:4px">${v}</div></td>`;
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141210;line-height:1.55">
<p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#8a6a32;margin:0 0 6px">Campaña masterclass · ${esc(hoy)}</p>
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 18px">Así va la campaña</h1>
<table role="presentation" cellspacing="8" style="width:100%;border-collapse:separate"><tr>${cifra('Gastado', eur(r.gasto))}${cifra('Registros', String(r.registros))}${cifra('Por registro', r.coste !== null ? eur(r.coste) : '—')}</tr></table>
<p style="color:#6c645a;font-size:14px;margin:6px 0 18px">Ayer entraron ${r.registrosAyer}. Alcance ${r.alcance.toLocaleString('es-ES')} personas, ${r.clics.toLocaleString('es-ES')} clics${r.ctr !== null ? ` (${r.ctr.toFixed(2).replace('.', ',')} %)` : ''}. Quedan ${r.diasQuedan} días.</p>
${anuncios.length ? `<h2 style="font-size:16px;margin:0 0 8px">Por anuncio</h2><ul style="padding-left:18px;margin:0 0 18px;font-size:14px">${anuncios.map((a) => `<li>${esc(a.slice(2))}</li>`).join('')}</ul>` : ''}
<h2 style="font-size:16px;margin:0 0 8px">Qué haría hoy</h2>
<ul style="padding-left:18px;margin:0;font-size:14px">${r.ideas.map((i) => `<li style="margin-bottom:6px">${esc(i)}</li>`).join('')}</ul>
</div>`;
  return { asunto: `Campaña masterclass: ${r.registros} registros · ${eur(r.gasto)} gastados`, texto, html };
}
