import type { Metadata, Viewport } from 'next';
import Reserva from '@/components/reserva/Reserva';
import { WHATSAPP_SORELA } from '@/lib/contenido';

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

export default function PaginaReserva() {
  return <Reserva whatsapp={WHATSAPP_SORELA} />;
}
