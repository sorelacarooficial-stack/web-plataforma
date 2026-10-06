'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import css from './landing.module.css';

/**
 * Dos filas de fotos que se desplazan en sentidos opuestos al hacer scroll.
 *
 * NO SE MUEVEN SOLAS. Se mueven con la página: si quien mira para, paran. Es
 * la diferencia entre una marquesina que distrae y una que acompaña.
 *
 * Cada fila va triplicada para que, al desplazarse, nunca se vea el final de
 * la tira. El desplazamiento se aplica escribiendo el `transform` directamente
 * en el elemento y no con estado de React: a sesenta cuadros por segundo,
 * repintar el componente entero en cada movimiento del scroll se nota.
 */
export default function Cinta({ fotos }: { fotos: string[] }) {
  const seccion = useRef<HTMLElement>(null);
  const fila1 = useRef<HTMLDivElement>(null);
  const fila2 = useRef<HTMLDivElement>(null);

  const mitad = Math.ceil(fotos.length / 2);
  const arriba = fotos.slice(0, mitad);
  const abajo = fotos.slice(mitad);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cuadro = 0;
    const mover = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const s = seccion.current;
        if (!s) return;
        const arribaDe = s.getBoundingClientRect().top + window.scrollY;
        const avance = (window.scrollY - arribaDe + window.innerHeight) * 0.3;
        if (fila1.current) fila1.current.style.transform = `translate3d(${avance - 200}px,0,0)`;
        if (fila2.current) fila2.current.style.transform = `translate3d(${-(avance - 200)}px,0,0)`;
      });
    };

    mover();
    window.addEventListener('scroll', mover, { passive: true });
    window.addEventListener('resize', mover, { passive: true });
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('scroll', mover);
      window.removeEventListener('resize', mover);
    };
  }, []);

  const tira = (lista: string[]) =>
    [...lista, ...lista, ...lista].map((src, i) => (
      <Image
        key={`${src}-${i}`}
        src={src}
        alt=""
        width={300}
        height={400}
        sizes="300px"
        className={css.cintaFoto}
      />
    ));

  return (
    <section ref={seccion} className={css.cinta} aria-hidden="true">
      {/* La primera fila sale desplazada a la izquierda para que al moverse
          hacia la derecha no empiece con un hueco vacío. */}
      <div ref={fila1} className={css.cintaFila} style={{ transform: 'translate3d(-200px,0,0)' }}>
        {tira(arriba)}
      </div>
      <div ref={fila2} className={css.cintaFila} style={{ transform: 'translate3d(200px,0,0)' }}>
        {tira(abajo)}
      </div>
    </section>
  );
}
