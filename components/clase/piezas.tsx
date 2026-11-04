'use client';

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CIUDADES, EMPIEZA, PLAZAS } from '@/lib/clase';
import { useClase } from './estado';
import css from './clase.module.css';

/* ================================================================ texto */

/**
 * Titular con la palabra clave en 600: «Antes de *tocar*». `\n` parte línea.
 * Cada palabra entra por separado, con desenfoque, como los captions de los
 * anuncios.
 */
export function Titulo({
  texto,
  on,
  className,
  retraso = 0,
  paso = 0.07,
  as: Etiqueta = 'h2',
}: {
  texto: string;
  on: boolean;
  className?: string;
  retraso?: number;
  paso?: number;
  as?: 'h1' | 'h2' | 'p' | 'blockquote';
}) {
  let n = 0;
  const lineas = texto.split('\n');
  return (
    <Etiqueta className={className}>
      {lineas.map((linea, li) => (
        <Fragment key={li}>
          {linea.split('*').map((trozo, ti) => {
            const fuerte = ti % 2 === 1;
            const palabras = trozo.split(/(\s+)/).filter((p) => p.length);
            const contenido = palabras.map((p, pi) =>
              /^\s+$/.test(p) ? (
                ' '
              ) : (
                <span
                  key={pi}
                  className={`${css.palabra} ${on ? css.on : ''}`}
                  style={{ '--d': `${retraso + n++ * paso}s` } as CSSProperties}
                >
                  {p}
                </span>
              )
            );
            return fuerte ? <strong key={ti}>{contenido}</strong> : <Fragment key={ti}>{contenido}</Fragment>;
          })}
          {li < lineas.length - 1 && <br />}
        </Fragment>
      ))}
    </Etiqueta>
  );
}

