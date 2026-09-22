import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Plataforma from '@/components/plataforma/Plataforma';
import { hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import SinConfigurar from './SinConfigurar';

export const metadata: Metadata = {
  title: 'Plataforma',
  description: 'Espacio privado de alumnas, terapeutas certificadas y Sorela.',
  robots: { index: false, follow: false },
};

/**
 * La puerta de la plataforma.
 *
 * Se comprueba aquí, en el servidor, y no dentro del componente: si la
 * comprobación viviera en el navegador, la página se pintaría entera —con los
 * datos dentro— y después se escondería. Quien mirase la respuesta de red
 * vería todo. Así, quien no tiene sesión no recibe ni una línea.
 */
export const dynamic = 'force-dynamic';

export default async function PaginaPlataforma() {
  // Mientras no estén las variables de Firebase, se dice lo que falta en vez
  // de mandar a un login que no puede funcionar.
  if (!hayFirebase()) return <SinConfigurar />;

  const sesion = await sesionActual();
  if (!sesion) redirect('/entrar?volver=/plataforma');

  return <Plataforma sesion={sesion} />;
}
