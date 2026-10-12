/**
 * Utilidades del buscador de terapeutas («Localiza tu terapeuta»).
 *
 * Aquí había un array escrito a mano, `TERAPEUTAS`, primero con seis personas
 * inventadas del prototipo y después vacío. Ya no hay lista fija: las fichas
 * salen de Firestore (`terapeutas_publicas`, ver lib/fichas-publicas.ts), las
 * lee el servidor y llegan a los componentes por props. Este módulo solo
 * trabaja sobre la lista que recibe, y por eso es PURO: lo usan a la vez las
 * páginas (servidor) y el buscador con sus filtros (navegador).
 *
 * Las reglas de lo que se puede publicar —consentimiento, lista cerrada de
 * tratamientos, nada de términos sanitarios ni precios— viven en
 * lib/fichas-tipos.ts y las aplica la API al guardar. Aquí no se vuelve a
 * filtrar nada: lo que llega ya ha pasado por ahí.
 */

import { TRATAMIENTOS_FICHA, type FichaPublica } from './fichas-tipos';

/**
 * Lo que necesitan el mapa y las tarjetas del listado. Es la ficha pública
 * sin lo que solo se enseña en la página de cada una (el texto largo, los
 * contactos, las fechas) ni el uid: no hace falta mandarlo al navegador en el
 * listado, y una página con cincuenta fichas enteras pesaría el triple.
 * Una `FichaPublica` completa también vale donde se pide esto.
 */
export type TerapeutaMapa = Pick<
  FichaPublica,
  | 'slug'
  | 'nombre'
  | 'iniciales'
  | 'centro'
  | 'frase'
  | 'especialidad'
  | 'tratamientos'
  | 'pais'
  | 'paisNombre'
  | 'ciudad'
  | 'ciudadSlug'
  | 'direccion'
  | 'lat'
  | 'lng'
  | 'precision'
  | 'foto'
>;

/** La ficha recortada a lo que necesita el listado (ver `TerapeutaMapa`). */
export function paraMapa(f: FichaPublica): TerapeutaMapa {
  return {
    slug: f.slug,
    nombre: f.nombre,
    iniciales: f.iniciales,
    centro: f.centro,
    frase: f.frase,
    especialidad: f.especialidad,
    tratamientos: f.tratamientos,
    pais: f.pais,
    paisNombre: f.paisNombre,
    ciudad: f.ciudad,
    ciudadSlug: f.ciudadSlug,
    direccion: f.direccion,
    lat: f.lat,
    lng: f.lng,
    precision: f.precision,
    foto: f.foto,
  };
}

/** «María José García» → «María». Para los textos que la tutean («Escríbele a María»). */
export const nombreCorto = (t: Pick<FichaPublica, 'nombre'>) => t.nombre.trim().split(/\s+/)[0] || t.nombre;

/**
 * Dónde está, en corto. España no se escribe: la web es de aquí y la gran
 * mayoría lo serán. Fuera de España sí, porque «Valencia» puede ser la de
 * aquí o la de Venezuela.
 */
export const lugarDe = (t: Pick<FichaPublica, 'ciudad' | 'pais' | 'paisNombre'>) =>
  t.pais === 'ES' || !t.paisNombre ? t.ciudad : `${t.ciudad}, ${t.paisNombre}`;

/** Valor de «todas» en los filtros: vacío, para que no choque con ninguna ciudad. */
export const TODAS = '';
export const TODAS_CIUDADES = 'Todas las ciudades';
export const TODOS_TRATAMIENTOS = 'Todos los tratamientos';

/** La lista cerrada de tratamientos, la misma que se marca en la ficha. */
export const TRATAMIENTOS: readonly string[] = TRATAMIENTOS_FICHA;

export type CiudadConFichas = {
  ciudad: string;
  ciudadSlug: string;
  pais: string;
  paisNombre: string;
  /** Cuántas terapeutas hay en ella. */
  n: number;
};

/** El valor que más se repite (en empate, el primero que apareció). */
function masRepetido(valores: string[]): string {
  const cuenta = new Map<string, number>();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor = valores[0] ?? '';
  for (const [v, n] of cuenta) if (n > (cuenta.get(mejor) ?? 0)) mejor = v;
  return mejor;
}

/**
 * Las ciudades que tienen al menos una terapeuta, por orden alfabético.
 *
 * Salen de las fichas, no de una lista escrita a mano: un desplegable con
 * ciudades vacías es peor que no tenerlo. Se agrupan por `ciudadSlug`, que es
 * también la dirección de su página (/terapeutas/en/{ciudadSlug}). Si dos
 * terapeutas escriben la misma ciudad de forma distinta («A Coruña» y «A
 * coruña»), se enseña la forma que más se repite.
 */
export function ciudadesDe(lista: Pick<FichaPublica, 'ciudad' | 'ciudadSlug' | 'pais' | 'paisNombre'>[]): CiudadConFichas[] {
  type Grupo = { ciudades: string[]; paises: string[]; nombres: Map<string, string> };
  const grupos = new Map<string, Grupo>();
  for (const t of lista) {
    if (!t.ciudadSlug) continue;
    const g: Grupo = grupos.get(t.ciudadSlug) ?? { ciudades: [], paises: [], nombres: new Map() };
    g.ciudades.push(t.ciudad);
    g.paises.push(t.pais);
    g.nombres.set(t.pais, t.paisNombre);
    grupos.set(t.ciudadSlug, g);
  }
  return [...grupos.entries()]
    .map(([ciudadSlug, g]) => {
      const pais = masRepetido(g.paises);
      return { ciudad: masRepetido(g.ciudades), ciudadSlug, pais, paisNombre: g.nombres.get(pais) ?? '', n: g.ciudades.length };
    })
    .sort((a, b) => a.ciudad.localeCompare(b.ciudad, 'es'));
}

/** Las ciudades con más terapeutas primero (para títulos y descripciones). */
export const ciudadesPorTamano = (c: CiudadConFichas[]) =>
  [...c].sort((a, b) => b.n - a.n || a.ciudad.localeCompare(b.ciudad, 'es'));

/**
 * Los tratamientos que ofrece al menos una de la lista, en el orden de la
 * lista cerrada. Un filtro por «Maderoterapia» que no devuelve a nadie es un
 * callejón sin salida.
 */
export function tratamientosDe(lista: Pick<FichaPublica, 'tratamientos'>[]): string[] {
  return TRATAMIENTOS.filter((tr) => lista.some((t) => t.tratamientos.includes(tr)));
}

/**
 * Filtra por ciudad (su `ciudadSlug`) y por tratamiento. `TODAS` ('') en
 * cualquiera de los dos es «sin filtro».
 */
export function filtrar<T extends Pick<FichaPublica, 'ciudadSlug' | 'tratamientos'>>(
  lista: T[],
  ciudadSlug: string,
  tratamiento: string
): T[] {
  return lista.filter(
    (t) =>
      (ciudadSlug === TODAS || t.ciudadSlug === ciudadSlug) &&
      (tratamiento === TODAS || t.tratamientos.includes(tratamiento))
  );
}

/** «1 terapeuta», «3 terapeutas». */
export const cuantas = (n: number) => `${n} ${n === 1 ? 'terapeuta' : 'terapeutas'}`;

/** «Madrid, Sevilla y Bogotá». */
export function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}
