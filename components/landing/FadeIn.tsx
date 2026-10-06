'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Aparece al entrar en pantalla: se desplaza un poco y se funde.
 *
 * Se anima UNA vez (`once`). Que algo vuelva a desaparecer y a entrar cada vez
 * que se sube y se baja convierte la página en un espectáculo que hay que
 * esperar, en vez de algo que se lee.
 *
 * Con «reducir movimiento» activado en el sistema, solo se funde, sin
 * desplazarse: hay personas a las que el movimiento en pantalla les marea, y
 * el sistema operativo ya nos lo está diciendo.
 */
export default function FadeIn({
  children,
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'li' | 'section' | 'p' | 'span' | 'header' | 'nav';
}) {
  const quieto = useReducedMotion();
  const Elemento = motion[as];

  return (
    <Elemento
      className={className}
      initial={{ opacity: 0, x: quieto ? 0 : x, y: quieto ? 0 : y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '50px', amount: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </Elemento>
  );
}
