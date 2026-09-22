'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mensaje,
  SALUDO,
  SUGERENCIAS,
  responder,
} from '@/lib/asistente';
import { EVENTO_ASISTENTE, type PeticionAsistente } from '@/lib/abrir-asistente';
import css from './Asistente.module.css';

export default function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [chat, setChat] = useState<Mensaje[]>([
    { rol: 'asistente', texto: SALUDO },
  ]);

  const panelRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);
  const temporizador = useRef<number | null>(null);

  // El panel baja al último mensaje al enviar y al recibir.
  useEffect(() => {
    const el = panelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, escribiendo, abierto]);

  useEffect(() => {
    if (abierto) entradaRef.current?.focus();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierto]);

  useEffect(
    () => () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
    },
    []
  );

  // Otros puntos de la web («Agendar cita», «Consultar fechas») abren el
  // asistente con la pregunta ya escrita. El oyente se registra una sola vez,
  // así que llama a preguntar() a través de una referencia que se refresca en
  // cada pintado: si lo llamara directamente, se quedaría atrapado con el
  // estado del primer pintado y creería para siempre que no está escribiendo.
  const preguntarRef = useRef<(t: string) => void>(() => {});
  useEffect(() => {
    const abrirDesdeFuera = (e: Event) => {
      const pregunta = (e as CustomEvent<PeticionAsistente>).detail?.pregunta;
      setAbierto(true);
      if (pregunta) window.setTimeout(() => preguntarRef.current(pregunta), 260);
    };
    window.addEventListener(EVENTO_ASISTENTE, abrirDesdeFuera);
    return () => window.removeEventListener(EVENTO_ASISTENTE, abrirDesdeFuera);
  }, []);

  function preguntar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || escribiendo) return;

    setChat((c) => [...c, { rol: 'yo', texto: limpio }]);
    setBorrador('');
    setEscribiendo(true);

    // Una pausa corta: sin ella la respuesta aparece antes que la pregunta
    // y se pierde la sensación de que alguien está mirando la agenda.
    temporizador.current = window.setTimeout(() => {
      setChat((c) => [...c, { rol: 'asistente', texto: responder(limpio) }]);
      setEscribiendo(false);
    }, 420);
  }

  // Se refresca en cada pintado para que el oyente de arriba llame siempre a
  // la versión con el estado de ahora.
  preguntarRef.current = preguntar;

  return (
    <div className={css.zona}>
      {abierto && (
        <section className={css.panel} aria-label="Asistente Divine">
          <header className={css.cabecera}>
            <span className={css.avatar}>D</span>
            <span className={css.identidad}>
              <span className={css.nombre}>Asistente Divine</span>
              <span className={css.subtitulo}>Fechas, plazas, precios y reservas</span>
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className={css.cerrar}
              aria-label="Cerrar el asistente"
            >
              ×
            </button>
          </header>

          <div ref={panelRef} className={css.mensajes} aria-live="polite">
            {chat.map((m, i) => (
              <div
                key={i}
                className={m.rol === 'yo' ? css.filaYo : css.filaEl}
              >
                <p className={m.rol === 'yo' ? css.burbujaYo : css.burbujaEl}>
                  {m.texto}
                </p>
              </div>
            ))}
            {escribiendo && (
              <div className={css.filaEl}>
                <p className={css.escribiendo}>Mirando la agenda…</p>
              </div>
            )}
          </div>

          {/* Solo mientras no haya conversación: una vez que se pregunta,
              los chips estorban más de lo que ayudan y roban alto a los mensajes. */}
          {chat.length === 1 && (
            <div className={css.chips}>
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => preguntar(s)}
                  className={css.chip}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className={css.entrada}
            onSubmit={(e) => {
              e.preventDefault();
              preguntar(borrador);
            }}
          >
            <input
              ref={entradaRef}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="Pregunta lo que necesites"
              aria-label="Escribe tu pregunta"
              className={css.campo}
            />
            <button type="submit" className={css.enviar}>
              Enviar
            </button>
          </form>
        </section>
      )}

      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir el asistente Divine"
          className={css.lanzador}
        >
          <span className={css.marca}>
            <svg
              width="34"
              height="34"
              viewBox="0 0 40 40"
              fill="none"
              aria-hidden="true"
              className={css.orbita}
            >
              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
              <circle cx="20" cy="2" r="2.6" fill="var(--oro-claro)" />
              <circle cx="20" cy="38" r="1.5" fill="currentColor" fillOpacity=".45" />
            </svg>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={css.hoja}
            >
              <path d="M12 3.4c2.2 2.6 3.3 5.4 3.3 8.6S14.2 18.6 12 21.2c-2.2-2.6-3.3-5.4-3.3-9.2S9.8 6 12 3.4Z" />
              <path d="M3.6 12h16.8" />
            </svg>
          </span>
          <span className={css.reclamo}>
            <span className={css.reclamoFuerte}>Te ayudo a decidir</span>
            <span className={css.reclamoFino}>Fechas, plazas y precios</span>
          </span>
        </button>
      )}
    </div>
  );
}
