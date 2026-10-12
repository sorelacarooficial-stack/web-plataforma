'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from 'framer-motion';
import {
  ETIQUETA_FUENTE,
  FUENTES,
  NIVELES,
  PUNTOS,
  formatoPuntos,
  nivelDe,
  type EstadoNivel,
  type FuentePuntos,
  type ResumenPuntos,
} from '@/lib/puntos-tipos';
import { irA } from '@/lib/navegar';
import s from './puntos.module.css';

/**
 * Los puntos, en la pantalla.
 *
 * Aquí no se calcula nada que valga: los puntos los decide el servidor
 * (`/api/logros`) y llegan con el evento `divine:puntos`, que lanza la
 * Celebración cada vez que algo cambia. Esto solo los enseña, y los enseña
 * con ganas: números que cuentan hacia arriba, una barra dorada que se llena
 * con muelle, un «+N» que sube y se desvanece. Dopamina, pero con clase: oro
 * sobre negro, la Cormorant para los nombres y la Jost para las cifras.
 */

/* ==========================================================================
   El último resumen, guardado en el módulo
   ========================================================================== */

/* Se guarda fuera de React a propósito: el marcador de la cabecera, el panel
   de inicio y el perfil leen el mismo resumen sin pedirlo tres veces, y quien
   se monta tarde (al cambiar de pantalla) lo tiene al momento. */
let ultimo: ResumenPuntos | null = null;
const oyentes = new Set<() => void>();

function publicar(r: ResumenPuntos) {
  ultimo = r;
  oyentes.forEach((f) => f());
}

function alLlegarPuntos(e: Event) {
  const d = (e as CustomEvent<ResumenPuntos>).detail;
  if (d && typeof d.total === 'number' && d.nivel) publicar(d);
}

// Se escucha desde que se carga el módulo, no desde que se monta alguien: así
// no se pierde el primer aviso aunque llegue antes que el componente.
if (typeof window !== 'undefined') window.addEventListener('divine:puntos', alLlegarPuntos);

/* Respaldo: si en unos segundos nadie ha avisado (Sorela mirando «Ver como»,
   donde no hay Celebración), se piden una vez sin marcar nada como visto. */
let respaldoPedido = false;
function pedirRespaldo() {
  if (respaldoPedido || ultimo) return;
  respaldoPedido = true;
  window.setTimeout(() => {
    if (ultimo || document.body.hasAttribute('data-onboarding')) return;
    fetch('/api/logros')
      .then((r) => r.json())
      .then((j) => {
        if (!ultimo && j?.ok && j.puntos) publicar(j.puntos as ResumenPuntos);
      })
      .catch(() => {
        /* sin red: ya llegará con el próximo aviso */
      });
  }, 4000);
}

function suscribir(f: () => void) {
  oyentes.add(f);
  pedirRespaldo();
  return () => {
    oyentes.delete(f);
  };
}

/** El último resumen de puntos que ha llegado, o null mientras no llega ninguno. */
export function useResumenPuntos(): ResumenPuntos | null {
  return useSyncExternalStore(
    suscribir,
    () => ultimo,
    () => null
  );
}

/* ==========================================================================
   Piezas
   ========================================================================== */

const EASE_SALIDA = [0.16, 1, 0.3, 1] as const;

/** Una cifra de puntos que cuenta hacia arriba (o hacia abajo) hasta `valor`. */
export function ContadorPuntos({ valor, desde, className }: { valor: number; desde?: number; className?: string }) {
  const reducir = useReducedMotion();
  const mv = useMotionValue(desde ?? valor);
  const texto = useTransform(mv, (v) => formatoPuntos(Math.round(v)));

  useEffect(() => {
    const origen = mv.get();
    if (reducir || origen === valor) {
      mv.set(valor);
      return;
    }
    // Cuanto más hay que contar, algo más dura; nunca tanto como para aburrir.
    const ctrl = animate(mv, valor, {
      duration: Math.min(1.8, 0.6 + Math.abs(valor - origen) / 500),
      ease: EASE_SALIDA,
    });
    return () => ctrl.stop();
  }, [valor, reducir, mv]);

  return (
    <span className={`${s.cifra} ${className ?? ''}`}>
      <motion.span aria-hidden="true">{texto}</motion.span>
      <span className={s.soloLector}>{formatoPuntos(valor)}</span>
    </span>
  );
}

