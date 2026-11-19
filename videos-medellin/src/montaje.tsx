import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, useVideoConfig } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { Escena, media } from './piezas';
import { FPS } from './tema';

export type Plano = {
  dura: number;
  oscuro?: boolean;
  cierre?: boolean;
  empuje?: number;
  /** Si Sorela habla en este plano: qué voz y en qué fotograma empieza (la música baja mientras habla). */
  voz?: { id: string; desde: number };
  el: (dura: number) => React.ReactNode;
};

/** Cada plano es su propio componente (así sus hooks viven dentro de su Sequence). */
const Pinta: React.FC<{ el: Plano['el']; dura: number }> = ({ el, dura }) => <>{el(dura)}</>;

export const SOLAPE = 10;
/** Segundo de la pista en el que cae la gran subida de la música. */
const SUBIDA = 19.5;

export const duracionDe = (planos: Plano[]) => planos.reduce((a, p) => a + p.dura, 0) - SOLAPE * (planos.length - 1);

/** Pone los planos en fila, solapados, con un «whoosh» en cada cambio y la música encajada para que la subida caiga en el cierre. */
export const Montaje: React.FC<{ planos: Plano[] }> = ({ planos }) => {
  const { durationInFrames } = useVideoConfig();
  let t = 0;
  const inicios = planos.map((p) => {
    const i = t;
    t += p.dura - SOLAPE;
    return i;
  });
  const iCierre = planos.findIndex((p) => p.cierre);
  const golpe = iCierre >= 0 ? inicios[iCierre] : durationInFrames - 90;
  // La música arranca de forma que su subida caiga justo cuando entra el cierre.
  const arranque = Math.max(0, Math.round((SUBIDA - golpe / FPS) * FPS));
  // Tramos con la voz de Sorela: la música se aparta para que se la entienda.
  const voces = planos.flatMap((p, i) => (p.voz ? [[inicios[i] + p.voz.desde - 6, inicios[i] + p.dura - 8]] : []));
  const bajo = (f: number) =>
    Math.max(0, ...voces.map(([a, b]) => interpolate(f, [a, a + 8, b, b + 12], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  return (
    <AbsoluteFill style={{ background: '#f4efe7' }}>
      {/* Desenfoque de movimiento real: cada fotograma mezcla 5 instantes (obturador de 180°). */}
      <CameraMotionBlur shutterAngle={180} samples={5}>
      {planos.map((p, i) => (
        <Sequence key={i} from={inicios[i]} durationInFrames={p.dura}>
          {p.cierre ? (
            <Pinta el={p.el} dura={p.dura} />
          ) : (
            <Escena dura={p.dura} oscuro={p.oscuro} empuje={p.empuje}>
              <Pinta el={p.el} dura={p.dura} />
            </Escena>
          )}
        </Sequence>
      ))}
      </CameraMotionBlur>
      <Audio
        src={media('musica.mp3')}
        startFrom={arranque}
        volume={(f) =>
          interpolate(f, [0, 8, durationInFrames - 30, durationInFrames - 1], [0, 0.85, 0.85, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (1 - bajo(f) * 0.78)
        }
      />
      {inicios.slice(1).map((i, k) => (
        <Sequence key={`w${k}`} from={Math.max(0, i - 6)} durationInFrames={45}>
          <Audio src={media('whoosh.mp3')} volume={0.32} />
        </Sequence>
      ))}
      <Sequence from={Math.max(0, golpe - 2)} durationInFrames={90}>
        <Audio src={media('golpe.mp3')} volume={0.7} />
      </Sequence>
    </AbsoluteFill>
  );
};