/** Número que sube de 0 a `a` cuando se enciende. */
export function Cuenta({ a, on, ms = 1600, miles = true, decimales = 0 }: { a: number; on: boolean; ms?: number; miles?: boolean; decimales?: number }) {
  const [v, setV] = useState(on ? a : 0);
  useEffect(() => {
    if (!on) {
      setV(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const f = (t: number) => {
      const x = Math.min(1, (t - t0) / ms);
      setV(a * (1 - Math.pow(1 - x, 3)));
      if (x < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [on, a, ms]);
  const txt = decimales ? v.toFixed(decimales) : Math.round(v).toString();
  /* A mano: es-ES no pone el punto en los números de 4 cifras (2250). */
  const [entero, dec] = txt.split('.');
  const conPuntos = miles ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : entero;
  return <>{dec ? `${conPuntos},${dec}` : conPuntos}</>;
}

/* ============================================================== iconos */

const TRAZOS: Record<string, ReactNode> = {
  ojo: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  lupa: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
    </>
  ),
  decidir: <path d="M5 19V11a4 4 0 0 1 4-4h10m-4-4 4 4-4 4" />,
  regalo: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M12 8v13M3 12h18M12 8S10.5 3 8 3.5 7 8 12 8Zm0 0s1.5-5 4-4.5S17 8 12 8Z" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
  aparato: (
    <>
      <rect x="6" y="3" width="12" height="13" rx="2" />
      <path d="M9 20h6M12 16v4M9 7h6M9 10h6" />
    </>
  ),
  copia: (
    <>
      <rect x="3" y="7" width="7" height="10" rx="1.5" />
      <rect x="14" y="7" width="7" height="10" rx="1.5" />
    </>
  ),
  mano: <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-5-2.7L3 15.5a1.6 1.6 0 0 1 2.6-1.9L8 16" />,
  oreja: <path d="M7 9a5 5 0 1 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6M10 9a2 2 0 1 1 4 0" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  onda: <path d="M2 12h3l2-6 3 12 3-9 2 5 2-2h5" />,
  ola: <path d="M2 14c3 0 3-6 6-6s3 6 6 6 3-6 6-6" />,
  check: <path d="m5 12 5 5 9-10" />,
  pantalla: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  avion: <path d="m3 11 18-8-7 18-3-7-8-3Zm8 3 4-4" />,
  ficha: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  chispa: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  campana: <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4" />,
  carpeta: <path d="M3 6h6l2 2h10v11H3V6Z" />,
  escudo: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />,
  play: <path d="M8 5v14l11-7L8 5Z" />,
  libro: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 14a2 2 0 0 1 2-2h13" />,
  gente: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
    </>
  ),
  qr: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z" />,
  tarjeta: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  llave: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9m-4 4 3 3" />
    </>
  ),
};

export function Icono({ n, className }: { n: keyof typeof TRAZOS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? css.icono} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {TRAZOS[n]}
    </svg>
  );
}

/* ======================================================= polvo de oro */

/** Partículas doradas que suben despacio. Solo se mueven en la diapositiva activa. */
export function Polvo({ activa, cuantas = 70, rafaga = false }: { activa: boolean; cuantas?: number; rafaga?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !activa) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = (c.width = 1920);
    const H = (c.height = 1080);
    const ps = Array.from({ length: cuantas }, () => ({
      x: Math.random() * W,
      y: rafaga ? H * 0.42 : Math.random() * H,
      r: 0.6 + Math.random() * 2.2,
      vy: rafaga ? -(1 + Math.random() * 5) : -(0.15 + Math.random() * 0.45),
      vx: rafaga ? (Math.random() - 0.5) * 9 : (Math.random() - 0.5) * 0.2,
      f: Math.random() * Math.PI * 2,
      a: 0.25 + Math.random() * 0.6,
    }));
    if (rafaga) for (const p of ps) p.x = W / 2 + (Math.random() - 0.5) * 300;
    let raf = 0;
    const paso = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (rafaga) {
          p.vx *= 0.985;
          p.vy = p.vy * 0.985 - 0.004;
          if (Math.abs(p.vy) < 0.25) p.vy = -0.25;
        }
        p.f += 0.03;
        if (p.y < -10) {
          p.y = H + 10;
          p.x = Math.random() * W;
        }
        const al = p.a * (0.55 + 0.45 * Math.sin(p.f));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(243,217,174,${al})`);
        g.addColorStop(1, 'rgba(201,154,92,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [activa, cuantas, rafaga]);
  return <canvas ref={ref} className={css.polvo} aria-hidden />;
}

/* ===================================================== cuentas atrás */

const dos = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

/**
 * La cuenta atrás de la portada. Si faltan menos de 60 min para las 19:00 del
 * día 6, cuenta hasta esa hora. Si no (ensayos, otra hora), cuenta 10 minutos
 * desde que se abre la diapositiva. Pulsarla la reinicia.
 */
export function CuentaAtras({ activa }: { activa: boolean }) {
  const [fin, setFin] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);
  const reiniciar = () => {
    const evento = Date.parse(EMPIEZA);
    const t = Date.now();
    setFin(evento > t && evento - t <= 3600e3 ? evento : t + 10 * 60e3);
  };
  useEffect(() => {
    if (activa) reiniciar();
  }, [activa]);
  useEffect(() => {
    if (!activa) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [activa]);
  const resta = fin && ahora ? Math.max(0, fin - ahora) / 1000 : 600;
  const m = Math.floor(resta / 60);
  const s = Math.floor(resta % 60);
  const ya = resta <= 0;
  return (
    <button type="button" className={css.cuentaAtras} onClick={reiniciar} title="Reiniciar la cuenta atrás">
      <span className={css.cuentaEtiqueta}>{ya ? 'Empezamos' : 'Empezamos en'}</span>
      {ya ? (
        <span className={css.cuentaYa}>ya</span>
      ) : (
        <span className={css.cuentaDigitos}>
          <span className={css.digito}>{dos(m)}</span>
          <span className={css.dosPuntos}>:</span>
          <span className={css.digito} key={s}>
            {dos(s)}
          </span>
        </span>
      )}
    </button>
  );
}

/** «Quedan 2 d 04 h 12 min» hasta una fecha. */
export function Quedan({ hasta, activa }: { hasta: string; activa: boolean }) {
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    setAhora(Date.now());
    if (!activa) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activa]);
  if (!ahora) return null;
  const r = Math.max(0, Date.parse(hasta) - ahora) / 1000;
  if (r <= 0) return <>cerrado</>;
  const d = Math.floor(r / 86400);
  const h = Math.floor((r % 86400) / 3600);
  const m = Math.floor((r % 3600) / 60);
  const s = Math.floor(r % 60);
  return (
    <span className={css.quedan}>
      quedan {d > 0 && <b>{d} d </b>}
      <b>{dos(h)} h </b>
      <b>{dos(m)} min</b>
      {d === 0 && <b> {dos(s)} s</b>}
    </span>
  );
}

/* =============================================================== mapa */

let tierra: number[] | null = null;
let pidiendo: Promise<number[]> | null = null;
function cargarTierra() {
  if (tierra) return Promise.resolve(tierra);
  pidiendo ??= fetch('/clase/tierra.json')
    .then((r) => r.json())
    .then((d: number[]) => (tierra = d));
  return pidiendo;
}

const MW = 1000;
const MH = 720;
const px = (lng: number) => ((lng + 120) / 128) * MW;
const py = (lat: number) => ((50 - lat) / 92) * MH;

/** El recuadro ampliado de España, abajo a la derecha. */
const LUPA = { x: 600, y: 430, w: 380, h: 250, lng0: -10, lng1: 4.5, lat0: 35.5, lat1: 44.2 };
const lx = (lng: number) => LUPA.x + ((lng - LUPA.lng0) / (LUPA.lng1 - LUPA.lng0)) * LUPA.w;
const ly = (lat: number) => LUPA.y + ((LUPA.lat1 - lat) / (LUPA.lat1 - LUPA.lat0)) * LUPA.h;

/** Dónde va cada etiqueta para que no se pisen. */
const LADO: Record<string, [number, number, 'start' | 'end']> = {
  Medellín: [-12, -6, 'end'],
  Cali: [-12, 10, 'end'],
  Bogotá: [12, 2, 'start'],
  Caracas: [12, -4, 'start'],
  Quito: [-12, 6, 'end'],
  Lima: [-12, 4, 'end'],
  Guadalajara: [-12, 4, 'end'],
  'Ciudad de México': [12, 6, 'start'],
  Santiago: [-12, 4, 'end'],
  'Córdoba (AR)': [12, -8, 'start'],
  'Buenos Aires': [12, 2, 'start'],
  Montevideo: [12, 14, 'start'],
  Vigo: [-12, 4, 'end'],
  Bilbao: [12, -4, 'start'],
  Barcelona: [12, 4, 'start'],
  Madrid: [12, 4, 'start'],
  Valencia: [12, 4, 'start'],
  Sevilla: [-12, 4, 'end'],
  Málaga: [12, 10, 'start'],
};

export function Mapa({ activa, estatica }: { activa: boolean; estatica: boolean }) {
  const { estado, cambiar } = useClase();
  const [puntos, setPuntos] = useState<number[] | null>(tierra);
  useEffect(() => {
    if (!puntos) cargarTierra().then(setPuntos).catch(() => {});
  }, [puntos]);

  const encendidas = new Set(estado.ciudades);
  const alternar = (n: string) =>
    cambiar((e) => ({ ...e, ciudades: e.ciudades.includes(n) ? e.ciudades.filter((c) => c !== n) : [...e.ciudades, n] }));

  const origen = { x: lx(-3.7), y: ly(40.42) };
  const esp = { x: px(-4), y: py(40) };

  const tierraMain: ReactNode[] = [];
  const tierraLupa: ReactNode[] = [];
  if (puntos) {
    for (let i = 0; i < puntos.length; i += 2) {
      const lng = puntos[i];
      const lat = puntos[i + 1];
      tierraMain.push(<circle key={i} cx={px(lng)} cy={py(lat)} r={2.3} />);
      if (lng >= LUPA.lng0 && lng <= LUPA.lng1 && lat >= LUPA.lat0 && lat <= LUPA.lat1)
        tierraLupa.push(<circle key={i} cx={lx(lng)} cy={ly(lat)} r={6} />);
    }
  }

  const latam = CIUDADES.filter((c) => c.zona === 'latam');
  const es = CIUDADES.filter((c) => c.zona === 'es');

  return (
    <div className={css.mapa}>
      <svg viewBox={`0 0 ${MW} ${MH}`} className={css.mapaSvg}>
        <g className={css.tierra}>{tierraMain}</g>
        {/* el recuadro de España */}
        <path d={`M${esp.x} ${esp.y} L${LUPA.x + LUPA.w * 0.55} ${LUPA.y}`} className={css.lupaLinea} />
        <circle cx={esp.x} cy={esp.y} r={16} className={css.lupaFoco} />
        <rect x={LUPA.x - 14} y={LUPA.y - 14} width={LUPA.w + 28} height={LUPA.h + 28} rx={22} className={css.lupaCaja} />
        <g className={css.tierraLupa}>{tierraLupa}</g>
        <text x={LUPA.x} y={LUPA.y - 26} className={css.mapaZona}>
          España
        </text>
        <text x={40} y={300} className={css.mapaZona}>
          Latinoamérica
        </text>
        {/* arcos desde Madrid a cada ciudad encendida de Latam */}
        {latam
          .filter((c) => encendidas.has(c.nombre))
          .map((c) => {
            const x = px(c.lng);
            const y = py(c.lat);
            const cx = (esp.x + x) / 2;
            const cy = Math.min(esp.y, y) - 160;
            return <path key={c.nombre} d={`M${esp.x} ${esp.y} Q${cx} ${cy} ${x} ${y}`} className={css.arco} />;
          })}
        {[...latam.map((c) => ({ c, x: px(c.lng), y: py(c.lat) })), ...es.map((c) => ({ c, x: lx(c.lng), y: ly(c.lat) }))].map(({ c, x, y }, i) => {
          const on = encendidas.has(c.nombre);
          const [dx, dy, ancla] = LADO[c.nombre] ?? [12, 4, 'start'];
          return (
            <g
              key={c.nombre}
              className={`${css.pin} ${on ? css.pinOn : ''}`}
              onClick={() => alternar(c.nombre)}
              style={{ '--d': `${0.4 + i * 0.05}s` } as CSSProperties}
            >
              <circle cx={x} cy={y} r={22} className={css.pinZona} />
              {on && !estatica && activa && <circle cx={x} cy={y} r={8} className={css.pinOnda} />}
              <circle cx={x} cy={y} r={on ? 7 : 5} className={css.pinPunto} />
              <text x={x + dx} y={y + dy} textAnchor={ancla} className={css.pinTexto}>
                {c.nombre}
              </text>
            </g>
          );
        })}
        <circle cx={origen.x} cy={origen.y} r={0} />
      </svg>
      <div className={css.mapaPie}>
        <span>
          Nos ves desde <b>{encendidas.size + estado.otras}</b> {encendidas.size + estado.otras === 1 ? 'sitio' : 'sitios'}
        </span>
        <button type="button" className={css.mini} onClick={() => cambiar((e) => ({ ...e, otras: e.otras + 1 }))}>
          + otro sitio
        </button>
        {(encendidas.size > 0 || estado.otras > 0) && (
          <button type="button" className={css.miniSuave} onClick={() => cambiar((e) => ({ ...e, ciudades: [], otras: 0 }))}>
            borrar
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================== cuerpo */

export type Punto = { x: number; y: number; etiqueta?: string; lado?: 'izq' | 'der'; tono?: 'oro' | 'rojo' };

const SILUETA =
  'M100 70 C72 70 58 78 54 96 L42 192 C40 203 48 207 52 196 L66 116 L68 222 L72 418 C72 430 90 430 90 418 L96 252 L104 252 L110 418 C110 430 128 430 128 418 L132 222 L134 116 L148 196 C152 207 160 203 158 192 L146 96 C142 78 128 70 100 70 Z';

/** Silueta de línea fina con puntos que laten. Pulsar un punto lo destaca. */
export function Cuerpo({
  puntos,
  on,
  linfa = false,
  oscuro = false,
  className,
}: {
  puntos: Punto[];
  on: boolean;
  linfa?: boolean;
  oscuro?: boolean;
  className?: string;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  return (
    <svg viewBox="0 0 200 440" className={`${css.cuerpo} ${oscuro ? css.cuerpoOscuro : ''} ${className ?? ''}`}>
      <circle cx="100" cy="40" r="25" className={css.silueta} />
      <path d="M92 64 L92 72 M108 64 L108 72" className={css.silueta} />
      <path d={SILUETA} className={css.silueta} />
      {linfa && (
        <g className={css.linfa}>
          <path id="via-izq" d="M94 68 L76 112 L88 190 L86 240 L84 330 L82 410" />
          <path id="via-der" d="M106 68 L124 112 L112 190 L114 240 L116 330 L118 410" />
          {on &&
            [0, 1, 2, 3, 4].map((k) => (
              <Fragment key={k}>
                <circle r="2.6" className={css.linfaGota}>
                  <animateMotion dur="5s" begin={`${k}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                    <mpath href="#via-izq" />
                  </animateMotion>
                </circle>
                <circle r="2.6" className={css.linfaGota}>
                  <animateMotion dur="5s" begin={`${k + 0.5}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                    <mpath href="#via-der" />
                  </animateMotion>
                </circle>
              </Fragment>
            ))}
          {[
            [94, 68],
            [106, 68],
            [76, 112],
            [124, 112],
            [100, 186],
            [86, 240],
            [114, 240],
            [84, 330],
            [116, 330],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4.5} className={`${css.ganglio} ${on ? css.on : ''}`} style={{ '--d': `${0.3 + i * 0.12}s` } as CSSProperties} />
          ))}
        </g>
      )}
      {puntos.map((p, i) => (
        <g
          key={i}
          className={`${css.punto} ${p.tono === 'rojo' ? css.puntoRojo : ''} ${on ? css.on : ''} ${foco === i ? css.puntoFoco : ''}`}
          style={{ '--d': `${0.5 + i * 0.25}s` } as CSSProperties}
          onClick={() => setFoco(foco === i ? null : i)}
        >
          <circle cx={p.x} cy={p.y} r={22} className={css.puntoHalo} />
          <circle cx={p.x} cy={p.y} r={6} className={css.puntoCentro} />
          {p.etiqueta && (
            <>
              <path d={`M${p.x + (p.lado === 'izq' ? -10 : 10)} ${p.y} L${p.lado === 'izq' ? 18 : 182} ${p.y}`} className={css.puntoLinea} />
              <text x={p.lado === 'izq' ? 14 : 186} y={p.y + 4} textAnchor={p.lado === 'izq' ? 'end' : 'start'} className={css.puntoTexto}>
                {p.etiqueta}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ====================================================== antes / después */

/**
 * Comparador que se arrastra. Al encenderse, la línea barre sola hasta la
 * mitad; después, Sorela puede arrastrarla (o pulsar en cualquier punto).
 */
export function AntesDespues({ antes, despues, on, alto = 520, className }: { antes: string; despues: string; on: boolean; alto?: number; className?: string }) {
  const [pos, setPos] = useState(on ? 50 : 100);
  const caja = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  useEffect(() => {
    if (!on) {
      setPos(100);
      return;
    }
    const t = setTimeout(() => setPos(50), 350);
    return () => clearTimeout(t);
  }, [on]);
  const mover = (clientX: number) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={caja}
      className={`${css.ad} ${arrastrando.current ? css.adMueve : ''} ${className ?? ''}`}
      style={{ height: alto, '--pos': `${pos}%` } as CSSProperties}
      onPointerDown={(e) => {
        e.stopPropagation();
        arrastrando.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        mover(e.clientX);
      }}
      onPointerMove={(e) => arrastrando.current && mover(e.clientX)}
      onPointerUp={() => (arrastrando.current = false)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={despues} alt="Después" className={css.adImg} draggable={false} />
      <div className={css.adAntes}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={antes} alt="Antes" className={css.adImg} draggable={false} />
      </div>
      <div className={css.adLinea}>
        <span className={css.adMango}>‹ ›</span>
      </div>
      <span className={`${css.adEtiqueta} ${css.adIzq}`}>Antes</span>
      <span className={`${css.adEtiqueta} ${css.adDer}`}>Después</span>
    </div>
  );
}

/* ============================================================== plazas */

/** Las 10 plazas de fundadora. Pulsar una la llena (o la vacía). Compartido entre ventanas. */
export function Plazas({ grande = false, on = true }: { grande?: boolean; on?: boolean }) {
  const { estado, cambiar } = useClase();
  return (
    <div className={`${css.plazas} ${grande ? css.plazasGrande : ''}`}>
      {Array.from({ length: PLAZAS }, (_, i) => {
        const llena = i < estado.plazas;
        return (
          <button
            key={i}
            type="button"
            className={`${css.plaza} ${llena ? css.plazaLlena : ''} ${on ? css.on : ''}`}
            style={{ '--d': `${0.2 + i * 0.06}s` } as CSSProperties}
            onClick={(e) => {
              e.stopPropagation();
              cambiar((s) => ({ ...s, plazas: llena && i === s.plazas - 1 ? i : i + 1 }));
            }}
            aria-label={`Plaza ${i + 1}`}
          >
            {llena ? <Icono n="check" className={css.plazaCheck} /> : i + 1}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================== móvil */

export function Movil({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${css.movil} ${className ?? ''}`}>
      <div className={css.movilIsla} />
      <div className={css.movilPantalla}>{children}</div>
    </div>
  );
}

/** Va soltando `n` elementos, uno cada `ms`, mientras la diapositiva está activa. Vuelve a empezar al volver. */
export function useGoteo(n: number, activa: boolean, ms = 1100, inicio = 600, semilla = 0) {
  const [k, setK] = useState(0);
  useEffect(() => {
    setK(0);
    if (!activa) return;
    let i = 0;
    let id: ReturnType<typeof setTimeout>;
    const sig = () => {
      i++;
      setK(i);
      if (i < n) id = setTimeout(sig, ms);
    };
    id = setTimeout(sig, inicio);
    return () => clearTimeout(id);
  }, [n, activa, ms, inicio, semilla]);
  return k;
}

/* ======================================================= vídeo emergente */

export function VideoModal({ src, onCerrar }: { src: string; onCerrar: () => void }) {
  return (
    <div
      className={css.modal}
      onClick={(e) => {
        e.stopPropagation();
        onCerrar();
      }}
    >
      <video src={src} className={css.modalVideo} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
