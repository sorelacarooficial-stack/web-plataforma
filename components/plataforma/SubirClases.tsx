'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent as TeclaReact,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { clave, esVideoPropio, minutos, peso, porBloques, type Leccion } from '@/lib/aula';
import type { Acceso } from '@/lib/accesos';
import * as subida from '@/lib/subida-clase';
import { NUEVO, type Borrador, type Estado } from '@/lib/subida-clase';
import { useAviso, useConfirmar } from './Confirmar';
import css from './plataforma.module.css';
import s from './subirclases.module.css';

/**
 * Donde Sorela monta el aula: sube el vídeo de cada clase, le pone título y
 * dice quién puede verla.
 *
 * Antes aquí se pegaba un enlace de YouTube. Lo quitamos porque ella lo pidió
 * («lo único es que me deje subir el vídeo y llenar la info») y porque un
 * vídeo no listado de YouTube lo ve cualquiera que tenga el enlace. Ahora el
 * vídeo se sube a la carpeta privada de la plataforma y solo lo ve quien tiene
 * acceso a esa clase, con un enlace que caduca.
 *
 * Cómo se usa, en el orden en que se hace:
 *   1. Suelta (o elige) el vídeo. La pantalla lo lee al momento: saca la
 *      portada de un fotograma, mira cuánto dura y avisa si es un formato que
 *      muchas alumnas no podrían ver. Si está bien, empieza a subir YA.
 *   2. Mientras sube, rellena el título, de qué va y quién puede verla.
 *   3. «Guardar la clase». Si el vídeo aún no ha terminado, se guarda sola al
 *      terminar: puede pulsar e irse a otra pantalla, la subida sigue.
 *
 * La subida vive en lib/subida-clase.ts y no aquí, para que cambiar de
 * pantalla no la corte. Esta pantalla solo la enseña.
 */

type Respuesta = { lecciones: Leccion[]; cursos: string[] };

