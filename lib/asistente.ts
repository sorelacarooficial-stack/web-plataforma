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
  'AGENDAR CITA: no recojas los datos escritos en el chat, porque no se guardan en ninguna parte. Ofrece abrir el formulario, sin explicar por qué ni hablar de consentimientos: eso es asunto de la web, no de la conversación. Tampoco des horas concretas: no tienes acceso al calendario.',
  'COMUNIDAD DIVINE: abre el sábado 17 de octubre a las 16:00, hora de España. Cuesta 47 € al mes y quien entra ahora conserva ese precio fundador mientras siga dentro. Incluye una clase en vivo al mes de actualizaciones, acompañamiento personalizado, canal privado en Telegram, la agenda para tus reservas y ficha en el mapa de terapeutas. Es para certificadas por Sorela; en la lista de espera puede entrar cualquiera.',
  'CLIENTAS (no profesionales): el mapa de terapeutas certificadas todavía está vacío, porque las primeras aún se están formando. No mandes a nadie a reservar con una terapeuta: recoge el contacto por el formulario y di que Sorela avisa cuando haya alguna cerca.',
  'CONTACTO: formulario de la web o Instagram @sorelacaro_. Sorela contesta en menos de 48 h.',
  'Termina siempre orientando al siguiente paso concreto.',
].join('\n');

/**
 * Qué puede ofrecer el asistente además de contestar. Cuando una respuesta
 * lleva acción, debajo aparece un botón que la hace: abrir el formulario, ir a
 * las formaciones. Antes se decía «pulsa el botón de arriba», que es mandar a
 * buscar a quien ya te estaba hablando.
 */
/**
 * Lo que el asistente puede hacer además de contestar: abrir el formulario.
 *
 * `origen` importa más de lo que parece. De él sale a quién se parece esa
 * persona —posible clienta, posible alumna o terapeuta— y, con eso, el correo
 * que va a recibir. Sin ponerlo, todas caerían en el mismo saco y a quien
 * pregunta por una sesión le llegaría el correo de las formaciones.
 * Ver lib/origenes.ts.
 */
export type Accion = {
  tipo: 'captar';
  titulo: string;
  entradilla: string;
  etiqueta: string;
  origen: string;
};

const REGLAS: { patron: RegExp; respuesta: string; accion?: Accion }[] = [
  {
    patron: /agend|cita|resérv|reserv|hueco|disponib|calendario|hora/,
    respuesta:
      'Te guardo el sitio. Dime cómo te escribo y te paso las horas que tengo libres.',
    accion: {
      tipo: 'captar',
      titulo: 'Te guardo el sitio',
      entradilla: 'Déjame nombre, correo y teléfono y te escribo con las opciones de agenda.',
      etiqueta: 'Dejar mi contacto',
      // Pregunta por agenda y horas: quiere que la traten.
      origen: 'cita-asistente',
    },
  },
  {
    patron: /fecha|cuándo|cuando|próxim|proxim|plaza|queda|ciudad|sudamérica|sudamerica|suramérica|suramerica/,
    respuesta:
      'Las próximas son en Sudamérica y están a punto de confirmarse, así que todavía no te doy una fecha que pueda moverse.\nLo que sí puedo es guardarte el espacio y avisarte antes que a nadie.',
    accion: {
      tipo: 'captar',
      titulo: 'Te aviso el primero',
      entradilla: 'En cuanto se cierre la ciudad y la fecha, te escribo yo con todo: precio, plazas y cómo reservar.',
      etiqueta: 'Guardarme el sitio',
      // Pregunta por fechas y plazas de formación: quiere aprender.
      origen: 'formacion-asistente',
    },
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
      'La membresía abre el sábado 17 de octubre a las 16:00, hora de España. Son 47 € al mes, y quien entra en el lanzamiento conserva ese precio.\nDentro: una clase en vivo al mes, tus casos mirados uno a uno, canal privado en Telegram, la agenda para tus reservas y tu ficha en el mapa.',
    accion: {
      tipo: 'captar',
      titulo: 'Entra en la lista',
      entradilla: 'Te aviso antes de que abra el 17 de octubre, y entras con el precio de lanzamiento. No pido tarjeta.',
      etiqueta: 'Apuntarme a la lista',
      origen: 'comunidad-asistente',
    },
  },
  {
    patron: /precio|cuesta|cuánto|cuanto|pag|fraccion|financ/,
    respuesta:
      'La membresía son 47 € al mes, con precio de lanzamiento para quien entre ahora.\nEl precio de las formaciones va con cada convocatoria, y las próximas todavía se están cerrando.',
    accion: {
      tipo: 'captar',
      titulo: 'Te mando los precios',
      entradilla: 'En cuanto se cierre la próxima convocatoria te escribo con el precio, las fechas y cómo reservar.',
      etiqueta: 'Que me avises',
      // El precio que se pide aquí es el de las formaciones.
      origen: 'formacion-precio',
    },
  },
  {
    patron: /qué es|que es|técnica|tecnica|método|metodo|drenaje|linf/,
    respuesta:
      'Es drenaje linfático manual llevado más lejos. Se trabaja con las manos y aceite, por zonas, y tiene su versión facial.\nEl orden manda: primero se abren los ganglios y las estaciones linfáticas, después se arrastra siguiendo el recorrido natural, y solo al final se moldea.',
  },
  {
    patron: /clienta|cliente|terapeuta|cerca|mapa|sesión|sesion/,
    respuesta:
      'Todavía no hay terapeutas en el mapa: las primeras entrarán en cuanto terminen su formación.\nDime dónde estás y te aviso en cuanto haya una cerca de ti.',
    accion: {
      tipo: 'captar',
      titulo: 'Te aviso cuando haya una cerca',
      entradilla: 'Déjame tu contacto y te escribo en cuanto se certifique una terapeuta en tu zona.',
      etiqueta: 'Dejar mi contacto',
      // Busca terapeuta cerca: quiere que la traten.
      origen: 'terapeutas',
    },
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
 * Nota para quien conecte un modelo aquí: las respuestas abren el formulario
 * en vez de recoger el dato escrito en la conversación. Dos motivos: lo que se
 * teclea en el chat no llega a ninguna parte, porque responder() corre en el
 * navegador; y el formulario es donde está la casilla de consentimiento.
 *
 * Lo que NO hay que hacer es contarle eso a quien pregunta. Una respuesta que
 * explica por qué no puede guardarte el correo es una respuesta que habla de
 * sí misma en vez de resolver. Se le abre el formulario y ya está.
 */

export function responder(pregunta: string): { texto: string; accion?: Accion } {
  const t = (pregunta || '').toLowerCase();
  const regla = REGLAS.find((r) => r.patron.test(t));
  return regla ? { texto: regla.respuesta, accion: regla.accion } : { texto: POR_DEFECTO };
}
