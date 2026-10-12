'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
  CATEGORIAS_COMUNIDAD,
  SOBRE_CATEGORIA,
  type Autora,
  type CategoriaComunidad,
  type ProximaClase,
  type Publicacion,
  type Respuesta,
} from '@/lib/comunidad-tipos';
import { PUNTOS, formatoPuntos } from '@/lib/puntos-tipos';
import Bienvenida from './Bienvenida';
import { useAviso, useConfirmar, type OpcionesConfirmar } from './Confirmar';
import css from './plataforma.module.css';
import c from './comunidad.module.css';
import { verPerfil } from '@/lib/navegar';
import { leerRespuesta, prepararImagen } from '@/lib/imagen-cliente';

/**
 * La comunidad de terapeutas: casos, dudas y resultados entre todas, con
 * Sorela respondiendo y moderando.
 *
 * Quien tiene la Comunidad Divine publica y responde. Quien tiene solo un
 * curso entra de visita: lee y puede dar «me gusta», que es como se engancha
 * antes de dar el paso. Ver app/api/comunidad.
 */

type FilaRanking = { uid: string; nombre: string; puntos: number; nivel?: { n: number; nombre: string } | null };

type Datos = {
  puedeEscribir: boolean;
  modera: boolean;
  /* Quién eres y cómo vas este mes en el ranking. Sorela no puntúa: le llega
     `puntua: false` y no se le enseña la fila «Tú». */
  yo: { uid: string; nombre: string; foto: string | null; puntua?: boolean; puesto?: number | null; puntos?: number };
  publicaciones: Publicacion[];
  ranking: FilaRanking[];
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
  // Tocar el nombre abre su perfil, como en Instagram.
  return (
    <button type="button" className={c.nombre} onClick={() => verPerfil(a.uid)} title={`Ver el perfil de ${a.nombre}`}>
      {a.nombre}
      {a.esSorela && <span className={c.selloSorela}>✦ Sorela</span>}
    </button>
  );
}

