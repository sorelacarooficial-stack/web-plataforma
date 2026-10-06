'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import css from './landing.module.css';

/**
 * El bloque del vídeo, que crece hasta ocupar la pantalla al bajar.
 *
 * Empieza como una tarjeta redondeada al 80 % del ancho y, según se baja,
 * se abre hasta el borde y pierde las esquinas: el vídeo «se acerca». Es la
 * forma de decir sin palabras que esto es lo importante de la página.
 */
export default function VideoEscala({ children }: { children: ReactNode }) {
  const zona = useRef<HTMLDivElement>(null);
  const quieto = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: zona, offset: ['start end', 'center center'] });

  const escala = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const radio = useTransform(scrollYProgress, [0, 1], [48, 20]);

  return (
    <div ref={zona} className={css.videoZona}>
      <motion.div
        className={css.videoCaja}
        style={quieto ? undefined : { scale: escala, borderRadius: radio }}
      >
        {children}
      </motion.div>
    </div>
  );
}
