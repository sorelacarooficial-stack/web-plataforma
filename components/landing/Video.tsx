'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import css from './video.module.css';

/**
 * El reproductor de la presentación, con controles propios.
 *
 * Los del navegador funcionan, pero son los de cualquier web: una barra gris
 * con iconos blancos que en Chrome, Safari y Firefox se ve distinta en cada
 * uno. Estos llevan la marca —la barra de progreso dorada, el play grande en
 * cristal— y se ven igual en todos.
 *
 * LO QUE NO SE HA PERDIDO AL CAMBIARLOS:
 *   · Teclado: espacio o K para parar y seguir, flechas para saltar cinco
 *     segundos, M para el sonido y F para pantalla completa.
 *   · La barra de progreso es un `input range` de verdad debajo del dibujo:
 *     se arrastra con el dedo, se mueve con el teclado y un lector de
 *     pantalla la anuncia.
 *   · En el iPhone, la pantalla completa usa la del propio sistema, que es la
 *     única que deja.
 *
 * Los controles se esconden solos a los tres segundos mientras se reproduce y
 * vuelven al mover el ratón o tocar: el vídeo es lo que se viene a ver.
 */

function tiempo(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  return `${m}:${String(seg).padStart(2, '0')}`;
}

export default function Video({ src, cartel }: { src: string; cartel?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const reloj = useRef<number>(0);

  const [sonando, setSonando] = useState(false);
  const [empezado, setEmpezado] = useState(false);
  const [actual, setActual] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [cargado, setCargado] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [volumen, setVolumen] = useState(1);
  const [visibles, setVisibles] = useState(true);
  const [completa, setCompleta] = useState(false);

  /* Enseña los controles y, si está sonando, los vuelve a esconder en 3 s. */
  const despertar = useCallback(() => {
    setVisibles(true);
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => {
      if (video.current && !video.current.paused) setVisibles(false);
    }, 3000);
  }, []);

  useEffect(() => () => window.clearTimeout(reloj.current), []);

  /*
   * La duración, también si ya estaba cargada al llegar.
   *
   * El `<video>` viene ya escrito en el HTML del servidor, así que el
   * navegador empieza a leer el archivo antes de que React esté escuchando.
   * Si los datos llegan en ese hueco, el aviso de «ya sé lo que dura» se
   * pierde, la barra cree que el vídeo dura cero segundos y no deja saltar.
   * Se mira al montar por si ya está, y además se escucha cualquier cambio.
   */
  useEffect(() => {
    const v = video.current;
    if (v && v.readyState >= 1 && Number.isFinite(v.duration)) setDuracion(v.duration);
  }, []);

  useEffect(() => {
    const alCambiar = () => setCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const alternar = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setEmpezado(true);
      if (Number.isFinite(v.duration)) setDuracion(v.duration);
    } else {
      v.pause();
    }
    despertar();
  }, [despertar]);

  const saltar = useCallback((seg: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + seg), v.duration || 0);
  }, []);

  const alternarSonido = useCallback(() => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMudo(v.muted);
  }, []);

  const pantallaCompleta = useCallback(() => {
    const c = caja.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!c || !v) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (c.requestFullscreen) {
      void c.requestFullscreen();
    } else if (c.webkitRequestFullscreen) {
      c.webkitRequestFullscreen();
    } else if (v.webkitEnterFullscreen) {
      /* El iPhone no deja poner en pantalla completa nada que no sea el
         propio vídeo, y entonces con sus controles. Es eso o nada. */
      v.webkitEnterFullscreen();
    }
  }, []);

  function tecla(e: React.KeyboardEvent) {
    /* Si el foco está en un botón o en una barra, ellos ya saben qué hacer
       con el espacio y las flechas: atenderlo aquí también lo haría dos
       veces —parar y volver a arrancar con una sola pulsación—. */
    if ((e.target as HTMLElement).closest('button, input')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') {
      e.preventDefault();
      alternar();
    } else if (k === 'arrowright') {
      saltar(5);
      despertar();
    } else if (k === 'arrowleft') {
      saltar(-5);
      despertar();
    } else if (k === 'm') {
      alternarSonido();
    } else if (k === 'f') {
      pantallaCompleta();
    }
  }

  const progreso = duracion ? (actual / duracion) * 100 : 0;
  const buffer = duracion ? (cargado / duracion) * 100 : 0;

  return (
    <div
      ref={caja}
      className={css.caja}
      data-ocultos={!visibles && sonando ? '' : undefined}
      data-completa={completa ? '' : undefined}
      onMouseMove={despertar}
      onTouchStart={despertar}
      onKeyDown={tecla}
      tabIndex={0}
      role="region"
      aria-label="Vídeo de presentación de la Técnica Divine"
    >
      <video
        ref={video}
        className={css.video}
        src={src}
        poster={cartel}
        playsInline
        preload="metadata"
        onClick={alternar}
        onPlay={() => {
          setSonando(true);
          despertar();
        }}
        onPause={() => {
          setSonando(false);
          setVisibles(true);
        }}
        onEnded={() => setVisibles(true)}
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuracion(d);
        }}
        onTimeUpdate={(e) => setActual(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setCargado(b.end(b.length - 1));
        }}
      />

      {/* El play grande del centro: solo cuando está parado. */}
      {!sonando && (
        <button type="button" className={css.grande} onClick={alternar} aria-label={empezado ? 'Seguir viendo' : 'Ver el vídeo'}>
          <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
          {!empezado && duracion > 0 && <span className={css.grandeTiempo}>{tiempo(duracion)}</span>}
        </button>
      )}

      {/* La barra de abajo. */}
      <div className={css.barra} data-empezado={empezado ? '' : undefined}>
        <div className={css.progreso}>
          <div className={css.pista}>
            <span className={css.cargado} style={{ width: `${buffer}%` }} />
            <span className={css.hecho} style={{ width: `${progreso}%` }} />
            <span className={css.bolita} style={{ left: `${progreso}%` }} />
          </div>
          <input
            type="range"
            className={css.rango}
            min={0}
            max={duracion || 0}
            step={0.1}
            value={actual}
            aria-label="Posición del vídeo"
            aria-valuetext={`${tiempo(actual)} de ${tiempo(duracion)}`}
            onChange={(e) => {
              const v = video.current;
              if (v) v.currentTime = Number(e.target.value);
              setActual(Number(e.target.value));
              despertar();
            }}
          />
        </div>

        <div className={css.fila}>
          <button type="button" className={css.boton} onClick={alternar} aria-label={sonando ? 'Pausar' : 'Reproducir'}>
            {sonando ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" />
                <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            )}
          </button>

          <button type="button" className={`${css.boton} ${css.soloAncho}`} onClick={() => saltar(-10)} aria-label="Atrás 10 segundos">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4.5v4h4" strokeLinecap="round" strokeLinejoin="round" />
              <text x="12" y="15.2" fontSize="6.6" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif">10</text>
            </svg>
          </button>

          <span className={css.tiempo}>
            {tiempo(actual)} <span className={css.tiempoTotal}>/ {tiempo(duracion)}</span>
          </span>

          <span className={css.hueco} />

          <div className={css.sonido}>
            <button type="button" className={css.boton} onClick={alternarSonido} aria-label={mudo ? 'Activar sonido' : 'Silenciar'}>
              {mudo || volumen === 0 ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
                  <path d="M16 9.5l5 5M21 9.5l-5 5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
                  <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" strokeLinecap="round" />
                </svg>
              )}
            </button>
            {/* El volumen fino solo en ordenador: en el móvil se usan los
                botones del teléfono, y una barra más no cabe. */}
            <input
              type="range"
              className={css.volumen}
              min={0}
              max={1}
              step={0.05}
              value={mudo ? 0 : volumen}
              aria-label="Volumen"
              onChange={(e) => {
                const v = video.current;
                const n = Number(e.target.value);
                if (v) {
                  v.volume = n;
                  v.muted = n === 0;
                }
                setVolumen(n);
                setMudo(n === 0);
              }}
              style={{ ['--nivel' as string]: `${(mudo ? 0 : volumen) * 100}%` }}
            />
          </div>

          <button
            type="button"
            className={css.boton}
            onClick={pantallaCompleta}
            aria-label={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {completa ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
