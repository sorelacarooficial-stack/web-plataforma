'use client';

import { useEffect, useRef } from 'react';

/** Motas doradas mínimas sobre el hero. Se apagan si el sistema pide menos movimiento. */
export default function Motas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const ctx = c.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const medir = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    window.addEventListener('resize', medir);

    const motas = Array.from({ length: 30 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.8 + Math.random() * 2,
      v: 0.014 + Math.random() * 0.032,
      a: 0.18 + Math.random() * 0.3,
      f: Math.random() * 6.28,
    }));

    let raf = 0;
    const dibujar = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const oscuro =
        document.documentElement.getAttribute('data-tema') === 'oscuro';
      const col = oscuro ? '224,194,142' : '138,106,50';

      for (const m of motas) {
        m.y -= m.v / 100;
        if (m.y < -0.05) {
          m.y = 1.05;
          m.x = Math.random();
        }
        const x = (m.x + Math.sin(t / 5600 + m.f) * 0.014) * w;
        ctx.beginPath();
        ctx.arc(x, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col},${oscuro ? m.a : m.a * 0.6})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(dibujar);
    };
    raf = requestAnimationFrame(dibujar);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', medir);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
