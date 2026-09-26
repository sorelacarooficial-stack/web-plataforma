'use client';

import { useCallback, useEffect, useState } from 'react';
import { porBloques, urlDeVideo, type Leccion } from '@/lib/aula';
import css from './plataforma.module.css';

/**
 * El aula: lo que ve quien ha comprado algo.
 *
 * Solo llegan aquí las clases que le tocan. El filtro NO se hace en esta
 * pantalla, se hace en el servidor (`app/api/lecciones`), y eso importa:
 * esconder una clase en el navegador no la protege, porque quien mirase la
 * respuesta de red vería el identificador del vídeo y con él lo abriría en
 * YouTube. Lo que no le toca a alguien no sale del servidor.
 *
 * Si todavía no hay clases, se dice. Un aula vacía que finge estar llena con
 * lecciones de ejemplo sería exactamente lo que esta plataforma lleva toda la
 * vida evitando.
 */

export default function Aula() {
  const [lecciones, setLecciones] = useState<Leccion[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  /* Cuál se está viendo. Empieza sin ninguna: la portada del aula es la lista,
     y el vídeo se abre al elegir. Así no arranca a cargar un reproductor —y
     las cookies que trae— antes de que nadie haya pedido ver nada. */
  const [abierta, setAbierta] = useState<Leccion | null>(null);

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const r = await fetch('/api/lecciones');
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setFallo(
          c.motivo === 'sin-configurar'
            ? 'Falta la configuración del servidor.'
            : 'No he podido cargar tus clases.'
        );
        setLecciones([]);
        return;
      }
      setLecciones(c.lecciones ?? []);
    } catch {
      setFallo('No hay conexión con el servidor.');
      setLecciones([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (lecciones === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando tus clases…</p>
      </div>
    );
  }

  const bloques = porBloques(lecciones);

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

      {/* El reproductor, arriba y solo cuando se ha elegido una clase. */}
      {abierta && (
        <section className={css.tarjeta}>
          <div className={css.reproductor}>
            <iframe
              src={urlDeVideo(abierta.video)}
              title={abierta.titulo}
              // Lo que el reproductor necesita para funcionar, y nada más.
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <h2 className={css.h3}>{abierta.titulo}</h2>
            <button type="button" className={css.btnLinea} onClick={() => setAbierta(null)}>
              Cerrar
            </button>
          </div>
          {abierta.descripcion && <p className={css.parrafo}>{abierta.descripcion}</p>}
        </section>
      )}

      {bloques.length === 0 ? (
        <section className={css.tarjeta}>
          <p className={css.vacioTexto}>
            Todavía no hay ninguna clase publicada para ti. En cuanto Sorela suba la primera, la
            verás aquí sin tener que hacer nada.
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
              </span>
            </div>

            <div className={css.rejillaClases}>
              {b.lecciones.map((l, i) => (
                <button
                  key={l.id}
                  type="button"
                  className={`${css.clase} ${abierta?.id === l.id ? css.claseAbierta : ''}`}
                  onClick={() => setAbierta(l)}
                >
                  <span className={css.claseFoto}>
                    {/* La miniatura la sirve YouTube, así que no hay que
                        guardar ni una imagen para esto. */}
                    <img
                      src={`https://i.ytimg.com/vi/${l.video}/mqdefault.jpg`}
                      alt=""
                      loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                    />
                    <span className={css.clasePlay} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="17" height="17">
                        <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                      </svg>
                    </span>
                  </span>
                  <span className={css.claseCuerpo}>
                    <span className={css.claseNumero}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={css.claseTitulo}>{l.titulo}</span>
                    {l.descripcion && <span className={css.claseTexto}>{l.descripcion}</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
