'use client';

import { useEffect, useState } from 'react';
import Captacion from './Captacion';
import ModalDivine from './ModalDivine';
import { EVENTO_CAPTACION, type PeticionCaptacion } from '@/lib/abrir-captacion';

/**
 * Una sola ventana de contacto para toda la web, montada en la disposición
 * general y escuchando.
 *
 * Existe porque el asistente necesita abrir el formulario y no puede: vive
 * flotando en una esquina, fuera del árbol de la página. Antes lo resolvía
 * diciéndole a la persona «pulsa el botón de arriba», que es hacerle trabajo a
 * quien ya te estaba hablando.
 */
export default function CaptacionGlobal() {
  const [peticion, setPeticion] = useState<PeticionCaptacion | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => setPeticion((e as CustomEvent<PeticionCaptacion>).detail ?? {});
    window.addEventListener(EVENTO_CAPTACION, abrir);
    return () => window.removeEventListener(EVENTO_CAPTACION, abrir);
  }, []);

  return (
    <ModalDivine
      abierto={peticion !== null}
      alCerrar={() => setPeticion(null)}
      titulo={peticion?.titulo ?? 'Dejar tu contacto'}
    >
      {/* Se monta solo cuando se abre: así los campos empiezan vacíos cada vez
          y no se arrastra lo que alguien escribió a medias hace un rato. */}
      {peticion && (
        <Captacion
          titulo={peticion.titulo ?? 'Apúntate'}
          entradilla={
            peticion.entradilla ??
            'Déjame tu nombre, tu correo y tu teléfono. Al terminar, el siguiente paso es entrar en el grupo de WhatsApp de la Técnica Divine.'
          }
          origenForzado={peticion.origen}
        />
      )}
    </ModalDivine>
  );
}
