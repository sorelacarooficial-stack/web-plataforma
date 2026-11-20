import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { Certificado, Contador, Plazas } from './graficos';
import { Antetitulo, Fondo, Grano, media, Titular, useFormato, useU } from './piezas';
import { C, fluida, mezcla, suave, tramo } from './tema';

/*
 * Aperturas (primeros 3-4 s) de los 5 anuncios. Las cinco dicen lo mismo
 * (qué es, para quién, quién lo enseña) pero cada una con su gancho, su
 * jerarquía y su fondo, para que en el conjunto no parezcan el mismo anuncio:
 *  · autoridad: «+25.000» enorme sobre Sorela, fondo oscuro;
 *  · manos: las manos a sangre, texto encima;
 *  · medellín: «28·29·30 ene» protagonista sobre oro;
 *  · plazas: los 10 asientos y «10 plazas» en grande, oscuro;
 *  · certificado: el diploma en 3D primero, crema.
 * Dejan libre la franja de los subtítulos (≈ 72-86 % de alto).
 */

const Pastilla: React.FC<{ desde?: number; oscura?: boolean; children: React.ReactNode }> = ({ desde = 20, oscura, children }) => {
  const f = useCurrentFrame();
  const u = useU();
  const t = tramo(f, desde, 16);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12 * u,
        padding: `${12 * u}px ${24 * u}px`,
        borderRadius: 999,
        background: oscura ? C.banda : 'rgba(255,255,255,0.14)',
        border: oscura ? 'none' : '1px solid rgba(243,217,174,0.45)',
        backdropFilter: 'blur(12px)',
        color: C.crema,
        fontFamily: 'Inter',
        fontSize: 27 * u,
        opacity: t,
        transform: `scale(${mezcla(0.92, 1, t)})`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 10 * u, height: 10 * u, borderRadius: 99, background: C.degradado }} />
      <span>{children}</span>
    </div>
  );
};

const Linea: React.FC<{ texto: string; desde?: number; color?: string; tam?: number; izquierda?: boolean; banda?: boolean }> = ({ texto, desde = 14, color = C.crema, tam = 32, izquierda, banda }) => {
  const f = useCurrentFrame();
  const u = useU();
  const t = tramo(f, desde, 16);
  return (
    <div style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: tam * u, lineHeight: 1.35, color, opacity: t, transform: `translateY(${(1 - t) * 14}px)`, textAlign: izquierda ? 'left' : 'center', maxWidth: 900 * u, fontWeight: banda ? 500 : 400, ...(banda ? { background: 'rgba(20,18,16,0.72)', padding: `${12 * u}px ${22 * u}px`, borderRadius: 18 * u, backdropFilter: 'blur(10px)' } : {}) }}>
      {texto}
    </div>
  );
};

/* 1 · Autoridad: la cifra manda */
export const AperturaAutoridad: React.FC<{ dura: number }> = ({ dura }) => {
  const f = useCurrentFrame();
  const u = useU();
  const { historia } = useFormato();
  const z = interpolate(f, [0, dura], [1.18, 1.06]);
  return (
    <AbsoluteFill style={{ background: C.banda }}>
      <Img src={media('sorela-retrato.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%', transform: `scale(${z})`, opacity: 0.55 * tramo(f, 0, 20) }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(23,20,15,0.85) 0%, rgba(23,20,15,0.35) 40%, rgba(23,20,15,0.92) 100%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: (historia ? 230 : 90) * u, gap: 14 * u }}>
        <Antetitulo texto="Técnica Divine® · formación presencial" color={C.oroClaro} tam={24} />
        <div style={{ height: (historia ? 140 : 40) * u }} />
        <Contador hasta={25000} prefijo="+" desde={0} dura={22} tam={historia ? 230 : 200} />
        <Titular texto="casos en **30 años**" desde={10} tam={64} color={C.crema} alinear="center" />
        <div style={{ height: 24 * u }} />
        <Titular texto={'Sorela Caro, la creadora,\nenseña a **terapeutas y esteticistas**.'} desde={20} paso={2} tam={historia ? 48 : 42} color={C.crema} alinear="center" />
      </AbsoluteFill>
      <Grano fuerza={0.08} />
    </AbsoluteFill>
  );
};

/* 2 · Manos: la foto a sangre, el texto encima */
export const AperturaManos: React.FC<{ dura: number }> = ({ dura }) => {
  const f = useCurrentFrame();
  const u = useU();
  const { historia } = useFormato();
  const z = interpolate(f, [0, dura], [1.25, 1.08], { easing: fluida });
  const x = interpolate(f, [0, dura], [-30, 20]);
  return (
    <AbsoluteFill style={{ background: C.tinta }}>
      <Img src={media('valoracion-abdomen.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 40%', transform: `scale(${z}) translateX(${x}px)` }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(20,18,16,0.78) 0%, rgba(20,18,16,0.1) 38%, rgba(20,18,16,0.1) 55%, rgba(20,18,16,0.7) 100%)' }} />
      <AbsoluteFill style={{ alignItems: 'flex-start', padding: `${(historia ? 220 : 80) * u}px ${70 * u}px 0`, gap: 16 * u }}>
        <Pastilla desde={4}>Técnica Divine® · drenaje y moldeo, solo con las manos</Pastilla>
        <Titular texto={'Para terapeutas,\nesteticistas y\n**masajistas**.'} desde={8} paso={2} tam={historia ? 104 : 88} color={C.crema} />
        <Linea texto="Formación presencial con Sorela Caro, creadora del método." desde={22} tam={36} izquierda banda />
      </AbsoluteFill>
      <Grano fuerza={0.06} />
    </AbsoluteFill>
  );
};

