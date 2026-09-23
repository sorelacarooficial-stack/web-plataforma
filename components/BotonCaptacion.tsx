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
  titulo = 'Te mando la información',
  entradilla = 'Déjame dónde escribirte y recibes en tu correo qué es la Técnica Divine, cómo se aprende y cuándo son las próximas formaciones.',
  etiquetaVentana = 'Recibir la información de la Técnica Divine',
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
