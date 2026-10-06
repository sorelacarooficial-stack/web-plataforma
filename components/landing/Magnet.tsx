'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Sigue al ratón cuando pasa cerca, como si lo atrajera un imán.
 *
 * Se activa dentro de un margen alrededor del elemento —`margen`—, no solo
 * encima: así el retrato empieza a moverse antes de tocarlo, que es lo que da
 * la sensación de que «mira» al cursor. El desplazamiento es la distancia al
 * centro dividida por `fuerza`: a más fuerza, menos se mueve.
 *
 * En pantallas táctiles no hace nada, porque no hay cursor que seguir: un dedo
 * no «pasa cerca» de nada, toca o no toca.
 */
export default function Magnet({
  children,
  margen = 150,
  fuerza = 3,
  className,
}: {
  children: ReactNode;
  margen?: number;
  fuerza?: number;
  className?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cuadro = 0;
    const mover = (e: MouseEvent) => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const el = caja.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dentro =
          e.clientX > r.left - margen &&
          e.clientX < r.right + margen &&
          e.clientY > r.top - margen &&
          e.clientY < r.bottom + margen;

        if (dentro) {
          setActivo(true);
          setPos({
            x: (e.clientX - (r.left + r.width / 2)) / fuerza,
            y: (e.clientY - (r.top + r.height / 2)) / fuerza,
          });
        } else {
          setActivo(false);
          setPos({ x: 0, y: 0 });
        }
      });
    };

    window.addEventListener('mousemove', mover, { passive: true });
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('mousemove', mover);
    };
  }, [margen, fuerza]);

  return (
    <div ref={caja} className={className}>
      <div
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          transition: activo ? 'transform 0.3s ease-out' : 'transform 0.6s ease-in-out',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
