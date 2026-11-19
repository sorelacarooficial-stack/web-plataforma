import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { C, DEGRADADO_ORO, ENTRA_SALE, FPS, INTER, SUAVE } from './marca';
import type { Fila, Guion, Palabra, Tarjeta } from './tipos';

export const CIERRE_S = 3.4;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const t = (s: number) => Math.round(s * FPS);

/* ───────────── Cámara: deriva lenta + acercamientos en las palabras clave ───────────── */

function escalaCamara(seg: number, acercamientos: number[], dur: number) {
  let e = interpolate(seg, [0, dur], [1, 1.025], clamp);
  for (const a of acercamientos) {
    const sube = interpolate(seg, [a - 0.15, a + 0.45], [0, 1], { ...clamp, easing: SUAVE });
    const baja = interpolate(seg, [a + 2.0, a + 2.9], [0, 1], { ...clamp, easing: ENTRA_SALE });
    e += 0.06 * (sube - baja);
  }
  return e;
}

const Camara: React.FC<{ g: Guion }> = ({ g }) => {
  const f = useCurrentFrame();
  const seg = f / FPS;
  const escala = escalaCamara(seg, g.acercamientos, g.duracion);
  // Entrada desde el negro con desenfoque, como un enfoque de cámara.
  const blur = interpolate(f, [0, 14], [18, 0], { ...clamp, easing: SUAVE });
  return (
    <AbsoluteFill style={{ transform: `scale(${escala})`, transformOrigin: '50% 38%', filter: `blur(${blur}px)` }}>
      <OffthreadVideo src={staticFile(g.base)} />
    </AbsoluteFill>
  );
};

/* ───────────── Subtítulos palabra a palabra ───────────── */

function enLineas(palabras: Palabra[]): Palabra[][] {
  const lineas: Palabra[][] = [];
  let actual: Palabra[] = [];
  let letras = 0;
  palabras.forEach((p, i) => {
    const previa = palabras[i - 1];
    const pausa = previa ? p.desde - previa.hasta : 0;
    if (actual.length && (pausa > 0.45 || letras + p.texto.length > 34 || /[.!?…]$/.test(previa?.texto ?? ''))) {
      lineas.push(actual);
      actual = [];
      letras = 0;
    }
    actual.push(p);
    letras += p.texto.length + 1;
  });
  if (actual.length) lineas.push(actual);
  return lineas;
}

