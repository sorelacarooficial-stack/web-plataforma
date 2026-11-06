'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DIAPOSITIVAS, type Diapo } from './diapositivas';
import { ContextoClase, ESTADO_INICIAL, type Cambiar, type EstadoClase } from './estado';
import { musicaSonando, SALIDA_MUSICA_MS } from './piezas';
import css from './clase.module.css';

/**
 * El motor de la presentación.
 *
 * - Escenario fijo de 1920×1080 que se escala a la pantalla (se ve igual en
 *   Google Meet, en el portátil y en el proyector).
 * - → / espacio / AvPág / clic: siguiente paso; ← / RePág: atrás. Funciona con
 *   cualquier pasador de diapositivas (mandan AvPág/RePág).
 * - F pantalla completa · G vista general · B pantalla en negro · P abre la
 *   vista de presentador · ? ayuda. Un número + Intro salta a esa diapositiva.
 * - La ventana del presentador y la que se comparte por Google Meet van a la
 *   vez (BroadcastChannel), y lo que se toca en directo (plazas, votos,
 *   ciudades) se ve igual en las dos y sobrevive a recargar (localStorage).
 *   Los vídeos solo suenan en la que se comparte: en la del presentador van
 *   sin sonido, para que no se oigan dos veces ni se cuelen por el micro.
 */

const CANAL = 'clase-antes-de-tocar';
const GUARDADO = 'clase-antes-de-tocar:estado';
const TOTAL = DIAPOSITIVAS.length;

type Mensaje =
  | { t: 'ir'; i: number; paso: number }
  | { t: 'estado'; estado: EstadoClase }
  | { t: 'hola' }
  | { t: 'negro'; negro: boolean };

function leerHash(): number {
  if (typeof window === 'undefined') return 0;
  const n = parseInt(window.location.hash.replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= TOTAL ? n - 1 : 0;
}

/** Escala un hijo de 1920×1080 a la caja que lo contiene. */
function Escala({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setS(Math.min(el.clientWidth / 1920, el.clientHeight / 1080));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`${css.escala} ${className ?? ''}`}>
      <div className={css.escenario} style={{ '--s': s } as CSSProperties}>
        {s > 0 && children}
      </div>
    </div>
  );
}

function Diapositiva({
  diapo,
  indice,
  estado,
  paso,
  qr,
  estatica = false,
  muda = false,
  saliendo = false,
  cerca = false,
}: {
  diapo: Diapo;
  indice: number;
  estado: 'actual' | 'antes' | 'despues';
  paso: number;
  qr: string;
  estatica?: boolean;
  /** Vista del presentador: los vídeos se ven pero no suenan. */
  muda?: boolean;
  /** Se va a cambiar: la música baja antes de pasar. */
  saliendo?: boolean;
  /** A una o dos diapositivas: se pinta y se precargan sus medios. */
  cerca?: boolean;
}) {
  const activa = estado === 'actual';
  const on = (k = 0) => estatica || (activa && paso >= k);
  const v = (k = 0, extra?: string) => `${css.r} ${extra ?? ''} ${on(k) ? css.on : ''}`;
  const { Vista } = diapo;
  return (
    <section
      className={`${css.diapo} ${diapo.tema === 'oscuro' ? css.oscuro : css.crema} ${estatica ? css.diapoEstatica : css[estado]} ${!estatica && !cerca && estado !== 'actual' ? css.lejos : ''}`}
      aria-hidden={!activa && !estatica}
      aria-label={`${indice + 1} de ${TOTAL}: ${diapo.titulo}`}
    >
      <div className={css.fondo} />
      {diapo.fase && (
        <div className={css.fases}>
          {['Observar', 'Interpretar', 'Decidir'].map((f, k) => (
            <span key={f} className={`${css.fase} ${diapo.fase === k + 1 ? css.faseOn : ''}`}>
              {k + 1} · {f}
            </span>
          ))}
        </div>
      )}
      <div className={css.contenido}>
        <Vista paso={paso} activa={activa} estatica={estatica} muda={muda} saliendo={saliendo} cerca={cerca} qr={qr} on={on} v={v} />
      </div>
      {!diapo.sinPie && (
        <footer className={css.pie}>
          <span>Antes de tocar · Técnica Divine</span>
          <span>
            {String(indice + 1).padStart(2, '0')} / {TOTAL}
          </span>
        </footer>
      )}
    </section>
  );
}

