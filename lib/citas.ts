/**
 * Las reuniones por videollamada con Sorela que piden las alumnas.
 *
 * Horario acordado (reunión del 11 nov 2026): de lunes a viernes, de 6:00 a
 * 15:00 hora de Colombia. Colombia no cambia la hora en todo el año (UTC−5),
 * así que en UTC es siempre de 11:00 a 20:00.
 */

/** Lo que dura cada reunión, en minutos. */
export const CITA_MIN = 60;
/** Con cuánta antelación mínima se puede pedir, en horas. */
const ANTELACION_H = 3;
/** Hasta cuántos días vista se ofrecen huecos. */
export const CITA_DIAS = 21;

const UTC_COLOMBIA = -5;
const ABRE = 6;
const CIERRA = 15;

/** Todos los huecos que se pueden ofrecer desde `ahora`, en ISO, ordenados. */
export function huecosDeCita(ahora = new Date()): string[] {
  const salida: string[] = [];
  const primero = ahora.getTime() + ANTELACION_H * 3600_000;
  const dia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  for (let d = 0; d <= CITA_DIAS; d++) {
    for (let min = ABRE * 60; min + CITA_MIN <= CIERRA * 60; min += CITA_MIN) {
      const t = dia.getTime() + d * 86_400_000 + (min - UTC_COLOMBIA * 60) * 60_000;
      // El día de la semana, mirado en hora de Colombia.
      const enColombia = new Date(t + UTC_COLOMBIA * 3600_000).getUTCDay();
      if (enColombia === 0 || enColombia === 6) continue;
      if (t >= primero) salida.push(new Date(t).toISOString());
    }
  }
  return salida;
}

/** El id del hueco en Firestore: «20261112T1130» (UTC). Uno por hueco: no caben dos reuniones. */
export const idDeHueco = (iso: string) => iso.slice(0, 16).replace(/[-:]/g, '');

/** «a las 08:30 (hora de Colombia)», para que no haya líos entre países. */
export function horaColombia(iso: string): string {
  const d = new Date(new Date(iso).getTime() + UTC_COLOMBIA * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
