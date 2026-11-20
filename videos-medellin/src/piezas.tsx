import React from 'react';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, fluida, mezcla, suave, tramo } from './tema';

/** Unidad de medida: 1 en 1080 de ancho vertical; se encoge en horizontal. */
export const useU = () => {
  const { width, height } = useVideoConfig();
  // En horizontal todo un 25 % más grande: si no, en 16:9 queda diminuto.
  return Math.min(width / 1080, height / 1350) * (width > height ? 1.25 : 1);
};
export const useFormato = () => {
  const { width, height } = useVideoConfig();
  const r = height / width;
  return { horizontal: r < 1, historia: r > 1.6, feed: r >= 1 && r <= 1.6, width, height };
};

export const media = (n: string) => staticFile(`media/${n}`);

/* ───────────────────────── Fondo ───────────────────────── */

export const Grano: React.FC<{ fuerza?: number }> = ({ fuerza = 0.07 }) => {
  const f = useCurrentFrame();
  const semilla = Math.floor(f / 2) % 7;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: fuerza }}>
      <svg width="100%" height="100%">
        <filter id={`g${semilla}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={semilla} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${semilla})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Fondo: React.FC<{ oscuro?: boolean }> = ({ oscuro }) => {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 90) * 18;
  const y = 30 + Math.cos(f / 110) * 10;
  const base = oscuro ? C.banda : C.crema;
  const luz = oscuro ? 'rgba(201,154,92,0.22)' : 'rgba(255,255,255,0.95)';
  const sombra = oscuro ? 'rgba(0,0,0,0.55)' : 'rgba(138,106,50,0.13)';
  return (
    <AbsoluteFill style={{ background: base }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 45% at ${x}% ${y}%, ${luz}, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 50%, transparent 55%, ${sombra} 100%)` }} />
      <Grano fuerza={oscuro ? 0.1 : 0.06} />
    </AbsoluteFill>
  );
};

/* ───────────────────────── Texto palabra a palabra ───────────────────────── */

type Trozo = { t: string; fuerte: boolean; pegado?: boolean };
/** «una **palabra** clave» → trozos; lo que va entre ** sale en 600. */
const trocear = (s: string): Trozo[][] =>
  s.split('\n').map((linea) => {
    const out: Trozo[] = [];
    linea.split(/(\*\*[^*]+\*\*)/).forEach((p) => {
      if (!p) return;
      const fuerte = p.startsWith('**');
      const limpio = fuerte ? p.slice(2, -2) : p;
      limpio.split(/(\s+)/).forEach((w) => {
        if (!w.trim()) return;
        // La puntuación suelta va pegada a la palabra anterior («método.»).
        if (/^[.,;:!?…]+$/.test(w)) out.push({ t: w, fuerte, pegado: true });
        else out.push({ t: w, fuerte });
      });
    });
    return out;
  });

