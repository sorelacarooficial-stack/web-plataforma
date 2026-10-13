'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Mensaje,
  SALUDO,
  SUGERENCIAS,
  responder,
  type Accion,
} from '@/lib/asistente';
import { EVENTO_ASISTENTE, type PeticionAsistente } from '@/lib/abrir-asistente';
import { abrirCaptacion } from '@/lib/abrir-captacion';
import css from './Asistente.module.css';

export default function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  // Cada mensaje puede traer una acción: un botón que hace lo que acaba de
  // ofrecer, en vez de pedirle a la persona que vaya a buscarlo.
  const [chat, setChat] = useState<(Mensaje & { accion?: Accion })[]>([
    { rol: 'asistente', texto: SALUDO },
  ]);

  const panelRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);
  const temporizador = useRef<number | null>(null);
  const lanzadorRef = useRef<HTMLButtonElement>(null);
  const [apartado, setApartado] = useState<'no' | 'burbuja' | 'oculto'>('no');
  const ruta = usePathname();

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

  /*
   * El lanzador se aparta de los formularios.
   *
   * Flota abajo a la derecha, y ahí mismo suele caer el final de un formulario.
   * En /comunidad, en un portátil, la pastilla «Te ayudo a decidir» tapaba
   * «Apuntarme a la lista» nada más cargar, y en el móvil la burbuja se comía
   * el final del campo «Nombre» y se abría el asistente al tocarlo. Achicar la
   * página para dejarle sitio no sirve: cada pantalla deja el botón en otra
   * altura, y basta un mensaje de error para que la tarjeta crezca.
   *
   * Así que mira qué tiene debajo. Si es un campo, un botón o el texto de un
   * formulario de la página, primero se queda en la burbuja, sin el reclamo;
   * si ni así deja libre lo de debajo, se esconde hasta que se baja un poco.
   * En la primera pantalla también va en burbuja (ver más abajo). Con el
   * teclado sigue a mano: al enfocarlo vuelve a verse (Asistente.module.css).
   */
  useEffect(() => {
    if (abierto) return;
    const HOLGURA = 8;
    let marco = 0;
    let vivo = true;
    // El ancho del lanzador tal y como lo deja el CSS (pastilla en escritorio,
    // burbuja en el móvil). Mientras está apartado mide menos, y entonces se
    // sigue usando el último ancho natural: si no, en cuanto se achicara
    // dejaría de tocar el botón, volvería a crecer y se pondría a parpadear.
    let anchoNatural = 0;

    const medir = () => {
      marco = 0;
      const boton = lanzadorRef.current;
      if (!boton) return;
      const r = boton.getBoundingClientRect();
      if (!boton.classList.contains(css.compacto)) anchoNatural = r.width;
      const lado = Math.min(r.width, r.height);
      const toca = (c: DOMRect, izquierda: number) =>
        c.width > 0 &&
        c.height > 0 &&
        c.right > izquierda - HOLGURA &&
        c.left < r.right + HOLGURA &&
        c.bottom > r.top - HOLGURA &&
        c.top < r.bottom + HOLGURA;

      // Los controles por su caja (los de los formularios y los de las
      // llamadas marcadas con data-aparta-asistente, como las de la portada),
      // y los textos (la nota de debajo del botón,
      // el consentimiento, los errores) por sus líneas: la caja de un párrafo
      // centrado ocupa todo el ancho aunque la frase sea corta.
      // Lo que todavía está entrando (un FadeIn a medio camino, con su
      // opacidad por debajo de 1) no cuenta: está más abajo de donde se va a
      // quedar y, si se midiera, el lanzador se escondería un momento para
      // nada. Las medidas de más abajo lo recogen cuando ya ha llegado.
      const entrando = (el: Element) => {
        for (let n: Element | null = el, i = 0; n && i < 6; n = n.parentElement, i++) {
          if (Number(getComputedStyle(n).opacity) < 0.98) return true;
        }
        return false;
      };
      const cajas: DOMRect[] = [];
      for (const el of document.querySelectorAll(
        'main form :is(input, select, textarea, button, summary), main [data-aparta-asistente] :is(a, button)'
      )) {
        if (!entrando(el)) cajas.push(el.getBoundingClientRect());
      }
      const rango = document.createRange();
      for (const el of document.querySelectorAll('main form :is(p, label)')) {
        rango.selectNodeContents(el);
        cajas.push(...rango.getClientRects());
      }

      let tocaPastilla = false;
      let tocaBurbuja = false;
      for (const c of cajas) {
        if (toca(c, r.right - lado)) {
          tocaBurbuja = true;
          break;
        }
        if (toca(c, r.right - anchoNatural)) tocaPastilla = true;
      }
      // En la primera pantalla, además, va en burbuja aunque no tape nada: ahí
      // están el titular y las llamadas de cada página, y la pastilla «Te
      // ayudo a decidir» debajo de ellas se leía como un botón más. El reclamo
      // sale en cuanto se baja un poco.
      const arriba = window.scrollY < window.innerHeight * 0.4;
      setApartado(
        tocaBurbuja ? 'oculto' : (tocaPastilla || arriba) && anchoNatural > lado + 1 ? 'burbuja' : 'no'
      );
    };
    const programar = () => {
      if (vivo && !marco) marco = window.requestAnimationFrame(medir);
    };

    programar();
    window.addEventListener('scroll', programar, { passive: true });
    window.addEventListener('resize', programar);
    // Lo que mueve el formulario sin que la página se desplace: los mensajes
    // de error que lo alargan, la confirmación que lo encoge y las entradas
    // animadas de las secciones al bajar.
    document.addEventListener('transitionend', programar);
    document.addEventListener('focusin', programar);
    const observador = new ResizeObserver(programar);
    const principal = document.querySelector('main');
    if (principal) observador.observe(principal);
    document.fonts?.ready.then(programar);
    // Las entradas de framer-motion (FadeIn) mueven las llamadas con
    // transform y no avisan al terminar: midiendo solo al cargar, el botón de
    // la portada quedaba 20 px más abajo de donde acaba y el lanzador se
    // escondía sin tapar nada. Se vuelve a medir cuando ya han llegado.
    const tardes = [700, 1600, 3000].map((ms) => window.setTimeout(programar, ms));

    return () => {
      vivo = false;
      tardes.forEach((t) => window.clearTimeout(t));
      if (marco) window.cancelAnimationFrame(marco);
      window.removeEventListener('scroll', programar);
      window.removeEventListener('resize', programar);
      document.removeEventListener('transitionend', programar);
      document.removeEventListener('focusin', programar);
      observador.disconnect();
    };
  }, [abierto, ruta]);

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
      const { texto, accion } = responder(limpio);
      setChat((c) => [...c, { rol: 'asistente', texto, accion }]);
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
              <span className={css.subtitulo}>Formación, agenda y comunidad</span>
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
              <div key={i} className={m.rol === 'yo' ? css.filaYo : css.filaEl}>
                <p className={m.rol === 'yo' ? css.burbujaYo : css.burbujaEl}>{m.texto}</p>
                {m.accion && (
                  <button
                    type="button"
                    className={css.accion}
                    onClick={() =>
                      abrirCaptacion({
                        titulo: m.accion!.titulo,
                        entradilla: m.accion!.entradilla,
                        origen: 'asistente',
                      })
                    }
                  >
                    {m.accion.etiqueta}
                  </button>
                )}
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
            {/* Una flecha y no la palabra «Enviar»: es un botón de 38 px
                dentro de la pastilla, y ahí una palabra en mayúsculas pide un
                ancho que deja al campo sin sitio en un móvil. */}
            <button type="submit" className={css.enviar} aria-label="Enviar">
              <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M10 16.5V4M10 4 4.5 9.5M10 4l5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>
          </form>
        </section>
      )}

      {!abierto && (
        <button
          ref={lanzadorRef}
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir el asistente Divine"
          className={[
            css.lanzador,
            apartado !== 'no' && css.compacto,
            apartado === 'oculto' && css.oculto,
          ]
            .filter(Boolean)
            .join(' ')}
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
            <span className={css.reclamoFino}>Formación, agenda y comunidad</span>
          </span>
        </button>
      )}
    </div>
  );
}
