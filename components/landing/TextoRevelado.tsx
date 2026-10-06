'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useRef } from 'react';

/**
 * Un párrafo que se «enciende» letra a letra según se baja.
 *
 * Cada letra va de casi apagada (0,2) a encendida (1) según su posición en el
 * texto y lo que se ha avanzado por la página. El efecto obliga a leer al
 * ritmo del scroll, que es justo lo que se quiere en un párrafo de presentación.
 *
 * LAS PALABRAS NO SE PARTEN. Cada palabra va en su propia caja que no se rompe,
 * y las letras van dentro. Con letras sueltas, el navegador podría cortar una
 * palabra a mitad al final de la línea, que es lo primero que se nota.
 *
 * Para un lector de pantalla el párrafo es el texto entero, de una vez: las
 * letras sueltas van ocultas y el párrafo lleva el texto completo como nombre.
 * Leer letra a letra sería insufrible.
 */
export default function TextoRevelado({ texto, className }: { texto: string; className?: string }) {
  const parrafo = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: parrafo, offset: ['start 0.8', 'end 0.2'] });

  const palabras = texto.split(' ');
  const total = texto.length;
  let indice = 0;

  return (
    <p ref={parrafo} className={className} aria-label={texto}>
      {palabras.map((palabra, p) => {
        const inicio = indice;
        indice += palabra.length + 1;
        return (
          <span key={p} aria-hidden="true" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            {palabra.split('').map((letra, l) => (
              <Letra
                key={l}
                letra={letra}
                progreso={scrollYProgress}
                desde={(inicio + l) / total}
                hasta={(inicio + l + 1) / total}
              />
            ))}
            {p < palabras.length - 1 && ' '}
          </span>
        );
      })}
    </p>
  );
}

function Letra({
  letra,
  progreso,
  desde,
  hasta,
}: {
  letra: string;
  progreso: MotionValue<number>;
  desde: number;
  hasta: number;
}) {
  const opacidad = useTransform(progreso, [desde, hasta], [0.2, 1]);
  return (
    <span style={{ position: 'relative' }}>
      {/* El hueco lo ocupa una copia invisible; la animada va encima. Así el
          ancho de cada letra no depende de la animación y nada baila. */}
      <span style={{ opacity: 0 }}>{letra}</span>
      <motion.span style={{ position: 'absolute', left: 0, top: 0, opacity: opacidad }}>
        {letra}
      </motion.span>
    </span>
  );
}
