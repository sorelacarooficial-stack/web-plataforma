'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import Cuerpo from '@/components/blog/Cuerpo';
import { CATEGORIAS, minutosDe, type Articulo, type Bloque } from '@/lib/blog-tipos';
import css from './plataforma.module.css';
import b from './blogadmin.module.css';

/**
 * El blog, en el panel de Sorela: la lista de artículos y el editor.
 *
 * Se escribe por bloques —texto, subtítulo, imagen, cita, lista, vídeo— y a la
 * derecha se ve el artículo exactamente como saldrá en la web (es el mismo
 * componente, ver components/blog/Cuerpo). Al publicar, sale en /blog al
 * momento.
 */

type Borrador = Omit<Articulo, 'id' | 'slug' | 'publicado' | 'actualizado' | 'minutos'> & {
  id: string | null;
  slug?: string;
};

/* Cada bloque lleva una clave propia para poder arrastrarlo sin que React
   confunda uno con otro. No se guarda: es solo de la pantalla. */
type BloqueEd = Bloque & { _k: string };
let contador = 0;
const clave = () => `b${Date.now().toString(36)}${(contador++).toString(36)}`;

const VACIO: Borrador = { id: null, titulo: '', resumen: '', categoria: '', portada: null, bloques: [], estado: 'borrador' };

const TIPOS: { tipo: Bloque['tipo']; label: string; icono: string }[] = [
  { tipo: 'parrafo', label: 'Texto', icono: '¶' },
  { tipo: 'subtitulo', label: 'Subtítulo', icono: 'H' },
  { tipo: 'imagen', label: 'Imagen', icono: '▣' },
  { tipo: 'cita', label: 'Cita', icono: '❝' },
  { tipo: 'lista', label: 'Lista', icono: '•' },
  { tipo: 'video', label: 'Vídeo', icono: '▶' },
];

function nuevoBloque(tipo: Bloque['tipo']): BloqueEd {
  const k = clave();
  switch (tipo) {
    case 'imagen':
      return { tipo, url: '', pie: '', _k: k };
    case 'cita':
      return { tipo, texto: '', autor: '', _k: k };
    case 'lista':
      return { tipo, items: [''], _k: k };
    case 'video':
      return { tipo, youtube: '', _k: k };
    default:
      return { tipo, texto: '', _k: k } as BloqueEd;
  }
}

const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

/** Un textarea que crece con lo que se escribe. */
function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

async function subirImagen(archivo: File): Promise<string> {
  const f = new FormData();
  f.append('archivo', archivo);
  const r = await fetch('/api/blog/imagen', { method: 'POST', body: f });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(j.texto || 'No he podido subir la imagen.');
  return j.url;
}

function Subir({ alSubir, texto = 'Subir imagen', grande = false }: { alSubir: (url: string) => void; texto?: string; grande?: boolean }) {
  const [subiendo, setSubiendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const tomar = async (f?: File | null) => {
    if (!f) return;
    setSubiendo(true);
    setFallo(null);
    try {
      alSubir(await subirImagen(f));
    } catch (e) {
      setFallo((e as Error).message);
    }
    setSubiendo(false);
  };
  return (
    <div
      className={grande ? b.soltar : b.soltarPeque}
      data-encima={encima ? '' : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        tomar(e.dataTransfer.files?.[0]);
      }}
    >
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => tomar(e.target.files?.[0])} />
      <button type="button" className={css.btnLinea} onClick={() => input.current?.click()} disabled={subiendo}>
        {subiendo ? 'Subiendo…' : texto}
      </button>
      {grande && <span className={b.ayuda}>o arrástrala aquí · se ajusta sola para la web</span>}
      {fallo && <span className={b.error}>{fallo}</span>}
    </div>
  );
}

