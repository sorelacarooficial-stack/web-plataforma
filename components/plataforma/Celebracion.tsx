'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ESCALONES, LOGROS, VITRINAS, type EstadoLogro } from '@/lib/logros-tipos';
import { PUNTOS, formatoPuntos, type ResumenPuntos } from '@/lib/puntos-tipos';
import { BarraNivel, CaminoNiveles, ContadorPuntos } from './Puntos';
import { COLORES, Icono, InsigniaNivel, Trofeo } from './IconosDivine';
import l from './logros.module.css';

/**
 * La celebración: cuando se gana un trofeo (cada escalón de una vitrina) o se
 * sube de nivel, sale en grande con confeti.
 *
 * Mira al entrar (a los 600 ms) y cada vez que alguien avisa con el evento
 * `divine:logros` (al terminar una clase nueva, al publicar, responder o
 * borrar en la comunidad, al subir una foto, al terminar la ficha). Cada vez
 * que mira, reparte los puntos a toda la pantalla con `divine:puntos`: el
 * marcador, el panel y el perfil los pintan sin pedirlos otra vez; los
 * trofeos con `divine:trofeos` (la vitrina pequeña del panel) y la racha de
 * días con `divine:racha` (el saludo del panel).
 *
 * A Sorela no se le monta (Plataforma.tsx), y aunque se montara, el servidor
 * no le manda nada que celebrar: es la creadora y no compite.
 *
 * Cada logro y cada nivel se celebran una sola vez: el servidor apunta lo que
 * ya se ha visto al devolverlo. Si la ficha de bienvenida está abierta
 * (`data-onboarding` en el body), espera a que se cierre: una fiesta encima de
 * un formulario no se disfruta.
 */

type Fiesta = { tipo: 'logro'; id: string } | { tipo: 'nivel'; id: string; puntos: ResumenPuntos };

const conOnboarding = () => document.body.hasAttribute('data-onboarding');

