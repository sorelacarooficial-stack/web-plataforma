import type { Metadata } from 'next';
import Registro from '@/components/Registro';

/**
 * Crearse una cuenta.
 *
 * Va fuera del grupo `(web)` —igual que `/entrar`— porque es una pantalla
 * completa: sin cabecera, sin pie y sin el chatbot flotante encima. Y fuera
 * del índice de Google, porque es una puerta y no una página que deba
 * encontrar quien busca «drenaje linfático». Se llega a ella desde la
 * comunidad, desde las formaciones o desde el acceso, donde la decisión ya
 * está tomada.
 */
export const metadata: Metadata = {
  title: 'Crear tu cuenta',
  description: 'Crea tu cuenta para entrar en la Comunidad Divine o en la formación.',
  robots: { index: false, follow: false },
};

export default function Pagina() {
  return <Registro />;
}
