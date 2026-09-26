'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { idDeYoutube, porBloques, type Leccion } from '@/lib/aula';
import type { Acceso } from '@/lib/accesos';
import css from './plataforma.module.css';

/**
 * Donde Sorela monta el aula.
 *
 * Aquí antes había una maqueta con un recuadro de «arrastra tu vídeo». No
 * servía y además prometía algo que no va a pasar: el vídeo no se sube a esta
 * plataforma. Se sube a YouTube, como ella ya sube los suyos, y aquí se pega
 * el enlace.
 *
 * Eso no es un atajo: una base de datos no sirve vídeo, y servirlo desde aquí
 * costaría por giga y se cortaría en cuanto alguien lo viera desde una
 * conexión mala. YouTube hace esa parte mejor. Lo que sí hace esta pantalla es
 * lo que YouTube no sabe: decidir quién puede ver cada clase.
 *
 * Y lo que hay que saber: un vídeo no listado lo ve cualquiera que tenga el
 * enlace. Se dice en pantalla, una vez, sin dramatizar.
 */

type Respuesta = {
  lecciones: Leccion[];
  cursos: string[];
};

/** Lo que se está escribiendo. `destino` es el valor del desplegable. */
const NUEVO = '__nuevo__';

export default function SubirClases() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enlace, setEnlace] = useState('');
  const [destino, setDestino] = useState('membresia');
  const [cursoNuevo, setCursoNuevo] = useState('');
  const [publicar, setPublicar] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const r = await fetch('/api/lecciones');
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setFallo(
          c.motivo === 'sin-configurar'
            ? 'Falta la configuración de Firebase en el servidor.'
            : c.motivo === 'sin-permiso'
              ? 'El aula solo la monta Sorela.'
              : 'No he podido cargar las clases.'
        );
        setDatos({ lecciones: [], cursos: [] });
        return;
      }
      setDatos({ lecciones: c.lecciones ?? [], cursos: c.cursos ?? [] });
    } catch {
      setFallo('No hay conexión con el servidor.');
      setDatos({ lecciones: [], cursos: [] });
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Lo que se ve mientras se escribe el enlace: si se reconoce, la miniatura
     del vídeo. Es la única forma de que se dé cuenta AHORA de que ha pegado el
     enlace equivocado, en vez de cuando una alumna se lo diga. */
  const videoId = useMemo(() => idDeYoutube(enlace), [enlace]);

  function aQuien(): Acceso | null {
    if (destino === 'membresia') return { tipo: 'membresia' };
    const nombre = (destino === NUEVO ? cursoNuevo : destino).trim();
    return nombre ? { tipo: 'curso', nombre } : null;
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setErrores({});
    setFallo(null);

    try {
      const r = await fetch('/api/lecciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          descripcion,
          video: enlace,
          para: aQuien(),
          publicada: publicar,
        }),
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setErrores(c.errores ?? {});
        if (!c.errores || Object.keys(c.errores).length === 0) {
          setFallo('No he podido guardar la clase.');
        }
        return;
      }

      // Se vacían el título, el texto y el enlace, pero NO a quién va dirigida:
      // lo normal es subir varias clases del mismo curso seguidas.
      setTitulo('');
      setDescripcion('');
      setEnlace('');
      setAviso(
        publicar
          ? 'Clase subida y visible para quien le toque.'
          : 'Clase subida, en borrador. Publícala cuando esté lista.'
      );
      await cargar();
    } catch {
      setFallo('No hay conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiar(l: Leccion, cambios: Partial<Leccion>) {
    const antes = datos;
    setDatos((d) =>
      d ? { ...d, lecciones: d.lecciones.map((x) => (x.id === l.id ? { ...x, ...cambios } : x)) } : d
    );
    try {
      const r = await fetch('/api/lecciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: l.id, ...cambios }),
      });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      setFallo(null);
    } catch {
      setDatos(antes);
      setFallo('No se ha podido guardar el cambio. Vuelve a intentarlo.');
    }
  }

  async function borrar(l: Leccion) {
    if (
      !window.confirm(
        `¿Quitar «${l.titulo}» del aula?\n\nEl vídeo NO se borra de YouTube: sigue allí y hay que quitarlo desde tu canal si quieres que desaparezca.`
      )
    ) {
      return;
    }

    const antes = datos;
    setDatos((d) => (d ? { ...d, lecciones: d.lecciones.filter((x) => x.id !== l.id) } : d));
    try {
      const r = await fetch(`/api/lecciones?id=${encodeURIComponent(l.id)}`, { method: 'DELETE' });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      setAviso(`«${l.titulo}» ya no está en el aula.`);
    } catch {
      setDatos(antes);
      setFallo('No se ha podido quitar. Vuelve a intentarlo.');
    }
  }

  if (!datos) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando el aula…</p>
      </div>
    );
  }

  const bloques = porBloques(datos.lecciones);

  return (
    <div className={css.columna}>
      <p className={css.intro}>
        Las clases que subas aquí son las que ven tus alumnas y las de la comunidad, cada una las
        suyas. Puedes dejarlas en borrador hasta que el curso esté entero.
      </p>

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={css.btnLinea} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}
      {aviso && (
        <p className={css.avisoBien} role="status">
          {aviso}
        </p>
      )}

      {/* ---------- Lo que ya hay ---------- */}
      {bloques.length === 0 ? (
        <section className={css.tarjeta}>
          <p className={css.vacioTexto}>
            Todavía no hay ninguna clase. Sube la primera aquí abajo: pega el enlace del vídeo de
            tu canal de YouTube y elige quién puede verla.
          </p>
        </section>
      ) : (
        bloques.map((b) => (
          <section key={b.nombre} className={css.tarjeta}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <h2 className={css.h3}>{b.nombre}</h2>
              <span className={css.apunte}>
                {b.lecciones.length === 1 ? '1 clase' : `${b.lecciones.length} clases`}
                {b.lecciones.some((l) => !l.publicada) &&
                  ` · ${b.lecciones.filter((l) => !l.publicada).length} en borrador`}
              </span>
            </div>

            {b.lecciones.map((l) => (
              <article key={l.id} className={css.fila} style={{ padding: '14px 0', gap: 14 }}>
                {/* La miniatura la sirve YouTube. Es la forma más rápida de
                    comprobar de un vistazo que cada clase apunta a su vídeo. */}
                <img
                  src={`https://i.ytimg.com/vi/${l.video}/mqdefault.jpg`}
                  alt=""
                  className={css.miniatura}
                  loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                />

                <span
                  style={{
                    flex: '1 1 240px',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 15, color: 'var(--ink)' }}>{l.titulo}</span>
                  {l.descripcion && (
                    <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                      {l.descripcion}
                    </span>
                  )}
                </span>

                <span className={`${css.estado} ${l.publicada ? css.estadoOro : css.estadoApagado}`}>
                  {l.publicada ? 'Visible' : 'Borrador'}
                </span>

                <span className={css.acciones}>
                  <button
                    type="button"
                    className={css.btnLinea}
                    onClick={() => cambiar(l, { publicada: !l.publicada })}
                  >
                    {l.publicada ? 'Pasar a borrador' : 'Publicar'}
                  </button>
                  <a
                    className={css.enlaceAccion}
                    href={`https://www.youtube.com/watch?v=${l.video}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver en YouTube
                  </a>
                  <button type="button" className={css.enlaceAccion} onClick={() => borrar(l)}>
                    Quitar
                  </button>
                </span>
              </article>
            ))}
          </section>
        ))
      )}

      {/* ---------- Subir una ---------- */}
      <section className={css.punteada}>
        <form onSubmit={crear} className={css.columna} style={{ gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p className={css.rotuloSeccion}>Subir una clase</p>
            <p className={css.apunte}>
              El vídeo va en tu canal de YouTube, como los demás. Aquí solo pegas su enlace y dices
              quién puede verla.
            </p>
          </div>

          <label className={css.etiquetaCampo}>
            Enlace del vídeo
            <input
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://youtu.be/…"
              className={css.campoCaja}
            />
            {errores.video && (
              <span className={css.errorCampo} role="alert">
                {errores.video}
              </span>
            )}
            <span className={css.apunte}>
              Vale como lo copies: desde la barra del navegador, desde «Compartir» o desde el móvil.
            </span>
          </label>

          {/* En cuanto el enlace se reconoce, su miniatura. Si sale la que no
              es, se ve ahora y no cuando lo diga una alumna. */}
          {videoId && (
            <div className={css.vistaPrevia}>
              <img
                src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                alt=""
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
              <span className={css.apunte}>
                Este es el vídeo que se va a ver. Si no es el que querías, cambia el enlace.
              </span>
            </div>
          )}

          <label className={css.etiquetaCampo}>
            Título de la clase
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Lipodrenaje: protocolo completo"
              className={css.campoCaja}
            />
            {errores.titulo && (
              <span className={css.errorCampo} role="alert">
                {errores.titulo}
              </span>
            )}
          </label>

          <label className={css.etiquetaCampo}>
            De qué va
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Lo que se ve en esta clase. Opcional."
              className={css.campoCaja}
              style={{ resize: 'vertical' }}
            />
          </label>

          <label className={css.etiquetaCampo}>
            Quién puede verla
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className={css.campoCaja}
            >
              <option value="membresia">Comunidad Divine</option>
              {datos.cursos.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NUEVO}>Otra formación…</option>
            </select>
            {errores.para && (
              <span className={css.errorCampo} role="alert">
                {errores.para}
              </span>
            )}
            <span className={css.apunte}>
              Solo la ve quien tenga eso contratado. Los cursos de la lista son los que ya has
              usado en alguna ficha o en alguna clase.
            </span>
          </label>

          {destino === NUEVO && (
            <label className={css.etiquetaCampo}>
              Nombre de la formación
              <input
                value={cursoNuevo}
                onChange={(e) => setCursoNuevo(e.target.value)}
                placeholder="Formación Base"
                className={css.campoCaja}
              />
              <span className={css.apunte}>
                Escríbelo igual que en la ficha de tus alumnas. Si no coincide, no verán la clase.
              </span>
            </label>
          )}

          <label className={`${css.fichaComunidad} ${publicar ? css.fichaComunidadOn : ''}`}>
            <input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} />
            <span className={css.fichaComunidadTexto}>
              <span className={css.fichaComunidadTitulo}>Publicarla ya</span>
              <span className={css.apunte}>
                Si no la marcas, la clase queda en borrador y solo la ves tú. Puedes publicarla
                después desde su línea.
              </span>
            </span>
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <button type="submit" className={css.btn} disabled={guardando}>
              {guardando ? 'Subiendo…' : 'Añadir la clase'}
            </button>
          </div>

          <div className={css.aviso} role="note">
            <p className={css.parrafo} style={{ margin: 0, flex: '1 1 320px' }}>
              <strong>Sube los vídeos como «no listado», no como públicos.</strong> Así no salen en
              tu canal ni en las búsquedas. Aun así, quien tenga el enlace puede verlo sin pasar por
              aquí: si una alumna lo reenvía, ese vídeo queda abierto. Para lo que no pueda salir de
              aquí, dímelo y lo cambiamos a un servicio que sí lo cierre.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
