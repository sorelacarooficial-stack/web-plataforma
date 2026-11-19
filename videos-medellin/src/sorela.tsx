import React from 'react';
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import PLANOS from './planos.json';
import { Pildora, useFormato, useU } from './piezas';
import { C, FPS, fluida, mezcla, suave, tramo } from './tema';

export type IdPlano = keyof typeof PLANOS;
type Palabra = { t: string; a: number; b: number };

export const framesDe = (id: IdPlano) => Math.ceil(PLANOS[id].dura * FPS);

/* ───────────── Subtítulos palabra a palabra ───────────── */

/** Agrupa las palabras en frases cortas: corta en la puntuación, a las 4 palabras o en una pausa. */
const grupos = (ws: Palabra[]) => {
  const out: Palabra[][] = [];
  let g: Palabra[] = [];
  ws.forEach((w, i) => {
    g.push(w);
    const sig = ws[i + 1];
    if (/[.,:;?!]$/.test(w.t) || g.length >= 4 || (sig && sig.a - w.b > 0.35) || !sig) {
      out.push(g);
      g = [];
    }
  });
  return out;
};

/** Palabras que se marcan en oro cuando suenan (las ideas clave de cada frase). */
const CLAVE = /^(sorela|caro|divine|treinta|años|manos|observar|interpretar|decidir|tocar|cambio|práctica|hacer|cuerpo|aplicar|frena)/i;

