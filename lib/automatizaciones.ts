/**
 * Los correos que salen solos, descritos en un sitio que leen a la vez el
 * servidor (para saber si mandarlos) y la pantalla Correos (para enseñarlos y
 * poder apagarlos). Sin nada de servidor aquí dentro: lo importa el navegador.
 *
 * `porDefecto`: los que responden a algo que la persona acaba de hacer o que
 * Sorela acaba de darle van encendidos; los que escriben a una lista entera
 * van APAGADOS hasta que Sorela lea el texto y los encienda ella.
 */

export const AUTOMATIZACIONES = [
  {
    id: 'bienvenida',
    nombre: 'Información al dejar sus datos',
    cuando: 'Alguien deja su nombre y correo en un formulario de la web.',
    quien: 'La persona que lo ha rellenado',
    porDefecto: true,
    /** Estos no se apagan desde aquí: van por su propio camino. */
    fijo: true,
  },
  {
    id: 'acceso-formacion',
    nombre: 'Ya tienes la formación',
    cuando: 'Le das la Formación Técnica Divine en Cuentas, o entra con un enlace que la incluye.',
    quien: 'La alumna',
    porDefecto: true,
  },
  {
    id: 'acceso-comunidad',
    nombre: 'Bienvenida a la Comunidad Divine',
    cuando: 'Le das la Comunidad Divine en Cuentas, o entra con un enlace que la incluye.',
    quien: 'La nueva miembro',
    porDefecto: true,
  },
  {
    id: 'invitacion',
    nombre: 'Tu enlace para entrar',
    cuando: 'Creas un enlace de invitación y escribes el correo de la persona.',
    quien: 'La persona invitada',
    porDefecto: true,
  },
  {
    id: 'registro',
    nombre: 'Hemos recibido tu registro',
    cuando: 'Alguien se crea una cuenta sola, sin enlace, y todavía no tiene acceso a nada.',
    quien: 'La persona que se registra',
    porDefecto: true,
  },
  {
    id: 'acuerdo',
    nombre: 'Acuerdo de confidencialidad firmado',
    cuando: 'Una alumna firma el acuerdo de la formación.',
    quien: 'La alumna, con su acuerdo en PDF y el dossier',
    porDefecto: true,
    fijo: true,
  },
  {
    id: 'resumen-sorela',
    nombre: 'Tu resumen de la mañana',
    cuando: 'Cada mañana, solo si hay algo pendiente: contactos sin atender y registros esperando acceso.',
    quien: 'Tú',
    porDefecto: true,
  },
] as const;

export type IdAutomatizacion = (typeof AUTOMATIZACIONES)[number]['id'];

export const ID_AUTOMATIZACIONES = AUTOMATIZACIONES.map((a) => a.id) as IdAutomatizacion[];

export const ETIQUETA_CORREO: Record<string, string> = {
  ...Object.fromEntries(AUTOMATIZACIONES.map((a) => [a.id, a.nombre])),
  campana: 'Aviso o programado',
  'aviso-interno': 'Aviso para ti',
  prueba: 'Prueba',
  manual: 'A mano',
};
