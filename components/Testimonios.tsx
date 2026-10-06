'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TESTIMONIOS, type Testimonio, type Video } from '@/lib/contenido';
import { urlDeVideo } from '@/lib/youtube';
import { caratulaDeDrive, urlDeDrive, urlDirectaDeDrive } from '@/lib/drive';
import css from './Testimonios.module.css';

/**
 * Lo que dicen las que ya han pasado por aquí: los vídeos puestos, corriendo
 * en silencio, y se abren con sonido al pararse en uno o al tocarlo.
 *
 * NO SE DESLIZA SOLO. Una fila que se mueve sola obliga a perseguir la
 * tarjeta que quieres mirar. En pantalla ancha están todas a la vez, quietas;
 * en estrecha, en una fila que mueves tú con el dedo o con las flechas.
 *
 * LAS TARJETAS NO CAMBIAN DE TAMAÑO AL ABRIRSE. Antes la abierta crecía un
 * 5 % y, en una fila de cinco, se salía de la línea de las demás: parecía
 * descolocada. Ahora se marca con un filo dorado y una luz, y la fila no se
 * mueve.
 *
 * LOS CONTROLES SON PROPIOS. Los del navegador, en una tarjeta de 220 px,
 * son una barra gris que tapa media cara. Aquí hay una línea dorada de
 * progreso, el tiempo y el sonido, y tocar el vídeo lo para y lo sigue.
 *
 * NINGÚN VÍDEO ENTERO SE BAJA HASTA QUE ALGUIEN LO PIDE. Lo que corre es un
 * bucle de unos segundos, sin sonido y en pequeño. El archivo completo se
 * monta al abrir la tarjeta.
 *
 * Y si no hay ninguno, no se pinta nada: un apartado de testimonios vacío es
 * un cartel diciendo que nadie ha dicho nada.
 */

/** Cuánto dura el bucle mudo antes de volver al principio, en segundos. */
const SEGUNDOS_DE_BUCLE = 6;

/**
 * Un testimonio está listo cuando tiene vídeo y frase.
 *
 * El nombre ya no es obligatorio: hay vídeos de alumnas de las que todavía no
 * se sabe cómo se llaman, y salen con lo que hicieron —«Alumna · Formación»—
 * en vez de esperar o, peor, de inventarles un nombre.
 */
function estaListo(t: Testimonio): boolean {
  return t.frase.trim().length > 0;
}

/** Si el vídeo puede correr dentro de la página o hay que ir al visor de fuera. */
function correSolo(v: Video): boolean {
  return v.tipo === 'archivo' || v.tipo === 'drive';
}

