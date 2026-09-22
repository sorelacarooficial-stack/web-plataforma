import type { MetadataRoute } from 'next';
import { TERAPEUTAS } from '@/lib/terapeutas';

const SITIO = 'https://sorelacarodivine.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();

  const fijas: MetadataRoute.Sitemap = [
    { url: SITIO, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITIO}/metodo`, changeFrequency: 'yearly', priority: 0.8 },
    { url: `${SITIO}/formaciones`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITIO}/comunidad`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITIO}/terapeutas`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITIO}/sobre`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${SITIO}/contacto`, changeFrequency: 'yearly', priority: 0.6 },
  ];

  // Las fichas de curso ya no existen: sus fechas y precios eran inventados y
  // se han retirado. Volverán al mapa del sitio cuando haya convocatorias de
  // verdad. Dejarlas aquí haría que Google reclamase páginas que dan 404.

  const terapeutas: MetadataRoute.Sitemap = TERAPEUTAS.map((t) => ({
    url: `${SITIO}/terapeutas/${t.slug}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...fijas, ...terapeutas].map((e) => ({ ...e, lastModified: ahora }));
}
