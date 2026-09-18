'use client';

import { useEffect, useState } from 'react';
import css from './Cabecera.module.css';

type Tema = 'claro' | 'oscuro';

export default function CambiarTema() {
  // Arranca en null para que el primer render del cliente coincida con el HTML
  // del servidor; el tema real ya lo puso el script en <head> antes de pintar.
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    const actual = document.documentElement.getAttribute('data-tema');
    setTema(actual === 'oscuro' ? 'oscuro' : 'claro');
  }, []);

  function alternar() {
    const siguiente: Tema = tema === 'oscuro' ? 'claro' : 'oscuro';
    document.documentElement.setAttribute('data-tema', siguiente);
    try {
      window.localStorage.setItem('divine-tema', siguiente);
    } catch {
      /* navegación privada o almacenamiento bloqueado: el tema dura la sesión */
    }
    setTema(siguiente);
    // El mapa se repinta con los colores del tema nuevo.
    window.dispatchEvent(new CustomEvent('divine-tema', { detail: siguiente }));
  }

  const etiqueta = tema === 'oscuro' ? 'Ver en claro' : 'Ver en oscuro';

  return (
    <button
      type="button"
      onClick={alternar}
      title={etiqueta}
      aria-label={etiqueta}
      className={css.tema}
    >
      {tema === 'oscuro' ? <Sol /> : <Luna />}
    </button>
  );
}

function Luna() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
    </svg>
  );
}

function Sol() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
    </svg>
  );
}
