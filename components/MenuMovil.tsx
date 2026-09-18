'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import css from './MenuMovil.module.css';

/**
 * Menú de la web en pantallas estrechas.
 *
 * Antes la navegación se desplazaba en horizontal dentro de la cabecera y los
 * enlaces quedaban apretados contra el botón de tema. Ahora, por debajo de
 * 900 px, la cabecera solo enseña el logo y este botón: al pulsarlo se abre
 * un panel a pantalla completa con los enlaces en grande.
 */
export default function MenuMovil({
  enlaces,
  plataformaUrl,
}: {
  enlaces: { href: string; texto: string }[];
  plataformaUrl: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const ruta = usePathname();

  useEffect(() => setMontado(true), []);

  // Al cambiar de página el panel se cierra solo.
  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  // Con el panel abierto la página de detrás no se desplaza.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener('keydown', alPulsar);
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls="menu-movil"
        aria-label={abierto ? 'Cerrar el menú' : 'Abrir el menú'}
        className={css.boton}
      >
        <span className={`${css.raya} ${abierto ? css.rayaArribaX : ''}`} />
        <span className={`${css.raya} ${abierto ? css.rayaMediaX : ''}`} />
        <span className={`${css.raya} ${abierto ? css.rayaAbajoX : ''}`} />
      </button>

      {/* El panel se monta en <body>, no dentro de la cabecera: la cabecera
          lleva backdrop-filter, y eso la convierte en bloque contenedor de sus
          descendientes `fixed`, así que el panel quedaba encajado en los 66 px
          de alto de la barra en lugar de ocupar la ventana. */}
      {montado &&
        abierto &&
        createPortal(
          <div
            id="menu-movil"
            className={css.panel}
            onClick={(e) => {
              if (e.target === e.currentTarget) setAbierto(false);
            }}
          >
            <nav className={css.lista} aria-label="Principal">
              {enlaces.map((e, i) => (
                <Link
                  key={e.href}
                  href={e.href}
                  className={`${css.enlace} ${ruta === e.href ? css.enlaceActivo : ''}`}
                  style={{ animationDelay: `${40 + i * 45}ms` }}
                >
                  {e.texto}
                </Link>
              ))}

              <Link
                href={plataformaUrl}
                className={css.entrar}
                style={{ animationDelay: `${40 + enlaces.length * 45}ms` }}
              >
                Entrar
              </Link>
            </nav>
          </div>,
          document.body
        )}
    </>
  );
}