export default function Deck({ qr, vista }: { qr: string; vista: 'publico' | 'presentador' }) {
  const [pos, setPos] = useState({ i: 0, paso: 0 });
  const [estado, setEstado] = useState<EstadoClase>(ESTADO_INICIAL);
  const [general, setGeneral] = useState(false);
  const [negro, setNegro] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [quieto, setQuieto] = useState(false);
  const canal = useRef<BroadcastChannel | null>(null);
  const tecleado = useRef({ n: '', t: 0 });
  const toque = useRef<{ x: number; y: number } | null>(null);
  const [listo, setListo] = useState(false);

  /* ---------------------------------------------------------- arranque */
  useEffect(() => {
    setPos({ i: leerHash(), paso: 0 });
    setListo(true);
    const alCambiarHash = () => setPos((p) => (leerHash() === p.i ? p : { i: leerHash(), paso: 0 }));
    window.addEventListener('hashchange', alCambiarHash);
    try {
      const g = localStorage.getItem(GUARDADO);
      if (g) setEstado({ ...ESTADO_INICIAL, ...JSON.parse(g) });
    } catch {}
    if (typeof BroadcastChannel === 'undefined') return () => window.removeEventListener('hashchange', alCambiarHash);
    const c = new BroadcastChannel(CANAL);
    canal.current = c;
    c.onmessage = (e: MessageEvent<Mensaje>) => {
      const m = e.data;
      if (m.t === 'ir') setPos({ i: m.i, paso: m.paso });
      else if (m.t === 'estado') setEstado(m.estado);
      else if (m.t === 'negro') setNegro(m.negro);
      else if (m.t === 'hola') {
        setPos((p) => (c.postMessage({ t: 'ir', ...p } satisfies Mensaje), p));
      }
    };
    c.postMessage({ t: 'hola' } satisfies Mensaje);
    return () => {
      c.close();
      window.removeEventListener('hashchange', alCambiarHash);
    };
  }, []);

  /* La dirección lleva la diapositiva (#7): recargar no te devuelve al principio. */
  useEffect(() => {
    if (!listo) return;
    const h = `#${pos.i + 1}`;
    if (window.location.hash !== h) history.replaceState(null, '', h);
  }, [pos.i, listo]);

  /*
   * La diapositiva que se ve. Va igual que `pos`, salvo al dejar una con
   * música sonando: entonces la música baja poco a poco y luego cambia.
   */
  const [mostrada, setMostrada] = useState(pos);
  useEffect(() => {
    if (pos.i === mostrada.i || !musicaSonando.size) {
      setMostrada(pos);
      return;
    }
    const t = setTimeout(() => setMostrada(pos), SALIDA_MUSICA_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  const ir = useCallback((i: number, paso = 0) => {
    const j = Math.max(0, Math.min(TOTAL - 1, i));
    const p = Math.max(0, Math.min(DIAPOSITIVAS[j].pasos, paso));
    setPos({ i: j, paso: p });
    canal.current?.postMessage({ t: 'ir', i: j, paso: p } satisfies Mensaje);
  }, []);

  const siguiente = useCallback(() => {
    setPos((p) => {
      const n = p.paso < DIAPOSITIVAS[p.i].pasos ? { i: p.i, paso: p.paso + 1 } : p.i < TOTAL - 1 ? { i: p.i + 1, paso: 0 } : p;
      canal.current?.postMessage({ t: 'ir', ...n } satisfies Mensaje);
      return n;
    });
  }, []);

  const anterior = useCallback(() => {
    setPos((p) => {
      const n = p.paso > 0 ? { i: p.i, paso: p.paso - 1 } : p.i > 0 ? { i: p.i - 1, paso: DIAPOSITIVAS[p.i - 1].pasos } : p;
      canal.current?.postMessage({ t: 'ir', ...n } satisfies Mensaje);
      return n;
    });
  }, []);

  const cambiar: Cambiar = useCallback((f) => {
    setEstado((e) => {
      const n = f(e);
      try {
        localStorage.setItem(GUARDADO, JSON.stringify(n));
      } catch {}
      canal.current?.postMessage({ t: 'estado', estado: n } satisfies Mensaje);
      return n;
    });
  }, []);

  const alternarNegro = useCallback(() => {
    setNegro((b) => {
      canal.current?.postMessage({ t: 'negro', negro: !b } satisfies Mensaje);
      return !b;
    });
  }, []);

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const abrirPresentador = () => {
    const u = new URL(window.location.href);
    u.searchParams.set('vista', 'presentador');
    window.open(u.toString(), 'clase-presentador', 'width=1400,height=860');
  };

  /* ----------------------------------------------------------- teclado */
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      // La barra del volumen no se queda con las teclas: se suelta y la tecla manda en la presentación.
      if (e.target instanceof HTMLInputElement && e.target.type === 'range') e.target.blur();
      else if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (/^\d$/.test(k)) {
        const ahora = Date.now();
        tecleado.current = { n: (ahora - tecleado.current.t < 1500 ? tecleado.current.n : '') + k, t: ahora };
        return;
      }
      if (k === 'Enter' && tecleado.current.n && Date.now() - tecleado.current.t < 3000) {
        ir(parseInt(tecleado.current.n, 10) - 1);
        tecleado.current.n = '';
        setGeneral(false);
        return;
      }
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) {
        e.preventDefault();
        if (general) setGeneral(false);
        else siguiente();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) {
        e.preventDefault();
        anterior();
      } else if (k === 'Home') ir(0);
      else if (k === 'End') ir(TOTAL - 1);
      else if (k === '+' || k === '=') cambiar((x) => ({ ...x, volumen: Math.min(1, Math.round(((x.volumen ?? 1) + 0.1) * 10) / 10) }));
      else if (k === '-' || k === '_') cambiar((x) => ({ ...x, volumen: Math.max(0, Math.round(((x.volumen ?? 1) - 0.1) * 10) / 10) }));
      else if (k === 'f' || k === 'F') pantallaCompleta();
      else if (k === 'g' || k === 'G') setGeneral((g) => !g);
      else if (k === 'Escape') {
        setGeneral(false);
        setAyuda(false);
      } else if (k === 'b' || k === 'B' || k === '.') alternarNegro();
      else if (k === 'p' || k === 'P') abrirPresentador();
      else if (k === '?' || k === 'h' || k === 'H') setAyuda((a) => !a);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [siguiente, anterior, ir, general, alternarNegro, cambiar]);

  /* Los controles y el cursor se esconden cuando el ratón se queda quieto. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mover = () => {
      setQuieto(false);
      clearTimeout(t);
      t = setTimeout(() => setQuieto(true), 2500);
    };
    mover();
    window.addEventListener('pointermove', mover);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointermove', mover);
    };
  }, []);

  const contexto = useMemo(() => ({ estado, cambiar }), [estado, cambiar]);

  /* Pulsar en un hueco de la diapositiva avanza (en un botón o en el mapa, no). */
  const clicEscenario = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('button, a, input, video, [role="button"], svg g')) return;
    const x = e.clientX / window.innerWidth;
    if (x < 0.2) anterior();
    else siguiente();
  };

  const diapo = DIAPOSITIVAS[pos.i];

  if (vista === 'presentador') {
    return (
      <ContextoClase.Provider value={contexto}>
        <Presentador pos={pos} qr={qr} ir={ir} siguiente={siguiente} anterior={anterior} negro={negro} alternarNegro={alternarNegro} />
      </ContextoClase.Provider>
    );
  }

  return (
    <ContextoClase.Provider value={contexto}>
      <div
        className={`${css.raiz} ${quieto ? css.quieto : ''}`}
        onClick={clicEscenario}
        onTouchStart={(e) => (toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t0 = toque.current;
          if (!t0) return;
          const dx = e.changedTouches[0].clientX - t0.x;
          if (Math.abs(dx) > 50) (dx < 0 ? siguiente : anterior)();
          toque.current = null;
        }}
      >
        <Escala className={css.escalaPantalla}>
          {DIAPOSITIVAS.map((dp, i) => (
            <Diapositiva
              key={dp.id}
              diapo={dp}
              indice={i}
              estado={i === mostrada.i ? 'actual' : i < mostrada.i ? 'antes' : 'despues'}
              paso={i === mostrada.i ? mostrada.paso : i < mostrada.i ? dp.pasos : 0}
              saliendo={i === mostrada.i && pos.i !== mostrada.i}
              cerca={Math.abs(i - mostrada.i) <= 2 || Math.abs(i - pos.i) <= 1}
              qr={qr}
            />
          ))}
        </Escala>

        <div className={css.progreso} style={{ width: `${((pos.i + (diapo.pasos ? pos.paso / (diapo.pasos + 1) : 0)) / (TOTAL - 1)) * 100}%` }} />

        <nav className={css.controles} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={anterior} aria-label="Anterior">
            ←
          </button>
          <span>
            {pos.i + 1} / {TOTAL}
            {diapo.pasos > 0 && (
              <em>
                {' '}
                · {pos.paso}/{diapo.pasos}
              </em>
            )}
          </span>
          <button type="button" onClick={siguiente} aria-label="Siguiente">
            →
          </button>
          <i />
          <button type="button" onClick={() => setGeneral(true)} title="Vista general (G)">
            ▦
          </button>
          <button type="button" onClick={abrirPresentador} title="Vista de presentador (P)">
            ◧
          </button>
          <button type="button" onClick={pantallaCompleta} title="Pantalla completa (F)">
            ⤢
          </button>
          <button type="button" onClick={() => setAyuda((a) => !a)} title="Atajos (?)">
            ?
          </button>
        </nav>

        {general && (
          <div className={css.general} onClick={(e) => e.stopPropagation()}>
            <div className={css.generalRejilla}>
              {DIAPOSITIVAS.map((dp, i) => (
                <div
                  key={dp.id}
                  role="button"
                  tabIndex={0}
                  className={`${css.miniatura} ${i === pos.i ? css.miniaturaOn : ''}`}
                  onClick={() => {
                    ir(i);
                    setGeneral(false);
                  }}
                >
                  <Escala>
                    <Diapositiva diapo={dp} indice={i} estado="actual" paso={dp.pasos} qr={qr} estatica />
                  </Escala>
                  <span>
                    {i + 1}. {dp.titulo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {ayuda && <Ayuda cerrar={() => setAyuda(false)} />}
        <div className={`${css.negro} ${negro ? css.negroOn : ''}`} />
      </div>
    </ContextoClase.Provider>
  );
}

function Ayuda({ cerrar }: { cerrar: () => void }) {
  const filas: [string, string][] = [
    ['→  espacio  AvPág  clic', 'Siguiente'],
    ['←  RePág', 'Anterior'],
    ['número + Intro', 'Ir a esa diapositiva'],
    ['G', 'Vista general'],
    ['P', 'Vista de presentador (otra ventana, van sincronizadas)'],
    ['F', 'Pantalla completa'],
    ['+ / −', 'Subir / bajar el volumen de la música'],
    ['B  o  .', 'Pantalla en negro'],
    ['Inicio  Fin', 'Primera / última'],
  ];
  return (
    <div className={css.ayuda} onClick={(e) => (e.stopPropagation(), cerrar())}>
      <div className={css.ayudaCaja}>
        <h3>Atajos</h3>
        {filas.map(([k, t]) => (
          <p key={k}>
            <kbd>{k}</kbd>
            <span>{t}</span>
          </p>
        ))}
        <p className={css.ayudaNota}>
          En Google Meet, comparte la pestaña de la presentación con «Compartir también el audio de la pestaña» y lleva la vista de presentador en la otra
          pantalla (ahí los vídeos van sin sonido). Las plazas, votos y ciudades que pulses se ven en las dos.
        </p>
      </div>
    </div>
  );
}

/* ================================================================ presentador */

function Presentador({
  pos,
  qr,
  ir,
  siguiente,
  anterior,
  negro,
  alternarNegro,
}: {
  pos: { i: number; paso: number };
  qr: string;
  ir: (i: number, paso?: number) => void;
  siguiente: () => void;
  anterior: () => void;
  negro: boolean;
  alternarNegro: () => void;
}) {
  const [inicio, setInicio] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const d = DIAPOSITIVAS[pos.i];
  const sig = pos.paso < d.pasos ? { i: pos.i, paso: pos.paso + 1 } : pos.i < TOTAL - 1 ? { i: pos.i + 1, paso: 0 } : null;
  const t = inicio && ahora ? Math.floor((ahora - inicio) / 1000) : 0;
  const reloj = ahora ? new Date(ahora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '';

  return (
    <div className={css.presentador}>
      <div className={css.presActual}>
        <Escala>
          <Diapositiva diapo={d} indice={pos.i} estado="actual" paso={pos.paso} qr={qr} muda />
        </Escala>
      </div>
      <aside className={css.presLado}>
        <div className={css.presRelojes}>
          <div>
            <span>España</span>
            <b>{reloj}</b>
          </div>
          <div>
            <span>Llevas</span>
            <b>
              {String(Math.floor(t / 60)).padStart(2, '0')}:{String(t % 60).padStart(2, '0')}
            </b>
          </div>
          <button type="button" onClick={() => setInicio(Date.now())}>
            {inicio ? 'Reiniciar' : 'Empezar'}
          </button>
        </div>
        <p className={css.presEtiqueta}>
          Siguiente{sig && sig.i === pos.i ? ` · paso ${sig.paso} de ${d.pasos}` : ''}
        </p>
        <div className={css.presSiguiente}>
          {sig ? (
            <Escala>
              <Diapositiva diapo={DIAPOSITIVAS[sig.i]} indice={sig.i} estado="actual" paso={sig.paso} qr={qr} estatica={sig.i !== pos.i} />
            </Escala>
          ) : (
            <span>Fin</span>
          )}
        </div>
        <p className={css.presEtiqueta}>
          {pos.i + 1} / {TOTAL} · {d.titulo}
          {d.pasos > 0 && ` · paso ${pos.paso} de ${d.pasos}`}
        </p>
        <p className={css.presNotas}>{d.notas}</p>
        <div className={css.presBotones}>
          <button type="button" onClick={anterior}>
            ← Atrás
          </button>
          <button type="button" className={css.presPrincipal} onClick={siguiente}>
            Siguiente →
          </button>
          <button type="button" onClick={alternarNegro}>
            {negro ? 'Quitar negro' : 'Negro'}
          </button>
        </div>
        <select className={css.presSalto} value={pos.i} onChange={(e) => ir(Number(e.target.value))}>
          {DIAPOSITIVAS.map((dp, i) => (
            <option key={dp.id} value={i}>
              {i + 1}. {dp.titulo}
            </option>
          ))}
        </select>
      </aside>
    </div>
  );
}
