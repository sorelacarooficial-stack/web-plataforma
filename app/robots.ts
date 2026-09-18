import type { MetadataRoute } from 'next';

const SITIO = 'https://sorelacarodivine.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/entrar', '/legal/'],
    },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
