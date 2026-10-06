import { NextResponse } from 'next/server';
import { hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { pdfDelAcuerdo } from '@/lib/acuerdo-pdf';
import { acuerdoGuardado } from '@/lib/enviar-acuerdo';
import { leerFirmaSorela } from '@/lib/firma-sorela';

/**
 * El acuerdo firmado de una alumna, en PDF. Solo Sorela.
 *
 *   GET /api/acuerdos/DIV-K7P2-4M9X/pdf
 *
 * Se genera en el momento a partir de la copia congelada que se guardó al
 * firmar, así que siempre dice exactamente lo que ella firmó. Lleva su documento,
 * su teléfono y su firma: por eso no se abre con la referencia sola, como el
 * dossier, sino con la sesión de Sorela.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_peticion: Request, { params }: { params: Promise<{ ref: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });

  const { ref } = await params;
  const acuerdo = await acuerdoGuardado(ref.toUpperCase());
  if (!acuerdo) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });

  const pdf = await pdfDelAcuerdo(acuerdo, { firmaSorela: await leerFirmaSorela() });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Acuerdo-${acuerdo.referencia}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
