'use client';

import { useId, useState } from 'react';
import type { Pregunta } from '@/lib/contenido';
import css from './Acordeon.module.css';

/** FAQ plegable. Arranca con la primera abierta, como el prototipo. */
export default function Acordeon({ preguntas }: { preguntas: Pregunta[] }) {
  const [abierta, setAbierta] = useState<number | null>(0);
  const id = useId();

  return (
    <div className={css.lista}>
      {preguntas.map((f, i) => {
        const esta = abierta === i;
        return (
          <div key={f.q} className={css.fila}>
            <h3 className={css.encabezado}>
              <button
                type="button"
                onClick={() => setAbierta(esta ? null : i)}
                aria-expanded={esta}
                aria-controls={`${id}-${i}`}
                className={css.boton}
              >
                <span className={css.pregunta}>{f.q}</span>
                <span className={css.signo} aria-hidden="true">
                  {esta ? '–' : '+'}
                </span>
              </button>
            </h3>
            {esta && (
              <p id={`${id}-${i}`} className={css.respuesta}>
                {f.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
