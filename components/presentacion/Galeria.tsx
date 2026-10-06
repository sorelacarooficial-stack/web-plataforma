'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import css from './galeria.module.css';

/**
 * Una rejilla de fotos que se abren a pantalla completa al tocarlas.
 *
 * NO SE MUEVE SOLA, y es deliberado. Un carrusel que avanza por su cuenta
 * decide por quien mira: le quita la foto de delante justo cuando se había
 * parado en ella, y en un móvil pelea con el dedo. Aquí están todas a la vez y
 * el que manda es quien mira.
 *
 * Cada foto es un botón de verdad y no un `div` con un `onClick`: así se llega
 * con el tabulador, se abre con la barra espaciadora y un lector de pantalla
 * anuncia que hay algo que tocar.
 */
export default function Galeria({
  fotos,
  alto,
  columnas = 3,
}: {
  fotos: string[];
  /** Fotos verticales de cuerpo entero, que necesitan más alto que ancho. */
  alto?: boolean;
  columnas?: 2 | 3;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);

  const cerrar = useCallback(() => setAbierta(null), []);

  const mover = useCallback(
    (paso: number) =>
      setAbierta((i) => (i === null ? null : (i + paso + fotos.length) % fotos.length)),
    [fotos.length]
  );

  useEffect(() => {
    if (abierta === null) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [abierta, cerrar, mover]);

  return (
    <>
      <ul className={css.rejilla} data-columnas={columnas} data-alto={alto ? '' : undefined}>
        {fotos.map((src, i) => (
          <li key={src} className={css.celda}>
            <button
              type="button"
              className={css.boton}
              onClick={() => setAbierta(i)}
              aria-label={`Ampliar la imagen ${i + 1} de ${fotos.length}`}
            >
              <Image
                src={src}
                alt=""
                width={900}
                height={alto ? 1200 : 700}
                className={css.foto}
                sizes="(max-width: 700px) 50vw, 33vw"
              />
              <span className={css.lupa} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M16.5 16.5 21 21" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {abierta !== null && (
        <div className={css.visor} role="dialog" aria-modal="true" aria-label="Imagen ampliada">
          {/* El fondo cierra. Es lo que todo el mundo intenta primero. */}
          <button type="button" className={css.fondo} onClick={cerrar} aria-label="Cerrar" />

          <figure className={css.marco}>
            <Image
              src={fotos[abierta]}
              alt=""
              width={1200}
              height={1600}
              className={css.grande}
              sizes="100vw"
              priority
            />
          </figure>

          <div className={css.mandos}>
            <button type="button" className={css.flecha} onClick={() => mover(-1)} aria-label="Anterior">
              ‹
            </button>
            <span className={css.cuenta}>
              {abierta + 1} / {fotos.length}
            </span>
            <button type="button" className={css.flecha} onClick={() => mover(1)} aria-label="Siguiente">
              ›
            </button>
          </div>

          <button type="button" className={css.cerrar} onClick={cerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}
    </>
  );
}
