'use client';

import { useState } from 'react';
import { JORNADAS } from '@/lib/precurso';
import css from './programa.module.css';

/**
 * El horario de las dos jornadas, bloque a bloque.
 *
 * Se abre uno cada vez. Un horario de once bloques desplegado de golpe es una
 * pared de texto que nadie lee; abriendo uno, se recorre el día como se
 * recorre una agenda.
 *
 * Arranca con el primer bloque del primer día abierto y NO con todo cerrado:
 * una lista de títulos sin nada dentro no deja ver de qué va esto hasta que
 * alguien decide tocar, y la mayoría no toca.
 */
export default function Programa() {
  const [dia, setDia] = useState(0);
  const [bloque, setBloque] = useState(0);

  const jornada = JORNADAS[dia];

  return (
    <div className={css.zona}>
      {/* Las dos jornadas, como dos pestañas. */}
      <div className={css.dias} role="tablist" aria-label="Jornadas de la formación">
        {JORNADAS.map((j, i) => (
          <button
            key={j.dia}
            type="button"
            role="tab"
            aria-selected={i === dia}
            className={css.dia}
            data-activo={i === dia ? '' : undefined}
            onClick={() => {
              setDia(i);
              setBloque(0);
            }}
          >
            <span className={css.diaNum}>{j.dia}</span>
            <span className={css.diaTitulo}>{j.titulo}</span>
          </button>
        ))}
      </div>

      <p className={css.resumen}>{jornada.resumen}</p>

      <ol className={css.bloques}>
        {jornada.bloques.map((b, i) => {
          const abierto = i === bloque;
          return (
            <li key={b.hora} className={css.bloque} data-abierto={abierto ? '' : undefined}>
              <button
                type="button"
                className={css.cabeza}
                onClick={() => setBloque(abierto ? -1 : i)}
                aria-expanded={abierto}
              >
                <span className={css.hora}>{b.hora}</span>
                <span className={css.titulo}>{b.titulo}</span>
                <span className={css.senal} aria-hidden="true">
                  {abierto ? '−' : '+'}
                </span>
              </button>
              {/* El texto se monta y se desmonta en vez de esconderse con CSS:
                  lo escondido sigue estando ahí para un lector de pantalla, y
                  leer once bloques cerrados seguidos no es un horario. */}
              {abierto && <p className={css.texto}>{b.texto}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
