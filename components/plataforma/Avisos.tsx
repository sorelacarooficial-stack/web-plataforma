'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Vista } from '@/lib/plataforma';
import a from './avisos.module.css';

/**
 * Los avisos flotantes del panel de Sorela.
 *
 * Al entrar enseña lo que ha pasado mientras no estaba —contactos nuevos,
 * registros, gente que entra con su enlace, acuerdos firmados— y luego, cada
 * minuto, lo que vaya llegando. Además avisa de lo que tiene en la agenda en
 * la próxima hora.
 *
 * Se quedan unos segundos y se van solos; pasando el ratón por encima se
 * quedan quietos. Pulsar uno lleva a su pantalla. Lo que ya se ha enseñado no
 * vuelve a salir: el navegador recuerda qué avisos ha visto.
 */

type Novedad = {
  id: string;
  tipo: 'contacto' | 'registro' | 'invitacion' | 'acuerdo' | 'cita' | 'resumen';
  titulo: string;
  texto: string;
  cuando: string;
  ir: Vista;
};

const CADA_MS = 60_000;
const DURA_MS = 8_000;
const A_LA_VEZ = 3;
const CLAVE_DESDE = 'divine-avisos-desde';
const CLAVE_VISTOS = 'divine-avisos-vistos';

/* El navegador puede no dejar guardar (modo privado): sin memoria funciona
   igual, solo que puede repetir algún aviso. */
function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin memoria */
  }
}

function hace(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) {
    const m = Math.round(-s / 60);
    return m <= 1 ? 'ahora' : `en ${m} min`;
  }
  if (s < 60) return 'ahora mismo';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

function Icono({ tipo }: { tipo: Novedad['tipo'] }) {
  const p = { viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (tipo) {
    case 'contacto':
      return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>;
    case 'registro':
      return <svg {...p}><circle cx="10" cy="8" r="4" /><path d="M3 21c1.3-3.6 4-5.5 7-5.5" /><path d="M18 14v6M15 17h6" /></svg>;
    case 'invitacion':
      return <svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
    case 'acuerdo':
      return <svg {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M9 16c1.5-2 2.5 1 4-1s1.5 1 2.5 0" /></svg>;
    case 'cita':
      return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
    default:
      return <svg {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
  }
}

function Aviso({ n, cerrar, abrir }: { n: Novedad; cerrar: () => void; abrir: () => void }) {
  const [quieto, setQuieto] = useState(false);
  const restante = useRef(DURA_MS);
  const inicio = useRef(Date.now());

  useEffect(() => {
    if (quieto) return;
    inicio.current = Date.now();
    const t = setTimeout(cerrar, restante.current);
    return () => {
      clearTimeout(t);
      restante.current -= Date.now() - inicio.current;
    };
  }, [quieto, cerrar]);

  return (
    <motion.div
      layout
      className={a.aviso}
      data-tipo={n.tipo}
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => setQuieto(true)}
      onMouseLeave={() => setQuieto(false)}
      role="status"
    >
      <button type="button" className={a.cuerpo} onClick={abrir}>
        <span className={a.icono}>
          <Icono tipo={n.tipo} />
        </span>
        <span className={a.texto}>
          <span className={a.cabecera}>
            <strong>{n.titulo}</strong>
            {n.tipo !== 'cita' && <span className={a.hace}>{hace(n.cuando)}</span>}
          </span>
          <span className={a.frase}>{n.texto}</span>
        </span>
      </button>
      <button type="button" className={a.cerrar} onClick={cerrar} aria-label="Cerrar el aviso">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
      </button>
      <span className={a.barra} aria-hidden="true">
        <span style={{ animationDuration: `${DURA_MS}ms`, animationPlayState: quieto ? 'paused' : 'running' }} />
      </span>
    </motion.div>
  );
}

export default function Avisos({ ir }: { ir: (v: Vista) => void }) {
  const [visibles, setVisibles] = useState<Novedad[]>([]);
  const cola = useRef<Novedad[]>([]);
  const desde = useRef<string | null>(null);
  const vistos = useRef<Set<string>>(new Set());

  const sacar = useCallback(() => {
    setVisibles((v) => {
      const sitio = A_LA_VEZ - v.length;
      if (sitio <= 0 || cola.current.length === 0) return v;
      const nuevos = cola.current.splice(0, sitio);
      return [...v, ...nuevos];
    });
  }, []);

  const cerrar = useCallback(
    (id: string) => {
      setVisibles((v) => v.filter((x) => x.id !== id));
      // Deja que salga con su animación antes de meter el siguiente.
      setTimeout(sacar, 260);
    },
    [sacar]
  );

  const pedir = useCallback(
    async (primeraVez: boolean) => {
      try {
        const q = desde.current ? `?desde=${encodeURIComponent(desde.current)}` : '';
        const j = await (await fetch(`/api/novedades${q}`)).json();
        if (!j.ok) return;
        desde.current = j.ahora;
        guardar(CLAVE_DESDE, j.ahora);

        const nuevas = (j.novedades as Novedad[]).filter((n) => !vistos.current.has(n.id));
        if (nuevas.length === 0) return;
        nuevas.forEach((n) => vistos.current.add(n.id));
        guardar(CLAVE_VISTOS, [...vistos.current].slice(-300));

        /* Al entrar, si ha pasado mucho, no se le echan diez avisos encima:
           los tres más recientes y uno que resume el resto. */
        let paraEnsenar = nuevas;
        if (primeraVez && nuevas.length > A_LA_VEZ + 1) {
          const resto = nuevas.length - A_LA_VEZ;
          paraEnsenar = [
            ...nuevas.slice(0, A_LA_VEZ),
            {
              id: `resumen:${j.ahora}`,
              tipo: 'resumen',
              titulo: 'Mientras no estabas',
              texto: `Y ${resto} novedades más. Las tienes en Clientes, Cuentas y Acuerdos.`,
              cuando: j.ahora,
              ir: 'inicio',
            },
          ];
        }
        // Las citas de la próxima hora, delante: son lo único con prisa.
        paraEnsenar.sort((x, y) => Number(y.tipo === 'cita') - Number(x.tipo === 'cita'));
        cola.current.push(...paraEnsenar);
        sacar();
      } catch {
        /* sin red: ya avisará la siguiente vez */
      }
    },
    [sacar]
  );

  useEffect(() => {
    desde.current = leer<string | null>(CLAVE_DESDE, null);
    vistos.current = new Set(leer<string[]>(CLAVE_VISTOS, []));
    // Un respiro al entrar, para que el panel se pinte antes que los avisos.
    const t0 = setTimeout(() => pedir(true), 1200);
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') pedir(false);
    }, CADA_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [pedir]);

  return (
    <div className={a.pila} aria-live="polite">
      <AnimatePresence initial={false}>
        {visibles.map((n) => (
          <Aviso
            key={n.id}
            n={n}
            cerrar={() => cerrar(n.id)}
            abrir={() => {
              ir(n.ir);
              cerrar(n.id);
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
