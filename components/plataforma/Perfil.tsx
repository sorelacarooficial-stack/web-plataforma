'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Logros from './Logros';
import { BarraNivel, ContadorPuntos, useResumenPuntos } from './Puntos';
import { useAviso, useConfirmar } from './Confirmar';
import { formatoPuntos, nivelDe, type EstadoNivel } from '@/lib/puntos-tipos';
import { leerRespuesta, prepararImagen } from '@/lib/imagen-cliente';
import p from './perfil.module.css';

/**
 * El perfil, tipo Instagram: portada, foto, quién es, su nivel y sus fotos.
 * Se ve solo dentro de la plataforma. `?u=uid` abre el de otra persona; sin
 * nada, el propio. Lo cuenta `app/api/perfiles`.
 *
 * Los puntos del propio llegan al día con el evento `divine:puntos` (los
 * reparte la Celebración); los de otra persona, con la foto fija que guarda
 * el servidor (`puntos` del GET). La ficha del mapa y la bienvenida son el
 * onboarding (`divine:onboarding`): aquí solo se abre.
 */

type Datos = {
  esMio: boolean;
  puedeModerar: boolean;
  perfil: {
    uid: string;
    nombre: string;
    esSorela: boolean;
    foto: string | null;
    portada: string | null;
    bio: string;
    especialidad: string;
    ciudad: string;
    instagram: string;
    desde: string | null;
  };
  fotos: { id: string; url: string; pie: string }[];
  publicaciones: number;
  puntos?: { total: number; nivel: EstadoNivel };
};

/** Lo que cuenta /api/ficha de la propia. Si no responde, no se sabe (null). */
type MiFicha = { esMiembro: boolean; completado: boolean; estado: 'borrador' | 'publicada' | 'oculta' | null };

const CAMPOS = ['bio', 'especialidad', 'ciudad', 'instagram'] as const;
type Campo = (typeof CAMPOS)[number];

const uidDeLaDireccion = () => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('u') || '');
const abrirOnboarding = () => window.dispatchEvent(new Event('divine:onboarding'));
const avisarLogros = () => window.dispatchEvent(new Event('divine:logros'));

const ESTADO_FICHA: Record<NonNullable<MiFicha['estado']>, string> = { publicada: 'Publicada', oculta: 'Oculta', borrador: 'Sin publicar' };

const ICONO_PAPELERA = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

const ICONO_MAPA = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);

/** Un hueco vacío que se entiende: icono, qué pasa y qué se puede hacer. */
function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className={p.vacio}>
      <span className={p.vacioIcono} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="15" rx="3" />
          <circle cx="9" cy="11" r="2" />
          <path d="M21 17l-5-5-8 8" />
        </svg>
      </span>
      <strong className={p.vacioTitulo}>{titulo}</strong>
      {children && <p className={p.vacioTexto}>{children}</p>}
      {accion}
    </div>
  );
}

