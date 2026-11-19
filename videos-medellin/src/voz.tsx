import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import autoridad from './voz/autoridad.json';
import certificado from './voz/certificado.json';
import landing from './voz/landing.json';
import manos from './voz/manos.json';
import medellin from './voz/medellin.json';
import plazas from './voz/plazas.json';
import { Palabra } from './escena3d';
import { Antetitulo, Titular, useFormato, useU } from './piezas';
import { C, FPS, fluida, mezcla, suave, tramo } from './tema';

/**
 * Locuciones con la voz clonada de Sorela (ElevenLabs, voz «SORELA»,
 * aprobada) y los tiempos de cada palabra sacados de su transcripción.
 */
export const VOCES = { autoridad, certificado, landing, manos, medellin, plazas } as Record<string, Palabra[]>;
export type IdVoz = keyof typeof VOCES;

/** Fotograma en el que arranca la voz en todas las piezas. */
export const VOZ0 = 10;

/** Fotograma (de la pieza) en el que suena la palabra `i` de la locución. */
export const fotogramaPalabra = (id: string, i: number) => VOZ0 + Math.round(VOCES[id][i].a * FPS);
export const finVoz = (id: string) => VOZ0 + Math.round(VOCES[id][VOCES[id].length - 1].b * FPS);

const grupos = (ws: Palabra[]) => {
  const out: Palabra[][] = [];
  let g: Palabra[] = [];
  ws.forEach((w, i) => {
    g.push(w);
    const sig = ws[i + 1];
    if (/[.,:;?!]$/.test(w.t) || g.length >= 4 || !sig || sig.a - w.b > 0.3) {
      out.push(g);
      g = [];
    }
  });
  return out;
};

const CLAVE = /^(sorela|caro|divine|técnica|treinta|veinticinco|casos|terapeuta|esteticista|masajista|manos|cuerpo|presencial|medellín|enero|diez|plazas|una|corregir|certificación|método|drenaje|moldeo|conmigo)/i;

/** Subtítulos de la locución, palabra a palabra, sobre una pastilla de cristal oscuro (se leen sobre cualquier fondo). */
export const SubtitulosVoz: React.FC<{ id: string }> = ({ id }) => {
  const f = useCurrentFrame();
  const u = useU();
  const { horizontal, historia } = useFormato();
  const t = (f - VOZ0) / FPS;
  const ws = VOCES[id];
  const gs = grupos(ws);
  const actual = gs.find((g, i) => t >= g[0].a - 0.08 && (i === gs.length - 1 || t < gs[i + 1][0].a - 0.08));
  if (!actual || t > ws[ws.length - 1].b + 0.5) return null;
  const top = horizontal ? '80%' : historia ? '76%' : '79%';
  return (
    <div style={{ position: 'absolute', left: 0, right: horizontal ? '45%' : 0, top, display: 'flex', justifyContent: horizontal ? 'flex-start' : 'center', padding: `0 ${(horizontal ? 130 : 50) * u}px`, transform: 'translateY(-50%)' }}>
      <div
        style={{
          fontFamily: 'Inter',
          fontSize: (horizontal ? 54 : 60) * u,
          lineHeight: 1.12,
          letterSpacing: '-0.03em',
          textAlign: 'center',
          color: C.crema,
          padding: `${16 * u}px ${30 * u}px`,
          borderRadius: 28 * u,
          background: 'rgba(23,20,15,0.62)',
          backdropFilter: 'blur(16px)',
          boxShadow: `0 ${16 * u}px ${40 * u}px rgba(0,0,0,0.25)`,
          maxWidth: (horizontal ? 900 : 960) * u,
        }}
      >
        {actual.map((w, i) => {
          const k = suave(Math.min(1, Math.max(0, (t - w.a + 0.1) / 0.18)));
          const clave = CLAVE.test(w.t.replace(/^[¿¡]/, ''));
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.24em',
                opacity: mezcla(0.25, 1, k),
                filter: `blur(${(1 - k) * 8 * u}px)`,
                transform: `translateY(${(1 - k) * 0.25}em)`,
                fontWeight: clave ? 600 : 400,
                color: clave ? C.oroClaro : C.crema,
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

/**
 * Lo que tiene que entenderse en 3 segundos y sin sonido: qué es, para quién
 * y quién lo enseña. Va arriba del primer plano de cada pieza y se va al
 * empezar el segundo.
 */
export const Encabezado: React.FC<{ hasta: number; titular?: string }> = ({
  hasta,
  titular = 'Técnica Divine®\npara **terapeutas y esteticistas**',
}) => {
  const f = useCurrentFrame();
  const u = useU();
  const { horizontal, historia } = useFormato();
  const s = tramo(f, hasta - 12, 12, fluida);
  const e = tramo(f, 18, 18);
  return (
    <AbsoluteFill
      style={{
        opacity: 1 - s,
        filter: s > 0 ? `blur(${s * 16}px)` : undefined,
        justifyContent: horizontal ? 'center' : 'flex-start',
        alignItems: horizontal ? 'flex-start' : 'center',
        padding: horizontal ? `0 0 0 ${130 * u}px` : `${(historia ? 190 : 70) * u}px ${60 * u}px 0`,
        width: horizontal ? '55%' : '100%',
        gap: 18 * u,
        textAlign: horizontal ? 'left' : 'center',
      }}
    >
      <Antetitulo texto="Técnica Divine® · Presencial · Medellín" desde={0} tam={historia ? 28 : 24} />
      <Titular texto={titular} desde={3} paso={2} tam={horizontal ? 74 : historia ? 80 : 68} alinear={horizontal ? 'left' : 'center'} />
      <div
        style={{
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: (historia ? 36 : 30) * u,
          color: '#4a4238',
          opacity: e,
          transform: `translateY(${(1 - e) * 14}px)`,
          maxWidth: 860 * u,
        }}
      >
        El método de drenaje y moldeo corporal y facial, solo con las manos.
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12 * u,
          padding: `${12 * u}px ${24 * u}px`,
          borderRadius: 999,
          background: C.banda,
          color: C.crema,
          fontFamily: 'Inter',
          fontSize: (historia ? 30 : 26) * u,
          opacity: tramo(f, 26, 16),
          transform: `scale(${mezcla(0.92, 1, tramo(f, 26, 16))})`,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 10 * u, height: 10 * u, borderRadius: 99, background: C.degradado }} />
        <span>
          Con <b style={{ fontWeight: 600, color: C.oroClaro }}>Sorela Caro</b>, creadora · 30 años · +25.000 casos
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** La locución de la pieza. */
export const Locucion: React.FC<{ id: string }> = ({ id }) => (
  <Sequence from={VOZ0}>
    <Audio src={staticFile(`media/voz/${id}.mp3`)} volume={1} />
  </Sequence>
);
