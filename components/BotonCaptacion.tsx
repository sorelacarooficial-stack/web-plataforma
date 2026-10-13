'use client';

import { useState } from 'react';
import Captacion from './Captacion';
import ModalDivine from './ModalDivine';

/**
 * Un botón que abre la ventana con el formulario de contacto.
 *
 * Está suelto de la llamada del hero porque hay más de un sitio en la web
 * donde conviene pedir el dato —el hero, la comunidad, el cierre— y todos
 * deben abrir exactamente la misma ventana. Si cada uno montara la suya,
 * acabarían divergiendo: distinto texto, distintos campos y, tarde o
 * temprano, uno sin casilla de consentimiento.
 *
 * `origen` es lo que luego separa el embudo en la plataforma: quien deja su
 * contacto en la portada busca que le traten, quien lo deja en formaciones
 * busca aprender y quien lo deja en la comunidad ya es terapeuta. Son tres
 * conversaciones distintas, y sin este dato habría que adivinar cuál toca.
 * Ver lib/origenes.ts.
 */
export default function BotonCaptacion({
  children,
  className = 'btn btn-latido',
  titulo = 'Apúntate',
  entradilla = 'Déjame tu nombre, tu correo y tu teléfono. Al terminar, el siguiente paso es entrar en el grupo de WhatsApp de la Técnica Divine.',
  etiquetaVentana = 'Apuntarme a la Técnica Divine',
  origen,
}: {
  children: React.ReactNode;
  className?: string;
  titulo?: string;
  entradilla?: string;
  etiquetaVentana?: string;
  origen?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setAbierto(true)}>
        {children}
      </button>

      <ModalDivine
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo={etiquetaVentana}
      >
        <Captacion titulo={titulo} entradilla={entradilla} origenForzado={origen} />
      </ModalDivine>
    </>
  );
}
