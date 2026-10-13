'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  esVideoPropio,
  minutos,
  porBloques,
  urlDeVideo,
  type Leccion,
  type Progreso,
} from '@/lib/aula';
import { Lector, TarjetasMaterial, type DocumentoVisible } from './Material';
import VideoYoutube from '@/components/VideoYoutube';
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
 *
 * Debajo de las clases está el material: los dossieres de cada día, que se
 * leen en el lector protegido de `Material.tsx`.
 */

type Mapa = Record<string, Progreso>;

const GUARDAR_CADA = 10; // segundos

function Anillo({ valor }: { valor: number }) {
  const reducir = useReducedMotion();
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
        initial={{ strokeDashoffset: reducir ? c * (1 - valor / 100) : c }}
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

/**
 * Una barra de progreso que se llena cuando entra en pantalla, y que vuelve a
 * moverse sola si el valor cambia (al guardar por dónde va el vídeo).
 */
function BarraProgreso({ valor, className }: { valor: number; className: string }) {
  const reducir = useReducedMotion();
  const v = Math.max(0, Math.min(100, valor)) / 100;
  return (
    <span className={className} aria-hidden="true">
      <motion.span
        style={{ originX: 0 }}
        initial={{ scaleX: reducir ? v : 0 }}
        whileInView={{ scaleX: v }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 90, damping: 18, restDelta: 0.001 }}
      />
    </span>
  );
}

