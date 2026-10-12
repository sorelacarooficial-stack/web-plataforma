import { NextResponse } from 'next/server';
import { tareasDelDia } from '@/lib/automatizar';

/**
 * Lo que Vercel llama cada mañana (ver `crons` en vercel.json): recordatorios
 * de la apertura y el resumen de Sorela.
 *
 * Quién puede llamarla:
 *  - Si existe CRON_SECRET en Vercel, solo quien traiga
 *    `Authorization: Bearer <CRON_SECRET>` (Vercel lo pone solo).
 *  - Si no existe, se acepta la llamada del cron de Vercel por su firma de
 *    navegador (`vercel-cron/…`). Eso se puede imitar, pero lo peor que puede
 *    hacer quien lo imite es adelantar unas horas lo que ya tocaba mandar ese
 *    día: nada sale dos veces ni fuera de su fecha. A cambio, Sorela no tiene
 *    que configurar nada para que esto funcione.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Una lista de espera grande son muchos envíos uno detrás de otro.
export const maxDuration = 300;

export async function GET(peticion: Request) {
  const secreto = process.env.CRON_SECRET;
  const autorizado = secreto
    ? peticion.headers.get('authorization') === `Bearer ${secreto}`
    : (peticion.headers.get('user-agent') ?? '').startsWith('vercel-cron/');
  if (!autorizado) {
    return NextResponse.json({ ok: false, motivo: 'no-autorizado' }, { status: 401 });
  }
  const informe = await tareasDelDia();
  return NextResponse.json({ ok: true, ...informe });
}
