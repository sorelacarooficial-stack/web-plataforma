'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 * En escritorio, una carta de 760 px con su retrato a la izquierda; en el
 * móvil, una hoja que sube desde abajo. Otras pantallas la abren con
 * window.dispatchEvent(new Event('divine:sobre')), como «Ver el recorrido»
 * con 'divine:recorrido': la píldora «Unas palabras de Sorela» de la
 * Comunidad lo usa. En el móvil el cajón del menú está cerrado (e inerte),
 * pero la carta es un <dialog> modal: sale por encima de todo y se puede usar.
 *
 * Mientras no la ha abierto nunca, un punto dorado al lado. Se recuerda en
 * este navegador; si no se puede guardar, el punto se queda y no pasa nada.
 */

const CLAVE = 'divine:sobre-visto';
/** El aviso con el que otra pantalla pide abrir la carta. */
export const ABRIR_SOBRE = 'divine:sobre';

export default function SobreEsto({ alAbrir }: { alAbrir?: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const cerrarBoton = useRef<HTMLButtonElement>(null);
  const lectura = useRef<HTMLDivElement>(null);
  /* alAbrir llega nuevo en cada pintado de Plataforma: se guarda en una ref
     para que abrir no cambie y el escuchador de 'divine:sobre' no se quite y
     se vuelva a poner cada vez. */
  const alAbrirRef = useRef(alAbrir);
  const [visto, setVisto] = useState(true);
  const [hayMas, setHayMas] = useState(false);

  useEffect(() => {
    alAbrirRef.current = alAbrir;
  });

  useEffect(() => {
    try {
      setVisto(localStorage.getItem(CLAVE) === '1');
    } catch {
      setVisto(false);
    }
  }, []);

  /* Si queda texto por debajo, se desvanece abajo y asoma una flecha. */
  const medir = useCallback(() => {
    const t = lectura.current;
    if (t) setHayMas(t.scrollHeight - t.scrollTop - t.clientHeight > 6);
  }, []);

  const abrir = useCallback(() => {
    alAbrirRef.current?.();
    const d = dialogo.current;
    if (!d || d.open) return;
    d.showModal();
    if (lectura.current) lectura.current.scrollTop = 0;
    /* El foco, al botón de cerrar. Sin esto podía caer en el texto
       desplazable (Chrome lo hace enfocable) y pintaba un contorno negro
       rectangular alrededor de la carta redonda. autoFocus de React no sirve
       aquí: no pone el atributo y el <dialog> no lo ve. */
    cerrarBoton.current?.focus();
    requestAnimationFrame(medir);
    setVisto(true);
    try {
      localStorage.setItem(CLAVE, '1');
    } catch {
      /* Sin almacenamiento: el punto vuelve a salir la próxima vez, sin más. */
    }
  }, [medir]);

  useEffect(() => {
    window.addEventListener(ABRIR_SOBRE, abrir);
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener(ABRIR_SOBRE, abrir);
      window.removeEventListener('resize', medir);
    };
  }, [abrir, medir]);

  const cerrar = () => dialogo.current?.close();

  return (
    <>
      <button type="button" className={rc.verRecorrido} onClick={abrir} aria-haspopup="dialog">
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
        <article className={`${s.carta} ${hayMas ? s.hayMas : ''}`}>
          <span className={s.asa} aria-hidden="true" />
          <button ref={cerrarBoton} type="button" className={s.cerrar} onClick={cerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {/* El retrato, solo en escritorio (en el móvil va el círculo de arriba). */}
          <figure className={s.retrato} aria-hidden="true">
            <Image src="/alumnas/sorela.webp" alt="" width={600} height={620} sizes="300px" />
          </figure>

          <div className={s.cuerpo}>
            <div ref={lectura} className={s.lectura} onScroll={medir}>
              <div className={s.cabeza}>
                <span className={s.foto}>
                  <Image src="/alumnas/sorela-cara.webp" alt="Sorela Caro" width={60} height={60} />
                </span>
                <p className={s.rotulo}>Un mensaje de Sorela</p>
              </div>
              <h2 id="sobre-titulo" className={s.titulo}>
                Hola, soy Sorela.
              </h2>

              {/* El texto lo eligió el usuario («Bienvenida a casa»). La plataforma es
                  nueva y Sorela la presenta: es un estreno, no se cuenta como si
                  tuviera historia detrás. */}
              <div className={s.texto}>
                <p>
                  Gracias por estar aquí desde el principio. Este espacio es nuevo y lo he creado pensando en ti, para
                  que lo que aprendes no se quede en un fin de semana y te acompañe cada día.
                </p>
                <p>
                  Siempre he creído que nuestra profesión tiene que atreverse a innovar. Las clientas cambian, lo que
                  necesitan cambia, y nosotras tenemos que ir un paso por delante. Divine nació así, rompiendo con lo de
                  siempre, y este espacio nace con la misma idea: unir el conocimiento de nuestras manos con todo lo que
                  hoy nos permite la tecnología.
                </p>
                <p>
                  Es solo el comienzo: irá creciendo contigo, con tus dudas y con lo que necesites. Gracias por confiar
                  en mí y por querer crecer conmigo.
                </p>
                <p>Bienvenida a casa.</p>
              </div>

              <p className={s.firma}>
                <b>— Sorela</b>
                <span>Creadora de la Técnica Divine</span>
              </p>
            </div>
            <span className={s.desvanece} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </div>
        </article>
      </dialog>
    </>
  );
}
