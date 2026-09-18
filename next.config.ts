import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Las fotos ya se pre-optimizan a WebP con scripts/optimizar-imagenes.mjs.
    // Next vuelve a redimensionar por breakpoint desde esas fuentes.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1200, 1600, 1920, 2400],
  },
};

export default nextConfig;
