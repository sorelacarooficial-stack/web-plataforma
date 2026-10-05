/** Copy fijo del sitio: FAQ, piezas de la comunidad y textos de marca.
 *  Transcrito del prototipo aprobado; no inventar nada aquí sin pasar por Sorela.
 *
 *  La fecha y la hora de apertura NO se escriben aquí: salen de lib/apertura.ts,
 *  que es el único sitio donde viven. */
import { APERTURA_LARGA, APERTURA_POR_PAISES, DIA_APERTURA, FECHA_APERTURA, HORA_ESPANA } from './apertura';

export const INSTAGRAM = 'https://instagram.com/sorelacaro_';
export const INSTAGRAM_USUARIO = '@sorelacaro_';

/**
 * Móvil de Sorela, con prefijo, para la salida de emergencia del formulario:
 * si la captación falla, se le ofrece a la persona escribir por WhatsApp con
 * el mensaje ya redactado, y así el contacto no se pierde.
 *
 * Se escribe con espacios porque así se lee; al construir el enlace de
 * WhatsApp se le quitan, que solo admite dígitos.
 */
export const WHATSAPP_SORELA: string = '+34 686 15 45 56';

/*
 * Aquí estaba EN_LISTA = 128, «cuántas hay ya en la lista de espera». Era una
 * cifra del prototipo que se enseñaba como real. Cuando la lista guarde de
 * verdad en Firestore, este número se lee de ahí; hasta entonces no se
 * publica ninguno.
 */

/**
 * Dónde está el vídeo de un testimonio. Dos formas, y las dos valen.
 *
 * `youtube` no cuesta nada, no engorda el repositorio y aguanta cualquier
 * tráfico, pero al darle al play aparece el reproductor de YouTube con su
 * marca. `archivo` es un MP4 servido desde la propia web: se reproduce dentro
 * de la tarjeta, sin salir del diseño, y permite que la portada se mueva sola
 * en silencio; a cambio, los vídeos viven en el repositorio y hay que
 * comprimirlos antes (ver `scripts/preparar-testimonios.mjs`).
 *
 * `drive` es el tercero, y es el rápido: el vídeo se queda donde ya está, en
 * la carpeta de Drive, y lo carga el navegador de quien mira la web. No hay
 * que bajar, comprimir ni subir nada. A cambio hereda las tres pegas de Drive
 * —el archivo tiene que estar compartido con enlace público, el reproductor es
 * el suyo y no es un CDN—, que están explicadas en `lib/drive.ts`. Sirve para
 * hoy; para el lanzamiento conviene pasarlos a uno de los otros dos.
 *
 * La tarjeta se pinta igual en los tres casos: lo único que cambia es qué se
 * monta al pulsar.
 */
export type Video =
  | { tipo: 'youtube'; id: string }
  | { tipo: 'drive'; id: string }
  | {
      tipo: 'archivo';
      /** El vídeo entero, con sonido. Solo se baja al abrir la tarjeta. */
      src: string;
      /**
       * Los primeros segundos, sin sonido y en pequeño: lo que se ve corriendo
       * en la portada.
       *
       * Va aparte del vídeo entero por una razón de peso, literalmente. Cinco
       * tarjetas moviéndose a la vez con el archivo completo son trece megas en
       * la primera pantalla; con los bucles son trescientos kilobytes. Lo
       * escribe `npm run testimonios`. Si falta, la tarjeta usa el vídeo entero
       * para el bucle: funciona, pero pesa.
       */
      bucle?: string;
      poster: string;
    };

export type Testimonio = {
  /** Nombre y apellido. Las iniciales del círculo salen de aquí, no se escriben. */
  nombre: string;
  /** Su vídeo. Es lo que se enseña: lo demás acompaña. */
  video: Video;
  /**
   * Una frase suya, escrita.
   *
   * No es decoración ni un resumen: es lo que lee quien no va a darle al play,
   * que es la mayoría. Si esto falta, la tarjeta es una foto con un botón y no
   * dice nada. Sale también para quien navega con lector de pantalla, que no
   * puede ver el vídeo.
   */
  frase: string;
  /** Dónde trabaja: «Valencia», «Bogotá». Opcional. */
  lugar?: string;
  /** Qué hizo: «Formación Base», «Comunidad Divine», «Clienta». Opcional. */
  de?: string;
};

