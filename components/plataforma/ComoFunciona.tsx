'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import {
  FORMAS_DE_SUMAR,
  NIVELES,
  PUNTOS,
  SUMAN_AL_MES,
  formatoPuntos,
  type FuentePuntos,
  type ResumenPuntos,
} from '@/lib/puntos-tipos';
import {
  ESCALONES,
  LOGROS,
  OROS_PARA_DIVINE,
  PODIO_MINIMO,
  VITRINAS,
  textoFalta,
  vitrinas,
  type EstadoLogro,
  type IdVitrina,
} from '@/lib/logros-tipos';
import { irA } from '@/lib/navegar';
import { BarraNivel, useResumenPuntos, useTrofeos } from './Puntos';
import { VITRINAS_DE_LA_COMUNIDAD } from './Logros';
import { ICONO_FUENTE, Icono, InsigniaNivel, Medalla, Trofeo } from './IconosDivine';
import c from './comofunciona.module.css';

/**
 * «Cómo funciona»: la gamificación explicada en pocos pasos que se deslizan.
 *
 *   1 · Haz cosas → ganas puntos: la tabla de verdad (FORMAS_DE_SUMAR), con
 *       su icono y lo que ya está sumando.
 *   2 · Subes de nivel: los seis niveles con su insignia; se toca uno y dice
 *       desde cuántos puntos se entra y cuánto le falta.
 *   3 · Trofeos: bronce, plata y oro, las vitrinas (se toca una y enseña sus
 *       escalones y lo que falta) y el trofeo Divine. (Las «insignias» son las
 *       de cada nivel, del paso 2: no se mezclan los nombres.)
 *   4 · El ranking del mes, solo con la membresía.
 *
 * Todas las cifras salen de lib/puntos-tipos.ts y lib/logros-tipos.ts: si un
 * día cambia un valor, aquí cambia solo. Lo personal (sus puntos, su nivel,
 * sus trofeos) llega de los mismos avisos que el marcador (`divine:puntos`,
 * `divine:trofeos`); sin ellos (Sorela mirando «Ver como»), se explica igual,
 * sin el «estás aquí».
 *
 * Quien solo tiene el curso no ve nada de dentro de la Comunidad: ni sus
 * formas de sumar, ni sus vitrinas, ni el ranking. Solo un «Próximamente».
 *
 * Se monta una vez (Plataforma.tsx) y se abre con el evento
 * `divine:como-funciona` (abrirComoFunciona, en Puntos.tsx): desde «¿Cómo
 * funciona?» del inicio, del marcador de puntos y de los trofeos del perfil.
 * Es un diálogo de verdad: el foco entra en el título de cada paso, no se
 * escapa con el tabulador, Escape cierra, las flechas pasan de paso y al
 * cerrar vuelve a donde estaba. Con «reducir movimiento», nada se desliza.
 */

type IdPaso = 'puntos' | 'niveles' | 'trofeos' | 'ranking';

/** Si ya la ha abierto alguna vez (solo para quitar el «Nuevo» del botón del inicio). */
export const CLAVE_VISTO = 'divine:como-funciona-visto';

/** Las formas de sumar que son de la Comunidad (y sus vitrinas, en Logros.tsx): quien no la tiene no las ve. */
const DE_LA_COMUNIDAD: readonly FuentePuntos[] = ['publicaciones', 'respuestas', 'meGusta'];

const NOMBRE_PASO: Record<IdPaso, string> = {
  puntos: 'Haz cosas, ganas puntos',
  niveles: 'Subes de nivel',
  trofeos: 'Trofeos',
  ranking: 'El ranking del mes',
};

