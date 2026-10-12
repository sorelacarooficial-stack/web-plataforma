'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  CATEGORIAS_COMUNIDAD,
  SOBRE_CATEGORIA,
  type Autora,
  type CategoriaComunidad,
  type ProximaClase,
  type Publicacion,
  type Respuesta,
} from '@/lib/comunidad-tipos';
import css from './plataforma.module.css';
import c from './comunidad.module.css';

/**
 * La comunidad de terapeutas: casos, dudas y resultados entre todas, con
 * Sorela respondiendo y moderando.
 *
 * Quien tiene la Comunidad Divine publica y responde. Quien tiene solo un
 * curso entra de visita: lee y puede dar «me gusta», que es como se engancha
 * antes de dar el paso. Ver app/api/comunidad.
 */

type Datos = {
  puedeEscribir: boolean;
  modera: boolean;
  yo: { uid: string; nombre: string; foto: string | null };
  publicaciones: Publicacion[];
  ranking: { uid: string; nombre: string; puntos: number }[];
  proximaClase: ProximaClase;
};

type Filtro = 'Todo' | CategoriaComunidad | 'Sin responder';

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
  return (
    <span className={c.nombre}>
      {a.nombre}
      {a.esSorela && <span className={c.selloSorela}>✦ Sorela</span>}
    </span>
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

function Escribir({ yo, modera, alPublicar }: { yo: Datos['yo']; modera: boolean; alPublicar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaComunidad>('Caso');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<{ ruta: string; url: string }[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);

  const categorias = CATEGORIAS_COMUNIDAD.filter((x) => modera || x !== 'Anuncio');

  async function subir(lista: FileList | null) {
    if (!lista) return;
    setSubiendo(true);
    for (const f of [...lista].slice(0, 4 - fotos.length)) {
      const fd = new FormData();
      fd.append('archivo', f);
      try {
        const j = await (await fetch('/api/comunidad/imagen', { method: 'POST', body: fd })).json();
        if (j.ok) setFotos((x) => [...x, { ruta: j.ruta, url: j.url }]);
        else setErrores({ fotos: j.texto || 'No he podido subir la foto.' });
      } catch {
        setErrores({ fotos: 'No hay conexión.' });
      }
    }
    setSubiendo(false);
  }

  async function publicar() {
    setEnviando(true);
    setErrores({});
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
        setTitulo('');
        setTexto('');
        setFotos([]);
        setAbierto(false);
        alPublicar();
      }
    } catch {
      setErrores({ general: 'No hay conexión.' });
    }
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
          <input className={c.campoTitulo} placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} autoFocus />
          {errores.titulo && <span className={c.error}>{errores.titulo}</span>}
          <textarea className={c.campoTexto} placeholder="Cuéntalo con detalle: qué tenía, qué hiciste, qué notaste…" value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={5000} />
          {errores.texto && <span className={c.error}>{errores.texto}</span>}
          {fotos.length > 0 && (
            <div className={c.fotosNuevas}>
              {fotos.map((f) => (
                <span key={f.ruta}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" />
                  <button type="button" onClick={() => setFotos((x) => x.filter((y) => y.ruta !== f.ruta))} aria-label="Quitar foto">
                    ✕
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
            <button type="button" className={css.enlaceAccion} onClick={() => setAbierto(false)}>
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

/* ---------- Una publicación ---------- */

function Tarjeta({
  p,
  datos,
  abierta,
  alternar,
  refrescar,
  verFotos,
}: {
  p: Publicacion;
  datos: Datos;
  abierta: boolean;
  alternar: () => void;
  refrescar: () => void;
  verFotos: (fotos: string[], i: number) => void;
}) {
  const [larga, setLarga] = useState(false);
  const [menu, setMenu] = useState(false);
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
      await cargarHilo();
      refrescar();
    }
  }

  async function moderar(a: 'fijar' | 'resolver' | 'borrar') {
    setMenu(false);
    if (a === 'borrar' && !window.confirm('¿Borrar esta publicación y sus respuestas?')) return;
    const j = await accion({ accion: a });
    if (j.ok) refrescar();
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
        {(datos.modera || p.esMia) && (
          <span className={c.menuEnvoltura}>
            <button type="button" className={c.menuBoton} onClick={() => setMenu((m) => !m)} aria-label="Opciones">
              ···
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div className={c.menu} initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
                  {datos.modera && <button type="button" onClick={() => moderar('fijar')}>{p.fijada ? 'Quitar de arriba' : 'Fijar arriba'}</button>}
                  <button type="button" onClick={() => moderar('resolver')}>{p.resuelta ? 'Marcar sin resolver' : 'Marcar como resuelta'}</button>
                  <button type="button" className={c.peligro} onClick={() => moderar('borrar')}>Borrar</button>
                </motion.div>
              )}
            </AnimatePresence>
          </span>
        )}
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
              {respuestas?.map((r) => (
                <div key={r.id} className={c.respuesta} data-sorela={r.autora.esSorela ? '' : undefined}>
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
                        <button
                          type="button"
                          className={c.borrarRespuesta}
                          onClick={async () => {
                            if (!window.confirm('¿Borrar esta respuesta?')) return;
                            const j = await accion({ accion: 'borrar', rid: r.id });
                            if (j.ok) {
                              setRespuestas((l) => l?.filter((x) => x.id !== r.id) ?? l);
                              refrescar();
                            }
                          }}
                        >
                          Borrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {datos.puedeEscribir ? (
                <div className={c.responder}>
                  <Avatar a={{ nombre: datos.yo.nombre || 'Tú', foto: datos.yo.foto, esSorela: datos.modera }} tam={32} />
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder={datos.modera ? 'Responde como Sorela…' : 'Escribe tu respuesta…'}
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

export default function Comunidad() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('Todo');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [visor, setVisor] = useState<{ fotos: string[]; i: number } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/comunidad');
      const j = await r.json();
      if (j.ok) {
        setDatos(j);
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

  if (fallo && !datos) return <p className={c.vacio}>{fallo}</p>;

  const filtros: Filtro[] = ['Todo', ...CATEGORIAS_COMUNIDAD, ...(datos?.modera ? (['Sin responder'] as Filtro[]) : [])];

  return (
    <div className={c.comunidad}>
      <div className={c.centro}>
        {datos?.puedeEscribir && <Escribir yo={datos.yo} modera={datos.modera} alPublicar={cargar} />}
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
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {datos && lista.length === 0 && (
          <div className={c.vacio}>
            {datos.publicaciones.length === 0
              ? datos.modera
                ? 'Todavía no ha publicado nadie. Un anuncio de bienvenida tuyo es la mejor forma de abrirla.'
                : 'Todavía no ha publicado nadie. La primera que escriba abre la comunidad.'
              : filtro === 'Sin responder'
                ? '¡Todo respondido! No queda nadie esperando.'
                : 'Nada en esta sección todavía.'}
          </div>
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

        <section className={c.ladoTarjeta}>
          <p className={c.ladoRotulo}>Más activas este mes</p>
          {!datos || datos.ranking.length === 0 ? (
            <p className={c.ladoTexto}>Suma quien publica casos y responde a las demás. Todavía no hay nadie: la primera se lleva el oro.</p>
          ) : (
            <ol className={c.ranking}>
              {datos.ranking.map((r, i) => (
                <li key={r.uid}>
                  <span className={c.puesto} data-p={i}>{i + 1}</span>
                  <span className={c.rankingNombre}>{r.nombre}</span>
                  <span className={c.puntos}>{r.puntos} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>

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
    </div>
  );
}
