'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { idDeYoutube, urlDeVideo } from '@/lib/youtube';
import { leccionesDe, type LeccionInicio, type Publico } from '@/lib/empieza-aqui';
import type { ProximaClase } from '@/lib/comunidad-tipos';
import type { Vista } from '@/lib/plataforma';
import AnadirCalendario, { eventoDeClase } from './AnadirCalendario';
import { ENLACE_GRUPO, useEmpiezaAqui } from './useEmpiezaAqui';
import css from './empiezaaqui.module.css';

/**
 * «Empieza aquí»: lo primero en Clases.
 *
 * Una tarjeta con las lecciones del curso de bienvenida (lib/empieza-aqui.ts)
 * y su barra de progreso. Cada lección se abre en una ventana con la misma
 * plantilla: número y título, video (o su hueco hasta que Sorela lo grabe),
 * tres líneas, UNA tarea con su botón, «Marcar como vista» y el progreso.
 *
 * Cuando las ha visto todas, la tarjeta se queda pequeña («Repasar»): no tapa
 * sus clases para siempre.
 */
export default function EmpiezaAqui({
  publico: publicoInicial,
  ir,
  muestra = false,
  elegir = false,
}: {
  publico: Publico;
  /** Sorela: un selector para ver la versión de la academia o la de las homologadas. */
  elegir?: boolean;
  ir: (v: Vista) => void;
  /** Sorela mirando «Ver como»: nada se guarda. */
  muestra?: boolean;
}) {
  const [publico, setPublico] = useState<Publico>(publicoInicial);
  const lecciones = leccionesDe(publico);
  const ea = useEmpiezaAqui(muestra);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [plegada, setPlegada] = useState<boolean | null>(null);
  const [clase, setClase] = useState<ProximaClase>(null);

  useEffect(() => {
    if (publico !== 'homologadas') return;
    fetch('/api/comunidad?solo=muro')
      .then((r) => r.json())
      .then((j) => j.ok && setClase(j.proximaClase ?? null))
      .catch(() => {});
  }, [publico]);

  /* Si se abre Clases con ?l=ea-01 (desde Inicio), abre esa lección. */
  useEffect(() => {
    const l = new URLSearchParams(window.location.search).get('l');
    if (l && lecciones.some((x) => x.id === l)) setAbierta(l);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const vistas = lecciones.filter((l) => ea.vista(l.id)).length;
  const todas = ea.estado !== null && vistas === lecciones.length;
  const pct = Math.round((vistas / lecciones.length) * 100);
  const cerrada = plegada ?? todas;
  const siguiente = lecciones.find((l) => !ea.vista(l.id)) ?? lecciones[0];

  return (
    <section className={css.curso} aria-labelledby="empieza-aqui-titulo" data-plegada={cerrada ? '' : undefined}>
      <header className={css.cabeza}>
        <div className={css.cabezaTexto}>
          <p className={css.rotulo}>{elegir ? 'Vista previa · solo la ves tú' : 'Lo primero'}</p>
          {elegir && (
            <div className={css.elegir} role="group" aria-label="Versión">
              {(['academia', 'homologadas'] as const).map((x) => (
                <button key={x} type="button" aria-pressed={publico === x} onClick={() => setPublico(x)}>
                  {x === 'academia' ? 'Academia' : 'Homologadas'}
                </button>
              ))}
            </div>
          )}
          <h2 id="empieza-aqui-titulo" className={css.titulo}>
            Empieza <strong>aquí</strong>
          </h2>
          <p className={css.frase}>
            {todas ? 'Lo has visto todo. Vuelve cuando quieras.' : `${lecciones.length} videos cortos para conocer tu espacio. Cada uno, una tarea.`}
          </p>
        </div>
        <div className={css.cabezaLado}>
          <div className={css.barra} role="progressbar" aria-valuenow={vistas} aria-valuemin={0} aria-valuemax={lecciones.length} aria-label="Videos vistos">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className={css.cuenta}>
            {vistas} de {lecciones.length} vistos
          </p>
          <div className={css.botones}>
            {!todas && (
              <button type="button" className={css.principal} onClick={() => setAbierta(siguiente.id)}>
                {vistas === 0 ? 'Empezar' : 'Seguir'}
              </button>
            )}
            <button type="button" className={css.linea} aria-expanded={!cerrada} onClick={() => setPlegada(!cerrada)}>
              {cerrada ? (todas ? 'Repasar' : 'Ver los videos') : 'Ocultar'}
            </button>
          </div>
        </div>
      </header>

      {!cerrada && (
        <ol className={css.lista}>
          {lecciones.map((l) => {
            const hecha = ea.vista(l.id);
            return (
              <li key={l.id}>
                <button type="button" className={css.fila} onClick={() => setAbierta(l.id)} data-hecha={hecha ? '' : undefined} data-siguiente={!todas && l.id === siguiente.id ? '' : undefined}>
                  <span className={css.numero}>{l.numero}</span>
                  <span className={css.filaTexto}>
                    <strong>{l.titulo}</strong>
                    <em>
                      {l.duracion} · {l.tarea.boton}
                    </em>
                  </span>
                  <span className={css.estado} aria-label={hecha ? 'Vista' : 'Sin ver'}>
                    {hecha ? '✓' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {abierta && (
        <Leccion
          key={abierta}
          lecciones={lecciones}
          id={abierta}
          ea={ea}
          clase={clase}
          muestra={muestra}
          cambiar={setAbierta}
          cerrar={() => setAbierta(null)}
          ir={(v) => {
            setAbierta(null);
            ir(v);
          }}
        />
      )}
    </section>
  );
}

/* ---------- La plantilla de cada lección ---------- */

function Leccion({
  lecciones,
  id,
  ea,
  clase,
  muestra,
  cambiar,
  cerrar,
  ir,
}: {
  lecciones: LeccionInicio[];
  id: string;
  ea: ReturnType<typeof useEmpiezaAqui>;
  clase: ProximaClase;
  muestra: boolean;
  cambiar: (id: string) => void;
  cerrar: () => void;
  ir: (v: Vista) => void;
}) {
  const i = lecciones.findIndex((l) => l.id === id);
  const l = lecciones[i];
  const caja = useRef<HTMLDivElement>(null);
  const vistas = lecciones.filter((x) => ea.vista(x.id)).length;
  const hecha = ea.vista(l.id);

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    caja.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener('keydown', tecla);
    };
  }, [cerrar]);

  const tarea = () => {
    const a = l.tarea.accion;
    if (a.tipo === 'leccion') return cambiar(a.id);
    if (a.tipo === 'perfil' || a.tipo === 'ficha') {
      if (muestra) return;
      cerrar();
      return window.dispatchEvent(new Event('divine:onboarding'));
    }
    if (a.tipo === 'vista') return ir(a.vista);
    if (a.tipo === 'celular') return ea.marcar('celular');
    if (a.tipo === 'grupo') {
      ea.marcar('grupo');
      window.open(ENLACE_GRUPO, '_blank', 'noopener');
    }
  };

  const yt = l.video ? idDeYoutube(l.video) : null;

  return createPortal(
    <div className={css.fondo} onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className={css.ventana} role="dialog" aria-modal="true" aria-labelledby="leccion-titulo" ref={caja} tabIndex={-1}>
        <header className={css.ventanaCabeza}>
          <p className={css.rotulo}>
            Empieza aquí · {i + 1} de {lecciones.length}
          </p>
          <button type="button" className={css.cerrar} onClick={cerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <h2 id="leccion-titulo" className={css.leccionTitulo}>
          <span>{l.numero}</span> {l.titulo}
        </h2>

        <div className={css.video}>
          {yt ? (
            <iframe src={urlDeVideo(yt)} title={l.titulo} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : l.video ? (
            <video
              src={l.video}
              poster={l.video.endsWith('.mp4') ? l.video.replace(/\.mp4$/, '.jpg') : undefined}
              controls
              playsInline
              preload="metadata"
              onEnded={() => ea.marcarVista(l.id)}
            />
          ) : (
            <div className={css.hueco}>
              <strong>Tu video llega pronto</strong>
              <span>Sorela lo está grabando. Mientras, aquí tienes lo esencial y tu tarea.</span>
            </div>
          )}
        </div>

        <div className={css.lineas}>
          {l.lineas.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>

        <div className={css.tarea}>
          <p className={css.tareaRotulo}>Tu tarea</p>
          <p className={css.tareaTexto}>{l.tarea.texto}</p>
          {l.tarea.accion.tipo === 'calendario' ? (
            clase ? (
              <AnadirCalendario evento={eventoDeClase(clase)} oscuro alUsar={() => ea.marcar('calendario')} />
            ) : (
              <p className={css.tareaNota}>Aún no hay fecha para la próxima clase. Saldrá en tu Inicio en cuanto Sorela la ponga.</p>
            )
          ) : (
            <button type="button" className={css.tareaBoton} onClick={tarea} disabled={muestra && (l.tarea.accion.tipo === 'perfil' || l.tarea.accion.tipo === 'ficha')}>
              {l.tarea.accion.tipo === 'celular' && ea.marca('celular') ? 'Guardada ✓' : l.tarea.accion.tipo === 'grupo' && ea.marca('grupo') ? 'Ya entraste · Abrir el grupo' : l.tarea.boton}
            </button>
          )}
        </div>

        {l.extra && (
          <div className={css.extra}>
            <p>{l.extra.titulo}</p>
            <pre>{l.extra.texto}</pre>
          </div>
        )}

        <footer className={css.pie}>
          <button type="button" className={css.marcar} onClick={() => ea.marcarVista(l.id)} disabled={hecha} data-hecha={hecha ? '' : undefined}>
            {hecha ? 'Vista ✓' : 'Marcar como vista'}
          </button>
          <div className={css.pieProgreso}>
            <div className={css.barra} aria-hidden="true">
              <span style={{ width: `${Math.round((vistas / lecciones.length) * 100)}%` }} />
            </div>
            <span>
              {vistas} de {lecciones.length}
            </span>
          </div>
          <div className={css.pasar}>
            <button type="button" className={css.linea} onClick={() => cambiar(lecciones[i - 1].id)} disabled={i === 0}>
              ← Anterior
            </button>
            <button type="button" className={css.principal} onClick={() => (i === lecciones.length - 1 ? cerrar() : cambiar(lecciones[i + 1].id))}>
              {i === lecciones.length - 1 ? 'Terminar' : 'Siguiente →'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
