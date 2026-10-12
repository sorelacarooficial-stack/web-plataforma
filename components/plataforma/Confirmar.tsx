'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import s from './confirmar.module.css';

/**
 * Preguntar antes de borrar, y avisar si algo sale mal.
 *
 * Sustituye al `window.confirm` y al `alert` del navegador: esos cuadros
 * grises cortan la plataforma, no se pueden leer bien en el móvil y no dicen
 * qué se pierde. Aquí la pregunta sale con la letra de la casa, explica lo que
 * pasa al aceptar y el botón de peligro se distingue de un vistazo.
 *
 *   const [confirmar, dialogo] = useConfirmar();
 *   if (!(await confirmar({ titulo: '¿Borrar esta foto?', boton: 'Borrar' }))) return;
 *   …
 *   return <>{…}{dialogo}</>;
 *
 * Accesible: `role="alertdialog"`, el foco entra en «Cancelar» (lo seguro, si
 * se pulsa Intro sin mirar), no se escapa del diálogo con el tabulador,
 * Escape cancela y al cerrar el foco vuelve a donde estaba.
 */

export type OpcionesConfirmar = { titulo: string; texto?: string; boton?: string };

type Pregunta = OpcionesConfirmar & { id: number; responder: (si: boolean) => void };

let siguienteId = 0;

export function useConfirmar(): [(o: OpcionesConfirmar) => Promise<boolean>, ReactNode] {
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const [montado, setMontado] = useState(false);
  const actual = useRef<Pregunta | null>(null);

  useEffect(() => {
    setMontado(true);
    // Si la pantalla se va con la pregunta abierta, la respuesta es «no».
    return () => actual.current?.responder(false);
  }, []);

  const confirmar = useCallback(
    (o: OpcionesConfirmar) =>
      new Promise<boolean>((resolver) => {
        // Una pregunta nueva cierra la anterior (con un «no»): nunca dos a la vez.
        actual.current?.responder(false);
        const p: Pregunta = {
          ...o,
          id: ++siguienteId,
          responder: (si) => {
            if (actual.current === p) {
              actual.current = null;
              setPregunta(null);
            }
            resolver(si);
          },
        };
        actual.current = p;
        setPregunta(p);
      }),
    []
  );

  const nodo = montado
    ? createPortal(<AnimatePresence>{pregunta && <Dialogo key={pregunta.id} p={pregunta} />}</AnimatePresence>, document.body)
    : null;

  return [confirmar, nodo];
}

function Dialogo({ p }: { p: Pregunta }) {
  const reducir = useReducedMotion();
  const id = useId();
  const cancelar = useRef<HTMLButtonElement>(null);
  const aceptar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // En captura y sin propagar: que no cierre también el visor o el menú de detrás.
        e.preventDefault();
        e.stopPropagation();
        p.responder(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const a = cancelar.current;
      const b = aceptar.current;
      if (!a || !b) return;
      const en = document.activeElement;
      if (en !== a && en !== b) {
        e.preventDefault();
        a.focus();
      } else if (e.shiftKey && en === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && en === b) {
        e.preventDefault();
        a.focus();
      }
    };
    window.addEventListener('keydown', tecla, true);
    return () => {
      window.removeEventListener('keydown', tecla, true);
      // El foco vuelve al botón que abrió la pregunta, si sigue ahí.
      if (previo && previo.isConnected) previo.focus({ preventScroll: true });
    };
  }, [p]);

  return (
    <motion.div
      className={s.velo}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducir ? 0 : 0.18 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) p.responder(false);
      }}
    >
      <motion.div
        className={s.dialogo}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={p.texto ? `${id}-texto` : undefined}
        initial={reducir ? false : { opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reducir ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
        transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 32 }}
      >
        <span className={s.icono} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </span>
        <h2 id={`${id}-titulo`} className={s.titulo}>
          {p.titulo}
        </h2>
        {p.texto && (
          <p id={`${id}-texto`} className={s.texto}>
            {p.texto}
          </p>
        )}
        <div className={s.botones}>
          <button ref={cancelar} type="button" className={s.cancelar} onClick={() => p.responder(false)}>
            Cancelar
          </button>
          <button ref={aceptar} type="button" className={s.peligro} onClick={() => p.responder(true)}>
            {p.boton || 'Borrar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ==========================================================================
   Avisos
   ========================================================================== */

export type TipoAviso = 'error' | 'hecho';

type Aviso = { id: number; texto: string; tipo: TipoAviso };

/**
 * Un aviso que sale abajo y se va solo: «No se ha podido borrar», «Foto
 * borrada». Banda clara con icono, texto fuerte y un «Vale» para quitarlo ya.
 * Los errores se anuncian a los lectores de pantalla en el acto (`alert`);
 * lo que sale bien, sin interrumpir (`status`).
 */
export function useAviso(): [(texto: string, tipo?: TipoAviso) => void, ReactNode] {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [montado, setMontado] = useState(false);
  const reducir = useReducedMotion();

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aviso) return;
    // Los errores se leen con calma; lo que sale bien, se va antes.
    const t = setTimeout(() => setAviso(null), aviso.tipo === 'error' ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const avisar = useCallback((texto: string, tipo: TipoAviso = 'error') => setAviso({ id: ++siguienteId, texto, tipo }), []);

  const nodo = montado
    ? createPortal(
        <AnimatePresence>
          {aviso && (
            <motion.div
              key={aviso.id}
              className={s.aviso}
              data-tipo={aviso.tipo}
              role={aviso.tipo === 'error' ? 'alert' : 'status'}
              initial={reducir ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? { opacity: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: reducir ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={s.avisoIcono} aria-hidden="true">
                {aviso.tipo === 'error' ? (
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 7.5v6M12 17h.01" />
                    <circle cx="12" cy="12" r="9.2" strokeWidth="1.7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              <p className={s.avisoTexto}>{aviso.texto}</p>
              <button type="button" className={s.avisoBoton} onClick={() => setAviso(null)}>
                Vale
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;

  return [avisar, nodo];
}
