/**
 * Abrir el asistente desde cualquier punto de la web.
 *
 * Se hace con un evento del navegador y no con un contexto de React a
 * propósito: el asistente vive en la disposición general y los botones que lo
 * abren están repartidos por páginas que no son hijas suyas. Montar un
 * proveedor de contexto por encima de todo obligaría a convertir en
 * componentes de cliente ramas enteras que hoy se pintan en el servidor.
 */

export const EVENTO_ASISTENTE = 'divine:asistente';

export type PeticionAsistente = {
  /** Si se pasa, el asistente la manda solo al abrirse. */
  pregunta?: string;
};

export function abrirAsistente(pregunta?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<PeticionAsistente>(EVENTO_ASISTENTE, { detail: { pregunta } })
  );
}
