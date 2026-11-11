'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Recorrido } from '@/lib/avance';
import { horaColombia } from '@/lib/citas';
import r from './recorridoaula.module.css';

/**
 * El camino de la academia, arriba del aula.
 *
 * Cuatro módulos en fila, con candado los que aún no tocan, y debajo una
 * tarjeta grande con EL siguiente paso y un solo botón: leer el módulo, pedir
 * la reunión con Sorela o ver el vídeo. Al terminar un módulo sale una
 * celebración que dice qué se ha abierto y a dónde ir.
 *
 * Qué está abierto lo decide el servidor (lib/avance-servidor.ts). Esto solo
 * lo pinta: quitar un candado aquí no abre nada.
 */

type Props = {
  recorrido: Recorrido;
  leer: (idDosier: string, pagina?: number) => void;
  verClase: (idClase: string) => void;
  /** Tras pedir la reunión: que el aula vuelva a preguntar qué hay abierto. */
  recargar: () => void;
  /** Al subir, abre la ventana de pedir la reunión (desde el final del dosier). */
  pedirAhora?: number;
  /** Vista de prueba de Sorela («Ver como»): la reunión no se pide de verdad. */
  muestra?: { pedirCita: (cuando: string) => void };
};

const DIA = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const DIA_CORTO = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const claveDia = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function Candado() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function Visto() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function RecorridoAula({ recorrido, leer, verClase, recargar, muestra, pedirAhora = 0 }: Props) {
  const quieto = useReducedMotion();
  const { modulos, siguiente, cita } = recorrido;
  const [pidiendo, setPidiendo] = useState(false);
  const [fiesta, setFiesta] = useState<{ titulo: string; texto: string } | null>(null);
  /* Si ya se le ha dicho dentro del lector, la celebración de después sobra. */
  const callar = useRef(false);
  useEffect(() => {
    if (!pedirAhora) return;
    callar.current = true;
    setPidiendo(true);
  }, [pedirAhora]);

  /* La celebración: sale cuando, estando en el aula, pasa a haber un módulo
     terminado más (o la reunión recién pedida). Al entrar no se celebra nada:
     lo ya hecho es el punto de partida. */
  const hechos = modulos.filter((m) => m.completo).length;
  const antes = useRef<{ hechos: number; cita: boolean } | null>(null);
  useEffect(() => {
    const a = antes.current;
    antes.current = { hechos, cita: Boolean(cita) };
    if (!a) return;
    if (callar.current && hechos > a.hechos) {
      callar.current = false;
      return;
    }
    if (hechos > a.hechos) {
      const m = modulos[hechos - 1];
      const sig = modulos[hechos];
      setFiesta({
        titulo: `${m.nombre} completado`,
        texto: !sig
          ? 'Has terminado los cuatro módulos. Ahora tocan tus prácticas en directo con Sorela.'
          : hechos === 1 && !cita
            ? 'Antes de seguir, pide tu reunión con Sorela. Con ella se abre el siguiente módulo.'
            : `Se ha abierto el ${sig.nombre}.`,
      });
    } else if (!a.cita && cita) {
      setFiesta({ titulo: 'Reunión pedida', texto: `Ya tienes tu reunión con Sorela. Se ha abierto el ${modulos[1]?.nombre ?? 'siguiente módulo'}.` });
    }
  }, [hechos, cita]); // eslint-disable-line react-hooks/exhaustive-deps

  const citaFutura = cita && new Date(cita.cuando).getTime() > Date.now() ? cita : null;

  /* El paso de ahora, con sus palabras y su botón. */
  const paso = (() => {
    if (siguiente.tipo === 'leer') {
      const m = modulos[siguiente.modulo];
      const empezado = m.pagina > 1;
      return {
        rotulo: siguiente.modulo === 0 && !empezado ? 'Empieza por aquí' : 'Tu siguiente paso',
        titulo: empezado ? `Sigue leyendo el ${m.nombre}` : `Lee el ${m.nombre}`,
        texto: empezado
          ? `Vas por la página ${m.pagina} de ${m.paginas}. ${m.subtitulo}.`
          : `${m.subtitulo}. Cuando llegues a la última página${siguiente.modulo === 0 ? ' podrás pedir tu reunión con Sorela.' : ' se abre su vídeo.'}`,
        boton: empezado ? 'Seguir leyendo' : 'Leer el módulo',
        hacer: () => leer(m.id, Math.max(1, m.pagina)),
      };
    }
    if (siguiente.tipo === 'cita') {
      return {
        rotulo: 'Tu siguiente paso',
        titulo: 'Pide tu reunión con Sorela',
        texto: `Has terminado el ${modulos[0].nombre}. Elige el día y la hora de tu videollamada con Sorela. Al pedirla se abre el ${modulos[1].nombre}.`,
        boton: 'Elegir día y hora',
        hacer: () => setPidiendo(true),
      };
    }
    if (siguiente.tipo === 'video') {
      const m = modulos[siguiente.modulo];
      const id = siguiente.leccion;
      return {
        rotulo: 'Tu siguiente paso',
        titulo: `Mira el vídeo del ${m.nombre}`,
        texto: `Ya has leído el módulo. ${m.videos > 1 ? `Llevas ${m.videosHechos} de ${m.videos} vídeos.` : 'Su vídeo está abierto.'} Al terminarlo se abre el siguiente módulo.`,
        boton: 'Ver el vídeo',
        hacer: () => verClase(id),
      };
    }
    return {
      rotulo: 'Módulos terminados',
      titulo: 'Ahora, tus prácticas con Sorela',
      texto: citaFutura
        ? 'Tú en tu cabina con tu modelo y Sorela guiándote en directo. Ya tienes una reunión pedida.'
        : 'Tú en tu cabina con tu modelo y Sorela guiándote en directo. Pide una reunión para cada práctica.',
      boton: citaFutura ? '' : 'Pedir una práctica',
      hacer: () => setPidiendo(true),
    };
  })();

  return (
    <section className={r.marco} aria-label="Tu camino en la academia">
      {muestra && (
        <p className={r.aviso}>
          Vista de prueba: así lo ve una alumna de la academia online. Lo que leas y la reunión que pidas aquí no se guardan.
        </p>
      )}
      <ol className={r.camino}>
        {modulos.map((m, i) => {
          const estado = m.completo ? 'hecho' : m.abierto ? 'abierto' : 'cerrado';
          const total = m.paginas + m.videos * 10;
          const llevo = (m.abierto ? Math.min(m.pagina, m.paginas) : 0) + m.videosHechos * 10;
          return (
            <li key={m.id} className={r.modulo} data-estado={estado}>
              <button type="button" className={r.moduloBoton} disabled={!m.abierto} onClick={() => leer(m.id, Math.max(1, m.pagina))}>
                <span className={r.numero}>{m.completo ? <Visto /> : m.abierto ? String(i + 1).padStart(2, '0') : <Candado />}</span>
                <span className={r.moduloTexto}>
                  <strong>{m.nombre.replace(/^Módulo \d+ · /, '')}</strong>
                  <small>{m.completo ? 'Terminado' : m.abierto ? (m.leido ? 'Falta el vídeo' : m.pagina > 1 ? `Página ${m.pagina} de ${m.paginas}` : 'Abierto') : i === 1 && modulos[0].completo ? 'Pide tu reunión' : 'Con candado'}</small>
                </span>
              </button>
              <span className={r.barra}>
                <span style={{ width: `${m.completo ? 100 : Math.round((llevo / total) * 100)}%` }} />
              </span>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${siguiente.tipo}-${'modulo' in siguiente ? siguiente.modulo : 'fin'}`}
          className={r.paso}
          initial={quieto ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={quieto ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={r.pulso} aria-hidden="true" />
          <div className={r.pasoTexto}>
            <span className={r.rotulo}>{paso.rotulo}</span>
            <h3 className={r.titulo}>{paso.titulo}</h3>
            <p className={r.texto}>{paso.texto}</p>
            {citaFutura && (
              <p className={r.citaPuesta}>
                Tu reunión con Sorela: <strong>{DIA.format(new Date(citaFutura.cuando))}</strong> a las {HORA.format(new Date(citaFutura.cuando))} (tu hora). Está en tu agenda.
              </p>
            )}
          </div>
          {paso.boton && (
            <button type="button" className={r.boton} onClick={paso.hacer}>
              {paso.boton}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {pidiendo && (
        <PedirCita
          muestra={muestra?.pedirCita}
          cerrar={() => setPidiendo(false)}
          hecha={() => {
            setPidiendo(false);
            recargar();
          }}
        />
      )}

      {fiesta &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={r.fondo} role="dialog" aria-modal="true" aria-label={fiesta.titulo} onClick={() => setFiesta(null)}>
            <motion.div
              className={r.fiesta}
              onClick={(e) => e.stopPropagation()}
              initial={quieto ? false : { opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              <span className={r.sello} aria-hidden="true">
                <span className={r.onda} />
                <span className={r.onda} />
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={quieto ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.5 }} />
                </svg>
              </span>
              <h3 className={r.fiestaTitulo}>{fiesta.titulo}</h3>
              <p className={r.fiestaTexto}>{fiesta.texto}</p>
              <button
                type="button"
                className={r.boton}
                onClick={() => {
                  setFiesta(null);
                  paso.hacer();
                }}
              >
                {paso.boton || 'Seguir'}
              </button>
              <button type="button" className={r.luego} onClick={() => setFiesta(null)}>
                Ahora no
              </button>
            </motion.div>
          </div>,
          document.body
        )}
    </section>
  );
}

/* ==========================================================================
   Pedir la reunión: primero el día, luego la hora, y confirmar.
   ========================================================================== */

function PedirCita({ cerrar, hecha, muestra }: { cerrar: () => void; hecha: () => void; muestra?: (cuando: string) => void }) {
  const [libres, setLibres] = useState<string[] | null>(null);
  const [minutos, setMinutos] = useState(60);
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const cargar = () =>
    fetch('/api/citas')
      .then((x) => x.json())
      .then((j) => {
        if (!j.ok) throw new Error();
        setLibres(j.libres ?? []);
        setMinutos(j.minutos ?? 60);
      })
      .catch(() => {
        setLibres([]);
        setFallo('No he podido cargar las horas libres. Prueba otra vez en un momento.');
      });

  useEffect(() => {
    cargar();
    const f = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Los huecos por día, en la hora de quien mira. */
  const dias = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const h of libres ?? []) m.set(claveDia(h), [...(m.get(claveDia(h)) ?? []), h]);
    return [...m.entries()].slice(0, 12);
  }, [libres]);
  const horas = dias.find(([k]) => k === dia)?.[1] ?? [];

  async function pedir() {
    if (!hora) return;
    if (muestra) {
      muestra(hora);
      return hecha();
    }
    setEnviando(true);
    setFallo(null);
    try {
      const j = await (await fetch('/api/citas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cuando: hora }) })).json();
      if (j.ok) return hecha();
      if (j.motivo === 'ocupado') {
        setFallo('Esa hora la acaban de coger. Elige otra.');
        setHora(null);
        cargar();
      } else if (j.motivo === 'ya-tienes') {
        setFallo('Ya tienes una reunión pedida. Para cambiarla, escribe a Sorela.');
      } else setFallo('No se ha podido pedir. Prueba otra vez.');
    } catch {
      setFallo('No hay conexión. Prueba otra vez.');
    } finally {
      setEnviando(false);
    }
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={r.fondo} role="dialog" aria-modal="true" aria-labelledby="cita-titulo" onClick={cerrar}>
      <motion.div className={r.hoja} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
        <button type="button" className={r.cerrar} onClick={cerrar} aria-label="Cerrar">
          ×
        </button>
        <span className={r.rotuloOscuro}>Videollamada · {minutos} minutos</span>
        <h3 id="cita-titulo" className={r.hojaTitulo}>
          Tu reunión con <strong>Sorela</strong>
        </h3>
        <p className={r.hojaTexto}>Elige el día y después la hora. Las horas salen en la hora de tu país.</p>

        {libres === null ? (
          <p className={r.hojaTexto}>Buscando horas libres…</p>
        ) : dias.length === 0 ? (
          !fallo && <p className={r.hojaTexto}>Ahora mismo no quedan horas libres. Escribe a Sorela y te busca un hueco.</p>
        ) : (
          <>
            <h4 className={r.paso1}>1 · El día</h4>
            <div className={r.dias}>
              {dias.map(([k, hs]) => (
                <button
                  key={k}
                  type="button"
                  className={r.dia}
                  data-activo={dia === k ? '' : undefined}
                  onClick={() => {
                    setDia(k);
                    setHora(null);
                  }}
                >
                  {DIA_CORTO.format(new Date(hs[0]))}
                </button>
              ))}
            </div>
            {dia && (
              <>
                <h4 className={r.paso1}>2 · La hora</h4>
                <div className={r.horas}>
                  {horas.map((h) => (
                    <button key={h} type="button" className={r.hora} data-activo={hora === h ? '' : undefined} onClick={() => setHora(h)}>
                      {HORA.format(new Date(h))}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {hora && (
          <p className={r.resumen}>
            <strong>{DIA.format(new Date(hora))}</strong>, a las <strong>{HORA.format(new Date(hora))}</strong> (tu hora) · {horaColombia(hora)} en Colombia
          </p>
        )}
        {fallo && (
          <p className={r.fallo} role="alert">
            {fallo}
          </p>
        )}
        <button type="button" className={r.boton} disabled={!hora || enviando} onClick={pedir}>
          {enviando ? 'Pidiendo…' : 'Pedir esta reunión'}
        </button>
      </motion.div>
    </div>,
    document.body
  );
}
