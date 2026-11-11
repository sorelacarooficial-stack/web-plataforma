/**
 * El camino de venta del CRM, después de la masterclass (6 y 8 nov 2026).
 *
 * lib/atencion.ts responde a «¿quién espera algo de Sorela?». Esto responde a
 * otra pregunta: «¿en qué punto de la compra está cada persona y qué le
 * escribo?». Son cinco pasos, siempre en este orden:
 *
 *   Interesada → Hablando → Reservó → Pagó → Alumna
 *
 * más «Sin interés» (descartada o de baja), que se aparta.
 *
 * Todo sale de datos que ya existen: el estado que mueve Sorela, la reserva
 * de /reserva (`reserva.pagoConfirmado`) y los accesos de su cuenta. No hay
 * casilla de «vino a la masterclass»: Meet no lo dice y Sorela decidió no
 * apuntarlo a mano (2026-11-11).
 *
 * Sin `server-only`: lo lee la pantalla de Contactos y la ficha.
 *
 * Reglas de los mensajes (docs/memoria-proyecto.md):
 *  - A las apuntadas nunca se les habla de la Comunidad Divine.
 *  - La Membresía, solo a terapeutas homologadas (formación completa).
 *  - El primer mensaje no lleva precio: el precio se da cuando ya hay
 *    conversación (como en la masterclass, en directo).
 *  - Nada de prometer salud ni plazas que no son verdad.
 */

import { BECA, ONLINE } from './clase';
import { PREFIJOS } from './prefijos';

export const ETAPAS = ['interesada', 'hablando', 'reservo', 'pago', 'alumna', 'fuera'] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Los cinco pasos del camino, sin «Sin interés». */
export const CAMINO: readonly Etapa[] = ['interesada', 'hablando', 'reservo', 'pago', 'alumna'];

export const TITULO_ETAPA: Record<Etapa, string> = {
  interesada: 'Interesadas',
  hablando: 'Hablando',
  reservo: 'Reservaron',
  pago: 'Pagaron',
  alumna: 'Alumnas',
  fuera: 'Sin interés',
};

export const PASTILLA_ETAPA: Record<Etapa, string> = {
  interesada: 'Interesada',
  hablando: 'Hablando',
  reservo: 'Reservó · sin pagar',
  pago: 'Pagó',
  alumna: 'Alumna',
  fuera: 'Sin interés',
};

/** Una frase por paso: qué significa estar ahí. */
export const EXPLICA_ETAPA: Record<Etapa, string> = {
  interesada: 'Se apuntó a la masterclass o pidió información. Todavía no le has escrito.',
  hablando: 'Ya le has escrito. Falta que reserve.',
  reservo: 'Empezó la reserva en la web, pero el pago no está confirmado.',
  pago: 'Pagó su reserva. Falta darle acceso a la plataforma.',
  alumna: 'Tiene acceso a la plataforma.',
  fuera: 'La descartaste o se dio de baja de los correos.',
};

/** Lo que hay que mirar de una ficha para saber su etapa. Vale el JSON de /api/contactos. */
export type DatosEmbudo = {
  nombre?: string;
  estado?: string;
  whatsapp?: string;
  reserva?: { titulo?: string; pagoConfirmado?: boolean; pagoVerificado?: boolean } | null;
  /** Lo que dice su cuenta de la plataforma (si tiene). */
  cuenta?: { alumna?: boolean; homologada?: boolean } | null;
  /** Su correo está en la lista de bajas. */
  deBaja?: boolean;
  /** Notas de seguimiento de Sorela (la más nueva, la que cuenta). */
  seguimiento?: { cuando?: string }[];
  /** Cuándo cambió el estado por última vez (ISO): pulsar «Ya le escribí» también cuenta. */
  estadoCambiado?: string | null;
  /** Cuándo entró. */
  creado?: string | null;
  /** lib/atencion.ts: si te necesita (te escribió, pidió algo…). */
  situacion?: { grupo?: string } | null;
};

/**
 * En qué paso está. El orden importa: gana lo que está más cerca de la
 * compra, porque es lo que de verdad ha pasado. Una alumna que además está
 * «Descartada» por error sigue siendo alumna.
 */
