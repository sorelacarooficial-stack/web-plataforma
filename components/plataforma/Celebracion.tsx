'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LOGROS } from '@/lib/logros-tipos';
import l from './logros.module.css';

/**
 * La celebración: cuando se gana un logro, sale en grande con confeti.
 *
 * Mira al entrar y cada vez que alguien avisa con el evento `divine:logros`
 * (al terminar una clase, al publicar o responder en la comunidad). Cada logro
 * se celebra una sola vez: el servidor lo apunta al devolverlo como nuevo.
 */
export default function Celebracion() {
  const [cola, setCola] = useState<string[]>([]);
  const [montado, setMontado] = useState(false);
  const pidiendo = useRef(false);

  const mirar = useCallback(async () => {
    if (pidiendo.current) return;
    pidiendo.current = true;
    try {
      const j = await (await fetch('/api/logros?celebrar=1')).json();
      if (j.ok && j.nuevos?.length) setCola((c) => [...c, ...j.nuevos.filter((n: string) => !c.includes(n))]);
    } catch {
      /* sin red, ya celebrará la próxima vez */
    } finally {
      pidiendo.current = false;
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    const t = setTimeout(mirar, 1500);
    const alAvisar = () => setTimeout(mirar, 400);
    window.addEventListener('divine:logros', alAvisar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('divine:logros', alAvisar);
    };
  }, [mirar]);

  const actual = LOGROS.find((x) => x.id === cola[0]);
  if (!montado) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {actual && (
        <motion.div key={actual.id} className={l.celebracion} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCola((c) => c.slice(1))}>
          <Confeti />
          <motion.div
            className={l.tarjetaLogro}
            role="dialog"
            aria-label={`Logro conseguido: ${actual.nombre}`}
            initial={{ scale: 0.6, y: 40, rotate: -4 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={l.medalla}>{actual.icono}</span>
            <span className={l.etiqueta}>¡Logro conseguido!</span>
            <h3>{actual.nombre}</h3>
            <p>{actual.texto}</p>
            {actual.id === 'curso-completo' && (
              <a className={l.certificado} href="/api/certificado">
                🎓 Descargar mi certificado
              </a>
            )}
            <button type="button" className={l.seguir} onClick={() => setCola((c) => c.slice(1))}>
              {cola.length > 1 ? 'Siguiente' : '¡Sigo!'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Confeti en un lienzo: ligero y sin librerías. Respeta «reducir movimiento». */
function Confeti() {
  const lienzo = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = lienzo.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colores = ['#d9b47c', '#8a6a32', '#f3e3c3', '#c45c3c', '#5f8752', '#ffffff'];
    const piezas = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.42,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 15 - 5,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: colores[Math.floor(Math.random() * colores.length)],
    }));
    let raf = 0;
    const inicio = performance.now();
    const paso = (t: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of piezas) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - (t - inicio) / 3200);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t - inicio < 3200) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={lienzo} className={l.confeti} aria-hidden="true" />;
}