/* 3 · Medellín: la fecha es la protagonista, sobre oro */
export const AperturaMedellin: React.FC<{ dura: number }> = ({ dura }) => {
  const f = useCurrentFrame();
  const u = useU();
  const { historia } = useFormato();
  const dias = ['28', '29', '30'];
  const giro = interpolate(f, [0, dura], [-14, 6]);
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg, #f6e2bd 0%, #d9ad6c 55%, #b8894a 100%)' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 40% at 30% 20%, rgba(255,255,255,0.55), transparent 70%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: (historia ? 210 : 70) * u, gap: 10 * u }}>
        <Antetitulo texto="Medellín · enero de 2027" color={C.tinta} tam={26} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 * u, perspective: 1200 * u }}>
          {dias.map((d, i) => {
            const t = tramo(f, 2 + i * 5, 24);
            return (
              <React.Fragment key={d}>
                <span
                  style={{
                    fontFamily: 'Inter',
                    fontWeight: 200,
                    fontSize: (historia ? 250 : 210) * u,
                    letterSpacing: '-0.06em',
                    color: C.tinta,
                    lineHeight: 1,
                    display: 'inline-block',
                    opacity: t,
                    filter: `blur(${(1 - t) * 18}px)`,
                    transform: `translateY(${(1 - t) * 80 * u}px) rotateX(${(1 - t) * 70}deg)`,
                  }}
                >
                  {d}
                </span>
                {i < 2 && <span style={{ fontFamily: 'Inter', fontSize: 90 * u, color: 'rgba(20,18,16,0.5)', opacity: t }}>·</span>}
              </React.Fragment>
            );
          })}
        </div>
        <Titular texto="**enero**" desde={14} tam={historia ? 92 : 80} color={C.tinta} alinear="center" />
        <div style={{ height: 18 * u }} />
        <Titular texto={'Formación presencial en Técnica Divine®\npara **terapeutas y esteticistas**'} desde={20} paso={2} tam={historia ? 44 : 38} color={C.tinta} alinear="center" />
        <div style={{ height: 10 * u }} />
        <Pastilla desde={30} oscura>
          Con <b style={{ fontWeight: 600, color: C.oroClaro }}>Sorela Caro</b>, creadora · 30 años
        </Pastilla>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          right: 60 * u,
          bottom: (historia ? 780 : 480) * u,
          width: (historia ? 210 : 170) * u,
          height: (historia ? 280 : 225) * u,
          borderRadius: 26 * u,
          overflow: 'hidden',
          boxShadow: '0 30px 70px rgba(60,40,15,0.35), 0 0 0 2px rgba(255,255,255,0.6)',
          transform: `perspective(1000px) rotateY(${giro}deg) rotateZ(4deg)`,
          opacity: tramo(f, 24, 18),
        }}
      >
        <Img src={media('sorela-retrato.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
      </div>
      <Grano fuerza={0.05} />
    </AbsoluteFill>
  );
};

/* 4 · Plazas: los 10 asientos y «10 plazas» en grande */
export const AperturaPlazas: React.FC = () => {
  const u = useU();
  const { historia } = useFormato();
  return (
    <AbsoluteFill>
      <Fondo oscuro />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: (historia ? 220 : 70) * u, gap: 14 * u }}>
        <Antetitulo texto="Técnica Divine® · formación presencial" color={C.oroClaro} tam={24} />
        <Titular texto="**10 plazas**" desde={2} tam={historia ? 190 : 150} color={C.crema} oro alinear="center" />
        <Titular texto="para **terapeutas y esteticistas**" desde={10} tam={historia ? 50 : 44} color={C.crema} alinear="center" />
        <div style={{ height: (historia ? 40 : 20) * u }} />
        <Plazas desde={6} oscuro tam={historia ? 150 : 118} />
        <div style={{ height: 20 * u }} />
        <Linea texto="Con Sorela Caro, creadora del método · 30 años · +25.000 casos" desde={20} tam={38} color={C.crema} banda />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 5 · Certificado: el diploma en 3D primero */
export const AperturaCertificado: React.FC = () => {
  const u = useU();
  const { historia } = useFormato();
  const pie = (
    <>
      <Titular texto="para **terapeutas y esteticistas**" desde={18} tam={historia ? 50 : 40} alinear="center" />
      <Pastilla desde={26} oscura>
        Con su creadora, <b style={{ fontWeight: 600, color: C.oroClaro }}>Sorela Caro</b> · 30 años
      </Pastilla>
    </>
  );
  return (
    <AbsoluteFill>
      <Fondo />
      <Certificado desde={0} y={historia ? -40 : 80} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: (historia ? 210 : 50) * u, gap: 10 * u }}>
        <Antetitulo texto="Formación presencial · Medellín" tam={24} />
        <Titular texto={'Certifícate en la\n**Técnica Divine®**'} desde={6} paso={2} tam={historia ? 92 : 70} alinear="center" />
        {!historia && pie}
      </AbsoluteFill>
      {historia && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 560 * u, gap: 12 * u }}>
          {pie}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export { suave };