/**
 * Lo que dicen las que ya han pasado por aquí.
 *
 * ESTÁ VACÍO A PROPÓSITO, y mientras lo esté el carrusel de la portada no se
 * pinta: ni la sección, ni el título, ni un «próximamente». Un apartado de
 * testimonios vacío no es un hueco que rellenar más adelante, es un cartel
 * diciendo que nadie ha dicho nada.
 *
 * Aquí había tres firmados por Marta Ibáñez, Nuria Sanchís y Carla Redondo:
 * las tres primeras terapeutas del mapa, que eran inventadas. Uno además decía
 * «subí el precio de la sesión un 30 %», que es una promesa de rentabilidad
 * con cifra, de las que no se pueden publicar.
 *
 * TRES REGLAS PARA LOS QUE ENTREN AQUÍ. No son manías:
 *
 *   1. Reales, de una persona que existe y que ha dado permiso. Publicar
 *      testimonios inventados es publicidad engañosa, y desde la reforma de
 *      2021 está expresamente prohibido en España.
 *   2. Sin efectos sobre la salud. Esto es estética, no sanidad: nada de
 *      toxinas, retención, circulación, dolor, celulitis ni adelgazar. Sí se
 *      puede contar qué aprendió, cómo trabaja ahora y cómo la trataron.
 *   3. Sin cifras de dinero. «Cobro más», «facturo X», «subí el precio un
 *      30 %» son promesas de rentabilidad y tampoco se pueden publicar.
 *
 * Si vienen de capturas de WhatsApp, se transcriben a texto: una captura lleva
 * el número de teléfono y la foto de la persona, y eso no se publica aunque
 * ella diga que sí.
 *
 * El formato es este, y se pueden poner los que sean:
 *
 *   { nombre: 'María José Pardo',
 *     video: { tipo: 'youtube', id: 'dQw4w9WgXcQ' },
 *     frase: 'Lo que dijo, para quien no le dé al play.',
 *     lugar: 'Valencia',
 *     de: 'Formación Base' },
 *
 * O con el vídeo alojado aquí, que es lo que deja `npm run testimonios`:
 *
 *   { nombre: 'María José Pardo',
 *     video: { tipo: 'archivo', src: '/testimonios/1.mp4', poster: '/testimonios/1.jpg' },
 *     frase: '…' },
 *
 * ---------------------------------------------------------------------------
 * DE DÓNDE SALEN ESTOS TRES, Y DÓNDE ESTÁN LOS OTROS DOS.
 *
 * Los vídeos llevan los subtítulos incrustados, así que el nombre y la frase
 * están leídos de la propia imagen, no inventados ni resumidos. Cada frase es
 * un tramo seguido de lo que dice, sin recomponer.
 *
 * Faltan dos de los cinco:
 *
 *   · El 6 está listo —vídeo comprimido, bucle y carátula— pero en ningún
 *     momento dice su nombre. Sin nombre no se pinta: una cara con un
 *     «Testimonio 4» debajo es peor que no enseñar nada.
 *   · El 5 está a la espera de una decisión que no es técnica. Dice «pasé de
 *     no llegar a los ingresos suficientes a cobrar más de lo que me podía
 *     imaginar» y «te aporta libertad financiera». Eso es una promesa de
 *     rentabilidad sobre una formación de pago, y en publicidad en España es
 *     de lo poco que está expresamente prohibido. No basta con no escribirlo
 *     aquí abajo: lo dice el vídeo, y el vídeo se reproduce. O se recorta la
 *     parte del dinero —los primeros 15 segundos, que hablan del
 *     acompañamiento, valen solos— o no entra.
 *
 * El 2 dice «quería incrementar mucho más mis ingresos». Eso es distinto y sí
 * entra: cuenta lo que ella buscaba, no lo que el curso le dio. No es una
 * promesa; es un motivo.
 * ---------------------------------------------------------------------------
 */
