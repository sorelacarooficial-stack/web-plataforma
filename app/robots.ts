import type { MetadataRoute } from 'next';

/**
 * Dominio de producción, con www.
 *
 * La versión sin www contesta con un 308 hacia esta, así que escribirla sin
 * www aquí obligaría a los buscadores a dar un salto de más en cada visita al
 * mapa del sitio. Se escribe entera y a mano —y no desde NEXT_PUBLIC_WEB— a
 * propósito: si esa variable faltase en Vercel, el robots.txt publicado
 * anunciaría un sitemap en localhost y nadie se enteraría hasta meses después.
 */
const SITIO = 'https://www.sorelacarodivine.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Zona privada y API. No son páginas: no hay nada que enseñar y sí
      // formularios y rutas de datos que no queremos que nadie rastree.
      disallow: ['/entrar', '/plataforma', '/api/'],
      // Los textos legales ya NO se bloquean aquí, aunque antes sí.
      // Cada uno se publica con noindex en su propia cabecera, y para leer ese
      // noindex Google necesita poder entrar en la página. Bloqueándolas se
      // conseguía justo lo contrario: la dirección se quedaba en el índice, sin
      // texto debajo, porque el buscador nunca llegaba a ver la orden.
    },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
