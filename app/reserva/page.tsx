import type { Metadata, Viewport } from 'next';
import Reserva from '@/components/reserva/Reserva';
import { WHATSAPP_SORELA } from '@/lib/contenido';
import { transferencias } from '@/lib/transferencia';

/**
 * /reserva: la página que el equipo manda por WhatsApp a quien escribe
 * «QUIERO» en la masterclass. No se indexa. Configuración en lib/reserva.ts.
 */

export const metadata: Metadata = {
  title: 'Reserva tu plaza · Técnica Divine',
  description: 'Reserva tu plaza en la formación Divine. Precio especial durante 24 horas.',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: '#f4efe7' };

// Lee las cuentas de transferencia de Vercel en cada visita.
export const dynamic = 'force-dynamic';

export default function PaginaReserva() {
  return <Reserva whatsapp={WHATSAPP_SORELA} transferencias={transferencias()} />;
}
