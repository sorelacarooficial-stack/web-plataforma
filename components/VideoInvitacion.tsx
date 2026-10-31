'use client';

import { useRef, useState } from 'react';
import css from './VideoInvitacion.module.css';

/**
 * La invitación de Sorela a la masterclass, en la portada de /comunidad.
 *
 * Sin reproducción automática: es su voz y se escucha con sonido, así que
 * empieza cuando la persona pulsa. Hasta entonces se ve la portada con un
 * botón grande. Medidor.tsx cuenta las reproducciones y hasta dónde se ve
 * (`data-metrica`), sin cookies.
 */
export default function VideoInvitacion() {
  const ref = useRef<HTMLVideoElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false);

  return (
    <figure className={css.marco}>
      <video
        ref={ref}
        className={css.video}
        src="/video/sorela-invitacion.mp4"
        poster="/video/sorela-invitacion.jpg"
        preload="metadata"
        playsInline
        controls={reproduciendo}
        data-metrica="Invitación de Sorela · masterclass"
        onPlay={() => setReproduciendo(true)}
      />
      {!reproduciendo && (
        <button
          type="button"
          className={css.play}
          onClick={() => {
            setReproduciendo(true);
            ref.current?.play().catch(() => null);
          }}
          aria-label="Ver la invitación de Sorela, 54 segundos"
        >
          <span className={css.icono} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
          </span>
          <span className={css.texto}>
            <b>Te lo cuento yo</b>
            <span>Sorela · 54 s</span>
          </span>
        </button>
      )}
    </figure>
  );
}
