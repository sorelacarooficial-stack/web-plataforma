import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Plataforma from '@/components/plataforma/Plataforma';
import { hayFirebase } from '@/lib/firebase-servidor';
import { accesosDe, fotoDe, sesionActual } from '@/lib/sesion-servidor';
import { registrarActividad } from '@/lib/logros';
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

export default async function PaginaPlataforma({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  // Mientras no estén las variables de Firebase, se dice lo que falta en vez
  // de mandar a un login que no puede funcionar.
  if (!hayFirebase()) return <SinConfigurar />;

  const sesion = await sesionActual();
  if (!sesion) redirect('/entrar?volver=/plataforma');

  /* Lo que tiene contratado se lee aquí, en el servidor, y se le pasa ya
     resuelto. No viaja en la cookie a propósito: la cookie dura cinco días y
     los accesos cambian —alguien deja de pagar la comunidad—, así que leerlos
     en cada carga es lo que hace que quitarle uno tenga efecto al momento. */
  // La racha de días: se apunta al entrar (una escritura al día como mucho).
  const [accesos, foto] = await Promise.all([accesosDe(sesion.uid), fotoDe(sesion.uid), registrarActividad(sesion.uid)]);

  // La pantalla pedida en la dirección (?v=leads) llega ya resuelta: así no se
  // ve el Inicio un instante antes de saltar a ella. Plataforma la revisa.
  const { v } = await searchParams;

  return <Plataforma sesion={{ ...sesion, foto: foto ?? sesion.foto }} accesos={accesos} vistaInicial={typeof v === 'string' ? v.slice(0, 30) : null} />;
}
