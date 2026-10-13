'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import {
  CATEGORIAS_COMUNIDAD,
  SOBRE_CATEGORIA,
  type Autora,
  type CategoriaComunidad,
  type ProximaClase,
  type Publicacion,
  type Respuesta,
} from '@/lib/comunidad-tipos';
import { FORMAS_DE_SUMAR, PUNTOS, SUMAN_AL_MES, UNIDAD_MES, formatoPuntos, type FuenteMes, type PorFuenteMes } from '@/lib/puntos-tipos';
import Bienvenida, { SelloFijada } from './Bienvenida';
import { COLORES, DistintivoCreadora, ICONO_FUENTE, Icono, InsigniaNivel, Medalla, destello } from './IconosDivine';
import { useAviso, useConfirmar, type OpcionesConfirmar } from './Confirmar';
import css from './plataforma.module.css';
import c from './comunidad.module.css';
import { irA, verPerfil } from '@/lib/navegar';
import { leerRespuesta, prepararImagen } from '@/lib/imagen-cliente';

/**
 * La comunidad de terapeutas: casos, dudas y resultados entre todas, con
 * Sorela respondiendo y moderando.
 *
 * Quien tiene la Comunidad Divine publica y responde. Quien tiene solo un
 * curso entra de visita: lee y puede dar «me gusta», que es como se engancha
 * antes de dar el paso. Ver app/api/comunidad.
 *
 * Cada nombre y cada foto abre el perfil de esa persona (publicaciones,
 * respuestas, ranking y la lista de quién ha dado «me gusta»). `?p=id` en la
 * dirección abre esa publicación (viene del perfil).
 *
 * Arriba, dos pestañas: la conversación y el ranking del mes (`?ver=ranking`
 * en la dirección abre directamente el ranking).
 */

/* Lo que trae el servidor además de lo de siempre: las caras de quien ha dado
   «me gusta» (sus nombres y fotos van una vez en `personas`). */
type Pub = Publicacion & { gustan?: string[] };
type Resp = Respuesta & { gustan?: string[] };
type Personas = Record<string, Autora>;

type FilaRanking = {
  uid: string;
  nombre: string;
  foto?: string | null;
  puntos: number;
  nivel?: { n: number; nombre: string } | null;
  /** Cuántas publicaciones, respuestas, «me gusta» y clases lleva en el mes. */
  por?: PorFuenteMes;
};

type Datos = {
  puedeEscribir: boolean;
  modera: boolean;
  /* Quién eres y cómo vas este mes en el ranking. Sorela no puntúa: le llega
     `puntua: false` y no se le enseña la tarjeta «Tú». `arriba`: la que va
     justo delante, aunque estés fuera de las diez. */
  yo: {
    uid: string;
    nombre: string;
    foto: string | null;
    puntua?: boolean;
    puesto?: number | null;
    puntos?: number;
    por?: PorFuenteMes;
    arriba?: { puesto: number; puntos: number } | null;
  };
  publicaciones: Pub[];
  personas?: Personas;
  /** Las diez primeras del mes, con su desglose. */
  ranking: FilaRanking[];
  /** El mes del ranking (`2026-10`, UTC) y cuántas puntúan. */
  rankingMes?: { mes: string; participantes: number };
  /** Las tres primeras del mes pasado (vacío si nadie puntuó). */
  podioAnterior?: { mes: string; filas: FilaRanking[] } | null;
  proximaClase: ProximaClase;
  sorela: { nombre: string; foto: string | null };
};

type Filtro = 'Todo' | CategoriaComunidad | 'Sin responder';

type Confirmar = (o: OpcionesConfirmar) => Promise<boolean>;
type Avisar = (texto: string) => void;

/* Una foto subida al borrador y luego descartada se borra del almacén al
   momento: si no, se quedaba ahí para siempre (una foto de una clienta sin
   publicación). No se espera la respuesta, y `keepalive` la deja salir aunque
   se esté cerrando la página. */
const quitarDelAlmacen = (ruta: string) => {
  fetch(`/api/comunidad/imagen?ruta=${encodeURIComponent(ruta)}`, { method: 'DELETE', keepalive: true }).catch(() => {});
};

/** Un hueco vacío que se entiende: icono, qué pasa y qué se puede hacer. */
function Vacio({ icono, titulo, children }: { icono: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className={c.vacio}>
      <span className={c.vacioIcono} aria-hidden="true">
        {icono}
      </span>
      <strong className={c.vacioTitulo}>{titulo}</strong>
      {children && <div className={c.vacioTexto}>{children}</div>}
    </div>
  );
}

const ICONO_CHARLA = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M4 5.5h16v10H9l-5 4z" />
    <path d="M8.5 10.5h7" strokeLinecap="round" />
  </svg>
);