export const TESTIMONIOS: Testimonio[] = [
  {
    nombre: 'Estefanía Galeano',
    video: {
      tipo: 'archivo',
      src: '/testimonios/2.mp4',
      bucle: '/testimonios/2-bucle.mp4',
      poster: '/testimonios/2.jpg',
    },
    frase: 'Realicé con Sorela aproximadamente seis meses. El curso me aportó muchísimos más conocimientos.',
    de: 'Formación',
  },
  {
    nombre: 'Andrea Muñoz',
    video: {
      tipo: 'archivo',
      src: '/testimonios/3.mp4',
      bucle: '/testimonios/3-bucle.mp4',
      poster: '/testimonios/3.jpg',
    },
    frase: 'La he elegido porque de verdad me ha ofrecido resultados inmediatos, y eso es lo que necesito para mi centro.',
    /* Corregido por Sorela: hizo la presencial, no la Base. */
    de: 'Formación presencial',
  },
  {
    nombre: 'Celia Prat',
    video: {
      tipo: 'archivo',
      src: '/testimonios/4.mp4',
      bucle: '/testimonios/4-bucle.mp4',
      poster: '/testimonios/4.jpg',
    },
    frase: 'Sorela desde un principio me analizó el cuerpo y me dijo qué partes eran más necesarias trabajar.',
    de: 'Clienta',
  },

  /* Listo para entrar en cuanto haya nombre. Lo que dice, leído del vídeo:
     «Me gusta mucho la manera en que explica: se entiende desde el momento
     uno. Se nota que tiene muchos años de experiencia.»
  {
    nombre: '',
    video: {
      tipo: 'archivo',
      src: '/testimonios/6.mp4',
      bucle: '/testimonios/6-bucle.mp4',
      poster: '/testimonios/6.jpg',
    },
    frase: 'Me gusta mucho la manera en que explica: se entiende desde el momento uno.',
  },
  */
];


export type Pregunta = { q: string; a: string };

export const FAQS: Pregunta[] = [
  {
    q: '¿Qué es exactamente la Técnica Divine?',
    a: 'Un método de estética avanzada que enseña a observar, interpretar y decidir antes de trabajar manualmente. No es una secuencia cerrada: es el criterio para elegir qué hacer con cada cuerpo.',
  },
  {
    q: '¿Necesito formación previa?',
    a: 'Necesitas experiencia real con clientas. Titulación concreta no pido; manos con kilómetros, sí.',
  },
  {
    q: '¿Se puede hacer todo online?',
    a: 'La formación tiene dos etapas y hay que hacer las dos, en ese orden: primero la online, donde trabajas la anatomía y el protocolo, y después la presencial. Las manos no se corrigen por videollamada.',
  },
  {
    q: '¿Qué diferencia hay entre la formación y la comunidad?',
    a: `La formación es el recorrido donde te certificas: primero online y después presencial. La comunidad es lo que viene después, para no quedarte sola con los casos raros. Abre el ${FECHA_APERTURA} y cuesta 47 € al mes.`,
  },
  {
    q: '¿Puedo entrar en la comunidad sin haberme formado?',
    a: 'No. Será solo para terapeutas certificadas conmigo. Es lo que hace que el mapa signifique algo para las clientas.',
  },
  {
    q: 'Soy clienta, no profesional. ¿Puedo reservar una sesión?',
    a: 'Sí. En Localiza tu terapeuta tienes el mapa con las certificadas; reservas directamente con la que te encaje y ella te confirma.',
  },
];

export const FAQS_CURSO: Pregunta[] = [
  {
    q: '¿Y si nunca he trabajado estética avanzada?',
    a: 'Puedes venir si ya trabajas con las manos y tienes clientas. Si es tu primer contacto con la estética, espera: esta formación parte de que ya sabes trabajar.',
  },
  {
    q: '¿Dan certificado?',
    a: 'Sí. Al completar la formación recibes el certificado de terapeuta Divine y tu sitio en el mapa público.',
  },
  {
    q: '¿Hay facilidades de pago?',
    a: 'Sí, se puede fraccionar. Las condiciones van con cada convocatoria, y las próximas todavía se están cerrando: déjame tu contacto y te las mando con la fecha.',
  },
];

export const OBJECIONES: Pregunta[] = [
  {
    q: '¿Cuándo abre?',
    a: `El ${DIA_APERTURA} a las ${HORA_ESPANA}, hora de España: ${APERTURA_POR_PAISES}. Quien esté en la lista lo sabe antes que nadie y entra con el precio fundador.`,
  },
  {
    q: '¿Me compromete a algo apuntarme?',
    a: 'A nada. No pido tarjeta, no hay reserva que pagar y puedes salirte con un correo.',
  },
  {
    q: '¿Tengo que estar certificada ya?',
    a: 'Para entrar el día que abra, sí. Para estar en la lista, no: si tienes plaza en una formación, apúntate igual.',
  },
  {
    q: '¿Cuánto cuesta?',
    a: '47 € al mes. Quien entra ahora conserva ese precio fundador mientras siga dentro, aunque más adelante suba.',
  },
];

