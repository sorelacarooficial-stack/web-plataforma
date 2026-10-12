import { NextResponse } from 'next/server';
import { tareasDelDia } from '@/lib/automatizar';

/**
 * Lo que Vercel llama cada mañana (ver `crons` en vercel.json): recordatorios
 * de la apertura y el resumen de Sorela.
 *
 * Vercel firma la llamada con `Authorization: Bearer <CRON_SECRET>` cuando esa
 * variable existe en el proyecto. Sin ella esta ruta no hace nada: cualquiera
 * podría llamarla y, aunque las claves impiden repetir correos, no tiene por
 * qué poder dispararlos nadie de fuera.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Una lista de espera grande son muchos envíos uno detrás de otro.
export const maxDuration = 300;

export async function GET(peticion: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || peticion.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, motivo: 'no-autorizado' }, { status: 401 });
  }
  const informe = await tareasDelDia();
  return NextResponse.json({ ok: true, ...informe });
}