function hace(iso: string | null) {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'ahora';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? 'ayer' : `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function Avatar({ a, tam = 40 }: { a: Pick<Autora, 'nombre' | 'foto' | 'esSorela'>; tam?: number }) {
  const ini = a.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <span className={c.avatar} data-sorela={a.esSorela ? '' : undefined} style={{ width: tam, height: tam, fontSize: tam * 0.36 }}>
      {a.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.foto} alt="" />
      ) : (
        ini || 'D'
      )}
    </span>
  );
}

function Nombre({ a }: { a: Autora }) {
  // Tocar el nombre abre su perfil, como en Instagram. Sorela no compite: en
  // lugar de nivel o puntos lleva su distintivo de creadora.
  return (
    <span className={c.nombreFila}>
      <button type="button" className={c.nombre} onClick={() => verPerfil(a.uid)} title={`Ver el perfil de ${a.nombre}`}>
        {a.nombre}
      </button>
      {a.esSorela && <DistintivoCreadora className={c.distintivo} />}
    </span>
  );
}

/** La foto, que también abre el perfil. Para el teclado y el lector ya está el nombre al lado. */
function AvatarPerfil({ a, tam }: { a: Autora; tam?: number }) {
  return (
    <button type="button" className={c.avatarBoton} onClick={() => verPerfil(a.uid)} tabIndex={-1} aria-hidden="true">
      <Avatar a={a} tam={tam} />
    </button>
  );
}

/* ---------- «Me gusta» ---------- */

const CORAZON = 'M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z';

/* Las chispas del estallido: el vino y el rosé del acento, con un toque de oro. */
const CHISPAS = [COLORES.divine.vino, COLORES.divine.rose, COLORES.metales.divine[1], COLORES.metales.oro[2]];

/**
 * El estallido al dar «me gusta»: un anillo que se abre y diez chispas (la
 * estrella de la marca y puntos) que salen en círculo y se apagan. Solo
 * decora: el lector no lo oye y con movimiento reducido no sale.
 */
function Estallido({ radio }: { radio: number }) {
  return (
    <span className={c.estallido} aria-hidden="true">
      <motion.span
        className={c.estallidoAnillo}
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: radio * 2, height: radio * 2, marginLeft: -radio, marginTop: -radio }}
      />
      {Array.from({ length: 10 }, (_, i) => {
        const angulo = (i / 10) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.18 : 0);
        const lejos = radio * (i % 2 ? 0.78 : 1);
        const estrella = i % 2 === 0;
        const t = estrella ? 11 : 6;
        return (
          <motion.span
            key={i}
            className={c.chispa}
            style={{ width: t, height: t, marginLeft: -t / 2, marginTop: -t / 2, color: CHISPAS[i % CHISPAS.length] }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(angulo) * lejos, y: Math.sin(angulo) * lejos, scale: [0, 1.15, 0], opacity: [1, 1, 0], rotate: estrella ? 90 : 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.04 }}
          >
            {estrella ? (
              <svg viewBox="0 0 10 10" width={t} height={t}>
                <path d={destello(5, 5, 5)} fill="currentColor" />
              </svg>
            ) : (
              <span className={c.chispaPunto} />
            )}
          </motion.span>
        );
      })}
    </span>
  );
}

/**
 * Un número que rueda al cambiar: el nuevo entra por abajo al subir y por
 * arriba al bajar, como un cuentakilómetros. Con movimiento reducido, cambia
 * sin más.
 */
function Rueda({ n }: { n: number }) {
  const reducir = useReducedMotion();
  const antes = useRef(n);
  const dir = n >= antes.current ? 1 : -1;
  useEffect(() => {
    antes.current = n;
  }, [n]);
  return (
    <span className={c.rueda} data-vacia={n === 0 ? '' : undefined}>
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.span
          key={n}
          custom={dir}
          variants={{
            entra: (d: number) => (reducir ? { opacity: 0 } : { y: d * 14, opacity: 0 }),
            quieta: { y: 0, opacity: 1 },
            sale: (d: number) => (reducir ? { opacity: 0 } : { y: d * -14, opacity: 0 }),
          }}
          initial="entra"
          animate="quieta"
          exit="sale"
          transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 32 }}
        >
          {n > 0 ? formatoPuntos(n) : ''}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * El botón de «me gusta». Dado se ve claramente distinto: corazón lleno en
 * el vino del acento sobre su tinte. Al darlo, el corazón rebota con muelle,
 * estalla en chispas y el número rueda. Es un botón de verdad (teclado,
 * `aria-pressed`) y con movimiento reducido solo cambia de color.
 */
function Corazon({ dado, cuenta, alPulsar, pequeno }: { dado: boolean; cuenta: number; alPulsar: () => void; pequeno?: boolean }) {
  const reducir = useReducedMotion();
  const [estallidos, setEstallidos] = useState<number[]>([]);
  const pulsado = useRef(false);
  const tam = pequeno ? 16 : 19;

  function pulsar() {
    pulsado.current = true;
    if (!dado && !reducir) {
      const k = Date.now();
      setEstallidos((l) => [...l.slice(-2), k]);
      window.setTimeout(() => setEstallidos((l) => l.filter((x) => x !== k)), 1000);
    }
    alPulsar();
  }

  return (
    <button
      type="button"
      className={c.corazon}
      data-on={dado ? '' : undefined}
      data-pequeno={pequeno ? '' : undefined}
      onClick={pulsar}
      aria-pressed={dado}
      aria-label={`Me gusta${cuenta ? `, ${cuenta}` : ''}`}
    >
      <span className={c.corazonIcono}>
        {estallidos.map((k) => (
          <Estallido key={k} radio={pequeno ? 20 : 27} />
        ))}
        <motion.svg
          key={dado ? 'si' : 'no'}
          viewBox="0 0 24 24"
          width={tam}
          height={tam}
          aria-hidden="true"
          initial={pulsado.current && !reducir ? { scale: dado ? 0.35 : 0.75 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 560, damping: dado ? 11 : 20 }}
        >
          <path d={CORAZON} fill={dado ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          {dado && <path d={destello(18.6, 6.6, 1.9)} fill="#fff" opacity="0.9" />}
        </motion.svg>
      </span>
      <Rueda n={cuenta} />
    </button>
  );
}

const primerNombre = (n: string) => n.split(/\s+/)[0] || n;

/**
 * «Le gusta a Lucía, Ana y 3 más», con sus mini fotos apiladas. Si se lo
 * has dado tú: «A ti y a Lucía os gusta». Pulsarlo abre la lista entera.
 * En las respuestas va en pequeño: solo las caras.
 */
function Gustan({ uids, total, dado, personas, yo, abrir, compacto }: { uids: string[]; total: number; dado: boolean; personas: Personas; yo: string; abrir: () => void; compacto?: boolean }) {
  const reducir = useReducedMotion();
  if (total <= 0) return null;
  const caras = uids.map((u) => personas[u]).filter(Boolean).slice(0, 3);
  const otras = uids.filter((u) => u !== yo && personas[u]).map((u) => primerNombre(personas[u].nombre));
  const nombres = otras.slice(0, dado ? 1 : 2);
  const resto = Math.max(0, total - (dado ? 1 : 0) - nombres.length);
  const masN = (n: number) => `${formatoPuntos(n)} más`;

  let frase: ReactNode;
  if (dado) {
    if (total === 1) frase = <>Te gusta a <b>ti</b></>;
    else if (nombres.length && !resto) frase = <>A <b>ti</b> y a <b>{nombres[0]}</b> os gusta</>;
    else if (nombres.length) frase = <>A <b>ti</b>, a <b>{nombres[0]}</b> y a <b>{masN(resto)}</b> os gusta</>;
    else frase = <>A <b>ti</b> y a <b>{masN(resto)}</b> os gusta</>;
  } else if (!nombres.length) frase = <>Le gusta a <b>{formatoPuntos(total)} {total === 1 ? 'persona' : 'personas'}</b></>;
  else if (nombres.length === 1 && !resto) frase = <>Le gusta a <b>{nombres[0]}</b></>;
  else if (!resto) frase = <>Le gusta a <b>{nombres[0]}</b> y <b>{nombres[1]}</b></>;
  else frase = <>Le gusta a <b>{nombres.join(', ')}</b> y <b>{masN(resto)}</b></>;

  return (
    <motion.button
      type="button"
      className={c.gustan}
      data-compacto={compacto ? '' : undefined}
      onClick={abrir}
      aria-label={compacto ? `Ver a quién le gusta (${total})` : undefined}
      aria-haspopup="dialog"
      initial={reducir ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {caras.length > 0 && (
        <span className={c.gustanCaras} aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {caras.map((a) => (
              <motion.span key={a.uid} layout={reducir ? false : 'position'} initial={reducir ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={reducir ? { opacity: 0 } : { scale: 0.4, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 26 }}>
                <Avatar a={a} tam={compacto ? 20 : 24} />
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
      )}
      {!compacto && <span className={c.gustanTexto}>{frase}</span>}
    </motion.button>
  );
}

type PersonaGusta = Autora & { nivel: { n: number; nombre: string } | null; soyYo: boolean };

/**
 * La hoja con quién ha dado «me gusta»: sube desde abajo en el móvil y sale
 * en el centro en el ordenador. Cada fila abre su perfil. Escape cierra y el
 * foco vuelve a donde estaba. Una sola llamada barata (?gustan=1).
 */
function HojaGustan({ id, rid, total, cerrar }: { id: string; rid?: string; total: number; cerrar: () => void }) {
  const reducir = useReducedMotion();
  const [lista, setLista] = useState<PersonaGusta[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const alCerrar = useRef(cerrar);
  const tituloId = useId();

  useEffect(() => {
    alCerrar.current = cerrar;
  }, [cerrar]);

  useEffect(() => {
    let vivo = true;
    const q = new URLSearchParams({ id, gustan: '1', ...(rid ? { rid } : {}) });
    fetch(`/api/comunidad?${q}`)
      .then((r) => r.json())
      .then((j) => vivo && (j.ok ? setLista(j.personas) : setFallo(true)))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [id, rid]);

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    caja.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar.current();
      // El foco no se escapa de la hoja con el tabulador.
      if (e.key === 'Tab' && caja.current) {
        const f = [...caja.current.querySelectorAll<HTMLElement>('button')];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      if (previo?.isConnected) previo.focus({ preventScroll: true });
    };
  }, []);

  const n = lista?.length ?? total;
  return createPortal(
    <motion.div className={c.hojaVelo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={cerrar}>
      <motion.div
        ref={caja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={c.hoja}
        onClick={(e) => e.stopPropagation()}
        initial={reducir ? { opacity: 0 } : { y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reducir ? { opacity: 0 } : { y: 40, opacity: 0 }}
        transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
      >
        <span className={c.hojaAsa} aria-hidden="true" />
        <header className={c.hojaCabecera}>
          <span className={c.hojaSello} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d={CORAZON} fill="currentColor" />
            </svg>
          </span>
          <span>
            <h2 id={tituloId} className={c.hojaTitulo}>
              Me gusta
            </h2>
            <span className={c.hojaSub}>
              {formatoPuntos(n)} {n === 1 ? 'persona' : 'personas'}
            </span>
          </span>
          <button type="button" className={c.hojaCerrar} onClick={cerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        {fallo ? (
          <p className={c.hojaVacia}>No se ha podido cargar la lista. Revisa la conexión e inténtalo otra vez.</p>
        ) : !lista ? (
          <ul className={c.hojaLista} aria-busy="true">
            {Array.from({ length: Math.min(Math.max(total, 1), 4) }, (_, i) => (
              <li key={i} className={c.hojaFantasma} />
            ))}
          </ul>
        ) : lista.length === 0 ? (
          <p className={c.hojaVacia}>Todavía no le ha dado nadie.</p>
        ) : (
          <ul className={c.hojaLista}>
            {lista.map((x, i) => (
              <motion.li key={x.uid} initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducir ? 0 : Math.min(i, 8) * 0.035 }}>
                <button
                  type="button"
                  className={c.hojaFila}
                  onClick={() => {
                    cerrar();
                    verPerfil(x.uid);
                  }}
                >
                  <span className={c.hojaFoto}>
                    <Avatar a={x} tam={44} />
                    {x.nivel && <InsigniaNivel n={x.nivel.n} size={20} className={c.hojaInsignia} />}
                    <span className={c.hojaCorazon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="10" height="10">
                        <path d={CORAZON} fill="currentColor" />
                      </svg>
                    </span>
                  </span>
                  <span className={c.hojaQuien}>
                    <span className={c.hojaNombre}>
                      {x.nombre}
                      {x.soyYo && <span className={c.hojaTu}>Tú</span>}
                    </span>
                    {x.esSorela ? (
                      <DistintivoCreadora className={c.distintivo} />
                    ) : x.nivel ? (
                      <span className={c.hojaNivel}>
                        Nivel {x.nivel.n} · {x.nivel.nombre}
                      </span>
                    ) : null}
                  </span>
                  <span className={c.hojaVer}>
                    Ver perfil
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}

/* ---------- Ver fotos en grande ---------- */

function Visor({ fotos, inicio, cerrar }: { fotos: string[]; inicio: number; cerrar: () => void }) {
  const [i, setI] = useState(inicio);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % fotos.length);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [cerrar, fotos.length]);
  return createPortal(
    <motion.div className={c.visor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={cerrar} onContextMenu={(e) => e.preventDefault()}>
      <AnimatePresence mode="wait">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img key={i} src={fotos[i]} alt="" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.stopPropagation()} draggable={false} />
      </AnimatePresence>
      {fotos.length > 1 && (
        <>
          <button type="button" className={c.visorIzq} onClick={(e) => { e.stopPropagation(); setI((x) => (x - 1 + fotos.length) % fotos.length); }} aria-label="Anterior">‹</button>
          <button type="button" className={c.visorDer} onClick={(e) => { e.stopPropagation(); setI((x) => (x + 1) % fotos.length); }} aria-label="Siguiente">›</button>
        </>
      )}
      <button type="button" className={c.visorCerrar} onClick={cerrar} aria-label="Cerrar">✕</button>
    </motion.div>,
    document.body
  );
}

/* ---------- Escribir ---------- */

/* Los atajos de debajo de la caja: abren el borrador con su tipo ya elegido. */
const ATAJO: Record<CategoriaComunidad, string> = {
  Caso: 'Un caso',
  Duda: 'Una duda',
  Resultado: 'Un resultado',
  Recurso: 'Un recurso',
  Anuncio: 'Un anuncio',
};

function Escribir({
  yo,
  modera,
  alPublicar,
  confirmar,
  abrirSenal = 0,
}: {
  yo: Datos['yo'];
  modera: boolean;
  alPublicar: () => void;
  confirmar: Confirmar;
  /** Cada vez que sube, se abre el borrador (el «Publicar ahora» del ranking). */
  abrirSenal?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (abrirSenal) setAbierto(true);
  }, [abrirSenal]);
  const [categoria, setCategoria] = useState<CategoriaComunidad>('Caso');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<{ ruta: string; url: string }[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);
  /* Cada borrador descartado sube este número: una foto que termina de subir
     DESPUÉS de cancelar ya no es de nadie y se borra en cuanto llega. */
  const borrador = useRef(0);
  const fotosVivas = useRef(fotos);
  const publicando = useRef(false);

  useEffect(() => {
    fotosVivas.current = fotos;
  }, [fotos]);

  /* Si se sale de la comunidad (o se cierra la pestaña) con fotos en el
     borrador, el borrador se pierde: sus fotos también se borran. Durante la
     publicación no, que ya son de la publicación. */
  useEffect(() => {
    const limpiar = () => {
      if (!publicando.current) fotosVivas.current.forEach((f) => quitarDelAlmacen(f.ruta));
      fotosVivas.current = [];
    };
    const alSalir = (e: PageTransitionEvent) => {
      if (!e.persisted) limpiar();
    };
    window.addEventListener('pagehide', alSalir);
    return () => {
      window.removeEventListener('pagehide', alSalir);
      limpiar();
    };
  }, []);

  const categorias = CATEGORIAS_COMUNIDAD.filter((x) => modera || x !== 'Anuncio');

  /* Abrir el borrador; desde un atajo («Un caso», «Una duda»…), ya con su
     tipo elegido. */
  function abrir(cat?: CategoriaComunidad) {
    if (cat) setCategoria(cat);
    setAbierto(true);
  }

  async function subir(lista: FileList | null) {
    if (!lista) return;
    const deEste = borrador.current;
    setSubiendo(true);
    for (const f of [...lista].slice(0, 4 - fotos.length)) {
      try {
        const fd = new FormData();
        // Reducida aquí: una foto de móvil pasa del límite de 4,5 MB de Vercel.
        fd.append('archivo', await prepararImagen(f));
        const j = await leerRespuesta<{ ruta: string; url: string }>(await fetch('/api/comunidad/imagen', { method: 'POST', body: fd }));
        if (!j.ok) setErrores({ fotos: j.texto || 'No he podido subir la foto.' });
        else if (deEste !== borrador.current) quitarDelAlmacen(j.ruta);
        else setFotos((x) => [...x, { ruta: j.ruta, url: j.url }]);
      } catch (e) {
        setErrores({ fotos: (e as Error).message || 'No hay conexión.' });
      }
    }
    setSubiendo(false);
  }

  function quitarFoto(ruta: string) {
    setFotos((x) => x.filter((y) => y.ruta !== ruta));
    quitarDelAlmacen(ruta);
  }

  /* Cancelar descarta el borrador entero, con sus fotos. Si había algo
     escrito o subido, antes se pregunta: es fácil darle sin querer. */
  async function cancelar() {
    const hayAlgo = Boolean(titulo.trim() || texto.trim() || fotos.length);
    if (
      hayAlgo &&
      !(await confirmar({
        titulo: '¿Descartar el borrador?',
        texto: fotos.length ? 'Se pierde lo que has escrito y se borran las fotos que has subido.' : 'Se pierde lo que has escrito.',
        boton: 'Descartar',
      }))
    )
      return;
    borrador.current++;
    fotos.forEach((f) => quitarDelAlmacen(f.ruta));
    setFotos([]);
    setTitulo('');
    setTexto('');
    setErrores({});
    setAbierto(false);
  }

  async function publicar() {
    setEnviando(true);
    setErrores({});
    publicando.current = true;
    try {
      const j = await (
        await fetch('/api/comunidad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'publicar', categoria, titulo, texto, imagenes: fotos.map((f) => f.ruta) }),
        })
      ).json();
      if (!j.ok) setErrores(j.errores ?? { general: 'No se ha podido publicar.' });
      else {
        // Las fotos ya son de la publicación: el borrador las suelta sin borrarlas.
        fotosVivas.current = [];
        setTitulo('');
        setTexto('');
        setFotos([]);
        setAbierto(false);
        alPublicar();
        window.dispatchEvent(new Event('divine:logros'));
      }
    } catch {
      setErrores({ general: 'No hay conexión.' });
    }
    publicando.current = false;
    setEnviando(false);
  }

  return (
    <motion.section layout className={c.escribir} data-abierto={abierto ? '' : undefined} aria-label="Escribir en la comunidad">
      {!abierto ? (
        /* Cerrada se ve a la primera que aquí se escribe: un campo blanco con
           borde de verdad (3,8:1), la invitación en tinta legible y un botón
           negro que dice lo que hace. Debajo, atajos por tipo y lo que suma. */
        <div className={c.escribirCerrado}>
          <div className={c.escribirFila}>
            <Avatar a={{ nombre: yo.nombre || 'Tú', foto: yo.foto, esSorela: modera }} tam={44} />
            <button type="button" className={c.escribirCampo} onClick={() => abrir()}>
              {/* En el móvil, la invitación corta: la larga se cortaba a media frase. */}
              <span className={c.campoLargo}>{modera ? 'Escribe a la comunidad: un anuncio, un consejo…' : 'Comparte un caso, una duda o un resultado…'}</span>
              <span className={c.campoCorto}>{modera ? 'Escribe a la comunidad…' : '¿Qué quieres compartir?'}</span>
            </button>
            <button type="button" className={c.escribirBoton} onClick={() => abrir()} aria-label="Publicar: escribir una publicación nueva">
              <Icono nombre="publicaciones" size={18} grosor={1.7} />
              <span>Publicar</span>
            </button>
          </div>
          <div className={c.escribirDebajo}>
            <div className={c.escribirAtajos}>
              {categorias.map((x) => (
                <button key={x} type="button" className={c.atajo} onClick={() => abrir(x)}>
                  {ATAJO[x]}
                </button>
              ))}
            </div>
            {/* Sorela no compite: a ella no se le dice lo que suma. */}
            {!modera && (
              <span className={c.escribirPuntos}>
                <Icono nombre="publicaciones" size={15} grosor={1.8} />
                Publicar suma <b>+{PUNTOS.publicacion}</b>
              </span>
            )}
          </div>
        </div>
      ) : (
        <motion.div className={c.escribirAbierto} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <LayoutGroup id="cat">
            <div className={c.categorias}>
              {categorias.map((x) => (
                <button key={x} type="button" className={c.categoria} data-on={categoria === x ? '' : undefined} onClick={() => setCategoria(x)}>
                  {categoria === x && <motion.span layoutId="cat-activa" className={c.categoriaActiva} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span>{x}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          <p className={c.ayuda}>{SOBRE_CATEGORIA[categoria].ayuda}</p>
          <input className={c.campoTitulo} placeholder="Título" aria-label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} autoFocus />
          {errores.titulo && <span className={c.error}>{errores.titulo}</span>}
          <textarea className={c.campoTexto} placeholder="Cuéntalo con detalle: qué tenía, qué hiciste, qué notaste…" aria-label="Texto de la publicación" value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={5000} />
          {errores.texto && <span className={c.error}>{errores.texto}</span>}
          {fotos.length > 0 && (
            <div className={c.fotosNuevas}>
              {fotos.map((f, i) => (
                <span key={f.ruta}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" />
                  <button type="button" onClick={() => quitarFoto(f.ruta)} aria-label={`Quitar la foto ${i + 1}`} title="Quitar foto">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          {errores.fotos && <span className={c.error}>{errores.fotos}</span>}
          <p className={c.recordatorio}>Sin caras ni nombres de clientas si no te han dado permiso.</p>
          <div className={c.escribirPie}>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => subir(e.target.files)} />
            <button type="button" className={c.botonFoto} onClick={() => input.current?.click()} disabled={subiendo || fotos.length >= 4}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-8 8" strokeLinejoin="round" /></svg>
              {subiendo ? 'Subiendo…' : fotos.length ? `Fotos (${fotos.length}/4)` : 'Añadir fotos'}
            </button>
            <span className={c.hueco} />
            <button type="button" className={c.botonCancelar} onClick={cancelar} disabled={enviando}>
              Cancelar
            </button>
            <button type="button" className={css.btn} onClick={publicar} disabled={enviando || subiendo}>
              {enviando ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
          {errores.general && <span className={c.error}>{errores.general}</span>}
        </motion.div>
      )}
    </motion.section>
  );
}

/* ---------- El menú «···» de una publicación ---------- */

type Opcion = 'fijar' | 'resolver' | 'borrar';

/**
 * Menú de verdad: se cierra al tocar fuera o con Escape, se recorre con las
 * flechas y lo anuncia el lector de pantalla. La autora ve SIEMPRE «Borrar»
 * en lo suyo (aunque ya no tenga la Comunidad); marcar resuelta, solo si
 * todavía escribe; fijar, solo Sorela.
 */
function MenuPublicacion({ p, modera, puedeEscribir, elegir }: { p: Publicacion; modera: boolean; puedeEscribir: boolean; elegir: (o: Opcion) => void }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLSpanElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const id = useId();
  const reducir = useReducedMotion();

  useEffect(() => {
    if (!abierto) return;
    // Al abrir, el foco va a la primera opción, como en cualquier menú.
    lista.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const fuera = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  function mover(e: TeclaReact<HTMLDivElement>) {
    const items = [...(lista.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const destino =
      e.key === 'ArrowDown' ? (i + 1) % items.length : e.key === 'ArrowUp' ? (i - 1 + items.length) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1;
    if (e.key === 'Tab') setAbierto(false);
    if (destino < 0) return;
    e.preventDefault();
    items[destino].focus();
  }

  const opcion = (o: Opcion) => {
    setAbierto(false);
    // El foco vuelve al «···»: si se abre la pregunta de borrar, al cerrarla vuelve ahí.
    boton.current?.focus();
    elegir(o);
  };

  return (
    <span className={c.menuEnvoltura} ref={caja}>
      <button
        ref={boton}
        type="button"
        className={c.menuBoton}
        onClick={() => setAbierto((m) => !m)}
        aria-label="Opciones de la publicación"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        data-on={abierto ? '' : undefined}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="5.5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="18.5" cy="12" r="1.7" />
        </svg>
      </button>
      <AnimatePresence>
        {abierto && (
          <motion.div
            ref={lista}
            id={id}
            role="menu"
            aria-label="Opciones de la publicación"
            className={c.menu}
            onKeyDown={mover}
            initial={reducir ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={{ duration: reducir ? 0 : 0.16 }}
          >
            {modera && (
              <button type="button" role="menuitem" onClick={() => opcion('fijar')}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" />
                </svg>
                {p.fijada ? 'Quitar de arriba' : 'Fijar arriba'}
              </button>
            )}
            {(modera || puedeEscribir) && (
              <button type="button" role="menuitem" onClick={() => opcion('resolver')}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {p.resuelta ? 'Marcar sin resolver' : 'Marcar como resuelta'}
              </button>
            )}
            {(modera || puedeEscribir) && <span className={c.menuRaya} role="separator" />}
            <button type="button" role="menuitem" className={c.peligro} onClick={() => opcion('borrar')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
              </svg>
              Borrar publicación
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ---------- Una publicación ---------- */

function Tarjeta({
  p,
  datos,
  abierta,
  alternar,
  refrescar,
  verFotos,
  confirmar,
  avisar,
  borrar,
  cambiar,
}: {
  p: Pub;
  datos: Datos;
  abierta: boolean;
  alternar: () => void;
  refrescar: () => void;
  verFotos: (fotos: string[], i: number) => void;
  confirmar: Confirmar;
  avisar: Avisar;
  /** Borra la publicación (de la lista al momento; vuelve si falla). */
  borrar: (p: Pub) => void;
  /** Cambia la publicación en la lista sin esperar a recargar. */
  cambiar: (id: string, f: (p: Pub) => Pub) => void;
}) {
  const reducir = useReducedMotion();
  const [larga, setLarga] = useState(false);
  const [mg, setMg] = useState({ dado: p.loHeDado, n: p.meGusta, gustan: p.gustan ?? [] });
  const [respuestas, setRespuestas] = useState<Resp[] | null>(null);
  const [personasHilo, setPersonasHilo] = useState<Personas>({});
  const [hoja, setHoja] = useState<{ rid?: string; total: number } | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  /* Mientras va un «me gusta» al servidor, otro toque no sale: el servidor
     alterna, y dos toques rápidos dejarían la pantalla al revés. */
  const enCurso = useRef(new Set<string>());

  const gustanClave = (p.gustan ?? []).join(',');
  useEffect(() => setMg({ dado: p.loHeDado, n: p.meGusta, gustan: gustanClave ? gustanClave.split(',') : [] }), [p.loHeDado, p.meGusta, gustanClave]);

  /* Quién es quién en las caras: las de la lista, las del hilo y tú (tu cara
     sale al momento al dar «me gusta», sin esperar al servidor). */
  const yo = datos.yo;
  const personas = useMemo<Personas>(
    () => ({ ...datos.personas, ...personasHilo, [yo.uid]: { uid: yo.uid, nombre: yo.nombre || 'Tú', foto: yo.foto, esSorela: datos.modera } }),
    [datos.personas, personasHilo, yo.uid, yo.nombre, yo.foto, datos.modera]
  );
  const conmigo = (l: string[], dar: boolean) => (dar ? [yo.uid, ...l.filter((u) => u !== yo.uid)] : l.filter((u) => u !== yo.uid));

  const cargarHilo = useCallback(async () => {
    const j = await (await fetch(`/api/comunidad?id=${encodeURIComponent(p.id)}`)).json().catch(() => ({ ok: false }));
    if (j.ok) {
      setRespuestas(j.respuestas);
      setPersonasHilo(j.personas ?? {});
    }
  }, [p.id]);

  useEffect(() => {
    if (abierta && !respuestas) cargarHilo();
  }, [abierta, respuestas, cargarHilo]);

  const accion = async (cuerpo: Record<string, unknown>) =>
    (await fetch('/api/comunidad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, ...cuerpo }) })).json().catch(() => ({ ok: false }));

  /* «Me gusta» al momento en pantalla (corazón, número y tu cara) y, si el
     servidor dice que no, vuelve como estaba. Lo de verdad lo dice él. */
  async function meGusta() {
    if (enCurso.current.has('')) return;
    enCurso.current.add('');
    const antes = mg;
    setMg({ dado: !antes.dado, n: Math.max(0, antes.n + (antes.dado ? -1 : 1)), gustan: conmigo(antes.gustan, !antes.dado) });
    const j = await accion({ accion: 'meGusta' });
    enCurso.current.delete('');
    if (!j.ok) setMg(antes);
    // Si en otra pestaña ya se había cambiado, manda lo que dice el servidor.
    else if (j.loHeDado !== !antes.dado) setMg({ ...antes, gustan: conmigo(antes.gustan, antes.dado) });
  }

  async function meGustaRespuesta(r: Resp) {
    if (enCurso.current.has(r.id)) return;
    enCurso.current.add(r.id);
    const cambiarR = (f: (x: Resp) => Resp) => setRespuestas((l) => l?.map((x) => (x.id === r.id ? f(x) : x)) ?? l);
    cambiarR((x) => ({ ...x, loHeDado: !r.loHeDado, meGusta: Math.max(0, r.meGusta + (r.loHeDado ? -1 : 1)), gustan: conmigo(x.gustan ?? [], !r.loHeDado) }));
    const j = await accion({ accion: 'meGusta', rid: r.id });
    enCurso.current.delete(r.id);
    if (!j.ok) cambiarR((x) => ({ ...x, loHeDado: r.loHeDado, meGusta: r.meGusta, gustan: r.gustan }));
  }

  async function responder() {
    if (texto.trim().length < 2) return;
    setEnviando(true);
    const j = await accion({ accion: 'responder', texto });
    setEnviando(false);
    if (j.ok) {
      setTexto('');
      window.dispatchEvent(new Event('divine:logros'));
      await cargarHilo();
      refrescar();
    }
  }

  async function moderar(a: Opcion) {
    if (a === 'borrar') {
      const si = await confirmar({
        titulo: '¿Borrar esta publicación?',
        texto: 'Se borran también sus respuestas y sus fotos. Se restan los puntos que dio.',
        boton: 'Borrar publicación',
      });
      if (si) borrar(p);
      return;
    }
    const j = await accion({ accion: a });
    if (j.ok) refrescar();
    else avisar('No se ha podido cambiar. Inténtalo otra vez.');
  }

  /* Borrar una respuesta: sale del hilo al momento y, si el servidor dice que
     no, vuelve a su sitio con un aviso. Si ya no existía, se da por borrada. */
  async function borrarRespuesta(r: Resp) {
    const si = await confirmar({
      titulo: '¿Borrar esta respuesta?',
      texto: r.esMia ? 'Se restan los puntos que te dio.' : `Es de ${r.autora.nombre}. Se le restan los puntos que le dio.`,
      boton: 'Borrar respuesta',
    });
    if (!si) return;
    const sitio = respuestas?.findIndex((x) => x.id === r.id) ?? -1;
    setRespuestas((l) => l?.filter((x) => x.id !== r.id) ?? l);
    cambiar(p.id, (x) => ({ ...x, respuestas: Math.max(0, x.respuestas - 1) }));
    const j = await accion({ accion: 'borrar', rid: r.id });
    if (j.ok || j.motivo === 'no-existe') {
      window.dispatchEvent(new Event('divine:logros'));
      refrescar();
      return;
    }
    setRespuestas((l) => {
      if (!l || l.some((x) => x.id === r.id)) return l;
      const n = [...l];
      n.splice(sitio < 0 ? n.length : Math.min(sitio, n.length), 0, r);
      return n;
    });
    cambiar(p.id, (x) => ({ ...x, respuestas: x.respuestas + 1 }));
    avisar(j.motivo === 'sin-permiso' ? 'Esta respuesta no la puedes borrar.' : 'No se ha podido borrar la respuesta. Revisa la conexión e inténtalo otra vez.');
  }

  const corto = p.texto.length > 420 && !larga;

  return (
    <motion.article id={`pub-${p.id}`} layout="position" className={c.tarjeta} data-fijada={p.fijada ? '' : undefined} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <header className={c.cabecera}>
        <AvatarPerfil a={p.autora} />
        <span className={c.quien}>
          <Nombre a={p.autora} />
          <span className={c.cuando}>
            {hace(p.creado)} · <b data-cat={p.categoria}>{p.categoria}</b>
          </span>
        </span>
        <span className={c.sellos}>
          {p.fijada && <SelloFijada />}
          {p.resuelta && (
            <span className={c.selloResuelta} title="Resuelta">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              <span className={c.selloTexto}>Resuelta</span>
            </span>
          )}
        </span>
        {(datos.modera || p.esMia) && <MenuPublicacion p={p} modera={datos.modera} puedeEscribir={datos.puedeEscribir} elegir={moderar} />}
      </header>

      <h3 className={c.titulo}>{p.titulo}</h3>
      {p.texto && (
        <p className={c.texto} data-corto={corto ? '' : undefined}>
          {p.texto}
        </p>
      )}
      {corto && (
        <button type="button" className={c.verMas} onClick={() => setLarga(true)}>
          Seguir leyendo
        </button>
      )}

      {p.imagenes.length > 0 && (
        <div className={c.fotos} data-n={Math.min(p.imagenes.length, 4)} onContextMenu={(e) => e.preventDefault()}>
          {p.imagenes.slice(0, 4).map((u, i) => (
            <button key={u} type="button" onClick={() => verFotos(p.imagenes, i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {mg.n > 0 && (
          <motion.div key="gustan" className={c.gustanFila} initial={reducir ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={reducir ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={{ duration: reducir ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}>
            <Gustan uids={mg.gustan} total={mg.n} dado={mg.dado} personas={personas} yo={yo.uid} abrir={() => setHoja({ total: mg.n })} />
          </motion.div>
        )}
      </AnimatePresence>

      <footer className={c.pie}>
        <Corazon dado={mg.dado} cuenta={mg.n} alPulsar={meGusta} />
        <button type="button" className={c.accion} data-on={abierta ? '' : undefined} onClick={alternar}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5.5h16v10H9l-5 4z" strokeLinejoin="round" /></svg>
          {p.respuestas > 0 ? `${p.respuestas} ${p.respuestas === 1 ? 'respuesta' : 'respuestas'}` : datos.puedeEscribir ? 'Responder' : 'Sin respuestas'}
        </button>
        {p.respondioSorela && !p.autora.esSorela && <span className={c.respondio}>✦ Sorela ha respondido</span>}
      </footer>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div className={c.hilo} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            <div className={c.hiloDentro}>
              {respuestas === null && <p className={c.cargando}>Cargando respuestas…</p>}
              {/* Al borrar una, sale y las de debajo suben sin saltos. */}
              <AnimatePresence initial={false} mode="popLayout">
                {respuestas?.map((r) => (
                  <motion.div
                    key={r.id}
                    layout={reducir ? false : 'position'}
                    className={c.respuesta}
                    data-sorela={r.autora.esSorela ? '' : undefined}
                    exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                    transition={{ duration: reducir ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <AvatarPerfil a={r.autora} tam={32} />
                    <div className={c.respuestaCuerpo}>
                      <div className={c.respuestaCabecera}>
                        <Nombre a={r.autora} />
                        <span className={c.cuando}>{hace(r.creado)}</span>
                      </div>
                      <p>{r.texto}</p>
                      <div className={c.respuestaPie}>
                        <Corazon pequeno dado={r.loHeDado} cuenta={r.meGusta} alPulsar={() => meGustaRespuesta(r)} />
                        <Gustan compacto uids={r.gustan ?? []} total={r.meGusta} dado={r.loHeDado} personas={personas} yo={yo.uid} abrir={() => setHoja({ rid: r.id, total: r.meGusta })} />
                        {(r.esMia || datos.modera) && (
                          <button type="button" className={c.borrarRespuesta} onClick={() => borrarRespuesta(r)}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                            </svg>
                            Borrar
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {datos.puedeEscribir ? (
                <div className={c.responder}>
                  <Avatar a={{ nombre: datos.yo.nombre || 'Tú', foto: datos.yo.foto, esSorela: datos.modera }} tam={32} />
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder={datos.modera ? 'Responde como Sorela…' : 'Escribe tu respuesta…'}
                    aria-label="Tu respuesta"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) responder();
                    }}
                  />
                  <button type="button" className={css.btn} onClick={responder} disabled={enviando || texto.trim().length < 2}>
                    {enviando ? '…' : 'Responder'}
                  </button>
                </div>
              ) : (
                <p className={c.cargando}>Para responder hace falta la Comunidad Divine.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{hoja && <HojaGustan key="hoja" id={p.id} rid={hoja.rid} total={hoja.total} cerrar={() => setHoja(null)} />}</AnimatePresence>
    </motion.article>
  );
}

/* ---------- La próxima clase en vivo ---------- */

const FECHA_CLASE = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function Clase({ clase, modera, puedeEntrar, guardado }: { clase: ProximaClase; modera: boolean; puedeEntrar: boolean; guardado: () => void }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(clase?.titulo ?? 'Clase en vivo');
  const [cuando, setCuando] = useState(clase ? clase.cuando.slice(0, 16) : '');
  const [enlace, setEnlace] = useState(clase?.enlace ?? '');
  const [fallo, setFallo] = useState<string | null>(null);

  async function guardar(borrar = false) {
    setFallo(null);
    const local = cuando ? new Date(cuando).toISOString() : '';
    const j = await (
      await fetch('/api/comunidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'proximaClase', titulo, cuando: borrar ? '' : local, enlace }),
      })
    ).json().catch(() => ({ ok: false }));
    if (j.ok) {
      setEditando(false);
      guardado();
    } else setFallo(j.motivo === 'enlace' ? 'El enlace tiene que empezar por https://' : 'Revisa la fecha.');
  }

  const falta = clase ? new Date(clase.cuando).getTime() - Date.now() : 0;
  const pronto = clase && falta < 30 * 60_000;
  const dias = Math.ceil(falta / 86400_000);

  return (
    <section className={c.clase}>
      <p className={c.claseRotulo}>Próxima clase en vivo</p>
      {editando ? (
        <div className={c.claseForm}>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" />
          <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} />
          <input value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="Enlace de Zoom o Meet (https://…)" />
          {fallo && <span className={c.error}>{fallo}</span>}
          <div className={c.claseBotones}>
            <button type="button" onClick={() => guardar()}>Guardar</button>
            {clase && <button type="button" onClick={() => guardar(true)}>Quitar</button>}
            <button type="button" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      ) : clase ? (
        <>
          <p className={c.claseTitulo}>{clase.titulo}</p>
          <p className={c.claseFecha}>{FECHA_CLASE.format(new Date(clase.cuando))}</p>
          <p className={c.claseFalta}>{falta < 0 ? 'Está en marcha' : pronto ? 'Empieza enseguida' : dias <= 1 ? 'Es mañana o hoy' : `Dentro de ${dias} días`}</p>
          {puedeEntrar && clase.enlace && (
            <a className={c.claseEntrar} href={clase.enlace} target="_blank" rel="noreferrer" data-pronto={pronto ? '' : undefined}>
              {pronto ? 'Entrar ahora' : 'Enlace de la clase'}
            </a>
          )}
          {!puedeEntrar && <p className={c.claseNota}>Las clases en vivo son de la Comunidad Divine.</p>}
        </>
      ) : (
        <>
          <p className={c.claseTitulo}>Sin fecha todavía</p>
          <p className={c.claseNota}>{modera ? 'Convoca la primera cuando quieras.' : 'Se anuncia aquí en cuanto haya una.'}</p>
        </>
      )}
      {modera && !editando && (
        <button type="button" className={c.claseEditar} onClick={() => setEditando(true)}>
          {clase ? 'Cambiar' : 'Programar una clase'}
        </button>
      )}
    </section>
  );
}

/* ==========================================================================
   El ranking del mes
   ========================================================================== */

/* Lo que más se ve de la Comunidad: una pestaña propia, «Ranking del mes»,
   junto a la conversación (en el móvil, arriba y a un toque, sin bajar por
   todo el muro) y, en el ordenador, un adelanto en el lateral.

   Dentro: el podio de las tres primeras sobre negro (orden 2-1-3, peanas de
   oro, plata y bronce sobrios, corona fina sobre la primera, cifras que
   cuentan hacia arriba), tu tarjeta con lo que te falta para subir, el resto
   hasta diez con su barra, el podio del mes pasado y cómo se suma. Tocar a
   cualquiera despliega de dónde salen sus puntos y lleva a su perfil.

   Sorela no compite: no sale (lo filtra el servidor) ni tiene tarjeta «Tú».
   Con movimiento reducido, todo aparece ya en su sitio y sin contar. */

const MES = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' });
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Cuántas salen en el ranking (las mismas que manda app/api/comunidad). */
const TOP_MES = 10;

/** «octubre», del mes `2026-10` (o del de ahora). En UTC, como lib/actividad. */
const nombreMes = (mes?: string) => MES.format(mes && /^\d{4}-\d{2}$/.test(mes) ? new Date(`${mes}-15T12:00:00Z`) : new Date());

/** «Se reinicia en 18 días»: el ranking vuelve a cero el día 1 a las 00:00 UTC. */
function textoReinicio(ahora = Date.now()): string {
  const d = new Date(ahora);
  const falta = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - ahora;
  const horas = Math.ceil(falta / 3_600_000);
  if (horas <= 1) return 'Se reinicia en menos de una hora';
  if (horas < 24) return `Se reinicia en ${horas} horas`;
  // Redondeado: con 18 días y 2 horas por delante, «18 días», no 19.
  const dias = Math.max(1, Math.round(falta / 86_400_000));
  return dias === 1 ? 'Se reinicia en un día' : `Se reinicia en ${dias} días`;
}

const cuantasDe = (f: FuenteMes, n: number) => `${formatoPuntos(n)} ${n === 1 ? UNIDAD_MES[f][0] : UNIDAD_MES[f][1]}`;

/** Lo que vale cada forma de sumar al mes, sacado de PUNTOS (nunca a mano). */
const VALOR_MES = Object.fromEntries(SUMAN_AL_MES.map((f) => [f, FORMAS_DE_SUMAR.find((x) => x.fuente === f)?.puntos ?? 0])) as Record<FuenteMes, number>;

const EASE_SALIDA = [0.22, 1, 0.36, 1] as const;

const FLECHA = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/**
 * Una cifra que cuenta hacia arriba al aparecer y, cuando cambia (la recarga
 * de cada minuto), cuenta desde la que había. El lector oye solo la final;
 * con movimiento reducido, sale ya puesta.
 */
function Cuenta({ valor, retraso = 0 }: { valor: number; retraso?: number }) {
  const reducir = useReducedMotion();
  const mv = useMotionValue(reducir ? valor : 0);
  const texto = useTransform(mv, (v) => formatoPuntos(Math.round(v)));

  useEffect(() => {
    const origen = mv.get();
    if (reducir || origen === valor) {
      mv.set(valor);
      return;
    }
    const ctrl = animate(mv, valor, { duration: Math.min(1.6, 0.7 + Math.abs(valor - origen) / 600), delay: retraso, ease: [0.16, 1, 0.3, 1] });
    return () => ctrl.stop();
  }, [valor, retraso, reducir, mv]);

  return (
    <>
      <motion.span aria-hidden="true">{texto}</motion.span>
      <span className={c.soloLector}>{formatoPuntos(valor)}</span>
    </>
  );
}

/**
 * De dónde salen los puntos del mes de alguien: cuántas de cada cosa, lo que
 * vale y una barra con su parte del total. Lo de antes de apuntar la fuente
 * (no tiene desglose) va junto en «Otra actividad del mes», para que la
 * suma cuadre siempre con sus puntos.
 */
function Desglose({ por, puntos, oscuro, retraso = 0 }: { por?: PorFuenteMes; puntos: number; oscuro?: boolean; retraso?: number }) {
  const reducir = useReducedMotion();
  const partes = SUMAN_AL_MES.filter((f) => (por?.[f] ?? 0) > 0).map((f) => ({ f, n: por![f]!, pts: por![f]! * VALOR_MES[f] }));
  const otras = Math.max(0, puntos - partes.reduce((s, x) => s + x.pts, 0));
  const total = Math.max(1, partes.reduce((s, x) => s + x.pts, 0) + otras);
  const filas = [
    ...partes.map((x) => ({ clave: x.f, icono: <Icono nombre={ICONO_FUENTE[x.f]} size={16} grosor={1.8} />, texto: cuantasDe(x.f, x.n), pts: x.pts })),
    ...(otras > 0
      ? [
          {
            clave: 'otras',
            icono: (
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d={destello(12, 12, 7.5, 0.2)} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            ),
            texto: 'Otra actividad del mes',
            pts: otras,
          },
        ]
      : []),
  ];
  if (!filas.length) return <p className={c.desgloseVacio}>Todavía sin puntos este mes.</p>;
  return (
    <ul className={c.desglose} data-oscuro={oscuro ? '' : undefined} aria-label="De dónde salen los puntos">
      {filas.map((x, i) => (
        <li key={x.clave}>
          <span className={c.desgloseIcono} aria-hidden="true">
            {x.icono}
          </span>
          <span className={c.desgloseTexto}>{x.texto}</span>
          <b className={c.desglosePts}>+{formatoPuntos(x.pts)}</b>
          <span className={c.desgloseBarra} aria-hidden="true">
            <motion.span
              className={c.desgloseRelleno}
              initial={reducir ? false : { width: '0%' }}
              animate={{ width: `${Math.max(3, (x.pts / total) * 100)}%` }}
              transition={reducir ? { duration: 0 } : { duration: 0.7, delay: retraso + i * 0.07, ease: EASE_SALIDA }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Lo que se puede hacer para sumar, desde el ranking: publicar, responder o ir a una clase. */
type Sumar = 'publicar' | 'responder' | 'clase';

const SUMAR: Record<Sumar, { texto: string; boton: string; puntos: number; icono: FuenteMes }> = {
  publicar: { texto: 'Publicar', boton: 'Publicar ahora', puntos: PUNTOS.publicacion, icono: 'publicaciones' },
  responder: { texto: 'Responder a una compañera', boton: 'Responder una duda', puntos: PUNTOS.respuesta, icono: 'respuestas' },
  clase: { texto: 'Terminar una clase', boton: 'Ir al aula', puntos: PUNTOS.clase, icono: 'clases' },
};

/** Lo más pequeño que basta para cubrir `falta` puntos, dicho en cristiano. */
function sugerencia(falta: number): { texto: string; accion: Sumar } {
  if (falta <= PUNTOS.respuesta) return { texto: `Con una respuesta a una compañera (+${PUNTOS.respuesta}) lo tienes.`, accion: 'responder' };
  if (falta <= PUNTOS.publicacion) return { texto: `Con una publicación (+${PUNTOS.publicacion}) lo tienes.`, accion: 'publicar' };
  if (falta <= PUNTOS.publicacion + PUNTOS.respuesta) return { texto: 'Con una publicación y una respuesta lo tienes.', accion: 'publicar' };
  if (falta <= PUNTOS.clase) return { texto: `Con una clase terminada (+${PUNTOS.clase}) lo tienes.`, accion: 'clase' };
  return { texto: `Paso a paso: cada publicación suma +${PUNTOS.publicacion} y cada clase terminada, +${PUNTOS.clase}.`, accion: 'publicar' };
}

type Meta = {
  titulo: string;
  frase: string;
  extra?: string;
  /** La barra hacia el siguiente puesto: de 0 a 1 y a qué puesto lleva. */
  barra?: { valor: number; hasta: string };
  sugerencia?: { texto: string; accion: Sumar };
  /** Aún sin puntos: se enseña cómo empezar. */
  empezar?: boolean;
};

/**
 * Cómo vas y qué te falta, en concreto y sin apretar: el puesto que tienes
 * delante (con su nombre si está en las diez), cuántos puntos y con qué se
 * consiguen; y, si quedan lejos, cuánto para el podio o para entrar en las
 * diez. Solo con lo que trae el ranking y `yo.arriba`: nada de pedir más.
 */
function metaDelPuesto(filas: FilaRanking[], yo: Datos['yo'], participantes: number): Meta {
  const puntos = Math.max(0, yo.puntos ?? 0);
  const puesto = yo.puesto ?? null;
  const pts = (n: number) => `${formatoPuntos(n)} pts`;

  if (!puesto || puntos <= 0) {
    const llena = filas.length >= TOP_MES;
    const falta = llena ? filas[TOP_MES - 1].puntos + 1 : 1;
    return {
      titulo: 'Aún sin puntos este mes',
      frase: llena ? `Para entrar en las diez te hacen falta ${pts(falta)}.` : 'Con lo primero que sumes ya entras en el ranking.',
      empezar: true,
    };
  }

  if (puesto === 1) {
    const segunda = filas[1];
    return {
      titulo: 'Vas la primera',
      frase: !segunda
        ? 'Eres la única que suma de momento.'
        : puntos > segunda.puntos
          ? `Le sacas ${pts(puntos - segunda.puntos)} a ${primerNombre(segunda.nombre)}.`
          : `Empatada con ${primerNombre(segunda.nombre)}: lo próximo que sumes te deja sola arriba.`,
      extra: 'El podio se cierra el día 1. Sigue compartiendo.',
      barra: { valor: 1, hasta: 'Primera' },
      sugerencia: { texto: `Cada publicación suma +${PUNTOS.publicacion} y cada respuesta a una compañera, +${PUNTOS.respuesta}.`, accion: 'publicar' },
    };
  }

  // La de delante: en la lista si estás en las diez; si no, la que manda el servidor.
  const enLista = puesto <= filas.length;
  const delante = enLista
    ? { puesto: puesto - 1, puntos: filas[puesto - 2].puntos, nombre: primerNombre(filas[puesto - 2].nombre) }
    : yo.arriba
      ? { ...yo.arriba, nombre: '' }
      : null;
  const titulo = puesto <= 3 ? `En el podio: puesto ${puesto}` : `Puesto ${puesto} de ${formatoPuntos(Math.max(participantes, puesto))}`;
  if (!delante) return { titulo, frase: '' };

  const falta = Math.max(1, delante.puntos - puntos + 1);
  const quien = delante.nombre ? ` (${delante.nombre})` : '';
  const frase =
    delante.puntos === puntos
      ? `Empatada con el puesto ${delante.puesto}${quien}: lo próximo que sumes te pone delante.`
      : `Te faltan ${pts(falta)} para el puesto ${delante.puesto}${quien}.`;
  let extra: string | undefined;
  if (puesto > 3 && enLista && filas[2]) extra = `Para el podio, ${pts(Math.max(1, filas[2].puntos - puntos + 1))}.`;
  if (!enLista && filas.length >= TOP_MES) extra = `Para entrar en las diez, ${pts(Math.max(1, filas[TOP_MES - 1].puntos - puntos + 1))}.`;
  return {
    titulo,
    frase,
    extra,
    barra: { valor: Math.min(1, puntos / (delante.puntos + 1)), hasta: `Puesto ${delante.puesto}` },
    sugerencia: sugerencia(falta),
  };
}

/* ---------- El podio ---------- */

/** Cuándo entra cada puesto: de abajo arriba, bronce, plata y por último el oro. */
const RETRASO_PODIO: Record<1 | 2 | 3, number> = { 1: 0.36, 2: 0.18, 3: 0.04 };

/** La corona fina sobre la primera, con dos destellos que titilan (quietos con movimiento reducido). */
function Corona({ retraso }: { retraso: number }) {
  return (
    <motion.span
      className={c.podioCorona}
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.4, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: retraso, type: 'spring', stiffness: 420, damping: 15 }}
    >
      <Icono nombre="corona" size={28} grosor={1.4} />
      <svg className={c.podioDestello} data-n="1" viewBox="0 0 10 10" width="9" height="9">
        <path d={destello(5, 5, 5)} fill="currentColor" />
      </svg>
      <svg className={c.podioDestello} data-n="2" viewBox="0 0 10 10" width="6" height="6">
        <path d={destello(5, 5, 5)} fill="currentColor" />
      </svg>
    </motion.span>
  );
}

/**
 * Las tres primeras, en orden 2-1-3 a la vista (en el código y para el
 * lector, 1-2-3). Cada una es un botón que despliega su desglose debajo del
 * podio. El hueco que falta («Libre») invita a ocuparlo.
 */
function Podio({ filas, yo, elegida, elegir, idDetalle }: { filas: FilaRanking[]; yo: string | null; elegida: string | null; elegir: (uid: string) => void; idDetalle: string }) {
  const reducir = useReducedMotion();
  return (
    <ol className={c.podio} aria-label="Podio del mes">
      {([1, 2, 3] as const).map((puesto) => {
        const r = filas[puesto - 1];
        const retraso = RETRASO_PODIO[puesto];
        const abierta = Boolean(r && elegida === r.uid);
        const soy = Boolean(r && yo === r.uid);
        return (
          <li key={puesto} className={c.podioCol} data-puesto={puesto}>
            <motion.div
              className={c.podioPersona}
              initial={reducir ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducir ? { duration: 0 } : { delay: retraso + 0.22, type: 'spring', stiffness: 260, damping: 22 }}
            >
              {r ? (
                <button
                  type="button"
                  className={c.podioBoton}
                  onClick={() => elegir(r.uid)}
                  aria-expanded={abierta}
                  aria-controls={abierta ? idDetalle : undefined}
                  aria-label={`Puesto ${puesto}: ${r.nombre}${soy ? ' (tú)' : ''}, ${formatoPuntos(r.puntos)} puntos. Ver de dónde salen`}
                  data-on={abierta ? '' : undefined}
                >
                  {puesto === 1 && <Corona retraso={reducir ? 0 : retraso + 0.75} />}
                  <span className={c.podioFoto}>
                    <Avatar a={{ nombre: r.nombre, foto: r.foto ?? null, esSorela: false }} tam={puesto === 1 ? 76 : 60} />
                    {r.nivel && <InsigniaNivel n={r.nivel.n} size={puesto === 1 ? 26 : 22} className={c.podioInsignia} />}
                  </span>
                  <span className={c.podioNombre}>
                    {primerNombre(r.nombre)}
                    {soy && <span className={c.podioTu}>Tú</span>}
                  </span>
                  <span className={c.podioPuntos}>
                    <Cuenta valor={r.puntos} retraso={retraso + 0.4} />
                    <small> pts</small>
                  </span>
                </button>
              ) : (
                <span className={c.podioLibre}>
                  <span className={c.podioHueco} aria-hidden="true">
                    <Icono nombre={puesto === 1 ? 'corona' : 'medalla'} size={22} grosor={1.5} />
                  </span>
                  <span>Libre</span>
                </span>
              )}
            </motion.div>
            <motion.span
              className={c.podioPeana}
              aria-hidden="true"
              initial={reducir ? false : { scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={reducir ? { duration: 0 } : { delay: retraso, duration: 0.6, ease: EASE_SALIDA }}
            >
              <span className={c.podioNumero}>{puesto}</span>
            </motion.span>
          </li>
        );
      })}
    </ol>
  );
}

/** Lo que se despliega al tocar a alguien: su nivel, de dónde salen sus puntos y su perfil. */
function Detalle({ r, oscuro }: { r: FilaRanking; oscuro?: boolean }) {
  return (
    <div className={c.detalle} data-oscuro={oscuro ? '' : undefined}>
      {r.nivel && (
        <p className={c.detalleNivel}>
          <InsigniaNivel n={r.nivel.n} size={20} />
          Nivel {r.nivel.n} · {r.nivel.nombre}
        </p>
      )}
      <Desglose por={r.por} puntos={r.puntos} oscuro={oscuro} retraso={0.1} />
      <button type="button" className={c.verPerfil} onClick={() => verPerfil(r.uid)}>
        Ver el perfil de {primerNombre(r.nombre)}
        {FLECHA}
      </button>
    </div>
  );
}

/* ---------- Del 4 al 10 ---------- */

function FilaPuesto({ r, puesto, max, soy, abierta, alternar, id, orden }: { r: FilaRanking; puesto: number; max: number; soy: boolean; abierta: boolean; alternar: () => void; id: string; orden: number }) {
  const reducir = useReducedMotion();
  const retraso = 0.5 + orden * 0.06;
  return (
    <motion.li
      className={c.fila}
      data-yo={soy ? '' : undefined}
      data-on={abierta ? '' : undefined}
      initial={reducir ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducir ? { duration: 0 } : { delay: retraso, duration: 0.35, ease: EASE_SALIDA }}
    >
      <button type="button" className={c.filaBoton} onClick={alternar} aria-expanded={abierta} aria-controls={abierta ? id : undefined}>
        <span className={c.filaPuesto}>
          <span className={c.soloLector}>Puesto </span>
          {puesto}
          <span className={c.soloLector}>:</span>
        </span>
        <span className={c.filaFoto} aria-hidden="true">
          <Avatar a={{ nombre: r.nombre, foto: r.foto ?? null, esSorela: false }} tam={40} />
          {r.nivel && <InsigniaNivel n={r.nivel.n} size={18} className={c.filaInsignia} />}
        </span>
        <span className={c.filaCuerpo}>
          <span className={c.filaLinea}>
            <span className={c.filaNombre}>{r.nombre}</span>
            {soy && <span className={c.filaTu}>Tú</span>}
            <span className={c.filaPuntos}>
              <Cuenta valor={r.puntos} retraso={retraso} />
              <small> pts</small>
            </span>
          </span>
          <span className={c.filaPista} aria-hidden="true">
            <motion.span
              className={c.filaRelleno}
              initial={reducir ? false : { width: '0%' }}
              animate={{ width: `${Math.max(4, (r.puntos / max) * 100)}%` }}
              transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 17, delay: retraso + 0.1 }}
            />
          </span>
        </span>
        <span className={c.filaFlecha} aria-hidden="true">
          {FLECHA}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            key="detalle"
            id={id}
            className={c.filaPanel}
            initial={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducir ? 0 : 0.3, ease: EASE_SALIDA }}
          >
            <Detalle r={r} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/* ---------- Tú ---------- */

/**
 * Tu mes, siempre a la vista bajo el podio: tu puesto, tus puntos contando,
 * la barra hasta el puesto de delante, lo que te falta dicho en cosas que se
 * pueden hacer, y de dónde salen tus puntos. Si aún no sumas, cómo empezar,
 * con los valores de PUNTOS y un toque para hacerlo.
 */
function TarjetaTu({ yo, filas, participantes, mes, sumar }: { yo: Datos['yo']; filas: FilaRanking[]; participantes: number; mes: string; sumar: (a: Sumar) => void }) {
  const reducir = useReducedMotion();
  const meta = metaDelPuesto(filas, yo, participantes);
  const puntos = Math.max(0, yo.puntos ?? 0);
  const mia = filas.find((r) => r.uid === yo.uid);
  const puesto = yo.puesto ?? null;

  /* «Has subido 2 puestos desde tu última visita»: el puesto que viste la
     última vez se apunta en este navegador. Es solo una comodidad de la
     vista (el puesto de verdad lo da el servidor): sin almacenamiento, no
     sale y ya está. Cuenta dentro del mismo mes; el día 1 empieza de cero. */
  const [subida, setSubida] = useState(0);
  // El de la última visita se lee una vez: con él se compara mientras se mira.
  const visto = useRef<{ mes: string; puesto: number } | null | undefined>(undefined);
  useEffect(() => {
    if (!puesto || !mes) return;
    const clave = `divine:ranking-puesto:${yo.uid}`;
    try {
      if (visto.current === undefined) {
        const antes = JSON.parse(window.localStorage.getItem(clave) ?? 'null') as { mes?: unknown; puesto?: unknown } | null;
        visto.current = antes?.mes === mes && typeof antes.puesto === 'number' ? { mes, puesto: antes.puesto } : null;
      }
      const base = visto.current;
      setSubida(base && base.mes === mes && base.puesto > puesto ? base.puesto - puesto : 0);
      window.localStorage.setItem(clave, JSON.stringify({ mes, puesto }));
    } catch {
      /* navegador sin almacenamiento: sin aviso de subida */
    }
  }, [mes, puesto, yo.uid]);

  return (
    <motion.section
      className={c.tu}
      aria-labelledby="ranking-tu"
      initial={reducir ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducir ? { duration: 0 } : { delay: 0.3, duration: 0.45, ease: EASE_SALIDA }}
    >
      <header className={c.tuCabecera}>
        <span className={c.tuFoto} aria-hidden="true">
          <Avatar a={{ nombre: yo.nombre || 'Tú', foto: yo.foto, esSorela: false }} tam={48} />
          {mia?.nivel && <InsigniaNivel n={mia.nivel.n} size={20} className={c.filaInsignia} />}
        </span>
        <span className={c.tuQuien}>
          <span className={c.tuRotulo}>Tu mes</span>
          <h3 id="ranking-tu" className={c.tuTitulo}>
            {meta.titulo}
          </h3>
        </span>
        <span className={c.tuPuntos}>
          <Cuenta valor={puntos} retraso={0.45} />
          <small>pts</small>
        </span>
      </header>

      <AnimatePresence initial={false}>
        {subida > 0 && (
          <motion.p
            key="subida"
            className={c.tuSubida}
            role="status"
            initial={reducir ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reducir ? { duration: 0 } : { delay: 0.7, type: 'spring', stiffness: 380, damping: 22 }}
          >
            <motion.span
              className={c.tuSubidaFlecha}
              aria-hidden="true"
              initial={reducir ? false : { y: 4 }}
              animate={{ y: 0 }}
              transition={reducir ? { duration: 0 } : { delay: 0.9, repeat: 2, repeatType: 'reverse', duration: 0.35 }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </motion.span>
            {subida === 1 ? 'Subes un puesto desde tu última visita' : `Subes ${subida} puestos desde tu última visita`}
          </motion.p>
        )}
      </AnimatePresence>

      {meta.frase && <p className={c.tuFrase}>{meta.frase}</p>}

      {meta.barra && (
        <div className={c.tuMeta}>
          <span className={c.tuMetaPista} aria-hidden="true">
            <motion.span
              className={c.tuMetaRelleno}
              data-llena={meta.barra.valor >= 1 ? '' : undefined}
              initial={reducir ? false : { width: '0%' }}
              animate={{ width: `${Math.max(4, meta.barra.valor * 100)}%` }}
              transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 70, damping: 16, delay: 0.55 }}
            />
          </span>
          <span className={c.tuMetaEtiquetas} aria-hidden="true">
            <span>Tú</span>
            <span>{meta.barra.hasta}</span>
          </span>
        </div>
      )}

      {meta.extra && <p className={c.tuExtra}>{meta.extra}</p>}

      {meta.empezar ? (
        <div className={c.tuEmpezar}>
          <p className={c.tuRotulo}>Cómo empezar</p>
          <div className={c.tuAcciones}>
            {(['publicar', 'responder', 'clase'] as const).map((a) => (
              <button key={a} type="button" className={c.tuAccion} onClick={() => sumar(a)}>
                <span className={c.tuAccionIcono} aria-hidden="true">
                  <Icono nombre={ICONO_FUENTE[SUMAR[a].icono]} size={18} grosor={1.7} />
                </span>
                <b>+{formatoPuntos(SUMAR[a].puntos)}</b>
                <span>{SUMAR[a].texto}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <Desglose por={yo.por} puntos={puntos} retraso={0.6} />
          {meta.sugerencia && (
            <div className={c.tuSugerencia}>
              <p>{meta.sugerencia.texto}</p>
              <button type="button" className={c.tuBoton} onClick={() => sumar(meta.sugerencia!.accion)}>
                <Icono nombre={ICONO_FUENTE[SUMAR[meta.sugerencia.accion].icono]} size={16} grosor={1.8} />
                {SUMAR[meta.sugerencia.accion].boton}
              </button>
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}

/* ---------- El mes pasado ---------- */

function PodioAnterior({ mes, filas }: { mes: string; filas: FilaRanking[] }) {
  if (!filas.length) return null;
  const nombre = nombreMes(mes);
  return (
    <section className={c.anterior} aria-labelledby="ranking-anterior">
      <header className={c.anteriorCabecera}>
        <h3 id="ranking-anterior" className={c.anteriorTitulo}>
          El podio de {nombre}
        </h3>
        <span className={c.anteriorSub}>Así cerró el mes pasado</span>
      </header>
      <ol className={c.anteriorLista}>
        {filas.map((r, i) => (
          <li key={r.uid} data-puesto={i + 1}>
            <button type="button" className={c.anteriorBoton} onClick={() => verPerfil(r.uid)} aria-label={`Puesto ${i + 1} en ${nombre}: ${r.nombre}, ${formatoPuntos(r.puntos)} puntos. Ver su perfil`}>
              <span className={c.anteriorFoto}>
                <Avatar a={{ nombre: r.nombre, foto: r.foto ?? null, esSorela: false }} tam={i === 0 ? 48 : 40} />
                <Medalla puesto={(i + 1) as 1 | 2 | 3} size={22} className={c.anteriorMedalla} />
              </span>
              <span className={c.anteriorNombre}>{primerNombre(r.nombre)}</span>
              <span className={c.anteriorPuntos}>{formatoPuntos(r.puntos)} pts</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Cómo se suma ---------- */

function Leyenda() {
  const leyenda = SUMAN_AL_MES.map((f) => FORMAS_DE_SUMAR.find((x) => x.fuente === f)!).filter(Boolean);
  return (
    <div className={c.leyenda}>
      <p className={c.leyendaTitulo}>Cómo se suma este mes</p>
      <ul>
        {leyenda.map((x) => (
          <li key={x.fuente}>
            <span className={c.leyendaIcono} aria-hidden="true">
              <Icono nombre={ICONO_FUENTE[x.fuente]} size={17} grosor={1.7} />
            </span>
            <span className={c.leyendaTexto}>{x.corto}</span>
            <b className={c.leyendaPuntos}>+{formatoPuntos(x.puntos)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- La pestaña entera ---------- */

function RankingMes({ datos, sumar }: { datos: Datos; sumar: (a: Sumar) => void }) {
  const reducir = useReducedMotion();
  const filas = datos.ranking ?? [];
  const yo = datos.yo.puntua ? datos.yo : null;
  const [elegida, setElegida] = useState<string | null>(null);
  const base = useId();
  const idDetalle = `${base}-podio`;
  const max = Math.max(1, filas[0]?.puntos ?? 0);
  const participantes = datos.rankingMes?.participantes ?? filas.length;
  const mes = nombreMes(datos.rankingMes?.mes);
  const enPodio = filas.slice(0, 3).find((r) => r.uid === elegida) ?? null;
  const elegir = (uid: string) => setElegida((x) => (x === uid ? null : uid));

  return (
    <div className={c.rk}>
      <section className={c.rkHero} aria-labelledby="ranking-titulo">
        <header className={c.rkCabecera}>
          <span className={c.rkRotulo}>
            <Icono nombre="medalla" size={15} grosor={1.7} />
            Ranking del mes
          </span>
          <h2 id="ranking-titulo" className={c.rkTitulo}>
            Las más activas de {mes}
          </h2>
          <span className={c.rkDatos}>
            <span className={c.rkReinicio}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12.5" r="8" />
                <path d="M12 8.5v4l2.6 1.6M9.5 2.8h5" />
              </svg>
              {textoReinicio()}
            </span>
            {participantes > 0 && (
              <span className={c.rkCuantas}>
                {formatoPuntos(participantes)} {participantes === 1 ? 'compañera sumando' : 'compañeras sumando'}
              </span>
            )}
          </span>
        </header>

        {filas.length === 0 && (
          <p className={c.rkVacio}>
            <b>El oro de {mes} está libre.</b> La primera que publique, responda o termine una clase lo estrena.
          </p>
        )}

        <Podio filas={filas} yo={yo?.uid ?? null} elegida={enPodio?.uid ?? null} elegir={elegir} idDetalle={idDetalle} />

        <AnimatePresence initial={false}>
          {enPodio && (
            <motion.div
              key="detalle"
              id={idDetalle}
              className={c.rkDetalle}
              initial={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reducir ? 0 : 0.32, ease: EASE_SALIDA }}
            >
              <div className={c.rkDetalleDentro}>
                <p className={c.rkDetalleQuien}>
                  <b>{enPodio.nombre}</b>
                  <span>
                    {formatoPuntos(enPodio.puntos)} pts en {mes}
                  </span>
                </p>
                <Detalle r={enPodio} oscuro />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {yo && <TarjetaTu yo={yo} filas={filas} participantes={participantes} mes={datos.rankingMes?.mes ?? ''} sumar={sumar} />}

      {filas.length > 3 && (
        <section className={c.lista10} aria-label={`Del puesto 4 al ${filas.length}`}>
          <ol className={c.filas} start={4}>
            {filas.slice(3).map((r, k) => (
              <FilaPuesto
                key={r.uid}
                r={r}
                puesto={k + 4}
                max={max}
                soy={Boolean(yo && yo.uid === r.uid)}
                abierta={elegida === r.uid}
                alternar={() => elegir(r.uid)}
                id={`${base}-${r.uid}`}
                orden={k}
              />
            ))}
          </ol>
          <p className={c.filasNota}>Toca a cualquiera para ver de dónde salen sus puntos.</p>
        </section>
      )}

      <PodioAnterior mes={datos.podioAnterior?.mes ?? ''} filas={datos.podioAnterior?.filas ?? []} />

      <section className={c.rkLeyenda}>
        <Leyenda />
      </section>
    </div>
  );
}

/* ---------- El adelanto del lateral (ordenador) ---------- */

/**
 * En el ordenador, mientras se mira el muro, el lateral enseña el podio en
 * pequeño y cómo vas tú, con un botón a la pestaña del ranking. En el móvil
 * no sale: allí la pestaña está arriba, a un toque.
 */
function RankingResumen({ datos, abrir }: { datos: Datos; abrir: () => void }) {
  const filas = (datos.ranking ?? []).slice(0, 3);
  const yo = datos.yo.puntua ? datos.yo : null;
  return (
    <section className={`${c.ladoTarjeta} ${c.resumen}`} aria-labelledby="ranking-resumen">
      <header className={c.resumenCabecera}>
        <span className={c.resumenSello} aria-hidden="true">
          <Icono nombre="medalla" size={20} grosor={1.6} />
        </span>
        <span>
          <h2 id="ranking-resumen" className={c.resumenTitulo}>
            Ranking de {nombreMes(datos.rankingMes?.mes)}
          </h2>
          <span className={c.resumenSub}>{textoReinicio()}</span>
        </span>
      </header>
      {filas.length ? (
        <ol className={c.resumenPodio}>
          {filas.map((r, i) => (
            <li key={r.uid} data-puesto={i + 1}>
              <span className={c.resumenFoto}>
                <Avatar a={{ nombre: r.nombre, foto: r.foto ?? null, esSorela: false }} tam={i === 0 ? 52 : 42} />
                <Medalla puesto={(i + 1) as 1 | 2 | 3} size={20} className={c.resumenMedalla} />
              </span>
              <span className={c.resumenNombre}>{primerNombre(r.nombre)}</span>
              <span className={c.resumenPuntos}>{formatoPuntos(r.puntos)} pts</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={c.ladoTexto}>Nadie ha sumado todavía este mes: el oro está libre.</p>
      )}
      {yo && (
        <p className={c.resumenYo}>
          <b>Tú</b>
          <span aria-hidden="true">·</span>
          {yo.puesto ? `puesto ${yo.puesto}` : 'aún sin puesto'}
          <span aria-hidden="true">·</span>
          <b>{formatoPuntos(Math.max(0, yo.puntos ?? 0))} pts</b>
        </p>
      )}
      <button type="button" className={c.resumenBoton} onClick={abrir}>
        Ver el ranking completo
        {FLECHA}
      </button>
    </section>
  );
}

/* ---------- Conversación | Ranking ---------- */

type VistaComunidad = 'muro' | 'ranking';

/**
 * Las dos pestañas de arriba. Pestañas de verdad: flechas, Inicio y Fin para
 * moverse, y solo la elegida en el orden del tabulador. En la del ranking,
 * tu puesto, para que se vea de un vistazo cómo vas.
 */
function Pestanas({ ver, cambiar, puesto, ids }: { ver: VistaComunidad; cambiar: (v: VistaComunidad) => void; puesto: number | null; ids: Record<VistaComunidad, { tab: string; panel: string }> }) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const lista: VistaComunidad[] = ['muro', 'ranking'];

  function tecla(e: TeclaReact<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = lista.indexOf(ver);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? lista.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + lista.length) % lista.length;
    cambiar(lista[j]);
    botones.current[j]?.focus();
  }

  return (
    <LayoutGroup id="vista-comunidad">
      <div className={c.pestanas} role="tablist" aria-label="Comunidad" onKeyDown={tecla}>
        {lista.map((v, k) => {
          const on = ver === v;
          return (
            <button
              key={v}
              ref={(el) => {
                botones.current[k] = el;
              }}
              type="button"
              role="tab"
              id={ids[v].tab}
              aria-selected={on}
              aria-controls={ids[v].panel}
              tabIndex={on ? 0 : -1}
              className={c.pestana}
              onClick={() => cambiar(v)}
              data-guia={v === 'ranking' ? 'comunidad-ranking' : 'comunidad-muro'}
            >
              {on && <motion.span layoutId="pestana-activa" className={c.pestanaActiva} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className={c.pestanaDentro}>
                {v === 'muro' ? (
                  <>
                    <Icono nombre="respuestas" size={18} grosor={1.7} />
                    Conversación
                  </>
                ) : (
                  <>
                    <Icono nombre="medalla" size={18} grosor={1.7} />
                    <span>
                      Ranking<span className={c.pestanaResto}> del mes</span>
                    </span>
                    {puesto ? (
                      <span className={c.pestanaChip}>
                        <span aria-hidden="true">{puesto}.º</span>
                        <span className={c.soloLector}>, vas en el puesto {puesto}</span>
                      </span>
                    ) : null}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export default function Comunidad() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('Todo');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [visor, setVisor] = useState<{ fotos: string[]; i: number } | null>(null);
  const [confirmar, dialogo] = useConfirmar();
  const [avisar, aviso] = useAviso();
  /* Lo que se está borrando no vuelve a salir aunque la recarga de cada
     minuto llegue antes que la respuesta del servidor. */
  const borrando = useRef(new Set<string>());
  const reducir = useReducedMotion();

  /* Conversación o ranking. Se lee de la dirección después de montar (en el
     servidor no la hay) y se apunta en ella sin crear historial: recargar
     deja donde estabas. Con `?p=id` (abrir una publicación), el muro. El muro
     no se desmonta al mirar el ranking: un borrador a medias, con sus fotos,
     sigue ahí al volver. */
  const [ver, setVer] = useState<VistaComunidad>('muro');
  const [abrirEscribir, setAbrirEscribir] = useState(0);
  const base = useId();
  const ids: Record<VistaComunidad, { tab: string; panel: string }> = {
    muro: { tab: `${base}-tab-muro`, panel: `${base}-panel-muro` },
    ranking: { tab: `${base}-tab-ranking`, panel: `${base}-panel-ranking` },
  };

  useEffect(() => {
    const leer = () => {
      const q = new URLSearchParams(window.location.search);
      setVer(q.get('ver') === 'ranking' && !q.get('p') ? 'ranking' : 'muro');
    };
    leer();
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, []);

  const subir = useCallback(() => {
    try {
      window.scrollTo({ top: 0, behavior: reducir ? 'auto' : 'smooth' });
    } catch {
      /* da igual */
    }
  }, [reducir]);

  const cambiarVista = useCallback((v: VistaComunidad) => {
    setVer(v);
    try {
      const q = new URLSearchParams(window.location.search);
      if (v === 'ranking') q.set('ver', 'ranking');
      else q.delete('ver');
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q}`);
    } catch {
      /* sin historial: la pestaña cambia igual */
    }
  }, []);

  /* Desde el ranking: «Publicar ahora» abre el borrador, «Responder una
     duda» lleva a las dudas y «Ir al aula», al aula. */
  const sumar = useCallback(
    (a: Sumar) => {
      if (a === 'clase') return irA('aula');
      cambiarVista('muro');
      setFiltro(a === 'responder' ? 'Duda' : 'Todo');
      if (a === 'publicar') setAbrirEscribir((n) => n + 1);
      subir();
    },
    [cambiarVista, subir]
  );

  const verRanking = useCallback(() => {
    cambiarVista('ranking');
    subir();
  }, [cambiarVista, subir]);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/comunidad');
      const j = await r.json();
      if (j.ok) {
        setDatos({ ...j, publicaciones: (j.publicaciones as Pub[]).filter((x) => !borrando.current.has(x.id)) });
        setFallo(null);
      } else setFallo(j.motivo === 'sin-acceso' ? 'La comunidad es para quien tiene la Comunidad Divine o un curso.' : 'No he podido cargar la comunidad.');
    } catch {
      setFallo('No hay conexión.');
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(() => document.visibilityState === 'visible' && cargar(), 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  /* Desde el perfil de alguien se llega con `?p=id`: esa publicación se abre
     con sus respuestas y se baja hasta ella. Solo la primera vez. */
  const destino = useRef(typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('p'));
  useEffect(() => {
    const id = destino.current;
    if (!id || !datos) return;
    destino.current = null;
    if (!datos.publicaciones.some((x) => x.id === id)) return;
    setAbierta(id);
    window.setTimeout(() => document.getElementById(`pub-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [datos]);

  const cambiar = useCallback(
    (id: string, f: (p: Pub) => Pub) =>
      setDatos((d) => (d ? { ...d, publicaciones: d.publicaciones.map((x) => (x.id === id ? f(x) : x)) } : d)),
    []
  );

  /* Borrar una publicación: sale de la lista al momento. Si el servidor dice
     que no, vuelve a su sitio y se avisa. Si ya no existía, se da por borrada. */
  const borrar = useCallback(
    async (p: Pub) => {
      const sitio = datos?.publicaciones.findIndex((x) => x.id === p.id) ?? -1;
      borrando.current.add(p.id);
      setDatos((d) => (d ? { ...d, publicaciones: d.publicaciones.filter((x) => x.id !== p.id) } : d));
      setAbierta((x) => (x === p.id ? null : x));
      const j = await (
        await fetch('/api/comunidad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'borrar', id: p.id }) }).catch(
          () => new Response('{}')
        )
      )
        .json()
        .catch(() => ({ ok: false }));
      if (j.ok || j.motivo === 'no-existe') {
        window.dispatchEvent(new Event('divine:logros'));
        cargar(); // el ranking y los contadores, al día
        return;
      }
      borrando.current.delete(p.id);
      setDatos((d) => {
        if (!d || d.publicaciones.some((x) => x.id === p.id)) return d;
        const l = [...d.publicaciones];
        l.splice(sitio < 0 ? 0 : Math.min(sitio, l.length), 0, p);
        return { ...d, publicaciones: l };
      });
      avisar(j.motivo === 'sin-permiso' ? 'Esta publicación no la puedes borrar.' : 'No se ha podido borrar la publicación. Revisa la conexión e inténtalo otra vez.');
    },
    [datos, cargar, avisar]
  );

  const sinResponder = useMemo(
    () => (datos?.publicaciones ?? []).filter((p) => !p.resuelta && !p.respondioSorela && !p.autora.esSorela),
    [datos]
  );

  const lista = useMemo(() => {
    const ps = datos?.publicaciones ?? [];
    if (filtro === 'Todo') return ps;
    if (filtro === 'Sin responder') return sinResponder;
    return ps.filter((p) => p.categoria === filtro);
  }, [datos, filtro, sinResponder]);

  if (fallo && !datos)
    return (
      <Vacio icono={ICONO_CHARLA} titulo="No se ha podido abrir la comunidad">
        <p>{fallo}</p>
        <button type="button" className={c.vacioBoton} onClick={cargar}>
          Reintentar
        </button>
      </Vacio>
    );

  const filtros: Filtro[] = ['Todo', ...CATEGORIAS_COMUNIDAD, ...(datos?.modera ? (['Sin responder'] as Filtro[]) : [])];

  return (
    <MotionConfig reducedMotion="user">
      <div className={c.comunidad}>
        <div className={c.centro}>
          <Pestanas ver={ver} cambiar={cambiarVista} puesto={datos?.yo.puntua ? (datos.yo.puesto ?? null) : null} ids={ids} />

          <div role="tabpanel" id={ids.ranking.panel} aria-labelledby={ids.ranking.tab} hidden={ver !== 'ranking'} className={c.vistaRanking}>
            {ver === 'ranking' && (datos ? <RankingMes datos={datos} sumar={sumar} /> : <div className={c.esqueleto} data-alto="" />)}
          </div>

          <div role="tabpanel" id={ids.muro.panel} aria-labelledby={ids.muro.tab} hidden={ver !== 'muro'} className={c.vistaMuro}>
            {datos?.puedeEscribir && <Escribir yo={datos.yo} modera={datos.modera} alPublicar={cargar} confirmar={confirmar} abrirSenal={abrirEscribir} />}
            {datos && !datos.puedeEscribir && (
              <section className={c.visita}>
                <strong>Estás de visita.</strong> Puedes leerlo todo y dar «me gusta». Para publicar y responder hace falta la Comunidad
                Divine: entras al terminar la formación.
              </section>
            )}

            <LayoutGroup id="filtros">
              <div className={c.filtros} role="tablist">
                {filtros.map((f) => (
                  <button key={f} type="button" role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}>
                    {filtro === f && <motion.span layoutId="filtro-activo" className={c.filtroActivo} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span>
                      {f === 'Todo' ? 'Todo' : f === 'Sin responder' ? `Sin responder${sinResponder.length ? ` · ${sinResponder.length}` : ''}` : SOBRE_CATEGORIA[f].plural}
                    </span>
                  </button>
                ))}
              </div>
            </LayoutGroup>

            {!datos && (
              <>
                <div className={c.esqueleto} />
                <div className={c.esqueleto} />
              </>
            )}

            {/* La bienvenida, fija arriba para todas. Abierta mientras la
                comunidad está vacía; recogida cuando ya hay conversación. */}
            {datos && (filtro === 'Todo' || filtro === 'Anuncio') && (
              <Bienvenida sorela={datos.sorela} puedeEscribir={datos.puedeEscribir} abiertaAlEmpezar={datos.publicaciones.length === 0} />
            )}

            <motion.div layout className={c.lista}>
              <AnimatePresence initial={false} mode="popLayout">
                {lista.map((p) => (
                  <Tarjeta
                    key={p.id}
                    p={p}
                    datos={datos!}
                    abierta={abierta === p.id}
                    alternar={() => setAbierta((x) => (x === p.id ? null : p.id))}
                    refrescar={cargar}
                    verFotos={(fotos, i) => setVisor({ fotos, i })}
                    confirmar={confirmar}
                    avisar={avisar}
                    borrar={borrar}
                    cambiar={cambiar}
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {datos && lista.length === 0 && (
              datos.publicaciones.length === 0 ? (
                <Vacio icono={ICONO_CHARLA} titulo="Todavía no hay conversación">
                  <p>{datos.puedeEscribir ? 'Preséntate y abre tú la conversación: quién eres, dónde trabajas, qué te trae aquí.' : 'Cuando alguien publique, lo verás aquí.'}</p>
                </Vacio>
              ) : filtro === 'Sin responder' ? (
                <Vacio
                  icono={
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  }
                  titulo="Todo respondido"
                >
                  <p>No queda nadie esperando tu respuesta.</p>
                </Vacio>
              ) : (
                <Vacio icono={ICONO_CHARLA} titulo="Nada en esta sección todavía">
                  <p>{datos.puedeEscribir ? 'Puedes ser la primera en publicar aquí, o mirar en «Todo».' : 'Mira en «Todo» para ver lo último.'}</p>
                </Vacio>
              )
            )}
          </div>
        </div>

        <aside className={c.lado}>
          {datos && <Clase key={datos.proximaClase?.cuando ?? 'nada'} clase={datos.proximaClase} modera={datos.modera} puedeEntrar={datos.puedeEscribir} guardado={cargar} />}

          {datos?.modera && (
            <section className={c.ladoTarjeta}>
              <p className={c.ladoRotulo}>Esperando tu respuesta</p>
              {sinResponder.length === 0 ? (
                <p className={c.ladoTexto}>Nada sin responder. Cuando alguien publique y no le hayas contestado, te sale aquí.</p>
              ) : (
                <ul className={c.pendientes}>
                  {sinResponder.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          // Si estaba mirando el ranking, primero vuelve al muro (y se baja cuando ya se ve).
                          cambiarVista('muro');
                          setFiltro('Todo');
                          setAbierta(p.id);
                          window.setTimeout(() => document.getElementById(`pub-${p.id}`)?.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth' }), 60);
                        }}
                      >
                        <strong>{p.titulo}</strong>
                        <span>{p.autora.nombre} · {hace(p.creado)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {datos && ver === 'muro' && <RankingResumen datos={datos} abrir={verRanking} />}

          <section className={c.ladoTarjeta}>
            <p className={c.ladoRotulo}>Cómo funciona</p>
            <ul className={c.normas}>
              <li>Casos reales, sin caras ni nombres de clientas sin su permiso.</li>
              <li>Lo que se comparte aquí es de la comunidad: no se saca fuera.</li>
              <li>Se pregunta sin miedo y se responde con cariño.</li>
              <li>Sorela lee todo y responde las dudas técnicas.</li>
            </ul>
          </section>
        </aside>

        <AnimatePresence>{visor && <Visor fotos={visor.fotos} inicio={visor.i} cerrar={() => setVisor(null)} />}</AnimatePresence>
        {dialogo}
        {aviso}
      </div>
    </MotionConfig>
  );
}
