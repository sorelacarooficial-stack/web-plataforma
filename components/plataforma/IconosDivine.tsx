'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';
import type { FuentePuntos } from '@/lib/puntos-tipos';
import type { Escalon, GlifoTrofeo } from '@/lib/logros-tipos';
import d from './iconosdivine.module.css';

/**
 * Los iconos de la gamificación, dibujados a mano para la Técnica Divine.
 *
 * Nada de emojis (cada móvil los pinta a su manera y se ven de juguete) ni de
 * librerías (genéricos, los mismos que en cualquier app). Dos familias:
 *
 *   · De LÍNEA (`Icono`): rejilla de 24, trazo fino de 1,6 con puntas y
 *     esquinas redondeadas, en `currentColor`. Uno por cada forma de ganar
 *     puntos (lib/puntos-tipos.ts) y algunos más. Toman el color del texto.
 *   · De COLOR: la `Medalla` del podio, la `InsigniaNivel` de cada nivel y el
 *     `Trofeo` de cada escalón. Llevan su metal y no dependen del fondo.
 *
 * El acento de la gamificación es el VINO (burdeos) de la marca, con su rosé
 * para fondos oscuros: se eligió frente al rosé empolvado (se confundía con el
 * bronce) y la salvia (un corazón verde no se entiende). Tokens en
 * app/globals.css (--divine-*); aquí, los mismos valores en `COLORES` para el
 * SVG, el lienzo del confeti o un correo.
 */

/* ==========================================================================
   Colores
   ========================================================================== */

/** Cada metal en cuatro tonos: [brillo, claro, medio, filo]. */
type Metal = readonly [string, string, string, string];

export const COLORES = {
  /** El acento: vino sobre claro (7,8:1 sobre la crema), rosé sobre oscuro (9,2:1 sobre #17140f). */
  divine: { vino: '#7e2f40', vinoOscuro: '#6a2534', rose: '#e6a7b2', tinte: '#f6e8ea' },
  metales: {
    bronce: ['#f6dcc2', '#d29a68', '#9a6338', '#6b4122'],
    plata: ['#ffffff', '#e4e1dc', '#aaa59d', '#6c675f'],
    oro: ['#fff6e2', '#ecd09a', '#c19650', '#7a5a24'],
    divine: ['#f3cdd4', '#bd5d71', '#6e2536', '#4a1722'],
    apagado: ['#f6f3ee', '#e2ded7', '#c3bcb1', '#9d968b'],
  } satisfies Record<Escalon | 'apagado', Metal>,
} as const;

/* ==========================================================================
   Iconos de línea
   ========================================================================== */

/** Un destello de cuatro puntas (el ✦ de la marca), centrado en x,y. */
export function destello(x: number, y: number, r: number, k = 0.22): string {
  const c = r * k;
  return `M${x} ${y - r}Q${x + c} ${y - c} ${x + r} ${y}Q${x + c} ${y + c} ${x} ${y + r}Q${x - c} ${y + c} ${x - r} ${y}Q${x - c} ${y - c} ${x} ${y - r}Z`;
}

const relleno = { fill: 'currentColor', stroke: 'none' } as const;