export default function Celebracion() {
  const [cola, setCola] = useState<Fiesta[]>([]);
  const [montado, setMontado] = useState(false);
  // Si la ficha se abre con una fiesta en cola, la fiesta espera detrás.
  const [ocupada, setOcupada] = useState(false);
  const reducir = useReducedMotion();
  const pidiendo = useRef(false);
  const otraVez = useRef(false);
  const pendiente = useRef(false);

  const mirar = useCallback(async () => {
    // Con la ficha abierta no se mira: se apunta y se mira al cerrarla.
    if (conOnboarding()) {
      pendiente.current = true;
      return;
    }
    // Si ya hay una petición en marcha, se repite al acabar: el aviso de ahora
    // puede traer puntos que la de antes todavía no veía.
    if (pidiendo.current) {
      otraVez.current = true;
      return;
    }
    pidiendo.current = true;
    try {
      const j = await (await fetch('/api/logros?celebrar=1')).json();
      if (!j.ok || j.creadora) return;
      const puntos = j.puntos as ResumenPuntos | undefined;
      if (puntos) window.dispatchEvent(new CustomEvent('divine:puntos', { detail: puntos }));
      if (Array.isArray(j.logros)) window.dispatchEvent(new CustomEvent<EstadoLogro[]>('divine:trofeos', { detail: j.logros }));
      // Y su racha de días, que viene en la misma respuesta: el panel no la pide aparte.
      if (j.racha) window.dispatchEvent(new CustomEvent('divine:racha', { detail: j.racha }));
      const nuevas: Fiesta[] = [
        ...((j.nuevos ?? []) as string[]).map((id) => ({ tipo: 'logro' as const, id })),
        // El nivel, al final: es el colofón de lo que se acaba de ganar.
        ...(puntos?.subioNivel ? [{ tipo: 'nivel' as const, id: `nivel-${puntos.nivel.n}`, puntos }] : []),
      ];
      if (nuevas.length) setCola((c) => [...c, ...nuevas.filter((n) => !c.some((x) => x.id === n.id))]);
    } catch {
      /* sin red, ya celebrará la próxima vez */
    } finally {
      pidiendo.current = false;
      if (otraVez.current) {
        otraVez.current = false;
        setTimeout(mirar, 300);
      }
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    setOcupada(conOnboarding());
    // Además del evento de cierre, se vigila el atributo: si por lo que sea el
    // evento no llega, lo pendiente se mira igual al quitarse.
    const vigia = new MutationObserver(() => {
      const abierta = conOnboarding();
      setOcupada(abierta);
      if (!abierta && pendiente.current) {
        pendiente.current = false;
        setTimeout(mirar, 350);
      }
    });
    vigia.observe(document.body, { attributes: true, attributeFilter: ['data-onboarding'] });
    return () => vigia.disconnect();
  }, [mirar]);

  useEffect(() => {
    const t = setTimeout(mirar, 600);
    let espera: ReturnType<typeof setTimeout> | undefined;
    const alAvisar = () => {
      clearTimeout(espera);
      espera = setTimeout(mirar, 400);
    };
    const alCerrarOnboarding = () => {
      if (!pendiente.current) return;
      pendiente.current = false;
      setTimeout(mirar, 350);
    };
    window.addEventListener('divine:logros', alAvisar);
    window.addEventListener('divine:onboarding-cerrado', alCerrarOnboarding);
    return () => {
      clearTimeout(t);
      clearTimeout(espera);
      window.removeEventListener('divine:logros', alAvisar);
      window.removeEventListener('divine:onboarding-cerrado', alCerrarOnboarding);
    };
  }, [mirar]);

  const siguiente = () => setCola((c) => c.slice(1));
  const fiesta = ocupada ? undefined : cola[0];
  const logro = fiesta?.tipo === 'logro' ? LOGROS.find((x) => x.id === fiesta.id) : undefined;
  const vitrina = logro ? VITRINAS.find((v) => v.id === logro.vitrina) : undefined;
  const hayFiesta = Boolean(fiesta && (fiesta.tipo === 'nivel' || logro));
  // Un logro que esta pantalla no conoce (versión vieja en caché) se salta.
  useEffect(() => {
    if (fiesta?.tipo === 'logro' && !logro) siguiente();
  }, [fiesta, logro]);

  /* Es un diálogo de verdad (aria-modal): el foco entra en su botón, no se
     escapa con el tabulador, Escape lo pasa y, al terminar la cola, vuelve a
     donde estaba (el reproductor del Aula, el botón de publicar…). Se apunta
     el último foco FUERA de la fiesta mientras no hay ninguna: cuando sale,
     su botón ya se ha llevado el foco. */
  const ultimoFoco = useRef<HTMLElement | null>(null);
  const habiaFiesta = useRef(false);
  useEffect(() => {
    const a = document.activeElement;
    if (a instanceof HTMLElement && a !== document.body) ultimoFoco.current = a;
    const alEnfocar = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && !t.closest('[data-celebracion]')) ultimoFoco.current = t;
    };
    document.addEventListener('focusin', alEnfocar);
    return () => document.removeEventListener('focusin', alEnfocar);
  }, []);
  useEffect(() => {
    if (!hayFiesta) {
      if (habiaFiesta.current) {
        habiaFiesta.current = false;
        const v = ultimoFoco.current;
        if (v?.isConnected) v.focus({ preventScroll: true });
      }
      return;
    }
    habiaFiesta.current = true;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCola((c) => c.slice(1));
        return;
      }
      if (e.key !== 'Tab') return;
      const caja = document.querySelector<HTMLElement>('[data-celebracion] [role="dialog"]');
      const enfocables = caja ? [...caja.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')] : [];
      if (!enfocables.length) return;
      const primero = enfocables[0];
      const final = enfocables[enfocables.length - 1];
      if (!caja?.contains(document.activeElement)) {
        e.preventDefault();
        primero.focus();
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        final.focus();
      } else if (!e.shiftKey && document.activeElement === final) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [hayFiesta]);

  if (!montado) return null;

  const muelle = { type: 'spring' as const, stiffness: 320, damping: 16 };
  const entrada = reducir ? { opacity: 0 } : { scale: 0.6, y: 40, rotate: -4 };
  const boton = cola.length > 1 ? 'Siguiente' : fiesta?.tipo === 'nivel' ? '¡Vamos!' : '¡Sigo!';

  return createPortal(
    <AnimatePresence mode="wait">
      {fiesta && (fiesta.tipo === 'nivel' || logro) && (
        <motion.div
          key={fiesta.id}
          className={l.celebracion}
          data-celebracion=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={siguiente}
        >
          <Confeti fuerte={fiesta.tipo === 'nivel'} />
          {fiesta.tipo === 'nivel' ? (
            <motion.div
              className={`${l.tarjetaLogro} ${l.tarjetaNivel}`}
              role="dialog"
              aria-modal="true"
              aria-label={`Subes a nivel ${fiesta.puntos.nivel.n}: ${fiesta.puntos.nivel.nombre}`}
              initial={entrada}
              animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={muelle}
              onClick={(e) => e.stopPropagation()}
            >
              <span className={l.nivelMoneda} aria-hidden="true">
                <InsigniaNivel n={fiesta.puntos.nivel.n} size={124} />
              </span>
              <span className={l.etiquetaNivel}>Nuevo nivel</span>
              <h3>¡Subes a nivel {fiesta.puntos.nivel.n}!</h3>
              <p className={l.nivelNombre}>{fiesta.puntos.nivel.nombre}</p>
              <p className={l.nivelTotal}>
                <ContadorPuntos valor={fiesta.puntos.total} desde={fiesta.puntos.antes ?? fiesta.puntos.nivel.desde} />
                <small>puntos</small>
              </p>
              <div className={l.nivelBarra}>
                <BarraNivel total={fiesta.puntos.total} desde={fiesta.puntos.antes ?? undefined} tamano="grande" conTexto={false} />
                <CaminoNiveles total={fiesta.puntos.total} compacto />
                <p>
                  {fiesta.puntos.nivel.siguiente
                    ? `Siguiente: ${fiesta.puntos.nivel.siguiente.nombre}, a ${formatoPuntos(fiesta.puntos.nivel.falta)} pts.`
                    : 'Es el nivel más alto. Ahora eres referencia para las demás.'}
                </p>
              </div>
              <button type="button" className={l.seguir} onClick={siguiente} autoFocus>
                {boton}
              </button>
            </motion.div>
          ) : (
            logro && (
              <motion.div
                className={l.tarjetaLogro}
                data-escalon={logro.escalon}
                role="dialog"
                aria-modal="true"
                aria-label={`Trofeo conseguido: ${logro.nombre}`}
                initial={entrada}
                animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={muelle}
                onClick={(e) => e.stopPropagation()}
              >
                <motion.span
                  className={l.medalla}
                  initial={reducir ? false : { scale: 0.4, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.12 }}
                >
                  <Trofeo escalon={logro.escalon} glifo={vitrina?.glifo ?? 'divine'} size={112} />
                </motion.span>
                <span className={l.etiqueta}>
                  {logro.escalon === 'divine' ? '¡Trofeo Divine!' : `¡Trofeo de ${ESCALONES[logro.escalon].toLowerCase()}!`}
                </span>
                {vitrina && vitrina.id !== 'divine' && <span className={l.vitrinaDe}>{vitrina.nombre}</span>}
                <h3>{logro.nombre}</h3>
                <p>{logro.texto}</p>
                {/* El del recorrido trae además los puntos del recorrido: lo que se prometía al hacerlo. */}
                <span className={l.masPuntos}>+{formatoPuntos(PUNTOS.logro + (logro.id === 'recorrido' ? PUNTOS.recorrido : 0))} puntos</span>
                {logro.id === 'curso-completo' && (
                  <a className={l.certificado} href="/api/certificado">
                    <Icono nombre="curso" size={18} />
                    Descargar mi certificado
                  </a>
                )}
                <button type="button" className={l.seguir} onClick={siguiente} autoFocus>
                  {boton}
                </button>
              </motion.div>
            )
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Confeti en un lienzo: ligero y sin librerías. Respeta «reducir movimiento». */
function Confeti({ fuerte = false }: { fuerte?: boolean }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = lienzo.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    // El oro de la marca y el vino de la gamificación (con su rosé).
    const colores = ['#d9b47c', '#8a6a32', '#f3e3c3', COLORES.divine.vino, COLORES.divine.rose, '#ffffff'];
    // Al subir de nivel, dos chorros desde los lados además del central.
    const origenes = fuerte ? [0.5, 0.12, 0.88] : [0.5];
    const duracion = fuerte ? 4200 : 3200;
    const piezas = origenes.flatMap((ox, k) =>
      Array.from({ length: fuerte ? 110 : 140 }, () => ({
        x: innerWidth * ox + (Math.random() - 0.5) * 120,
        y: k === 0 ? innerHeight * 0.42 : innerHeight * 0.85,
        vx: (Math.random() - 0.5) * 14 + (k === 1 ? 6 : k === 2 ? -6 : 0),
        vy: -Math.random() * 15 - (k === 0 ? 5 : 12),
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: colores[Math.floor(Math.random() * colores.length)],
      }))
    );
    let raf = 0;
    const inicio = performance.now();
    const paso = (t: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of piezas) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - (t - inicio) / duracion);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t - inicio < duracion) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [fuerte]);
  return <canvas ref={lienzo} className={l.confeti} aria-hidden="true" />;
}
