/**
 * La dirección de la web y las piezas comunes de los datos estructurados.
 *
 * Hasta ahora `SITIO` estaba copiado a mano en cinco ficheros (layout, robots,
 * sitemap, DatosEstructurados y el artículo del blog), y cada copia llevaba un
 * comentario pidiendo que algún día hubiera un sitio común. Este es ese sitio.
 * Lo nuevo (las fichas de las terapeutas, las páginas de ciudad, el mapa del
 * sitio) ya lee de aquí; las copias que quedan en ficheros de otras partes se
 * pueden ir cambiando por esta sin tocar nada más.
 *
 * Es un módulo PURO, sin nada de servidor: lo leen componentes de servidor,
 * el mapa del sitio y, si hace falta, el navegador.
 */

/**
 * Dominio de producción, CON www. La versión sin www responde 308 hacia esta,
 * y una canónica, un `@id` o una `url` que redirigen le dan a Google dos
 * direcciones para la misma cosa.
 */
export const SITIO = 'https://www.sorelacarodivine.com';

/**
 * El nombre tal y como lo dicen el layout, el pie de página y el título por
 * defecto. Si en todos los sitios se llama igual, Google entiende que es una
 * sola entidad.
 */
export const NOMBRE_SITIO = 'Sorela Caro · Técnica Divine';

/**
 * Identificadores estables de cada entidad del grafo. Son etiquetas internas,
 * no direcciones que se visiten: sirven para que una ficha de terapeuta pueda
 * decir «la certifica ESTA de aquí» sin repetir la ficha entera del negocio,
 * que ya va en todas las páginas desde app/layout.tsx.
 */
export const ID_NEGOCIO = `${SITIO}/#negocio`;
export const ID_WEB = `${SITIO}/#web`;
export const ID_SORELA = `${SITIO}/#sorela`;
export const ID_LOGOTIPO = `${SITIO}/#logotipo`;

/** Objeto JSON-LD suelto. Sin tipar contra schema.org: no hay dependencia que lo haga. */
export type Nodo = Record<string, unknown>;

/** Un paso del camino hasta una página: «Localiza tu terapeuta» → '/terapeutas'. */
export type Miga = {
  /** Cómo se llama el paso en la miga, p. ej. 'Formaciones'. */
  nombre: string;
  /** Ruta de ese paso, p. ej. '/formaciones'. '/' para la portada. */
  ruta: string;
};

/**
 * Convierte una ruta del sitio en dirección absoluta y con www.
 *
 * En datos estructurados las direcciones relativas no valen: quien lee esto no
 * es el navegador, que sabe en qué página está, sino un robot que se guarda la
 * cadena tal cual. La portada se escribe sin la barra final para que coincida
 * con lo que publica app/sitemap.ts.
 */
export function absoluta(ruta: string): string {
  if (/^https?:\/\//i.test(ruta)) return ruta;
  if (ruta === '/' || ruta === '') return SITIO;
  return `${SITIO}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
}

/**
 * Serializa el JSON para meterlo dentro de una etiqueta `<script>` del HTML.
 *
 * Importa más ahora que antes: en las fichas de las terapeutas el texto lo
 * escribe cada una (su nombre, su frase, el nombre de su centro), así que ya
 * no es solo texto de la casa. Si alguno contuviera la secuencia que cierra
 * una etiqueta script, el navegador cerraría ahí la etiqueta y lo que viniera
 * detrás se interpretaría como HTML. Sustituyendo el signo de menor que por su
 * forma escapada eso no puede ocurrir. De paso van el de mayor que y el
 * ampersand.
 *
 * Los tres siguen siendo JSON válido una vez escapados —el lector los lee de
 * vuelta como los caracteres originales— y ninguno aparece nunca como carácter
 * de estructura del JSON, solo dentro de cadenas: por eso reemplazarlos sobre
 * el documento entero no puede estropearlo.
 *
 * Los separadores U+2028 y U+2029 también se escapan: son JSON válido, pero
 * algún lector antiguo los trata como fin de línea dentro de una cadena, y
 * ahora el texto viene de fuera.
 */
export function serializar(datos: unknown): string {
  return JSON.stringify(datos)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * El BreadcrumbList de un camino. Con menos de dos pasos no hay camino que
 * contar: una miga de un solo elemento es ruido que Google marca como
 * incompleta, así que devuelve null.
 */
export function nodoMigas(migas: Miga[]): Nodo | null {
  if (migas.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.nombre,
      item: absoluta(m.ruta),
    })),
  };
}

/**
 * Referencia corta al negocio. Lleva el `@id` —para que Google la funda con la
 * ficha completa que pinta el layout— y el nombre, para que se entienda sola.
 */
export const REF_NEGOCIO: Nodo = { '@type': 'Organization', '@id': ID_NEGOCIO, name: NOMBRE_SITIO };

/**
 * La imagen de compartir por defecto: la misma que declara app/layout.tsx.
 *
 * Hace falta repetirla porque los metadatos se mezclan POR ARRIBA: una página
 * que escribe su propio `openGraph` sustituye el del layout entero, imagen
 * incluida, y sin esto el enlace se compartiría por WhatsApp sin foto.
 */
export const IMAGEN_COMPARTIR = {
  url: '/compartir.jpg',
  width: 1200,
  height: 630,
  alt: 'Sorela Caro, creadora de la Técnica Divine',
};

/** Lo del `openGraph` del layout que cada página tiene que repetir (ver arriba). */
export const OG_BASE = {
  locale: 'es_ES',
  siteName: NOMBRE_SITIO,
} as const;

/**
 * Escapa un texto para meterlo en XML. El mapa del sitio de Next escribe las
 * direcciones tal cual, sin escapar, y las fotos de Storage llevan un `&` en la
 * dirección (`?alt=media&token=…`): sin esto, un solo `&` suelto rompe el XML
 * entero y Google deja de leer el mapa del sitio completo, no solo esa línea.
 */
export function xml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
