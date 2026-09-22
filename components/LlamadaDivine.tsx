'use client';

import { useState } from 'react';
import Captacion from './Captacion';
import ModalDivine from './ModalDivine';
import { abrirAsistente } from '@/lib/abrir-asistente';
import css from './LlamadaDivine.module.css';

/**
 * Las dos salidas del inicio, juntas porque compiten entre sí y hay que
 * decidir cuál gana: la información pesa más que la cita, porque quien acaba
 * de llegar todavía no sabe lo suficiente para querer una cita. Por eso una es
 * un botón sólido con movimiento y la otra un enlace fino.
 *
 * La de la información abre una ventana en vez de llevar a otra página: un
 * salto de página pierde a la mitad de la gente, y aquí el dato es el negocio.
 */
export default function LlamadaDivine({
  textoPrincipal = 'Quiero la información',
  textoCita = 'Agendar una cita',
  preguntaCita = 'Quiero agendar una cita. ¿Qué huecos hay?',
  alineacion = 'izquierda',
}: {
  textoPrincipal?: string;
  textoCita?: string;
  preguntaCita?: string;
  alineacion?: 'izquierda' | 'centro';
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <div className={`${css.acciones} ${alineacion === 'centro' ? css.centro : ''}`}>
        <button type="button" className="btn btn-latido" onClick={() => setAbierto(true)}>
          {textoPrincipal}
        </button>

        <button
          type="button"
          className={css.cita}
          onClick={() => abrirAsistente(preguntaCita)}
        >
          <span className={css.citaPunto} aria-hidden="true" />
          {textoCita}
        </button>
      </div>

      <ModalDivine
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Recibir la información de la Técnica Divine"
      >
        <Captacion
          titulo="Te mando la información"
          entradilla="Déjame dónde escribirte y recibes en tu correo qué es la Técnica Divine, cómo se aprende y cuándo son las próximas formaciones."
        />
      </ModalDivine>
    </>
  );
}
