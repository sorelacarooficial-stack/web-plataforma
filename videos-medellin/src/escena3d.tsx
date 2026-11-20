import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { media, Pildora, useFormato, useU } from './piezas';
import { C, FPS, mezcla, suave, tramo } from './tema';

/* ───────────── Guion palabra a palabra ───────────── */

export type Palabra = { t: string; a: number; b: number };

/**
 * Tiempos de cada palabra de una frase (en segundos desde el inicio del
 * plano). Si llega una locución, se usan los tiempos de su transcripción;
 * si no, se calculan a un ritmo de lectura cómodo (pausa en la puntuación).
 */
export const tiempos = (frase: string, desde = 0.45): Palabra[] => {
  let t = desde;
  return frase.split(/\s+/).filter(Boolean).map((w) => {
    const dura = 0.13 + 0.045 * w.replace(/[^\p{L}\d]/gu, '').length;
    const p = { t: w, a: t, b: t + dura };
    t += dura + (/[.!?]$/.test(w) ? 0.42 : /[,:;]$/.test(w) ? 0.22 : 0.05);
    return p;
  });
};

/** Fotogramas que necesita una frase para leerse entera, con respiro al final. */
export const framesFrase = (frase: string) => {
  const ws = tiempos(frase);
  return Math.ceil((ws[ws.length - 1].b + 0.9) * FPS);
};

const grupos = (ws: Palabra[]) => {
  const out: Palabra[][] = [];
  let g: Palabra[] = [];
  ws.forEach((w, i) => {
    g.push(w);
    const sig = ws[i + 1];
    if (/[.,:;?!]$/.test(w.t) || g.length >= 4 || !sig) {
      out.push(g);
      g = [];
    }
  });
  return out;
};

/** Palabras que se encienden en oro (las ideas clave). */
const CLAVE = /^(treinta|veinticinco|casos|divine|persona|manos|leer|cuerpo|observar|criterio|medellín|enero|diez|10|plazas|una|mirarte|corregir|método|certifícate|certificación|conmigo|presencial|lado)/i;