/** La moneda dorada con el número de nivel. */
function Insignia({ n, grande }: { n: number; grande?: boolean }) {
  return (
    <span className={s.insignia} data-grande={grande ? '' : undefined} data-n={n} aria-hidden="true">
      {n}
    </span>
  );
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const siguienteNivel = (e: EstadoNivel) => nivelDe(NIVELES.find((x) => x.n === e.n + 1)?.desde ?? e.desde);

/**
 * La barra del nivel. Se llena con muelle desde `desde` (o desde el principio
 * del nivel, si no se dice). Si por el camino se cruza un nivel, llega al 100 %,
 * destella, y vuelve a llenarse en el nivel nuevo.
 */
export function BarraNivel({
  total,
  desde,
  tamano = 'compacta',
  conTexto = true,
}: {
  total: number;
  desde?: number;
  tamano?: 'compacta' | 'grande';
  conTexto?: boolean;
}) {
  const reducir = useReducedMotion();
  const final = nivelDe(total);
  // Lo que se ve al montar: el punto de partida de la animación.
  const [visto, setVisto] = useState<EstadoNivel>(() =>
    desde != null && desde < total ? nivelDe(desde) : { ...final, progreso: 0 }
  );
  const vistoRef = useRef(visto);
  const progreso = useMotionValue(visto.progreso);
  // El muelle puede pasarse un pelo de 1: la barra no se sale nunca.
  const ancho = useTransform(progreso, (v) => `${Math.max(0, Math.min(1, v)) * 100}%`);
  const [destello, setDestello] = useState(0);

  const verNivel = (e: EstadoNivel) => {
    vistoRef.current = e;
    setVisto(e);
  };

  useEffect(() => {
    const fin = nivelDe(total);
    if (reducir) {
      verNivel(fin);
      progreso.set(fin.progreso);
      return;
    }
    let vivo = true;
    let ctrl: AnimationPlaybackControls | null = null;
    (async () => {
      // Se parte de lo que hay en pantalla ahora, no del valor anterior: si
      // llega otro total a mitad de animación, sigue desde donde iba.
      let n = vistoRef.current;
      if (n.n > fin.n) {
        // Ha bajado de nivel (se borró algo): sin fiesta, se recoloca.
        verNivel(fin);
        progreso.set(1);
        n = fin;
      }
      while (n.n < fin.n) {
        ctrl = animate(progreso, 1, { duration: 0.75, ease: [0.45, 0, 0.2, 1] });
        await ctrl.finished;
        if (!vivo) return;
        setDestello((d) => d + 1);
        await esperar(260);
        if (!vivo) return;
        n = siguienteNivel(n);
        progreso.set(0);
        verNivel(n);
        await esperar(180);
        if (!vivo) return;
      }
      verNivel(fin);
      ctrl = animate(progreso, fin.progreso, { type: 'spring', stiffness: 70, damping: 15, mass: 1, restDelta: 0.0005 });
    })();
    return () => {
      vivo = false;
      ctrl?.stop();
    };
  }, [total, reducir, progreso]);

  const subiendo = visto.n < final.n;
  const max = final.siguiente === null;
  const textoValor = max
    ? `Nivel ${final.n}, ${final.nombre}: el más alto, con ${formatoPuntos(total)} puntos`
    : `Nivel ${final.n}, ${final.nombre}: ${formatoPuntos(total)} de ${formatoPuntos(final.siguiente!.desde)} puntos`;

  return (
    <div className={s.barraNivel} data-tamano={tamano}>
      {conTexto && (
        <div className={s.filaNivel}>
          <span className={s.nivelNombre}>
            <span className={s.nivelNumero}>Nivel {visto.n}</span>
            <span className={s.punto} aria-hidden="true">
              ·
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={visto.n}
                className={s.nivelTitulo}
                initial={reducir ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducir ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                {visto.nombre}
              </motion.span>
            </AnimatePresence>
          </span>
          {!max && (
            <span className={s.nivelCifras}>
              {formatoPuntos(total)} / {formatoPuntos(final.siguiente!.desde)}
            </span>
          )}
        </div>
      )}
      <div
        className={s.pista}
        role="progressbar"
        aria-label="Progreso de nivel"
        aria-valuemin={final.desde}
        aria-valuemax={final.siguiente?.desde ?? total}
        aria-valuenow={total}
        aria-valuetext={textoValor}
      >
        <motion.span className={s.relleno} style={{ width: ancho }}>
          <span className={s.punta} aria-hidden="true" />
        </motion.span>
        <AnimatePresence>
          {destello > 0 && (
            <motion.span
              key={destello}
              className={s.destello}
              aria-hidden="true"
              initial={{ opacity: 0.95, scaleY: 1 }}
              animate={{ opacity: 0, scaleY: 2.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      </div>
      {conTexto && (
        <p className={s.falta} aria-live="polite">
          {subiendo ? (
            <span className={s.subes}>¡Subes de nivel!</span>
          ) : max ? (
            <>Has llegado al nivel más alto. Eres referencia para las demás.</>
          ) : (
            <>
              Te faltan <b>{formatoPuntos(final.falta)} pts</b> para <b>{final.siguiente!.nombre}</b>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/* ---------- De dónde vienen los puntos ---------- */

const plural = (n: number, uno: string, varios: string) => `${formatoPuntos(n)} ${n === 1 ? uno : varios}`;

/** Una línea pequeña que explica de dónde sale cada cifra («7 clases»). */
function detalle(f: FuentePuntos, v: number): string {
  switch (f) {
    case 'clases':
      return plural(Math.round(v / PUNTOS.clase), 'clase', 'clases');
    case 'curso':
      return 'Toda la formación';
    case 'publicaciones':
      return plural(Math.round(v / PUNTOS.publicacion), 'publicación', 'publicaciones');
    case 'respuestas':
      return plural(Math.round(v / PUNTOS.respuesta), 'respuesta', 'respuestas');
    case 'meGusta':
      return plural(Math.round(v / PUNTOS.meGusta), 'me gusta', 'me gusta');
    case 'dias':
      return plural(Math.round(v / PUNTOS.dia), 'día', 'días');
    case 'racha':
      return v >= PUNTOS.racha7 + PUNTOS.racha30 ? '30 días seguidos' : '7 días seguidos';
    case 'logros':
      return plural(Math.round(v / PUNTOS.logro), 'logro', 'logros');
    case 'perfil':
      return 'Perfil completo';
    case 'fotos':
      return plural(Math.round(v / PUNTOS.foto), 'foto', 'fotos');
  }
}

/* Las etiquetas hablan de tú; en el perfil de otra persona, las que lo notan
   pasan a tercera. */
const ETIQUETA_AJENA: Partial<Record<FuentePuntos, string>> = { dias: 'Días que ha entrado' };

/**
 * El desglose por fuente, de más a menos, con una barrita que se llena al
 * verse. (Extra a la API de la especificación: lo usan el marcador y Logros.)
 */
export function DesglosePuntos({
  desglose,
  vacio,
  ajena = false,
}: {
  desglose: Record<FuentePuntos, number>;
  vacio?: string;
  /** Si es el de otra persona: no se le habla de tú. */
  ajena?: boolean;
}) {
  const reducir = useReducedMotion();
  const filas = FUENTES.map((f) => ({ f, v: desglose[f] ?? 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const mayor = filas[0]?.v ?? 1;

  if (filas.length === 0) {
    return <p className={s.desgloseVacio}>{vacio ?? 'Todavía no hay puntos. Cada clase, cada publicación y cada día que entras suman.'}</p>;
  }

  return (
    <ul className={s.desglose}>
      {filas.map(({ f, v }, i) => (
        <li key={f}>
          <span className={s.desgloseTexto}>
            <strong>{(ajena && ETIQUETA_AJENA[f]) || ETIQUETA_FUENTE[f]}</strong>
            <em>{detalle(f, v)}</em>
          </span>
          <span className={s.desglosePista} aria-hidden="true">
            <motion.span
              initial={{ scaleX: reducir ? v / mayor : 0 }}
              whileInView={{ scaleX: v / mayor }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: reducir ? 0 : 0.05 * i, ease: EASE_SALIDA }}
            />
          </span>
          <b className={s.desgloseValor}>+{formatoPuntos(v)}</b>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Cómo ganar más ---------- */

type Accion = {
  id: string;
  icono: 'perfil' | 'clase' | 'comunidad' | 'racha' | 'foto';
  titulo: string;
  texto: string;
  puntos: number;
  boton?: { texto: string; hacer: () => void };
  /** En lugar de botón, una etiqueta (lo que no se puede hacer ahora mismo). */
  etiqueta?: string;
};

function IconoAccion({ icono }: { icono: Accion['icono'] }) {
  const p = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const;
  switch (icono) {
    case 'perfil':
      return (
        <svg {...p}>
          <circle cx="12" cy="8.5" r="3.8" />
          <path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" strokeLinecap="round" />
        </svg>
      );
    case 'clase':
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'comunidad':
      return (
        <svg {...p}>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" strokeLinejoin="round" />
        </svg>
      );
    case 'racha':
      return (
        <svg {...p}>
          <path d="M12 3c.6 3.2 4.8 5.2 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.2 1-3.6 2.2-4.8.2 1.6 1 2.6 2 3 0-2.8-.6-5.6.6-8.2z" strokeLinejoin="round" />
        </svg>
      );
    case 'foto':
      return (
        <svg {...p}>
          <rect x="3" y="6" width="18" height="14" rx="3" />
          <circle cx="12" cy="13" r="3.6" />
          <path d="M8.5 6l1.4-2h4.2l1.4 2" strokeLinejoin="round" />
        </svg>
      );
  }
}

/**
 * Qué hacer para sumar más, con sus puntos y un botón que lleva a hacerlo.
 * Lo que ya está hecho (el perfil, el curso entero) desaparece de la lista.
 */
export function ComoGanarPuntos({ resumen }: { resumen: ResumenPuntos | null }) {
  const d = resumen?.desglose;
  const acciones: Accion[] = [];

  if (!d || d.perfil <= 0) {
    acciones.push({
      id: 'perfil',
      icono: 'perfil',
      titulo: 'Completa tu perfil',
      texto: 'Tu foto, tu ciudad y unas líneas sobre ti.',
      puntos: PUNTOS.perfil,
      boton: { texto: 'Completar', hacer: () => window.dispatchEvent(new Event('divine:onboarding')) },
    });
  }
  if (!d || d.curso <= 0) {
    acciones.push({
      id: 'clase',
      icono: 'clase',
      titulo: 'Termina tu siguiente clase',
      texto: `Y +${formatoPuntos(PUNTOS.curso)} más cuando completes la formación entera.`,
      puntos: PUNTOS.clase,
      boton: { texto: 'Ir a clase', hacer: () => irA('aula') },
    });
  }
  acciones.push({
    id: 'comunidad',
    icono: 'comunidad',
    titulo: 'Comparte en la comunidad',
    texto: `Responder a una compañera, +${PUNTOS.respuesta}. Cada me gusta que recibes, +${PUNTOS.meGusta}.`,
    puntos: PUNTOS.publicacion,
    boton: { texto: 'Publicar', hacer: () => irA('comunidad') },
  });
  if (d && d.perfil > 0 && d.fotos < PUNTOS.foto * PUNTOS.fotosMax) {
    acciones.push({
      id: 'foto',
      icono: 'foto',
      titulo: 'Sube fotos de tu trabajo',
      texto: `+${PUNTOS.foto} por foto, hasta ${PUNTOS.fotosMax}.`,
      puntos: PUNTOS.foto,
      boton: { texto: 'Subir', hacer: () => irA('perfil') },
    });
  }
  const racha = d?.racha ?? 0;
  acciones.push(
    racha <= 0
      ? {
          id: 'racha',
          icono: 'racha',
          titulo: 'Entra 7 días seguidos',
          texto: `Cada día que entras ya suma +${PUNTOS.dia}.`,
          puntos: PUNTOS.racha7,
          etiqueta: 'Vuelve mañana',
        }
      : racha < PUNTOS.racha7 + PUNTOS.racha30
        ? {
            id: 'racha',
            icono: 'racha',
            titulo: 'Llega a 30 días seguidos',
            texto: `Cada día que entras ya suma +${PUNTOS.dia}.`,
            puntos: PUNTOS.racha30,
            etiqueta: 'Vuelve mañana',
          }
        : {
            id: 'racha',
            icono: 'racha',
            titulo: 'Entra cada día',
            texto: 'Tu constancia ya tiene sus dos premios. Cada día sigue sumando.',
            puntos: PUNTOS.dia,
            etiqueta: 'Vuelve mañana',
          }
  );

  return (
    <div className={s.ganar}>
      <p className={s.rotulo}>Cómo sumar más</p>
      <ul className={s.acciones}>
        {acciones.map((a) => (
          <li key={a.id} className={s.accion}>
            <span className={s.accionIcono}>
              <IconoAccion icono={a.icono} />
            </span>
            <span className={s.accionTexto}>
              <strong>{a.titulo}</strong>
              <em>{a.texto}</em>
            </span>
            <span className={s.accionLado}>
              <b className={s.accionPuntos}>+{formatoPuntos(a.puntos)}</b>
              {a.boton ? (
                <button type="button" className={s.accionBoton} onClick={a.boton.hacer}>
                  {a.boton.texto}
                </button>
              ) : (
                <span className={s.accionEtiqueta}>{a.etiqueta}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   El marcador (HUD): nivel, puntos, mini barra y el «+N» cuando suben
   ========================================================================== */

type Posicion = { top: number; left: number; width: number; maxHeight: number } | null;

export function MarcadorPuntos({ compacto }: { compacto?: boolean }) {
  const r = useResumenPuntos();
  const reducir = useReducedMotion();
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<Posicion>(null);
  const [ganados, setGanados] = useState<{ id: number; n: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const ultimoR = useRef<ResumenPuntos | null>(null);
  const ultimoTotal = useRef<number | null>(null);
  const idPanel = useId();

  /* Cuando llega un resumen con más puntos de los que se veían, sale el «+N».
     La primera vez se compara con lo que vio en su última visita (`antes`):
     al entrar cada día, el +5 del día se ve subir. */
  useEffect(() => {
    if (!r || ultimoR.current === r) return;
    ultimoR.current = r;
    const antes = ultimoTotal.current ?? r.antes;
    ultimoTotal.current = r.total;
    if (antes != null && r.total > antes) setGanados({ id: Date.now(), n: r.total - antes });
  }, [r]);

  useEffect(() => {
    if (!ganados) return;
    const t = setTimeout(() => setGanados(null), 2400);
    return () => clearTimeout(t);
  }, [ganados]);

  /* El panel se coloca bajo el botón, sin salirse de la pantalla. En el móvil
     no se coloca: es una hoja que sube desde abajo (lo hace el CSS). */
  const colocar = useCallback(() => {
    const b = boton.current?.getBoundingClientRect();
    if (!b) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    if (vw < 640) {
      setPos(null);
      return;
    }
    const width = Math.min(400, vw - 32);
    const left = Math.max(16, Math.min(b.right - width, vw - width - 16));
    const abajo = vh - b.bottom - 26;
    if (abajo >= 320 || abajo >= b.top - 26) {
      setPos({ top: b.bottom + 10, left, width, maxHeight: abajo });
    } else {
      const maxHeight = b.top - 26;
      setPos({ top: Math.max(16, b.top - 10 - maxHeight), left, width, maxHeight });
    }
  }, []);

  const cerrar = useCallback((devolverFoco = false) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, []);

  // Antes de pintar: así el panel no aparece un instante fuera de sitio.
  useLayoutEffect(() => {
    if (abierto) colocar();
  }, [abierto, colocar]);

  useEffect(() => {
    if (!abierto) return;
    panel.current?.focus({ preventScroll: true });
    let raf = 0;
    const recolocar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(colocar);
    };
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar(true);
    };
    const alPulsarFuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || boton.current?.contains(t)) return;
      cerrar();
    };
    // Al ir a otra pantalla (los botones de «cómo sumar») o abrir la ficha, se cierra.
    const alIrse = () => cerrar();
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', recolocar, true);
    window.addEventListener('keydown', alPulsarTecla);
    document.addEventListener('pointerdown', alPulsarFuera);
    window.addEventListener('popstate', alIrse);
    window.addEventListener('divine:onboarding', alIrse);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recolocar);
      window.removeEventListener('scroll', recolocar, true);
      window.removeEventListener('keydown', alPulsarTecla);
      document.removeEventListener('pointerdown', alPulsarFuera);
      window.removeEventListener('popstate', alIrse);
      window.removeEventListener('divine:onboarding', alIrse);
    };
  }, [abierto, colocar, cerrar]);

  if (!r) return null;

  const etiqueta = `Tus puntos: ${formatoPuntos(r.total)}. Nivel ${r.nivel.n}, ${r.nivel.nombre}. ${abierto ? 'Cerrar' : 'Ver'} el desglose`;

  return (
    <div className={s.marcador} data-compacto={compacto ? '' : undefined}>
      <button
        ref={boton}
        type="button"
        className={s.hud}
        data-brilla={ganados ? '' : undefined}
        aria-label={etiqueta}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-controls={abierto ? idPanel : undefined}
        onClick={() => setAbierto((a) => !a)}
      >
        <Insignia n={r.nivel.n} />
        <span className={s.hudTexto} aria-hidden="true">
          <span className={s.hudPuntos}>
            <ContadorPuntos valor={r.total} desde={r.antes ?? undefined} />
            <small>pts</small>
          </span>
          {!compacto && (
            <span className={s.hudBarra}>
              <BarraNivel total={r.total} desde={r.antes ?? undefined} conTexto={false} />
            </span>
          )}
        </span>
        <AnimatePresence>
          {ganados && (
            <motion.span
              key={ganados.id}
              className={s.mas}
              aria-hidden="true"
              initial={reducir ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.7 }}
              animate={reducir ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: [10, -4, -12, -30], scale: [0.7, 1.12, 1, 0.96] }}
              exit={{ opacity: 0 }}
              transition={reducir ? { duration: 0.2 } : { duration: 2.1, times: [0, 0.18, 0.7, 1], ease: 'easeOut' }}
            >
              +{formatoPuntos(ganados.n)}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      {/* Para lectores de pantalla: los puntos ganados se anuncian una vez. */}
      <span className={s.soloLector} aria-live="polite">
        {ganados ? `Has ganado ${formatoPuntos(ganados.n)} puntos.` : ''}
      </span>

      {abierto &&
        createPortal(
          <>
            <div className={s.velo} aria-hidden="true" onClick={() => cerrar()} />
            <motion.div
              ref={panel}
              id={idPanel}
              className={s.panel}
              role="dialog"
              aria-label="Tus puntos"
              tabIndex={-1}
              style={pos ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } : undefined}
              data-hoja={pos ? undefined : ''}
              initial={reducir ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: EASE_SALIDA }}
            >
              <div className={s.panelCabecera}>
                <div>
                  <p className={s.rotulo}>Tus puntos</p>
                  <p className={s.panelTotal}>
                    <ContadorPuntos valor={r.total} desde={0} />
                    <small>puntos</small>
                  </p>
                </div>
                <button type="button" className={s.cerrar} onClick={() => cerrar(true)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <BarraNivel total={r.total} tamano="grande" />
              <div className={s.bloquePanel}>
                <p className={s.rotulo}>De dónde vienen</p>
                <DesglosePuntos desglose={r.desglose} />
              </div>
              <ComoGanarPuntos resumen={r} />
            </motion.div>
          </>,
          document.body
        )}
    </div>
  );
}