const LINEAS = {
  /** Clase terminada: la pantalla de la clase con su visto. */
  clases: (
    <>
      <path d="M13.2 15H5.3a2.8 2.8 0 0 1-2.8-2.8V6.8A2.8 2.8 0 0 1 5.3 4h8.4a2.8 2.8 0 0 1 2.8 2.8v4.8" />
      <path d="M8.3 7.5v4l3.4-2z" {...relleno} stroke="currentColor" strokeWidth={1} />
      <path d="M6 18.6h5" />
      <circle cx="18" cy="16.6" r="3.6" />
      <path d="M16.5 16.7l1 1 2-2.1" />
    </>
  ),
  /** Curso completo: el diploma con su sello. */
  curso: (
    <>
      <path d="M12.4 16.5H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3.8" />
      <path d="M6.5 7.5h8M6.5 10.5h4.5" />
      <circle cx="17" cy="14.6" r="3.2" />
      <path d="M15.3 17.4l-.8 3.6 2.5-1.2 2.5 1.2-.8-3.6" />
    </>
  ),
  /** Publicar: la pluma que escribe. */
  publicaciones: (
    <>
      <path d="M19.6 4.4c-7.3.6-12.2 5.6-13.3 13.2 3.4-1.1 6.1-2.4 8-4.2l-1.7-.8 2.7-.4c2.4-1.9 3.8-4.5 4.3-7.8z" />
      <path d="M4.4 19.6l7.4-7.4" />
      <path d="M13.4 19.6h6.2" />
    </>
  ),
  /** Responder: un bocadillo con la flecha de contestar. */
  respuestas: (
    <>
      <path d="M12 4.6c4.6 0 8 2.9 8 6.5s-3.4 6.5-8 6.5c-1 0-2-.1-2.9-.4L5.4 19l.9-3.3C4.9 14.5 4 12.9 4 11.1 4 7.5 7.4 4.6 12 4.6z" />
      <path d="M11.2 8.6l-2.5 2.3 2.5 2.3" />
      <path d="M8.9 10.9h4.3a2.6 2.6 0 0 1 2.6 2.6" />
    </>
  ),
  /** «Me gusta»: el corazón con su destello. */
  meGusta: (
    <>
      <path d="M10.4 19.6s-6.4-3.9-7.8-7.7C1.6 9.2 3.4 6.5 6.2 6.5c1.7 0 3.1.8 4.2 2.3 1.1-1.5 2.5-2.3 4.2-2.3 2.8 0 4.6 2.7 3.6 5.4-1.4 3.8-7.8 7.7-7.8 7.7z" />
      <path d={destello(19.6, 4.3, 2.3)} {...relleno} />
    </>
  ),
  /** Cada día que entras: el sol que sale. */
  dias: (
    <>
      <path d="M3.5 17h17" />
      <path d="M7.6 17a4.4 4.4 0 0 1 8.8 0" />
      <path d="M12 7.8v1.9M6.3 10.4l1.3 1.3M17.7 10.4l-1.3 1.3M3.8 14h1.7M18.5 14h1.7" />
      <path d="M8.5 20.2h7" />
    </>
  ),
  /** La racha: una llama con su corazón. */
  racha: (
    <>
      <path d="M12 3.4c.5 2.7 2.3 4.2 3.8 5.9 1.4 1.6 2.4 3.4 2.4 5.6A6.2 6.2 0 0 1 12 21a6.2 6.2 0 0 1-6.2-6.1c0-2.3 1-4.2 2.6-5.6.2 1.5.9 2.6 2 3.2-.3-3.4.3-6.3 1.6-9.1z" />
      <path d="M12 21a2.9 2.9 0 0 1-2.9-2.9c0-1.6 1-2.6 2.1-3.5.1 1 .6 1.7 1.3 2 .1-1.3.5-2.4 1.3-3.3.5 1.5 1.1 2.6 1.1 4.6A2.9 2.9 0 0 1 12 21z" />
    </>
  ),
  /** Los trofeos (lo que antes eran «logros»). */
  logros: (
    <>
      <path d="M7.5 4.5h9v4.8a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6.5H5.3a.9.9 0 0 0-.9 1c.2 2 1.4 3.4 3.4 3.7M16.5 6.5h2.2a.9.9 0 0 1 .9 1c-.2 2-1.4 3.4-3.4 3.7" />
      <path d="M12 13.8v2.9" />
      <path d="M9.4 16.7h5.2l.7 2.9H8.7z" />
      <path d={destello(12, 8.6, 1.9)} {...relleno} />
    </>
  ),
  /** Perfil completo: la tarjeta con su retrato. */
  perfil: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="9" cy="10.4" r="2.2" />
      <path d="M5.9 16c.6-1.6 1.7-2.4 3.1-2.4s2.5.8 3.1 2.4" />
      <path d="M14.6 10h3.6M14.6 13.2h2.4" />
    </>
  ),
  /** El recorrido de bienvenida: la brújula, con la aguja hacia el norte de la marca. */
  brujula: (
    <>
      <circle cx="11.2" cy="12.8" r="7.8" />
      <path d="M14.5 9.5l-2.2 4.4-4.4 2.2 2.2-4.4z" />
      <path d="M14.5 9.5l-2.2 4.4-2.2-2.2z" {...relleno} />
      <path d="M11.2 5v1.3M11.2 19.3v1.3M3.4 12.8h1.3M17.7 12.8H19" />
      <path d={destello(19.7, 4.3, 2.3)} {...relleno} />
    </>
  ),
  /** Fotos del perfil: la cámara. */
  fotos: (
    <>
      <path d="M4.6 7.6h2.9l1.5-2.1h6l1.5 2.1h2.9A1.6 1.6 0 0 1 21 9.2v8.7a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.9V9.2a1.6 1.6 0 0 1 1.6-1.6z" />
      <circle cx="12" cy="13.3" r="3.4" />
      <circle cx="17.6" cy="10.3" r=".6" {...relleno} />
    </>
  ),
  /** La ficha en el mapa de terapeutas. */
  mapa: (
    <>
      <path d="M12 21s-6.3-5.4-6.3-10.7a6.3 6.3 0 0 1 12.6 0C18.3 15.6 12 21 12 21z" />
      <circle cx="12" cy="10.3" r="2.3" />
    </>
  ),
  /** El podio del mes, en línea (para leyendas; la de color es `Medalla`). */
  medalla: (
    <>
      <path d="M8.5 3.5l2.7 6.3M15.5 3.5l-2.7 6.3M8.5 3.5h7" />
      <circle cx="12" cy="15" r="5.6" />
      <path d={destello(12, 15, 2.5)} {...relleno} />
    </>
  ),
  /** La corona: lo más alto (nivel 6, trofeo Divine). */
  corona: (
    <>
      <path d="M5.2 17.6l-1.4-9.2 4.7 3.7L12 5.6l3.5 6.5 4.7-3.7-1.4 9.2z" />
      <path d="M5.6 20.4h12.8" />
    </>
  ),
  /** La creadora: el destello de la marca. */
  creadora: (
    <>
      <path d={destello(11, 13, 8.2, 0.2)} />
      <path d={destello(19.2, 4.8, 2.4)} {...relleno} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NombreIcono = keyof typeof LINEAS;

/** El icono de cada forma de ganar puntos (las de PUNTOS, en lib/puntos-tipos.ts). */
export const ICONO_FUENTE: Record<FuentePuntos, NombreIcono> = {
  clases: 'clases',
  curso: 'curso',
  publicaciones: 'publicaciones',
  respuestas: 'respuestas',
  meGusta: 'meGusta',
  dias: 'dias',
  racha: 'racha',
  logros: 'logros',
  perfil: 'perfil',
  recorrido: 'brujula',
  fotos: 'fotos',
};

type PropsIcono = {
  nombre: NombreIcono;
  size?: number;
  /** Grosor del trazo en la rejilla de 24. Por defecto 1,6. */
  grosor?: number;
  className?: string;
  style?: CSSProperties;
  /** Si lleva título, se anuncia; si no, es decorativo (aria-hidden). */
  title?: string;
};

/** Un icono de línea, en el color del texto. */
export function Icono({ nombre, size = 20, grosor = 1.6, className, style, title }: PropsIcono) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {LINEAS[nombre]}
    </svg>
  );
}

