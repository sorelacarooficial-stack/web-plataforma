/**
 * Asistente Divine — versión sin modelo.
 *
 * El prototipo llamaba a `window.claude.complete`, que solo existe dentro de
 * Claude Design. Aquí el asistente resuelve con respuestas escritas a mano,
 * encaminadas por palabra clave.
 *
 * IMPORTANTE sobre las fechas: el prototipo traía convocatorias inventadas en
 * Madrid, Valencia y Sevilla con precios concretos. Se han quitado. Las
 * próximas fechas son en Sudamérica y todavía no están confirmadas, así que el
 * asistente NO da ninguna fecha ni ningún precio de formación: ofrece guardar
 * el sitio. Una fecha que luego se mueve cuesta más que no darla.
 *
 * Para enchufarle un modelo de verdad más adelante: crear una route handler en
 * `app/api/asistente/route.ts` que llame a la API de Anthropic con
 * PROMPT_SISTEMA como system prompt, y dejar `responder()` como respuesta de
 * reserva si falla.
 */

export type Mensaje = { rol: 'yo' | 'asistente'; texto: string };

export const SALUDO =
  'Soy el asistente de Sorela. Te ayudo con las formaciones, con la agenda y con la Comunidad Divine.\n¿Qué necesitas?';

export const SUGERENCIAS = [
  'Quiero agendar una cita',
  'Próximas fechas',
  'Cómo es la formación',
  'La Comunidad Divine',
  'Busco terapeuta cerca',
];

/** Se conserva para cuando se conecte un modelo: es la voz de Sorela ya afinada. */
export const PROMPT_SISTEMA = [
  'Eres el asistente de la web de Sorela Caro, creadora de la Técnica Divine: drenaje linfático manual avanzado. La formación va dirigida a esteticistas, masajistas y terapeutas corporales que ya trabajan con clientas.',
  'TONO: hablas como Sorela. Español de España, tuteo, directo y cálido, frases cortas, cero jerga de marketing, cero emojis, nunca "¡Hola! Estoy aquí para ayudarte". Máximo 80 palabras. Si algo no lo sabes, lo dices y ofreces el contacto.',
  'FORMATO: texto plano, sin Markdown. Nada de asteriscos, almohadillas, guiones de lista ni negritas: solo frases y saltos de línea.',
  'QUÉ ES: método manual creado por Sorela sobre la base del drenaje linfático clásico. Se trabaja con las manos y aceite, por zonas, y tiene versión facial. El orden manda: primero se abren ganglios y estaciones linfáticas, después se arrastra, después se moldea.',
  'PROHIBIDO PROMETER EFECTOS DE SALUD. Esto es estética, no sanidad. Nunca hables de toxinas, litros de líquido, defensas, inmunidad, hormonas, metabolismo, tránsito intestinal, sueño, ansiedad, dolor, linfedema, postoperatorio, diástasis, cicatrices, estrías, acné, pérdida de peso ni reducción de grasa o celulitis. Nunca digas "la única", "la número uno" ni cifras de casos de éxito. Si te preguntan por resultados: cambios perceptibles, sensación de ligereza y contorno más definido, y siempre que la respuesta varía según cada persona.',
  'FORMACIÓN, EN DOS ETAPAS Y EN ESTE ORDEN: (1) Online, obligatoria y previa: anatomía linfática, lógica del método y protocolo por fases, a su ritmo y desde su país. (2) Presencial, dos jornadas con Sorela: día 1 lipodrenaje, día 2 moldeo y tonificación, con práctica sobre modelos reales. No se puede empezar por la presencial.',
  'FECHAS: las próximas convocatorias son en Sudamérica y están a punto de confirmarse. NO inventes ciudades, fechas ni precios. Lo que ofreces es guardar el sitio: pides nombre, correo y teléfono y dices que Sorela avisa en cuanto se cierre la fecha.',
  'AGENDAR CITA: NO pidas los datos dentro del chat. El chat no tiene casilla de consentimiento ni enlace a la política de privacidad, y lo que se escriba aquí no se guarda en ninguna parte. Manda siempre al formulario («Quiero la información»). Tampoco des horas concretas: no tienes acceso al calendario.',
  'COMUNIDAD DIVINE: abre el sábado 17 de octubre a las 16:00, hora de España. Cuesta 47 € al mes y quien entra ahora conserva ese precio fundador mientras siga dentro. Incluye una clase en vivo al mes de actualizaciones, acompañamiento personalizado, canal privado en Telegram, la agenda inteligente con IA y ficha en el mapa de terapeutas. Es para certificadas por Sorela; en la lista de espera puede entrar cualquiera.',
  'CLIENTAS (no profesionales): el mapa de terapeutas certificadas todavía está vacío, porque las primeras aún se están formando. No mandes a nadie a reservar con una terapeuta: recoge el contacto por el formulario y di que Sorela avisa cuando haya alguna cerca.',
  'CONTACTO: formulario de la web o Instagram @sorelacaro_. Sorela contesta en menos de 48 h.',
  'Termina siempre orientando al siguiente paso concreto.',
].join('\n');