export const Titular: React.FC<{
  texto: string;
  desde?: number;
  hasta?: number;
  tam?: number;
  color?: string;
  oro?: boolean;
  alinear?: 'left' | 'center';
  paso?: number;
  ancho?: number;
  peso?: number;
  style?: React.CSSProperties;
}> = ({ texto, desde = 0, hasta, tam = 96, color = C.tinta, oro, alinear = 'left', paso = 3, ancho, peso = 300, style }) => {
  const f = useCurrentFrame();
  const u = useU();
  const lineas = trocear(texto);
  let i = 0;
  const salida = hasta === undefined ? 0 : tramo(f, hasta, 12, fluida);
  return (
    <div
      style={{
        fontFamily: 'Inter',
        fontSize: tam * u,
        lineHeight: 1.04,
        letterSpacing: '-0.04em',
        fontWeight: peso,
        color,
        textAlign: alinear,
        maxWidth: ancho ? ancho * u : undefined,
        opacity: 1 - salida,
        filter: salida > 0 ? `blur(${salida * 18 * u}px)` : undefined,
        transform: `translateY(${-salida * 30 * u}px)`,
        ...style,
      }}
    >
      {lineas.map((l, li) => (
        <div key={li} style={{ display: 'block' }}>
          {l.map((w, wi) => {
            const k = w.pegado ? i - 1 : i++;
            const sigPegado = l[wi + 1]?.pegado;
            const t = tramo(f, desde + k * paso, 16);
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  marginRight: sigPegado ? 0 : '0.24em',
                  opacity: t,
                  filter: `blur(${(1 - t) * 16 * u}px)`,
                  transform: `translateY(${(1 - t) * 0.45}em) scale(${mezcla(1.12, 1, t)})`,
                  transformOrigin: '50% 80%',
                  fontWeight: w.fuerte ? 600 : peso,
                  ...(w.fuerte && oro
                    ? { background: 'linear-gradient(120deg,#b8894a,#e9c690 45%,#a87b3f)', WebkitBackgroundClip: 'text', color: 'transparent' }
                    : {}),
                }}
              >
                {w.t}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Texto pequeño en mayúsculas espaciadas (etiquetas), 400. */
export const Antetitulo: React.FC<{ texto: string; desde?: number; color?: string; tam?: number; style?: React.CSSProperties }> = ({
  texto,
  desde = 0,
  color = C.oro,
  tam = 26,
  style,
}) => {
  const f = useCurrentFrame();
  const u = useU();
  const t = tramo(f, desde, 22);
  return (
    <div
      style={{
        fontFamily: 'Inter',
        fontWeight: 500,
        fontSize: tam * u,
        letterSpacing: `${mezcla(0.6, 0.22, t)}em`,
        textTransform: 'uppercase',
        color,
        opacity: t,
        filter: `blur(${(1 - t) * 8}px)`,
        ...style,
      }}
    >
      {texto}
    </div>
  );
};

/* ───────────────────────── Cristal ───────────────────────── */

export const Pildora: React.FC<{ texto: string; desde?: number; oscuro?: boolean; tam?: number; punto?: boolean; style?: React.CSSProperties }> = ({
  texto,
  desde = 0,
  oscuro,
  tam = 30,
  punto = true,
  style,
}) => {
  const f = useCurrentFrame();
  const u = useU();
  const t = tramo(f, desde, 20);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14 * u,
        padding: `${16 * u}px ${28 * u}px`,
        borderRadius: 999,
        background: oscuro ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
        border: `1px solid ${oscuro ? 'rgba(243,217,174,0.35)' : 'rgba(255,255,255,0.9)'}`,
        boxShadow: oscuro ? '0 10px 40px rgba(0,0,0,0.35)' : '0 18px 50px rgba(80,60,30,0.16), inset 0 1px 0 rgba(255,255,255,0.9)',
        backdropFilter: 'blur(18px) saturate(1.4)',
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: tam * u,
        letterSpacing: '-0.01em',
        color: oscuro ? C.crema : C.tinta,
        opacity: t,
        transform: `translateY(${(1 - t) * 30 * u}px) scale(${mezcla(0.9, 1, t)})`,
        filter: `blur(${(1 - t) * 10}px)`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {punto && <span style={{ width: 12 * u, height: 12 * u, borderRadius: 99, background: C.degradado, boxShadow: '0 0 14px rgba(201,154,92,0.9)' }} />}
      {texto}
    </div>
  );
};

/* ───────────────────────── Foto en 3D ───────────────────────── */

/**
 * Tarjeta de foto en perspectiva: entra girando desde el fondo, flota y se
 * va. Lleva un brillo de cristal que barre y desenfoque de movimiento
 * proporcional a la velocidad (real: se calcula fotograma a fotograma).
 */
export const Tarjeta3D: React.FC<{
  src: string;
  video?: boolean;
  desde?: number;
  dura?: number;
  x?: number;
  y?: number;
  w: number;
  h: number;
  giro?: number;
  inclina?: number;
  z?: number;
  radio?: number;
  enfoque?: string;
  desdeLado?: 1 | -1;
  sinSalida?: boolean;
  zoom?: number;
}> = ({ src, video, desde = 0, dura = 90, x = 0, y = 0, w, h, giro = -10, inclina = 4, z = 0, radio = 36, enfoque = '50% 30%', desdeLado = 1, sinSalida, zoom = 1.12 }) => {
  const f = useCurrentFrame();
  const u = useU();
  const pos = (fr: number) => {
    const e = tramo(fr, desde, 26);
    const s = sinSalida ? 0 : tramo(fr, desde + dura - 14, 14, fluida);
    return {
      e,
      s,
      tx: (1 - e) * 520 * desdeLado * u - s * 420 * desdeLado * u,
      ry: mezcla(giro + 38 * desdeLado, giro, e) + Math.sin((fr - desde) / 40) * 2.5 - s * 30 * desdeLado,
      tz: mezcla(-600, z, e) + (fr - desde) * 0.35,
    };
  };
  const p = pos(f);
  const vel = Math.abs(pos(f + 0.5).tx - pos(f - 0.5).tx);
  const blurX = Math.min(vel * 0.45, 40);
  const id = `mb${Math.round(x)}${Math.round(y)}${desde}`;
  const brillo = interpolate(f - desde, [8, 50], [-60, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (f < desde - 1 || (!sinSalida && f > desde + dura + 2)) return null;
  const dentro = { width: '100%', height: '100%', objectFit: 'cover' as const, objectPosition: enfoque, transform: `scale(${mezcla(zoom, 1, tramo(f, desde, dura, fluida))})` };
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', perspective: 1800 * u, transform: `translate(-50%,-50%) translate(${x * u}px, ${y * u}px)` }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id={id} x="-20%" y="-5%" width="140%" height="110%">
          <feGaussianBlur stdDeviation={`${blurX} 0`} />
        </filter>
      </svg>
      <div
        style={{
          width: w * u,
          height: h * u,
          borderRadius: radio * u,
          overflow: 'hidden',
          transform: `translateX(${p.tx}px) translateZ(${p.tz * u}px) rotateY(${p.ry}deg) rotateX(${inclina}deg)`,
          opacity: Math.min(1, p.e * 1.4) * (1 - p.s),
          boxShadow: `0 ${50 * u}px ${120 * u}px rgba(60,40,15,0.30), 0 ${10 * u}px ${30 * u}px rgba(60,40,15,0.18)`,
          filter: blurX > 0.6 ? `url(#${id})` : undefined,
          background: C.crema2,
          position: 'relative',
        }}
      >
        {video ? <OffthreadVideo src={src} muted style={dentro} /> : <Img src={src} style={dentro} />}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(110deg, transparent ${brillo - 30}%, rgba(255,255,255,0.28) ${brillo}%, transparent ${brillo + 22}%)`,
            mixBlendMode: 'soft-light',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, borderRadius: radio * u, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)' }} />
      </div>
    </div>
  );
};

/* ───────────────────────── Escena ───────────────────────── */

/**
 * Envoltorio de cada escena: entra y sale con desenfoque, escala y un leve
 * giro en 3D (el «empujón de cámara»). Las escenas se solapan unos
 * fotogramas, así el cambio es un fundido desenfocado, no un corte.
 */
export const Escena: React.FC<{ dura: number; children: React.ReactNode; oscuro?: boolean; empuje?: number; sinFondo?: boolean }> = ({
  dura,
  children,
  oscuro,
  empuje = 0.05,
  sinFondo,
}) => {
  const f = useCurrentFrame();
  const e = tramo(f, 0, 14);
  const s = tramo(f, dura - 12, 12, fluida);
  const escala = mezcla(1.06, 1, e) * (1 + (f / dura) * empuje) * mezcla(1, 1.08, s);
  return (
    <AbsoluteFill
      style={{
        opacity: e * (1 - s),
        filter: e < 1 || s > 0 ? `blur(${(1 - e) * 22 + s * 22}px)` : undefined,
        transform: `scale(${escala})`,
      }}
    >
      {!sinFondo && <Fondo oscuro={oscuro} />}
      {children}
    </AbsoluteFill>
  );
};

/* ───────────────────────── Cierre oscuro por capas ───────────────────────── */

export const Cierre: React.FC<{ dura: number; titular?: string; boton?: string }> = ({
  dura,
  titular = 'Medellín\n**28, 29 y 30 de enero**',
  boton = 'Reserva tu plaza',
}) => {
  const f = useCurrentFrame();
  const u = useU();
  const { horizontal } = useFormato();
  const capas = ['#3a3125', '#262019', C.banda];
  const shimmer = interpolate(f, [40, 80], [-40, 140], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logo = tramo(f, 20, 30);
  return (
    <AbsoluteFill>
      {capas.map((c, i) => {
        const t = tramo(f, i * 5, 22, suave);
        return <AbsoluteFill key={i} style={{ background: c, transform: `translateY(${(1 - t) * 105}%)`, borderRadius: `${(1 - t) * 80}px ${(1 - t) * 80}px 0 0` }} />;
      })}
      <AbsoluteFill style={{ opacity: tramo(f, 14, 20) }}>
        <Fondo oscuro />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 46 * u, padding: 80 * u }}>
        <Img
          src={media('logo-oro.webp')}
          style={{
            width: (horizontal ? 360 : 460) * u,
            opacity: logo,
            filter: `blur(${(1 - logo) * 14}px) drop-shadow(0 0 ${30 * logo}px rgba(201,154,92,0.45))`,
            transform: `scale(${mezcla(1.25, 1, logo)})`,
          }}
        />
        <Titular texto={titular} desde={30} tam={horizontal ? 64 : 84} color={C.crema} oro alinear="center" />
        <div style={{ width: 120 * u * tramo(f, 44, 26), height: 1, background: C.degradado }} />
        <Antetitulo texto="Formación presencial para terapeutas · 10 plazas" desde={50} color={C.oroClaro} tam={26} />
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 999, opacity: tramo(f, 60, 20), transform: `translateY(${(1 - tramo(f, 60, 20)) * 30}px)` }}>
          <div
            style={{
              padding: `${26 * u}px ${56 * u}px`,
              background: C.degradado,
              color: C.tinta,
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: 40 * u,
              letterSpacing: '-0.02em',
              boxShadow: '0 20px 60px rgba(201,154,92,0.35)',
            }}
          >
            {boton}
          </div>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, transparent ${shimmer - 20}%, rgba(255,255,255,0.65) ${shimmer}%, transparent ${shimmer + 20}%)` }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: tramo(f, dura - 8, 8, fluida) * 0.0 }} />
    </AbsoluteFill>
  );
};
