import type { Metadata } from 'next';
import Plataforma from '@/components/plataforma/Plataforma';

export const metadata: Metadata = {
  title: 'Plataforma',
  description: 'Espacio privado de alumnas, terapeutas certificadas y Sorela.',
  robots: { index: false, follow: false },
};

export default function PaginaPlataforma() {
  return <Plataforma />;
}
