import { INSTAGRAM, type Pregunta } from '@/lib/contenido';

/**
 * Datos estructurados (JSON-LD).
 *
 * Es el bloque que le dice a Google qué es esto: quién está detrás, dónde
 * está, qué enseña y qué preguntas responde la página. Sin él, el buscador
 * tiene que deducirlo del texto y casi siempre deduce de menos: sale un
 * resultado suelto en vez de una ficha con nombre, logotipo y enlaces.
 *
 * REGLA ÚNICA DE ESTE FICHERO: aquí no se escribe nada que no esté ya en la
 * web y confirmado. Un dato estructurado inventado —un teléfono, una
 * valoración, un número de alumnas, un horario— es PEOR que no tener ninguno:
 * Google lo contrasta con lo que se ve en la página y, cuando no cuadra, deja
 * de fiarse de todo el bloque. Por eso aquí no hay teléfono, ni
 * `aggregateRating`, ni `openingHours`, ni precios, ni fechas.
 *
 * Y la otra regla, la que no es negociable: esto es ESTÉTICA, no sanidad.
 * Ninguna descripción que salga de aquí puede prometer efectos sobre la salud
 * (defensas, toxinas, circulación, celulitis, dolor, patologías). Los textos
 * que entran por props vienen de las páginas, así que esa vigilancia es de
 * quien los escribe allí, pero lo que está fijo en este fichero ya cumple.
 *
 * Es un componente de SERVIDOR a propósito: no lleva estado ni escucha nada,
 * y el `<script type="application/ld+json">` tiene que llegar dentro del HTML
 * que Google recibe, no pintarse después con JavaScript.
 *
 * Referencia del patrón: node_modules/next/dist/docs/01-app/02-guides/json-ld.md
 */

/**
 * Dominio de producción, CON www.
 *
 * Cuarta copia de esta cadena: ya está en app/layout.tsx, app/robots.ts y
 * app/sitemap.ts. Sigue sin haber un módulo común donde ponerla y no me toca
 * crearlo; queda anotado en el informe. Va con www porque la versión sin www
 * responde 308 hacia esta, y un `@id` o una `url` que redirigen le dan a
 * Google dos direcciones para la misma cosa.
 */
const SITIO = 'https://www.sorelacarodivine.com';

/** Confirmado por Sorela. Es el único canal de contacto directo que se publica. */
const CORREO = 'sorelacarooficial@gmail.com';

/**
 * El nombre tal y como lo dicen el layout, el pie de página y el título por
 * defecto. Si en los tres sitios se llama igual, Google entiende que es una
 * sola entidad; si cada sitio lo escribe a su manera, entiende tres.
 */
const NOMBRE = 'Sorela Caro · Técnica Divine';

/**
 * Identificadores estables de cada entidad. Son etiquetas internas, no
 * direcciones que se visiten: sirven para que el curso pueda decir «lo imparte
 * ESTA de aquí» en vez de repetir la ficha entera, y para que si dos páginas
 * describen a Sorela, Google sepa que es la misma persona y no dos.
 */
const ID_NEGOCIO = `${SITIO}/#negocio`;
const ID_WEB = `${SITIO}/#web`;
const ID_SORELA = `${SITIO}/#sorela`;
const ID_LOGOTIPO = `${SITIO}/#logotipo`;

/**
 * Descripción del negocio, en los términos que sí se pueden publicar: qué
 * enseña y a quién, sin una sola promesa sobre el organismo. Es la misma idea
 * que la descripción del layout, dicha en tercera persona porque aquí no
 * habla ella, habla la ficha.
 */
const DESCRIPCION_NEGOCIO =
  'Sorela Caro enseña la Técnica Divine, su método de drenaje linfático manual ' +
  'avanzado, a esteticistas profesionales: primero una formación online y ' +
  'después dos jornadas presenciales con corrección sobre las manos.';

/** Tipos de ficha de negocio que este componente sabe pintar. Ver `negocio`. */
export type TipoNegocio = 'Organization' | 'LocalBusiness' | 'BeautySalon';