export default function Perfil() {
  const reducir = useReducedMotion();
  const [uid, setUid] = useState(uidDeLaDireccion);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'fotos' | 'logros'>('fotos');
  const [editando, setEditando] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [montado, setMontado] = useState(false);
  const [ficha, setFicha] = useState<MiFicha | null>(null);
  const [confirmar, dialogo] = useConfirmar();
  const [avisar, aviso] = useAviso();
  const resumen = useResumenPuntos();
  const entradaFoto = useRef<HTMLInputElement>(null);
  const entradaPortada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMontado(true);
    const leer = () => setUid(uidDeLaDireccion());
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, []);

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const j = await (await fetch(`/api/perfiles${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`)).json();
      if (!j.ok) throw new Error(j.motivo === 'sin-acceso' ? 'Los perfiles se ven cuando tienes acceso a la formación o a la comunidad.' : 'No he podido abrir este perfil.');
      setDatos(j);
    } catch (e) {
      setFallo((e as Error).message || 'No hay conexión.');
    }
  }, [uid]);

  useEffect(() => {
    setDatos(null);
    setPestana('fotos');
    cargar();
  }, [cargar]);

  /* Si es miembro (tiene ficha en el mapa) y si ya hizo la bienvenida. Si la
     API no contesta, se queda sin saber: se enseña el botón y el onboarding
     decide qué ofrecer. */
  const cargarFicha = useCallback(async () => {
    try {
      const r = await fetch('/api/ficha');
      if (!r.ok) return;
      const j = await r.json();
      if (!j?.ok) return;
      const estado = j.ficha?.estado;
      setFicha({
        esMiembro: j.esMiembro !== false,
        completado: Boolean(j.onboarding?.completado),
        estado: estado === 'publicada' || estado === 'oculta' || estado === 'borrador' ? estado : null,
      });
    } catch {
      /* sin red: no se sabe */
    }
  }, []);

  const propioDeTerapeuta = Boolean(datos?.esMio && !datos.perfil.esSorela);

  useEffect(() => {
    if (!propioDeTerapeuta) return;
    cargarFicha();
    // Al cerrar la bienvenida o la ficha, el perfil puede haber cambiado (foto, bio, ciudad).
    const alCerrar = () => {
      cargar();
      cargarFicha();
    };
    window.addEventListener('divine:onboarding-cerrado', alCerrar);
    return () => window.removeEventListener('divine:onboarding-cerrado', alCerrar);
  }, [propioDeTerapeuta, cargar, cargarFicha]);

  /* El visor de fotos: Escape cierra y las flechas pasan. Si hay una pregunta
     abierta encima, el diálogo se queda el Escape y este no se entera. */
  const nFotos = datos?.fotos.length ?? 0;
  useEffect(() => {
    if (abierta === null) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null);
      else if (e.key === 'ArrowRight') setAbierta((i) => (i !== null && i < nFotos - 1 ? i + 1 : i));
      else if (e.key === 'ArrowLeft') setAbierta((i) => (i !== null && i > 0 ? i - 1 : i));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierta, nFotos]);

  async function subir(tipo: 'foto' | 'portada', archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(tipo);
    try {
      const f = new FormData();
      f.set('tipo', tipo);
      // Reducida aquí: una foto de móvil pasa del límite de 4,5 MB de Vercel.
      f.set('archivo', await prepararImagen(archivo, tipo === 'portada' ? 2400 : 2000));
      const j = await leerRespuesta<{ url?: string; foto?: Datos['fotos'][number] }>(await fetch('/api/perfiles', { method: 'POST', body: f }));
      if (!j.ok) throw new Error(j.texto || 'No se ha podido subir.');
      if (tipo === 'portada') setDatos((d) => (d && j.url ? { ...d, perfil: { ...d.perfil, portada: j.url } } : d));
      else if (j.foto) {
        setDatos((d) => (d ? { ...d, fotos: [j.foto!, ...d.fotos] } : d));
        avisarLogros(); // las fotos del perfil suman puntos
      }
    } catch (e) {
      avisar((e as Error).message || 'No hay conexión. Inténtalo otra vez.');
    } finally {
      setSubiendo(null);
    }
  }

  /* Borrar una foto: sale de la rejilla al momento y, si el servidor dice que
     no, vuelve a su sitio con un aviso. Si ya no estaba, se da por borrada. */
  async function borrarFoto(id: string) {
    if (!datos) return;
    const si = await confirmar({
      titulo: '¿Borrar esta foto?',
      texto: datos.esMio ? 'Desaparece de tu perfil y no se puede recuperar.' : `Es del perfil de ${datos.perfil.nombre}. Desaparece y no se puede recuperar.`,
      boton: 'Borrar foto',
    });
    if (!si) return;
    const sitio = datos.fotos.findIndex((f) => f.id === id);
    const foto = datos.fotos[sitio];
    setDatos((d) => (d ? { ...d, fotos: d.fotos.filter((f) => f.id !== id) } : d));
    setAbierta(null);
    const q = new URLSearchParams({ foto: id, ...(datos.esMio ? {} : { uid: datos.perfil.uid }) });
    const j = await leerRespuesta<{ motivo?: string }>(await fetch(`/api/perfiles?${q}`, { method: 'DELETE' }).catch(() => new Response('')));
    if (j.ok || j.motivo === 'no-existe') {
      avisarLogros();
      return;
    }
    setDatos((d) => {
      if (!d || !foto || d.fotos.some((f) => f.id === id)) return d;
      const l = [...d.fotos];
      l.splice(Math.min(Math.max(sitio, 0), l.length), 0, foto);
      return { ...d, fotos: l };
    });
    avisar(j.motivo === 'sin-permiso' ? 'Esta foto no la puedes borrar.' : 'No se ha podido borrar la foto. Revisa la conexión e inténtalo otra vez.');
  }

  async function quitarPortada() {
    if (!datos?.perfil.portada) return;
    const si = await confirmar({
      titulo: '¿Quitar la portada?',
      texto: datos.esMio ? 'Tu perfil vuelve a la portada dorada. Puedes poner otra cuando quieras.' : `Se quita la portada del perfil de ${datos.perfil.nombre}.`,
      boton: 'Quitar portada',
    });
    if (!si) return;
    const antes = datos.perfil.portada;
    setDatos((d) => (d ? { ...d, perfil: { ...d.perfil, portada: null } } : d));
    const q = new URLSearchParams({ portada: '1', ...(datos.esMio ? {} : { uid: datos.perfil.uid }) });
    const j = await leerRespuesta(await fetch(`/api/perfiles?${q}`, { method: 'DELETE' }).catch(() => new Response('')));
    if (j.ok) return;
    // Vuelve la que había, salvo que entretanto se haya puesto otra.
    setDatos((d) => (d && d.perfil.portada === null ? { ...d, perfil: { ...d.perfil, portada: antes } } : d));
    avisar('No se ha podido quitar la portada. Inténtalo otra vez.');
  }

  if (fallo)
    return (
      <div className={p.perfil}>
        <Vacio
          titulo="No se ha podido abrir el perfil"
          accion={
            <button type="button" className={p.btnLinea} onClick={cargar}>
              Reintentar
            </button>
          }
        >
          {fallo}
        </Vacio>
      </div>
    );
  if (!datos) return <div className={p.esqueleto} aria-label="Cargando el perfil" />;

  const { perfil, esMio, fotos } = datos;
  const ini = perfil.nombre.split(/\s+/).slice(0, 2).map((x) => x[0] ?? '').join('').toUpperCase();
  const puedeBorrar = esMio || datos.puedeModerar;
  const conPuntos = !perfil.esSorela;
  const total = esMio && resumen ? resumen.total : (datos.puntos?.total ?? 0);
  const nivel = nivelDe(total);
  const vacio = !perfil.bio && !perfil.especialidad && !perfil.ciudad && fotos.length === 0;
  // ¿Ya se llevó los 100 puntos de la bienvenida? Lo mejor es el resumen al día; si no, la ficha; si no, mirar si está vacío.
  const perfilHecho = resumen ? resumen.desglose.perfil > 0 : ficha ? ficha.completado : !vacio;
  const verFicha = propioDeTerapeuta && (ficha === null || ficha.esMiembro);

  return (
    <div className={p.perfil}>
      {/* ---------- Portada y foto ---------- */}
      <section className={p.cabeza}>
        <div className={p.portada} style={perfil.portada ? { backgroundImage: `url(${perfil.portada})` } : undefined}>
          {(esMio || (datos.puedeModerar && perfil.portada)) && (
            <div className={p.portadaAcciones}>
              {esMio && (
                <button type="button" className={p.botonPortada} onClick={() => entradaPortada.current?.click()} disabled={subiendo === 'portada'}>
                  {subiendo === 'portada' ? 'Subiendo…' : perfil.portada ? 'Cambiar portada' : 'Poner portada'}
                </button>
              )}
              {perfil.portada && (
                <button type="button" className={p.botonPortada} onClick={quitarPortada} disabled={subiendo === 'portada'}>
                  Quitar portada
                </button>
              )}
            </div>
          )}
        </div>
        <div className={p.identidad}>
          <span className={p.avatar} data-sorela={perfil.esSorela ? '' : undefined}>
            {perfil.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto} alt="" />
            ) : (
              ini || '·'
            )}
          </span>
          <div className={p.nombreBloque}>
            <h2>
              {perfil.nombre}
              {perfil.esSorela && <span className={p.sello}>✦ Creadora de la Técnica Divine</span>}
            </h2>
            {(perfil.especialidad || perfil.ciudad) && <p className={p.sub}>{[perfil.especialidad, perfil.ciudad].filter(Boolean).join(' · ')}</p>}
          </div>
          {esMio && (
            <div className={p.acciones}>
              <button type="button" className={p.btnEditar} onClick={() => setEditando(true)}>
                Editar perfil
              </button>
              {verFicha && (
                <button type="button" className={p.btnFicha} onClick={abrirOnboarding}>
                  {ICONO_MAPA}
                  Mi ficha en el mapa
                  {ficha?.estado && (
                    <span className={p.estadoFicha} data-estado={ficha.estado}>
                      {ESTADO_FICHA[ficha.estado]}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {conPuntos && (
          <div className={p.nivel}>
            <BarraNivel total={total} tamano="compacta" conTexto={false} />
            <p className={p.nivelTexto}>
              {nivel.siguiente ? (
                esMio ? (
                  <>
                    Te faltan <b>{formatoPuntos(nivel.falta)} pts</b> para <b>{nivel.siguiente.nombre}</b>
                  </>
                ) : (
                  <>
                    A <b>{formatoPuntos(nivel.falta)} pts</b> de <b>{nivel.siguiente.nombre}</b>
                  </>
                )
              ) : esMio ? (
                'Has llegado al nivel más alto.'
              ) : (
                'Está en el nivel más alto.'
              )}
            </p>
          </div>
        )}

        <div className={p.cifras}>
          <span>
            <b>{fotos.length}</b> {fotos.length === 1 ? 'foto' : 'fotos'}
          </span>
          <span>
            <b>{datos.publicaciones}</b> {datos.publicaciones === 1 ? 'publicación' : 'publicaciones'}
          </span>
          {conPuntos && (
            <>
              <span>
                <b>
                  <ContadorPuntos valor={total} desde={0} />
                </b>{' '}
                puntos
              </span>
              <span className={p.chipNivel}>
                <span className={p.chipNumero} aria-hidden="true">
                  {nivel.n}
                </span>
                <span className={p.soloLector}>Nivel {nivel.n}: </span>
                {nivel.nombre}
              </span>
            </>
          )}
        </div>

        {perfil.bio && <p className={p.bio}>{perfil.bio}</p>}
        {perfil.instagram && (
          <a className={p.instagram} href={`https://instagram.com/${perfil.instagram}`} target="_blank" rel="noopener noreferrer">
            @{perfil.instagram}
          </a>
        )}
        {propioDeTerapeuta && !perfilHecho && (
          <div className={p.completa}>
            <span className={p.completaIcono} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9-1.9 5.6-1.9-5.6-5.6-1.9 5.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z" />
              </svg>
            </span>
            <div className={p.completaTexto}>
              <strong>
                Completa tu perfil <span className={p.completaPuntos}>+100 pts</span>
              </strong>
              <p>Tu foto, quién eres y dónde trabajas. Así te conocen tus compañeras.</p>
            </div>
            <button type="button" className={p.btnOscuro} onClick={abrirOnboarding}>
              Empezar
            </button>
          </div>
        )}
      </section>

      {/* ---------- Pestañas ---------- */}
      <nav className={p.pestanas} aria-label="Contenido del perfil">
        {(
          [
            ['fotos', 'Fotos'],
            ['logros', 'Logros'],
          ] as const
        ).map(([id, nombre]) => (
          <button key={id} type="button" aria-current={pestana === id ? 'page' : undefined} onClick={() => setPestana(id)}>
            {nombre}
            {pestana === id && <motion.span layoutId="perfil-pestana" className={p.subrayado} />}
          </button>
        ))}
      </nav>

      {pestana === 'fotos' &&
        (!esMio && fotos.length === 0 ? (
          <Vacio titulo="Todavía no hay fotos">Cuando suba fotos de su trabajo, las verás aquí.</Vacio>
        ) : (
          <div className={p.rejilla}>
            {esMio && (
              <button type="button" className={p.subirFoto} onClick={() => entradaFoto.current?.click()} disabled={subiendo === 'foto'}>
                <span aria-hidden="true">+</span>
                {subiendo === 'foto' ? 'Subiendo…' : 'Subir foto'}
              </button>
            )}
            <AnimatePresence initial={false} mode="popLayout">
              {fotos.map((f, i) => (
                <motion.div
                  key={f.id}
                  layout={reducir ? false : true}
                  className={p.celda}
                  exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  transition={{ duration: reducir ? 0 : 0.22 }}
                >
                  <button type="button" className={p.celdaVer} onClick={() => setAbierta(i)} aria-label={f.pie || `Ver la foto ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.pie} loading="lazy" />
                  </button>
                  {puedeBorrar && (
                    <button type="button" className={p.celdaBorrar} onClick={() => borrarFoto(f.id)} aria-label={`Borrar la foto ${i + 1}`} title="Borrar foto">
                      {ICONO_PAPELERA}
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ))}

      {pestana === 'logros' && <Logros uid={esMio ? undefined : perfil.uid} />}

      <input ref={entradaFoto} type="file" accept="image/*" hidden onChange={(e) => { subir('foto', e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={entradaPortada} type="file" accept="image/*" hidden onChange={(e) => { subir('portada', e.target.files?.[0]); e.target.value = ''; }} />

      {montado &&
        createPortal(
          <AnimatePresence>
            {abierta !== null && fotos[abierta] && (
              <motion.div className={p.visor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAbierta(null)}>
                <motion.figure initial={reducir ? false : { scale: 0.96 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotos[abierta].url} alt={fotos[abierta].pie} />
                  {(fotos[abierta].pie || puedeBorrar) && (
                    <figcaption>
                      <span>{fotos[abierta].pie}</span>
                      {puedeBorrar && (
                        <button type="button" className={p.visorBorrar} onClick={() => borrarFoto(fotos[abierta].id)}>
                          {ICONO_PAPELERA}
                          Borrar foto
                        </button>
                      )}
                    </figcaption>
                  )}
                </motion.figure>
                <button type="button" className={p.visorCerrar} aria-label="Cerrar" onClick={() => setAbierta(null)}>
                  ✕
                </button>
                {abierta > 0 && <button type="button" className={p.izq} aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setAbierta(abierta - 1); }}>‹</button>}
                {abierta < fotos.length - 1 && <button type="button" className={p.der} aria-label="Siguiente" onClick={(e) => { e.stopPropagation(); setAbierta(abierta + 1); }}>›</button>}
              </motion.div>
            )}
            {editando && (
              <Editor
                key="editor"
                datos={datos}
                cerrar={() => setEditando(false)}
                guardado={(n) => {
                  setDatos((d) => (d ? { ...d, perfil: { ...d.perfil, ...n } } : d));
                  setEditando(false);
                }}
                verFicha={
                  verFicha
                    ? () => {
                        setEditando(false);
                        abrirOnboarding();
                      }
                    : null
                }
                estadoFicha={ficha?.estado ?? null}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
      {dialogo}
      {aviso}
    </div>
  );
}

function Editor({
  datos,
  cerrar,
  guardado,
  verFicha,
  estadoFicha,
}: {
  datos: Datos;
  cerrar: () => void;
  guardado: (n: Partial<Datos['perfil']>) => void;
  /** Abre la ficha del mapa (el onboarding). null si no es miembro. */
  verFicha: (() => void) | null;
  estadoFicha: MiFicha['estado'];
}) {
  const reducir = useReducedMotion();
  const [f, setF] = useState<Record<Campo, string>>({
    bio: datos.perfil.bio,
    especialidad: datos.perfil.especialidad,
    ciudad: datos.perfil.ciudad,
    instagram: datos.perfil.instagram,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const alCerrar = useRef(cerrar);

  useEffect(() => {
    alCerrar.current = cerrar;
  }, [cerrar]);

  /* El foco entra en el diálogo (no en un campo: en el móvil sacaría el
     teclado de golpe), Escape cierra y al cerrar vuelve a «Editar perfil». */
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    caja.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar.current();
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      if (previo?.isConnected) previo.focus({ preventScroll: true });
    };
  }, []);

  async function guardar() {
    // Solo lo que ha cambiado: el PATCH escribe únicamente las claves que llegan.
    const cambios: Partial<Record<Campo, string>> = {};
    for (const k of CAMPOS) if (f[k].trim() !== datos.perfil[k].trim()) cambios[k] = f[k];
    if (!Object.keys(cambios).length) return cerrar();
    setGuardando(true);
    setError(null);
    const j = await (await fetch('/api/perfiles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) }).catch(() => new Response('{}')))
      .json()
      .catch(() => ({ ok: false }));
    setGuardando(false);
    // El servidor devuelve lo que ha guardado de verdad (recortado, Instagram sin @).
    if (j.ok) guardado({ ...cambios, ...(j.perfil ?? {}) });
    else setError('No se ha podido guardar. Revisa la conexión e inténtalo otra vez.');
  }

  return (
    <motion.div className={p.velo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        ref={caja}
        tabIndex={-1}
        className={p.editor}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-perfil-titulo"
        initial={reducir ? false : { y: 24 }}
        animate={{ y: 0 }}
        exit={reducir ? { opacity: 0 } : { y: 16, opacity: 0 }}
      >
        <header className={p.editorCabeza}>
          <h2 id="editor-perfil-titulo">Editar perfil</h2>
          <button type="button" className={p.cerrar} onClick={cerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className={p.editorCuerpo}>
          <label className={p.campo}>
            <span>Sobre ti</span>
            <textarea rows={4} maxLength={400} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Quién eres, cómo trabajas, qué te apasiona de tu oficio." />
            <small>{f.bio.length}/400</small>
          </label>
          <div className={p.dos}>
            <label className={p.campo}>
              <span>A qué te dedicas</span>
              <input maxLength={80} value={f.especialidad} onChange={(e) => setF({ ...f, especialidad: e.target.value })} placeholder="Esteticista, quiromasajista…" />
            </label>
            <label className={p.campo}>
              <span>Ciudad</span>
              <input maxLength={80} value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} placeholder="Madrid" />
            </label>
          </div>
          <label className={p.campo}>
            <span>Instagram</span>
            <input maxLength={40} value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} placeholder="@tucuenta" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </label>

          {verFicha && (
            <div className={p.fichaCaja}>
              <span className={p.fichaIcono} aria-hidden="true">
                {ICONO_MAPA}
              </span>
              <div className={p.fichaTexto}>
                <strong>
                  Tu ficha en el mapa de terapeutas
                  {estadoFicha && (
                    <span className={p.estadoFicha} data-estado={estadoFicha}>
                      {ESTADO_FICHA[estadoFicha]}
                    </span>
                  )}
                </strong>
                <p>Tratamientos, contacto y dónde trabajas: se editan aparte, con la vista previa de cómo se verá.</p>
              </div>
              <button type="button" className={p.btnLinea} onClick={verFicha}>
                Mi ficha en el mapa
              </button>
            </div>
          )}
          {error && (
            <p className={p.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className={p.editorPie}>
          <button type="button" className={p.btnLinea} onClick={cerrar}>
            Cancelar
          </button>
          <button type="button" className={p.btnOscuro} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
