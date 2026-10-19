import { NextResponse } from 'next/server';
import { correoResumen, resumenCampana } from '@/lib/meta-campana';
import { correoDeSorela, mandarCorreo } from '@/lib/correos';

/**
 * El correo de cada mañana a Sorela con cómo va la campaña de la masterclass.
 *
 * Vercel solo entiende la hora en UTC, y el 25 de octubre España cambia de
 * hora. Por eso el cron llama dos veces (8:00 y 9:00 UTC) y aquí solo se
 * manda la que cae a las 10 en Madrid. La clave del envío es el día: aunque
 * se repita la llamada, sale un correo al día.
 *
 * Se acaba solo: después del 7 de noviembre no manda nada.
 * Quién puede llamarla: lo mismo que /api/cron/correos.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ULTIMO_DIA = '2026-11-07';

export async function GET(peticion: Request) {
  const secreto = process.env.CRON_SECRET;
  const autorizado = secreto
    ? peticion.headers.get('authorization') === `Bearer ${secreto}`
    : (peticion.headers.get('user-agent') ?? '').startsWith('vercel-cron/');
  if (!autorizado) return NextResponse.json({ ok: false, motivo: 'no-autorizado' }, { status: 401 });

  const ahora = new Date();
  const hora = Number(ahora.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Madrid' }));
  const dia = ahora.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  if (hora !== 10) return NextResponse.json({ ok: true, omitido: 'no son las 10 en Madrid' });
  if (dia > ULTIMO_DIA) return NextResponse.json({ ok: true, omitido: 'la campaña ha terminado' });

  const para = process.env.INFORME_CAMPANA_PARA || correoDeSorela();
  if (!para) return NextResponse.json({ ok: false, motivo: 'sin-destinatario' }, { status: 500 });

  const resumen = await resumenCampana();
  const correo = correoResumen(resumen);
  const destinos = para.split(',').map((x) => x.trim()).filter(Boolean);
  const envios = await Promise.all(
    destinos.map((d) => mandarCorreo({ para: d, ...correo }, { tipo: 'aviso-interno', clave: `informe-campana:${dia}:${d}` }))
  );
  return NextResponse.json({ ok: true, envios: envios.map((e) => e.estado), registros: resumen.registros, gasto: resumen.gasto });
}
