'use client';

import BotonCaptacion from './BotonCaptacion';
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
  return (
    <div className={`${css.acciones} ${alineacion === 'centro' ? css.centro : ''}`}>
      <BotonCaptacion>{textoPrincipal}</BotonCaptacion>

      <button type="button" className={css.cita} onClick={() => abrirAsistente(preguntaCita)}>
        <span className={css.citaPunto} aria-hidden="true" />
        {textoCita}
      </button>
    </div>
  );
}
