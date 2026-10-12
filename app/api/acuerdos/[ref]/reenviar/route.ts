import { NextResponse } from 'next/server';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { enviarAcuerdo } from '@/lib/enviar-acuerdo';

/**
 * Vuelve a mandar a la alumna su acuerdo firmado y su dossier. Solo Sorela.
 *
 * Existe porque un correo puede no salir —el script sin desplegar, Gmail sin
 * cuota— y la firma no se puede repetir: la alumna ya firmó. Aquí sí se espera
 * a que termine, porque quien pulsa el botón quiere saber si ha salido.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_peticion: Request, { params }: { params: Promise<{ ref: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });

  const { ref } = await params;
  // Reenviar no aprueba: si aún no está aprobado, se reenvía solo el acuse, sin dossier.
  const d = await baseDeDatos().collection('acuerdos').doc(ref.toUpperCase()).get();
  const resultado = await enviarAcuerdo(ref.toUpperCase(), d.get('estado') === 'aprobado' ? 'aprobado' : 'firmado');
  return NextResponse.json({ ok: resultado.enviado, ...resultado });
}
