/**
 * Los logros de la plataforma, descritos en un sitio que leen el servidor (para
 * calcularlos) y la pantalla (para pintarlos). Sin nada de servidor dentro.
 *
 * Tres familias, que es lo que da ganas de volver: avanzar en el curso,
 * participar en la comunidad y la constancia. Cada uno tiene una meta clara y
 * una barra de cuánto falta: lo que motiva no es el trofeo, es ver que está
 * cerca.
 */

export type Familia = 'curso' | 'comunidad' | 'constancia';

export type DefLogro = {
  id: string;
  familia: Familia;
  nombre: string;
  texto: string;
  /** Un emoji sobrio: se ve igual en todos los móviles y no pesa nada. */
  icono: string;
  meta: number;
};

export const LOGROS: DefLogro[] = [
  { id: 'primera-clase', familia: 'curso', nombre: 'Primer paso', texto: 'Terminas tu primera clase.', icono: '🌱', meta: 1 },
  { id: 'mitad-curso', familia: 'curso', nombre: 'A mitad de camino', texto: 'Llevas la mitad de la formación.', icono: '🌿', meta: 50 },
  { id: 'curso-completo', familia: 'curso', nombre: 'Formación completa', texto: 'Terminas todas las clases. Te ganas tu certificado.', icono: '🏆', meta: 100 },

  { id: 'primera-publicacion', familia: 'comunidad', nombre: 'Me presento', texto: 'Publicas por primera vez en la comunidad.', icono: '💬', meta: 1 },
  { id: 'primera-respuesta', familia: 'comunidad', nombre: 'Echo una mano', texto: 'Respondes a una compañera.', icono: '🤝', meta: 1 },
  { id: 'cinco-respuestas', familia: 'comunidad', nombre: 'Compañera de oro', texto: 'Respondes 5 veces en la comunidad.', icono: '✨', meta: 5 },
  { id: 'diez-me-gusta', familia: 'comunidad', nombre: 'Inspiras', texto: 'Recibes 10 «me gusta».', icono: '❤️', meta: 10 },
  { id: 'podio', familia: 'comunidad', nombre: 'En el podio', texto: 'Quedas entre las 3 más activas del mes.', icono: '🥇', meta: 1 },

  { id: 'racha-3', familia: 'constancia', nombre: 'Tres días seguidos', texto: 'Entras 3 días seguidos.', icono: '🔥', meta: 3 },
  { id: 'racha-7', familia: 'constancia', nombre: 'Una semana entera', texto: 'Entras 7 días seguidos.', icono: '⚡', meta: 7 },
  { id: 'racha-30', familia: 'constancia', nombre: 'Imparable', texto: 'Entras 30 días seguidos.', icono: '👑', meta: 30 },
];

export const FAMILIAS: Record<Familia, string> = {
  curso: 'Tu formación',
  comunidad: 'Comunidad',
  constancia: 'Constancia',
};

export type EstadoLogro = DefLogro & { progreso: number; conseguido: boolean; cuando: string | null };

export type Resumen = {
  logros: EstadoLogro[];
  /** Conseguidos ahora mismo y que todavía no se habían celebrado. */
  nuevos: string[];
  curso: { hechas: number; total: number; porcentaje: number };
  racha: { actual: number; mejor: number };
  certificado: boolean;
};