const CABECERA: Record<IdPaso, { titulo: string; texto: string }> = {
  puntos: {
    titulo: 'Todo lo que haces aquí suma',
    texto: 'No hay que apuntar nada: los puntos salen solos de lo que haces. Y si algo se borra, sus puntos se van con ello.',
  },
  niveles: {
    titulo: 'Seis niveles, una insignia en cada uno',
    texto: 'Con los puntos vas subiendo. Cada nivel tiene su insignia, que se ve en tu marcador y en tu perfil. Toca uno para verlo.',
  },
  trofeos: {
    titulo: 'Trofeos de bronce, plata y oro',
    texto: `Cada cosa que haces tiene su vitrina, y cada vitrina sube de bronce a plata y a oro. Cada trofeo suma +${PUNTOS.logro} puntos. Toca una vitrina para ver qué pide.`,
  },
  ranking: {
    titulo: 'Cada mes, un podio nuevo',
    texto: 'Lo que haces durante el mes suma también al ranking de la comunidad. El día 1 empieza de cero: siempre hay sitio arriba.',
  },
};

const EASE = [0.22, 1, 0.36, 1] as const;

/* Cada paso entra por el lado hacia el que se va y sale por el contrario. */
const VARIANTES = {
  entra: (d: number) => ({ x: d * 44, opacity: 0 }),
  centro: { x: 0, opacity: 1 },
  sale: (d: number) => ({ x: d * -44, opacity: 0 }),
};

const pasosDe = (miembro: boolean): IdPaso[] =>
  miembro ? ['puntos', 'niveles', 'trofeos', 'ranking'] : ['puntos', 'niveles', 'trofeos'];

export default function ComoFunciona({ miembro }: { miembro: boolean }) {
  const [montado, setMontado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [inicio, setInicio] = useState(0);
  const volverA = useRef<HTMLElement | null>(null);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    const alPedir = (e: Event) => {
      // Con la bienvenida o el recorrido abiertos, no se abre encima.
      if (document.body.hasAttribute('data-onboarding')) return;
      const pedido = (e as CustomEvent<{ paso?: unknown } | null>).detail?.paso;
      const k = pasosDe(miembro).indexOf(pedido as IdPaso);
      const a = document.activeElement;
      volverA.current = a instanceof HTMLElement && a !== document.body ? a : null;
      setInicio(k >= 0 ? k : 0);
      setAbierto(true);
      try {
        window.localStorage.setItem(CLAVE_VISTO, '1');
      } catch {
        /* sin almacenamiento: el «Nuevo» volverá a salir, nada más */
      }
    };
    window.addEventListener('divine:como-funciona', alPedir);
    return () => window.removeEventListener('divine:como-funciona', alPedir);
  }, [miembro]);

  const cerrar = useCallback(() => setAbierto(false), []);

  /* Mientras está abierta, el fondo quieto. Al cerrarse, el foco vuelve a
     donde estaba (el botón que la abrió, o el marcador de puntos). */
  useEffect(() => {
    if (!abierto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Si se va a otra pantalla (atrás del navegador), se cierra.
    window.addEventListener('popstate', cerrar);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('popstate', cerrar);
      const v = volverA.current;
      volverA.current = null;
      if (v?.isConnected) v.focus({ preventScroll: true });
    };
  }, [abierto, cerrar]);

  if (!montado) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{abierto && <Ventana key="como-funciona" miembro={miembro} inicio={inicio} cerrar={cerrar} />}</AnimatePresence>
    </MotionConfig>,
    document.body
  );
}

/* La ventana va aparte para que sus datos (puntos y trofeos) solo se
   escuchen mientras está abierta. */
