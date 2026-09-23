/** Copy fijo del sitio: testimonios, FAQ y las piezas de la comunidad.
 *  Transcrito del prototipo aprobado; no inventar nada aquí sin pasar por Sorela. */

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

export type Testimonio = {
  frase: string;
  nombre: string;
  ciudad: string;
  iniciales: string;
};

/**
 * Aquí había tres testimonios firmados por Marta Ibáñez, Nuria Sanchís y
 * Carla Redondo: las tres primeras terapeutas del mapa, que eran inventadas.
 * Uno de ellos además decía «subí el precio de la sesión un 30 %», que es una
 * promesa de rentabilidad con cifra, de las que no se pueden publicar.
 *
 * Cuando haya testimonios reales: con consentimiento escrito de la persona,
 * hablando de criterio y de trabajo, nunca de precios, porcentajes ni
 * facturación.
 */
export const TESTIMONIOS: Testimonio[] = [];


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
    a: 'La formación es el recorrido donde te certificas: primero online y después presencial. La comunidad es lo que viene después, para no quedarte sola con los casos raros. Abre el 17 de octubre y cuesta 47 € al mes.',
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
    a: 'El sábado 17 de octubre a las 16:00, hora de España. Quien esté en la lista lo sabe antes que nadie y entra con el precio fundador.',
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
  condicion: 'Precio de lanzamiento',
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
      'La misma plataforma de citas que usa Sorela, con inteligencia artificial: gestionará tus reservas y tus clientas sin que vivas pegada al móvil.',
    // «Incluida» daba a entender que ya funciona, y todavía es maqueta.
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
  'Método propio de Sorela Caro',
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