export default function Testimonios() {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [quieto, setQuieto] = useState(false);
  const fila = useRef<HTMLUListElement>(null);
  const [extremos, setExtremos] = useState({ inicio: true, fin: false });
  const [actual, setActual] = useState(0);

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mirar = () => setQuieto(consulta.matches);
    mirar();
    consulta.addEventListener('change', mirar);
    return () => consulta.removeEventListener('change', mirar);
  }, []);

  /* Dónde está la fila: para apagar la flecha que ya no lleva a ningún sitio
     y marcar el punto de la tarjeta que se está viendo. */
  const medir = useCallback(() => {
    const f = fila.current;
    if (!f) return;
    setExtremos({ inicio: f.scrollLeft < 8, fin: f.scrollLeft + f.clientWidth > f.scrollWidth - 8 });
    const celda = f.firstElementChild as HTMLElement | null;
    if (celda) setActual(Math.round(f.scrollLeft / (celda.offsetWidth + 16)));
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [medir]);

  const mover = (sentido: 1 | -1) => {
    const f = fila.current;
    const celda = f?.firstElementChild as HTMLElement | null;
    if (!f || !celda) return;
    f.scrollBy({ left: sentido * (celda.offsetWidth + 16), behavior: quieto ? 'auto' : 'smooth' });
  };

  const listos = TESTIMONIOS.filter(estaListo);
  if (listos.length === 0) return null;

  const hayMasDeLasQueCaben = !(extremos.inicio && extremos.fin);

  return (
    <section className={css.zona} aria-label="Lo que dicen de la Técnica Divine">
      <div className="wrap">
        <div className={css.cabeza}>
          <div className={css.cabezaTexto}>
            <p className={css.antetitulo}>Lo que dicen</p>
            <h2 className={css.titulo}>
              Se lo pregunté <em>a ellas.</em>
            </h2>
            <p className={css.entradilla}>
              Sin guion y sin repetir la toma. Pasa por encima o toca una, y te lo cuenta con su voz.
            </p>
          </div>

          {/* Las flechas solo cuando hay más tarjetas de las que caben. Con
              todas a la vista, dos botones que no mueven nada confunden. */}
          {hayMasDeLasQueCaben && (
            <div className={css.flechas}>
              <button type="button" className={css.flecha} onClick={() => mover(-1)} disabled={extremos.inicio} aria-label="Anterior">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className={css.flecha} onClick={() => mover(1)} disabled={extremos.fin} aria-label="Siguiente">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <ul
          ref={fila}
          className={css.lista}
          data-cuantos={listos.length}
          onScroll={medir}
          /* Al sacar el ratón de la fila entera se cierra lo que hubiera
             abierto: si no, el vídeo se queda sonando mientras sigues bajando. */
          onPointerLeave={() => setAbierto(null)}
        >
          {listos.map((t, i) => (
            <li key={`${t.video.tipo}-${i}`} className={css.celda}>
              <Tarjeta
                testimonio={t}
                abierto={abierto === i}
                quieto={quieto}
                onAbrir={() => setAbierto(i)}
                onCerrar={() => setAbierto((a) => (a === i ? null : a))}
              />
            </li>
          ))}
        </ul>

        {hayMasDeLasQueCaben && (
          <div className={css.puntos} aria-hidden="true">
            {listos.map((_, i) => (
              <span key={i} className={css.punto} data-activo={i === actual ? '' : undefined} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Tarjeta({
  testimonio: { nombre, frase, lugar, de, video },
  abierto,
  quieto,
  onAbrir,
  onCerrar,
}: {
  testimonio: Testimonio;
  abierto: boolean;
  quieto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const quien = nombre.trim();
  const pie = [de, lugar].filter(Boolean).join(' · ');
  /* Sin nombre, lo que hizo pasa a ser el titular de la tarjeta. */
  const titular = quien || pie || 'Alumna Divine';
  const subtitulo = quien ? pie : '';

  const [roto, setRoto] = useState(false);
  const enVivo = correSolo(video) && !quieto && !roto;

  return (
    <figure className={css.tarjeta}>
      <div
        className={css.marco}
        data-abierto={abierto ? '' : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') onAbrir();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') onCerrar();
        }}
      >
        <span className={css.respaldo} aria-hidden="true">
          “
        </span>

        {enVivo ? (
          <Bucle video={video} abierto={abierto} alFallar={() => setRoto(true)} />
        ) : abierto && !correSolo(video) ? (
          <Externo video={video} titular={titular} />
        ) : (
          <Caratula video={video} />
        )}

        {!abierto && (
          <>
            <span className={css.velo} aria-hidden="true" />
            {/* Un altavoz tachado arriba: dice, sin palabras, que esto suena
                y que ahora mismo está en silencio. */}
            {enVivo && (
              <span className={css.mudo} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
                  <path d="M16 9.5l5 5M21 9.5l-5 5" strokeLinecap="round" />
                </svg>
              </span>
            )}
            <span className={css.rotulo}>
              <span className={css.nombre}>{titular}</span>
              {subtitulo && <span className={css.detalle}>{subtitulo}</span>}
            </span>
          </>
        )}

        {!enVivo && !abierto && (
          <span className={css.play} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="21" height="21">
              <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
            </svg>
          </span>
        )}

        {!abierto && (
          <button
            type="button"
            className={css.tocar}
            onClick={onAbrir}
            onFocus={onAbrir}
            aria-label={`Ver y oír el vídeo de ${titular}`}
          />
        )}
      </div>

      <figcaption className={css.pie}>
        <span className={css.comillas} aria-hidden="true">
          “
        </span>
        <blockquote className={css.frase}>{frase}</blockquote>
      </figcaption>
    </figure>
  );
}

function tiempo(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * El vídeo que corre en silencio dentro de la tarjeta.
 *
 * Mudo, sin controles y dando vueltas a sus primeros segundos mientras está a
 * la vista. Al abrirse: vuelve al principio, se le quita el silencio y salen
 * los controles propios.
 */
function Bucle({
  video,
  abierto,
  alFallar,
}: {
  video: Video;
  abierto: boolean;
  alFallar: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [alaVista, setAlaVista] = useState(false);
  const [parado, setParado] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [segundos, setSegundos] = useState({ actual: 0, total: 0 });

  const bucle = video.tipo === 'archivo' ? video.bucle : undefined;
  const entero =
    video.tipo === 'drive' ? urlDirectaDeDrive(video.id) : video.tipo === 'archivo' ? video.src : '';
  const src = abierto ? entero : (bucle ?? entero);
  const poster = video.tipo === 'drive' ? caratulaDeDrive(video.id) : (video as { poster?: string }).poster;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const vigia = new IntersectionObserver(([e]) => setAlaVista(e.isIntersecting), {
      rootMargin: '200px',
      threshold: 0.01,
    });
    vigia.observe(v);
    return () => vigia.disconnect();
    /* Depende de `src`: al abrirse cambia la etiqueta <video> entera —lleva
       `key`— y el vigía tiene que mirar la nueva, no la vieja ya
       desenganchada, que nunca más sale de la pantalla. */
  }, [src]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!alaVista) {
      v.pause();
      return;
    }
    if (abierto) {
      v.currentTime = 0;
      v.muted = false;
      setMudo(false);
      setParado(false);
    } else {
      v.muted = true;
    }
    v.play().catch(() => {});
  }, [alaVista, abierto]);

  const vigilarElTiempo = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (abierto) {
      setProgreso(v.duration ? v.currentTime / v.duration : 0);
      setSegundos({ actual: v.currentTime, total: v.duration });
      return;
    }
    if (!bucle && v.currentTime > SEGUNDOS_DE_BUCLE) v.currentTime = 0;
  }, [abierto, bucle]);

  const alternar = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setParado(false);
    } else {
      v.pause();
      setParado(true);
    }
  };

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        key={src}
        ref={ref}
        className={css.reproductor}
        src={src}
        poster={poster}
        muted
        playsInline
        loop={!abierto && !!bucle}
        preload="metadata"
        onTimeUpdate={vigilarElTiempo}
        onClick={abierto ? alternar : undefined}
        onError={alFallar}
        onEnded={(e) => {
          e.currentTarget.pause();
          e.currentTarget.currentTime = 0;
          setParado(true);
        }}
      />

      {abierto && (
        <div className={css.mandos}>
          {parado && (
            <button type="button" className={css.seguir} onClick={alternar} aria-label="Seguir viendo">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </button>
          )}
          <div className={css.barraMini}>
            <button type="button" className={css.mini} onClick={alternar} aria-label={parado ? 'Reproducir' : 'Pausar'}>
              {parado ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" />
                  <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" />
                </svg>
              )}
            </button>
            <span className={css.miniTiempo}>
              {tiempo(segundos.actual)} / {tiempo(segundos.total)}
            </span>
            <button
              type="button"
              className={css.mini}
              onClick={() => {
                const v = ref.current;
                if (!v) return;
                v.muted = !v.muted;
                setMudo(v.muted);
              }}
              aria-label={mudo ? 'Activar sonido' : 'Silenciar'}
            >
              {mudo ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
                  <path d="M16 9.5l5 5M21 9.5l-5 5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
                  <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
          {/* La línea dorada: cuánto va. Abajo del todo y a todo lo ancho. */}
          <span className={css.linea} style={{ transform: `scaleX(${progreso})` }} aria-hidden="true" />
        </div>
      )}
    </>
  );
}

/**
 * La imagen de antes de pulsar, para cuando no hay bucle: en YouTube, con el
 * movimiento desactivado, o si el archivo ha fallado.
 */
function Caratula({ video }: { video: Video }) {
  const src =
    video.tipo === 'youtube'
      ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
      : video.tipo === 'drive'
        ? caratulaDeDrive(video.id)
        : video.poster;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={css.imagen}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
    />
  );
}

/** El marco de fuera: YouTube, o el visor de Drive cuando el archivo ha fallado. */
function Externo({ video, titular }: { video: Video; titular: string }) {
  if (video.tipo === 'archivo') return null;

  return (
    <iframe
      className={css.reproductor}
      src={video.tipo === 'youtube' ? urlDeVideo(video.id, { arrancar: true }) : urlDeDrive(video.id)}
      title={`Testimonio de ${titular}`}
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
