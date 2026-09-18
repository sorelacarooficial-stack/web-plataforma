'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Capa de movimiento de la web, montada una sola vez en el layout:
 *
 *  - barra de progreso de lectura en la cabecera
 *  - revelado de bloques al entrar en pantalla, con retardo escalonado
 *  - parallax suave en las fotos a sangre
 *  - contadores que suben al aparecer
 *
 * Es imperativo y por selector, igual que en el prototipo, para no tener que
 * envolver cada bloque de cada página. Se vuelve a aplicar en cada cambio de ruta.
 * Si el sistema pide menos movimiento, no se activa nada salvo la barra.
 */

const SEL_REVELADO =
  'main section > div > *, main section article, main section figure';

export default function EfectosScroll() {
  const ruta = usePathname();

  useEffect(() => {
    const reducido =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const barra = document.getElementById('progreso-lectura');
    let observador: IntersectionObserver | null = null;

    function progreso() {
      if (!barra) return;
      const alto = Math.max(1, document.body.scrollHeight - window.innerHeight);
      const p = Math.min(1, (window.scrollY || 0) / alto);
      barra.style.transform = `scaleX(${p})`;
    }

    function parallax() {
      if (reducido) return;
      const vh = window.innerHeight || 800;
      document
        .querySelectorAll<HTMLImageElement>('main section > img, main section > [data-parallax] img')
        .forEach((img) => {
          const caja = img.parentElement;
          if (!caja || img.dataset.hero === '1') return;
          const r = caja.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          const rel = (r.top + r.height / 2 - vh / 2) / vh;
          img.style.transform = `scale(1.1) translate3d(0, ${(rel * -26).toFixed(1)}px, 0)`;
        });
    }

    function contadores() {
      if (reducido) return;
      const vh = window.innerHeight || 800;
      document.querySelectorAll<HTMLElement>('main [data-count]').forEach((el) => {
        const bruto = el.dataset.count || '';
        if (el.dataset.contado === bruto) return;
        const r = el.getBoundingClientRect();
        if (r.top > vh || r.bottom < 0) return;
        el.dataset.contado = bruto;

        const m = bruto.match(/[\d.]+/);
        if (!m) return;
        const crudo = m[0];
        const destino = parseFloat(crudo.replace(/\./g, ''));
        if (!isFinite(destino)) return;

        const t0 = performance.now();
        const paso = (t: number) => {
          const p = Math.min(1, (t - t0) / 1000);
          const val = Math.round(destino * (1 - Math.pow(1 - p, 3)));
          el.textContent = bruto.replace(
            crudo,
            crudo.includes('.') ? val.toLocaleString('es-ES') : String(val)
          );
          if (p < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      });
    }

    function revelar() {
      if (reducido) return;
      const vh = window.innerHeight || 800;
      observador = new IntersectionObserver(
        (entradas) => {
          entradas.forEach((e) => {
            if (!e.isIntersecting) return;
            (e.target as HTMLElement).dataset.anima = 'dentro';
            observador?.unobserve(e.target);
          });
        },
        { rootMargin: '0px 0px -10% 0px' }
      );

      let i = 0;
      document.querySelectorAll<HTMLElement>(SEL_REVELADO).forEach((el) => {
        el.dataset.anima = 'pendiente';
        const r = el.getBoundingClientRect();
        const visible = r.top < vh - 60 && r.bottom > 0;
        if (visible) {
          // Ya está en pantalla: entra con retardo escalonado, sin observador.
          const retardo = 40 + Math.min(i * 70, 420);
          i += 1;
          window.setTimeout(() => {
            el.dataset.anima = 'dentro';
          }, retardo);
        } else {
          observador!.observe(el);
        }
      });
    }

    let pendiente = false;
    function onScroll() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        progreso();
        parallax();
        contadores();
      });
    }

    // El DOM de la ruta nueva ya está montado cuando corre este efecto,
    // pero se deja un frame para que las fuentes no descoloquen las medidas.
    const id = requestAnimationFrame(() => {
      revelar();
      progreso();
      parallax();
      contadores();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      observador?.disconnect();
    };
  }, [ruta]);

  return null;
}
