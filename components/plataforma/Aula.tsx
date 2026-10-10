'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  esVideoPropio,
  minutos,
  porBloques,
  urlDeVideo,
  type Leccion,
  type Progreso,
} from '@/lib/aula';
import css from './plataforma.module.css';
import a from './aula.module.css';

/**
 * El aula de la alumna.
 *
 * Una sola pantalla con lo que hace falta para estudiar: el vídeo grande con
 * sus capítulos, el progreso del curso a la derecha y, debajo, los módulos y la
 * lista de clases. Se abre directamente en la clase por la que va, para que
 * entrar sea seguir donde lo dejó y no buscar.
 *
 * Los vídeos del almacén propio se ven con un enlace que caduca, sin botón de
 * descarga y con el correo de quien mira flotando encima. Los de YouTube que
 * queden de antes siguen funcionando igual que siempre.
 */

type Mapa = Record<string, Progreso>;

const GUARDAR_CADA = 10; // segundos

function Anillo({ valor }: { valor: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 128 128" className={a.anillo} role="img" aria-label={`${valor}% completado`}>
      <circle cx="64" cy="64" r={r} className={a.anilloFondo} />
      <motion.circle
        cx="64"
        cy="64"
        r={r}
        className={a.anilloValor}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - valor / 100) }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <text x="64" y="62" textAnchor="middle" className={a.anilloNumero}>
        {valor}%
      </text>
      <text x="64" y="82" textAnchor="middle" className={a.anilloTexto}>
        completado
      </text>
    </svg>
  );
}

