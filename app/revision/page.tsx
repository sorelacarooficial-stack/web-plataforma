import type { Metadata, Viewport } from 'next';
import { GRUPOS } from '@/lib/revision';
import Revision from '@/components/revision/Revision';

/**
 * Revisión para Sorela: revision.sorelacarodivine.com (proxy.ts reescribe el
 * subdominio a /revision). Oculta: no se indexa ni sale en el menú.
 * El contenido está en lib/revision.ts.
 */

export const metadata: Metadata = {
  title: 'Revisión · Sorela Caro',
  description: 'Lo que está preparado antes de publicarlo.',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: '#f4efe7' };

export default function PaginaRevision() {
  return <Revision grupos={GRUPOS} />;
}