export type Curso = {
  /** Cómo se llama la formación. Tal cual aparece en la página. */
  nombre: string;
  /** Una o dos frases. Sin promesas de salud, sin precios, sin fechas. */
  descripcion: string;
  /** Ruta de la página que describe el curso, p. ej. '/formaciones'. */
  ruta?: string;
  /**
   * Qué lo distingue de los demás cursos de la MISMA página.
   *
   * Hace falta cuando una sola página describe varias formaciones, que es lo
   * que pasa en /formaciones con la online y la presencial. Sin esto las dos se
   * quedarían con el mismo identificador —el de la página— y Google las leería
   * como una sola entidad descrita dos veces, quedándose con una de las dos
   * descripciones. Una palabra basta: 'online', 'presencial'.
   */
  ancla?: string;
  /**
   * Qué acredita al terminar. Solo si la página lo dice: hoy lo dice la
   * marquesina de la portada («Certificado y sitio en el mapa público»).
   */
  certificado?: string;
  /** Qué hace falta para entrar. Hoy: experiencia real con clientas. */
  requisitos?: string;
};

export type Miga = {
  /** Cómo se llama el paso en la miga, p. ej. 'Formaciones'. */
  nombre: string;
  /** Ruta de ese paso, p. ej. '/formaciones'. '/' para la portada. */
  ruta: string;
};

type Props = {
  /**
   * Qué ficha de negocio pintar; omitido, ninguna.
   *
   * 'Organization' es la segura y la que vale para todo. 'LocalBusiness' y
   * 'BeautySalon' solo tienen sentido si la web llega a publicar la dirección
   * de la cabina: Google espera de un negocio local una calle, y hoy en la web
   * no hay ninguna a la vista. Mientras no la haya, 'Organization'.
   */
  negocio?: TipoNegocio;
  /** Pintar la ficha del sitio web (WebSite). */
  web?: boolean;
  /** Formaciones que describe esta página. */
  cursos?: Curso[];
  /**
   * Preguntas frecuentes. Se le pasan FAQS (u OBJECIONES) de lib/contenido,
   * NUNCA copiadas a mano: el dato estructurado tiene que decir exactamente lo
   * mismo que el acordeón que la persona ve. Si allí cambia una respuesta,
   * aquí cambia sola.
   *
   * Solo en la página donde esas preguntas SE VEN. Declarar un FAQPage en una
   * página sin acordeón es decirle a Google algo que no está ahí.
   */
  preguntas?: Pregunta[];
  /** Camino hasta esta página, empezando por la portada. */
  migas?: Miga[];
  /**
   * Imagen de la ficha de negocio. Por defecto el logotipo. Si algún día hay
   * una foto real de la cabina o del trabajo, se pasa aquí: se admite una ruta
   * del sitio ('/algo.png') o el `.src` de una foto importada.
   */
  imagen?: string;
};

/** Objeto JSON-LD suelto. Sin tipar contra schema.org: no hay dependencia que lo haga. */
type Nodo = Record<string, unknown>;

/**
 * Convierte una ruta del sitio en dirección absoluta y con www.
 *
 * En datos estructurados las direcciones relativas no valen: quien lee esto no
 * es el navegador, que sabe en qué página está, sino un robot que se guarda la
 * cadena tal cual. La portada se escribe sin la barra final para que coincida
 * con lo que publica app/sitemap.ts.
 */
