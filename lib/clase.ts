/**
 * La presentación en directo de la masterclass «Antes de tocar».
 *
 * Vive en `/clase` y en `clase.sorelacarodivine.com` (proxy.ts). Es lo que
 * Sorela comparte por Google Meet el viernes 6 de noviembre: aquí SÍ salen la
 * Comunidad Divine y los precios, porque se cuentan en directo al final de la
 * clase. Por eso la página no se indexa y, si en Vercel está `CLASE_CLAVE`,
 * solo se abre con `?k=<clave>`.
 *
 * Lo que cambia de un año a otro o de una clase a otra está aquí, no en las
 * diapositivas.
 */

/** Viernes 6 nov 2026, 19:00 en España (CET, UTC+1). */
export const EMPIEZA = '2026-11-06T18:00:00Z';

/**
 * Sedes de la formación presencial (reunión del 4 nov: se cambia Bogotá por
 * Medellín y Caracas, por dónde están las registradas: 68 de Venezuela y 15
 * de Colombia). `inicio` es el primer día a las 8:00 hora local.
 */
export const SEDES = [
  { ciudad: 'Caracas', fechas: '4, 5 y 6 de diciembre', inicio: '2026-12-04T12:00:00Z' },
  { ciudad: 'Medellín', fechas: '10, 11 y 12 de diciembre', inicio: '2026-12-10T13:00:00Z' },
];

/** Formación presencial (Medellín y Caracas). Precios en USD. */
export const FORMACIONES = [
  // `antes` es el precio que sale tachado encima (confirmar con Sorela).
  { nombre: 'Completa', dias: '3 días', antes: 3000, precio: 2250, reserva: 250 },
  { nombre: 'Intensiva', dias: '2 días', antes: 2000, precio: 1500, reserva: 250 },
  { nombre: 'Específica', dias: '1 día', antes: 1000, precio: 750, reserva: 150 },
];

/** Membresía Divine® (solo homologadas): primer mes y precio después, en USD. Con las `primeras` se hace la sesión 1 a 1. */
export const MEMBRESIA = { primerMes: 49, despues: 98, primeras: 10 };

/** Divine® Online. Precios en USD. */
export const ONLINE = { habitual: 900, especial: 750, reserva: 250 };

/** Plazas de la formación presencial, en cada ciudad. */
export const PLAZAS = 10;

/**
 * Adónde lleva el QR. El QR apunta siempre a `/clase/entrar`, que redirige
 * aquí: así el QR impreso en la diapositiva no cambia aunque cambie el enlace.
 * Si en Vercel está `CLASE_ENLACE_PAGO`, manda ese; si no, este; y si este
 * está vacío, al WhatsApp de Sorela con un mensaje ya escrito.
 */
export const ENLACE_PAGO = '';

export const QR_DESTINO = 'https://www.sorelacarodivine.com/clase/entrar';

/**
 * Vídeos que se abren desde la presentación. Vacío = la tarjeta se queda sin
 * botón de reproducir (no se enseña un hueco en directo).
 */
export const VIDEOS = {
  /** Diapositiva 9: clip de la entrevista en televisión (30 s). */
  tele: '',
  /** Diapositiva 19: testimonio de Beatriz (1 min). */
  beatriz: '',
  /** Antes de «Mi historia»: vídeo de 1 min que presenta a Sorela. */
  sorela: '/clase/video/sorela-presenta.mp4',
  sorelaPortada: '/clase/video/sorela-presenta.jpg',
  /** Antes de la membresía: el vídeo cinematográfico (1 min). Vacío = la diapositiva no sale. */
  membresia: '/clase/video/membresia.mp4',
  membresiaPortada: '/clase/video/membresia.jpg',
};

/**
 * Sala de espera (portada): la música que suena mientras entra la gente. Se
 * enciende con el botón «Música» (el navegador no deja que suene sola), va
 * en bucle y se apaga sola, en fundido, cuando la cuenta llega a cero.
 * Vacío = no sale el botón.
 */
export const ESPERA = {
  musica: ['/clase/musica/espera.mp3'] as string[],
  /** Frases que van rotando bajo la cuenta atrás. */
  frases: [
    'Escribe en el chat desde dónde nos ves',
    'Ten a mano papel y boli: vas a querer apuntar',
    'Dura una hora. Al final, preguntas en directo',
    'Quédate hasta el final: hay una noticia solo para quien esté en directo',
    'Activa el sonido: empezamos con un vídeo',
  ],
};

/** Minutos de la cuenta de preguntas y reservas en la diapositiva «QUIERO». */
export const MINUTOS_PREGUNTAS = 10;

export type Ciudad = { nombre: string; lng: number; lat: number; zona: 'es' | 'latam' };

/** Las ciudades del mapa de bienvenida. Se encienden al pulsarlas. */
export const CIUDADES: Ciudad[] = [
  { nombre: 'Vigo', lng: -8.72, lat: 42.24, zona: 'es' },
  { nombre: 'Barcelona', lng: 2.17, lat: 41.39, zona: 'es' },
  { nombre: 'Madrid', lng: -3.7, lat: 40.42, zona: 'es' },
  { nombre: 'Valencia', lng: -0.38, lat: 39.47, zona: 'es' },
  { nombre: 'Sevilla', lng: -5.98, lat: 37.39, zona: 'es' },
  { nombre: 'Málaga', lng: -4.42, lat: 36.72, zona: 'es' },
  { nombre: 'Bilbao', lng: -2.93, lat: 43.26, zona: 'es' },
  { nombre: 'Ciudad de México', lng: -99.13, lat: 19.43, zona: 'latam' },
  { nombre: 'Guadalajara', lng: -103.35, lat: 20.67, zona: 'latam' },
  { nombre: 'Caracas', lng: -66.9, lat: 10.48, zona: 'latam' },
  { nombre: 'Bogotá', lng: -74.07, lat: 4.71, zona: 'latam' },
  { nombre: 'Medellín', lng: -75.57, lat: 6.25, zona: 'latam' },
  { nombre: 'Cali', lng: -76.53, lat: 3.45, zona: 'latam' },
  { nombre: 'Quito', lng: -78.47, lat: -0.18, zona: 'latam' },
  { nombre: 'Lima', lng: -77.04, lat: -12.05, zona: 'latam' },
  { nombre: 'Santiago', lng: -70.65, lat: -33.45, zona: 'latam' },
  { nombre: 'Buenos Aires', lng: -58.38, lat: -34.6, zona: 'latam' },
  { nombre: 'Córdoba (AR)', lng: -64.18, lat: -31.42, zona: 'latam' },
  { nombre: 'Montevideo', lng: -56.16, lat: -34.9, zona: 'latam' },
];
