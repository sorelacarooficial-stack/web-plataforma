'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
// Se importa aquí para que apunte por dónde llegó la persona en la primera página.
import '@/lib/llegada';

/**
 * El medidor de la web: cuenta páginas vistas y cuánto se ven los vídeos.
 *
 * Sin cookies y sin terceros (ver lib/metricas.ts). Manda un aviso pequeño a
 * /api/m con `sendBeacon`, que no retrasa nada y llega aunque la persona esté
 * cerrando la pestaña.
 *
 * Los vídeos se descubren solos: cualquier <video> de la web pública queda
 * medido sin tocar su componente. Se apunta si se le da al play, si se llega
 * al 25, 50, 75 y 100 % y cuántos segundos se han visto de verdad. Para darle
 * un nombre legible se usa `data-metrica` si lo tiene; si no, el archivo.
 *
 * La plataforma no se mide: es privada y ya tiene su propio progreso.
 */

function mandar(datos: Record<string, unknown>) {
  try {
    const cuerpo = JSON.stringify(datos);
    if (navigator.sendBeacon?.('/api/m', new Blob([cuerpo], { type: 'text/plain' }))) return;
    fetch('/api/m', { method: 'POST', body: cuerpo, keepalive: true }).catch(() => {});
  } catch {
    /* medir nunca puede romper la página */
  }
}

function nombreDe(v: HTMLVideoElement) {
  const propio = v.dataset.metrica;
  const src = v.currentSrc || v.src || v.querySelector('source')?.src || '';
  const archivo = decodeURIComponent(src.split('?')[0].split('/').pop() || '').replace(/\.(mp4|webm|mov)$/i, '');
  const nombre = propio || archivo || 'vídeo';
  return { id: `${location.pathname}|${nombre}`.slice(0, 80), nombre };
}

/** Lo que se sabe de cada vídeo mientras está en la página. */
type Estado = { cuartiles: Set<number>; ultimo: number; acumulado: number; jugado: boolean };
const estados = new WeakMap<HTMLVideoElement, Estado>();

function vigilar(v: HTMLVideoElement) {
  if (estados.has(v)) return;
  const e: Estado = { cuartiles: new Set(), ultimo: 0, acumulado: 0, jugado: false };
  estados.set(v, e);

  const soltar = () => {
    const s = Math.round(e.acumulado);
    if (s < 1) return;
    e.acumulado -= s;
    const { id, nombre } = nombreDe(v);
    mandar({ t: 'video', id, nombre, ruta: location.pathname, evento: 'tiempo', segundos: s, duracion: v.duration || 0 });
  };

  /* Los vídeos que van solos y en silencio (las tarjetas de testimonios) no
     son «verlos»: cuenta cuando suenan, al darle al play o al quitarles el
     silencio mientras se reproducen. */
  const contar = () => {
    if (e.jugado || v.muted || v.paused) return;
    e.jugado = true;
    const { id, nombre } = nombreDe(v);
    mandar({ t: 'video', id, nombre, ruta: location.pathname, evento: 'play', duracion: v.duration || 0 });
  };
  v.addEventListener('play', () => {
    e.ultimo = v.currentTime;
    // Al evento de play aún le puede faltar un instante para que `paused` sea falso.
    setTimeout(contar, 0);
  });
  v.addEventListener('volumechange', contar);
  v.addEventListener('timeupdate', () => {
    const t = v.currentTime;
    const paso = t - e.ultimo;
    e.ultimo = t;
    if (v.muted || paso <= 0 || paso > 2) return; // saltos y vídeos en silencio no cuentan
    e.acumulado += paso;
    if (e.acumulado >= 15) soltar();
    const d = v.duration;
    if (!d || !Number.isFinite(d)) return;
    for (const q of [25, 50, 75]) {
      if (!e.cuartiles.has(q) && t / d >= q / 100) {
        e.cuartiles.add(q);
        const { id, nombre } = nombreDe(v);
        mandar({ t: 'video', id, nombre, ruta: location.pathname, evento: String(q) });
      }
    }
  });
  v.addEventListener('ended', () => {
    if (v.muted || e.cuartiles.has(100)) return;
    e.cuartiles.add(100);
    const { id, nombre } = nombreDe(v);
    mandar({ t: 'video', id, nombre, ruta: location.pathname, evento: '100' });
    soltar();
  });
  v.addEventListener('pause', soltar);
  window.addEventListener('pagehide', soltar);
}

export default function Medidor() {
  const ruta = usePathname();

  useEffect(() => {
    if (!ruta || ruta.startsWith('/plataforma')) return;
    let nueva = false;
    try {
      nueva = !sessionStorage.getItem('divine-visita');
      sessionStorage.setItem('divine-visita', '1');
    } catch {
      /* sin memoria de sesión: cada página cuenta como visita */
      nueva = true;
    }
    const q = new URLSearchParams(location.search);
    mandar({
      t: 'vista',
      ruta,
      ref: nueva ? document.referrer : '',
      utm: q.get('utm_source') || q.get('origen') || '',
      nueva,
    });
  }, [ruta]);

  useEffect(() => {
    if (location.pathname.startsWith('/plataforma')) return;
    document.querySelectorAll('video').forEach(vigilar);
    const obs = new MutationObserver(() => document.querySelectorAll('video').forEach(vigilar));
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [ruta]);

  return null;
}
