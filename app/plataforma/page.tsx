import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Plataforma from '@/components/plataforma/Plataforma';
import { hayFirebase } from '@/lib/firebase-servidor';
import { entradaDe, sesionActual } from '@/lib/sesion-servidor';
import { registrarActividad, type Actividad } from '@/lib/logros';
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
     en cada carga es lo que hace que quitarle uno tenga efecto al momento.
     Accesos, foto y bienvenida salen de UNA sola lectura de su ficha. */
  const entrada = await entradaDe(sesion.uid);
  // La racha de días: se apunta al entrar (una escritura al día como mucho).
  // Con la actividad ya leída, casi siempre no cuesta ni una lectura más.
  await registrarActividad(sesion.uid, entrada.actividad as Actividad | null);

  /* La bienvenida (foto, perfil y, si es miembro, su ficha del mapa) se abre
     sola mientras no la haya terminado ni dicho «más tarde». Sorela no la
     tiene. Si la ficha no se ha podido leer, no se abre: mejor no molestar. */
  const bienvenidaPendiente =
    sesion.rol !== 'sorela' && entrada.onboarding !== null && !entrada.onboarding.completado && !entrada.onboarding.saltado;

  /* El recorrido de bienvenida (por dónde se va a cada sitio): cómo lo dejó,
     leído en la misma lectura. Llega ya resuelto, como la bienvenida, para que
     se abra —o no— sin parpadeo. Sorela no lo tiene. Si la ficha no se ha
     podido leer, null: no se abre solo. */
  const recorrido = sesion.rol !== 'sorela' ? entrada.recorrido : null;

  // La pantalla pedida en la dirección (?v=leads) llega ya resuelta: así no se
  // ve el Inicio un instante antes de saltar a ella. Plataforma la revisa.
  const { v } = await searchParams;

  return (
    <Plataforma
      sesion={{ ...sesion, foto: entrada.foto ?? sesion.foto }}
      accesos={entrada.accesos}
      bienvenidaPendiente={bienvenidaPendiente}
      recorrido={recorrido}
      vistaInicial={typeof v === 'string' ? v.slice(0, 30) : null}
    />
  );
}
