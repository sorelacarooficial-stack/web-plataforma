import type { MetadataRoute } from 'next';
import { CURSOS } from '@/lib/cursos';
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

  const cursos: MetadataRoute.Sitemap = CURSOS.map((c) => ({
    url: `${SITIO}/formaciones/${c.slug}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const terapeutas: MetadataRoute.Sitemap = TERAPEUTAS.map((t) => ({
    url: `${SITIO}/terapeutas/${t.slug}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...fijas, ...cursos, ...terapeutas].map((e) => ({ ...e, lastModified: ahora }));
}