/* ==========================================================================
   Medallas del podio
   ========================================================================== */

const METAL_PUESTO: Record<1 | 2 | 3, Escalon> = { 1: 'oro', 2: 'plata', 3: 'bronce' };

/** La medalla de los tres primeros puestos: disco de metal con su número y la cinta en vino. */
export function Medalla({ puesto, size = 28, title, className }: { puesto: 1 | 2 | 3; size?: number; title?: string; className?: string }) {
  const id = useId();
  const m = COLORES.metales[METAL_PUESTO[puesto]];
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}m`} cx="11" cy="15" r="15" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={m[0]} />
          <stop offset=".45" stopColor={m[1]} />
          <stop offset="1" stopColor={m[2]} />
        </radialGradient>
      </defs>
      <path d="M8.6 2.6h5.1l3.4 9.4H12z" fill={COLORES.divine.vino} />
      <path d="M23.4 2.6h-5.1l-3.4 9.4H20z" fill={COLORES.metales.divine[3]} />
      <circle cx="16" cy="20.5" r="9" fill={`url(#${id}m)`} stroke={m[3]} strokeWidth="1" />
      <circle cx="16" cy="20.5" r="6.9" fill="none" stroke={m[3]} strokeWidth=".7" opacity=".5" />
      <text
        x="16"
        y="24.4"
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill={m[3]}
        // Cifras de caja alta: con las de estilo antiguo de la Cormorant, el 1 parece una I.
        style={{ fontFamily: 'var(--fuente-inter), sans-serif', fontVariantNumeric: 'lining-nums' }}
      >
        {puesto}
      </text>
    </svg>
  );
}

