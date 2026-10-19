import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/permisos';
import { resumenCampana } from '@/lib/meta-campana';

/**
 * La campaña de Meta de la masterclass para el panel de Sorela: gasto (de
 * Meta) y registros (de la web). Ver lib/meta-campana.ts.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  return NextResponse.json(await resumenCampana(), { headers: { 'Cache-Control': 'no-store' } });
}
