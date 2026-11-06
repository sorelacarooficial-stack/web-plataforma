import { FORMACIONES, MEMBRESIA, ONLINE, PLAZAS, SEDES } from './clase';

/**
 * /reserva: la página que el equipo manda por WhatsApp a quien escribe
 * «QUIERO» en la masterclass. Vale 24 horas. La persona elige qué quiere y
 * cómo pagar, paga, y manda el comprobante por WhatsApp con un mensaje ya
 * escrito (así el equipo sabe al momento qué ha elegido). Con enlace de
 * Stripe, cada opción se paga ahí mismo con un toque.
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
  /** Solo la membresía: lo que costará después del primer mes. */
  despues?: number;
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
  // La membresía es solo para terapeutas homologadas.
  { id: 'membresia', grupo: 'Membresía', titulo: 'Membresía Divine®', detalle: 'Solo para terapeutas homologadas por Sorela', reserva: 0, precio: MEMBRESIA.primerMes, despues: MEMBRESIA.despues, stripe: '' },
];

/**
 * Enlaces de pago de Stripe, uno por formación (Caracas y Medellín usan el
 * mismo). Son públicos, no son claves.
 */
export const STRIPE: Record<string, string> = {
  // Asignados por el orden en que se crearon en Stripe (…00 el primero), sin poder abrirlos: CONFIRMAR.
  completa: 'https://buy.stripe.com/5kQ4gzdjTdIH7OV8rWaZi00',
  intensiva: 'https://buy.stripe.com/3cIeVdenXeML5GN8rWaZi01',
  especifica: 'https://buy.stripe.com/4gMfZh3Jj7kj4CJ23yaZi02',
  online: 'https://buy.stripe.com/6oU14ngw5dIHfhn5fKaZi03',
  membresia: 'https://buy.stripe.com/14A28r3Jj7kj3yF37CaZi04',
};

export const TRANSFERENCIA: { pais: string; datos: string }[] = [
  { pais: 'Colombia', datos: '' },
  { pais: 'Venezuela', datos: '' },
];

export const CRIPTO = { red: '', direccion: '' };

export const PLAZAS_SEDE = PLAZAS;

export function enlaceStripe(o: Opcion) {
  return STRIPE[formacionDe(o)] || o.stripe;
}

/**
 * Las cinco cosas que se pagan. Caracas y Medellín comparten enlace de pago:
 * la ciudad la elige cada alumna después, en /reserva/gracias.
 */
export const FORMACIONES_PAGO = [
  { id: 'completa', nombre: 'Formación Completa · 3 días', presencial: true },
  { id: 'intensiva', nombre: 'Formación Intensiva · 2 días', presencial: true },
  { id: 'especifica', nombre: 'Formación Específica · 1 día', presencial: true },
  { id: 'online', nombre: 'Divine® Online', presencial: false },
  { id: 'membresia', nombre: 'Membresía Divine®', presencial: false },
] as const;
export type FormacionPago = (typeof FORMACIONES_PAGO)[number]['id'];

export function formacionDe(o: Opcion): FormacionPago {
  if (o.id === 'online' || o.id === 'membresia') return o.id;
  return o.id.split('-')[1] as FormacionPago;
}

export const CIUDADES_PAGO = SEDES.map((s) => s.ciudad);

/**
 * Página de después de pagar: la «URL de confirmación» de cada enlace de pago
 * de Stripe (Después del pago → Redirigir a tu web). Stripe cambia
 * {CHECKOUT_SESSION_ID} por el número del pago, que se guarda para cruzarlo.
 */
export const URL_WEB = 'https://www.sorelacarodivine.com';
export function urlGracias(f: FormacionPago) {
  return `${URL_WEB}/reserva/gracias?f=${f}&s={CHECKOUT_SESSION_ID}`;
}

/** El grupo de WhatsApp de la Comunidad Divine: el mismo para todas. */
export const GRUPO_COMUNIDAD = '';
