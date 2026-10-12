import type { MetadataRoute } from 'next';
import { articulosPublicados } from '@/lib/blog';
import { listarFichasPublicas } from '@/lib/fichas-publicas';
import { SITIO, xml } from '@/lib/sitio';
import { ciudadesDe } from '@/lib/terapeutas';

/* El mapa se rehace cada hora, al publicar en el blog (ver app/api/blog) y al
   publicar, cambiar o quitar una ficha de terapeuta (ver lib/fichas.ts). */
export const revalidate = 3600;

/*
 * `SITIO` (con www) sale ahora de lib/sitio.ts, el sitio común que pedía este
 * comentario. Un mapa del sitio escrito sin www listaría direcciones que
 * contestan 308 y redirigen: el buscador acabaría en las buenas, pero
 * gastando el doble de visitas.
 */

/**
 * Fecha del último cambio real de cada página. Se escribe a mano.
 *
 * Aquí había `new Date()`: cada compilación juraba que las ocho páginas habían
 * cambiado en ese mismo instante, todas a la vez. Google aprende rápido a no
 * hacer caso de un lastmod así, y el día que de verdad se reescribe una página
 * ya no se lo cree. Al tocar el texto de una página, sube SOLO su fecha.
 */
const FECHAS = {
  portada: '2026-10-12',
  metodo: '2026-09-23',
  formaciones: '2026-09-23',
  comunidad: '2026-09-23',
  terapeutas: '2026-10-12',
  sobre: '2026-09-23',
  contacto: '2026-09-23',
} as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  /* Las fichas de las terapeutas, cada una con la fecha de su último cambio
     de verdad y su foto (la de Google Imágenes es otra puerta de entrada).
     Y una página por ciudad con al menos una ficha, con la fecha de la ficha
     más reciente de esa ciudad. Sin fichas, ni una dirección de más: nada de
     mandar a Google a páginas que dan 404. */
  const fichas = await listarFichasPublicas();
  const terapeutas: MetadataRoute.Sitemap = fichas.map((t) => ({
    url: `${SITIO}/terapeutas/${t.slug}`,
    lastModified: t.actualizado || undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
    // Escapada: la dirección de la foto lleva un `&` (ver `xml` en lib/sitio).
    ...(t.foto ? { images: [xml(t.foto)] } : {}),
  }));
  const ultima = (lista: typeof fichas) =>
    lista.reduce<string | undefined>((m, t) => (t.actualizado && (!m || t.actualizado > m) ? t.actualizado : m), undefined);
  const ciudades: MetadataRoute.Sitemap = ciudadesDe(fichas).map((c) => ({
    url: `${SITIO}/terapeutas/en/${c.ciudadSlug}`,
    lastModified: ultima(fichas.filter((t) => t.ciudadSlug === c.ciudadSlug)),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));
  /* El listado cambia cuando cambia cualquiera de sus fichas. */
  const ultimaFicha = ultima(fichas);
  const fijasConMapa = fijas.map((f) =>
    f.url === `${SITIO}/terapeutas` && ultimaFicha && ultimaFicha > FECHAS.terapeutas ? { ...f, lastModified: ultimaFicha } : f
  );

  /* El blog: la portada del blog y cada artículo publicado, con la fecha de
     su último cambio de verdad, que aquí sí se sabe. */
  const articulos = await articulosPublicados(500);
  const blog: MetadataRoute.Sitemap = articulos.length
    ? [
        { url: `${SITIO}/blog`, lastModified: articulos[0].actualizado ?? articulos[0].publicado ?? undefined, changeFrequency: 'weekly', priority: 0.7 },
        ...articulos.map((a) => ({
          url: `${SITIO}/blog/${a.slug}`,
          lastModified: a.actualizado ?? a.publicado ?? undefined,
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        })),
      ]
    : [];

  return [...fijasConMapa, ...blog, ...ciudades, ...terapeutas];
}