function EditorBloque({ bloque, cambiar }: { bloque: BloqueEd; cambiar: (b: BloqueEd) => void }) {
  switch (bloque.tipo) {
    case 'parrafo':
      return (
        <Area
          className={b.texto}
          value={bloque.texto}
          placeholder="Escribe aquí. **negrita**, *cursiva* y [enlace](https://…)"
          onChange={(e) => cambiar({ ...bloque, texto: e.target.value })}
        />
      );
    case 'subtitulo':
      return <input className={b.subtitulo} value={bloque.texto} placeholder="Un subtítulo" onChange={(e) => cambiar({ ...bloque, texto: e.target.value })} />;
    case 'cita':
      return (
        <div className={b.columna}>
          <Area className={b.cita} value={bloque.texto} placeholder="La frase que quieres destacar" onChange={(e) => cambiar({ ...bloque, texto: e.target.value })} />
          <input className={b.campo} value={bloque.autor ?? ''} placeholder="De quién es (opcional)" onChange={(e) => cambiar({ ...bloque, autor: e.target.value })} />
        </div>
      );
    case 'lista':
      return (
        <div className={b.columna}>
          {bloque.items.map((it, i) => (
            <div key={i} className={b.itemLista}>
              <span>•</span>
              <input
                className={b.campo}
                value={it}
                placeholder="Un punto"
                onChange={(e) => cambiar({ ...bloque, items: bloque.items.map((x, j) => (j === i ? e.target.value : x)) })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const items = [...bloque.items];
                    items.splice(i + 1, 0, '');
                    cambiar({ ...bloque, items });
                  }
                }}
              />
              {bloque.items.length > 1 && (
                <button type="button" className={b.quitarItem} aria-label="Quitar este punto" onClick={() => cambiar({ ...bloque, items: bloque.items.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className={b.masItem} onClick={() => cambiar({ ...bloque, items: [...bloque.items, ''] })}>
            + Otro punto
          </button>
        </div>
      );
    case 'imagen':
      return (
        <div className={b.columna}>
          {bloque.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bloque.url} alt="" className={b.miniatura} />
          ) : null}
          <Subir texto={bloque.url ? 'Cambiar imagen' : 'Subir imagen'} alSubir={(url) => cambiar({ ...bloque, url })} grande={!bloque.url} />
          <input className={b.campo} value={bloque.pie ?? ''} placeholder="Pie de foto (opcional)" onChange={(e) => cambiar({ ...bloque, pie: e.target.value })} />
        </div>
      );
    case 'video':
      return (
        <input
          className={b.campo}
          value={bloque.youtube}
          placeholder="Pega el enlace de YouTube"
          onChange={(e) => cambiar({ ...bloque, youtube: e.target.value })}
        />
      );
  }
}

/** Un bloque en el editor. Se arrastra solo desde el asa, para que escribir y
    seleccionar texto dentro no lo mueva. */
function ItemBloque({
  bl,
  primero,
  ultimo,
  mover,
  quitar,
  cambiar,
}: {
  bl: BloqueEd;
  primero: boolean;
  ultimo: boolean;
  mover: (d: -1 | 1) => void;
  quitar: () => void;
  cambiar: (b: BloqueEd) => void;
}) {
  const controles = useDragControls();
  return (
    <Reorder.Item
      value={bl}
      dragListener={false}
      dragControls={controles}
      className={b.bloque}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      whileDrag={{ scale: 1.02, boxShadow: '0 20px 40px -20px rgba(60,45,25,.5)' }}
    >
      <div className={b.bloqueCabecera}>
        <span className={b.asa} title="Arrastra para mover" onPointerDown={(e) => controles.start(e)}>
          ⋮⋮
        </span>
        <span className={b.bloqueTipo}>{TIPOS.find((t) => t.tipo === bl.tipo)?.label}</span>
        <span className={b.bloqueMandos}>
          <button type="button" aria-label="Subir" disabled={primero} onClick={() => mover(-1)}>
            ↑
          </button>
          <button type="button" aria-label="Bajar" disabled={ultimo} onClick={() => mover(1)}>
            ↓
          </button>
          <button type="button" aria-label="Quitar este bloque" onClick={quitar}>
            ✕
          </button>
        </span>
      </div>
      <EditorBloque bloque={bl} cambiar={cambiar} />
    </Reorder.Item>
  );
}

function Editor({ inicial, volver, alGuardar }: { inicial: Borrador; volver: () => void; alGuardar: (a: Articulo) => void }) {
  const [a, setA] = useState<Borrador>(inicial);
  const [bloques, setBloques] = useState<BloqueEd[]>(() =>
    inicial.bloques.length ? inicial.bloques.map((x) => ({ ...x, _k: clave() })) : [nuevoBloque('parrafo')]
  );
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'escribir' | 'ver'>('escribir');

  const cambiarA = (c: Partial<Borrador>) => {
    setA((x) => ({ ...x, ...c }));
    setSucio(true);
  };
  const cambiarBloques = (n: BloqueEd[]) => {
    setBloques(n);
    setSucio(true);
  };

  useEffect(() => {
    if (!sucio) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [sucio]);

  const limpios = (): Bloque[] => bloques.map(({ _k, ...x }) => x as Bloque); // eslint-disable-line @typescript-eslint/no-unused-vars

  async function guardar(estado: 'borrador' | 'publicado') {
    setGuardando(true);
    setErrores({});
    setAviso(null);
    try {
      const r = await fetch('/api/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...a, bloques: limpios(), estado }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErrores(j.errores ?? { general: 'No he podido guardarlo.' });
      } else {
        setA((x) => ({ ...x, id: j.articulo.id, slug: j.articulo.slug, estado: j.articulo.estado }));
        setSucio(false);
        setAviso(estado === 'publicado' ? (a.estado === 'publicado' ? 'Cambios publicados en la web.' : '¡Publicado! Ya está en la web.') : a.estado === 'publicado' ? 'Retirado de la web: ahora es un borrador.' : 'Borrador guardado.');
        alGuardar(j.articulo);
      }
    } catch {
      setErrores({ general: 'No hay conexión con el servidor.' });
    }
    setGuardando(false);
  }

  const salir = () => {
    if (sucio && !window.confirm('Tienes cambios sin guardar. ¿Salir igualmente?')) return;
    volver();
  };

  const vista = (
    <div className={b.previa}>
      <div className={b.previaCabecera}>
        {a.categoria && <span className={b.previaCategoria}>{a.categoria}</span>}
        <h1 className={b.previaTitulo}>{a.titulo || 'El título de tu artículo'}</h1>
        {a.resumen && <p className={b.previaResumen}>{a.resumen}</p>}
        <span className={b.previaMeta}>Sorela Caro · {minutosDe(limpios(), a.resumen)} min de lectura</span>
      </div>
      {a.portada && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.portada.url} alt="" className={b.previaPortada} />
      )}
      <Cuerpo bloques={limpios()} />
    </div>
  );

  return (
    <div className={b.editor}>
      <div className={b.barra}>
        <button type="button" className={b.volver} onClick={salir}>
          ← Artículos
        </button>
        <span className={b.estado} data-estado={sucio ? 'sucio' : a.estado}>
          {sucio ? 'Cambios sin guardar' : a.estado === 'publicado' ? 'Publicado' : a.id ? 'Borrador guardado' : 'Nuevo'}
        </span>
        <div className={b.acciones}>
          {a.estado === 'publicado' && a.slug && (
            <a className={css.enlaceAccion} href={`/blog/${a.slug}`} target="_blank" rel="noreferrer">
              Ver en la web ↗
            </a>
          )}
          {a.estado === 'publicado' ? (
            <button type="button" className={css.btnLinea} disabled={guardando} onClick={() => guardar('borrador')}>
              Retirar de la web
            </button>
          ) : (
            <button type="button" className={css.btnLinea} disabled={guardando} onClick={() => guardar('borrador')}>
              Guardar borrador
            </button>
          )}
          <button type="button" className={css.btn} disabled={guardando} onClick={() => guardar('publicado')}>
            {guardando ? 'Guardando…' : a.estado === 'publicado' ? 'Publicar cambios' : 'Publicar'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {(aviso || Object.keys(errores).length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={Object.keys(errores).length ? b.avisoMal : b.avisoBien}
          >
            {aviso ?? Object.values(errores).join(' ')}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={b.pestanas} role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'escribir'} onClick={() => setPestana('escribir')}>
          Escribir
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'ver'} onClick={() => setPestana('ver')}>
          Vista previa
        </button>
      </div>

      <div className={b.dos} data-pestana={pestana}>
        <div className={b.escribir}>
          <input
            className={b.titulo}
            value={a.titulo}
            placeholder="Título del artículo"
            onChange={(e) => cambiarA({ titulo: e.target.value })}
            aria-invalid={Boolean(errores.titulo)}
          />
          <label className={b.etiqueta}>
            Resumen
            <Area
              className={b.resumen}
              value={a.resumen}
              placeholder="Dos frases que inviten a leerlo. Es lo que sale en Google y al compartirlo por WhatsApp."
              onChange={(e) => cambiarA({ resumen: e.target.value })}
              maxLength={400}
            />
            <span className={b.contador} data-largo={a.resumen.length > 170 ? '' : undefined}>
              {a.resumen.length} / 160 recomendado
            </span>
          </label>

          <div className={b.etiqueta}>
            Tema
            <div className={b.chips}>
              {CATEGORIAS.map((c) => (
                <button key={c} type="button" className={b.chip} data-on={a.categoria === c ? '' : undefined} onClick={() => cambiarA({ categoria: a.categoria === c ? '' : c })}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className={b.etiqueta}>
            Foto de portada
            {a.portada ? (
              <div className={b.portada}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.portada.url} alt="" />
                <div className={b.portadaAcciones}>
                  <Subir texto="Cambiar" alSubir={(url) => cambiarA({ portada: { url, alt: a.titulo } })} />
                  <button type="button" className={css.enlaceAccion} onClick={() => cambiarA({ portada: null })}>
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <Subir grande texto="Elegir foto de portada" alSubir={(url) => cambiarA({ portada: { url, alt: a.titulo } })} />
            )}
          </div>

          <div className={b.etiqueta}>
            Contenido
            <Reorder.Group axis="y" values={bloques} onReorder={cambiarBloques} className={b.bloques}>
              <AnimatePresence initial={false}>
                {bloques.map((bl, i) => (
                  <ItemBloque
                    key={bl._k}
                    bl={bl}
                    primero={i === 0}
                    ultimo={i === bloques.length - 1}
                    mover={(d) => {
                      const n = [...bloques];
                      [n[i + d], n[i]] = [n[i], n[i + d]];
                      cambiarBloques(n);
                    }}
                    quitar={() => cambiarBloques(bloques.filter((x) => x._k !== bl._k))}
                    cambiar={(nb) => cambiarBloques(bloques.map((x) => (x._k === bl._k ? nb : x)))}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>
            <div className={b.anadir}>
              <span>Añadir</span>
              {TIPOS.map((t) => (
                <button key={t.tipo} type="button" onClick={() => cambiarBloques([...bloques, nuevoBloque(t.tipo)])}>
                  <i>{t.icono}</i> {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className={b.ver} aria-label="Vista previa">
          <p className={b.verRotulo}>Así se verá en la web</p>
          {vista}
        </aside>
      </div>
    </div>
  );
}

export default function BlogAdmin() {
  const [lista, setLista] = useState<Articulo[] | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/blog')).json();
      if (j.ok) setLista(j.articulos);
      else setFallo(true);
    } catch {
      setFallo(true);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function borrar(x: Articulo) {
    if (!window.confirm(`¿Borrar «${x.titulo}»? ${x.estado === 'publicado' ? 'Desaparecerá de la web. ' : ''}No se puede deshacer.`)) return;
    const r = await fetch(`/api/blog?id=${encodeURIComponent(x.id)}`, { method: 'DELETE' });
    if ((await r.json().catch(() => ({ ok: false }))).ok) setLista((l) => l?.filter((y) => y.id !== x.id) ?? l);
  }

  if (editando)
    return (
      <Editor
        inicial={editando}
        volver={() => {
          setEditando(null);
          cargar();
        }}
        alGuardar={(art) => setLista((l) => [art, ...(l ?? []).filter((y) => y.id !== art.id)])}
      />
    );

  const publicados = lista?.filter((x) => x.estado === 'publicado').length ?? 0;

  return (
    <div className={b.lista}>
      <div className={b.listaCabecera}>
        <div>
          <p className={b.listaTitulo}>Tus artículos</p>
          <p className={b.ayuda}>
            {lista ? `${publicados} publicados · ${lista.length - publicados} borradores` : 'Cargando…'} · se ven en{' '}
            <a href="/blog" target="_blank" rel="noreferrer">
              sorelacarodivine.com/blog
            </a>
          </p>
        </div>
        <button type="button" className={css.btn} onClick={() => setEditando({ ...VACIO })}>
          Escribir un artículo
        </button>
      </div>

      {fallo && <p className={b.error}>No he podido cargar los artículos.</p>}

      {lista && lista.length === 0 && (
        <div className={b.vacio}>
          <p className={b.vacioTitulo}>Tu primer artículo</p>
          <p>
            Escribir en el blog te ayuda a salir en Google cuando alguien busca «drenaje linfático» en su ciudad. Empieza
            por algo que te pregunten mucho en cabina.
          </p>
          <button type="button" className={css.btn} onClick={() => setEditando({ ...VACIO })}>
            Escribir el primero
          </button>
        </div>
      )}

      <div className={b.rejilla}>
        {lista?.map((x, i) => (
          <motion.article key={x.id} className={b.tarjeta} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <button type="button" className={b.tarjetaFoto} onClick={() => setEditando({ ...x })}>
              {x.portada ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.portada.url} alt="" />
              ) : (
                <span className={b.sinFoto} />
              )}
              <span className={b.estadoTarjeta} data-estado={x.estado}>
                {x.estado === 'publicado' ? 'Publicado' : 'Borrador'}
              </span>
            </button>
            <div className={b.tarjetaTexto}>
              <strong>{x.titulo || 'Sin título'}</strong>
              <span>
                {x.categoria && `${x.categoria} · `}
                {x.publicado ? FECHA.format(new Date(x.publicado)) : x.actualizado ? `Editado el ${FECHA.format(new Date(x.actualizado))}` : ''} · {x.minutos} min
              </span>
            </div>
            <div className={b.tarjetaAcciones}>
              <button type="button" className={css.btnLinea} onClick={() => setEditando({ ...x })}>
                Editar
              </button>
              {x.estado === 'publicado' && (
                <a className={css.enlaceAccion} href={`/blog/${x.slug}`} target="_blank" rel="noreferrer">
                  Ver ↗
                </a>
              )}
              <button type="button" className={css.enlaceAccion} onClick={() => borrar(x)}>
                Borrar
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
