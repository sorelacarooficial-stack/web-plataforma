/**
 * Asistente Divine — versión sin modelo.
 *
 * El prototipo llamaba a `window.claude.complete`, que solo existe dentro de
 * Claude Design. Aquí el asistente resuelve con las respuestas escritas a mano
 * que el prototipo ya usaba como plan B, encaminadas por palabra clave.
 *
 * Para enchufarle un modelo de verdad más adelante: crear una route handler en
 * `app/api/asistente/route.ts` que llame a la API de Anthropic con PROMPT_SISTEMA
 * como system prompt, y dejar `responder()` como respuesta de reserva si falla.
 */

export type Mensaje = { rol: 'yo' | 'asistente'; texto: string };

export const SALUDO =
  'Soy el asistente de Sorela. Te digo fechas, plazas, precios y requisitos de las formaciones, y te ayudo a reservar con una terapeuta certificada.\n¿Qué necesitas saber?';

export const SUGERENCIAS = [
  'Próximas fechas y plazas',
  'Precio y forma de pago',
  '¿Puedo entrar con mi nivel?',
  'Busco terapeuta cerca',
  'Lista de la comunidad',
];

/** Se conserva para cuando se conecte un modelo: es la voz de Sorela ya afinada. */
export const PROMPT_SISTEMA = [
  'Eres el asistente de la web de Sorela Caro, creadora de la Técnica Divine: formación presencial en estética avanzada para esteticistas, masajistas y terapeutas corporales que ya trabajan con clientas.',
  'TONO: hablas como Sorela. Español de España, tuteo, directo y cálido, frases cortas, cero jerga de marketing, cero emojis, nunca "¡Hola! Estoy aquí para ayudarte". Máximo 80 palabras. Si algo no lo sabes, lo dices y ofreces el contacto.',
  'FORMATO: responde en texto plano, sin Markdown. Nada de asteriscos, almohadillas, guiones de lista ni negritas: solo frases y saltos de línea.',
  'FORMACIONES (precio total; se reserva plaza y el resto se paga el primer día):',
  '- Formación Base. Madrid, 14–16 nov 2026. 24 h en 3 días, 10:00–19:00. 1.450 €, reserva 350 €. 8 plazas, quedan 3. Cancelando con 15 días se devuelve la reserva.',
  '- Nivel Avanzado. Valencia, 30 ene–1 feb 2027. 24 h en 3 días. 1.650 €, reserva 400 €. 8 plazas, quedan 7. Requiere haber hecho la Base. Cancelación 15 días.',
  '- Lectura corporal (intensivo). Sevilla, 7–8 mar 2027. 16 h en 2 días. 890 €, reserva 250 €. 12 plazas, quedan 10. Cancelación 10 días.',
  'REQUISITOS: experiencia real trabajando con las manos y con clientas. No se pide titulación concreta. No vale como primer contacto con la estética.',
  'INCLUYE: horas presenciales en grupo de ocho (doce en Sevilla), material y fichas, certificado, aula online con los apoyos del curso.',
  'PAGO: reserva + resto el primer día. Se puede fraccionar en tres meses avisando antes de reservar.',
  'COMUNIDAD DE TERAPEUTAS: todavía NO está abierta y no tiene precio. Solo hay lista de espera, gratis y sin compromiso; las primeras entran con condición de fundadora. Es solo para certificadas por Sorela. Nunca inventes precio ni fecha de apertura.',
  'CLIENTAS (no profesionales): en Localiza tu terapeuta hay un mapa con las terapeutas certificadas de Madrid, Barcelona, Valencia, Sevilla, Bilbao y Palma; se reserva directamente con cada una y ella confirma por correo. Toda sesión empieza con unos diez minutos de valoración.',
  'CONTACTO: formulario de la web o Instagram @sorelacaro_. Sorela contesta en menos de 48 h.',
  'Termina siempre orientando al siguiente paso concreto (reservar plaza, abrir el mapa, apuntarse a la lista, escribir).',
].join('\n');

const REGLAS: { patron: RegExp; respuesta: string }[] = [
  {
    patron: /precio|cuesta|cuánto|cuanto|pag|fraccion|financ/,
    respuesta:
      'Base (Madrid, 14–16 nov): 1.450 €, reservas con 350 €. Avanzado (Valencia, 30 ene–1 feb): 1.650 €, reserva 400 €. Lectura corporal (Sevilla, 7–8 mar): 890 €, reserva 250 €.\nEl resto se paga el primer día. Si necesitas fraccionarlo en tres meses, dímelo antes de reservar.',
  },
  {
    patron: /fecha|cuándo|cuando|próxim|proxim|plaza|queda|ciudad|madrid|valencia|sevilla/,
    respuesta:
      'Lo más cercano es la Formación Base en Madrid, del 14 al 16 de noviembre: quedan 3 plazas de 8.\nDespués, Nivel Avanzado en Valencia (30 ene–1 feb) y Lectura corporal en Sevilla (7–8 de marzo).',
  },
  {
    patron: /requisit|titul|puedo|empez|principi|nivel|experiencia/,
    respuesta:
      'Necesitas experiencia real trabajando con las manos y con clientas. No pido una titulación concreta.\nSi es tu primer contacto con la estética, esta formación no te va a servir todavía.',
  },
  {
    patron: /reserv|cita|cliente|clienta|terapeuta|cerca|mapa/,
    respuesta:
      'Si buscas sesión como clienta, abre Localiza tu terapeuta: en el mapa ves quién tiene consulta cerca de ti y reservas con ella; te confirma ella por correo.\nSi quieres reservar plaza en una formación, dime en cuál y te digo cómo va el pago.',
  },
  {
    patron: /comunidad|membres|suscrip|lista/,
    respuesta:
      'La comunidad todavía no está abierta y aún no tiene precio. Solo hay lista de espera: gratis, sin compromiso y con condición de fundadora para las primeras.\nEs solo para terapeutas certificadas conmigo.',
  },
  {
    patron: /certific|diploma|título|titulo/,
    respuesta:
      'Al completar la formación recibes el certificado de terapeuta Divine y entras en el mapa público de terapeutas certificadas.',
  },
  {
    patron: /cancel|devolu|aplaz/,
    respuesta:
      'Si no puedes venir, avisando con 15 días te devuelvo la reserva (10 días en el intensivo de Sevilla).',
  },
  {
    patron: /incluye|material|aula|horario|hora/,
    respuesta:
      'Incluye las horas presenciales en grupo de ocho, material y fichas de valoración, certificado y acceso al aula online con los apoyos del curso. El horario es de 10:00 a 19:00.',
  },
];

const POR_DEFECTO =
  'Puedo ayudarte con fechas, plazas, precios y requisitos de las formaciones, o con encontrar terapeuta cerca de ti.\nSi es algo más concreto, escríbeme por el formulario o por Instagram: @sorelacaro_.';

export function responder(pregunta: string): string {
  const t = (pregunta || '').toLowerCase();
  return REGLAS.find((r) => r.patron.test(t))?.respuesta ?? POR_DEFECTO;
}
