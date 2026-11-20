import { Easing } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

/** Marca de Sorela (docs/memoria-proyecto.md › Marca y diseño). */
export const { fontFamily: INTER } = loadFont('normal', {
  weights: ['300', '400', '500', '600'],
  subsets: ['latin', 'latin-ext'],
});

export const C = {
  crema: '#f4efe7',
  tinta: '#141210',
  oro: '#8a6a32',
  oroClaro: '#f3d9ae',
  oroMedio: '#c99a5c',
  banda: '#17140f',
};

export const DEGRADADO_ORO = `linear-gradient(120deg, ${C.oroClaro} 0%, ${C.oroMedio} 100%)`;

export const FPS = 30;
export const ANCHO = 1920;
export const ALTO = 1080;

/** Curvas tipo Apple: salida rápida y llegada muy suave, sin rebotes. */
export const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);
export const ENTRA_SALE = Easing.bezier(0.65, 0, 0.35, 1);
