/**
 * Ir a una pantalla de la plataforma desde cualquier componente, sin tener que
 * pasar la función `ir` por cinco niveles: se cambia la dirección y se avisa
 * con un «popstate», que es lo que ya escucha Plataforma para el botón atrás.
 */
export function irA(vista: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ v: vista, ...extra });
  window.history.pushState(null, '', `${window.location.pathname}?${q}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  try {
    window.scrollTo(0, 0);
  } catch {
    /* da igual */
  }
}

export const verPerfil = (uid: string) => irA('perfil', { u: uid });
