/**
 * El recorrido de bienvenida: la visita guiada por la plataforma que se abre
 * sola la primera vez que alguien entra (components/plataforma/Recorrido.tsx).
 * Aquí está lo que comparten la pantalla, la ruta que lo guarda
 * (app/api/recorrido) y la cuenta de puntos y trofeos (lib/logros.ts): los
 * pasos que existen, la versión y cómo se lee lo guardado. Sin nada de
 * servidor dentro.
 *
 * Se guarda en su ficha, `usuarios/{uid}.recorrido`:
 *
 *   estado     'en-curso' | 'hecho' | 'saltado'
 *   paso       el último paso que vio: si cierra a medias, sigue por ahí
 *   pasos      los pasos que ha visto alguna vez
 *   version    la del recorrido que vio (VERSION_RECORRIDO)
 *   empezado   cuándo lo empezó la primera vez
 *   terminado  cuándo lo terminó la PRIMERA vez. No se borra nunca: es lo que
 *              da el trofeo y los puntos, y repetirlo ni los quita ni los da
 *              otra vez.
 *   saltado    cuándo dijo «Saltar» (si lo hizo sin haberlo terminado antes)
 *   repetido   la última vez que lo abrió a mano desde «Ver el recorrido»
 *   veces      cuántas veces lo ha terminado
 *
 * Sorela no lo tiene: no es su plataforma la que se estrena.
 */

/** Sube si el recorrido cambia de verdad (pasos nuevos). Se guarda con cada paso. */
export const VERSION_RECORRIDO = 1;

/** Todos los pasos que puede tener, en orden. Cada persona ve los que le tocan. */
export const PASOS_RECORRIDO = ['inicio', 'aula', 'comunidad', 'agenda', 'perfil', 'puntos', 'final'] as const;
export type PasoRecorrido = (typeof PASOS_RECORRIDO)[number];

export const esPasoRecorrido = (v: unknown): v is PasoRecorrido =>
  typeof v === 'string' && (PASOS_RECORRIDO as readonly string[]).includes(v);

export type EstadoRecorrido = 'en-curso' | 'hecho' | 'saltado';

/** Lo que la pantalla necesita saber de su recorrido. */
export type Recorrido = {
  /** null: no lo ha empezado nunca. */
  estado: EstadoRecorrido | null;
  /** El último paso que vio, para seguir por ahí. */
  paso: PasoRecorrido | null;
  pasos: PasoRecorrido[];
  /** Si lo ha terminado alguna vez: el trofeo y los puntos ya son suyos. */
  hecho: boolean;
};

/** Lee lo guardado en la ficha sin fiarse de su forma: lo que no encaja, no cuenta. */
export function leerRecorrido(crudo: unknown): Recorrido {
  const r = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const estado: EstadoRecorrido | null = r.estado === 'hecho' || r.estado === 'saltado' || r.estado === 'en-curso' ? r.estado : null;
  const pasos = Array.isArray(r.pasos) ? [...new Set(r.pasos.filter(esPasoRecorrido))] : [];
  return {
    estado,
    paso: esPasoRecorrido(r.paso) ? r.paso : null,
    pasos,
    // `terminado` también: quien lo terminó y luego lo repitió sigue teniéndolo hecho.
    hecho: estado === 'hecho' || Boolean(r.terminado),
  };
}

/** Si se abre solo al entrar: ni lo ha terminado ni ha dicho «Saltar». */
export const recorridoPendiente = (r: Recorrido | null | undefined): boolean =>
  Boolean(r) && !r!.hecho && r!.estado !== 'saltado';

/** Si lo ha terminado alguna vez, leído directamente de su ficha (`usuarios/{uid}`). */
export const recorridoHecho = (u: Record<string, unknown>): boolean => leerRecorrido(u.recorrido).hecho;
