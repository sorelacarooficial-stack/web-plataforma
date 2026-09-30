/**
 * Cuándo abre la Comunidad Divine, en un solo sitio.
 *
 * Esto existe porque la fecha estaba escrita a mano en ocho: la cuenta atrás,
 * el distintivo de la página de la comunidad, dos preguntas frecuentes, dos
 * respuestas del asistente de la web, el texto del precio y el guion del
 * asistente de Google. Cambiarla era buscar «17 de octubre» por el
 * repositorio y confiar en no haberse dejado ninguna. Se dejó una.
 *
 * Ahora solo se toca `APERTURA`, y todo lo demás sale de ahí.
 *
 * LA HORA, QUE ES DONDE ESTO SE TUERCE. Se escribe con su desfase explícito
 * —el `+01:00` del final— y no como «las siete de la tarde». El 6 de noviembre
 * España ya está en horario de invierno (el cambio es el domingo 25 de
 * octubre), así que son UTC+1 y no UTC+2. Con el desfase puesto, esa hora
 * significa el mismo instante se mire desde donde se mire, que importa mucho
 * aquí: media lista está en Sudamérica.
 */

/** El instante exacto. Es lo único que hay que cambiar si se mueve la fecha. */
export const APERTURA = '2026-11-06T19:00:00+01:00';

/**
 * A qué hora le toca a cada una.
 *
 * Las horas NO se escriben: se calculan del instante de arriba con la base de
 * datos de zonas horarias que trae el propio sistema. Escribirlas a mano sería
 * volver al problema de antes en pequeño —cuatro números que hay que acordarse
 * de recalcular— y además hay que saberse de memoria que Venezuela va a UTC−4
 * desde 2016 y que ninguno de los tres países cambia la hora en invierno.
 *
 * El orden es de más tarde a más temprano, que es como se lee mejor: España
 * primero porque es la referencia de la que se habla, y el resto detrás.
 */
export const ZONAS = [
  { lugar: 'España', zona: 'Europe/Madrid' },
  { lugar: 'Argentina', zona: 'America/Argentina/Buenos_Aires' },
  { lugar: 'Venezuela', zona: 'America/Caracas' },
  { lugar: 'Colombia', zona: 'America/Bogota' },
] as const;

const instante = new Date(APERTURA);

/** «19:00» en esa zona. h23 para que la medianoche sea 00:00 y no 24:00. */
function horaEn(zona: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instante);
}

/** Las cuatro horas, listas para pintar: `{ lugar: 'España', hora: '19:00' }`. */
export const HORAS_APERTURA = ZONAS.map(({ lugar, zona }) => ({
  lugar,
  hora: horaEn(zona),
}));

/**
 * El día, escrito como lo escribiría una persona: «viernes 6 de noviembre».
 *
 * es-ES mete una coma después del día de la semana —«viernes, 6 de
 * noviembre»— y aquí sobra, porque esto va dentro de frases como «abre el
 * viernes 6 de noviembre».
 */
export const DIA_APERTURA = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
  .format(instante)
  .replace(',', '');

/** «6 de noviembre», sin el día de la semana. Para las frases más cortas. */
export const FECHA_APERTURA = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'long',
}).format(instante);

/** La hora de España sola: «19:00». Es la referencia que se dice en voz alta. */
export const HORA_ESPANA = horaEn('Europe/Madrid');

/** «viernes 6 de noviembre, 19:00 (hora de España)». La frase completa. */
export const APERTURA_LARGA = `${DIA_APERTURA}, ${HORA_ESPANA} (hora de España)`;

/**
 * «19:00 en España · 15:00 en Argentina · 14:00 en Venezuela · 13:00 en
 * Colombia». Para el asistente y los correos, donde no hay tabla que pintar.
 */
export const APERTURA_POR_PAISES = HORAS_APERTURA.map(
  ({ lugar, hora }) => `${hora} en ${lugar}`
).join(' · ');
