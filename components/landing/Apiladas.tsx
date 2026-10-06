'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import css from './landing.module.css';

/**
 * Tarjetas que se apilan unas sobre otras al hacer scroll.
 *
 * Cada una se queda pegada arriba (`sticky`) mientras la siguiente sube y la
 * tapa, y al quedar debajo encoge un poco. La última no encoge: es la que se
 * queda delante. El resultado es un mazo de cartas que se va formando con el
 * dedo, en vez de tres bloques uno detrás de otro.
 */
export default function Apiladas({
  tarjetas,
  claseTarjeta,
}: {
  tarjetas: ReactNode[];
  /** Una clase más para cada tarjeta: la web le da relieve; las landings no la usan. */
  claseTarjeta?: string;
}) {
  const zona = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: zona, offset: ['start start', 'end end'] });

  return (
    <div ref={zona} className={css.apiladas}>
      {tarjetas.map((t, i) => {
        const final = 1 - (tarjetas.length - 1 - i) * 0.03;
        return (
          <Tarjeta
            key={i}
            indice={i}
            total={tarjetas.length}
            escalaFinal={final}
            progreso={scrollYProgress}
            clase={claseTarjeta}
          >
            {t}
          </Tarjeta>
        );
      })}
    </div>
  );
}

function Tarjeta({
  children,
  indice,
  total,
  escalaFinal,
  progreso,
  clase,
}: {
  children: ReactNode;
  clase?: string;
  indice: number;
  total: number;
  escalaFinal: number;
  progreso: ReturnType<typeof useScroll>['scrollYProgress'];
}) {
  /* Encoge desde que le toca quedarse pegada hasta el final de la zona. */
  const escala = useTransform(progreso, [indice / total, 1], [1, escalaFinal]);

  return (
    <div className={css.apiladaHueco}>
      <motion.div
        className={clase ? `${css.apilada} ${clase}` : css.apilada}
        style={{ scale: escala, top: `calc(var(--apilada-top) + ${indice * 28}px)` }}
      >
        {children}
      </motion.div>
    </div>
  );
}
