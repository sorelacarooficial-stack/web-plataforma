import React from 'react';
import { cancelRender, Composition, continueRender, delayRender, staticFile } from 'remotion';
import { ANUNCIOS, Anuncio } from './anuncios';
import { duracionDe } from './montaje';
import { FPS } from './tema';

// Inter (la tipografía de la marca), cargada antes de pintar nada.
const espera = delayRender('Inter');
const inter = new FontFace('Inter', `url(${staticFile('media/inter.woff2')}) format('woff2')`, { weight: '100 900' });
inter
  .load()
  .then((f) => {
    document.fonts.add(f);
    continueRender(espera);
  })
  .catch((e) => cancelRender(e));

const FORMATOS = {
  '9x16': { width: 1080, height: 1920 },
  '4x5': { width: 1080, height: 1350 },
  '16x9': { width: 1920, height: 1080 },
};

export const Root: React.FC = () => (
  <>
    {(Object.keys(ANUNCIOS) as (keyof typeof ANUNCIOS)[]).map((id) =>
      (Object.keys(FORMATOS) as (keyof typeof FORMATOS)[])
        .filter((fmt) => (id === 'landing' ? fmt !== '4x5' : fmt !== '16x9'))
        .map((fmt) => (
          <Composition
            key={`${id}-${fmt}`}
            id={`${id}-${fmt}`}
            component={Anuncio}
            defaultProps={{ id }}
            fps={FPS}
            durationInFrames={duracionDe(ANUNCIOS[id])}
            {...FORMATOS[fmt]}
          />
        )),
    )}
  </>
);
