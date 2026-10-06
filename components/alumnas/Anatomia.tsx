'use client';

import { useState } from 'react';
import Image from 'next/image';
import { LAMINAS } from '@/lib/precurso';
import css from './anatomia.module.css';

/**
 * Las láminas de anatomía del sistema linfático.
 *
 * Es la parte de la formación que se puede enseñar sin regalar el método: la
 * anatomía del sistema linfático está en cualquier libro, lo que no está en
 * ningún libro es el protocolo de trabajo de Sorela. Por eso aquí hay láminas y
 * descripciones, y ni una sola maniobra.
 *
 * SE ENSEÑA UNA CADA VEZ, con la lista al lado. Las nueve a la vez serían una
 * pared de dibujos diminutos en la que no se lee ni un rótulo, que es justo lo
 * que hay que poder leer. Y el texto que acompaña es corto a propósito: la
 * lámina es lo que manda, el párrafo solo dice dónde mirar.
 */
export default function Anatomia() {
  const [cual, setCual] = useState(0);
  const lamina = LAMINAS[cual];

  return (
    <div className={css.zona}>
      <ul className={css.lista} role="tablist" aria-label="Láminas de anatomía">
        {LAMINAS.map((l, i) => (
          <li key={l.src}>
            <button
              type="button"
              role="tab"
              aria-selected={i === cual}
              className={css.pestana}
              data-activa={i === cual ? '' : undefined}
              onClick={() => setCual(i)}
            >
              <span className={css.num}>{String(i + 1).padStart(2, '0')}</span>
              <span className={css.nombre}>{l.titulo}</span>
            </button>
          </li>
        ))}
      </ul>

      <figure className={css.vista}>
        {/*
         * La lámina se enseña ENTERA, nunca recortada para llenar el hueco.
         * Son dibujos con rótulos pegados a los bordes: recortar para que
         * encaje bonito corta justo las palabras que explican el dibujo.
         */}
        <div className={css.marco}>
          <Image
            key={lamina.src}
            src={lamina.src}
            alt={lamina.alt}
            width={1200}
            height={1200}
            className={css.lamina}
            sizes="(max-width: 860px) 92vw, 54vw"
          />
        </div>
        <figcaption className={css.pie}>
          <h3 className={css.pieTitulo}>{lamina.titulo}</h3>
          <p className={css.pieTexto}>{lamina.texto}</p>
        </figcaption>
      </figure>
    </div>
  );
}
