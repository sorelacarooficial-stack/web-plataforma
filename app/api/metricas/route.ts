import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/permisos';
import { leerPeriodo, metricasDelPanel } from '@/lib/informe-datos';

/**
 * Las métricas para el panel de Sorela.
 *
 *   GET ?dias=7|30|90|todo  → visitas, procedencia, dispositivos, vídeos y aula
 *
 * Suma los contadores de cada día del periodo y los del periodo anterior,
 * para poder decir «más que la semana pasada». Además cuenta cómo van las
 * alumnas en el aula, que eso no sale de la web sino de su progreso.
 *
 * La lectura vive en lib/informe-datos.ts, la misma que usa el informe en PDF
 * (./informe): así la pantalla y el PDF no pueden contar distinto.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const periodo = leerPeriodo(new URL(peticion.url).searchParams.get('dias'));
  return NextResponse.json(await metricasDelPanel(periodo), { headers: { 'Cache-Control': 'no-store' } });
}
