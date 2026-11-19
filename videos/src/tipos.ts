/** Lo que necesita un vídeo para montarse. Lo genera scripts/preparar.mjs. */

export type Palabra = { texto: string; desde: number; hasta: number; clave?: boolean };

/** Una fila de una tarjeta de cristal (lo que se ve de la plataforma). */
export type Fila = { texto: string; detalle?: string; estado?: 'hecho' | 'abierto' | 'candado' | 'nada' };

export type Tarjeta = {
  desde: number;
  hasta: number;
  /** Arriba, en pequeño: «Clases», «Agenda», «Comunidad»… */
  zona: string;
  titulo: string;
  filas?: Fila[];
  /** Botón dorado al pie («Marcar como vista»). */
  boton?: string;
  /** Lado de la pantalla: nunca encima de la cara. */
  lado?: 'izquierda' | 'derecha';
};

export type Guion = {
  id: string;
  numero: string;
  titulo: string;
  /** Vídeo ya cortado, con color y audio a −16 LUFS (ruta dentro de public/). */
  base: string;
  duracion: number;
  palabras: Palabra[];
  tarjetas: Tarjeta[];
  /** Momentos (s) con acercamiento de cámara 100 → 106 %. */
  acercamientos: number[];
  /** Texto del cierre: la tarea de la lección. */
  cierre: string;
  musica?: string;
};
