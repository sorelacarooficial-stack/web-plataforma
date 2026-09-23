import type { MetadataRoute } from 'next';
import { TERAPEUTAS } from '@/lib/terapeutas';

/**
 * Con www, igual que en app/robots.ts y en app/layout.tsx.
 *
 * Un mapa del sitio escrito sin www listaría ocho direcciones que contestan
 * 308 y redirigen a otras ocho: el buscador acabaría en las buenas, pero
 * gastando el doble de visitas y con la sospecha de que el sitio no sabe cuál
 * es su propia dirección. La constante se repite en los tres ficheros porque
 * no hay un sitio común donde ponerla; si se crea uno, que sea el único.
 */
const SITIO = 'https://www.sorelacarodivine.com';

/**
 * Fecha del último cambio real de cada página. Se escribe a mano.
 *
 * Aquí había `new Date()`: cada compilación juraba que las ocho páginas habían
 * cambiado en ese mismo instante, todas a la vez. Google aprende rápido a no
 * hacer caso de un lastmod así, y el día que de verdad se reescribe una página
 * ya no se lo cree. Al tocar el texto de una página, sube SOLO su fecha.
 */
const FECHAS = {
  portada: '2026-09-23',
  metodo: '2026-09-23',
  formaciones: '2026-09-23',
  comunidad: '2026-09-23',
  terapeutas: '2026-09-23',
  sobre: '2026-09-23',
  contacto: '2026-09-23',
} as const;

export default function sitemap(): MetadataRoute.Sitemap {
  /**
   * El orden de prioridad es el del negocio, no el del menú: primero la
   * portada, después la página que vende la formación, después la que explica
   * el método —por la que se busca el nombre— y al final las de servicio.
   */
  const fijas: MetadataRoute.Sitemap = [
    { url: SITIO, lastModified: FECHAS.portada, changeFrequency: 'monthly', priority: 1 },
    {
      url: `${SITIO}/formaciones`,
      lastModified: FECHAS.formaciones,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITIO}/metodo`,
      lastModified: FECHAS.metodo,
      changeFrequency: 'yearly',
      priority: 0.8,
    },
    {
      url: `${SITIO}/comunidad`,
      lastModified: FECHAS.comunidad,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITIO}/terapeutas`,
      lastModified: FECHAS.terapeutas,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITIO}/sobre`,
      lastModified: FECHAS.sobre,
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${SITIO}/contacto`,
      lastModified: FECHAS.contacto,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];

  // Las fichas de curso ya no existen: sus fechas y precios eran inventados y
  // se han retirado. Volverán al mapa del sitio cuando haya convocatorias de
  // verdad. Dejarlas aquí haría que Google reclamase páginas que dan 404.

  // Los textos legales tampoco entran, y no es un olvido: salen con noindex
  // desde su propia cabecera. Pedirle a Google que indexe en el mapa lo que la
  // página le prohíbe indexar es mandarle dos órdenes contrarias.

  // Mientras TERAPEUTAS esté vacío esto no añade ninguna dirección: el listado
  // sigue en el mapa, pero sin fichas que no existen.
  const terapeutas: MetadataRoute.Sitemap = TERAPEUTAS.map((t) => ({
    url: `${SITIO}/terapeutas/${t.slug}`,
    lastModified: FECHAS.terapeutas,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [...fijas, ...terapeutas];
}
