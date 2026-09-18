import type { Metadata } from 'next';
import Acceso from '@/components/Acceso';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acceso a la plataforma de Sorela Caro: alumnas y terapeutas certificadas.',
  robots: { index: false, follow: false },
};

export default function Entrar() {
  return <Acceso />;
}
