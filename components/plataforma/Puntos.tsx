'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
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
import type { EstadoLogro } from '@/lib/logros-tipos';
import { irA } from '@/lib/navegar';
import { ICONO_FUENTE, Icono, InsigniaNivel, type NombreIcono } from './IconosDivine';
import s from './puntos.module.css';

/**
 * Los puntos, en la pantalla.
 *
 * Aquí no se calcula nada que valga: los puntos los decide el servidor
 * (`/api/logros`) y llegan con el evento `divine:puntos`, que lanza la
 * Celebración cada vez que algo cambia. Esto solo los enseña, y los enseña
 * con ganas: números que cuentan hacia arriba, una barra dorada que se llena
 * con muelle, un «+N» que sube y se desvanece, la insignia propia de cada
 * nivel y el camino de los seis. Dopamina, pero con clase: oro sobre negro y
 * el vino de la gamificación para los iconos, la Cormorant para nombres y
 * cifras grandes y la Jost para lo demás.
 *
 * Sorela no compite: a ella /api/logros no le manda puntos, así que nada de
 * esto llega a pintarse en su sesión (ni el marcador).
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

/* Los trofeos (los escalones de cada vitrina) llegan igual, con
   `divine:trofeos`: el panel enseña la vitrina en pequeño sin pedirla. */
let ultimosTrofeos: EstadoLogro[] | null = null;
const oyentesTrofeos = new Set<() => void>();

function publicarTrofeos(t: EstadoLogro[]) {
  ultimosTrofeos = t;
  oyentesTrofeos.forEach((f) => f());
}

if (typeof window !== 'undefined')
  window.addEventListener('divine:trofeos', (e: Event) => {
    const d = (e as CustomEvent<EstadoLogro[]>).detail;
    if (Array.isArray(d)) publicarTrofeos(d);
  });

/* Respaldo: si en unos segundos nadie ha avisado (Sorela mirando «Ver como»,
   donde no hay Celebración), se piden una vez sin marcar nada como visto. De
   Sorela no llega nada: es la creadora y no compite. */
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
        if (!ultimosTrofeos && j?.ok && Array.isArray(j.logros)) publicarTrofeos(j.logros as EstadoLogro[]);
        if (!ultimaRacha && j?.ok) publicarRacha(j);
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

function suscribirTrofeos(f: () => void) {
  oyentesTrofeos.add(f);
  pedirRespaldo();
  return () => {
    oyentesTrofeos.delete(f);
  };
}

/* La racha (días seguidos entrando) no viaja en los avisos de la Celebración.
   La pide quien la enseña (el panel de inicio), una vez por carga y sin
   celebrar nada, cuando la Celebración ya ha mirado: así no compiten las dos
   peticiones al entrar. Cambia como mucho una vez al día. */
export type Racha = { actual: number; mejor: number };
let ultimaRacha: Racha | null = null;
const oyentesRacha = new Set<() => void>();
let rachaPedida = false;

function publicarRacha(j: unknown) {
  const r = (j as { racha?: { actual?: unknown; mejor?: unknown } } | null)?.racha;
  if (!r || typeof r.actual !== 'number') return;
  const actual = Math.max(0, Math.floor(r.actual));
  ultimaRacha = { actual, mejor: Math.max(actual, Math.floor(Number(r.mejor) || 0)) };
  oyentesRacha.forEach((f) => f());
}

function pedirRacha() {
  if (rachaPedida || ultimaRacha) return;
  rachaPedida = true;
  window.setTimeout(() => {
    fetch('/api/logros')
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) publicarRacha(j);
      })
      .catch(() => {
        // Sin red: se vuelve a pedir la próxima vez que alguien la enseñe.
        rachaPedida = false;
      });
  }, 2500);
}

function suscribirRacha(f: () => void) {
  oyentesRacha.add(f);
  pedirRacha();
  return () => {
    oyentesRacha.delete(f);
  };
}

function suscribirRachaSinPedir(f: () => void) {
  oyentesRacha.add(f);
  return () => {
    oyentesRacha.delete(f);
  };
}

/**
 * Su racha de días seguidos, o null mientras no llega. `pedir` en false (Sorela
 * mirando «Ver como») no la pide: de la creadora no hay racha que contar.
 */
export function useRacha(pedir = true): Racha | null {
  return useSyncExternalStore(
    pedir ? suscribirRacha : suscribirRachaSinPedir,
    () => ultimaRacha,
    () => null
  );
}

/**
 * Abre «Cómo funciona» (ComoFunciona.tsx, montado una vez en Plataforma.tsx).
 * `paso`: con cuál empieza ('puntos', 'niveles', 'trofeos' o 'ranking').
 */