/* ==========================================================================
   Insignias de nivel
   ========================================================================== */

type Marco = 'liso' | 'anillo' | 'puntos' | 'roseta' | 'estrella' | 'corona';

/**
 * Cada nivel con su color y su marco, de menos a más: arena, cobre, bronce,
 * oro, noche con oro y vino con oro. El marco gana adornos al subir (liso,
 * doble anillo, ritmo de puntos, roseta, estrella y corona de lóbulos).
 */
export const ESTILO_NIVEL: Record<number, { nombre: string; fondo: readonly [string, string, string]; filo: string; emblema: string; marco: Marco }> = {
  1: { nombre: 'Arena', fondo: ['#fffaf0', '#efe2c9', '#d3bc95'], filo: '#a88a5c', emblema: '#5c4520', marco: 'liso' },
  2: { nombre: 'Cobre', fondo: ['#fbeadb', '#e3b690', '#b57d52'], filo: '#7d4f2c', emblema: '#4a2a12', marco: 'anillo' },
  3: { nombre: 'Bronce', fondo: ['#f3d4ae', '#cb945f', '#93603a'], filo: '#5e361b', emblema: '#3a200d', marco: 'puntos' },
  4: { nombre: 'Oro', fondo: ['#fff6e2', '#ecd09a', '#b88c46'], filo: '#7a5a24', emblema: '#4b3712', marco: 'roseta' },
  5: { nombre: 'Noche y oro', fondo: ['#4d4237', '#26211b', '#110e0b'], filo: '#d9b47c', emblema: '#ecd2a2', marco: 'estrella' },
  6: { nombre: 'Vino y oro', fondo: ['#d98c9b', '#8e3a4c', '#4f1a26'], filo: '#e6c890', emblema: '#f8e7c6', marco: 'corona' },
};

