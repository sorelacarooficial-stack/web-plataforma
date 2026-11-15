/**
 * Asistente Divine — versión sin modelo.
 *
 * El prototipo llamaba a `window.claude.complete`, que solo existe dentro de
 * Claude Design. Aquí el asistente resuelve con respuestas escritas a mano,
 * encaminadas por palabra clave.
 *
 * IMPORTANTE sobre las fechas: el prototipo traía convocatorias inventadas en
 * Madrid, Valencia y Sevilla con precios concretos. Se han quitado. Las
 * fechas abiertas están en /formaciones, así que el
 * asistente NO da ninguna fecha ni ningún precio de formación: ofrece guardar
 * el sitio. Una fecha que luego se mueve cuesta más que no darla.
 *
 * Para enchufarle un modelo de verdad más adelante: crear una route handler en
 * `app/api/asistente/route.ts` que llame a la API de Anthropic con
 * PROMPT_SISTEMA como system prompt, y dejar `responder()` como respuesta de
 * reserva si falla.
 */

/* La fecha y la hora de apertura salen de lib/apertura.ts. Aquí estaban
   escritas a mano en tres frases distintas, y al mover el lanzamiento el
   asistente se quedaba dando la fecha vieja a quien preguntara. */

export type Mensaje = { rol: 'yo' | 'asistente'; texto: string };

export const SALUDO =
  'Soy el asistente de Sorela y contesto con sus palabras. Te cuento qué es la Técnica Divine y te ayudo a encontrar terapeuta o a pedir cita.\n¿Qué necesitas?';

export const SUGERENCIAS = [
  'Quiero agendar una cita',
  'Qué es la Técnica Divine',
  'Busco terapeuta cerca',
];

/** Se conserva para cuando se conecte un modelo: es la voz de Sorela ya afinada. */
export const PROMPT_SISTEMA = [
  'Eres el asistente de la web de Sorela Caro, creadora de la Técnica Divine: drenaje linfático manual avanzado. La formación va dirigida a esteticistas, masajistas y terapeutas corporales que ya trabajan con clientas.',
  'TONO: hablas EN PRIMERA PERSONA, como si fueras ella, pero SIN PRESUMIR. El mérito no se reclama: se cuenta de dónde sale el método y qué va a conseguir quien pregunta. Di «nació de casi treinta años de cabina», no «lo creé yo»; «dos jornadas conmigo» y «te corrijo sobre tus manos», que hablan de lo que ella hace por ti. Nunca hables de Sorela en tercera persona, como si fuera alguien ajeno: es su web y es ella quien contesta. Español de España, tuteo, directo y cálido, frases cortas, cero jerga de marketing, cero emojis, nunca "¡Hola! Estoy aquí para ayudarte". Máximo 80 palabras. Si algo no lo sabes, lo dices y ofreces el contacto.',
  'FORMATO: texto plano, sin Markdown. Nada de asteriscos, almohadillas, guiones de lista ni negritas: solo frases y saltos de línea.',
  'QUÉ ES: método manual nacido de la cabina, sobre la base del drenaje linfático clásico. Se trabaja con las manos y aceite, por zonas, y tiene versión facial. El orden manda: primero se trabajan ganglios y estaciones linfáticas, después se arrastra, después se moldea.',
  'PROHIBIDO PROMETER EFECTOS DE SALUD. Esto es estética, no sanidad. Nunca hables de toxinas, litros de líquido, defensas, inmunidad, hormonas, metabolismo, tránsito intestinal, sueño, ansiedad, dolor, linfedema, postoperatorio, diástasis, cicatrices, estrías, acné, pérdida de peso ni reducción de grasa o celulitis. Nunca digas "la única", "la número uno" ni cifras de casos de éxito. Si te preguntan por resultados: cambios perceptibles, sensación de ligereza y contorno más definido, y siempre que la respuesta varía según cada persona.',
  'FORMACIONES, MASTERCLASS Y COMUNIDAD: ahora mismo no se ofrecen en la web. No des fechas, precios ni detalles. Si preguntan, di que de momento no hay nada abierto y que pueden escribirme por Instagram @sorelacaro_ o desde Contacto.',
  'AGENDAR CITA: no recojas los datos escritos en el chat, porque no se guardan en ninguna parte. Ofrece abrir el formulario, sin explicar por qué ni hablar de consentimientos: eso es asunto de la web, no de la conversación. Tampoco des horas concretas: no tienes acceso al calendario.',
  'CLIENTAS (no profesionales): en Localiza tu terapeuta (/terapeutas) están las terapeutas certificadas en Técnica Divine, cada una con su ficha y su contacto. La cita se pide escribiendo directamente a la terapeuta, por WhatsApp o Instagram desde su ficha: tú no reservas por ella, no das horas suyas ni dices quién hay en una ciudad, porque no ves el mapa. Si en su zona todavía no hay ninguna, ofrece el formulario y di que avisas en cuanto haya una cerca.',
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
    /* Formaciones, masterclass y comunidad no se ofrecen en la web pública
       por ahora (2026-11-15): se contesta sin vender y sin pedir datos. */
    patron: /formaci|curso|aprend|fecha|próxim|proxim|plaza|online|presencial|comunidad|membres|masterclass|clase|precio|cuesta|cuánto|cuanto|pag|certific|diploma/,
    respuesta:
      'Ahora mismo no tengo nada abierto en la web.\nSi quieres saber más, escríbeme por Instagram (@sorelacaro_) o desde la página de Contacto, y te contesto yo.',
  },
  {
    patron: /qué es|que es|técnica|tecnica|método|metodo|drenaje|linf/,
    respuesta:
      'Es drenaje linfático manual llevado más lejos. Se trabaja con las manos y aceite, por zonas, y tiene su versión facial.\nEl orden manda: primero se trabajan los ganglios y las estaciones linfáticas, después se arrastra siguiendo el recorrido natural, y solo al final se moldea.',
  },
  {
    patron: /clienta|cliente|terapeuta|cerca|mapa|sesión|sesion/,
    /* Vale con el mapa lleno y con el mapa vacío: el asistente corre en el
       navegador y no sabe quién hay publicado, así que no dice ni que no hay
       nadie ni que hay alguien en tal ciudad. Manda al buscador y ofrece el
       aviso para quien no encuentre a nadie cerca. */
    respuesta:
      'En Localiza tu terapeuta están las terapeutas certificadas en Técnica Divine: buscas tu ciudad, abres su ficha y le escribes directamente por WhatsApp o Instagram.\nSi todavía no hay ninguna cerca de ti, déjame tu contacto y te aviso en cuanto haya una.',
    accion: {
      tipo: 'captar',
      titulo: 'Te aviso cuando haya una cerca',
      entradilla: 'Déjame tu contacto y tu ciudad, y te escribo en cuanto haya una terapeuta certificada en tu zona.',
      etiqueta: 'Dejar mi contacto',
      // Busca terapeuta cerca: quiere que la traten.
      origen: 'terapeutas',
    },
  },
  {
    patron: /resultado|funciona|nota|sesion|ver/,
    respuesta:
      'Lo habitual es terminar la sesión con sensación de ligereza y un contorno más definido. La respuesta varía según cada persona y cada momento: no te voy a prometer un número.\nSi quieres verlo por ti misma, lo mejor es una sesión con una terapeuta certificada.',
  },
];

const POR_DEFECTO =
  'Puedo contarte qué es la Técnica Divine, ayudarte a encontrar terapeuta o a pedir cita.\nSi es algo más concreto, déjame tu contacto en el formulario y te contesto yo, o escríbeme por Instagram: @sorelacaro_.';

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
