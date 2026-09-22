'use client';

import { useCallback, useEffect, useRef } from 'react';
import css from './ModalDivine.module.css';

/**
 * Ventana emergente.
 *
 * Se apoya en el elemento <dialog> del navegador en vez de montar una capa a
 * mano. No es por ahorrar código: showModal() ya trae resuelto el atrapado del
 * foco dentro de la ventana, el cierre con Escape, el fondo inerte y el orden
 * de lectura para un lector de pantalla. Una capa casera acierta en lo visual
 * y falla en todo eso, y el fallo no se ve hasta que alguien navega con el
 * teclado.
 */
export default function ModalDivine({
  abierto,
  alCerrar,
  titulo,
  children,
  ancho = 'normal',
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  ancho?: 'normal' | 'ancho';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  // El fondo de la página no debe poder moverse mientras la ventana está
  // abierta: en móvil, si se deja, al arrastrar dentro del formulario se
  // desplaza la página de detrás y se pierde de vista lo que se escribe.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // Escape cierra por su cuenta, sin pasar por React: hay que enterarse para
  // que el estado de fuera no se quede creyendo que sigue abierta.
  const alCancelar = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      alCerrar();
    },
    [alCerrar]
  );

  return (
    <dialog
      ref={ref}
      className={`${css.dialogo} ${ancho === 'ancho' ? css.ancho : ''}`}
      onCancel={alCancelar}
      onClose={() => abierto && alCerrar()}
      aria-label={titulo}
      // Clic en el fondo oscuro: el <dialog> recibe el clic cuando cae fuera
      // de la caja, porque la caja es un hijo suyo. Comparando el objetivo con
      // el propio diálogo se distingue «fuera» de «dentro» sin medir píxeles.
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
    >
      <div className={css.caja}>
        <button type="button" className={css.cerrar} onClick={alCerrar} aria-label="Cerrar">
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <path
              d="M1 1l13 13M14 1L1 14"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {children}
      </div>
    </dialog>
  );
}
