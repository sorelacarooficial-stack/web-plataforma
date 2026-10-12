/**
 * Por dónde llegó alguien a la web, para que el CRM pueda decir «vino de
 * Instagram» y no solo «rellenó la lista de espera».
 *
 * Se apunta UNA vez, al cargar la primera página, y se guarda en la memoria
 * de esta pestaña —una variable, no localStorage ni cookies—: la web se mueve
 * entre páginas sin recargar, así que el dato sigue ahí cuando la persona
 * rellena un formulario tres páginas después. Si recarga, se pierde y cuenta
 * como «directo», que es un precio pequeño por no guardar nada en su móvil ni
 * tener que pedirle permiso.
 *
 * Solo viaja si la persona manda un formulario: quien solo mira no deja nada.
 */

export type Llegada = {
  /** La web de la que venía (document.referrer), o vacío. */
  ref: string;
  /** utm_source u `?origen=` del enlace con el que entró. */
  utm: string;
  /** utm_campaign, si el enlace lo traía. */
  campana: string;
  /** La primera página que vio. */
  entrada: string;
  /** La página en la que rellenó el formulario. */
  pagina: string;
};

let primera: Omit<Llegada, 'pagina'> | null = null;

function apuntar() {
  if (primera || typeof window === 'undefined') return;
  const q = new URLSearchParams(location.search);
  primera = {
    ref: document.referrer.slice(0, 300),
    utm: (q.get('utm_source') || q.get('origen') || '').slice(0, 60),
    campana: (q.get('utm_campaign') || '').slice(0, 60),
    entrada: location.pathname.slice(0, 120),
  };
}

// Al cargar el módulo, que va en la primera página (lo importa el medidor).
apuntar();

/** Lo que se sabe de la llegada, para mandarlo junto a un formulario. */
export function llegada(): Llegada | null {
  apuntar();
  if (!primera) return null;
  return { ...primera, pagina: location.pathname.slice(0, 120) };
}

/** Los datos de un formulario con la llegada pegada. */
export function conLlegada<T extends object>(datos: T): T & { llegada?: Llegada } {
  const l = llegada();
  return l ? { ...datos, llegada: l } : datos;
}