export const Subtitulos: React.FC<{ id: IdPlano; desde: number; y: number }> = ({ id, desde, y }) => {
  const f = useCurrentFrame();
  const u = useU();
  const t = (f - desde) / FPS;
  const gs = grupos(PLANOS[id].palabras as Palabra[]);
  const actual = gs.find((g, i) => t >= g[0].a - 0.08 && (i === gs.length - 1 || t < gs[i + 1][0].a - 0.08));
  if (!actual || t > PLANOS[id].dura + 0.2) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: `translateY(${y * u}px)`, display: 'flex', justifyContent: 'center', padding: `0 ${70 * u}px` }}>
      <div
        style={{
          fontFamily: 'Inter',
          fontSize: 64 * u,
          lineHeight: 1.12,
          letterSpacing: '-0.035em',
          textAlign: 'center',
          color: C.crema,
          textShadow: '0 4px 30px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        {actual.map((w, i) => {
          const e = Math.min(1, Math.max(0, (t - w.a + 0.1) / 0.18));
          const k = suave(e);
          const sonando = t >= w.a && t <= w.b + 0.15;
          const clave = CLAVE.test(w.t);
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.24em',
                opacity: k,
                filter: `blur(${(1 - k) * 12 * u}px)`,
                transform: `translateY(${(1 - k) * 0.35}em) scale(${mezcla(1.15, 1, k) * (sonando ? 1.04 : 1)})`,
                fontWeight: clave ? 600 : 400,
                ...(clave ? { background: 'linear-gradient(120deg,#f6dfb5,#e2b876 50%,#f3d9ae)', WebkitBackgroundClip: 'text', color: 'transparent', textShadow: 'none', filter: `blur(${(1 - k) * 12 * u}px) drop-shadow(0 4px 18px rgba(0,0,0,0.6))` } : {}),
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

/* ───────────── Escenario 3D ───────────── */

/**
 * Una cámara que entra en perspectiva entre capas: palabra gigante al fondo,
 * aros de oro en medio, la tarjeta de cristal con Sorela hablando (con su
 * reflejo en el suelo) y etiquetas de cristal delante. Cada capa está a otra
 * profundidad, así que al moverse la cámara se separan (paralaje real).
 */
export const EscenarioSorela: React.FC<{
  id: IdPlano;
  dura: number;
  /** Fotograma del plano en el que arranca su voz. */
  voz?: number;
  fondo: string;
  chips?: { t: string; x: number; y: number; desde: number }[];
  giro?: 1 | -1;
}> = ({ id, dura, voz = 6, fondo, chips = [], giro = 1 }) => {
  const f = useCurrentFrame();
  const u = useU();
  const { horizontal, historia } = useFormato();
  const { height } = useVideoConfig();
  // Cámara: entra rápido desde lejos (gancho del primer segundo) y luego deriva despacio.
  const entra = tramo(f, 0, 26);
  const deriva = interpolate(f, [0, dura], [0, 1]);
  const camZ = mezcla(-1500, 0, entra) + deriva * 160;
  const camRY = mezcla(18 * giro, 0, entra) - deriva * 5 * giro;
  const camRX = mezcla(-8, 0, entra) + deriva * 1.5;
  const w = horizontal ? 560 : historia ? 820 : 600;
  const h = horizontal ? 760 : historia ? 1120 : 840;
  const cy = horizontal ? 0 : historia ? -90 : -60;
  const brillo = interpolate(f, [10, 70], [-50, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tarjeta = (reflejo: boolean) => (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: w * u,
        height: h * u,
        marginLeft: (-w / 2) * u,
        marginTop: (-h / 2 + cy) * u + (reflejo ? h * u + 24 * u : 0),
        borderRadius: 46 * u,
        overflow: 'hidden',
        transform: reflejo ? 'scaleY(-1)' : undefined,
        opacity: reflejo ? 0.22 : 1,
        WebkitMaskImage: reflejo ? 'linear-gradient(to top, rgba(0,0,0,0.9), transparent 45%)' : undefined,
        boxShadow: reflejo ? undefined : `0 ${60 * u}px ${140 * u}px rgba(40,25,5,0.45), 0 0 0 ${2 * u}px rgba(243,217,174,0.55), 0 0 ${60 * u}px rgba(201,154,92,0.25)`,
        background: C.banda,
      }}
    >
      <OffthreadVideo src={staticFile(`media/planos/${id}.mp4`)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%', transform: `scale(${1.08 - deriva * 0.05})` }} />
      {!reflejo && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(10,8,5,0.72) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(112deg, transparent ${brillo - 22}%, rgba(255,255,255,0.32) ${brillo}%, transparent ${brillo + 14}%)`, mixBlendMode: 'soft-light' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 46 * u, boxShadow: `inset 0 0 0 ${1.5 * u}px rgba(255,255,255,0.4)` }} />
        </>
      )}
    </div>
  );
  return (
    <AbsoluteFill style={{ perspective: 1500 * u, perspectiveOrigin: '50% 45%' }}>
      <AbsoluteFill style={{ transformStyle: 'preserve-3d', transform: `translateZ(${camZ * u}px) rotateY(${camRY}deg) rotateX(${camRX}deg)` }}>
        {/* Capa del fondo: palabra gigante */}
        <AbsoluteFill style={{ transform: `translateZ(${-1300 * u}px)`, alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: (horizontal ? 520 : 600) * u,
              letterSpacing: '-0.06em',
              whiteSpace: 'nowrap',
              background: 'linear-gradient(170deg, rgba(201,154,92,0.55), rgba(138,106,50,0.12) 80%)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              transform: `translateX(${(0.5 - deriva) * 260 * giro * u}px)`,
            }}
          >
            {fondo}
          </div>
        </AbsoluteFill>
        {/* Capa media: aros de oro */}
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: (w + 260 + i * 220) * u,
              height: (w + 260 + i * 220) * u,
              marginLeft: (-(w + 260 + i * 220) / 2) * u,
              marginTop: (-(w + 260 + i * 220) / 2 + cy) * u,
              borderRadius: '50%',
              border: `${1.5 * u}px solid rgba(201,154,92,${0.45 - i * 0.18})`,
              transform: `translateZ(${(-500 - i * 250) * u}px) rotateX(${68 + i * 6}deg) rotateZ(${f * (0.5 + i * 0.3)}deg)`,
              opacity: tramo(f, 6 + i * 6, 24),
            }}
          />
        ))}
        {/* Reflejo en el suelo y tarjeta */}
        <AbsoluteFill style={{ transform: `translateZ(0px) rotateY(${-6 * giro}deg)` }}>
          {tarjeta(true)}
          {tarjeta(false)}
        </AbsoluteFill>
        {/* Delante: etiquetas de cristal */}
        <AbsoluteFill style={{ transform: `translateZ(${140 * u}px)` }}>
          {chips.map((c) => (
            <div key={c.t} style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) translate(${c.x * u}px, ${(c.y * (h / 1120) + Math.sin((f + c.x) / 30) * 8) * u}px)` }}>
              <Pildora texto={c.t} desde={c.desde} />
            </div>
          ))}
        </AbsoluteFill>
      </AbsoluteFill>
      {/* Subtítulos en el plano de la pantalla (no se deforman con la cámara) */}
      <Subtitulos id={id} desde={voz} y={horizontal ? 250 : historia ? (h / 2 + cy - 230) : (h / 2 + cy - 190)} />
      <Sequence from={voz} durationInFrames={framesDe(id) + 2}>
        <Audio src={staticFile(`media/planos/${id}.wav`)} volume={1} />
      </Sequence>
      <div style={{ display: 'none' }}>{height}</div>
    </AbsoluteFill>
  );
};

/** Duración de un plano con voz: un respiro antes y una cola después. */
export const duraVoz = (id: IdPlano, antes = 6, cola = 16) => antes + framesDe(id) + cola;

export { fluida };
