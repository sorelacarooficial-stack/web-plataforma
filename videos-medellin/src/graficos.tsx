import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { Antetitulo, media, Pildora, Titular, useFormato, useU } from './piezas';
import { C, fluida, mezcla, suave, tramo } from './tema';

/** Dónde va el texto según el formato: arriba en vertical, a la izquierda en horizontal. */
export const BloqueTexto: React.FC<{ children: React.ReactNode; centro?: boolean; abajo?: boolean }> = ({ children, centro, abajo }) => {
  const u = useU();
  const { horizontal, historia } = useFormato();
  if (horizontal)
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: centro ? 'center' : 'flex-start', padding: `0 ${centro ? 0 : 130 * u}px`, width: centro ? '100%' : '56%', gap: 30 * u }}>
        {children}
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill
      style={{
        justifyContent: centro ? 'center' : abajo ? 'flex-end' : 'flex-start',
        alignItems: centro ? 'center' : 'flex-start',
        padding: `${(historia ? (abajo ? 250 : 210) : abajo ? 110 : 100) * u}px ${84 * u}px`,
        gap: 26 * u,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Posición y tamaño de la foto principal según el formato. */
export const useFoto = () => {
  const { horizontal, historia } = useFormato();
  if (horizontal) return { x: 400, y: 0, w: 600, h: 800 };
  if (historia) return { x: 60, y: 300, w: 760, h: 1040 };
  return { x: 170, y: 190, w: 560, h: 760 };
};

/** Número grande que cuenta hacia arriba. */
export const Contador: React.FC<{ hasta: number; desde?: number; dura?: number; prefijo?: string; tam?: number; oro?: boolean }> = ({
  hasta,
  desde = 0,
  dura = 40,
  prefijo = '',
  tam = 380,
  oro = true,
}) => {
  const f = useCurrentFrame();
  const u = useU();
  // Fotograma entero: así las muestras del desenfoque de movimiento no mezclan dos cifras distintas.
  const t = tramo(Math.floor(f), desde, dura, fluida);
  const n = Math.round(hasta * t);
  const txt = prefijo + n.toLocaleString('es-ES').replace(/(\d)(?=(\d{3})+$)/g, '$1.');
  const e = tramo(f, desde, 18);
  return (
    <div
      style={{
        fontFamily: 'Inter',
        fontWeight: 200,
        fontSize: tam * u,
        letterSpacing: '-0.06em',
        lineHeight: 0.9,
        fontVariantNumeric: 'tabular-nums',
        opacity: e,
        filter: `blur(${(1 - e) * 24}px)`,
        transform: `scale(${mezcla(1.2, 1, e)})`,
        transformOrigin: '0% 100%',
        ...(oro ? { background: 'linear-gradient(160deg,#e9c690,#a87b3f 70%)', WebkitBackgroundClip: 'text', color: 'transparent' } : { color: C.tinta }),
      }}
    >
      {txt}
    </div>
  );
};

/** Las 10 plazas: diez asientos de cristal que se encienden uno a uno. */
export const Plazas: React.FC<{ desde?: number; oscuro?: boolean; tam?: number }> = ({ desde = 0, oscuro, tam = 120 }) => {
  const f = useCurrentFrame();
  const u = useU();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 22 * u, perspective: 1000 }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const t = tramo(f, desde + i * 4, 22);
        const brilla = tramo(f, desde + 10 + i * 4, 18);
        return (
          <div
            key={i}
            style={{
              width: tam * u,
              height: tam * u,
              borderRadius: 30 * u,
              background: oscuro ? `rgba(255,255,255,${0.05 + brilla * 0.04})` : 'rgba(255,255,255,0.6)',
              border: `1px solid ${oscuro ? 'rgba(243,217,174,0.3)' : 'rgba(255,255,255,0.95)'}`,
              boxShadow: `0 ${20 * u}px ${40 * u}px rgba(60,40,15,${oscuro ? 0.4 : 0.14}), inset 0 0 ${40 * brilla * u}px rgba(201,154,92,${0.35 * brilla})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: t,
              transform: `translateY(${(1 - t) * 60 * u}px) rotateX(${(1 - t) * 60}deg)`,
              filter: `blur(${(1 - t) * 10}px)`,
              fontFamily: 'Inter',
              fontWeight: 300,
              fontSize: tam * 0.32 * u,
              color: oscuro ? C.oroClaro : C.oro,
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </div>
        );
      })}
    </div>
  );
};

/** Tres fechas como teselas de calendario que caen girando en 3D. */
export const Fechas: React.FC<{ desde?: number; oscuro?: boolean }> = ({ desde = 0, oscuro }) => {
  const f = useCurrentFrame();
  const u = useU();
  const { horizontal } = useFormato();
  const tam = horizontal ? 230 : 260;
  return (
    <div style={{ display: 'flex', gap: 26 * u, perspective: 1400 * u }}>
      {['28', '29', '30'].map((d, i) => {
        const t = tramo(f, desde + i * 5, 26);
        const flota = Math.sin((f - desde) / 30 + i) * 6 * u;
        return (
          <div
            key={d}
            style={{
              width: tam * u,
              height: tam * 1.18 * u,
              borderRadius: 40 * u,
              overflow: 'hidden',
              background: oscuro ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${oscuro ? 'rgba(243,217,174,0.3)' : 'rgba(255,255,255,1)'}`,
              boxShadow: `0 ${40 * u}px ${80 * u}px rgba(60,40,15,${oscuro ? 0.5 : 0.18})`,
              transform: `translateY(${(1 - t) * 90 * u + flota}px) rotateX(${(1 - t) * 70}deg) rotateY(${(i - 1) * -8}deg) scale(${mezcla(0.85, 1, t)})`,
              filter: `blur(${(1 - t) * 12}px)`,
              transformOrigin: '50% 100%',
              opacity: t,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                background: C.degradado,
                color: C.tinta,
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: 26 * u,
                letterSpacing: '0.24em',
                textAlign: 'center',
                padding: `${16 * u}px 0`,
              }}
            >
              ENE
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter',
                fontWeight: 200,
                fontSize: 150 * u,
                letterSpacing: '-0.06em',
                color: oscuro ? C.crema : C.tinta,
              }}
            >
              {d}
            </div>
            <div style={{ textAlign: 'center', paddingBottom: 18 * u, fontFamily: 'Inter', fontSize: 22 * u, color: oscuro ? C.oroClaro : C.oro, letterSpacing: '0.12em' }}>
              DÍA {i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Etiquetas de cristal que aparecen alrededor de la foto (lo que se aprende). */
export const Etiquetas: React.FC<{ items: { t: string; x: number; y: number }[]; desde?: number; cada?: number }> = ({ items, desde = 0, cada = 14 }) => {
  const u = useU();
  const f = useCurrentFrame();
  return (
    <>
      {items.map((it, i) => (
        <div
          key={it.t}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%,-50%) translate(${it.x * u}px, ${(it.y + Math.sin((f + i * 20) / 35) * 6) * u}px)`,
          }}
        >
          <Pildora texto={it.t} desde={desde + i * cada} />
        </div>
      ))}
    </>
  );
};

/** Lista con check que se va marcando (interfaz de cristal). */
export const Lista: React.FC<{ items: string[]; desde?: number; oscuro?: boolean }> = ({ items, desde = 0, oscuro }) => {
  const f = useCurrentFrame();
  const u = useU();
  const t0 = tramo(f, desde, 24);
  return (
    <div
      style={{
        width: 820 * u,
        padding: `${26 * u}px ${34 * u}px`,
        borderRadius: 44 * u,
        background: oscuro ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.62)',
        border: `1px solid ${oscuro ? 'rgba(243,217,174,0.28)' : '#fff'}`,
        boxShadow: `0 ${40 * u}px ${100 * u}px rgba(60,40,15,0.18)`,
        backdropFilter: 'blur(20px)',
        opacity: t0,
        transform: `perspective(1600px) rotateX(${(1 - t0) * 30}deg) translateY(${(1 - t0) * 80 * u}px)`,
        filter: `blur(${(1 - t0) * 12}px)`,
      }}
    >
      {items.map((it, i) => {
        const t = tramo(f, desde + 14 + i * 12, 18);
        const check = tramo(f, desde + 22 + i * 12, 14);
        return (
          <div
            key={it}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 26 * u,
              padding: `${24 * u}px 0`,
              borderTop: i ? `1px solid ${oscuro ? 'rgba(243,217,174,0.15)' : 'rgba(20,18,16,0.08)'}` : undefined,
              opacity: t,
              transform: `translateX(${(1 - t) * 40 * u}px)`,
            }}
          >
            <div
              style={{
                width: 56 * u,
                height: 56 * u,
                borderRadius: 99,
                flex: 'none',
                background: check > 0.01 ? C.degradado : 'transparent',
                border: `2px solid ${C.oroMedio}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${mezcla(0.6, 1, check)})`,
              }}
            >
              <svg width={28 * u} height={28 * u} viewBox="0 0 24 24">
                <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={C.tinta} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset={30 * (1 - check)} />
              </svg>
            </div>
            <div style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 40 * u, letterSpacing: '-0.02em', color: oscuro ? C.crema : C.tinta }}>{it}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Diploma en 3D que gira lentamente (la certificación). */
export const Certificado: React.FC<{ desde?: number; x?: number; y?: number }> = ({ desde = 0, x = 0, y = 0 }) => {
  const f = useCurrentFrame();
  const u = useU();
  const t = tramo(f, desde, 34);
  const giro = mezcla(-55, -14, t) + Math.sin((f - desde) / 45) * 4;
  const brillo = interpolate(f - desde, [20, 70], [-40, 150], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) translate(${x * u}px,${y * u}px)`, perspective: 2000 * u }}>
      <div
        style={{
          width: 760 * u,
          height: 540 * u,
          borderRadius: 26 * u,
          background: 'linear-gradient(160deg,#fffdf8,#f1e8d8)',
          boxShadow: `0 ${60 * u}px ${140 * u}px rgba(60,40,15,0.32)`,
          transform: `rotateY(${giro}deg) rotateX(${mezcla(25, 8, t)}deg) translateZ(${mezcla(-400, 0, t) * u}px)`,
          opacity: Math.min(1, t * 1.6),
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18 * u,
          border: `${10 * u}px solid transparent`,
          outline: `1px solid rgba(138,106,50,0.35)`,
          outlineOffset: -24 * u,
        }}
      >
        <Img src={media('logo-tinta.webp')} style={{ width: 150 * u, opacity: 0.9 }} />
        <div style={{ fontFamily: 'Inter', fontSize: 20 * u, letterSpacing: '0.34em', color: C.oro, fontWeight: 500 }}>CERTIFICACIÓN</div>
        <div style={{ fontFamily: 'Inter', fontSize: 54 * u, letterSpacing: '-0.04em', color: C.tinta, fontWeight: 300 }}>
          Técnica <b style={{ fontWeight: 600 }}>Divine®</b>
        </div>
        <div style={{ width: 300 * u, height: 1, background: C.degradado, margin: `${8 * u}px 0` }} />
        <div style={{ fontFamily: 'Inter', fontSize: 24 * u, color: '#5c5348', fontWeight: 400 }}>Otorgada por Sorela Caro, creadora del método</div>
        <div
          style={{
            position: 'absolute',
            right: 44 * u,
            top: 44 * u,
            width: 96 * u,
            height: 96 * u,
            borderRadius: 99,
            background: 'radial-gradient(circle at 35% 30%, #f6dfb5, #b8894a 60%, #8a6a32)',
            boxShadow: '0 8px 20px rgba(100,70,20,0.4), inset 0 0 0 6px rgba(255,255,255,0.25)',
            transform: `scale(${tramo(f, desde + 26, 18, suave)}) rotate(${(1 - tramo(f, desde + 26, 18)) * -90}deg)`,
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent ${brillo - 25}%, rgba(255,255,255,0.7) ${brillo}%, transparent ${brillo + 25}%)`, mixBlendMode: 'soft-light' }} />
      </div>
    </div>
  );
};

export { Antetitulo, Titular };
