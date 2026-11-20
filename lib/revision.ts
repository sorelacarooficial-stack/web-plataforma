/**
 * Página de revisión para Sorela (`revision.sorelacarodivine.com`, ruta
 * `/revision`). Aquí se cuelga todo lo que hay que enseñarle antes de
 * publicarlo; debajo de cada pieza puede dejar «Me gusta así» o escribir lo
 * que quiere cambiar. Los comentarios se guardan en Firestore
 * (`revision_comentarios`, ver app/api/revision/route.ts) y salen en la misma
 * página, para que quien edite los vea.
 *
 * Para añadir algo: una pieza nueva en `GRUPOS` con un `id` que no cambie
 * nunca (los comentarios van colgados de ese id).
 */

export const COLECCION_REVISION = 'revision_comentarios';

export type Formato = { etiqueta: string; src: string; poster?: string; tipo: 'video' | 'imagen' | 'pagina' };

export type Pieza = {
  id: string;
  titulo: string;
  /** Lo que hay que mirar: qué se lee en los 3 primeros segundos, para qué sirve… */
  nota?: string;
  /** Lo que dice Sorela (la voz), para que pueda corregir el texto. */
  guion?: string;
  formatos: Formato[];
  /** Si está, la pieza aún se está editando: sale una barra con este porcentaje en vez del vídeo. */
  progreso?: number;
};

export type Grupo = { id: string; titulo: string; explicacion: string; piezas: Pieza[] };

const M = '/revision/medellin';
const anuncio = (id: string): Formato[] => [
  { etiqueta: 'Historias y reels (9:16)', src: `${M}/${id}-9x16.mp4`, poster: `${M}/${id}-9x16.jpg`, tipo: 'video' },
  { etiqueta: 'Feed (4:5)', src: `${M}/${id}-4x5.mp4`, poster: `${M}/${id}-4x5.jpg`, tipo: 'video' },
];