export default function Aula({ correo }: { correo?: string | null }) {
  const [lecciones, setLecciones] = useState<Leccion[] | null>(null);
  const [progreso, setProgreso] = useState<Mapa>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [actualId, setActualId] = useState<string | null>(null);
  const [modulo, setModulo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [fuente, setFuente] = useState<{ id: string; url: string } | null>(null);
  const [falloVideo, setFalloVideo] = useState(false);
  const [inicioYoutube, setInicioYoutube] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const ultimoGuardado = useRef(0);

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const [rl, rp] = await Promise.all([fetch('/api/lecciones'), fetch('/api/progreso')]);
      const cl = await rl.json().catch(() => ({ ok: false }));
      const cp = await rp.json().catch(() => ({ ok: false }));
      if (!cl.ok) {
        setFallo(cl.motivo === 'sin-configurar' ? 'Falta la configuración del servidor.' : 'No he podido cargar tus clases.');
        setLecciones([]);
        return;
      }
      setLecciones(cl.lecciones ?? []);
      setProgreso(cp.ok ? cp.progreso ?? {} : {});
    } catch {
      setFallo('No hay conexión con el servidor.');
      setLecciones([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Todas las clases en el orden del curso, y su módulo. */
  const ordenadas = useMemo(() => {
    if (!lecciones) return [];
    return porBloques(lecciones).flatMap((b) =>
      b.lecciones.map((l) => ({ ...l, modulo: l.modulo || b.nombre }))
    );
  }, [lecciones]);

  const modulos = useMemo(() => {
    const m = new Map<string, Leccion[]>();
    for (const l of ordenadas) {
      const k = l.modulo as string;
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.entries()].map(([nombre, ls]) => ({
      nombre,
      lecciones: ls,
      hechas: ls.filter((l) => progreso[l.id]?.completada).length,
    }));
  }, [ordenadas, progreso]);

  /* Se abre en la primera que no ha terminado: entrar es seguir. */
  const siguiente = ordenadas.find((l) => !progreso[l.id]?.completada) ?? ordenadas[0];
  const actual = ordenadas.find((l) => l.id === actualId) ?? siguiente ?? null;

  const hechas = ordenadas.filter((l) => progreso[l.id]?.completada).length;
  const porcentaje = ordenadas.length ? Math.round((hechas / ordenadas.length) * 100) : 0;
  const segundosVistos = Object.values(progreso).reduce((s, p) => s + (p.visto || 0), 0);

  /* El enlace del vídeo propio, que caduca: se pide al abrir cada clase. */
  useEffect(() => {
    setFalloVideo(false);
    if (!actual || !esVideoPropio(actual.video)) {
      setFuente(null);
      return;
    }
    let vivo = true;
    fetch(`/api/lecciones/video?id=${encodeURIComponent(actual.id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (j.ok) setFuente({ id: actual.id, url: j.url });
        else setFalloVideo(true);
      })
      .catch(() => vivo && setFalloVideo(true));
    return () => {
      vivo = false;
    };
  }, [actual?.id, actual?.video]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = useCallback((id: string, visto: number, completada = false) => {
    setProgreso((p) => ({
      ...p,
      [id]: { visto, completada: completada || Boolean(p[id]?.completada) },
    }));
    fetch('/api/progreso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, visto, completada }),
    }).catch(() => {});
  }, []);

  const abrir = (id: string) => {
    setActualId(id);
    setInicioYoutube(0);
    try {
      document.getElementById('aula-reproductor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      /* da igual */
    }
  };

  const saltar = (t: number) => {
    if (!actual) return;
    if (esVideoPropio(actual.video) && video.current) {
      video.current.currentTime = t;
      video.current.play().catch(() => {});
    } else {
      setInicioYoutube(t);
    }
  };

  if (lecciones === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando tus clases…</p>
      </div>
    );
  }

  if (!actual) {
    return (
      <div className={css.columna}>
        {fallo && (
          <p className={css.avisoFallo} role="alert">
            {fallo}{' '}
            <button type="button" className={css.btnLinea} onClick={cargar}>
              Reintentar
            </button>
          </p>
        )}
        <section className={css.tarjeta}>
          <p className={css.vacioTexto}>
            Todavía no hay ninguna clase publicada para ti. En cuanto Sorela suba la primera, la
            verás aquí sin tener que hacer nada.
          </p>
        </section>
      </div>
    );
  }

  const t = busca.trim().toLowerCase();
  const lista = ordenadas.filter(
    (l) => (!modulo || l.modulo === modulo) && (!t || l.titulo.toLowerCase().includes(t))
  );
  const pActual = progreso[actual.id];

  return (
    <div className={a.aula}>
      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={css.btnLinea} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}

      <div className={a.principal}>
        {/* ---------- El vídeo ---------- */}
        <section className={a.reproductor} id="aula-reproductor" aria-label="Clase">
          <div className={a.pantalla} onContextMenu={(e) => e.preventDefault()}>
            {esVideoPropio(actual.video) ? (
              fuente?.id === actual.id ? (
                <video
                  key={fuente.url}
                  ref={video}
                  src={fuente.url}
                  poster={actual.portada}
                  controls
                  playsInline
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    const desde = pActual?.visto ?? 0;
                    if (desde > 5 && desde < v.duration - 10) v.currentTime = desde;
                  }}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (Math.abs(v.currentTime - ultimoGuardado.current) >= GUARDAR_CADA) {
                      ultimoGuardado.current = v.currentTime;
                      guardar(actual.id, v.currentTime, v.duration > 0 && v.currentTime / v.duration > 0.9);
                    }
                  }}
                  onEnded={(e) => guardar(actual.id, e.currentTarget.duration, true)}
                />
              ) : (
                <div className={a.cargandoVideo}>
                  {falloVideo ? 'No he podido abrir este vídeo. Prueba en un momento.' : 'Preparando la clase…'}
                </div>
              )
            ) : (
              <iframe
                key={`${actual.id}-${inicioYoutube}`}
                src={`${urlDeVideo(actual.video)}${inicioYoutube ? `&start=${Math.floor(inicioYoutube)}&autoplay=1` : ''}`}
                title={actual.titulo}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen; autoplay"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )}
            {/* Quién está mirando. Si alguien graba la pantalla, la grabación
                lleva su nombre. */}
            {correo && esVideoPropio(actual.video) && (
              <span className={a.marca} aria-hidden="true">
                {correo}
              </span>
            )}
          </div>

          <div className={a.ficha}>
            <div className={a.fichaTexto}>
              <span className={a.modulo}>{actual.modulo}</span>
              <h2 className={a.titulo}>{actual.titulo}</h2>
              {actual.descripcion && <p className={a.descripcion}>{actual.descripcion}</p>}
            </div>
            <button
              type="button"
              className={pActual?.completada ? a.vista : a.marcarVista}
              onClick={() => guardar(actual.id, pActual?.visto ?? 0, true)}
              disabled={pActual?.completada}
            >
              {pActual?.completada ? (
                <>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Clase completada
                </>
              ) : (
                'Marcar como vista'
              )}
            </button>
          </div>
        </section>

        {/* ---------- Capítulos ---------- */}
        {actual.capitulos && actual.capitulos.length > 0 && (
          <section className={a.tarjeta}>
            <h3 className={a.rotulo}>Capítulos de esta clase</h3>
            <ol className={a.capitulos}>
              {actual.capitulos.map((c) => (
                <li key={`${c.t}-${c.titulo}`}>
                  <button type="button" className={a.capitulo} onClick={() => saltar(c.t)}>
                    <span className={a.tiempo}>{minutos(c.t)}</span>
                    <span className={a.capituloTitulo}>{c.titulo}</span>
                    <span className={a.irA} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ---------- Módulos ---------- */}
        {modulos.length > 1 && (
          <section className={a.bloque}>
            <h3 className={a.rotulo}>Módulos</h3>
            <div className={a.modulos}>
              {modulos.map((m, i) => (
                <button
                  key={m.nombre}
                  type="button"
                  className={a.moduloTarjeta}
                  data-activo={modulo === m.nombre ? '' : undefined}
                  onClick={() => setModulo(modulo === m.nombre ? null : m.nombre)}
                >
                  <span className={a.moduloIcono} data-n={i % 4}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={a.moduloTexto}>
                    <span className={a.moduloNombre}>{m.nombre}</span>
                    <span className={a.moduloCuenta}>
                      {m.hechas} de {m.lecciones.length} {m.lecciones.length === 1 ? 'clase' : 'clases'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Todas las clases ---------- */}
        <section className={a.tarjeta}>
          <div className={a.cabeceraLista}>
            <h3 className={a.rotulo}>{modulo ? modulo : 'Todas las clases'}</h3>
            <label className={a.buscar}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" strokeLinecap="round" /></svg>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar una clase"
                aria-label="Buscar una clase"
              />
            </label>
          </div>
          <ul className={a.clases}>
            <AnimatePresence initial={false}>
              {lista.map((l) => {
                const p = progreso[l.id];
                const pct = p?.completada ? 100 : l.duracion && p?.visto ? Math.min(99, Math.round((p.visto / l.duracion) * 100)) : 0;
                const yt = !esVideoPropio(l.video);
                return (
                  <motion.li key={l.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <button
                      type="button"
                      className={a.clase}
                      data-actual={l.id === actual.id ? '' : undefined}
                      onClick={() => abrir(l.id)}
                    >
                      <span className={a.miniatura}>
                        {l.portada ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.portada} alt="" loading="lazy" />
                        ) : yt ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`https://i.ytimg.com/vi/${l.video}/mqdefault.jpg`} alt="" loading="lazy" />
                        ) : (
                          <span className={a.miniaturaVacia} />
                        )}
                        <span className={a.play} aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
                        </span>
                      </span>
                      <span className={a.claseTexto}>
                        <span className={a.claseTitulo}>{l.titulo}</span>
                        <span className={a.claseMeta}>
                          {l.duracion ? minutos(l.duracion) : ''}
                          {l.duracion ? ' · ' : ''}
                          {l.modulo}
                        </span>
                      </span>
                      <span className={a.claseProgreso}>
                        {p?.completada ? (
                          <span className={a.hecha} aria-label="Completada">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </span>
                        ) : (
                          <>
                            <span className={a.pct}>{pct}%</span>
                            <span className={a.barra}>
                              <span style={{ width: `${pct}%` }} />
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
            {lista.length === 0 && <li className={a.nada}>Ninguna clase con ese nombre.</li>}
          </ul>
        </section>
      </div>

      {/* ---------- A la derecha: el progreso ---------- */}
      <aside className={a.lateral}>
        <section className={a.tarjeta}>
          <h3 className={a.rotulo}>Tu progreso</h3>
          <p className={a.ruta}>{modulos.length === 1 ? modulos[0].nombre : 'Tu formación Divine'}</p>
          <Anillo valor={porcentaje} />
          <p className={a.cuenta}>
            {hechas} de {ordenadas.length} {ordenadas.length === 1 ? 'clase completada' : 'clases completadas'}
          </p>
          {siguiente && (
            <button type="button" className={a.seguir} onClick={() => abrir(siguiente.id)}>
              {hechas === 0 ? 'Empezar' : hechas === ordenadas.length ? 'Repasar' : 'Seguir donde lo dejé'}
            </button>
          )}

          <h4 className={a.subrotulo}>Clases del curso</h4>
          <ol className={a.camino}>
            {ordenadas.map((l, i) => {
              const hecha = progreso[l.id]?.completada;
              const esta = l.id === actual.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    className={a.paso}
                    data-estado={hecha ? 'hecha' : esta ? 'actual' : 'pendiente'}
                    onClick={() => abrir(l.id)}
                  >
                    <span className={a.pasoTexto}>
                      {i + 1}. {l.titulo}
                    </span>
                    <span className={a.pasoIcono} aria-hidden="true">
                      {hecha ? (
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section className={a.tarjeta}>
          <h3 className={a.rotulo}>Tus datos</h3>
          <ul className={a.datos}>
            <li>
              <span className={a.datoIcono}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4-2.5z" fill="currentColor" stroke="none" /></svg>
              </span>
              Clases vistas
              <b>{hechas}</b>
            </li>
            <li>
              <span className={a.datoIcono}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" strokeLinecap="round" /></svg>
              </span>
              Horas de estudio
              <b>{(segundosVistos / 3600).toFixed(1).replace('.', ',')}</b>
            </li>
            <li>
              <span className={a.datoIcono}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="9" r="5" /><path d="M9 13.5L7.5 21l4.5-2.5 4.5 2.5-1.5-7.5" strokeLinejoin="round" /></svg>
              </span>
              Certificado
              <b className={a.datoTexto}>{porcentaje === 100 ? 'Listo' : 'Al terminar'}</b>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
