import React from 'react';
import { Composition } from 'remotion';
import { Leccion, CIERRE_S } from './Leccion';
import { ALTO, ANCHO, FPS } from './marca';
import type { Guion } from './tipos';

const VACIO: Guion = {
  id: 'prueba',
  numero: '00',
  titulo: 'Bienvenida',
  base: 'prueba/base.mp4',
  duracion: 10,
  palabras: [],
  tarjetas: [],
  acercamientos: [],
  cierre: 'Empieza por el video 01.',
};

/** Una sola composición: cada vídeo le pasa su guion (guiones/<id>.json). */
export const Raiz: React.FC = () => (
  <Composition
    id="Leccion"
    component={Leccion}
    width={ANCHO}
    height={ALTO}
    fps={FPS}
    durationInFrames={Math.round((VACIO.duracion + CIERRE_S) * FPS)}
    defaultProps={VACIO}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round((props.duracion + CIERRE_S) * FPS) })}
  />
);