/* Los emblemas, en la rejilla de 48 y centrados en 24,24. */
const EMBLEMAS: Record<number, ReactNode> = {
  // 1 · Primeros pasos: el brote.
  1: (
    <>
      <path d="M24 32.5v-9.8" />
      <path d="M24 26.2c-.9-3.5-3.6-5.4-7.3-5.2.4 3.5 3.1 5.4 7.3 5.2z" />
      <path d="M24 23.2c.7-3.9 3.6-6.2 7.6-6.1-.3 3.9-3.2 6.2-7.6 6.1z" />
      <path d="M19.2 32.5h9.6" />
    </>
  ),
  // 2 · Manos despiertas: la mano abierta con su destello.
  2: (
    <>
      <path d="M20 25.5v-7a1.5 1.5 0 0 1 3 0v5.5M23 24v-7.5a1.5 1.5 0 0 1 3 0V24M26 24v-6.5a1.5 1.5 0 0 1 3 0V25" />
      <path d="M29 25l1.5-2.6a1.5 1.5 0 0 1 2.6 1.5l-2.4 4.6c-1.3 2.6-3.4 4.3-6.4 4.3-3.1 0-4.3-2.5-4.3-5.6v-1.7" />
      <path d={destello(15.6, 17.4, 2.4)} fill="currentColor" stroke="none" />
    </>
  ),
  // 3 · Ritmo propio: tres ondas.
  3: (
    <>
      <path d="M15 19.5c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0" />
      <path d="M15 24c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0" />
      <path d="M15 28.5c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0" />
    </>
  ),
  // 4 · Terapeuta Divine: la flor de loto.
  4: (
    <>
      <path d="M24 15.4c2.7 2.7 3.7 5.8 3.1 9.2-.4 2.3-1.4 4-3.1 5.2-1.7-1.2-2.7-2.9-3.1-5.2-.6-3.4.4-6.5 3.1-9.2z" />
      <path d="M22.6 29.6c-2.5.2-5-.5-6.9-2-1.3-1-2.1-2.4-2.4-4 2.2-.5 4.3-.1 6.1 1" />
      <path d="M25.4 29.6c2.5.2 5-.5 6.9-2 1.3-1 2.1-2.4 2.4-4-2.2-.5-4.3-.1-6.1 1" />
      <path d="M17.5 32.8h13" />
    </>
  ),
  // 5 · Referente: la estrella que guía.
  5: (
    <>
      <path d={destello(23.4, 24.6, 9.4, 0.2)} />
      <path d={destello(23.4, 24.6, 2.4)} fill="currentColor" stroke="none" />
      <path d={destello(32, 16, 2.2)} fill="currentColor" stroke="none" />
    </>
  ),
  // 6 · Embajadora Divine: la corona.
  6: (
    <>
      <path d="M16 30.5l-1.7-10 5.4 4.2L24 17l4.3 7.7 5.4-4.2-1.7 10z" />
      <path d="M16.5 33.6h15" />
      <circle cx="14.3" cy="20.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="24" cy="17" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="33.7" cy="20.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
};

const alrededor = (n: number, radio: number, giro = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = giro + (i * 2 * Math.PI) / n;
    return [24 + radio * Math.cos(a), 24 + radio * Math.sin(a)] as const;
  });

const redondo = (v: number) => Math.round(v * 100) / 100;

/**
 * La insignia de un nivel (1 a 6). `apagada`: en gris y sin brillo, para los
 * niveles que aún no se han alcanzado en el camino de niveles.
 */
