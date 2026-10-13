'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import css from './VideoYoutube.module.css';

/**
 * Un vídeo de YouTube que no se carga hasta que se pide.
 *
 * Incrustar el reproductor, aunque sea el de `youtube-nocookie.com`, ya hace
 * que el navegador se conecte con Google y que YouTube guarde datos en él
 * (almacenamiento local) en cuanto aparece en pantalla, sin que nadie le dé al
 * play. La ley de cookies (art. 22.2 LSSI, y el CEPD en sus Directrices
 * 2/2023) pide permiso para eso, y no es «estrictamente necesario» mientras
 * la persona no haya pedido ver el vídeo.
 *
 * Así que en su lugar va una portada propia, sin nada de Google (ni siquiera
 * la miniatura, que también vendría de sus servidores), que dice qué pasa al
 * pulsar. Pulsar ES pedir el vídeo, sabiendo que viene de YouTube: entonces se
 * monta el reproductor y arranca solo, para que siga siendo un clic.
 *
 * La decisión es de ESE vídeo y nada más. Antes, pulsar uno cargaba todos
 * los de la página y los de cualquier otra pantalla en esa visita, y la
 * política de cookies dice —y tiene que ser verdad— que pulsar es pedir ese
 * vídeo. Tampoco se guarda nada en el navegador para recordarlo, que sería
 * justo lo que se intenta evitar.
 *
 * `src` es la dirección de incrustar tal cual (ver lib/youtube.ts). El padre
 * tiene que estar posicionado: la portada y el iframe lo ocupan entero.
 */

function conArranque(src: string) {
  if (/[?&]autoplay=1/.test(src)) return src;
  return `${src}${src.includes('?') ? '&' : '?'}autoplay=1`;
}

export default function VideoYoutube({
  src,
  titulo,
  allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen; autoplay',
}: {
  src: string;
  titulo: string;
  allow?: string;
}) {
  const [pulsado, setPulsado] = useState(false);
  const marco = useRef<HTMLIFrameElement>(null);

  // Al pulsar, el botón desaparece: sin esto el foco se iba al principio de
  // la página y quien va con teclado o lector perdía su sitio.
  useEffect(() => {
    if (pulsado) marco.current?.focus();
  }, [pulsado]);

  if (pulsado) {
    return (
      <iframe
        ref={marco}
        src={conArranque(src)}
        title={titulo}
        allow={allow}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  return (
    <div className={css.portada}>
      <button
        type="button"
        className={css.play}
        onClick={() => setPulsado(true)}
        aria-label={`${titulo}: verlo en YouTube`}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
        </svg>
      </button>
      <p className={css.texto}>
        Este vídeo está en YouTube. Al darle al play se conecta con Google, que puede guardar datos en tu
        navegador.{' '}
        <Link href="/legal/cookies#videos" target="_blank" className={css.enlace}>
          Más información
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </Link>
      </p>
    </div>
  );
}