export const GRUPOS: Grupo[] = [
  {
    id: 'medellin-anuncios',
    titulo: 'Medellín · anuncios',
    explicacion:
      'Cinco anuncios para la formación presencial de Medellín (28, 29 y 30 de enero). Todavía no se han publicado y no llevan precio. La voz es la tuya, hecha con inteligencia artificial a partir de tus vídeos.',
    piezas: [
      {
        id: 'med-autoridad',
        titulo: 'Anuncio 1 · Autoridad',
        nota: 'Empieza con «+25.000 casos en 30 años» sobre tu foto.',
        guion:
          'Soy Sorela Caro, creadora de la Técnica Divine. Treinta años y más de veinticinco mil casos con mis manos. Si eres terapeuta o esteticista, ahora te lo enseño en persona. En Medellín, el veintiocho, veintinueve y treinta de enero.',
        formatos: anuncio('autoridad'),
      },
      {
        id: 'med-manos',
        titulo: 'Anuncio 2 · Las manos',
        nota: 'Empieza con las manos trabajando a pantalla completa y «Para terapeutas, esteticistas y masajistas».',
        guion:
          'Terapeuta, esteticista, masajista: tus manos ya saben tocar. En mi formación presencial aprendes a leer el cuerpo. A observar antes de tocar, la estimulación ganglionar, el ritmo y el arrastre. Tres días conmigo en Medellín.',
        formatos: anuncio('manos'),
      },
      {
        id: 'med-medellin',
        titulo: 'Anuncio 3 · Medellín',
        nota: 'Empieza con las fechas «28 · 29 · 30 enero» en grande, sobre dorado.',
        guion:
          'Te espero en Medellín para formarte en la Técnica Divine, mi método de drenaje y moldeo, solo con las manos. Veintiocho, veintinueve y treinta de enero. Tres días presenciales a mi lado, y te llevas tu certificación.',
        formatos: anuncio('medellin'),
      },
      {
        id: 'med-plazas',
        titulo: 'Anuncio 4 · Solo 10 plazas',
        nota: 'Empieza con «10 plazas» y diez asientos que se encienden.',
        guion:
          'Esta formación presencial es para terapeutas y esteticistas que quieren aprender la Técnica Divine conmigo. Solo abro diez plazas, porque voy a corregir tus manos, una a una. Medellín, del veintiocho al treinta de enero.',
        formatos: anuncio('plazas'),
      },
      {
        id: 'med-certificado',
        titulo: 'Anuncio 5 · Fórmate con la creadora',
        nota: 'Empieza con el diploma de la certificación girando en 3D.',
        guion:
          '¿Quieres dedicarte al drenaje y al moldeo corporal y facial? Fórmate con quien creó el método. Tres días presenciales conmigo en Medellín, con práctica real y tu certificación en la Técnica Divine.',
        formatos: anuncio('certificado'),
      },
    ],
  },
  {
    id: 'medellin-pagina',
    titulo: 'Medellín · página de reserva',
    explicacion:
      'La página a la que llevan los anuncios. Está oculta: no sale en el menú ni en Google. El botón abre WhatsApp. El reparto de los tres días lo hemos propuesto nosotros: dinos si es así.',
    piezas: [
      {
        id: 'med-landing',
        titulo: 'La página entera',
        nota: 'Ábrela y bájala hasta el final. Mira sobre todo «Los tres días» y las preguntas.',
        formatos: [{ etiqueta: 'Abrir la página', src: '/medellin', tipo: 'pagina' }],
      },
      {
        id: 'med-landing-video',
        titulo: 'Vídeo de la página',
        guion:
          'Soy Sorela Caro, creadora de la Técnica Divine. Llevo treinta años y más de veinticinco mil casos trabajando con mis manos. Ahora te lo enseño en persona: una formación presencial para terapeutas, esteticistas y masajistas, y para quien quiera dedicarse a esto. Vas a aprender a leer el cuerpo, y yo voy a corregir tus manos, una a una. Medellín, veintiocho, veintinueve y treinta de enero. Solo diez plazas.',
        formatos: [
          { etiqueta: 'Ordenador (16:9)', src: '/medellin/landing-16x9.mp4', poster: '/medellin/landing-16x9.jpg', tipo: 'video' },
          { etiqueta: 'Móvil (9:16)', src: '/medellin/landing-9x16.mp4', poster: '/medellin/landing-9x16.jpg', tipo: 'video' },
        ],
      },
    ],
  },
  {
    id: 'medellin-posts',
    titulo: 'Medellín · publicaciones',
    explicacion: 'Dos publicaciones con tus fotos, cada una para el feed y para historias.',
    piezas: [
      {
        id: 'med-post1',
        titulo: 'Publicación 1',
        formatos: [
          { etiqueta: 'Feed', src: `${M}/post1-feed.jpg`, tipo: 'imagen' },
          { etiqueta: 'Historia', src: `${M}/post1-historia.jpg`, tipo: 'imagen' },
        ],
      },
      {
        id: 'med-post2',
        titulo: 'Publicación 2',
        formatos: [
          { etiqueta: 'Feed', src: `${M}/post2-feed.jpg`, tipo: 'imagen' },
          { etiqueta: 'Historia', src: `${M}/post2-historia.jpg`, tipo: 'imagen' },
        ],
      },
    ],
  },
  {
    id: 'empieza-aqui',
    titulo: 'Plataforma · «Empieza aquí»',
    explicacion:
      'Tus vídeos de bienvenida para las alumnas. Los estamos terminando: color y sonido. Cuando estén, aparecerán aquí para que los veas. Faltan por grabar: «Tu plataforma en un minuto», «Tus reuniones conmigo» y «Tu grupo y cómo pedir ayuda».',
    piezas: [
      ['00', 'Bienvenida'],
      ['01', 'Te doy la bienvenida'],
      ['03a', 'Cómo avanzas en tu formación'],
      ['03b', 'Por dónde empezar'],
      ['04b', 'La clase en vivo', 'Aquí dices que la clase «quedará grabada en la plataforma», y todavía no hay sitio para las grabaciones. ¿Lo hacemos o quitamos la frase?'],
      ['05b', 'Tu comunidad y cómo pedir ayuda'],
      ['06', 'Que las clientas te encuentren'],
      ['07', 'Tus próximos pasos'],
    ].map(([n, titulo, nota]) => ({
      id: `ea-${n}`,
      titulo: `${n} · ${titulo}`,
      nota,
      progreso: 63,
      formatos: [{ etiqueta: 'Vídeo', src: `/empieza-aqui/${n}.mp4`, poster: `/empieza-aqui/${n}.jpg`, tipo: 'video' as const }],
    })),
  },
];

export const ID_PIEZAS = new Set(GRUPOS.flatMap((g) => g.piezas.map((p) => p.id)));