const Subtitulos: React.FC<{ palabras: Palabra[] }> = ({ palabras }) => {
  const f = useCurrentFrame();
  const seg = f / FPS;
  const lineas = React.useMemo(() => enLineas(palabras), [palabras]);
  const linea = lineas.find((l, i) => {
    const fin = Math.max(l[l.length - 1].hasta + 0.35, 0);
    const siguiente = lineas[i + 1]?.[0].desde ?? Infinity;
    return seg >= l[0].desde - 0.05 && seg < Math.min(fin, siguiente);
  });
  if (!linea) return null;
  const finLinea = linea[linea.length - 1].hasta + 0.35;
  const sale = interpolate(seg, [finLinea - 0.18, finLinea], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 92 }}>
      <div
        style={{
          fontFamily: INTER,
          fontWeight: 300,
          fontSize: 58,
          letterSpacing: '-0.035em',
          color: '#fff',
          textAlign: 'center',
          maxWidth: 1500,
          lineHeight: 1.12,
          opacity: sale,
          textShadow: '0 2px 24px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.6)',
        }}
      >
        {linea.map((p, i) => {
          const k = seg - p.desde;
          const vis = interpolate(k, [-0.04, 0.2], [0, 1], { ...clamp, easing: SUAVE });
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.26em',
                opacity: vis,
                filter: `blur(${(1 - vis) * 10}px)`,
                transform: `translateY(${(1 - vis) * 14}px)`,
                fontWeight: p.clave ? 600 : 300,
                ...(p.clave
                  ? { backgroundImage: DEGRADADO_ORO, WebkitBackgroundClip: 'text', color: 'transparent', textShadow: 'none', filter: `blur(${(1 - vis) * 10}px) drop-shadow(0 2px 10px rgba(0,0,0,.55))` }
                  : {}),
              }}
            >
              {p.texto}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── Rótulo de autoridad y chip de la lección ───────────── */

const Rotulo: React.FC<{ g: Guion }> = ({ g }) => {
  const f = useCurrentFrame();
  const entra = interpolate(f, [t(0.35), t(1.15)], [0, 1], { ...clamp, easing: SUAVE });
  const sale = interpolate(f, [t(4.6), t(5.3)], [0, 1], { ...clamp, easing: ENTRA_SALE });
  const v = entra * (1 - sale);
  const linea = interpolate(f, [t(0.5), t(1.6)], [0, 1], { ...clamp, easing: SUAVE });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: v, background: 'radial-gradient(ellipse 60% 70% at 0% 75%, rgba(20,18,16,.55) 0%, rgba(20,18,16,0) 70%)' }} />
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 96,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 22px 12px 14px',
          borderRadius: 999,
          background: 'rgba(23,20,15,0.42)',
          border: '1px solid rgba(243,217,174,0.35)',
          backdropFilter: 'blur(18px) saturate(140%)',
          fontFamily: INTER,
          color: C.crema,
          fontSize: 24,
          fontWeight: 400,
          letterSpacing: '-0.01em',
          opacity: v,
          filter: `blur(${(1 - v) * 8}px)`,
          transform: `translateY(${(1 - v) * -16}px)`,
        }}
      >
        <span style={{ background: DEGRADADO_ORO, color: C.tinta, fontWeight: 600, borderRadius: 999, padding: '4px 12px', fontSize: 20 }}>
          {g.numero}
        </span>
        Empieza aquí · <strong style={{ fontWeight: 600 }}>{g.titulo}</strong>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 110,
          bottom: 250,
          fontFamily: INTER,
          color: '#fff',
          opacity: v,
          filter: `blur(${(1 - v) * 10}px)`,
          transform: `translateX(${(1 - v) * -40}px)`,
          textShadow: '0 2px 22px rgba(0,0,0,.45)',
        }}
      >
        <div style={{ fontSize: 66, fontWeight: 300, letterSpacing: '-0.045em', lineHeight: 1 }}>
          Sorela <strong style={{ fontWeight: 600 }}>Caro</strong>
        </div>
        <div style={{ height: 2, width: 360 * linea, background: DEGRADADO_ORO, margin: '18px 0 16px', borderRadius: 2 }} />
        <div style={{ fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', color: C.crema }}>creadora de la Técnica Divine®</div>
        <div style={{ fontSize: 22, fontWeight: 400, marginTop: 8, color: C.oroClaro }}>30 años · +25.000 casos</div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── Tarjetas de cristal (lo que se ve de la plataforma) ───────────── */

const Icono: React.FC<{ estado?: Fila['estado'] }> = ({ estado }) => {
  const base: React.CSSProperties = { width: 30, height: 30, borderRadius: 999, flex: '0 0 30px', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 600 };
  if (estado === 'hecho') return <span style={{ ...base, background: DEGRADADO_ORO, color: C.tinta }}>✓</span>;
  if (estado === 'candado')
    return (
      <span style={{ ...base, border: '1.5px solid rgba(255,255,255,.35)' }}>
        <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
          <rect x="1" y="6.5" width="11" height="7.5" rx="2" stroke="rgba(255,255,255,.75)" strokeWidth="1.4" />
          <path d="M3.5 6.5V4.5a3 3 0 0 1 6 0v2" stroke="rgba(255,255,255,.75)" strokeWidth="1.4" />
        </svg>
      </span>
    );
  if (estado === 'abierto') return <span style={{ ...base, border: `2px solid ${C.oroMedio}`, boxShadow: `0 0 16px ${C.oroMedio}` }} />;
  return <span style={{ ...base, width: 8, height: 8, flex: '0 0 8px', background: 'rgba(255,255,255,.6)' }} />;
};

const TarjetaCristal: React.FC<{ tarjeta: Tarjeta }> = ({ tarjeta }) => {
  const f = useCurrentFrame();
  const dur = t(tarjeta.hasta - tarjeta.desde);
  const entra = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: SUAVE });
  const sale = interpolate(f, [dur - 12, dur], [0, 1], { ...clamp, easing: ENTRA_SALE });
  const v = entra * (1 - sale);
  const velocidad = Math.min(1, Math.abs(entra - interpolate(f - 1, [0, 16], [0, 1], { ...clamp, easing: SUAVE })) * 6 + Math.abs(sale - interpolate(f - 1, [dur - 12, dur], [0, 1], { ...clamp, easing: ENTRA_SALE })) * 6);
  const izq = tarjeta.lado === 'izquierda';
  const dir = izq ? -1 : 1;
  const pulsa = tarjeta.boton ? interpolate(f, [t(1.2), t(1.35), t(1.55)], [1, 0.95, 1], clamp) : 1;
  const brillo = interpolate(f, [t(0.6), t(1.6)], [-60, 160], clamp);
  return (
    <AbsoluteFill style={{ perspective: 1400 }}>
      <div
        style={{
          position: 'absolute',
          [izq ? 'left' : 'right']: 110,
          top: 250,
          width: 470,
          padding: '30px 30px 28px',
          borderRadius: 30,
          background: 'linear-gradient(160deg, rgba(38,32,24,0.72), rgba(20,18,16,0.62))',
          border: '1px solid rgba(243,217,174,0.30)',
          boxShadow: '0 40px 90px rgba(20,18,16,0.45), inset 0 1px 0 rgba(243,217,174,0.35)',
          backdropFilter: 'blur(28px) saturate(130%)',
          fontFamily: INTER,
          color: '#fff',
          opacity: v,
          // Desenfoque de movimiento por velocidad (el CameraMotionBlur rompe el backdrop-filter del cristal).
          filter: `blur(${velocidad * 14}px)`,
          transformOrigin: izq ? 'left center' : 'right center',
          transform: `translateX(${(1 - v) * 90 * dir}px) rotateY(${(1 - v) * -24 * dir}deg) scale(${0.94 + 0.06 * v})`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(105deg, transparent ${brillo - 30}%, rgba(255,255,255,.22) ${brillo}%, transparent ${brillo + 30}%)`,
            pointerEvents: 'none',
          }}
        />
        <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: '0.02em', color: C.oroClaro, marginBottom: 10 }}>{tarjeta.zona}</div>
        <div style={{ fontSize: 36, fontWeight: 300, letterSpacing: '-0.035em', lineHeight: 1.1, marginBottom: tarjeta.filas?.length ? 22 : 10 }}>
          {tarjeta.titulo}
        </div>
        {tarjeta.filas?.map((fila, i) => {
          const fv = interpolate(f, [8 + i * 5, 22 + i * 5], [0, 1], { ...clamp, easing: SUAVE });
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '13px 0',
                borderTop: i ? '1px solid rgba(255,255,255,.14)' : 'none',
                opacity: fv,
                transform: `translateY(${(1 - fv) * 12}px)`,
                filter: `blur(${(1 - fv) * 6}px)`,
              }}
            >
              <Icono estado={fila.estado} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 23, fontWeight: 400, letterSpacing: '-0.01em', opacity: fila.estado === 'candado' ? 0.6 : 1 }}>{fila.texto}</div>
                {fila.detalle && <div style={{ fontSize: 17, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>{fila.detalle}</div>}
              </div>
            </div>
          );
        })}
        {tarjeta.boton && (
          <div
            style={{
              marginTop: 20,
              background: DEGRADADO_ORO,
              color: C.tinta,
              borderRadius: 999,
              padding: '16px 24px',
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              transform: `scale(${pulsa})`,
              boxShadow: '0 10px 30px rgba(201,154,92,.45)',
            }}
          >
            {tarjeta.boton}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── Cierre oscuro por capas, con medallón 3D ───────────── */

const Cierre: React.FC<{ g: Guion }> = ({ g }) => {
  const f = useCurrentFrame();
  const capa = (retraso: number) => interpolate(f, [retraso, retraso + 16], [100, 0], { ...clamp, easing: SUAVE });
  const texto = interpolate(f, [t(0.75), t(1.4)], [0, 1], { ...clamp, easing: SUAVE });
  const giro = interpolate(f, [0, t(CIERRE_S)], [-38, 12], { ...clamp, easing: SUAVE });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.crema, transform: `translateY(${capa(0)}%)` }} />
      <AbsoluteFill style={{ background: DEGRADADO_ORO, transform: `translateY(${capa(4)}%)` }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 35%, #2a2318 0%, ${C.banda} 60%)`,
          transform: `translateY(${capa(8)}%)`,
          justifyContent: 'center',
          alignItems: 'center',
          perspective: 1200,
        }}
      >
        <div style={{ position: 'relative', width: 380, height: 380, display: 'grid', placeItems: 'center', opacity: texto }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1.5px solid rgba(243,217,174,.5)',
              boxShadow: 'inset 0 0 50px rgba(243,217,174,.14), 0 0 70px rgba(201,154,92,.22)',
              background: 'radial-gradient(circle at 32% 28%, rgba(243,217,174,.18), rgba(255,255,255,0) 58%)',
              transform: `rotateY(${giro}deg) rotateX(10deg)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 22,
              borderRadius: '50%',
              border: '1px solid rgba(243,217,174,.22)',
              transform: `rotateY(${-giro * 0.6}deg) rotateX(-8deg)`,
            }}
          />
          <Img src={staticFile('logo-sorela.png')} style={{ width: 330, filter: `blur(${(1 - texto) * 8}px)` }} />
        </div>
        <div
          style={{
            fontFamily: INTER,
            color: C.crema,
            textAlign: 'center',
            marginTop: 36,
            opacity: texto,
            transform: `translateY(${(1 - texto) * 20}px)`,
            filter: `blur(${(1 - texto) * 8}px)`,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 500, color: C.oroClaro, letterSpacing: '0.02em', marginBottom: 14 }}>Tu tarea</div>
          <div style={{ fontSize: 50, fontWeight: 300, letterSpacing: '-0.04em', maxWidth: 1200, lineHeight: 1.12 }}>{g.cierre}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ───────────── Composición ───────────── */

export const Leccion: React.FC<Guion> = (g) => {
  const f = useCurrentFrame();
  const total = t(g.duracion + CIERRE_S);
  const musica = (frame: number) =>
    interpolate(frame, [0, 20, total - 30, total], [0, 0.11, 0.11, 0], clamp) +
    interpolate(frame, [t(g.duracion), t(g.duracion) + 10], [0, 0.07], clamp);
  return (
    <AbsoluteFill style={{ background: C.banda }}>
      <Sequence durationInFrames={t(g.duracion)}>
        <Camara g={g} />
        {/* Viñeta y velo inferior para que se lea el texto sin oscurecer la cara. */}
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(20,18,16,.35) 100%)' }} />
        <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(20,18,16,.62) 0%, rgba(20,18,16,.25) 18%, rgba(20,18,16,0) 34%)' }} />
        <Rotulo g={g} />
        {g.tarjetas.map((tar, i) => (
          <Sequence key={i} from={t(tar.desde)} durationInFrames={t(tar.hasta - tar.desde)}>
            <TarjetaCristal tarjeta={tar} />
          </Sequence>
        ))}
        <Subtitulos palabras={g.palabras} />
      </Sequence>
      <Sequence from={t(g.duracion) - 8}>
        <CameraMotionBlur shutterAngle={180} samples={5}>
          <Cierre g={g} />
        </CameraMotionBlur>
      </Sequence>
      {g.musica && <Audio src={staticFile(g.musica)} volume={musica} loop />}
      {f < 0 && null}
    </AbsoluteFill>
  );
};