function IconoCandado() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
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
  const [documentos, setDocumentos] = useState<DocumentoVisible[]>([]);
  /* Lo que se abre cuando pague el resto (solo con el abono): solo títulos. */
  const [bloqueados, setBloqueados] = useState<{ id: string; titulo: string; subtitulo: string }[]>([]);
  const [leyendo, setLeyendo] = useState<{ id: string; desde: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const ultimoGuardado = useRef(0);
  /* Por dónde iba al renovar el enlace, para seguir en el mismo segundo. */
  const reanudar = useRef<{ t: number; jugando: boolean } | null>(null);
  const renovaciones = useRef(0);
  /* Las clases que ya se han mandado como vistas en esta visita. */
  const vistas = useRef(new Set<string>());

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const [rl, rp, rm] = await Promise.all([
        fetch('/api/lecciones'),
        fetch('/api/progreso'),
        // El material no debe tumbar el aula si falla: se queda sin tarjetas.
        fetch('/api/material').catch(() => null),
      ]);
      const cl = await rl.json().catch(() => ({ ok: false }));
      const cp = await rp.json().catch(() => ({ ok: false }));
      const cm = rm ? await rm.json().catch(() => ({ ok: false })) : { ok: false };
      setDocumentos(cm.ok ? cm.documentos ?? [] : []);
      setBloqueados(cm.ok ? cm.bloqueados ?? [] : []);
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
  const pedirEnlace = useCallback((id: string, alAcabar: (url: string | null) => void) => {
    fetch(`/api/lecciones/video?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => alAcabar(j.ok ? j.url : null))
      .catch(() => alAcabar(null));
  }, []);

  useEffect(() => {
    setFalloVideo(false);
    reanudar.current = null;
    renovaciones.current = 0;
    if (!actual || !esVideoPropio(actual.video)) {
      setFuente(null);
      return;
    }
    let vivo = true;
    pedirEnlace(actual.id, (url) => {
      if (!vivo) return;
      if (url) setFuente({ id: actual.id, url });
      else setFalloVideo(true);
    });
    return () => {
      vivo = false;
    };
  }, [actual?.id, actual?.video]); // eslint-disable-line react-hooks/exhaustive-deps

  /* El enlace dura quince minutos (que no se pueda reenviar). Una clase larga
     dura más, y una pausa para el café también: pasado ese rato, el siguiente
     trozo que pide el reproductor sale con error. Entonces se pide un enlace
     nuevo y se sigue en el mismo segundo, sin que ella tenga que hacer nada.
     Tres veces seguidas sin suerte ya no es el enlace: se dice. */
  const renovarEnlace = useCallback(() => {
    const v = video.current;
    if (!actual || !v) return;
    if (renovaciones.current >= 3) {
      setFalloVideo(true);
      setFuente(null);
      return;
    }
    renovaciones.current++;
    reanudar.current = { t: v.currentTime, jugando: !v.paused || v.seeking };
    const id = actual.id;
    pedirEnlace(id, (url) => {
      if (url) setFuente((f) => (f?.id === id ? { id, url } : f));
      else {
        setFalloVideo(true);
        setFuente(null);
      }
    });
  }, [actual, pedirEnlace]);

  const guardar = useCallback((id: string, visto: number, completada = false) => {
    setProgreso((p) => ({
      ...p,
      [id]: { visto, completada: completada || Boolean(p[id]?.completada) },
    }));
    fetch('/api/progreso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, visto, completada }),
    })
      // Al terminar una clase puede caer un logro: que lo mire la celebración.
      .then((r) => (completada ? r.json() : null))
      // Solo la PRIMERA vez que se termina una clase hay algo que celebrar:
      // pasado el 90 % el vídeo repite «terminada» cada diez segundos, y el
      // servidor dice con `nueva` cuál de todas es la de verdad.
      .then((j) => j?.nueva === true && window.dispatchEvent(new Event('divine:logros')))
      .catch(() => {});
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

  const abrirMaterial = (id: string, desde = 1) => setLeyendo({ id, desde });
  const docLeyendo = documentos.find((d) => d.id === leyendo?.id);
  const lector = docLeyendo && leyendo && (
    <Lector doc={docLeyendo} correo={correo} desde={leyendo.desde} cerrar={() => setLeyendo(null)} />
  );
  /* Con solo el abono: tiene el curso, pero de momento solo el precurso. */
  const soloPrecurso = bloqueados.length > 0;
  const seccionMaterial = (documentos.length > 0 || soloPrecurso) && (
    <section className={a.bloque} id="aula-material">
      <h3 className={a.rotulo}>{soloPrecurso && documentos.every((d) => d.id === 'precurso') ? 'Tu precurso' : 'Material del curso'}</h3>
      {documentos.length > 0 && <TarjetasMaterial documentos={documentos} abrir={abrirMaterial} />}
      {soloPrecurso && (
        <div className={a.cerrado}>
          <p className={a.cerradoRotulo}>
            <IconoCandado /> Se abre después de la presencial
          </p>
          <ul className={a.cerradoLista}>
            {bloqueados.map((d) => (
              <li key={d.id}>
                <IconoCandado />
                <span>
                  <strong>{d.titulo}</strong>
                  <span>{d.subtitulo}</span>
                </span>
              </li>
            ))}
            <li>
              <IconoCandado />
              <span>
                <strong>Las clases en vídeo</strong>
                <span>Cada maniobra grabada, para repasar a tu ritmo</span>
              </span>
            </li>
          </ul>
        </div>
      )}
    </section>
  );

  if (lecciones === null) {
    return (
      <div className={a.aula} aria-busy="true" aria-label="Cargando tus clases">
        <div className={a.principal}>
          <div className={a.esqueleto} style={{ aspectRatio: '16 / 9', borderRadius: 26 }} />
          <div className={a.esqueleto} style={{ height: 120 }} />
        </div>
        <div className={a.lateral}>
          <div className={a.esqueleto} style={{ height: 320 }} />
        </div>
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
        {/* Vacío: icono, un título corto y una frase útil (no un párrafo gris suelto). */}
        <section className={a.vacio}>
          <span className={a.vacioIcono} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="13" rx="3" />
              <path d="M10.5 9.2v4.6l4-2.3z" />
            </svg>
          </span>
          {soloPrecurso ? (
            <>
              <h3 className={a.vacioTitulo}>Tu formación empieza con el precurso</h3>
              <p className={a.vacioTexto}>
                Léelo con calma antes de la clase presencial: tienes las fechas en tu agenda. Las clases en
                vídeo y los dossieres de cada día se abren aquí cuando completes el pago, después de la
                presencial.
              </p>
              {documentos.some((d) => d.id === 'precurso') && (
                <button type="button" className={css.btn} style={{ marginTop: 10 }} onClick={() => abrirMaterial('precurso')}>
                  Leer el precurso
                </button>
              )}
            </>
          ) : (
            <>
              <h3 className={a.vacioTitulo}>Aún no hay clases</h3>
              <p className={a.vacioTexto}>
                En cuanto Sorela suba la primera, la verás aquí sin tener que hacer nada.
              </p>
            </>
          )}
        </section>
        {seccionMaterial}
        {lector}
      </div>
    );
  }

  const t = busca.trim().toLowerCase();
  const lista = ordenadas.filter(
    (l) => (!modulo || l.modulo === modulo) && (!t || l.titulo.toLowerCase().includes(t))
  );
  const pActual = progreso[actual.id];
  const dossier = documentos.find((d) => d.modulo === actual.modulo);

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
                  preload="metadata"
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    // Con el enlace renovado, se sigue justo donde estaba.
                    const vuelta = reanudar.current;
                    if (vuelta) {
                      reanudar.current = null;
                      v.currentTime = vuelta.t;
                      if (vuelta.jugando) v.play().catch(() => {});
                      return;
                    }
                    const desde = pActual?.visto ?? 0;
                    if (desde > 5 && desde < v.duration - 10) v.currentTime = desde;
                  }}
                  onPlaying={() => {
                    renovaciones.current = 0;
                  }}
                  onError={renovarEnlace}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    const pasada = v.duration > 0 && v.currentTime / v.duration > 0.9;
                    /* Al pasar del 90 % por primera vez, se apunta como vista
                       en el acto, sin esperar al siguiente guardado: si cierra
                       justo ahí (los créditos, la despedida), ya cuenta. */
                    const recien = pasada && !pActual?.completada && !vistas.current.has(actual.id);
                    if (recien || Math.abs(v.currentTime - ultimoGuardado.current) >= GUARDAR_CADA) {
                      ultimoGuardado.current = v.currentTime;
                      if (recien) vistas.current.add(actual.id);
                      guardar(actual.id, v.currentTime, pasada);
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
              /* YouTube no se carga hasta que se pulsa (ver components/VideoYoutube). */
              <VideoYoutube
                key={`${actual.id}-${inicioYoutube}`}
                src={`${urlDeVideo(actual.video)}${inicioYoutube ? `&start=${Math.floor(inicioYoutube)}&autoplay=1` : ''}`}
                titulo={actual.titulo}
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
            <div className={a.fichaBotones}>
            {dossier && (
              <button type="button" className={a.marcarVista} onClick={() => abrirMaterial(dossier.id)}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" strokeLinejoin="round" /><path d="M14 3v4h4M9 12h6M9 16h6" strokeLinejoin="round" strokeLinecap="round" /></svg>
                Dossier de este día
              </button>
            )}
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
                    <BarraProgreso className={a.moduloBarra} valor={m.lecciones.length ? (m.hechas / m.lecciones.length) * 100 : 0} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Material ---------- */}
        {seccionMaterial}

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
                            <BarraProgreso className={a.barra} valor={pct} />
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
      {lector}
    </div>
  );
}