const REGLAS: { patron: RegExp; respuesta: string }[] = [
  {
    patron: /agend|cita|resérv|reserv|hueco|disponib|calendario|hora/,
    respuesta:
      'Te guardo el sitio. Para eso necesito tus datos en el formulario, no aquí en el chat: ahí es donde puedes aceptar cómo se tratan.\nPulsa «Quiero la información» arriba, déjame nombre, correo y teléfono, y te escribo yo con las opciones de agenda.',
  },
  {
    patron: /fecha|cuándo|cuando|próxim|proxim|plaza|queda|ciudad|sudamérica|sudamerica|suramérica|suramerica/,
    respuesta:
      'Las próximas convocatorias son en Sudamérica y están a punto de confirmarse, así que todavía no te puedo dar una fecha cerrada. Lo que sí puedo es guardarte el espacio.\nDéjame nombre, correo y teléfono y te aviso yo en cuanto se cierre.',
  },
  {
    patron: /online|distancia|a distancia|virtual|desde casa|orden|requisit|empez|antes/,
    respuesta:
      'El orden no cambia: primero la formación online y después la presencial.\nEn la online trabajas la anatomía linfática, la lógica del método y el protocolo por fases. Así los dos días con Sorela se dedican enteros a tus manos, que es para lo que sirven.',
  },
  {
    patron: /presencial|dos días|dos dias|práctica|practica|modelo/,
    respuesta:
      'La presencial son dos jornadas con Sorela. El primer día, lipodrenaje: protocolo completo y aplicación. El segundo, moldeo y tonificación.\nSe practica sobre modelos reales y ella corrige sobre tus manos. Para entrar hace falta tener hecha la formación online.',
  },
  {
    patron: /comunidad|membres|suscrip|lista|47|telegram|fundador/,
    respuesta:
      'La Comunidad Divine abre el sábado 17 de octubre a las 16:00, hora de España. Son 47 € al mes y quien entra ahora conserva ese precio fundador mientras siga dentro.\nDentro hay una clase en vivo al mes, acompañamiento personalizado, canal privado en Telegram, la agenda inteligente con IA y tu ficha en el mapa.',
  },
  {
    patron: /precio|cuesta|cuánto|cuanto|pag|fraccion|financ/,
    respuesta:
      'La Comunidad Divine son 47 € al mes, con precio fundador para las primeras.\nEl precio de las formaciones va con la convocatoria, y las próximas todavía se están cerrando. Déjame tu contacto y te lo mando con la fecha en cuanto esté.',
  },
  {
    patron: /qué es|que es|técnica|tecnica|método|metodo|drenaje|linf/,
    respuesta:
      'Es drenaje linfático manual llevado más lejos. Se trabaja con las manos y aceite, por zonas, y tiene su versión facial.\nEl orden manda: primero se abren los ganglios y las estaciones linfáticas, después se arrastra siguiendo el recorrido natural, y solo al final se moldea.',
  },
  {
    patron: /clienta|cliente|terapeuta|cerca|mapa|sesión|sesion/,
    respuesta:
      'Todavía no hay terapeutas certificadas en el mapa: las primeras entrarán en cuanto terminen su formación.\nSi buscas sesión, déjame tu contacto en el formulario y te aviso yo en cuanto haya una cerca de ti.',
  },
  {
    patron: /certific|diploma|título|titulo/,
    respuesta:
      'Al completar las dos etapas recibes el certificado de terapeuta Divine y entras en el mapa público de terapeutas certificadas.',
  },
  {
    patron: /resultado|funciona|nota|sesion|ver/,
    respuesta:
      'Lo habitual es terminar la sesión con sensación de ligereza y un contorno más definido. La respuesta varía según cada persona y cada momento: no te voy a prometer un número.\nSi quieres verlo por ti misma, lo mejor es una sesión con una terapeuta certificada.',
  },
];

const POR_DEFECTO =
  'Puedo ayudarte con la formación, con la agenda o con la Comunidad Divine.\nSi es algo más concreto, déjame tu contacto en el formulario y te contesto yo, o escríbeme por Instagram: @sorelacaro_.';

/*
 * Nota para quien conecte un modelo aquí: las respuestas de arriba mandan al
 * formulario en vez de recoger el dato en la conversación. No es pereza. El
 * chat no tiene casilla de consentimiento ni enlace a la política de
 * privacidad, y responder() se ejecuta en el navegador: lo que alguien escriba
 * aquí no llega a ninguna parte. Recoger un correo así sería a la vez ilegal e
 * inútil.
 */

export function responder(pregunta: string): string {
  const t = (pregunta || '').toLowerCase();
  return REGLAS.find((r) => r.patron.test(t))?.respuesta ?? POR_DEFECTO;
}
