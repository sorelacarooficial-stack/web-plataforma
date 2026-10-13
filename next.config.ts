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
    /* El PDF del acuerdo lleva el logotipo. El dossier ya NO va en el
       paquete: vive en Storage privado (lib/dossier-privado.ts). */
    '/api/acuerdos': ['./fotos/logo-sorela.png'],
    '/api/acuerdos/**': ['./fotos/logo-sorela.png'],
    '/api/certificado': ['./fotos/logo-sorela.png'],
    /* El informe de Métricas en PDF lleva las tipografías de la marca en
       TTF (un PDF no puede llevar las woff2 de la web) y el logotipo. */
    '/api/metricas/informe': ['./fuentes/*.ttf', './fotos/logo-sorela.png'],
  },
  /* Cabeceras de seguridad en todas las páginas:
     · nadie puede meter la web dentro de un marco ajeno (evita que engañen a
       Sorela para pulsar «borrar cuenta» o «enviar» sin saberlo);
     · el navegador no adivina tipos de archivo;
     · solo HTTPS, y no se cuenta a otras webs la dirección exacta de origen. */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  images: {
    // Las fotos ya se pre-optimizan a WebP con scripts/optimizar-imagenes.mjs.
    // Next vuelve a redimensionar por breakpoint desde esas fuentes.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1200, 1600, 1920, 2400],
  },
};

export default nextConfig;
