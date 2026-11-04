import { NextResponse } from 'next/server';
import { SALA_MASTERCLASS } from '@/lib/apertura';

/**
 * /directo: la entrada a la masterclass del 6 de noviembre. Lleva a la sala de
 * Google Meet (lib/apertura.ts). El correo del día, el grupo de WhatsApp y la
 * web enlazan aquí y no a Meet directamente: si la sala cambia a última hora,
 * no hay que tocar ningún correo ni mensaje ya mandado.
 */

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.redirect(SALA_MASTERCLASS, {
    status: 302,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
