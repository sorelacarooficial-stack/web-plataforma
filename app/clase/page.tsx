import type { Metadata, Viewport } from 'next';
import QRCode from 'qrcode';
import Deck from '@/components/clase/Deck';
import { QR_DESTINO } from '@/lib/clase';
import css from '@/components/clase/clase.module.css';

/**
 * La presentación en directo de la masterclass. Ver lib/clase.ts.
 *
 * Con `CLASE_CLAVE` en Vercel, solo se abre con `?k=<clave>`: lleva los
 * precios y la Comunidad Divine, que solo se cuentan en directo. Sin la
 * variable, se abre sin clave (pero sigue sin indexarse).
 */

export const metadata: Metadata = {
  title: 'Antes de tocar · Masterclass en directo',
  description: 'Qué observar, qué interpretar y cómo decidir antes de trabajar.',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: '#17140f' };

export const dynamic = 'force-dynamic';

export default async function Clase({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const clave = process.env.CLASE_CLAVE;
  const k = typeof q.k === 'string' ? q.k : '';

  if (clave && k !== clave) {
    return (
      <main className={css.cerrado}>
        <p>Esta presentación se abre con su enlace.</p>
      </main>
    );
  }

  const qr = await QRCode.toString(QR_DESTINO, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#141210', light: '#00000000' },
  });

  return <Deck qr={qr} vista={q.vista === 'presentador' ? 'presentador' : 'publico'} />;
}
