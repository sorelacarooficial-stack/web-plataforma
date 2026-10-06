'use client';

import { useRef, useState } from 'react';
import { COMPARATIVA } from '@/lib/precurso';
import css from './antesdespues.module.css';

/**
 * El comparador de antes y después.
 *
 * Se arrastra para descubrir una foto sobre la otra. Dos fotos puestas una al
 * lado de la otra se comparan mal: el ojo salta de una a otra y pierde la
 * referencia. Superpuestas y con un corte que se mueve, lo que cambia se ve
 * en el mismo sitio.
 *
 * SE PUEDE USAR SIN ARRASTRAR. Debajo hay un control deslizante de verdad, que
 * es lo que mueve el corte: así funciona con el teclado y lo anuncia un lector
 * de pantalla. El arrastre sobre la imagen es un atajo encima de eso, no el
 * único camino.
 *
 * Y lleva su aviso pegado, que no es una fórmula de cortesía: una fotografía
 * de resultado sin esa línea es publicidad que promete lo mismo a todo el
 * mundo.
 */
export default function AntesDespues() {
  const [corte, setCorte] = useState(50);
  const caja = useRef<HTMLDivElement>(null);

  function arrastrar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons === 0 && e.type === 'pointermove') return;
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    setCorte(Math.max(0, Math.min(100, x)));
  }

  return (
    <figure className={css.zona}>
      <div
        ref={caja}
        className={css.marco}
        onPointerDown={arrastrar}
        onPointerMove={arrastrar}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={css.foto} src={COMPARATIVA.antes} alt="Antes del tratamiento" />
        {/* La de después va encima, recortada por la izquierda hasta el corte. */}
        <div className={css.encima} style={{ clipPath: `inset(0 0 0 ${corte}%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={css.foto} src={COMPARATIVA.despues} alt="Después del tratamiento" />
        </div>

        <span className={css.rotuloIzq}>Antes</span>
        <span className={css.rotuloDer}>Después</span>

        <span className={css.linea} style={{ left: `${corte}%` }} aria-hidden="true">
          <span className={css.tirador}>↔</span>
        </span>
      </div>

      <label className={css.mando}>
        <span className={css.mandoTexto}>Mueve para comparar</span>
        <input
          type="range"
          min={0}
          max={100}
          value={corte}
          onChange={(e) => setCorte(Number(e.target.value))}
          aria-label="Comparar antes y después"
        />
      </label>

      <figcaption className={css.aviso}>{COMPARATIVA.aviso}</figcaption>
    </figure>
  );
}
