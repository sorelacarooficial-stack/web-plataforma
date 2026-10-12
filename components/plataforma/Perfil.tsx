'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Logros from './Logros';
import { leerRespuesta, prepararImagen } from '@/lib/imagen-cliente';
import p from './perfil.module.css';

/**
 * El perfil, tipo Instagram: portada, foto, quién es, su recorrido y sus fotos.
 * Se ve solo dentro de la plataforma. `?u=uid` abre el de otra persona; sin
 * nada, el propio. Lo cuenta `app/api/perfiles`.
 */

type Hito = { anio: string; titulo: string; texto: string };
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
    recorrido: Hito[];
    desde: string | null;
  };
  fotos: { id: string; url: string; pie: string }[];
  publicaciones: number;
};

const uidDeLaDireccion = () => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('u') || '');

export default function Perfil() {
  const [uid, setUid] = useState(uidDeLaDireccion);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'fotos' | 'recorrido' | 'logros'>('fotos');
  const [editando, setEditando] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [montado, setMontado] = useState(false);
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
      setFallo((e as Error).message);
    }
  }, [uid]);

  useEffect(() => {
    setDatos(null);
    setPestana('fotos');
    cargar();
  }, [cargar]);

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
      else if (j.foto) setDatos((d) => (d ? { ...d, fotos: [j.foto!, ...d.fotos] } : d));
    } catch (e) {
      setAviso((e as Error).message || 'No hay conexión. Inténtalo otra vez.');
    } finally {
      setSubiendo(null);
    }
  }

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function borrarFoto(id: string) {
    if (!datos || !window.confirm('¿Borrar esta foto?')) return;
    const q = new URLSearchParams({ foto: id, ...(datos.esMio ? {} : { uid: datos.perfil.uid }) });
    const j = await leerRespuesta(await fetch(`/api/perfiles?${q}`, { method: 'DELETE' }).catch(() => new Response('')));
    if (j.ok) {
      setDatos((d) => (d ? { ...d, fotos: d.fotos.filter((f) => f.id !== id) } : d));
      setAbierta(null);
    } else setAviso('No se ha podido borrar. Inténtalo otra vez.');
  }

  if (fallo) return <p className={p.fallo}>{fallo}</p>;
  if (!datos) return <div className={p.esqueleto} aria-label="Cargando el perfil" />;

  const { perfil, esMio, fotos } = datos;
  const ini = perfil.nombre.split(/\s+/).slice(0, 2).map((x) => x[0] ?? '').join('').toUpperCase();
  const vacio = !perfil.bio && !perfil.especialidad && fotos.length === 0 && perfil.recorrido.length === 0;

  return (
    <div className={p.perfil}>
      {/* ---------- Portada y foto ---------- */}
      <section className={p.cabeza}>
        <div className={p.portada} style={perfil.portada ? { backgroundImage: `url(${perfil.portada})` } : undefined}>
          {esMio && (
            <button type="button" className={p.cambiarPortada} onClick={() => entradaPortada.current?.click()} disabled={subiendo === 'portada'}>
              {subiendo === 'portada' ? 'Subiendo…' : perfil.portada ? 'Cambiar portada' : 'Poner portada'}
            </button>
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
            {(perfil.especialidad || perfil.ciudad) && (
              <p className={p.sub}>{[perfil.especialidad, perfil.ciudad].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          {esMio && (
            <button type="button" className={p.btnEditar} onClick={() => setEditando(true)}>
              Editar perfil
            </button>
          )}
        </div>

        <div className={p.cifras}>
          <span><b>{fotos.length}</b> fotos</span>
          <span><b>{datos.publicaciones}</b> publicaciones</span>
          <span><b>{perfil.recorrido.length}</b> hitos</span>
        </div>

        {perfil.bio && <p className={p.bio}>{perfil.bio}</p>}
        {perfil.instagram && (
          <a className={p.instagram} href={`https://instagram.com/${perfil.instagram}`} target="_blank" rel="noopener noreferrer">
            @{perfil.instagram}
          </a>
        )}
        {esMio && vacio && (
          <p className={p.pista}>
            Tu perfil está vacío. Pon una portada, cuéntate en «Editar perfil» y sube fotos de tu trabajo: así te conocen
            tus compañeras.
          </p>
        )}
      </section>

      {/* ---------- Pestañas ---------- */}
      <nav className={p.pestanas} aria-label="Contenido del perfil">
        {(
          [
            ['fotos', 'Fotos'],
            ['recorrido', 'Recorrido'],
            ['logros', 'Logros'],
          ] as const
        ).map(([id, nombre]) => (
          <button key={id} type="button" aria-current={pestana === id ? 'page' : undefined} onClick={() => setPestana(id)}>
            {nombre}
            {pestana === id && <motion.span layoutId="perfil-pestana" className={p.subrayado} />}
          </button>
        ))}
      </nav>

      {pestana === 'fotos' && (
        <div className={p.rejilla}>
          {esMio && (
            <button type="button" className={p.subirFoto} onClick={() => entradaFoto.current?.click()} disabled={subiendo === 'foto'}>
              <span>+</span>
              {subiendo === 'foto' ? 'Subiendo…' : 'Subir foto'}
            </button>
          )}
          {fotos.map((f, i) => (
            <button key={f.id} type="button" className={p.celda} onClick={() => setAbierta(i)} aria-label={f.pie || 'Ver foto'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.pie} loading="lazy" />
            </button>
          ))}
          {!esMio && fotos.length === 0 && <p className={p.vacio}>Todavía no ha subido fotos.</p>}
        </div>
      )}

      {pestana === 'recorrido' && (
        <ol className={p.linea}>
          {perfil.recorrido.length === 0 && (
            <li className={p.vacio}>{esMio ? 'Añade tu recorrido en «Editar perfil»: formaciones, años de cabina, hitos.' : 'Todavía no ha contado su recorrido.'}</li>
          )}
          {perfil.recorrido.map((h, i) => (
            <li key={i} className={p.hito}>
              <span className={p.anio}>{h.anio}</span>
              <div>
                <strong>{h.titulo}</strong>
                {h.texto && <p>{h.texto}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {pestana === 'logros' && <Logros uid={esMio ? undefined : perfil.uid} />}

      <input ref={entradaFoto} type="file" accept="image/*" hidden onChange={(e) => { subir('foto', e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={entradaPortada} type="file" accept="image/*" hidden onChange={(e) => { subir('portada', e.target.files?.[0]); e.target.value = ''; }} />

      {montado &&
        createPortal(
          <AnimatePresence>
            {aviso && (
              <motion.p key="aviso" className={p.aviso} role="alert" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
                {aviso}
              </motion.p>
            )}
          </AnimatePresence>,
          document.body
        )}

      {montado &&
        createPortal(
          <AnimatePresence>
            {abierta !== null && fotos[abierta] && (
              <motion.div className={p.visor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAbierta(null)}>
                <motion.figure initial={{ scale: 0.96 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotos[abierta].url} alt={fotos[abierta].pie} />
                  {(fotos[abierta].pie || esMio || datos.puedeModerar) && (
                    <figcaption>
                      <span>{fotos[abierta].pie}</span>
                      {(esMio || datos.puedeModerar) && (
                        <button type="button" onClick={() => borrarFoto(fotos[abierta].id)}>
                          Borrar
                        </button>
                      )}
                    </figcaption>
                  )}
                </motion.figure>
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
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

function Editor({ datos, cerrar, guardado }: { datos: Datos; cerrar: () => void; guardado: (n: Partial<Datos['perfil']>) => void }) {
  const [f, setF] = useState({
    bio: datos.perfil.bio,
    especialidad: datos.perfil.especialidad,
    ciudad: datos.perfil.ciudad,
    instagram: datos.perfil.instagram,
    recorrido: datos.perfil.recorrido.length ? datos.perfil.recorrido : [{ anio: '', titulo: '', texto: '' }],
  });
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const cuerpo = { ...f, recorrido: f.recorrido.filter((r) => r.titulo.trim()) };
    const j = await (await fetch('/api/perfiles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })).json().catch(() => ({ ok: false }));
    setGuardando(false);
    if (j.ok) guardado({ ...cuerpo, instagram: cuerpo.instagram.replace(/^@/, '') });
  }

  const hito = (i: number, k: keyof Hito, v: string) => setF((x) => ({ ...x, recorrido: x.recorrido.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));

  return (
    <motion.div className={p.velo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className={p.editor} role="dialog" aria-modal="true" aria-label="Editar perfil" initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 16, opacity: 0 }}>
        <header className={p.editorCabeza}>
          <strong>Editar perfil</strong>
          <button type="button" className={p.cerrar} onClick={cerrar} aria-label="Cerrar">×</button>
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
              <input maxLength={80} value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} />
            </label>
          </div>
          <label className={p.campo}>
            <span>Instagram</span>
            <input maxLength={40} value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} placeholder="@tucuenta" />
          </label>

          <p className={p.rotulo}>Tu recorrido</p>
          {f.recorrido.map((r, i) => (
            <div key={i} className={p.hitoEditor}>
              <input className={p.anioInput} maxLength={12} value={r.anio} onChange={(e) => hito(i, 'anio', e.target.value)} placeholder="2024" aria-label="Año" />
              <div>
                <input maxLength={90} value={r.titulo} onChange={(e) => hito(i, 'titulo', e.target.value)} placeholder="Qué pasó (p. ej. «Formación Técnica Divine»)" aria-label="Título" />
                <input maxLength={400} value={r.texto} onChange={(e) => hito(i, 'texto', e.target.value)} placeholder="Detalle (opcional)" aria-label="Detalle" />
              </div>
              <button type="button" className={p.quitar} onClick={() => setF((x) => ({ ...x, recorrido: x.recorrido.filter((_, j) => j !== i) }))} aria-label="Quitar">×</button>
            </div>
          ))}
          {f.recorrido.length < 20 && (
            <button type="button" className={p.anadir} onClick={() => setF((x) => ({ ...x, recorrido: [...x.recorrido, { anio: '', titulo: '', texto: '' }] }))}>
              + Añadir un hito
            </button>
          )}
        </div>
        <footer className={p.editorPie}>
          <button type="button" className={p.btnLinea} onClick={cerrar}>Cancelar</button>
          <button type="button" className={p.btnOscuro} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
