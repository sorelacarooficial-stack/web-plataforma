import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, useVideoConfig } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { Escena, media } from './piezas';
import { Encabezado, finVoz, Locucion, SubtitulosVoz, VOZ0 } from './voz';

export type Plano = {
  dura: number;
  oscuro?: boolean;
  cierre?: boolean;
  empuje?: number;
  el: (dura: number) => React.ReactNode;
};

/** Cada plano es su propio componente (así sus hooks viven dentro de su Sequence). */
const Pinta: React.FC<{ el: Plano['el']; dura: number }> = ({ el, dura }) => <>{el(dura)}</>;

export const SOLAPE = 10;

export const duracionDe = (planos: Plano[]) => planos.reduce((a, p) => a + p.dura, 0) - SOLAPE * (planos.length - 1);

/** Pone los planos en fila, solapados, con un «whoosh» en cada cambio, su música propia y un golpe al entrar el cierre. */
export const Montaje: React.FC<{ planos: Plano[]; musica: string; paso: string; golpe: string; voz: string; encabezado?: string }> = ({
  planos,
  musica,
  paso,
  golpe: sonidoGolpe,
  voz,
  encabezado,
}) => {
  const { durationInFrames } = useVideoConfig();
  let t = 0;
  const inicios = planos.map((p) => {
    const i = t;
    t += p.dura - SOLAPE;
    return i;
  });
  const iCierre = planos.findIndex((p) => p.cierre);
  const golpe = iCierre >= 0 ? inicios[iCierre] : durationInFrames - 90;
  // Tramos con voz: la música se aparta para que se entienda.
  const voces = [[VOZ0, finVoz(voz)]];
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
      <Sequence durationInFrames={inicios[1] + SOLAPE}>
        <Encabezado hasta={inicios[1] + SOLAPE} titular={encabezado} />
      </Sequence>
      <SubtitulosVoz id={voz} />
      <Locucion id={voz} />
      <Audio
        src={media(musica)}
        volume={(f) =>
          interpolate(f, [0, 8, durationInFrames - 30, durationInFrames - 1], [0, 0.8, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (1 - bajo(f) * 0.72)
        }
      />
      {inicios.slice(1).map((i, k) => (
        <Sequence key={`w${k}`} from={Math.max(0, i - 6)} durationInFrames={45}>
          <Audio src={media(paso)} volume={0.3} />
        </Sequence>
      ))}
      <Sequence from={Math.max(0, golpe - 2)} durationInFrames={90}>
        <Audio src={media(sonidoGolpe)} volume={0.65} />
      </Sequence>
    </AbsoluteFill>
  );
};