export function InsigniaNivel({
  n,
  size = 40,
  apagada = false,
  title,
  className,
}: {
  n: number;
  size?: number;
  apagada?: boolean;
  title?: string;
  className?: string;
}) {
  const id = useId();
  const nivel = Math.min(6, Math.max(1, Math.round(n) || 1));
  const e = ESTILO_NIVEL[nivel];
  const gris = COLORES.metales.apagado;
  const fondo = apagada ? ([gris[0], gris[1], gris[2]] as const) : e.fondo;
  const filo = apagada ? gris[3] : e.filo;
  const emblema = apagada ? '#8a8378' : e.emblema;
  const g = `url(#${id}f)`;
  const oro = `url(#${id}o)`;
  const marco = e.marco;

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-nivel={nivel}
    >
      <defs>
        {/* En coordenadas de la insignia: lóbulos y disco comparten el mismo degradado. */}
        <radialGradient id={`${id}f`} cx="17" cy="14" r="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={fondo[0]} />
          <stop offset=".45" stopColor={fondo[1]} />
          <stop offset="1" stopColor={fondo[2]} />
        </radialGradient>
        <radialGradient id={`${id}o`} cx="16" cy="12" r="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={apagada ? gris[0] : '#fff6e2'} />
          <stop offset=".5" stopColor={apagada ? gris[1] : '#e6c890'} />
          <stop offset="1" stopColor={apagada ? gris[2] : '#a77d3d'} />
        </radialGradient>
      </defs>

      {marco === 'liso' && (
        <>
          <circle cx="24" cy="24" r="21" fill={g} stroke={filo} strokeWidth="1.2" />
          <circle cx="24" cy="24" r="17.6" fill="none" stroke={filo} strokeWidth=".8" opacity=".45" />
        </>
      )}
      {marco === 'anillo' && (
        <>
          <circle cx="24" cy="24" r="21" fill={g} stroke={filo} strokeWidth="1.2" />
          <circle cx="24" cy="24" r="18" fill="none" stroke={filo} strokeWidth="1.3" opacity=".8" />
          <circle cx="24" cy="24" r="16.2" fill="none" stroke={filo} strokeWidth=".6" opacity=".45" />
        </>
      )}
      {marco === 'puntos' && (
        <>
          <circle cx="24" cy="24" r="21" fill={g} stroke={filo} strokeWidth="1.2" />
          {alrededor(18, 18.1).map(([x, y], i) => (
            <circle key={i} cx={redondo(x)} cy={redondo(y)} r=".95" fill={filo} opacity=".85" />
          ))}
        </>
      )}
      {marco === 'roseta' && (
        <>
          {alrededor(10, 17.6).map(([x, y], i) => (
            <circle key={i} cx={redondo(x)} cy={redondo(y)} r="5.2" fill={g} stroke={filo} strokeWidth="1.1" />
          ))}
          <circle cx="24" cy="24" r="18.4" fill={g} />
          <circle cx="24" cy="24" r="15.2" fill="none" stroke={filo} strokeWidth=".9" opacity=".7" />
        </>
      )}
      {marco === 'estrella' && (
        <>
          <path
            d={
              alrededor(16, 1, -Math.PI / 2)
                .map(([x, y], i) => {
                  const r = i % 2 === 0 ? 23.2 : 18.6;
                  const px = 24 + (x - 24) * r;
                  const py = 24 + (y - 24) * r;
                  return `${i === 0 ? 'M' : 'L'}${redondo(px)} ${redondo(py)}`;
                })
                .join('') + 'Z'
            }
            fill={oro}
            stroke={apagada ? filo : '#8a6a32'}
            strokeWidth=".8"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="24" r="18.4" fill={g} stroke={filo} strokeWidth="1.2" />
          <circle cx="24" cy="24" r="15.6" fill="none" stroke={filo} strokeWidth=".8" opacity=".6" />
        </>
      )}
      {marco === 'corona' && (
        <>
          {alrededor(12, 19.2).map(([x, y], i) => (
            <circle key={i} cx={redondo(x)} cy={redondo(y)} r="4.4" fill={oro} stroke={apagada ? filo : '#8a6a32'} strokeWidth=".9" />
          ))}
          <circle cx="24" cy="24" r="19.6" fill={oro} />
          <circle cx="24" cy="24" r="17.2" fill={g} />
          <circle cx="24" cy="24" r="14.8" fill="none" stroke={filo} strokeWidth=".9" opacity=".75" />
        </>
      )}

      {/* El brillo de arriba: lo que hace que parezca de metal y no un círculo plano. */}
      {!apagada && <path d="M12.5 17.5a13 13 0 0 1 9-7.6" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity={nivel >= 5 ? 0.35 : 0.7} />}

      <g fill="none" stroke={emblema} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" color={emblema}>
        {EMBLEMAS[nivel]}
      </g>
    </svg>
  );
}

/* ==========================================================================
   Trofeos
   ========================================================================== */

const GLIFO_ICONO: Record<GlifoTrofeo, NombreIcono> = {
  brujula: 'brujula',
  clase: 'clases',
  publicacion: 'publicaciones',
  respuesta: 'respuestas',
  meGusta: 'meGusta',
  racha: 'racha',
  foto: 'fotos',
  podio: 'medalla',
  divine: 'corona',
};

/**
 * Un trofeo: la copa en el metal de su escalón con el dibujo de su vitrina
 * grabado. `apagado`: en gris (aún no conseguido). El Divine, en vino con
 * filo de oro y destellos.
 */
