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

/**
 * Aquí había seis terapeutas —Madrid, Barcelona, Valencia, Sevilla, Bilbao y
 * Palma— con nombre y apellidos, dirección postal, año de certificación y
 * coordenadas del portal. Ninguna existe: venían del prototipo de diseño.
 *
 * Se vacía el array, y con él se van tres cosas a la vez: las fichas públicas
 * de personas inventadas, las seis rutas que Google estaba indexando y los
 * reclamos sanitarios que llevaban dentro («postquirúrgico con criterio»,
 * «trabajo con cirujanos de la ciudad», «vengo de la fisioterapia»).
 *
 * REGLAS PARA CUANDO HAYA TERAPEUTAS DE VERDAD:
 *  - Consentimiento por escrito de cada una antes de publicar su nombre, su
 *    ciudad o la dirección de su consulta. Son datos personales suyos.
 *  - Nada de términos sanitarios en `tratamientos` ni en `sobre`: ni
 *    postquirúrgico, ni linfedema, ni patologías, ni titulaciones sanitarias
 *    usadas como aval. Esto es estética.
 *  - El año solo se publica si corresponde a una formación realmente
 *    impartida.
 */
export const TERAPEUTAS: Terapeuta[] = [];


export const getTerapeuta = (slug: string) =>
  TERAPEUTAS.find((t) => t.slug === slug);

export const nombreCorto = (t: Terapeuta) => t.nombre.split(' ')[0];

export const TODAS_CIUDADES = 'Todas las ciudades';
export const TODOS_TRATAMIENTOS = 'Todos los tratamientos';

/**
 * Las ciudades salen de las terapeutas que haya, no de una lista escrita a
 * mano. Antes ofrecía ocho ciudades fijas y ahora mismo ninguna devolvería
 * nada: un desplegable con ocho opciones vacías es peor que no tenerlo.
 */
export const CIUDADES = [
  TODAS_CIUDADES,
  ...Array.from(new Set(TERAPEUTAS.map((t) => t.ciudad))).sort((a, b) => a.localeCompare(b, 'es')),
];

/**
 * Sin «Postquirúrgico» ni «Reductivo corporal»: el primero sitúa la técnica en
 * el circuito quirúrgico y el segundo promete reducir grasa. Los dos son
 * reclamos que una web de estética no puede publicar, y estaban a la vista en
 * el desplegable aunque no hubiera ninguna ficha detrás.
 */
export const TRATAMIENTOS = [
  TODOS_TRATAMIENTOS,
  'Drenaje linfático',
  'Moldeo y tonificación',
  'Divine facial',
  'Maderoterapia',
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
