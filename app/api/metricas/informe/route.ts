import { exigirAdmin } from '@/lib/permisos';
import { datosDelInforme, leerPeriodo } from '@/lib/informe-datos';
import { pdfDelInforme } from '@/lib/informe-pdf';
import { sobrePeriodo } from '@/lib/informe';

/**
 * El informe de Métricas en PDF, solo para Sorela.
 *
 *   GET ?dias=7|30|90|todo  → application/pdf
 *                             «Informe-Divine-<periodo>-<fecha>.pdf»
 *
 * Respeta el periodo que esté mirando en la pantalla. Lee los datos una vez
 * (lib/informe-datos.ts, la misma lectura que la pantalla) y los pinta
 * (lib/informe-pdf.ts). Se genera al momento y no se guarda en ningún sitio:
 * cada descarga es la foto de ese instante.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Sale en 2-3 s; el margen es por si Firestore tarda en despertar.
export const maxDuration = 30;

export async function GET(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;

  const inicio = Date.now();
  const periodo = leerPeriodo(new URL(peticion.url).searchParams.get('dias'));
  try {
    const datos = await datosDelInforme(periodo);
    const pdf = await pdfDelInforme(datos);
    const nombre = `Informe-Divine-${sobrePeriodo(periodo).archivo}-${datos.hoy}.pdf`;
    const ms = Date.now() - inicio;
    if (ms > 5000) console.warn(`[informe] ha tardado ${ms} ms`);
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'no-store',
        'X-Informe-Ms': String(ms),
      },
    });
  } catch (e) {
    console.error('[informe] no se ha podido generar', e);
    return Response.json({ ok: false, motivo: 'fallo' }, { status: 500 });
  }
}
