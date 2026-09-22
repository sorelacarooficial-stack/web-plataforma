/**
 * Abrir el formulario de contacto desde cualquier punto de la web.
 *
 * Mismo recurso que lib/abrir-asistente.ts y por el mismo motivo: los sitios
 * que quieren abrirlo —el asistente, un botón de una sección cualquiera— no
 * son hijos del componente que lo pinta, y montar un proveedor de contexto por
 * encima de todo obligaría a convertir en componentes de cliente ramas enteras
 * que hoy se pintan en el servidor.
 */

export const EVENTO_CAPTACION = 'divine:captacion';

export type PeticionCaptacion = {
  titulo?: string;
  entradilla?: string;
  /** De dónde viene, para saberlo luego en la hoja: 'asistente', 'qr'… */
  origen?: string;
};

export function abrirCaptacion(peticion: PeticionCaptacion = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PeticionCaptacion>(EVENTO_CAPTACION, { detail: peticion }));
}
