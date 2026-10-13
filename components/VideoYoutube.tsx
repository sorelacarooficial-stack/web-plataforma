'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
 * La decisión dura lo que la pestaña, en memoria: si en el aula se abre otra
 * clase de YouTube, no se vuelve a preguntar. No se guarda nada en el
 * navegador para recordarlo, que sería justo lo que se intenta evitar.
 *
 * `src` es la dirección de incrustar tal cual (ver lib/youtube.ts). El padre
 * tiene que estar posicionado: la portada y el iframe lo ocupan entero.
 */

let permitido = false;
const avisar = new Set<() => void>();

function permitir() {
  permitido = true;
  avisar.forEach((f) => f());
}

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
  const [cargar, setCargar] = useState(permitido);
  // Lo que ha pulsado ESTA persona en ESTE vídeo arranca solo; los siguientes
  // (otra clase del aula) se cargan ya sin portada pero no se ponen a sonar.
  const [pulsado, setPulsado] = useState(false);

  useEffect(() => {
    const f = () => setCargar(true);
    avisar.add(f);
    return () => {
      avisar.delete(f);
    };
  }, []);

  if (cargar) {
    return (
      <iframe
        src={pulsado ? conArranque(src) : src}
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
        onClick={() => {
          setPulsado(true);
          permitir();
        }}
        aria-label={`Ver el vídeo «${titulo}» en YouTube`}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
        </svg>
      </button>
      <p className={css.texto}>
        Este vídeo está en YouTube. Al darle al play se conecta con Google, que puede guardar datos en tu
        navegador.{' '}
        <Link href="/legal/cookies" target="_blank" className={css.enlace}>
          Más información
        </Link>
      </p>
    </div>
  );
}