export function etapaDe(c: DatosEmbudo): Etapa {
  if (c.cuenta?.alumna) return 'alumna';
  if (c.reserva?.pagoConfirmado) return 'pago';
  // «Cerrado» a mano sin reserva en la web: pagó por transferencia o en persona.
  if (c.estado === 'Cerrado') return 'pago';
  if (c.estado === 'Descartado' || c.deBaja) return 'fuera';
  if (c.reserva) return 'reservo';
  if (c.estado === 'Contactado' || c.estado === 'En conversación') return 'hablando';
  return 'interesada';
}

const DIA = 86_400_000;

/** La última vez que Sorela hizo algo con ella: su última nota o el último cambio de estado. */
export function ultimoContacto(c: Pick<DatosEmbudo, 'seguimiento' | 'estadoCambiado'>): Date | null {
  let mejor: number | null = null;
  for (const n of [...(c.seguimiento ?? []), { cuando: c.estadoCambiado ?? '' }]) {
    const t = Date.parse(n?.cuando ?? '');
    if (!Number.isNaN(t) && (mejor === null || t > mejor)) mejor = t;
  }
  return mejor === null ? null : new Date(mejor);
}

/** Días sin tocar a alguien con quien ya se habla. A partir de aquí, toca volver a escribir. */
export const DIAS_SEGUIMIENTO = 3;

/** Por qué toca escribirle hoy, del más urgente al menos. */
export const MOTIVOS_HOY = ['necesita', 'reservo', 'pago', 'frio'] as const;
export type MotivoHoy = (typeof MOTIVOS_HOY)[number];
export type Hoy = { motivo: MotivoHoy; texto: string };

/**
 * Por qué hay que escribirle HOY, o null si hoy no toca. Es la pestaña
 * «Escribir hoy». Las interesadas sin más no entran: son cientos, y a ellas
 * se les escribe en bloque (correo) o una a una desde «Interesadas».
 *
 *  1. Te necesita (lib/atencion.ts): te escribió o pidió algo. Se apaga al
 *     pulsar «Ya le escribí» o al apuntar una nota.
 *  2. Reservó y no pagó: la venta más cerca de cerrarse.
 *  3. Pagó y aún no tiene acceso: hay que dárselo.
 *  4. Hablando y sin nota tuya en 3 días: se enfría.
 *  En 2, 3 y 4, una nota tuya (o «Ya le escribí») la quita 3 días.
 */
export function porQueHoy(c: DatosEmbudo, ahora: Date = new Date()): Hoy | null {
  const e = etapaDe(c);
  if (e === 'fuera' || e === 'alumna') return null;
  if (c.situacion?.grupo === 'te-necesita') return { motivo: 'necesita', texto: 'Te escribió o pidió algo' };
  if (e === 'interesada') return null;
  const u = ultimoContacto(c);
  const dias = u ? Math.floor((ahora.getTime() - u.getTime()) / DIA) : null;
  if (dias !== null && dias < DIAS_SEGUIMIENTO) return null;
  if (e === 'reservo') return { motivo: 'reservo', texto: 'Reservó y no ha pagado' };
  if (e === 'pago') return { motivo: 'pago', texto: 'Pagó: dale acceso' };
  return { motivo: 'frio', texto: dias === null ? 'Sin notas tuyas: ¿cómo va?' : `Sin noticias hace ${dias} días` };
}

/**
 * El número como lo quiere wa.me: solo cifras y con prefijo. Nueve cifras
 * españolas sin prefijo llevan el 34 delante (casi todo el mundo aquí lo
 * escribe así). Vacío si no hay número.
 */
export function numeroWhatsapp(bruto: unknown): string {
  const limpio = String(bruto ?? '').replace(/\D/g, '').replace(/^00/, '');
  if (!limpio) return '';
  if (limpio.length === 9 && /^[6789]/.test(limpio)) return `34${limpio}`;
  return limpio;
}

/** El enlace de WhatsApp con el mensaje de su paso ya escrito. Vacío sin número. */
export function enlaceWhatsapp(c: DatosEmbudo): string {
  const n = numeroWhatsapp(c.whatsapp);
  if (!n) return '';
  const t = mensajeEtapa(c);
  return t ? `https://wa.me/${n}?text=${encodeURIComponent(t)}` : `https://wa.me/${n}`;
}

