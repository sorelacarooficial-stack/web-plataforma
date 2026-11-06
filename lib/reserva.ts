import { FORMACIONES, ONLINE, PLAZAS, SEDES } from './clase';

/**
 * /reserva: la página que el equipo manda por WhatsApp a quien escribe
 * «QUIERO» en la masterclass. Vale 24 horas. La persona elige qué quiere y
 * cómo pagar, paga, y manda el comprobante por WhatsApp con un mensaje ya
 * escrito (así el equipo sabe al momento qué ha elegido).
 *
 * Rellenar antes de mandarla: los enlaces de Stripe, las cuentas de
 * transferencia y la dirección de cripto. Lo que esté vacío no sale.
 */

/** Hasta cuándo vale la oferta: sábado 7 nov 2026, 19:00 en España. */
export const RESERVA_HASTA = '2026-11-07T18:00:00Z';

export type Opcion = {
  id: string;
  grupo: 'Presencial' | 'Online' | 'Membresía';
  titulo: string;
  detalle: string;
  /** Lo que se paga ahora (USD). */
  reserva: number;
  /** Precio total (USD) y el de antes, tachado. */
  precio?: number;
  antes?: number;
  /** Enlace de pago de Stripe para la reserva (o el pago). Vacío = sin tarjeta. */
  stripe: string;
  nota?: string;
};

const [completa, intensiva, especifica] = FORMACIONES;

function presencial(sede: (typeof SEDES)[number]): Opcion[] {
  const s = sede.ciudad.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return [
    { id: `${s}-completa`, grupo: 'Presencial', titulo: `${sede.ciudad} · Completa`, detalle: `${sede.fechas} · ${completa.dias}`, reserva: completa.reserva, precio: completa.precio, antes: completa.antes, stripe: '', nota: 'Incluye cena de gala, certificado y academia online' },
    { id: `${s}-intensiva`, grupo: 'Presencial', titulo: `${sede.ciudad} · Intensiva`, detalle: `${sede.fechas} · ${intensiva.dias}`, reserva: intensiva.reserva, precio: intensiva.precio, antes: intensiva.antes, stripe: '' },
    { id: `${s}-especifica`, grupo: 'Presencial', titulo: `${sede.ciudad} · Específica`, detalle: `${sede.fechas} · ${especifica.dias}`, reserva: especifica.reserva, precio: especifica.precio, antes: especifica.antes, stripe: '' },
  ];
}

export const OPCIONES: Opcion[] = [
  ...SEDES.flatMap(presencial),
  { id: 'online', grupo: 'Online', titulo: 'Divine® Online', detalle: 'A tu ritmo · para profesionales con experiencia', reserva: ONLINE.reserva, precio: ONLINE.especial, antes: ONLINE.habitual, stripe: '' },
  // La membresía es solo para terapeutas homologadas. Sale solo si tiene enlace de pago.
  { id: 'membresia', grupo: 'Membresía', titulo: 'Membresía Divine®', detalle: 'Solo para terapeutas homologadas por Sorela', reserva: 0, stripe: '' },
];

/** Enlaces de Stripe por opción: se rellenan aquí (son públicos, no son claves). */
export const STRIPE: Record<string, string> = {
  // 'caracas-completa': 'https://buy.stripe.com/...',
};

export const TRANSFERENCIA: { pais: string; datos: string }[] = [
  { pais: 'Colombia', datos: '' },
  { pais: 'Venezuela', datos: '' },
];

export const CRIPTO = { red: '', direccion: '' };

export const PLAZAS_SEDE = PLAZAS;

export function enlaceStripe(o: Opcion) {
  return STRIPE[o.id] || o.stripe;
}
