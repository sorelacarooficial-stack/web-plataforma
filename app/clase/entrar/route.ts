import { NextResponse } from 'next/server';
import { ENLACE_PAGO } from '@/lib/clase';
import { WHATSAPP_SORELA } from '@/lib/contenido';

/**
 * /clase/entrar: adonde lleva el QR de la presentación. Redirige al enlace de
 * pago (`CLASE_ENLACE_PAGO` en Vercel, o `ENLACE_PAGO` en lib/clase.ts). Si
 * todavía no hay enlace, al WhatsApp de Sorela con el mensaje escrito: quien
 * escanea en directo nunca llega a un error.
 */

export const dynamic = 'force-dynamic';

export function GET() {
  const destino =
    process.env.CLASE_ENLACE_PAGO ||
    ENLACE_PAGO ||
    `https://wa.me/${WHATSAPP_SORELA.replace(/\D/g, '')}?text=${encodeURIComponent(
      'Hola, Sorela. Vengo de la masterclass y quiero entrar en la Comunidad Divine.'
    )}`;
  return NextResponse.redirect(destino, { status: 302, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
