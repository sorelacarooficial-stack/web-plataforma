'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Icono } from './IconosDivine';
import rc from './recorrido.module.css';
import s from './sobre.module.css';

/**
 * «Sobre esto», en el menú: Sorela se presenta y da las gracias.
 *
 * Un enlace pequeño bajo «Ver el recorrido» que abre una carta corta, con su
 * foto. No explica cómo se usa nada (para eso está el recorrido) ni cuenta
 * qué hay dentro de la Comunidad (eso se presenta en la masterclass): es un
 * gracias, y lo que esta plataforma quiere ser.
 *
 * Mientras no la ha abierto nunca, un punto dorado al lado. Se recuerda en
 * este navegador; si no se puede guardar, el punto se queda y no pasa nada.
 */

const CLAVE = 'divine:sobre-visto';

export default function SobreEsto({ alAbrir }: { alAbrir?: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [visto, setVisto] = useState(true);

  useEffect(() => {
    try {
      setVisto(localStorage.getItem(CLAVE) === '1');
    } catch {
      setVisto(false);
    }
  }, []);

  const abrir = () => {
    alAbrir?.();
    dialogo.current?.showModal();
    setVisto(true);
    try {
      localStorage.setItem(CLAVE, '1');
    } catch {
      /* Sin almacenamiento: el punto vuelve a salir la próxima vez, sin más. */
    }
  };

  const cerrar = () => dialogo.current?.close();

  return (
    <>
      <button type="button" className={rc.verRecorrido} onClick={abrir}>
        <Icono nombre="meGusta" size={18} />
        Sobre esto
        {!visto && (
          <>
            <span className={s.punto} aria-hidden="true" />
            <span className="sr-only"> (sin leer)</span>
          </>
        )}
      </button>

      {/* Con <dialog> el foco queda dentro, Escape lo cierra y el fondo no se
          puede tocar mientras está abierta. Un clic fuera de la carta, también. */}
      <dialog
        ref={dialogo}
        className={s.dialogo}
        aria-labelledby="sobre-titulo"
        onClick={(e) => e.target === e.currentTarget && cerrar()}
      >
        <article className={s.carta}>
          <button type="button" className={s.cerrar} onClick={cerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div className={s.cabeza}>
            <span className={s.foto}>
              <Image src="/alumnas/sorela.webp" alt="Sorela Caro" width={84} height={84} />
            </span>
            <p className={s.rotulo}>Un mensaje de Sorela</p>
            <h2 id="sobre-titulo" className={s.titulo}>
              Hola, soy Sorela.
            </h2>
          </div>

          {/* El texto lo eligió el usuario («Bienvenida a casa»). La plataforma es
              nueva y Sorela la presenta: es un estreno, no se cuenta como si
              tuviera historia detrás. */}
          <div className={s.texto}>
            <p>
              Gracias por estar aquí desde el principio. Este espacio es nuevo y lo he creado pensando en ti, para
              que lo que aprendes no se quede en un fin de semana y te acompañe cada día.
            </p>
            <p>Es solo el comienzo: irá creciendo contigo, con tus dudas y con lo que necesites.</p>
            <p>Bienvenida a casa.</p>
          </div>

          <p className={s.firma}>
            <b>— Sorela</b>
            <span>Creadora de la Técnica Divine</span>
          </p>
        </article>
      </dialog>
    </>
  );
}