function Ventana({ miembro, inicio, cerrar }: { miembro: boolean; inicio: number; cerrar: () => void }) {
  const pasos = pasosDe(miembro);
  const n = pasos.length;
  const [i, setI] = useState(Math.min(inicio, n - 1));
  const [dir, setDir] = useState(1);
  const reducir = useReducedMotion();
  const resumen = useResumenPuntos();
  const trofeos = useTrofeos();
  const ventana = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const paso = pasos[i];

  const irPaso = useCallback(
    (k: number) => {
      if (k < 0 || k >= n || k === i) return;
      setDir(k > i ? 1 : -1);
      setI(k);
    },
    [i, n]
  );

  /* El teclado llama siempre a la última versión (con el paso al día). */
  const irRef = useRef(irPaso);
  useEffect(() => {
    irRef.current = irPaso;
  });
  const iRef = useRef(i);
  useEffect(() => {
    iRef.current = i;
  });
  /* Se cierra al pulsar la capa de fuera, pero solo si el toque EMPEZÓ en
     ella: al arrastrar un paso con el ratón y soltar fuera, el navegador manda
     el «click» a la capa y se cerraba sola. */
  const empiezaFuera = useRef(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // Si sale una fiesta de la Celebración encima (o la bienvenida, o el recorrido), el teclado es suyo.
      if (e.defaultPrevented || document.querySelector('[data-celebracion]') || document.body.hasAttribute('data-onboarding')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        irRef.current(iRef.current + (e.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      if (e.key !== 'Tab') return;
      const v = ventana.current;
      if (!v) return;
      const enfocables = [...v.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')].filter((x) => x.offsetParent !== null);
      if (!enfocables.length) return;
      const primero = enfocables[0];
      const final = enfocables[enfocables.length - 1];
      if (!v.contains(document.activeElement)) {
        e.preventDefault();
        primero.focus();
      } else if (e.shiftKey && (document.activeElement === primero || document.activeElement === titulo.current)) {
        e.preventDefault();
        final.focus();
      } else if (!e.shiftKey && document.activeElement === final) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [cerrar]);

  // Cada paso empieza arriba y con el foco en su título: el lector de pantalla lo lee.
  useEffect(() => {
    cuerpo.current?.scrollTo({ top: 0 });
    const t = setTimeout(() => titulo.current?.focus({ preventScroll: true }), reducir ? 0 : 280);
    return () => clearTimeout(t);
  }, [paso, reducir]);

  /* Deslizar con el dedo (o arrastrar con el ratón): más de un dedo de
     recorrido, o un gesto rápido, pasa de paso. */
  const alSoltar = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) irPaso(i + 1);
    else if (info.offset.x > 70 || info.velocity.x > 500) irPaso(i - 1);
  };

  const verRanking = () => {
    cerrar();
    irA('comunidad', { ver: 'ranking' });
  };

  return (
    <motion.div
      className={c.capa}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onPointerDown={(e) => {
        empiezaFuera.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && empiezaFuera.current) cerrar();
      }}
    >
      <motion.div
        ref={ventana}
        className={c.ventana}
        role="dialog"
        aria-modal="true"
        aria-label="Cómo funciona"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
      >
        <header className={c.cabecera}>
          <p className={c.rotulo}>
            Cómo funciona
            <span className={c.cuenta}>
              {i + 1} de {n}
            </span>
          </p>
          <button type="button" className={c.cerrar} onClick={cerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* La barra fina de arriba: cuánto queda de explicación. */}
        <div className={c.avance} aria-hidden="true">
          <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: (i + 1) / n }} transition={{ duration: 0.45, ease: EASE }} />
        </div>

        <div ref={cuerpo} className={c.cuerpo}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={paso}
              className={c.paso}
              custom={dir}
              variants={VARIANTES}
              initial="entra"
              animate="centro"
              exit="sale"
              transition={{ duration: 0.26, ease: EASE }}
              drag={reducir ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={alSoltar}
            >
              <p className={c.pasoRotulo}>
                Paso {i + 1} · {NOMBRE_PASO[paso]}
              </p>
              <h2 ref={titulo} tabIndex={-1} className={c.titulo}>
                {CABECERA[paso].titulo}
              </h2>
              <p className={c.texto}>{CABECERA[paso].texto}</p>
              {paso === 'puntos' && <PasoPuntos miembro={miembro} resumen={resumen} />}
              {paso === 'niveles' && <PasoNiveles resumen={resumen} />}
              {paso === 'trofeos' && <PasoTrofeos miembro={miembro} trofeos={trofeos} />}
              {paso === 'ranking' && <PasoRanking verRanking={verRanking} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className={c.pie}>
          <div className={c.puntos} role="group" aria-label="Pasos">
            {pasos.map((x, k) => (
              <button
                key={x}
                type="button"
                className={c.puntoPaso}
                aria-label={`Paso ${k + 1}: ${NOMBRE_PASO[x]}`}
                aria-current={k === i ? 'step' : undefined}
                onClick={() => irPaso(k)}
              />
            ))}
          </div>
          <div className={c.botones}>
            {i > 0 && (
              <button type="button" className={c.atras} onClick={() => irPaso(i - 1)}>
                Atrás
              </button>
            )}
            {i < n - 1 ? (
              <button type="button" className={c.siguiente} onClick={() => irPaso(i + 1)}>
                Siguiente
              </button>
            ) : (
              <button type="button" className={c.siguiente} data-oro="" onClick={cerrar}>
                ¡Entendido!
              </button>
            )}
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

/* ==========================================================================
   Los pasos
   ========================================================================== */

/** Un visto pequeño, de trazo fino. */
function Visto() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

/* ---------- 1 · Haz cosas, ganas puntos ---------- */

function PasoPuntos({ miembro, resumen }: { miembro: boolean; resumen: ResumenPuntos | null }) {
  const formas = FORMAS_DE_SUMAR.filter((f) => miembro || !DE_LA_COMUNIDAD.includes(f.fuente));
  return (
    <>
      {resumen && (
        <p className={c.llevas}>
          <InsigniaNivel n={resumen.nivel.n} size={30} />
          <span>
            Llevas <b>{formatoPuntos(resumen.total)}</b> puntos · nivel {resumen.nivel.n}, {resumen.nivel.nombre}
          </span>
        </p>
      )}
      <ul className={c.formas}>
        {formas.map((f, k) => {
          const ya = (resumen?.desglose[f.fuente] ?? 0) > 0;
          return (
            <motion.li
              key={f.fuente}
              data-ya={ya ? '' : undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + k * 0.035, duration: 0.3, ease: EASE }}
            >
              <span className={c.formaIcono} aria-hidden="true">
                <Icono nombre={ICONO_FUENTE[f.fuente]} size={18} />
              </span>
              <span className={c.formaTexto}>
                {f.texto}
                {ya && (
                  <em className={c.ya}>
                    <Visto />
                    Ya lo sumas
                  </em>
                )}
              </span>
              <b className={c.formaPuntos}>+{formatoPuntos(f.puntos)}</b>
            </motion.li>
          );
        })}
      </ul>
      {/* Sin membresía, de la Comunidad solo se dice que llega. */}
      {!miembro && (
        <p className={c.proximamente}>
          <span>Comunidad Divine</span>
          Próximamente
        </p>
      )}
    </>
  );
}

/* ---------- 2 · Subes de nivel ---------- */

function PasoNiveles({ resumen }: { resumen: ResumenPuntos | null }) {
  const actual = resumen ? resumen.nivel.n : null;
  const [sel, setSel] = useState(actual ?? 1);
  const nv = NIVELES.find((x) => x.n === sel) ?? NIVELES[0];
  // La línea dorada llega hasta su nivel (sin datos, se queda en el primero).
  const avance = actual ? (actual - 1 + (resumen?.nivel.siguiente ? resumen.nivel.progreso : 0)) / (NIVELES.length - 1) : 0;
  const estadoDe = (n: number) => (actual === null ? 'neutro' : n < actual ? 'hecho' : n === actual ? 'actual' : 'falta');
  const frase =
    actual === null || !resumen
      ? ''
      : nv.n < actual
        ? 'Ya lo has superado.'
        : nv.n === actual
          ? resumen.nivel.siguiente
            ? `Estás aquí. Te faltan ${formatoPuntos(resumen.nivel.falta)} pts para ${resumen.nivel.siguiente.nombre}.`
            : 'Estás aquí: el más alto.'
          : `Te faltan ${formatoPuntos(nv.desde - resumen.total)} pts.`;

  return (
    <>
      <div className={c.niveles}>
        <span className={c.nivelesLinea} aria-hidden="true">
          <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, avance) }} transition={{ duration: 0.9, delay: 0.15, ease: EASE }} />
        </span>
        <div className={c.nivelesFila} role="group" aria-label="Los seis niveles">
          {NIVELES.map((x, k) => {
            const estado = estadoDe(x.n);
            return (
              <motion.button
                key={x.n}
                type="button"
                className={c.nivelBoton}
                data-estado={estado}
                aria-pressed={sel === x.n}
                onClick={() => setSel(x.n)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + k * 0.06, duration: 0.3, ease: EASE }}
              >
                <span className={c.nivelInsignia}>
                  <InsigniaNivel n={x.n} size={44} apagada={estado === 'falta'} />
                </span>
                <span className={c.nivelDesde} aria-hidden="true">
                  {estado === 'actual' ? 'Tú' : formatoPuntos(x.desde)}
                </span>
                <span className={c.oculto}>
                  Nivel {x.n}, {x.nombre}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Lo que dice del nivel tocado: el contenedor se queda, así el lector lo anuncia al cambiar. */}
      <div className={c.fichaCaja} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={nv.n}
            className={c.nivelFicha}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <InsigniaNivel n={nv.n} size={64} apagada={actual !== null && nv.n > actual} />
            <div>
              <p className={c.nivelNumero}>Nivel {nv.n}</p>
              <h3 className={c.nivelNombre}>{nv.nombre}</h3>
              <p className={c.nivelTexto}>
                {nv.desde === 0 ? 'Donde empieza todo.' : `Desde ${formatoPuntos(nv.desde)} puntos.`} {frase}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {resumen && (
        <div className={c.barra}>
          <BarraNivel total={resumen.total} tamano="grande" />
        </div>
      )}
    </>
  );
}

/* ---------- 3 · Trofeos ---------- */

function PasoTrofeos({ miembro, trofeos }: { miembro: boolean; trofeos: EstadoLogro[] | null }) {
  const estados = trofeos ? vitrinas(trofeos) : null;
  const lista = VITRINAS.filter((v) => v.id !== 'divine' && (miembro || !VITRINAS_DE_LA_COMUNIDAD.includes(v.id)));
  const [sel, setSel] = useState<IdVitrina>(lista[0].id);
  const v = lista.find((x) => x.id === sel) ?? lista[0];
  const est = estados?.find((x) => x.id === v.id) ?? null;
  const escalones = LOGROS.filter((l) => l.vitrina === v.id);
  const oros = trofeos ? trofeos.filter((t) => t.escalon === 'oro' && t.conseguido).length : null;
  const divine = Boolean(trofeos?.find((t) => t.vitrina === 'divine')?.conseguido);

  return (
    <>
      {/* Los tres metales, de menos a más. */}
      <div className={c.metales} aria-hidden="true">
        {(['bronce', 'plata', 'oro'] as const).map((e, k) => (
          <motion.span
            key={e}
            className={c.metal}
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1 + k * 0.12, type: 'spring', stiffness: 300, damping: 18 }}
          >
            <Trofeo escalon={e} glifo="clase" size={46} />
            <em>{ESCALONES[e]}</em>
          </motion.span>
        ))}
      </div>

      <div className={c.vitrinas} role="group" aria-label="Las vitrinas">
        {lista.map((x) => {
          const e = estados?.find((y) => y.id === x.id);
          const escalon = e?.actual?.escalon ?? LOGROS.find((l) => l.vitrina === x.id)?.escalon ?? 'bronce';
          return (
            <button
              key={x.id}
              type="button"
              className={c.vitrina}
              aria-pressed={sel === x.id}
              data-hecho={e?.actual ? '' : undefined}
              onClick={() => setSel(x.id)}
            >
              <Trofeo escalon={escalon} glifo={x.glifo} size={40} apagado={!e?.actual} />
              <span>{x.nombre}</span>
            </button>
          );
        })}
      </div>

      <div className={c.fichaCaja} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={v.id}
            className={c.vitrinaFicha}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <p className={c.vitrinaTexto}>
              <strong>{v.nombre}</strong> · {v.texto}
            </p>
            <ol className={c.escalones}>
              {escalones.map((l) => {
                const e = est?.escalones.find((y) => y.id === l.id);
                return (
                  <li key={l.id} data-hecho={e?.conseguido ? '' : undefined}>
                    <Trofeo escalon={l.escalon} glifo={v.glifo} size={32} apagado={!e?.conseguido} />
                    <span className={c.escalonTexto}>
                      <strong>
                        {l.nombre} <small>{ESCALONES[l.escalon]}</small>
                      </strong>
                      <em>{l.texto}</em>
                    </span>
                    <b className={c.escalonEstado}>
                      {e?.conseguido ? (
                        <>
                          <Visto />
                          Tuyo
                        </>
                      ) : e ? (
                        textoFalta(e)
                      ) : (
                        `+${PUNTOS.logro} pts`
                      )}
                    </b>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        </AnimatePresence>
      </div>

      <p className={c.divine}>
        <Trofeo escalon="divine" glifo="divine" size={44} apagado={!divine} />
        <span>
          Con {OROS_PARA_DIVINE} oros llega el <strong>Trofeo Divine</strong>, el más especial.
          {divine ? ' Ya es tuyo.' : oros !== null ? ` Llevas ${Math.min(oros, OROS_PARA_DIVINE)} de ${OROS_PARA_DIVINE}.` : ''}
        </span>
      </p>
    </>
  );
}

/* ---------- 4 · El ranking del mes (solo con la membresía) ---------- */

const RETRASO_PEANA: Record<1 | 2 | 3, number> = { 1: 0.2, 2: 0.1, 3: 0 };
const NOMBRE_PODIO = LOGROS.find((l) => l.id === 'podio')?.nombre ?? 'En el podio';

function PasoRanking({ verRanking }: { verRanking: () => void }) {
  const filas = SUMAN_AL_MES.flatMap((f) => FORMAS_DE_SUMAR.filter((x) => x.fuente === f));
  return (
    <>
      {/* Un podio de muestra, sin nombres: los de verdad están en el ranking. */}
      <div className={c.podio} aria-hidden="true">
        {([2, 1, 3] as const).map((puesto) => (
          <div key={puesto} className={c.podioCol} data-puesto={puesto}>
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + RETRASO_PEANA[puesto], type: 'spring', stiffness: 320, damping: 16 }}
            >
              <Medalla puesto={puesto} size={puesto === 1 ? 46 : 38} />
            </motion.span>
            <motion.span
              className={c.peana}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.1 + RETRASO_PEANA[puesto], duration: 0.5, ease: EASE }}
            />
          </div>
        ))}
      </div>

      <p className={c.subrotulo}>Suma al ranking del mes</p>
      <ul className={c.formas}>
        {filas.map((f) => (
          <li key={f.fuente}>
            <span className={c.formaIcono} aria-hidden="true">
              <Icono nombre={ICONO_FUENTE[f.fuente]} size={18} />
            </span>
            <span className={c.formaTexto}>{f.texto}</span>
            <b className={c.formaPuntos}>+{formatoPuntos(f.puntos)}</b>
          </li>
        ))}
      </ul>

      <p className={c.nota}>
        Si cierras un mes entre las 3 primeras, con al menos {PODIO_MINIMO} compañeras sumando, ganas el trofeo «{NOMBRE_PODIO}», de oro.
      </p>
      <button type="button" className={c.verRanking} onClick={verRanking}>
        Ver el ranking del mes
        <span aria-hidden="true">→</span>
      </button>
    </>
  );
}
