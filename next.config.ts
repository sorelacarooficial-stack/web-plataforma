import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * El dossier viaja con su ruta de API.
   *
   * Vive en `docs/` y NO en `public/` a propósito: en `public/` tendría una
   * dirección fija que cualquiera podría abrir y reenviar, y es el documento
   * que la alumna se compromete por escrito a no divulgar. Al estar fuera,
   * Next no lo incluiría en el paquete que se despliega y la ruta no lo
   * encontraría en el servidor; esto se lo dice.
   */
  outputFileTracingIncludes: {
    '/api/dossier': ['./docs/dossier.pdf'],
    /* La firma y el reenvío adjuntan el dossier al correo, y el PDF del
       acuerdo lleva el logotipo. */
    '/api/acuerdos': ['./docs/dossier.pdf', './fotos/logo-sorela.png'],
    '/api/acuerdos/**': ['./docs/dossier.pdf', './fotos/logo-sorela.png'],
  },
  images: {
    // Las fotos ya se pre-optimizan a WebP con scripts/optimizar-imagenes.mjs.
    // Next vuelve a redimensionar por breakpoint desde esas fuentes.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1200, 1600, 1920, 2400],
  },
};

export default nextConfig;