export const Subtitulos: React.FC<{ palabras: Palabra[]; y: number; sobreCrema?: boolean }> = ({ palabras, y, sobreCrema }) => {
  const f = useCurrentFrame();
  const u = useU();
  const t = f / FPS;
  const gs = grupos(palabras);
  const actual = gs.find((g, i) => t >= g[0].a - 0.1 && (i === gs.length - 1 || t < gs[i + 1][0].a - 0.1));
  if (!actual) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: `translateY(${y * u}px)`, display: 'flex', justifyContent: sobreCrema ? 'flex-start' : 'center', padding: `0 ${(sobreCrema ? 130 : 70) * u}px` }}>
      <div style={{ fontFamily: 'Inter', fontSize: (sobreCrema ? 76 : 66) * u, lineHeight: 1.1, letterSpacing: '-0.035em', textAlign: sobreCrema ? 'left' : 'center', color: sobreCrema ? C.tinta : C.crema, maxWidth: sobreCrema ? 760 * u : undefined }}>
        {actual.map((w, i) => {
          const k = suave(Math.min(1, Math.max(0, (t - w.a + 0.1) / 0.2)));
          const clave = CLAVE.test(w.t);
          const sombra = sobreCrema ? '' : `drop-shadow(0 ${4 * u}px ${22 * u}px rgba(0,0,0,0.6))`;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.24em',
                opacity: k,
                filter: `blur(${(1 - k) * 12 * u}px) ${sombra}`,
                transform: `translateY(${(1 - k) * 0.35}em) scale(${mezcla(1.15, 1, k)})`,
                fontWeight: clave ? 600 : 400,
                ...(clave ? { background: sobreCrema ? 'linear-gradient(120deg,#b8894a,#8a6a32)' : 'linear-gradient(120deg,#f6dfb5,#e2b876 50%,#f3d9ae)', WebkitBackgroundClip: 'text', color: 'transparent' } : {}),
              }}
            >
              {w.t}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ───────────── Escenario 3D con fotos ───────────── */

/** Etiqueta de cristal: x e y en fracción de la tarjeta (-1 borde izquierdo/superior, 1 derecho/inferior), así nunca se sale del encuadre. */
export type Chip = { t: string; x: number; y: number; desde: number };

/**
 * La cámara entra en perspectiva entre capas (gancho del primer segundo) y
 * luego deriva despacio: palabra gigante al fondo, aros de oro, una segunda
 * foto lejos, la tarjeta de cristal principal con su reflejo en el suelo,
 * etiquetas de cristal delante y el guion palabra a palabra en pantalla.
 */
export const Escena3D: React.FC<{
  dura: number;
  foto: string;
  enfoque?: string;
  segunda?: string;
  enfoque2?: string;
  fondo: string;
  frase?: string;
  chips?: Chip[];
  giro?: 1 | -1;
  /** Primer plano: tarjeta más pequeña y baja para dejar arriba el encabezado. */
  portada?: boolean;
}> = ({ dura, foto, enfoque = '50% 25%', segunda, enfoque2 = '50% 30%', fondo, frase, chips = [], giro = 1, portada }) => {
  const f = useCurrentFrame();
  const u = useU();
  const { horizontal, historia } = useFormato();
  const entra = tramo(f, 0, 26);
  const deriva = interpolate(f, [0, dura], [0, 1]);
  const camZ = mezcla(-1500, 0, entra) + deriva * 170;
  const camRY = mezcla(18 * giro, 0, entra) - deriva * 6 * giro;
  const camRX = mezcla(-8, 0, entra) + deriva * 1.5;
  const k0 = portada ? (horizontal ? 0.9 : historia ? 0.66 : 0.6) : 1;
  const w = (horizontal ? 540 : historia ? 780 : 580) * k0;
  const h = (horizontal ? 740 : historia ? 1080 : 800) * k0;
  const cx = horizontal ? 420 : 0;
  const cy = horizontal ? 0 : portada ? (historia ? 250 : 215) : historia ? -110 : -80;
  const brillo = interpolate(f, [10, 70], [-50, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tarjeta = (src: string, enf: string, reflejo: boolean, k = 1) => (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: w * k * u,
        height: h * k * u,
        marginLeft: (-(w * k) / 2 + cx) * u,
        marginTop: (-(h * k) / 2 + cy) * u + (reflejo ? h * k * u + 24 * u : 0),
        borderRadius: 46 * u,
        overflow: 'hidden',
        transform: reflejo ? 'scaleY(-1)' : undefined,
        opacity: reflejo ? 0.2 : 1,
        WebkitMaskImage: reflejo ? 'linear-gradient(to top, rgba(0,0,0,0.9), transparent 45%)' : undefined,
        boxShadow: reflejo ? undefined : `0 ${60 * u}px ${140 * u}px rgba(40,25,5,0.42), 0 0 0 ${2 * u}px rgba(243,217,174,0.55), 0 0 ${60 * u}px rgba(201,154,92,0.22)`,
        background: C.crema2,
      }}
    >
      <Img src={media(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: enf, transform: `scale(${1.1 - deriva * 0.06})` }} />
      {!reflejo && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(10,8,5,0.6) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(112deg, transparent ${brillo - 22}%, rgba(255,255,255,0.32) ${brillo}%, transparent ${brillo + 14}%)`, mixBlendMode: 'soft-light' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 46 * u, boxShadow: `inset 0 0 0 ${1.5 * u}px rgba(255,255,255,0.4)` }} />
        </>
      )}
    </div>
  );
  // Subtítulos: en vertical, sobre la parte baja de la tarjeta; en horizontal, a la izquierda.
  const ySub = horizontal ? 0 : h / 2 + cy - (historia ? 230 : 190);
  return (
    <AbsoluteFill style={{ perspective: 1500 * u, perspectiveOrigin: '50% 45%' }}>
      <AbsoluteFill style={{ transformStyle: 'preserve-3d', transform: `translateZ(${camZ * u}px) rotateY(${camRY}deg) rotateX(${camRX}deg)` }}>
        <AbsoluteFill style={{ transform: `translateZ(${-1300 * u}px)`, alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: (horizontal ? 500 : 560) * u,
              letterSpacing: '-0.06em',
              whiteSpace: 'nowrap',
              background: portada ? 'linear-gradient(170deg, rgba(201,154,92,0.22), rgba(138,106,50,0.04) 80%)' : 'linear-gradient(170deg, rgba(201,154,92,0.55), rgba(138,106,50,0.1) 80%)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              transform: `translateX(${((0.5 - deriva) * 280 * giro + (horizontal ? cx * 1.6 : 0)) * u}px)`,
            }}
          >
            {fondo}
          </div>
        </AbsoluteFill>
        {[0, 1].map((i) => {
          const d = w + 260 + i * 220;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: d * u,
                height: d * u,
                marginLeft: (-d / 2 + cx) * u,
                marginTop: (-d / 2 + cy) * u,
                borderRadius: '50%',
                border: `${1.5 * u}px solid rgba(201,154,92,${0.45 - i * 0.18})`,
                transform: `translateZ(${(-500 - i * 250) * u}px) rotateX(${68 + i * 6}deg) rotateZ(${f * (0.5 + i * 0.3)}deg)`,
                opacity: tramo(f, 6 + i * 6, 24),
              }}
            />
          );
        })}
        {segunda && (
          <AbsoluteFill style={{ transform: `translateZ(${-620 * u}px) translateX(${-430 * giro * u}px) translateY(${-170 * u}px) rotateY(${16 * giro}deg)`, opacity: 0.92 * tramo(f, 4, 22) }}>
            {tarjeta(segunda, enfoque2, false, 0.8)}
          </AbsoluteFill>
        )}
        <AbsoluteFill style={{ transform: `rotateY(${-6 * giro}deg)` }}>
          {tarjeta(foto, enfoque, true)}
          {tarjeta(foto, enfoque, false)}
        </AbsoluteFill>
        <AbsoluteFill style={{ transform: `translateZ(${140 * u}px)` }}>
          {chips.map((c) => (
            <div
              key={c.t}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(-50%,-50%) translate(${(c.x * w * 0.5 + cx) * u}px, ${(c.y * h * 0.5 + cy + Math.sin((f + c.x * 100) / 30) * 8) * u}px)`,
              }}
            >
              <Pildora texto={c.t} desde={c.desde} />
            </div>
          ))}
        </AbsoluteFill>
      </AbsoluteFill>
      {frase &&
        (horizontal ? (
          <AbsoluteFill style={{ width: '50%' }}>
            <Subtitulos palabras={tiempos(frase)} y={-60} sobreCrema />
          </AbsoluteFill>
        ) : (
          <Subtitulos palabras={tiempos(frase)} y={ySub} />
        ))}
    </AbsoluteFill>
  );
};

/** Duración de un plano con frase: lo que tarda en leerse, con un mínimo. */
export const duraFrase = (frase: string, minimo = 75) => Math.max(minimo, framesFrase(frase) + 10);