export const abrirComoFunciona = (paso?: string) =>
  window.dispatchEvent(new CustomEvent('divine:como-funciona', { detail: paso ? { paso } : null }));

/** Los últimos trofeos que han llegado (los de quien mira), o null mientras no llegan. */
export function useTrofeos(): EstadoLogro[] | null {
  return useSyncExternalStore(
    suscribirTrofeos,
    () => ultimosTrofeos,
    () => null
  );
}

/** El último resumen de puntos que ha llegado, o null mientras no llega ninguno. */
export function useResumenPuntos(): ResumenPuntos | null {
  return useSyncExternalStore(
    suscribir,
    () => ultimo,
    () => null
  );
}

/* Qué resumen ha animado ya cada sitio de la pantalla (ver useDesdeUnaVez). */
const animadoEn = new Map<string, ResumenPuntos>();

/**
 * El `antes` de un resumen (desde dónde cuentan la cifra y la barra), pero
 * solo la PRIMERA vez que ese sitio lo pinta. El resumen se guarda en el
 * módulo y no cambia hasta el próximo aviso; un panel que se vuelve a montar
 * (volver a Inicio) repetiría cada vez la cuenta, el llenado y el «¡Subes de
 * nivel!». La segunda vez, sin `antes`: la barra se pinta llena hasta donde va.
 */
export function useDesdeUnaVez(sitio: string, r: ResumenPuntos | null): number | undefined {
  // Se decide al pintar y se apunta después: así el primer montaje sí anima.
  const yaAnimado = r !== null && animadoEn.get(sitio) === r;
  useEffect(() => {
    if (r) animadoEn.set(sitio, r);
  }, [sitio, r]);
  return r && !yaAnimado ? (r.antes ?? undefined) : undefined;
}

/* ==========================================================================
   Piezas
   ========================================================================== */

const EASE_SALIDA = [0.16, 1, 0.3, 1] as const;

/**
 * Para las barras que se llenan al verse. Con `whileInView` a secas, framer
 * devuelve la barra a su valor de base (llena) en cuanto ve que AÚN no está en
 * pantalla, así que todo lo de más abajo aparecía lleno y sin animar. Con esto
 * se queda vacía hasta que se ve, y entonces se llena.
 */
export function useVisto<T extends Element>() {
  const ref = useRef<T>(null);
  const visto = useInView(ref, { once: true, margin: '0px 0px -30px 0px' });
  return [ref, visto] as const;
}

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
  /* Cada vez que avanza de verdad (llegan puntos nuevos, o se pinta por primera
     vez desde lo que vio la última vez), la punta suelta un brillo al llegar.
     Al pintarse sin `desde` se llena desde el principio, pero eso no es avanzar. */
  const [avance, setAvance] = useState(0);
  const totalAntes = useRef<number | null>(null);
  const desdeAlMontar = useRef(desde);

  const verNivel = (e: EstadoNivel) => {
    vistoRef.current = e;
    setVisto(e);
  };

  useEffect(() => {
    const fin = nivelDe(total);
    const avanza =
      totalAntes.current !== null ? total > totalAntes.current : desdeAlMontar.current != null && desdeAlMontar.current < total;
    totalAntes.current = total;
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
      if (avanza) setAvance((a) => a + 1);
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
          {/* El brillo de avanzar sale de la punta y se abre; con «reducir
              movimiento» no se pinta. */}
          {avance > 0 && !reducir && (
            <motion.span
              key={avance}
              className={s.avance}
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.1, 2.6] }}
              transition={{ duration: 1.3, times: [0, 0.25, 1], ease: 'easeOut', delay: 0.45 }}
            />
          )}
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

/* ---------- El camino de los seis niveles ---------- */

/**
 * Los seis niveles en fila, cada uno con su insignia: los pasados en su
 * color, el actual más grande y con su anillo, los que faltan en gris con
 * los puntos desde los que se entra. Una línea dorada une la fila y llega
 * hasta donde va (dentro del nivel actual, en proporción).
 *
 * `compacto`: sin nombres (el panel del marcador). `ajena`: de otra persona.
 * Hereda el color del bloque donde va, como la barra.
 */
