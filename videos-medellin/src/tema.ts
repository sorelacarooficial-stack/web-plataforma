import { Easing, interpolate } from 'remotion';

export const C = {
  crema: '#f4efe7',
  crema2: '#ebe3d6',
  tinta: '#141210',
  oro: '#8a6a32',
  oroClaro: '#f3d9ae',
  oroMedio: '#c99a5c',
  banda: '#17140f',
  degradado: 'linear-gradient(135deg, #f3d9ae 0%, #c99a5c 100%)',
};

export const FPS = 30;

/** Curva «Apple»: arranque rápido y llegada muy suave. */
export const suave = Easing.bezier(0.16, 1, 0.3, 1);
/** Entrada y salida suaves, para movimientos de cámara. */
export const fluida = Easing.bezier(0.65, 0, 0.35, 1);

/** 0 → 1 entre dos fotogramas con la curva elegida. */
export const tramo = (f: number, desde: number, dura: number, ease = suave) =>
  interpolate(f, [desde, desde + dura], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

export const mezcla = (a: number, b: number, t: number) => a + (b - a) * t;