function Corazon({ dado, cuenta, alPulsar }: { dado: boolean; cuenta: number; alPulsar: () => void }) {
  return (
    <button type="button" className={c.accion} data-on={dado ? '' : undefined} onClick={alPulsar} aria-pressed={dado} aria-label="Me gusta">
      <motion.svg key={String(dado)} viewBox="0 0 24 24" width="17" height="17" initial={{ scale: dado ? 0.6 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
        <path
          d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
          fill={dado ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </motion.svg>
      {cuenta > 0 && <span>{cuenta}</span>}
    </button>
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

function Escribir({ yo, modera, alPublicar, confirmar }: { yo: Datos['yo']; modera: boolean; alPublicar: () => void; confirmar: Confirmar }) {
  const [abierto, setAbierto] = useState(false);
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
    <motion.section layout className={c.escribir} data-abierto={abierto ? '' : undefined}>
      {!abierto ? (
        <button type="button" className={c.escribirCerrado} onClick={() => setAbierto(true)}>
          <Avatar a={{ nombre: yo.nombre || 'Tú', foto: yo.foto, esSorela: modera }} />
          <span>{modera ? 'Escribe a la comunidad: un anuncio, un consejo, una respuesta…' : 'Comparte un caso, una duda o un resultado…'}</span>
          <span className={c.escribirBoton}>Publicar</span>
        </button>
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
  p: Publicacion;
  datos: Datos;
  abierta: boolean;
  alternar: () => void;
  refrescar: () => void;
  verFotos: (fotos: string[], i: number) => void;
  confirmar: Confirmar;
  avisar: Avisar;
  /** Borra la publicación (de la lista al momento; vuelve si falla). */
  borrar: (p: Publicacion) => void;
  /** Cambia la publicación en la lista sin esperar a recargar. */
  cambiar: (id: string, f: (p: Publicacion) => Publicacion) => void;
}) {
  const reducir = useReducedMotion();
  const [larga, setLarga] = useState(false);
  const [mg, setMg] = useState({ dado: p.loHeDado, n: p.meGusta });
  const [respuestas, setRespuestas] = useState<Respuesta[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setMg({ dado: p.loHeDado, n: p.meGusta }), [p.loHeDado, p.meGusta]);

  const cargarHilo = useCallback(async () => {
    const j = await (await fetch(`/api/comunidad?id=${encodeURIComponent(p.id)}`)).json().catch(() => ({ ok: false }));
    if (j.ok) setRespuestas(j.respuestas);
  }, [p.id]);

  useEffect(() => {
    if (abierta && !respuestas) cargarHilo();
  }, [abierta, respuestas, cargarHilo]);

  const accion = async (cuerpo: Record<string, unknown>) =>
    (await fetch('/api/comunidad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, ...cuerpo }) })).json().catch(() => ({ ok: false }));

  async function meGusta() {
    setMg((x) => ({ dado: !x.dado, n: x.n + (x.dado ? -1 : 1) }));
    const j = await accion({ accion: 'meGusta' });
    if (!j.ok) setMg({ dado: p.loHeDado, n: p.meGusta });
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
  async function borrarRespuesta(r: Respuesta) {
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
        <Avatar a={p.autora} />
        <span className={c.quien}>
          <Nombre a={p.autora} />
          <span className={c.cuando}>
            {hace(p.creado)} · <b data-cat={p.categoria}>{p.categoria}</b>
          </span>
        </span>
        <span className={c.sellos}>
          {p.fijada && <span className={c.selloFijada}>📌 Fijada</span>}
          {p.resuelta && <span className={c.selloResuelta}>✓ Resuelta</span>}
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
                    <Avatar a={r.autora} tam={32} />
                    <div className={c.respuestaCuerpo}>
                      <div className={c.respuestaCabecera}>
                        <Nombre a={r.autora} />
                        <span className={c.cuando}>{hace(r.creado)}</span>
                      </div>
                      <p>{r.texto}</p>
                      <div className={c.respuestaPie}>
                        <Corazon
                          dado={r.loHeDado}
                          cuenta={r.meGusta}
                          alPulsar={async () => {
                            setRespuestas((l) => l?.map((x) => (x.id === r.id ? { ...x, loHeDado: !x.loHeDado, meGusta: x.meGusta + (x.loHeDado ? -1 : 1) } : x)) ?? l);
                            await accion({ accion: 'meGusta', rid: r.id });
                          }}
                        />
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

/* ---------- Más activas este mes ---------- */

/**
 * El ranking del mes: barras que crecen en proporción a la primera, oro,
 * plata y bronce para el podio, el nivel de cada una y, debajo, cómo vas tú.
 * Así se entiende de un vistazo quién lleva cuánto y qué hace falta para
 * entrar.
 */
function Ranking({ filas, yo }: { filas: FilaRanking[]; yo: Datos['yo'] | null }) {
  const reducir = useReducedMotion();
  const max = Math.max(1, filas[0]?.puntos ?? 0);
  const mio = yo?.puntua ? { puesto: yo.puesto ?? null, puntos: Math.max(0, yo.puntos ?? 0) } : null;

  return (
    <section className={c.ladoTarjeta} aria-labelledby="ranking-titulo">
      <h2 id="ranking-titulo" className={c.ladoRotulo}>
        Más activas este mes
      </h2>
      {filas.length === 0 ? (
        <p className={c.ladoTexto}>Suma quien publica casos, responde a las demás y termina clases. Todavía no hay nadie: la primera se lleva el oro.</p>
      ) : (
        <ol className={c.ranking}>
          {filas.map((r, i) => (
            <li key={r.uid} data-yo={yo && r.uid === yo.uid ? '' : undefined}>
              {/* El puesto ya lo dice la lista ordenada al lector de pantalla. */}
              <span className={c.puesto} data-p={i} aria-hidden="true">
                {i + 1}
              </span>
              <div className={c.rankingCuerpo}>
                <div className={c.rankingLinea}>
                  <button type="button" className={c.rankingNombre} onClick={() => verPerfil(r.uid)} title={`Ver el perfil de ${r.nombre}`}>
                    {r.nombre}
                  </button>
                  <span className={c.puntos}>
                    {formatoPuntos(r.puntos)} <small>pts</small>
                  </span>
                </div>
                <span className={c.rankingPista} aria-hidden="true">
                  <motion.span
                    className={c.rankingRelleno}
                    data-p={i}
                    initial={reducir ? false : { width: '0%' }}
                    animate={{ width: `${Math.max(4, (r.puntos / max) * 100)}%` }}
                    transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 17, delay: 0.15 + i * 0.09 }}
                  />
                </span>
                {r.nivel && (
                  <span className={c.chipNivel}>
                    <span className={c.chipNumero} aria-hidden="true">
                      {r.nivel.n}
                    </span>
                    <span className={c.soloLector}>Nivel {r.nivel.n}: </span>
                    {r.nivel.nombre}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {mio && (filas.length > 0 || mio.puntos > 0) && (
        <p className={c.rankingYo}>
          <b>Tú</b>
          <span aria-hidden="true">·</span>
          {mio.puesto ? `puesto ${mio.puesto}` : 'aún sin puesto'}
          <span aria-hidden="true">·</span>
          <span>
            <b>{formatoPuntos(mio.puntos)} pts</b> este mes
          </span>
        </p>
      )}
      <p className={c.rankingComo}>
        Publicar <b>+{PUNTOS.publicacion}</b> · Responder a otra <b>+{PUNTOS.respuesta}</b> · Cada «me gusta» que recibes{' '}
        <b>+{PUNTOS.meGusta}</b> · Terminar una clase <b>+{PUNTOS.clase}</b>
      </p>
    </section>
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

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/comunidad');
      const j = await r.json();
      if (j.ok) {
        setDatos({ ...j, publicaciones: (j.publicaciones as Publicacion[]).filter((x) => !borrando.current.has(x.id)) });
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

  const cambiar = useCallback(
    (id: string, f: (p: Publicacion) => Publicacion) =>
      setDatos((d) => (d ? { ...d, publicaciones: d.publicaciones.map((x) => (x.id === id ? f(x) : x)) } : d)),
    []
  );

  /* Borrar una publicación: sale de la lista al momento. Si el servidor dice
     que no, vuelve a su sitio y se avisa. Si ya no existía, se da por borrada. */
  const borrar = useCallback(
    async (p: Publicacion) => {
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
    <div className={c.comunidad}>
      <div className={c.centro}>
        {datos?.puedeEscribir && <Escribir yo={datos.yo} modera={datos.modera} alPublicar={cargar} confirmar={confirmar} />}
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
                    <button type="button" onClick={() => { setFiltro('Todo'); setAbierta(p.id); document.getElementById(`pub-${p.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}>
                      <strong>{p.titulo}</strong>
                      <span>{p.autora.nombre} · {hace(p.creado)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <Ranking filas={datos?.ranking ?? []} yo={datos?.yo ?? null} />

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
  );
}
