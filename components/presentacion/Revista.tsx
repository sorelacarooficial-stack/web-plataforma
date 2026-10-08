'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import css from './revista.module.css';

/**
 * El reportaje de Nueva Estética, como una revista que se hojea.
 *
 * En ordenador se ve a doble página, como abierta sobre la mesa, y la hoja
 * gira sobre el lomo al pasar. En el móvil no caben dos páginas legibles, así
 * que va una a una y se pasa con el dedo.
 *
 * CÓMO SE PASA UNA HOJA (ordenador). Debajo se pinta ya la doble página de
 * destino a medias: hacia delante, la izquierda que se ve sigue siendo la de
 * ahora y la derecha ya es la nueva. Encima gira una hoja suelta que lleva por
 * delante la página que se va y por detrás la que llega. Cuando termina el
 * giro, la hoja desaparece y debajo ya está la doble página nueva entera. Así
 * nunca hay un fotograma en el que falte una página.
 *
 * Tocar una página la abre en grande para leerla, con zoom.
 */

const PAGINAS = [1, 2, 3, 4, 5, 6].map((n) => `/presentacion/revista/pagina-${n}.webp`);
/** Medidas reales del corte de la revista, en píxeles del render. */
const ANCHO = 1405;
const ALTO = 1874;
const DOBLES = PAGINAS.length / 2;

type Giro = { hacia: 1 | -1; desde: number };

function useMovil() {
  const [movil, setMovil] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const cambiar = () => setMovil(mq.matches);
    cambiar();
    mq.addEventListener('change', cambiar);
    return () => mq.removeEventListener('change', cambiar);
  }, []);
  return movil;
}

function Pagina({
  n,
  onAbrir,
  cerca,
}: {
  n: number;
  onAbrir?: (n: number) => void;
  cerca?: boolean;
}) {
  const img = (
    <Image
      src={PAGINAS[n]}
      alt={`Página ${n + 1} del reportaje de Nueva Estética sobre la Técnica Divine`}
      width={ANCHO}
      height={ALTO}
      className={css.img}
      sizes="(max-width: 760px) 92vw, 560px"
      loading={cerca ? 'eager' : 'lazy'}
      draggable={false}
    />
  );
  if (!onAbrir) return img;
  return (
    <button
      type="button"
      className={css.paginaBoton}
      onClick={() => onAbrir(n)}
      aria-label={`Leer la página ${n + 1} en grande`}
    >
      {img}
    </button>
  );
}

