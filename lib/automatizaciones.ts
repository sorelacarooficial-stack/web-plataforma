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
    nombre: 'Gracias por apuntarte · grupo de WhatsApp',
    cuando: 'Alguien deja sus datos en la web (la lista de espera, la portada, el formulario de contacto, el asistente o «Apúntate» en formaciones): el mismo correo para todas, con la lista de espera de la masterclass y el botón del grupo de WhatsApp. «Reservar plaza» en una formación lleva su confirmación, y quien solo pide que la avises cuando haya terapeuta en su ciudad no recibe nada (te llega a ti el aviso).',
    quien: 'La persona que lo ha rellenado',
    porDefecto: true,
    /** Estos no se apagan desde aquí: van por su propio camino. */
    fijo: true,
  },
  {
    id: 'acceso-formacion',
    nombre: 'Ya tienes la formación',
    cuando: 'Entra con su enlace del curso (con solo el abono le dice que tiene el precurso y los dosieres; los vídeos, al terminar la clase presencial), y otra vez cuando se le abre el curso completo al marcarla «Pagado».',
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
    nombre: 'Gracias por apuntarte (al crearse la cuenta)',
    cuando: 'Alguien se crea una cuenta sola, sin enlace. Recibe el mismo correo de la lista de espera y el grupo de WhatsApp, salvo que ya le hubiera llegado al dejar sus datos en la web.',
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
    cuando:
      'Cada mañana, solo si algo depende de ti: alguien te ha escrito o pedido algo, una cuenta espera acceso o a un correo programado le falta el enlace. La lista de espera no cuenta: sigue sola.',
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
