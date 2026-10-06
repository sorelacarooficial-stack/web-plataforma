'use client';

import { useState } from 'react';
import { PREGUNTAS } from '@/lib/precurso';
import css from './evaluacion.module.css';

/**
 * La evaluación de comprensión, en pequeño.
 *
 * Son datos anatómicos que están en el dossier: nadie se juega nada aquí. Está
 * para que quien dude de si el curso tiene fondo lo compruebe en diez
 * segundos, en vez de leerlo prometido en un párrafo.
 *
 * NO HAY NOTA Y NO SE GUARDA NADA. Una puntuación convertiría esto en un
 * examen de entrada, que es justo lo contrario de lo que hace falta en una
 * página que quiere que alguien se apunte. Se responde, se ve si era eso, y se
 * explica por qué.
 */
export default function Evaluacion() {
  /** Qué ha elegido en cada pregunta, o nada. */
  const [elegidas, setElegidas] = useState<(number | null)[]>(PREGUNTAS.map(() => null));

  const acertadas = elegidas.filter((e, i) => e === PREGUNTAS[i].correcta).length;
  const respondidas = elegidas.filter((e) => e !== null).length;

  return (
    <div className={css.zona}>
      <ol className={css.preguntas}>
        {PREGUNTAS.map((p, i) => {
          const elegida = elegidas[i];
          const contestada = elegida !== null;
          return (
            <li key={p.pregunta} className={css.pregunta}>
              <p className={css.enunciado}>{p.pregunta}</p>
              <div className={css.opciones}>
                {p.opciones.map((o, j) => {
                  const esta = elegida === j;
                  const buena = j === p.correcta;
                  return (
                    <button
                      key={o}
                      type="button"
                      className={css.opcion}
                      /* El estado solo se marca una vez contestada: antes,
                         pintar la buena de verde sería regalar la respuesta. */
                      data-estado={
                        !contestada ? undefined : buena ? 'bien' : esta ? 'mal' : 'gris'
                      }
                      onClick={() =>
                        setElegidas((e) => e.map((v, k) => (k === i ? (v === j ? null : j) : v)))
                      }
                      aria-pressed={esta}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              {contestada && <p className={css.explicacion}>{p.explicacion}</p>}
            </li>
          );
        })}
      </ol>

      {respondidas > 0 && (
        <p className={css.marcador} role="status">
          {acertadas} de {respondidas}. Todas las respuestas están en el dossier.
        </p>
      )}
    </div>
  );
}
