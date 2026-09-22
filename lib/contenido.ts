/** Copy fijo del sitio: testimonios, FAQ y las piezas de la comunidad.
 *  Transcrito del prototipo aprobado; no inventar nada aquí sin pasar por Sorela. */

export const INSTAGRAM = 'https://instagram.com/sorelacaro_';
export const INSTAGRAM_USUARIO = '@sorelacaro_';

/**
 * Móvil de Sorela, con prefijo, para la salida de emergencia del formulario:
 * si la captación falla, se le ofrece a la persona escribir por WhatsApp con
 * el mensaje ya redactado, y así el contacto no se pierde.
 *
 * PENDIENTE: mientras esté vacío, esa salida manda a Instagram, que funciona
 * pero convierte bastante peor. Rellenar antes de la exposición.
 */
export const WHATSAPP_SORELA: string = '';

/** Cuántas hay ya en la lista de espera de la comunidad. */
export const EN_LISTA = 128;

export type Testimonio = {
  frase: string;
  nombre: string;
  ciudad: string;
  iniciales: string;
};

export const TESTIMONIOS: Testimonio[] = [
  {
    frase:
      '«Dejé de improvisar cuando la clienta no encajaba en el guion. Ahora sé qué mirar y por qué.»',
    nombre: 'Marta Ibáñez',
    ciudad: 'Madrid',
    iniciales: 'MI',
  },
  {
    frase:
      '«Subí el precio de la sesión un 30 % porque por fin puedo explicar lo que estoy haciendo.»',
    nombre: 'Nuria Sanchís',
    ciudad: 'Valencia',
    iniciales: 'NS',
  },
  {
    frase:
      '«La primera visita cambió entera: valoro diez minutos y la clienta entiende el plan completo.»',
    nombre: 'Carla Redondo',
    ciudad: 'Sevilla',
    iniciales: 'CR',
  },
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
    q: '¿Se puede hacer online?',
    a: 'No. El trabajo manual no se corrige por videollamada. El aula online es el apoyo de antes y de después, nunca el curso.',
  },
  {
    q: '¿Qué diferencia hay entre la formación y la comunidad?',
    a: 'La formación es el curso presencial donde te certificas. La comunidad es lo que viene después, y todavía la estoy montando: por ahora solo hay lista de espera.',
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
    a: 'Reservas con el primer pago y abonas el resto el primer día. Si necesitas fraccionarlo en tres meses, escríbeme antes de reservar y lo vemos.',
  },
];

export const OBJECIONES: Pregunta[] = [
  {
    q: '¿Cuándo abre?',
    a: 'No pongo fecha que no pueda cumplir. Cuando la primera tanda de contenido esté lista, escribo a la lista antes de anunciarlo en ningún sitio.',
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
    q: '¿Qué precio tendrá?',
    a: 'Aún no está cerrado. Lo que sí está decidido es que quien entre desde la lista mantiene condición de fundadora mientras siga dentro.',
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
    titulo: 'Abrir antes de drenar',
    texto:
      'Pulsaciones lentas sobre ganglios y estaciones linfáticas. Mientras el paso no esté abierto, no se arrastra nada. Ese orden sostiene todo lo demás.',
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
  condicion: 'Precio fundador para las primeras',
  /** 17 de octubre de 2026, 16:00 en España. Ver components/Contador.tsx. */
  apertura: 'sábado 17 de octubre, 16:00 (hora de España)',
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
    titulo: 'Agenda inteligente',
    texto:
      'La misma plataforma de citas que uso yo, con inteligencia artificial: gestiona tus reservas y tus clientas sin que vivas pegada al móvil.',
    estado: 'Incluida',
    color: 'var(--oro)',
  },
  {
    titulo: 'Tu centro, en el mapa',
    texto:
      'Tu ficha en Localiza tu terapeuta y posición dentro de las búsquedas: apareces donde las clientas buscan.',
    estado: 'Incluida',
    color: 'var(--arcilla)',
  },
];

export const MARQUESINA = [
  'Método propio de Sorela Caro',
  '87 terapeutas certificadas en España',
  'Grupos de ocho, cuerpo real desde la primera hora',
  'Tres días presenciales, cero teoría de relleno',
  'Certificado y sitio en el mapa público',
];

/** Días y horas de ejemplo del calendario de reserva de una terapeuta. */
export const DIAS_RESERVA = [
  { dow: 'Lun', num: 1 },
  { dow: 'Mar', num: 2 },
  { dow: 'Mié', num: 3 },
  { dow: 'Jue', num: 4 },
  { dow: 'Vie', num: 5 },
  { dow: 'Lun', num: 8 },
  { dow: 'Mar', num: 9 },
  { dow: 'Mié', num: 10 },
];

export const HORAS_RESERVA = ['09:30', '11:30', '13:00', '16:00', '17:30'];