/**
 * Los tres pilares del método, en el orden en que se ejecutan.
 *
 * Se cuentan como pasos y no como beneficios a propósito. Los documentos de
 * Sorela están llenos de promesas sobre el organismo —defensas, hormonas,
 * toxinas, litros de líquido— que en una web pública española de estética no
 * se pueden publicar: son reclamos sanitarios. Lo que sí se puede contar, y
 * además distingue de verdad a la técnica, es el método: qué se mira, en qué
 * orden se trabaja y por qué ese orden.
 */
export type Pilar = { titulo: string; texto: string };

export const PILARES: Pilar[] = [
  {
    titulo: 'Observar antes de tocar',
    texto:
      'Lees el biotipo, el estado del tejido y la zona antes de empezar. De ahí sale la sesión. No hay un protocolo único para todas las personas.',
  },
  {
    titulo: 'Estimular antes de drenar',
    texto:
      'Pulsaciones lentas sobre ganglios y estaciones linfáticas. Mientras esa zona no está trabajada, no se arrastra nada. Ese orden sostiene todo lo demás.',
  },
  {
    titulo: 'Moldear al final',
    texto:
      'Sobre la base drenante entran las maniobras de presión variable: toques, despegues, pastoreo, rastrillo. Movilizan el tejido y redefinen el contorno.',
  },
];

export type PiezaComunidad = {
  titulo: string;
  texto: string;
  estado: string;
  color: string;
};

/**
 * Precio de la Comunidad Divine. En fase de fundadoras: quien entra ahora lo
 * conserva, y por eso el número aparece siempre acompañado de esa condición.
 * Si algún día sube, este es el único sitio donde hay que tocarlo.
 */
export const COMUNIDAD = {
  precio: 47,
  periodo: 'al mes',
  condicion: 'Precio de lanzamiento',
  /** Sale de lib/apertura.ts, que es donde vive la fecha. */
  apertura: APERTURA_LARGA,
} as const;

export const PIEZAS_COMUNIDAD: PiezaComunidad[] = [
  {
    titulo: 'Una clase en vivo al mes',
    texto:
      'Actualizaciones Divine: lo nuevo del método explicado y aplicado sobre un caso real. Queda grabada, para cuando cierres la cabina.',
    estado: 'Cada mes',
    color: 'var(--arcilla)',
  },
  {
    titulo: 'Acompañamiento personalizado',
    texto:
      'Tus casos, mirados uno a uno. No un foro donde preguntas y te contesta quien pasaba por allí.',
    estado: 'Continuo',
    color: 'var(--salvia)',
  },
  {
    titulo: 'Canal privado en Telegram',
    texto:
      'La duda del martes, resuelta el martes, entre terapeutas que trabajan con la misma técnica que tú.',
    estado: 'Siempre abierto',
    color: 'var(--azul)',
  },
  {
    titulo: 'Tu agenda y tus clientas',
    // Decía «agenda inteligente, con inteligencia artificial». Se quita: aquí
    // se cuenta lo que la terapeuta va a tener, no con qué está construido.
    // Además prometía algo que todavía no existe con un nombre que suena a
    // mucho más de lo que va a hacer el primer día.
    texto:
      'La misma plataforma donde llevas tus reservas y tus clientas, para no vivir pegada al móvil.',
    estado: 'Próximamente',
    color: 'var(--oro)',
  },
  {
    titulo: 'Tu centro, en el mapa',
    // Se quita «y posición dentro de las búsquedas»: prometía un
    // posicionamiento que no existe ni se puede garantizar.
    texto: 'Tu ficha en Localiza tu terapeuta: apareces donde las clientas buscan.',
    estado: 'Próximamente',
    color: 'var(--arcilla)',
  },
];

/*
 * La marquesina decía «87 terapeutas certificadas en España» y «tres días
 * presenciales». La cifra venía del prototipo y nadie la ha confirmado; los
 * tres días contradicen el recorrido real, que es online y después dos
 * jornadas. Se queda solo lo que se puede sostener.
 */
export const MARQUESINA = [
  'Un método nacido en cabina',
  'Drenaje linfático manual llevado más lejos',
  'Primero online, después presencial',
  'Grupos reducidos y práctica sobre cuerpo real',
  'Certificado y sitio en el mapa público',
];

/** Días y horas de ejemplo del calendario de reserva de una terapeuta. */
/*
 * Aquí vivían DIAS_RESERVA y HORAS_RESERVA: un calendario de marzo de 2027 con
 * cinco horas libres, inventado. Ninguna terapeuta tenía agenda detrás, así que
 * quien elegía un hueco elegía uno que no existía. Se retira hasta que las
 * agendas sean reales dentro de la plataforma.
 */