export function CaminoNiveles({ total, compacto = false, ajena = false }: { total: number; compacto?: boolean; ajena?: boolean }) {
  const reducir = useReducedMotion();
  const [ref, visto] = useVisto<HTMLDivElement>();
  const e = nivelDe(total);
  // De 0 (primer nivel, sin empezar) a 1 (último): la parte de la línea que va dorada.
  const avance = Math.min(1, ((e.n - 1) + (e.siguiente ? e.progreso : 0)) / (NIVELES.length - 1));
  return (
    <div ref={ref} className={s.camino} data-compacto={compacto ? '' : undefined}>
      {/* La línea va fuera de la lista (dentro de un <ol> solo caben <li>). */}
      <span className={s.caminoLinea} aria-hidden="true">
        <motion.span
          className={s.caminoRelleno}
          initial={{ scaleX: reducir ? avance : 0 }}
          animate={{ scaleX: visto || reducir ? avance : 0 }}
          transition={reducir ? { duration: 0 } : { duration: 1.1, delay: 0.1, ease: EASE_SALIDA }}
        />
      </span>
      <ol className={s.caminoLista} aria-label="Camino de niveles">
        {NIVELES.map((nv) => {
          const estado = nv.n < e.n ? 'hecho' : nv.n === e.n ? 'actual' : 'falta';
          const lector =
            estado === 'actual'
              ? ajena
                ? 'está aquí'
                : 'estás aquí'
              : estado === 'hecho'
                ? 'superado'
                : `desde ${formatoPuntos(nv.desde)} puntos`;
          return (
            <li key={nv.n} className={s.caminoPaso} data-estado={estado} aria-current={estado === 'actual' ? 'step' : undefined}>
              <span className={s.caminoInsignia}>
                <InsigniaNivel n={nv.n} size={estado === 'actual' ? (compacto ? 40 : 46) : compacto ? 28 : 32} apagada={estado === 'falta'} />
              </span>
              {!compacto && (
                <span className={s.caminoNombre} aria-hidden="true">
                  {nv.nombre}
                </span>
              )}
              <span className={s.caminoDesde} aria-hidden="true">
                {estado === 'actual' ? (ajena ? 'Aquí' : 'Tú') : formatoPuntos(nv.desde)}
              </span>
              <span className={s.soloLector}>
                Nivel {nv.n}, {nv.nombre}: {lector}.
              </span>
            </li>
          );
        })}
      </ol>
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
      return plural(Math.round(v / PUNTOS.logro), 'trofeo', 'trofeos');
    case 'perfil':
      return 'Foto, quién eres y dónde';
    case 'recorrido':
      return 'Hecho de principio a fin';
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
  const [ref, visto] = useVisto<HTMLUListElement>();
  const filas = FUENTES.map((f) => ({ f, v: desglose[f] ?? 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const mayor = filas[0]?.v ?? 1;

  if (filas.length === 0) {
    return <p className={s.desgloseVacio}>{vacio ?? 'Todavía no hay puntos. Cada clase, cada publicación y cada día que entras suman.'}</p>;
  }

  return (
    <ul ref={ref} className={s.desglose}>
      {filas.map(({ f, v }, i) => (
        <li key={f}>
          <span className={s.desgloseIcono} aria-hidden="true">
            <Icono nombre={ICONO_FUENTE[f]} size={18} />
          </span>
          <span className={s.desgloseTexto}>
            <strong>{(ajena && ETIQUETA_AJENA[f]) || ETIQUETA_FUENTE[f]}</strong>
            <em>{detalle(f, v)}</em>
          </span>
          <span className={s.desglosePista} aria-hidden="true">
            <motion.span
              initial={{ scaleX: reducir ? v / mayor : 0 }}
              animate={{ scaleX: visto || reducir ? v / mayor : 0 }}
              transition={reducir ? { duration: 0 } : { duration: 0.8, delay: 0.05 * i, ease: EASE_SALIDA }}
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
  icono: NombreIcono;
  titulo: string;
  texto: string;
  puntos: number;
  boton?: { texto: string; hacer: () => void };
  /** En lugar de botón, una etiqueta (lo que no se puede hacer ahora mismo). */
  etiqueta?: string;
};

/**
 * Qué hacer para sumar más, con sus puntos y un botón que lleva a hacerlo.
 * Lo que ya está hecho (el recorrido, el perfil, el curso entero) desaparece
 * de la lista.
 *
 * `puedePublicar`: si tiene la Comunidad Divine. Quien solo tiene el curso no
 * ve aquí nada de la comunidad: ni un botón de «Publicar» que no puede usar ni
 * lo que se suma dentro (para ella, la Comunidad es «Próximamente»).
 * `soloVer`: Sorela mirando «Ver como»: sin botones (no llevan a nada suyo).
 */
export function ComoGanarPuntos({
  resumen,
  puedePublicar = true,
  soloVer = false,
}: {
  resumen: ResumenPuntos | null;
  puedePublicar?: boolean;
  soloVer?: boolean;
}) {
  const d = resumen?.desglose;
  const acciones: Accion[] = [];

  // Solo cuando se sabe que no lo ha hecho: hasta que llegan los puntos, no se ofrece.
  if (d && (d.recorrido ?? 0) <= 0) {
    acciones.push({
      id: 'recorrido',
      icono: 'brujula',
      titulo: 'Haz el recorrido de bienvenida',
      texto: `Dos minutos por tu espacio y tu primera insignia (+${PUNTOS.logro} más).`,
      puntos: PUNTOS.recorrido,
      boton: { texto: 'Empezar', hacer: () => window.dispatchEvent(new Event('divine:recorrido')) },
    });
  }
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
      icono: 'clases',
      titulo: 'Termina tu siguiente clase',
      texto: `Y +${formatoPuntos(PUNTOS.curso)} más cuando completes la formación entera.`,
      puntos: PUNTOS.clase,
      boton: { texto: 'Ir a clase', hacer: () => irA('aula') },
    });
  }
  if (puedePublicar) {
    acciones.push({
      id: 'comunidad',
      icono: 'publicaciones',
      titulo: 'Comparte en la comunidad',
      texto: `Responder a una compañera, +${PUNTOS.respuesta}. Cada me gusta que recibes, +${PUNTOS.meGusta}.`,
      puntos: PUNTOS.publicacion,
      boton: { texto: 'Publicar', hacer: () => irA('comunidad') },
    });
  }
  if (d && d.perfil > 0 && d.fotos < PUNTOS.foto * PUNTOS.fotosMax) {
    acciones.push({
      id: 'foto',
      icono: 'fotos',
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
            <span className={s.accionIcono} aria-hidden="true">
              <Icono nombre={a.icono} size={20} />
            </span>
            <span className={s.accionTexto}>
              <strong>{a.titulo}</strong>
              <em>{a.texto}</em>
            </span>
            <span className={s.accionLado}>
              <b className={s.accionPuntos}>+{formatoPuntos(a.puntos)}</b>
              {a.boton && !soloVer ? (
                <button type="button" className={s.accionBoton} onClick={a.boton.hacer}>
                  {a.boton.texto}
                </button>
              ) : (
                <span className={s.accionEtiqueta}>{soloVer && a.boton ? 'De muestra' : a.etiqueta}</span>
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

export function MarcadorPuntos({ compacto, puedePublicar = true }: { compacto?: boolean; puedePublicar?: boolean }) {
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
    /* La MISMA condición que el CSS de la hoja (@media max-width: 639px), que
       cuenta la barra de desplazamiento; `clientWidth` no la cuenta, y con la
       barra clásica de Windows entre 640 y ~656 px el panel quedaba como hoja
       sin las reglas de hoja: fijo y sin coordenadas, fuera de la vista. */
    if (window.matchMedia('(max-width: 639px)').matches) {
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
    // Al ir a otra pantalla (los botones de «cómo sumar»), abrir la ficha o el recorrido, se cierra.
    const alIrse = () => cerrar();
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', recolocar, true);
    window.addEventListener('keydown', alPulsarTecla);
    document.addEventListener('pointerdown', alPulsarFuera);
    window.addEventListener('popstate', alIrse);
    window.addEventListener('divine:onboarding', alIrse);
    window.addEventListener('divine:recorrido', alIrse);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recolocar);
      window.removeEventListener('scroll', recolocar, true);
      window.removeEventListener('keydown', alPulsarTecla);
      document.removeEventListener('pointerdown', alPulsarFuera);
      window.removeEventListener('popstate', alIrse);
      window.removeEventListener('divine:onboarding', alIrse);
      window.removeEventListener('divine:recorrido', alIrse);
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
        <InsigniaNivel n={r.nivel.n} size={32} className={s.hudInsignia} />
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
                <InsigniaNivel n={r.nivel.n} size={56} className={s.panelInsignia} />
                <div className={s.panelCifra}>
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
              <CaminoNiveles total={r.total} compacto />
              <div className={s.bloquePanel}>
                <p className={s.rotulo}>De dónde vienen</p>
                <DesglosePuntos desglose={r.desglose} />
              </div>
              <ComoGanarPuntos resumen={r} puedePublicar={puedePublicar} />
              {/* La explicación entera, en cuatro pasos. Antes de abrirla se
                  cierra este panel con el foco en el marcador: al cerrar la
                  explicación, el foco vuelve ahí. */}
              <button
                type="button"
                className={s.comoFunciona}
                onClick={() => {
                  cerrar(true);
                  abrirComoFunciona();
                }}
              >
                <span className={s.comoFuncionaIcono} aria-hidden="true">
                  ?
                </span>
                <span className={s.comoFuncionaTexto}>
                  <strong>¿Cómo funciona?</strong>
                  <em>Puntos, niveles y trofeos{puedePublicar ? ', y el ranking del mes' : ''}, en un minuto</em>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </motion.div>
          </>,
          document.body
        )}
    </div>
  );
}