/** «menos de un minuto», «4 min», «1 h 12 min». */
function tiempo(segundos: number | null): string {
  if (segundos === null || !Number.isFinite(segundos)) return '';
  if (segundos < 60) return 'menos de un minuto';
  const m = Math.round(segundos / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

function paraDe(b: Borrador): Acceso | null {
  if (b.destino === 'membresia') return { tipo: 'membresia' };
  const nombre = (b.destino === NUEVO ? b.cursoNuevo : b.destino).trim();
  return nombre ? { tipo: 'curso', nombre } : null;
}

/** El estado de la subida, compartido con lib/subida-clase.ts. */
function useSubida(): Estado {
  return useSyncExternalStore(subida.suscribir, subida.foto, subida.fotoServidor);
}

export default function SubirClases() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [avisar, aviso] = useAviso();
  const [confirmar, dialogo] = useConfirmar();
  const [viendo, setViendo] = useState<Leccion | null>(null);
  const est = useSubida();

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
        setDatos((d) => d ?? { lecciones: [], cursos: [] });
        return;
      }
      setDatos({ lecciones: c.lecciones ?? [], cursos: c.cursos ?? [] });
    } catch {
      setFallo('No hay conexión con el servidor.');
      setDatos((d) => d ?? { lecciones: [], cursos: [] });
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Cuando una clase se acaba de guardar (aunque fuera estando en otra
     pantalla), la lista se pone al día. */
  const guardadaId = est.guardada?.id;
  useEffect(() => {
    if (guardadaId) cargar();
  }, [guardadaId, cargar]);

  async function cambiar(l: Leccion, cambios: Partial<Leccion>): Promise<boolean> {
    const antes = datos;
    setDatos((d) => (d ? { ...d, lecciones: d.lecciones.map((x) => (x.id === l.id ? { ...x, ...cambios } : x)) } : d));
    try {
      const r = await fetch('/api/lecciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: l.id, ...cambios }),
      });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      return true;
    } catch {
      setDatos(antes);
      avisar('No se ha podido guardar el cambio. Vuelve a intentarlo.');
      return false;
    }
  }

  async function borrar(l: Leccion) {
    const propio = esVideoPropio(l.video);
    const si = await confirmar({
      titulo: `¿Borrar «${l.titulo}»?`,
      texto: propio
        ? `Se borran la clase, su vídeo${l.tamano ? ` (${peso(l.tamano)})` : ''} y su portada, y lo que tus alumnas llevaban visto de ella. No se puede deshacer: para tenerla otra vez habría que volver a subir el vídeo.`
        : 'Se quita del aula, con lo que tus alumnas llevaban visto de ella. El vídeo sigue en tu canal de YouTube: si quieres que desaparezca, bórralo también allí.',
      boton: propio ? 'Borrar la clase' : 'Quitar del aula',
    });
    if (!si) return;

    const antes = datos;
    setDatos((d) => (d ? { ...d, lecciones: d.lecciones.filter((x) => x.id !== l.id) } : d));
    try {
      const r = await fetch(`/api/lecciones?id=${encodeURIComponent(l.id)}`, { method: 'DELETE' });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      avisar(`«${l.titulo}» ya no está en el aula.`, 'hecho');
    } catch {
      setDatos(antes);
      avisar('No se ha podido borrar. Vuelve a intentarlo.');
    }
  }

  if (!datos) {
    return (
      <div className={css.columna} aria-busy="true">
        <div className={s.esqueleto} style={{ height: 300 }} />
        <div className={s.esqueleto} style={{ height: 180 }} />
      </div>
    );
  }

  const bloques = porBloques(datos.lecciones);

  return (
    <div className={css.columna}>
      <p className={css.intro}>
        Sube aquí cada clase: el vídeo, su título y quién puede verla. El vídeo queda cerrado en la
        plataforma y solo lo ve quien tenga acceso. Puedes dejarlas en borrador hasta que el curso
        esté entero.
      </p>

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={s.botonSecundario} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}

      <NuevaClase est={est} datos={datos} />

      {/* ---------- Lo que ya hay ---------- */}
      {bloques.length === 0 ? (
        <section className={s.vacio}>
          <span className={s.vacioIcono} aria-hidden="true">
            <IconoPelicula />
          </span>
          <h2 className={s.vacioTitulo}>Aún no hay ninguna clase</h2>
          <p className={s.vacioTexto}>Sube la primera arriba. Aparecerá aquí, con su portada, para publicarla cuando quieras.</p>
        </section>
      ) : (
        bloques.map((b) => (
          <section key={b.nombre} className={s.bloque} aria-label={b.nombre}>
            <header className={s.bloqueCabeza}>
              <h2 className={s.bloqueTitulo}>{b.nombre}</h2>
              <span className={s.bloqueCuenta}>
                {b.lecciones.length === 1 ? '1 clase' : `${b.lecciones.length} clases`}
                {b.lecciones.some((l) => !l.publicada) && ` · ${b.lecciones.filter((l) => !l.publicada).length} en borrador`}
              </span>
            </header>
            <ul className={s.lista}>
              {b.lecciones.map((l) => (
                <FilaClase
                  key={l.id}
                  l={l}
                  datos={datos}
                  cambiar={cambiar}
                  borrar={() => borrar(l)}
                  ver={() => setViendo(l)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {viendo && <VerClase l={viendo} cerrar={() => setViendo(null)} />}
      {aviso}
      {dialogo}
    </div>
  );
}

/* ==========================================================================
   Subir una clase nueva
   ========================================================================== */

function NuevaClase({ est, datos }: { est: Estado; datos: Respuesta }) {
  const id = useId();
  const [locales, setLocales] = useState<Record<string, string>>({});
  const titulo = useRef<HTMLInputElement>(null);
  const b = est.borrador;
  const errores = { ...locales, ...est.errores };
  const bloqueado = est.guardarAlTerminar || est.fase === 'guardando';

  /* Los apartados que ya tiene el curso elegido, para ofrecerlos al escribir:
     si se escriben distinto, el aula los enseña como dos apartados. */
  const apartados = useMemo(() => {
    const para = paraDe(b);
    if (!para || para.tipo !== 'curso') return [];
    const k = clave(para.nombre);
    const vistos = new Set<string>();
    for (const l of datos.lecciones) if (l.para.tipo === 'curso' && clave(l.para.nombre) === k && l.modulo) vistos.add(l.modulo);
    return [...vistos];
  }, [b, datos.lecciones]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const malos: Record<string, string> = {};
    if (!est.archivo) malos.video = 'Primero elige el vídeo de la clase.';
    if (b.titulo.trim().length < 2) malos.titulo = 'Ponle un título a la clase.';
    const para = paraDe(b);
    if (!para) malos.para = 'Escribe el nombre de la formación.';
    setLocales(malos);
    if (Object.keys(malos).length || !para) {
      if (malos.titulo) titulo.current?.focus();
      return;
    }
    subida.guardar({
      titulo: b.titulo.trim(),
      descripcion: b.descripcion.trim(),
      para,
      modulo: para.tipo === 'curso' ? b.modulo.trim() : '',
      publicada: b.publicar,
    });
  }

  const editar = (c: Partial<Borrador>) => {
    setLocales({});
    subida.editar(c);
  };

  return (
    <section className={s.nueva} aria-labelledby={`${id}-titulo`}>
      <header className={s.cabeza}>
        <h2 id={`${id}-titulo`} className={s.titulo}>
          Nueva clase
        </h2>
        <p className={s.ayuda}>Elige el vídeo y se pone a subir solo. Mientras sube, rellena el resto.</p>
      </header>

      {/* La última que se ha guardado: se dice aquí arriba, y debajo ya se
          puede soltar la siguiente sin pulsar nada más. */}
      <AnimatePresence initial={false}>
        {est.guardada && est.fase === 'libre' && (
          <motion.div
            key={est.guardada.id}
            className={s.hecho}
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={s.hechoIcono} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className={s.hechoTexto}>
              <span className={s.hechoTitulo}>«{est.guardada.titulo}» ya está en el aula</span>
              <span className={s.ayuda}>
                {est.guardada.publicada
                  ? 'Está publicada: la ve ya quien tenga acceso.'
                  : 'Está en borrador: solo la ves tú. Publícala desde la lista cuando esté lista.'}
              </span>
            </span>
            <button type="button" className={s.botonTexto} onClick={subida.otra}>
              Vale
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={s.nuevaCuerpo}>
        <div className={s.columnaVideo}>
          {est.pendiente && est.fase === 'libre' && (
            <div className={s.pendiente} role="status">
              <p>
                <strong>Se quedó a medias la subida de «{est.pendiente.nombre}».</strong> Vuelve a elegir ese
                mismo archivo y seguirá donde se quedó, sin empezar de cero.
              </p>
              <button type="button" className={s.botonSecundario} onClick={() => subida.descartarPendiente()}>
                Olvidarla
              </button>
            </div>
          )}
          {est.fase === 'libre' ? <ZonaSoltar error={est.error ?? errores.video} /> : <TarjetaVideo est={est} />}
        </div>

        <form className={s.campos} onSubmit={enviar} noValidate>
          <label className={s.campo}>
            <span className={s.rotulo}>Título de la clase</span>
            <input
              ref={titulo}
              value={b.titulo}
              onChange={(e) => editar({ titulo: e.target.value })}
              placeholder="Lipodrenaje: protocolo completo"
              className={s.caja}
              maxLength={140}
              disabled={bloqueado}
              aria-invalid={errores.titulo ? true : undefined}
              aria-describedby={errores.titulo ? `${id}-e-titulo` : undefined}
            />
            {errores.titulo && (
              <span id={`${id}-e-titulo`} className={s.error} role="alert">
                {errores.titulo}
              </span>
            )}
          </label>

          <label className={s.campo}>
            <span className={s.rotulo}>
              De qué va <span className={s.opcional}>opcional</span>
            </span>
            <textarea
              rows={3}
              value={b.descripcion}
              onChange={(e) => editar({ descripcion: e.target.value })}
              placeholder="Lo que se ve en esta clase, en una o dos frases."
              className={s.caja}
              maxLength={600}
              disabled={bloqueado}
            />
          </label>

          <Destinos b={b} cursos={datos.cursos} editar={editar} deshabilitado={bloqueado} error={errores.para} />

          {paraDe(b)?.tipo === 'curso' && (
            <label className={s.campo}>
              <span className={s.rotulo}>
                Apartado del curso <span className={s.opcional}>opcional</span>
              </span>
              <input
                value={b.modulo}
                onChange={(e) => editar({ modulo: e.target.value })}
                placeholder={apartados[0] ?? 'Día 1 · Desbloqueo'}
                className={s.caja}
                maxLength={80}
                list={apartados.length ? `${id}-apartados` : undefined}
                disabled={bloqueado}
              />
              {apartados.length > 0 && (
                <datalist id={`${id}-apartados`}>
                  {apartados.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              )}
              <span className={s.ayuda}>
                En el aula, las clases se agrupan por apartado. Si lo dejas vacío, va con el resto del curso.
              </span>
            </label>
          )}

          <div className={s.interruptorFila}>
            <span className={s.interruptorTexto}>
              <span className={s.interruptorTitulo} id={`${id}-publicar`}>
                Publicarla ya
              </span>
              <span className={s.ayuda} id={`${id}-publicar-ayuda`}>
                Si no, queda en borrador y solo la ves tú.
              </span>
            </span>
            <Interruptor
              encendido={b.publicar}
              alCambiar={(v) => editar({ publicar: v })}
              etiquetaId={`${id}-publicar`}
              descritoId={`${id}-publicar-ayuda`}
              deshabilitado={bloqueado}
            />
          </div>

          <div className={s.pie}>
            {est.guardarAlTerminar ? (
              <>
                <p className={s.esperando} role="status">
                  <span className={s.punto} aria-hidden="true" />
                  Se guardará sola en cuanto termine de subir. Puedes irte a otra pantalla.
                </p>
                <button type="button" className={s.botonSecundario} onClick={subida.noGuardarAun}>
                  Cambiar algo
                </button>
              </>
            ) : (
              <button type="submit" className={s.botonPrimario} disabled={est.fase === 'guardando' || est.fase === 'error'}>
                {est.fase === 'guardando' ? 'Guardando…' : 'Guardar la clase'}
              </button>
            )}
            {!est.archivo && !est.guardarAlTerminar && <span className={s.ayuda}>Primero elige el vídeo.</span>}
          </div>
        </form>
      </div>
    </section>
  );
}

/* La zona grande para soltar el vídeo. Toda ella es pulsable; el botón de
   dentro es el que llega con el teclado. */
function ZonaSoltar({ error }: { error?: string | null }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const reducir = useReducedMotion();

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setEncima(false);
    const f = e.dataTransfer.files?.[0];
    if (f) subida.elegir(f);
  };

  return (
    <div>
      <motion.div
        className={s.zona}
        data-encima={encima || undefined}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
        animate={reducir ? undefined : { scale: encima ? 1.01 : 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      >
        <span className={s.zonaIcono} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" />
            <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
          </svg>
        </span>
        <p className={s.zonaTitulo}>
          {encima ? (
            'Suéltalo aquí'
          ) : (
            <>
              {/* En el móvil no se arrastra nada: allí se elige. */}
              <span className={s.conRaton}>Arrastra aquí el vídeo de la clase</span>
              <span className={s.tactil}>El vídeo de la clase</span>
            </>
          )}
        </p>
        <button
          type="button"
          className={s.botonPrimario}
          onClick={(e) => {
            e.stopPropagation();
            entrada.current?.click();
          }}
        >
          Elegir el vídeo
        </button>
        <p className={s.zonaNota}>MP4, MOV o WebM · hasta 4 GB</p>
        <input
          ref={entrada}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm"
          className={s.oculto}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) subida.elegir(f);
          }}
        />
      </motion.div>
      {error && (
        <p className={s.error} role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* El vídeo elegido: su portada, cómo va la subida y qué se puede hacer. */
function TarjetaVideo({ est }: { est: Estado }) {
  const reducir = useReducedMotion();
  const a = est.analisis;
  const pct = est.total ? Math.min(100, Math.floor((est.enviados / est.total) * 100)) : 0;
  const subiendo = est.fase === 'subiendo' || est.fase === 'reintentando' || est.fase === 'sin-red' || est.fase === 'preparando';
  const arriba = est.fase === 'subida' || est.fase === 'guardando';

  let linea: ReactNode = null;
  if (est.fase === 'analizando') linea = 'Leyendo el vídeo para sacar la portada…';
  else if (est.fase === 'preparando') linea = 'Preparando la subida…';
  else if (est.fase === 'subiendo')
    linea = (
      <>
        {peso(est.enviados)} de {peso(est.total)}
        {est.velocidad > 0 && ` · ${peso(est.velocidad)}/s`}
        {est.restante !== null && est.velocidad > 0 && ` · quedan ${tiempo(est.restante)}`}
      </>
    );
  else if (est.fase === 'reintentando') linea = `Se ha cortado la conexión. Vuelvo a intentarlo${est.reintentoEn ? ` en ${est.reintentoEn} s` : ''}…`;
  else if (est.fase === 'sin-red') linea = 'Sin conexión. Seguirá sola en cuanto vuelva.';
  else if (est.fase === 'subida')
    linea =
      est.errores.video || est.error ? (
        <span className={s.error} role="alert">
          {est.errores.video || est.error}
        </span>
      ) : (
        'Vídeo subido entero. Falta guardar la clase.'
      );
  else if (est.fase === 'guardando') linea = 'Guardando la clase…';

  return (
    <div className={s.video} data-fase={est.fase}>
      <div className={s.portada}>
        {a?.portadaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.portadaUrl} alt="Portada de la clase" />
        ) : (
          <span className={s.portadaVacia} aria-hidden="true">
            {est.fase === 'analizando' ? <span className={s.girando} /> : <IconoPelicula />}
          </span>
        )}
        {a?.duracion ? <span className={s.duracion}>{minutos(a.duracion)}</span> : null}
      </div>

      <div className={s.videoTexto}>
        <p className={s.archivo} title={est.archivo?.nombre}>
          {est.archivo?.nombre}
        </p>
        <p className={s.archivoMeta}>
          {est.archivo ? peso(est.archivo.tamano) : ''}
          {a?.ancho ? ` · ${a.ancho}×${a.alto}` : ''}
        </p>

        {est.fase === 'aviso' && a?.problema ? (
          <div className={s.problema} data-tipo={a.problema.tipo} role="alert">
            <p className={s.problemaTitulo}>{a.problema.titulo}</p>
            <p className={s.problemaTexto}>{a.problema.texto}</p>
            <div className={s.botones}>
              {a.problema.tipo === 'poco-compatible' && (
                <button type="button" className={s.botonSecundario} onClick={() => subida.subir()}>
                  Subirlo igualmente
                </button>
              )}
              <button type="button" className={s.botonSecundario} onClick={() => subida.cancelar()}>
                Elegir otro vídeo
              </button>
            </div>
          </div>
        ) : est.fase === 'error' ? (
          <div className={s.problema} data-tipo="ilegible" role="alert">
            <p className={s.problemaTexto}>{est.error}</p>
            <div className={s.botones}>
              {est.archivo && (
                <button type="button" className={s.botonSecundario} onClick={() => subida.seguir()}>
                  Seguir subiendo
                </button>
              )}
              <button type="button" className={s.botonTexto} onClick={() => subida.cancelar()}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={s.progreso}>
              <div
                className={s.barra}
                role="progressbar"
                aria-label="Subida del vídeo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={arriba ? 100 : pct}
                aria-valuetext={arriba ? 'Subido' : `${pct} %`}
              >
                <motion.span
                  className={s.barraValor}
                  data-listo={arriba || undefined}
                  style={{ originX: 0 }}
                  initial={false}
                  animate={{ scaleX: arriba ? 1 : est.fase === 'analizando' ? 0 : Math.max(0.01, pct / 100) }}
                  transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 24 }}
                />
              </div>
              <span className={s.pct} aria-hidden="true">
                {arriba ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : subiendo ? (
                  `${pct}%`
                ) : null}
              </span>
            </div>
            <p className={s.linea} aria-live="polite">
              {linea}
            </p>
            <div className={s.botones}>
              {a?.portadaUrl && est.fase !== 'guardando' && (
                <button type="button" className={s.botonTexto} onClick={() => subida.otraPortada()}>
                  Otra portada
                </button>
              )}
              {est.fase !== 'guardando' && (
                <button type="button" className={s.botonTexto} onClick={() => subida.cancelar()}>
                  {arriba ? 'Quitar el vídeo' : 'Cancelar'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* A quién va la clase: botones segmentados que saltan de línea en el móvil. */
function Destinos({
  b,
  cursos,
  editar,
  deshabilitado,
  error,
}: {
  b: Borrador;
  cursos: string[];
  editar: (c: Partial<Borrador>) => void;
  deshabilitado: boolean;
  error?: string;
}) {
  const id = useId();
  const opciones = [
    { valor: 'membresia', texto: 'Comunidad Divine' },
    ...cursos.map((c) => ({ valor: c, texto: c })),
    { valor: NUEVO, texto: 'Otra formación…' },
  ];
  // Si lo elegido ya no está en la lista (un curso que se dejó de usar), cuenta como «otra».
  const actual = opciones.some((o) => o.valor === b.destino) ? b.destino : NUEVO;

  /* Como un grupo de opciones de verdad: con las flechas se cambia de una a
     otra, y el tabulador entra y sale del grupo de una vez. */
  const grupo = useRef<HTMLDivElement>(null);
  function flechas(e: TeclaReact<HTMLDivElement>) {
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!paso || deshabilitado) return;
    e.preventDefault();
    const i = opciones.findIndex((o) => o.valor === actual);
    const siguiente = opciones[(i + paso + opciones.length) % opciones.length];
    editar({ destino: siguiente.valor });
    requestAnimationFrame(() => grupo.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  }

  return (
    <div className={s.campo}>
      <span className={s.rotulo} id={`${id}-r`}>
        Quién puede verla
      </span>
      <div ref={grupo} className={s.chips} role="radiogroup" aria-labelledby={`${id}-r`} onKeyDown={flechas}>
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={actual === o.valor}
            tabIndex={actual === o.valor ? 0 : -1}
            className={s.chip}
            disabled={deshabilitado}
            onClick={() => editar({ destino: o.valor })}
          >
            {actual === o.valor && (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
            {o.texto}
          </button>
        ))}
      </div>
      {actual === NUEVO && (
        <input
          value={b.cursoNuevo}
          onChange={(e) => editar({ cursoNuevo: e.target.value })}
          placeholder="Nombre de la formación, igual que en la ficha de tus alumnas"
          className={s.caja}
          aria-label="Nombre de la formación"
          maxLength={120}
          disabled={deshabilitado}
        />
      )}
      {error ? (
        <span className={s.error} role="alert">
          {error}
        </span>
      ) : (
        <span className={s.ayuda}>Solo la ve quien tenga eso contratado.</span>
      )}
    </div>
  );
}

function Interruptor({
  encendido,
  alCambiar,
  etiquetaId,
  descritoId,
  deshabilitado,
}: {
  encendido: boolean;
  alCambiar: (v: boolean) => void;
  etiquetaId: string;
  descritoId?: string;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-labelledby={etiquetaId}
      aria-describedby={descritoId}
      className={s.interruptor}
      data-encendido={encendido || undefined}
      disabled={deshabilitado}
      onClick={() => alCambiar(!encendido)}
    >
      <span className={s.interruptorBola} />
    </button>
  );
}

/* ==========================================================================
   La lista de clases
   ========================================================================== */

function FilaClase({
  l,
  datos,
  cambiar,
  borrar,
  ver,
}: {
  l: Leccion;
  datos: Respuesta;
  cambiar: (l: Leccion, c: Partial<Leccion>) => Promise<boolean>;
  borrar: () => void;
  ver: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const propio = esVideoPropio(l.video);
  const miniatura = l.portada ?? (!propio ? `https://i.ytimg.com/vi/${l.video}/mqdefault.jpg` : null);

  return (
    <li className={s.fila}>
      <div className={s.filaCuerpo}>
        <button type="button" className={s.mini} onClick={ver} aria-label={`Ver «${l.titulo}»`}>
          {miniatura ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={miniatura} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
          ) : (
            <span className={s.miniVacia} aria-hidden="true">
              <IconoPelicula />
            </span>
          )}
          <span className={s.miniPlay} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
          {l.duracion ? <span className={s.miniDuracion}>{minutos(l.duracion)}</span> : null}
        </button>

        <div className={s.filaTexto}>
          <p className={s.filaTitulo}>{l.titulo}</p>
          <p className={s.filaMeta}>
            {l.modulo && <span>{l.modulo}</span>}
            <span>{propio ? 'Vídeo propio' : 'YouTube'}</span>
            {propio && l.tamano ? <span>{peso(l.tamano)}</span> : null}
          </p>
          {l.descripcion && <p className={s.filaDescripcion}>{l.descripcion}</p>}
        </div>

        <div className={s.filaAcciones}>
          <span className={s.estado} data-visible={l.publicada || undefined}>
            {l.publicada ? 'Visible' : 'Borrador'}
          </span>
          <button
            type="button"
            className={s.botonSecundario}
            onClick={() => cambiar(l, { publicada: !l.publicada })}
            title={l.publicada ? 'Pasarla a borrador: deja de verse en el aula' : 'Que la vea quien tenga acceso'}
          >
            {l.publicada ? 'Esconder' : 'Publicar'}
          </button>
          <button type="button" className={s.botonTexto} onClick={() => setEditando((v) => !v)} aria-expanded={editando}>
            Editar
          </button>
          {!propio && (
            <a className={s.botonTexto} href={`https://www.youtube.com/watch?v=${l.video}`} target="_blank" rel="noopener noreferrer">
              YouTube
            </a>
          )}
          <button type="button" className={s.papelera} onClick={borrar} aria-label={`Borrar «${l.titulo}»`} title="Borrar la clase">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {editando && <Editar l={l} datos={datos} cambiar={cambiar} cerrar={() => setEditando(false)} />}
      </AnimatePresence>
    </li>
  );
}

/* Cambiar el título, el texto y a quién va. El vídeo no se cambia: una clase
   es su vídeo; para otro, se sube otra clase. */
function Editar({
  l,
  datos,
  cambiar,
  cerrar,
}: {
  l: Leccion;
  datos: Respuesta;
  cambiar: (l: Leccion, c: Partial<Leccion>) => Promise<boolean>;
  cerrar: () => void;
}) {
  const reducir = useReducedMotion();
  const [b, setB] = useState<Borrador>(() => ({
    titulo: l.titulo,
    descripcion: l.descripcion,
    destino: l.para.tipo === 'membresia' ? 'membresia' : datos.cursos.find((c) => clave(c) === clave(l.para.nombre)) ?? NUEVO,
    cursoNuevo: l.para.tipo === 'curso' ? l.para.nombre ?? '' : '',
    modulo: l.modulo ?? '',
    publicar: l.publicada,
  }));
  const [error, setError] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const para = paraDe(b);
    const malos: Record<string, string> = {};
    if (b.titulo.trim().length < 2) malos.titulo = 'Ponle un título a la clase.';
    if (!para) malos.para = 'Escribe el nombre de la formación.';
    setError(malos);
    if (Object.keys(malos).length || !para) return;
    setGuardando(true);
    const bien = await cambiar(l, {
      titulo: b.titulo.trim(),
      descripcion: b.descripcion.trim(),
      para,
      // El apartado solo existe dentro de un curso; en la comunidad no se toca.
      ...(para.tipo === 'curso' ? { modulo: b.modulo.trim() } : {}),
    });
    setGuardando(false);
    if (bien) cerrar();
  }

  return (
    <motion.form
      className={s.editar}
      onSubmit={guardar}
      initial={reducir ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reducir ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
      exit={reducir ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
      noValidate
    >
      <div className={s.editarDentro}>
        <label className={s.campo}>
          <span className={s.rotulo}>Título</span>
          <input className={s.caja} value={b.titulo} maxLength={140} onChange={(e) => setB({ ...b, titulo: e.target.value })} />
          {error.titulo && (
            <span className={s.error} role="alert">
              {error.titulo}
            </span>
          )}
        </label>
        <label className={s.campo}>
          <span className={s.rotulo}>De qué va</span>
          <textarea className={s.caja} rows={3} value={b.descripcion} maxLength={600} onChange={(e) => setB({ ...b, descripcion: e.target.value })} />
        </label>
        <Destinos b={b} cursos={datos.cursos} editar={(c) => setB({ ...b, ...c })} deshabilitado={guardando} error={error.para} />
        {paraDe(b)?.tipo === 'curso' && (
          <label className={s.campo}>
            <span className={s.rotulo}>
              Apartado del curso <span className={s.opcional}>opcional</span>
            </span>
            <input className={s.caja} value={b.modulo} maxLength={80} onChange={(e) => setB({ ...b, modulo: e.target.value })} />
          </label>
        )}
        <div className={s.botones}>
          <button type="submit" className={s.botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button type="button" className={s.botonTexto} onClick={cerrar}>
            Cancelar
          </button>
        </div>
      </div>
    </motion.form>
  );
}

/* Ver una clase antes de publicarla, con el mismo enlace que caduca que usan
   las alumnas. Las de YouTube se ven en YouTube. */
function VerClase({ l, cerrar }: { l: Leccion; cerrar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const cerrarBoton = useRef<HTMLButtonElement>(null);
  const reducir = useReducedMotion();
  const propio = esVideoPropio(l.video);
  /* En una referencia: la pantalla de detrás se repinta con el progreso de la
     subida, y con la función nueva el efecto movería el foco cada vez. */
  const alCerrar = useRef(cerrar);
  alCerrar.current = cerrar;

  useEffect(() => {
    if (!propio) return;
    let vivo = true;
    fetch(`/api/lecciones/video?id=${encodeURIComponent(l.id)}`)
      .then((r) => r.json())
      .then((j) => vivo && (j.ok ? setUrl(j.url) : setFallo(true)))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [l.id, propio]);

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cerrarBoton.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar.current();
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      previo?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <motion.div
      className={s.velo}
      onMouseDown={(e) => e.target === e.currentTarget && cerrar()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducir ? 0 : 0.18 }}
    >
      <motion.div
        className={s.visor}
        role="dialog"
        aria-modal="true"
        aria-label={l.titulo}
        initial={reducir ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }}
      >
        <div className={s.visorCabeza}>
          <p className={s.visorTitulo}>{l.titulo}</p>
          <button ref={cerrarBoton} type="button" className={s.cerrar} onClick={cerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={s.visorPantalla}>
          {!propio ? (
            <a className={s.botonPrimario} href={`https://www.youtube.com/watch?v=${l.video}`} target="_blank" rel="noopener noreferrer">
              Abrir en YouTube
            </a>
          ) : url ? (
            <video src={url} poster={l.portada} controls playsInline preload="metadata" controlsList="nodownload" disablePictureInPicture />
          ) : (
            <p className={s.visorNota}>{fallo ? 'No he podido abrir el vídeo. Prueba en un momento.' : 'Abriendo el vídeo…'}</p>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function IconoPelicula() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10.5 9.3v5.4l4.6-2.7z" />
    </svg>
  );
}