export function Trofeo({
  escalon,
  glifo,
  size = 48,
  apagado = false,
  title,
  className,
}: {
  escalon: Escalon;
  glifo: GlifoTrofeo;
  size?: number;
  apagado?: boolean;
  title?: string;
  className?: string;
}) {
  const id = useId();
  const m = COLORES.metales[apagado ? 'apagado' : escalon];
  const divine = escalon === 'divine' && !apagado;
  const g = `url(#${id}c)`;
  const filo = divine ? '#e6c890' : m[3];
  // El grabado: oscuro sobre los metales claros, claro sobre el vino.
  const grabado = divine ? '#fbe9ec' : apagado ? '#8f887d' : m[3];

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-escalon={apagado ? 'apagado' : escalon}
    >
      <defs>
        <linearGradient id={`${id}c`} x1="12" y1="6" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={m[0]} />
          <stop offset=".42" stopColor={m[1]} />
          <stop offset="1" stopColor={m[2]} />
        </linearGradient>
      </defs>

      {divine && (
        <g fill="#e6c890">
          <path d={destello(7.5, 9, 2.6)} />
          <path d={destello(41.5, 6.5, 2)} />
          <path d={destello(42, 27, 1.6)} />
        </g>
      )}

      {/* Asas, copa, tallo y peana. */}
      <path
        d="M13 11.5H9.6a1.6 1.6 0 0 0-1.6 1.8c.5 4.6 3.3 7.8 7.6 8.6M35 11.5h3.4a1.6 1.6 0 0 1 1.6 1.8c-.5 4.6-3.3 7.8-7.6 8.6"
        fill="none"
        stroke={filo}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12.6 8.4h22.8v9.6c0 6.5-5.1 11.6-11.4 11.6S12.6 24.5 12.6 18z" fill={g} stroke={filo} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M21.4 29.4h5.2l-.7 4.4h-3.8z" fill={g} stroke={filo} strokeWidth="1.1" strokeLinejoin="round" />
      <path
        d="M15.6 40.6h16.8a1 1 0 0 0 1-1.2l-.9-3.7a1.6 1.6 0 0 0-1.6-1.2H17.1a1.6 1.6 0 0 0-1.6 1.2l-.9 3.7a1 1 0 0 0 1 1.2z"
        fill={g}
        stroke={filo}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {!apagado && <path d="M16.4 11.6v6.2c0 2.3.8 4.4 2.1 6" fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity=".6" />}

      <g
        transform="translate(18.6 12.4) scale(0.45)"
        fill="none"
        stroke={grabado}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        color={grabado}
        opacity={apagado ? 0.9 : 0.92}
      >
        {LINEAS[GLIFO_ICONO[glifo]]}
      </g>
    </svg>
  );
}

/* ==========================================================================
   El distintivo de Sorela
   ========================================================================== */

/**
 * «Creadora de la Técnica Divine»: lo que lleva Sorela donde las demás llevan
 * puntos, nivel y trofeos. Ella no compite.
 *
 *   chip   → en línea, junto a su nombre (perfil, publicaciones).
 *   bloque → una tarjeta que ocupa el sitio de los puntos y la vitrina.
 */
export function DistintivoCreadora({
  variante = 'chip',
  ajena = false,
  nombre = 'Sorela',
  className,
}: {
  variante?: 'chip' | 'bloque';
  /** Si lo mira otra persona (no se le habla de tú). */
  ajena?: boolean;
  nombre?: string;
  className?: string;
}) {
  if (variante === 'chip') {
    return (
      <span className={`${d.chip} ${className ?? ''}`}>
        <Icono nombre="creadora" size={15} grosor={1.7} />
        Creadora de la Técnica Divine
      </span>
    );
  }
  const pila = nombre.trim().split(/\s+/)[0] || 'Sorela';
  return (
    <section className={`${d.bloque} ${className ?? ''}`} aria-label="Creadora de la Técnica Divine">
      <span className={d.bloqueSello} aria-hidden="true">
        <Icono nombre="creadora" size={30} grosor={1.4} />
      </span>
      <div className={d.bloqueTexto}>
        <p className={d.bloqueRotulo}>Creadora de la Técnica Divine</p>
        {/* Sin «no compite»: decía lo que no es en vez de lo que es. */}
        <p className={d.bloqueTitulo}>{ajena ? `${pila} creó el método` : 'Tú creaste el método'}</p>
        <p className={d.bloqueNota}>
          {ajena
            ? `Aquí aprendes con ella. Los puntos, los niveles y los trofeos son de las alumnas.`
            : 'Los puntos, los niveles y los trofeos son de tus alumnas: aquí ves cómo avanzan.'}
        </p>
      </div>
    </section>
  );
}