export default function Revista() {
  const movil = useMovil();
  const quieto = useReducedMotion();
  const [doble, setDoble] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [giro, setGiro] = useState<Giro | null>(null);
  const [sentido, setSentido] = useState<1 | -1>(1);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [ampliada, setAmpliada] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  /* La página que manda en cada modo, para no perder el sitio al girar el
     móvil o estrechar la ventana. */
  const actual = movil ? pagina : doble * 2;
  const total = movil ? PAGINAS.length : DOBLES;
  const posicion = movil ? pagina : doble;

  const pasar = useCallback(
    (hacia: 1 | -1) => {
      if (movil) {
        setSentido(hacia);
        setPagina((p) => Math.min(PAGINAS.length - 1, Math.max(0, p + hacia)));
        return;
      }
      if (giro) return;
      const destino = doble + hacia;
      if (destino < 0 || destino >= DOBLES) return;
      if (quieto) {
        setDoble(destino);
        return;
      }
      setGiro({ hacia, desde: doble });
    },
    [movil, giro, doble, quieto]
  );

  const ir = useCallback(
    (n: number) => {
      if (movil) {
        setSentido(n > pagina ? 1 : -1);
        setPagina(n);
      } else {
        const d = Math.floor(n / 2);
        if (d === doble || giro) return;
        if (Math.abs(d - doble) === 1 && !quieto) setGiro({ hacia: d > doble ? 1 : -1, desde: doble });
        else setDoble(d);
      }
    },
    [movil, pagina, doble, giro, quieto]
  );

  /* Al cambiar de modo se conserva la página en la que se estaba. */
  useEffect(() => {
    if (movil) setPagina(doble * 2);
    else setDoble(Math.floor(pagina / 2));
    // Solo al cambiar de modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movil]);

  const terminarGiro = () => {
    if (!giro) return;
    setDoble(giro.desde + giro.hacia);
    setGiro(null);
  };

  const arrastre = (_: unknown, info: PanInfo) => {
    const umbral = 50;
    if (info.offset.x < -umbral || info.velocity.x < -400) pasar(1);
    else if (info.offset.x > umbral || info.velocity.x > 400) pasar(-1);
  };

  /* Visor a pantalla completa: teclado y bloqueo del fondo. */
  useEffect(() => {
    if (abierta === null) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null);
      if (e.key === 'ArrowRight') setAbierta((a) => (a === null ? a : Math.min(PAGINAS.length - 1, a + 1)));
      if (e.key === 'ArrowLeft') setAbierta((a) => (a === null ? a : Math.max(0, a - 1)));
    };
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [abierta]);

  useEffect(() => setAmpliada(false), [abierta]);

  /* Lo que se pinta debajo mientras gira una hoja. */
  const base = giro
    ? giro.hacia === 1
      ? { izq: giro.desde * 2, der: (giro.desde + 1) * 2 + 1 }
      : { izq: (giro.desde - 1) * 2, der: giro.desde * 2 + 1 }
    : { izq: doble * 2, der: doble * 2 + 1 };

  const hoja = giro
    ? giro.hacia === 1
      ? { delante: giro.desde * 2 + 1, detras: (giro.desde + 1) * 2 }
      : { delante: giro.desde * 2, detras: (giro.desde - 1) * 2 + 1 }
    : null;

  const cerca = (n: number) => Math.abs(n - actual) <= 3;

  return (
    <div
      ref={raiz}
      className={css.revista}
      tabIndex={0}
      role="region"
      aria-roledescription="revista"
      aria-label="Reportaje de Nueva Estética"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') pasar(1);
        if (e.key === 'ArrowLeft') pasar(-1);
      }}
    >
      <div className={css.escenario}>
        {movil ? (
          <div className={css.una}>
            <motion.div
              key={pagina}
              className={css.hojaMovil}
              custom={sentido}
              initial={quieto ? false : { opacity: 0, x: sentido * 60, rotateY: sentido * -18 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.35}
              onDragEnd={arrastre}
            >
              <Pagina n={pagina} onAbrir={setAbierta} cerca />
            </motion.div>
            {PAGINAS.map((_, n) =>
              Math.abs(n - pagina) === 1 ? (
                <div key={n} className={css.precarga} aria-hidden="true">
                  <Pagina n={n} cerca />
                </div>
              ) : null
            )}
          </div>
        ) : (
          <motion.div className={css.libro} onPanEnd={arrastre}>
            <div className={`${css.cara} ${css.izq}`}>
              <Pagina n={base.izq} onAbrir={setAbierta} cerca={cerca(base.izq)} />
              <span className={css.sombraLomoIzq} aria-hidden="true" />
            </div>
            <div className={`${css.cara} ${css.der}`}>
              <Pagina n={base.der} onAbrir={setAbierta} cerca={cerca(base.der)} />
              <span className={css.sombraLomoDer} aria-hidden="true" />
            </div>

            {giro && hoja && (
              <motion.div
                className={`${css.hoja} ${giro.hacia === 1 ? css.hojaDer : css.hojaIzq}`}
                initial={{ rotateY: 0 }}
                animate={{ rotateY: giro.hacia === 1 ? -180 : 180 }}
                transition={{ duration: 0.9, ease: [0.45, 0.05, 0.25, 1] }}
                onAnimationComplete={terminarGiro}
              >
                <div className={css.frente}>
                  <Pagina n={hoja.delante} cerca />
                  <motion.span
                    className={css.brillo}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.55, 0] }}
                    transition={{ duration: 0.9 }}
                  />
                </div>
                <div className={css.dorso}>
                  <Pagina n={hoja.detras} cerca />
                  <motion.span
                    className={css.brillo}
                    initial={{ opacity: 0.55 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.9 }}
                  />
                </div>
              </motion.div>
            )}

            {/* Las esquinas: donde la mano va a pasar la hoja. */}
            {doble < DOBLES - 1 && !giro && (
              <button type="button" className={`${css.esquina} ${css.esquinaDer}`} onClick={() => pasar(1)} aria-label="Pasar página" />
            )}
            {doble > 0 && !giro && (
              <button type="button" className={`${css.esquina} ${css.esquinaIzq}`} onClick={() => pasar(-1)} aria-label="Volver a la página anterior" />
            )}
          </motion.div>
        )}
      </div>

      <div className={css.mandos}>
        <button
          type="button"
          className={css.flecha}
          onClick={() => pasar(-1)}
          disabled={posicion === 0 || !!giro}
          aria-label="Anterior"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <ol className={css.miniaturas}>
          {PAGINAS.map((src, n) => {
            const activa = movil ? n === pagina : Math.floor(n / 2) === doble;
            return (
              <li key={src}>
                <button
                  type="button"
                  className={`${css.mini} ${activa ? css.miniActiva : ''}`}
                  onClick={() => ir(n)}
                  aria-label={`Ir a la página ${n + 1}`}
                  aria-current={activa ? 'page' : undefined}
                >
                  <Image src={src} alt="" width={ANCHO} height={ALTO} sizes="44px" className={css.miniImg} />
                </button>
              </li>
            );
          })}
        </ol>

        <span className={css.cuenta} aria-live="polite">
          {movil ? `${pagina + 1} / ${PAGINAS.length}` : `${doble * 2 + 1}–${doble * 2 + 2} / ${PAGINAS.length}`}
        </span>

        <button
          type="button"
          className={css.flecha}
          onClick={() => pasar(1)}
          disabled={posicion === total - 1 || !!giro}
          aria-label="Siguiente"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {abierta !== null && (
        <div className={css.visor} role="dialog" aria-modal="true" aria-label={`Página ${abierta + 1} ampliada`}>
          <button type="button" className={css.fondo} onClick={() => setAbierta(null)} aria-label="Cerrar" />
          <div className={`${css.lienzo} ${ampliada ? css.lienzoAmpliado : ''}`}>
            <button
              type="button"
              className={css.paginaGrande}
              onClick={() => setAmpliada((a) => !a)}
              aria-label={ampliada ? 'Reducir' : 'Ampliar para leer'}
            >
              <Image
                src={PAGINAS[abierta]}
                alt={`Página ${abierta + 1} del reportaje`}
                width={ANCHO}
                height={ALTO}
                sizes={ampliada ? '200vw' : '100vw'}
                className={css.imgGrande}
                priority
              />
            </button>
          </div>
          <div className={css.mandosVisor}>
            <button type="button" className={css.flecha} onClick={() => setAbierta(Math.max(0, abierta - 1))} disabled={abierta === 0} aria-label="Anterior">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className={css.cuenta}>{abierta + 1} / {PAGINAS.length}</span>
            <button type="button" className={css.flecha} onClick={() => setAbierta(Math.min(PAGINAS.length - 1, abierta + 1))} disabled={abierta === PAGINAS.length - 1} aria-label="Siguiente">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <button type="button" className={css.cerrar} onClick={() => setAbierta(null)} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
