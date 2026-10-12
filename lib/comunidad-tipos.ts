/**
 * La comunidad: tipos y textos que comparten el servidor y la pantalla.
 */

export const CATEGORIAS_COMUNIDAD = ['Caso', 'Duda', 'Resultado', 'Recurso', 'Anuncio'] as const;
export type CategoriaComunidad = (typeof CATEGORIAS_COMUNIDAD)[number];

/** Cómo se dice cada una en los filtros y qué se espera de ella. */
export const SOBRE_CATEGORIA: Record<CategoriaComunidad, { plural: string; ayuda: string }> = {
  Caso: { plural: 'Casos', ayuda: 'Una clienta concreta: qué tenía, qué hiciste, qué pasó.' },
  Duda: { plural: 'Dudas', ayuda: 'Algo que no te sale o no tienes claro.' },
  Resultado: { plural: 'Resultados', ayuda: 'Un antes y después, o algo que ha funcionado.' },
  Recurso: { plural: 'Recursos', ayuda: 'Un material, un producto o una lectura que te sirve.' },
  Anuncio: { plural: 'Anuncios', ayuda: 'Solo Sorela: avisos para toda la comunidad.' },
};

export type Autora = { uid: string; nombre: string; foto: string | null; esSorela: boolean };

export type Respuesta = {
  id: string;
  autora: Autora;
  texto: string;
  creado: string | null;
  meGusta: number;
  loHeDado: boolean;
  esMia: boolean;
};

export type Publicacion = {
  id: string;
  autora: Autora;
  categoria: CategoriaComunidad;
  titulo: string;
  texto: string;
  imagenes: string[];
  creado: string | null;
  ultimaActividad: string | null;
  respuestas: number;
  meGusta: number;
  loHeDado: boolean;
  fijada: boolean;
  resuelta: boolean;
  respondioSorela: boolean;
  esMia: boolean;
};

export type ProximaClase = { titulo: string; cuando: string; enlace: string } | null;
