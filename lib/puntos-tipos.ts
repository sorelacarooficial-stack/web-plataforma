/**
 * Los puntos y los niveles: la tabla, los nombres y la cuenta. Sin nada de
 * servidor dentro, porque lo leen las dos partes: el servidor para calcularlos
 * (lib/logros.ts) y la pantalla para enseñarlos y explicar cómo se ganan.
 *
 * Los puntos NO se apuntan uno a uno en ningún libro: se DERIVAN de lo que hay.
 * Clases terminadas, publicaciones vivas, «me gusta» que siguen ahí… Así, si
 * algo se borra, sus puntos desaparecen solos y no hay nada que deshacer a
 * mano ni manera de inflarlos publicando y borrando.
 */

export const PUNTOS = {
  clase: 50,
  curso: 300,
  publicacion: 20,
  respuesta: 10,
  meGusta: 2,
  dia: 5,
  racha7: 50,
  racha30: 200,
  logro: 25,
  perfil: 100,
  foto: 5,
  /** Las fotos del perfil cuentan hasta aquí: subir cien no es mérito. */
  fotosMax: 10,
} as const;

export type Nivel = { n: number; nombre: string; desde: number };

export const NIVELES: Nivel[] = [
  { n: 1, nombre: 'Primeros pasos', desde: 0 },
  { n: 2, nombre: 'Manos despiertas', desde: 150 },
  { n: 3, nombre: 'Ritmo propio', desde: 400 },
  { n: 4, nombre: 'Terapeuta Divine', desde: 900 },
  { n: 5, nombre: 'Referente', desde: 1800 },
  { n: 6, nombre: 'Embajadora Divine', desde: 3500 },
];

export type EstadoNivel = Nivel & {
  siguiente: Nivel | null;
  /** De 0 a 1: cuánto lleva recorrido DENTRO de su nivel (para la barra). */
  progreso: number;
  /** Puntos que le faltan para el siguiente; 0 en el último. */
  falta: number;
};

/** En qué nivel está quien tiene `total` puntos, y cuánto le queda para subir. */
export function nivelDe(total: number): EstadoNivel {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  let i = 0;
  for (let k = 0; k < NIVELES.length; k++) if (t >= NIVELES[k].desde) i = k;
  const actual = NIVELES[i];
  const siguiente = NIVELES[i + 1] ?? null;
  const progreso = siguiente ? Math.min(1, Math.max(0, (t - actual.desde) / (siguiente.desde - actual.desde))) : 1;
  return { ...actual, siguiente, progreso, falta: siguiente ? siguiente.desde - t : 0 };
}

export type FuentePuntos =
  | 'clases'
  | 'curso'
  | 'publicaciones'
  | 'respuestas'
  | 'meGusta'
  | 'dias'
  | 'racha'
  | 'logros'
  | 'perfil'
  | 'fotos';

/** En el orden en que se enseñan en el desglose. */
export const FUENTES: FuentePuntos[] = ['clases', 'curso', 'publicaciones', 'respuestas', 'meGusta', 'dias', 'racha', 'logros', 'perfil', 'fotos'];

export const ETIQUETA_FUENTE: Record<FuentePuntos, string> = {
  clases: 'Clases terminadas',
  curso: 'Curso completo',
  publicaciones: 'Publicaciones',
  respuestas: 'Respuestas a compañeras',
  meGusta: '«Me gusta» recibidos',
  dias: 'Días que has entrado',
  racha: 'Rachas',
  logros: 'Trofeos',
  perfil: 'Perfil completo',
  fotos: 'Fotos del perfil',
};

/**
 * Cómo se suma, en frases cortas y con los valores de PUNTOS (nunca copiados a
 * mano): lo leen «Cómo sumar», la leyenda del ranking, la bienvenida del muro
 * y su correo. El icono de cada una está en IconosDivine (ICONO_FUENTE).
 */
export const FORMAS_DE_SUMAR: { fuente: FuentePuntos; texto: string; puntos: number }[] = [
  { fuente: 'clases', texto: 'Terminar una clase', puntos: PUNTOS.clase },
  { fuente: 'curso', texto: 'Completar la formación', puntos: PUNTOS.curso },
  { fuente: 'publicaciones', texto: 'Publicar en la comunidad', puntos: PUNTOS.publicacion },
  { fuente: 'respuestas', texto: 'Responder a una compañera', puntos: PUNTOS.respuesta },
  { fuente: 'meGusta', texto: 'Cada «me gusta» que recibes', puntos: PUNTOS.meGusta },
  { fuente: 'dias', texto: 'Cada día que entras', puntos: PUNTOS.dia },
  { fuente: 'racha', texto: `7 días seguidos (y +${PUNTOS.racha30} a los 30)`, puntos: PUNTOS.racha7 },
  { fuente: 'logros', texto: 'Cada trofeo que ganas', puntos: PUNTOS.logro },
  { fuente: 'perfil', texto: 'Completar tu perfil', puntos: PUNTOS.perfil },
  { fuente: 'fotos', texto: `Cada foto de tu trabajo (hasta ${PUNTOS.fotosMax})`, puntos: PUNTOS.foto },
];

/** Lo que suma al ranking del mes («Más activas este mes»): lo que se hace en la comunidad y el aula. */
export const SUMAN_AL_MES: FuentePuntos[] = ['publicaciones', 'respuestas', 'meGusta', 'clases'];

/** Lo que hace falta saber de una persona para contar sus puntos. */
export type EntradaPuntos = {
  clases: number;
  cursoCompleto: boolean;
  publicaciones: number;
  respuestas: number;
  meGusta: number;
  dias: number;
  mejorRacha: number;
  logros: number;
  perfilCompleto: boolean;
  fotos: number;
};

export type ResumenPuntos = {
  total: number;
  desglose: Record<FuentePuntos, number>;
  nivel: EstadoNivel;
  /** Los puntos que vio la última vez (solo al celebrar; si no, null): desde ahí cuenta hacia arriba. */
  antes: number | null;
  subioNivel: boolean;
};

/* Un contador que llega negativo o roto (un dato antiguo, una resta de más)
   cuenta como cero: los puntos nunca restan por un descuadre. */
const cuantos = (v: number) => Math.max(0, Math.floor(Number(v) || 0));

export function calcularPuntos(e: EntradaPuntos): { total: number; desglose: Record<FuentePuntos, number> } {
  const racha = cuantos(e.mejorRacha);
  const desglose: Record<FuentePuntos, number> = {
    clases: cuantos(e.clases) * PUNTOS.clase,
    curso: e.cursoCompleto ? PUNTOS.curso : 0,
    publicaciones: cuantos(e.publicaciones) * PUNTOS.publicacion,
    respuestas: cuantos(e.respuestas) * PUNTOS.respuesta,
    meGusta: cuantos(e.meGusta) * PUNTOS.meGusta,
    dias: cuantos(e.dias) * PUNTOS.dia,
    racha: (racha >= 7 ? PUNTOS.racha7 : 0) + (racha >= 30 ? PUNTOS.racha30 : 0),
    logros: cuantos(e.logros) * PUNTOS.logro,
    perfil: e.perfilCompleto ? PUNTOS.perfil : 0,
    fotos: Math.min(cuantos(e.fotos), PUNTOS.fotosMax) * PUNTOS.foto,
  };
  const total = FUENTES.reduce((s, f) => s + desglose[f], 0);
  return { total, desglose };
}

/** «1250», «12.500»: con el punto de los miles a la española. */
export const formatoPuntos = (n: number): string => Math.round(Number(n) || 0).toLocaleString('es-ES');
