export type Terapeuta = {
  slug: string;
  nombre: string;
  ciudad: string;
  anio: string;
  iniciales: string;
  tratamientos: string[];
  direccion: string;
  /** Frase corta para la tarjeta del listado. */
  frase: string;
  /** Párrafo en primera persona para su ficha. */
  sobre: string;
  /** Coordenadas de la consulta, para el mapa. */
  lat: number;
  lng: number;
  /** Desplazamiento de la etiqueta de ciudad en el mapa, para que no se pisen. */
  dx: number;
  dy: number;
};

export const TERAPEUTAS: Terapeuta[] = [
  {
    slug: 'marta-ibanez',
    nombre: 'Marta Ibáñez',
    ciudad: 'Madrid',
    anio: '2024',
    iniciales: 'MI',
    tratamientos: ['Drenaje linfático', 'Postparto', 'Reductivo corporal'],
    direccion: 'Calle de Ponzano, 42 · Chamberí',
    frase: 'Trabajo sobre todo postparto: primero valoro, después decido.',
    sobre:
      'Llevo nueve años en cabina y desde que me formé con Sorela mi primera visita cambió por completo. Trabajo postparto, drenaje y reductivo, siempre con una valoración previa.',
    lat: 40.4404,
    lng: -3.7008,
    dx: 0,
    dy: -26,
  },
  {
    slug: 'nuria-sanchis',
    nombre: 'Nuria Sanchís',
    ciudad: 'Valencia',
    anio: '2024',
    iniciales: 'NS',
    tratamientos: ['Drenaje linfático', 'Postquirúrgico', 'Maderoterapia'],
    direccion: 'Avenida del Puerto, 118 · Camins al Grau',
    frase: 'Postquirúrgico con criterio: sé qué tocar y qué esperar.',
    sobre:
      'Especializada en acompañamiento postquirúrgico. Trabajo con cirujanos de la ciudad y documento cada sesión para que se vea la evolución.',
    lat: 39.4626,
    lng: -0.3428,
    dx: 34,
    dy: 6,
  },
  {
    slug: 'carla-redondo',
    nombre: 'Carla Redondo',
    ciudad: 'Sevilla',
    anio: '2025',
    iniciales: 'CR',
    tratamientos: ['Reductivo corporal', 'Drenaje linfático', 'Valoración Divine'],
    direccion: 'Calle Feria, 27 · Casco Antiguo',
    frase: 'Dejé de vender sesiones sueltas y empecé a proponer planes.',
    sobre:
      'Mi consulta es pequeña y trabajo con pocas clientas a la vez. Cada tratamiento arranca con una valoración completa.',
    lat: 37.3963,
    lng: -5.9944,
    dx: 0,
    dy: 30,
  },
  {
    slug: 'ainhoa-etxebarria',
    nombre: 'Ainhoa Etxebarria',
    ciudad: 'Bilbao',
    anio: '2025',
    iniciales: 'AE',
    tratamientos: ['Postparto', 'Drenaje linfático', 'Masaje profundo'],
    direccion: 'Alameda de Urquijo, 60 · Indautxu',
    frase: 'Cada cuerpo pide una cosa distinta el mismo día de la semana.',
    sobre:
      'Vengo de la fisioterapia y la Técnica Divine me dio la parte estética con el mismo rigor con el que trabajaba antes.',
    lat: 43.2612,
    lng: -2.943,
    dx: 0,
    dy: -26,
  },
  {
    slug: 'patricia-soler',
    nombre: 'Patricia Soler',
    ciudad: 'Palma',
    anio: '2026',
    iniciales: 'PS',
    tratamientos: ['Reductivo corporal', 'Maderoterapia', 'Valoración Divine'],
    direccion: 'Carrer de Sant Miquel, 15 · Centro',
    frase: 'La clienta entiende el plan y por eso vuelve.',
    sobre:
      'Trabajo sola en cabina propia. Lo que más ha cambiado es que ahora explico en voz alta lo que hago y por qué.',
    lat: 39.5719,
    lng: 2.6503,
    dx: 0,
    dy: 30,
  },
  {
    slug: 'lucia-ferrer',
    nombre: 'Lucía Ferrer',
    ciudad: 'Barcelona',
    anio: '2026',
    iniciales: 'LF',
    tratamientos: ['Drenaje linfático', 'Postparto', 'Masaje profundo'],
    direccion: "Carrer d'Enric Granados, 88 · Eixample",
    frase: 'Valoro diez minutos y la sesión se decide sola.',
    sobre:
      'Doce años de cabina y muchas formaciones cerradas a la espalda. Divine fue la primera que me enseñó a decidir en lugar de repetir.',
    lat: 41.3925,
    lng: 2.157,
    dx: 32,
    dy: -14,
  },
];

export const getTerapeuta = (slug: string) =>
  TERAPEUTAS.find((t) => t.slug === slug);

export const nombreCorto = (t: Terapeuta) => t.nombre.split(' ')[0];

export const TODAS_CIUDADES = 'Todas las ciudades';
export const TODOS_TRATAMIENTOS = 'Todos los tratamientos';

/** El desplegable incluye ciudades sin terapeuta todavía, a propósito:
 *  así el estado "sin resultados" es alcanzable y tiene su propio mensaje. */
export const CIUDADES = [
  TODAS_CIUDADES,
  'Madrid',
  'Barcelona',
  'Valencia',
  'Sevilla',
  'Bilbao',
  'Palma',
  'Zaragoza',
];

export const TRATAMIENTOS = [
  TODOS_TRATAMIENTOS,
  'Drenaje linfático',
  'Postparto',
  'Postquirúrgico',
  'Reductivo corporal',
  'Maderoterapia',
  'Masaje profundo',
  'Valoración Divine',
];

export function filtrar(ciudad: string, tratamiento: string) {
  return TERAPEUTAS.filter(
    (t) =>
      (ciudad === TODAS_CIUDADES || t.ciudad === ciudad) &&
      (tratamiento === TODOS_TRATAMIENTOS ||
        t.tratamientos.includes(tratamiento))
  );
}