/** El siguiente paso con cada persona, en una frase. */
export const SIGUIENTE_PASO: Record<Etapa, string> = {
  interesada: 'Escríbele por WhatsApp y pregúntale si quiere saber más de la beca.',
  hablando: 'Resuelve sus dudas y mándale el enlace para reservar.',
  reservo: 'Pregúntale si tuvo algún problema con el pago. Ofrécele transferencia.',
  pago: 'Dale acceso a la plataforma en Cuentas y bienvenida.',
  alumna: 'Acompáñala en su formación.',
  fuera: 'Nada. No le escribas.',
};

/* ==========================================================================
   País por el prefijo del WhatsApp
   ========================================================================== */

/* Los prefijos de más cifras primero: «+591» (Bolivia) antes que «+5». El +1
   lo comparten varios países: se dice «EE. UU. / Caribe». */
const POR_PREFIJO = [...PREFIJOS].sort((a, b) => b.prefijo.length - a.prefijo.length);

/**
 * El país de su WhatsApp, o null si no se sabe. Un número de 9 cifras que
 * empieza por 6, 7, 8 o 9 sin prefijo es español: es lo que escribe casi todo
 * el mundo aquí (igual que FichaPersona al montar el enlace de wa.me).
 */
export function paisDe(whatsapp: unknown): string | null {
  const bruto = String(whatsapp ?? '').trim();
  const digitos = bruto.replace(/\D/g, '').replace(/^00/, '');
  if (!digitos) return null;
  if (!bruto.startsWith('+') && !bruto.startsWith('00')) {
    if (digitos.length === 9 && /^[6789]/.test(digitos)) return 'España';
    // Sin «+»: solo se fía si es largo (lleva el prefijo delante).
    if (digitos.length < 11) return null;
  }
  const p = POR_PREFIJO.find((x) => digitos.startsWith(x.prefijo.slice(1)));
  if (!p) return null;
  return p.prefijo === '+1' ? 'EE. UU. / Caribe' : p.pais;
}

/* ==========================================================================
   Mensajes de WhatsApp propuestos
   ========================================================================== */

const pila = (nombre?: string) => (nombre || '').trim().split(/\s+/)[0] ?? '';
const usd = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} USD`;

/**
 * El mensaje que se propone según el paso. No se manda solo: abre WhatsApp
 * con el texto puesto y Sorela lo cambia si quiere.
 */
export function mensajeEtapa(c: DatosEmbudo): string {
  const hola = `Hola${pila(c.nombre) ? ` ${pila(c.nombre)}` : ''}, soy Sorela Caro.`;
  switch (etapaDe(c)) {
    case 'interesada':
      // Primer mensaje: sin precio y sin la Comunidad.
      return `${hola} Gracias por apuntarte a mi masterclass. Hay una beca especial, solo ${BECA.plazas} plazas, para formarte conmigo en ${BECA.ciudad} los días ${BECA.fechas}. También puedes hacer la formación online. ¿Quieres que te cuente cómo funciona?`;
    case 'hablando':
      return `${hola} ¿Has podido pensar lo de la formación? Te recuerdo: la beca de ${BECA.ciudad} (${BECA.fechas}) queda en ${usd(BECA.precio)} y reservas tu plaza con ${usd(BECA.reserva)}. Si prefieres online, Divine® Online son ${usd(ONLINE.especial)}. ¿Te paso el enlace para reservar?`;
    case 'reservo':
      return `${hola} He visto que empezaste a reservar${c.reserva?.titulo ? ` «${c.reserva.titulo}»` : ''}, pero el pago no se completó. ¿Tuviste algún problema? Si te va mejor, también puedes pagar por transferencia y te paso los datos.`;
    case 'pago':
      return `${hola} ¡Ya tienes tu plaza! Gracias por tu confianza. En un momento te doy acceso a la plataforma para que empieces. Cualquier duda, me escribes por aquí.`;
    case 'alumna':
      return c.cuenta?.homologada
        ? `${hola} Como ya eres terapeuta homologada, quería contarte la Membresía Divine®: el acompañamiento mensual para hacer crecer tu negocio. ¿Te cuento?`
        : `${hola} ¿Qué tal vas con la formación? Si tienes cualquier duda con las clases, aquí estoy.`;
    default:
      return '';
  }
}