function absoluta(ruta: string): string {
  if (/^https?:\/\//i.test(ruta)) return ruta;
  if (ruta === '/' || ruta === '') return SITIO;
  return `${SITIO}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
}

/**
 * Serializa el JSON para meterlo dentro de una etiqueta `<script>` del HTML.
 *
 * El problema real es el de siempre con un script en línea: si cualquier
 * texto que venga de lib/contenido llegara a contener la secuencia que cierra
 * una etiqueta script, el navegador cerraría ahí la etiqueta y el resto del
 * JSON se pintaría como texto suelto en medio de la página. Sustituyendo el
 * signo de menor que por su forma escapada eso no puede ocurrir. De paso van
 * también el de mayor que y el ampersand.
 *
 * Los tres siguen siendo JSON válido una vez escapados —el navegador los lee
 * de vuelta como los caracteres originales— y ninguno de los tres aparece
 * nunca como carácter de estructura del JSON, solo dentro de cadenas: por eso
 * reemplazarlos a lo bruto sobre el documento entero no puede estropearlo.
 *
 * Los separadores de línea U+2028 y U+2029 no se tocan: solo hacen daño
 * cuando el bloque se interpreta como JavaScript, y esto no lo es. Son JSON
 * perfectamente válido, y ningún texto del sitio los contiene.
 */
function serializar(datos: unknown): string {
  return JSON.stringify(datos)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Referencia corta a una entidad que puede estar descrita en otra página.
 *
 * Lleva el `@id` —para que Google la funda con la ficha completa cuando la
 * encuentre— y además el nombre, para que la referencia se entienda por sí
 * sola aunque en esta página no esté la ficha entera.
 */
const refNegocio: Nodo = { '@type': 'Organization', '@id': ID_NEGOCIO, name: NOMBRE };
const refSorela: Nodo = { '@type': 'Person', '@id': ID_SORELA, name: 'Sorela Caro' };

export default function DatosEstructurados({
  negocio,
  web,
  cursos,
  preguntas,
  migas,
  imagen,
}: Props) {
  const grafo: Nodo[] = [];

  /* ---------- Quién está detrás ---------- */
  if (negocio) {
    grafo.push({
      '@type': negocio,
      '@id': ID_NEGOCIO,
      name: NOMBRE,
      alternateName: 'Técnica Divine',
      description: DESCRIPCION_NEGOCIO,
      url: SITIO,
      email: CORREO,
      /**
       * NO hay `telephone`, y no es un olvido. En lib/contenido.ts vive
       * WHATSAPP_SORELA, que es su móvil personal y está ahí solo como salida
       * de emergencia de un formulario. Publicarlo aquí lo convertiría en el
       * teléfono que Google enseña en la ficha, a la vista de cualquiera y
       * sonando a cualquier hora. Si algún día hay un número de negocio, entra
       * aquí y no antes.
       */
      /**
       * El logotipo que Google enseña en la ficha. Va a /icon.png, que es el
       * que Next publica desde app/icon.png: 512×512, fondo blanco y la flor
       * con las iniciales, recortada al borde.
       *
       * NO va a /icono.png, aunque ese archivo siga ahí y también mida
       * 512×512. Ese es el logotipo horizontal metido dentro de un cuadrado:
       * la marca ocupa la banda del centro y el resto son dos franjas negras.
       * Ya se retiró de la pestaña del navegador por ilegible —está contado en
       * app/layout.tsx— y como logotipo de la ficha sería lo mismo otra vez:
       * Google lo recorta a un círculo o a un cuadrado pequeño y lo que queda
       * es negro con una raya dorada en medio.
       */
      logo: {
        '@type': 'ImageObject',
        '@id': ID_LOGOTIPO,
        url: `${SITIO}/icon.png`,
        width: 512,
        height: 512,
        caption: NOMBRE,
      },
      image: imagen ? absoluta(imagen) : { '@id': ID_LOGOTIPO },
      /**
       * Badalona, provincia de Barcelona. Sin calle ni código postal: no los
       * publica ninguna página, y una dirección postal que no se puede
       * contrastar con lo que se ve es justo el tipo de dato que hace que
       * Google desconfíe del resto. La localidad sí es cierta y sí ayuda a la
       * búsqueda de clienta final («drenaje linfático Badalona»).
       */
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Badalona',
        addressRegion: 'Barcelona',
        addressCountry: 'ES',
      },
      /** El perfil que confirma que esta entidad es la misma de Instagram. */
      sameAs: [INSTAGRAM],
      founder: {
        ...refSorela,
        url: `${SITIO}/sobre`,
        jobTitle: 'Creadora de la Técnica Divine',
        sameAs: [INSTAGRAM],
      },
      knowsLanguage: 'es',
    });
  }

  /* ---------- El sitio ---------- */
  if (web) {
    grafo.push({
      '@type': 'WebSite',
      '@id': ID_WEB,
      url: SITIO,
      name: NOMBRE,
      description: DESCRIPCION_NEGOCIO,
      inLanguage: 'es-ES',
      publisher: refNegocio,
      /**
       * Sin `potentialAction` / SearchAction: esa propiedad le promete a Google
       * un buscador interno al que mandar consultas, y esta web no tiene
       * ninguno. Declararlo sería pedirle que enseñe una caja de búsqueda que
       * no lleva a ningún sitio.
       */
    });
  }

  /* ---------- Las formaciones ---------- */
  for (const curso of cursos ?? []) {
    const url = curso.ruta ? absoluta(curso.ruta) : undefined;
    // El `url` es el de la página, igual para todos los cursos que describa;
    // el `@id` lleva además el ancla, que es lo que los separa.
    const id = url ? `${url}#curso${curso.ancla ? `-${curso.ancla}` : ''}` : undefined;
    grafo.push({
      '@type': 'Course',
      ...(url ? { '@id': id, url } : {}),
      name: curso.nombre,
      description: curso.descripcion,
      inLanguage: 'es',
      /**
       * Quién la da. `instructor` no sirve aquí: en schema.org cuelga de una
       * convocatoria concreta (CourseInstance), no del curso, y convocatoria
       * no hay. Lo que sí es del curso es quién lo imparte como escuela
       * (`provider`) y quién lo ha creado y lo da en persona (`author`), que
       * es la misma Sorela del `founder` de arriba: van con el mismo `@id`,
       * así que Google entiende que es una sola persona y no dos.
       */
      provider: refNegocio,
      author: refSorela,
      /**
       * Aquí NO va `hasCourseInstance`. Una convocatoria en schema.org pide
       * fecha, modalidad y duración o lugar, y hoy no hay ninguna fecha
       * cerrada: la propia página lo dice. Inventar una convocatoria para
       * rellenar el hueco sería prometer en Google un curso con fecha que al
       * entrar no existe. Cuando haya convocatorias reales, entran aquí con
       * sus fechas, su ciudad y su precio, y no antes.
       *
       * Tampoco va `offers`: no hay precio público de la formación.
       */
      ...(curso.certificado ? { educationalCredentialAwarded: curso.certificado } : {}),
      ...(curso.requisitos ? { coursePrerequisites: curso.requisitos } : {}),
    });
  }

  /* ---------- Las preguntas ---------- */
  if (preguntas?.length) {
    grafo.push({
      '@type': 'FAQPage',
      /**
       * Las preguntas se pintan desde lib/contenido: el texto del dato y el
       * del acordeón salen de la misma línea, así que no pueden separarse.
       *
       * Google ya casi no enseña el desplegable de FAQ en los resultados —lo
       * reservó a sitios oficiales en 2023—, pero el bloque sigue sirviendo
       * para que entienda de qué va la página y para que los buscadores que
       * responden con texto citen la respuesta buena y no una inventada.
       */
      mainEntity: preguntas.map((p) => ({
        '@type': 'Question',
        name: p.q,
        acceptedAnswer: { '@type': 'Answer', text: p.a },
      })),
    });
  }

  /* ---------- El camino hasta aquí ---------- */
  // Con menos de dos pasos no hay camino que contar: una miga de un solo
  // elemento es ruido que Google marca como incompleta.
  if (migas && migas.length > 1) {
    grafo.push({
      '@type': 'BreadcrumbList',
      itemListElement: migas.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: m.nombre,
        item: absoluta(m.ruta),
      })),
    });
  }

  // Sin props no hay nada que declarar, y un script vacío es un script que
  // alguien acabará mirando preguntándose qué falta.
  if (grafo.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      // Es JSON-LD, no código: se pinta con una etiqueta <script> normal y no
      // con next/script, que está para cargar y ejecutar JavaScript.
      dangerouslySetInnerHTML={{
        __html: serializar({ '@context': 'https://schema.org', '@graph': grafo }),
      }}
    />
  );
}
