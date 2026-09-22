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

export type PiezaComunidad = {
  titulo: string;
  texto: string;
  estado: string;
  color: string;
};

export const PIEZAS_COMUNIDAD: PiezaComunidad[] = [
  {
    titulo: 'Una clase en vivo al mes',
    texto:
      'Un caso real resuelto delante de ti, con preguntas al final. Grabada, para cuando cierres la cabina.',
    estado: 'Ya decidido',
    color: 'var(--arcilla)',
  },
  {
    titulo: 'Canal privado para preguntar',
    texto:
      'El caso raro del martes, resuelto el martes. Ni el mes que viene ni en un foro abierto.',
    estado: 'Ya decidido',
    color: 'var(--salvia)',
  },
  {
    titulo: 'Fichas y protocolos descargables',
    texto:
      'Para usar en consulta, no para archivar: valoración, primera visita, progresiones por zona.',
    estado: 'Ya decidido',
    color: 'var(--azul)',
  },
  {
    titulo: 'Tu ficha en el mapa público',
    texto:
      'Apareces donde las clientas buscan, con tu ciudad y tu botón de reserva.',
    estado: 'Ya decidido',
    color: 'var(--oro)',
  },
  {
    titulo: 'Negocio y clientas',
    texto:
      'Cómo se consigue clienta, cómo se cuenta lo que haces y cómo usar la IA para no vivir pegada al móvil.',
    estado: 'Lo estoy escribiendo',
    color: 'var(--faint)',
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
