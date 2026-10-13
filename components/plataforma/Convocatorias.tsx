'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAviso, useConfirmar } from './Confirmar';
import {
  CURSOS_CONVOCATORIA,
  ESTADOS_PAGO,
  ETIQUETA_PAGO,
  ETIQUETA_PLAZAS,
  MONEDAS,
  NOMBRE_MONEDA,
  PLAZAS_MAXIMAS,
  aCentimos,
  cursoDe,
  diasDeLaSemana,
  diasHasta,
  estadoPlazas,
  estadoSugerido,
  formatearImporte,
  hojaCalendario,
  hoyISO,
  importeAEscribir,
  rangoFechas,
  resumenDe,
  type Convocatoria,
  type EstadoPago,
  type IdCurso,
  type Inscrita,
  type Moneda,
} from '@/lib/convocatorias-tipos';
import s from './convocatorias.module.css';

/**
 * Contenido › Formaciones: las convocatorias de verdad.
 *
 * Antes esta pantalla decía «todavía no guarda nada» y Sorela no sabía qué
 * era. Ahora es lo que su cabecera dice en una línea: cada fecha que abre de
 * una formación, con sus plazas, quién se ha apuntado y quién le ha pagado.
 *
 * Tres cosas se ven sin tocar nada, porque son las que se preguntan antes:
 * cuántas plazas quedan (con una barra que separa pagadas, con señal y
 * pendientes), cuánto ha cobrado y cuánto le falta, y QUIÉN le falta por
 * pagar, con nombre y cantidad.
 *
 * El interruptor «En la web» saca la fecha en /formaciones con el curso, los
 * días, la ciudad y si quedan plazas. Nunca el precio, el lugar ni los
 * nombres: eso lo decide el servidor (lib/convocatorias.ts lee solo esos
 * campos), no esta pantalla.
 *
 * Las inscritas se pueden escribir a mano o elegir de Clientes; elegir solo
 * copia sus datos, el contacto no se toca.
 */

type Estado = 'cargando' | 'listo' | 'error' | 'sin-configurar';

type Respuesta = { ok: boolean; status: number; datos: Record<string, unknown> };

async function pedir(url: string, init?: RequestInit): Promise<Respuesta> {
  try {
    const r = await fetch(url, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      cache: 'no-store',
    });
    const datos = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: r.ok && datos.ok === true, status: r.status, datos };
  } catch {
    return { ok: false, status: 0, datos: { motivo: 'red' } };
  }
}

/** Qué decir cuando algo no sale, con palabras y sin códigos. */
function explicar(r: Respuesta, que = 'guardar'): string {
  switch (r.datos.motivo) {
    case 'sin-sesion':
      return 'Tu sesión ha caducado. Vuelve a entrar y prueba otra vez.';
    case 'sin-permiso':
      return 'Esto solo lo puede hacer Sorela.';
    case 'no-existe':
      return 'Ya no existe: puede que se haya borrado en otra pestaña. He recargado la lista.';
    case 'red':
      return 'No hay conexión. Comprueba internet y prueba otra vez.';
    case 'sin-configurar':
      return 'La base de datos no está conectada en este entorno.';
    default:
      return `No se ha podido ${que}. Prueba otra vez en un momento.`;
  }
}

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '·';

/** Para buscar sin que importen tildes ni mayúsculas: «Rocío» y «rocio» son la misma. */
const plano = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function sumarDia(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

/** «Faltan 32 días», «Mañana», «En curso»… */
function cuandoEs(c: Convocatoria, hoy: string): string {
  const hasta = diasHasta(c.inicio, hoy);
  if (hasta > 1) return `Faltan ${hasta} días`;
  if (hasta === 1) return 'Empieza mañana';
  if (hasta === 0) return 'Empieza hoy';
  return c.fin >= hoy ? 'En curso' : 'Ya terminó';
}

/* ==========================================================================
   Iconos (trazo fino, los mismos 24 × 24 de la plataforma)
   ========================================================================== */
function Icono({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const I = {
  mas: 'M12 5v14M5 12h14',
  lapiz: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4',
  papelera: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  cerrar: 'M6 6l12 12M18 6L6 18',
  lupa: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  calendario: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM4 10h16M8 3v4M16 3v4',
  fuera: 'M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
  flecha: 'M9 6l6 6-6 6',
  persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0',
  enlace: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  hecho: 'M5 12.5l4.5 4.5L19 7.5',
};

/** El icono de cada estado de pago: no solo el color dice cuál es. */
function IconoPago({ estado }: { estado: EstadoPago }) {
  if (estado === 'pagado') return <Icono d={I.hecho} size={13} />;
  if (estado === 'senal')
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
      </svg>
    );
  return <Icono d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" size={13} />;
}

function PildoraPago({ estado }: { estado: EstadoPago }) {
  return (
    <span className={s.pildora} data-estado={estado}>
      <IconoPago estado={estado} />
      {ETIQUETA_PAGO[estado]}
    </span>
  );
}

/* ==========================================================================
   Controles: segmentado e interruptor
   ========================================================================== */

/**
 * Control segmentado, como los de iOS. Se mueve con las flechas (es un grupo
 * de opciones, `radiogroup`) y la pastilla blanca se desliza con muelle.
 */
function Segmentado<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
  nombre,
}: {
  opciones: { id: T; texto: ReactNode }[];
  valor: T;
  alCambiar: (v: T) => void;
  etiqueta: string;
  nombre: string;
}) {
  const reducir = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tecla = (e: TeclaReact<HTMLDivElement>) => {
    const i = opciones.findIndex((o) => o.id === valor);
    let j = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % opciones.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + opciones.length) % opciones.length;
    else return;
    e.preventDefault();
    alCambiar(opciones[j].id);
    refs.current[j]?.focus();
  };
  return (
    <div className={s.segmentado} role="radiogroup" aria-label={etiqueta} onKeyDown={tecla}>
      {opciones.map((o, i) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            className={s.segmento}
            data-activo={activo || undefined}
            onClick={() => alCambiar(o.id)}
          >
            {activo && (
              <motion.span
                layoutId={`segmento-${nombre}`}
                className={s.segmentoFondo}
                transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className={s.segmentoTexto}>{o.texto}</span>
          </button>
        );
      })}
    </div>
  );
}

function Interruptor({
  encendido,
  alCambiar,
  etiqueta,
  deshabilitado,
  descrito,
}: {
  encendido: boolean;
  alCambiar: (v: boolean) => void;
  etiqueta: string;
  deshabilitado?: boolean;
  descrito?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      aria-describedby={descrito}
      disabled={deshabilitado}
      className={s.interruptor}
      data-encendido={encendido || undefined}
      onClick={() => alCambiar(!encendido)}
    >
      <span className={s.interruptorBola} />
    </button>
  );
}

/* ==========================================================================
   Hoja (el formulario que sube desde abajo en el móvil y flota en escritorio)
   ========================================================================== */
function Hoja({
  titulo,
  subtitulo,
  alCerrar,
  children,
  pie,
}: {
  titulo: string;
  subtitulo?: string;
  alCerrar: () => void;
  children: ReactNode;
  pie: ReactNode;
}) {
  const reducir = useReducedMotion();
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const primero = caja.current?.querySelector<HTMLElement>('[data-enfocar]') ?? caja.current?.querySelector<HTMLElement>('input, select, textarea, button');
    primero?.focus({ preventScroll: true });
    const fondo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const tecla = (e: KeyboardEvent) => {
      // Si hay una pregunta de borrar abierta encima, es ella la que manda.
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrarRef.current();
        return;
      }
      if (e.key !== 'Tab' || !caja.current) return;
      const focos = [...caja.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')].filter(
        (el) => el.offsetParent !== null && el.tabIndex !== -1
      );
      if (!focos.length) return;
      const a = focos[0];
      const z = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      } else if (!caja.current.contains(document.activeElement)) {
        e.preventDefault();
        a.focus();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = fondo;
      if (previo?.isConnected) previo.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <motion.div
      className={s.velo}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducir ? 0 : 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <motion.div
        ref={caja}
        className={s.hoja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        initial={reducir ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducir ? { opacity: 0 } : { opacity: 0, y: 30 }}
        transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
      >
        <header className={s.hojaCabeza}>
          <span className={s.asa} aria-hidden="true" />
          <div className={s.hojaTitulos}>
            <h2 id={`${id}-t`} className={s.hojaTitulo}>
              {titulo}
            </h2>
            {subtitulo && <p className={s.hojaSubtitulo}>{subtitulo}</p>}
          </div>
          <button type="button" className={s.botonIcono} onClick={alCerrar} aria-label="Cerrar sin guardar">
            <Icono d={I.cerrar} size={17} />
          </button>
        </header>
        <div className={s.hojaCuerpo}>{children}</div>
        <footer className={s.hojaPie}>{pie}</footer>
      </motion.div>
    </motion.div>,
    document.body
  );
}

/** Un campo con su rótulo, su ayuda y su error, enlazados para el lector de pantalla. */
function Campo({
  etiqueta,
  opcional,
  ayuda,
  error,
  children,
  ancho,
}: {
  etiqueta: string;
  opcional?: boolean;
  ayuda?: ReactNode;
  error?: string;
  ancho?: 'entero';
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const describe = [ayuda ? `${id}-a` : '', error ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={s.campo} data-ancho={ancho}>
      <label htmlFor={id} className={s.rotuloCampo}>
        {etiqueta}
        {opcional && <small> (opcional)</small>}
      </label>
      {children({ id, ...(error ? { 'aria-invalid': true as const } : {}), ...(describe ? { 'aria-describedby': describe } : {}) })}
      {ayuda && (
        <span id={`${id}-a`} className={s.ayuda}>
          {ayuda}
        </span>
      )}
      {error && (
        <em id={`${id}-e`} className={s.error}>
          {error}
        </em>
      )}
    </div>
  );
}

/* ==========================================================================
   Formulario de la convocatoria
   ========================================================================== */
type BorradorConvocatoria = {
  id?: string;
  curso: IdCurso;
  inicio: string;
  fin: string;
  ciudad: string;
  lugar: string;
  plazas: string;
  precio: string;
  moneda: Moneda;
  publicada: boolean;
};

const nuevaConvocatoria = (): BorradorConvocatoria => ({
  curso: 'presencial',
  inicio: '',
  fin: '',
  ciudad: '',
  lugar: '',
  plazas: '10',
  precio: '',
  moneda: 'EUR',
  publicada: false,
});

const aBorrador = (c: Convocatoria): BorradorConvocatoria => ({
  id: c.id,
  curso: c.curso,
  inicio: c.inicio,
  fin: c.fin,
  ciudad: c.ciudad,
  lugar: c.lugar,
  plazas: String(c.plazas),
  precio: importeAEscribir(c.precio),
  moneda: c.moneda,
  publicada: c.publicada,
});

function FormConvocatoria({
  inicial,
  ocupadas,
  alCerrar,
  alGuardar,
}: {
  inicial: BorradorConvocatoria;
  ocupadas: number;
  alCerrar: () => void;
  alGuardar: (c: Convocatoria) => void;
}) {
  const [b, setB] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const idWeb = useId();
  const curso = cursoDe(b.curso);
  const hoy = hoyISO();

  const poner = <K extends keyof BorradorConvocatoria>(k: K, v: BorradorConvocatoria[K]) => {
    setB((x) => ({ ...x, [k]: v }));
    setErrores((e) => {
      if (!e[k as string] && !e.general) return e;
      const { [k as string]: _, general: __, ...resto } = e;
      return resto;
    });
  };

  /* Al elegir el primer día, el último se propone solo: la presencial son dos
     jornadas seguidas, así que casi siempre es el día siguiente. */
  const ponerInicio = (v: string) => {
    setB((x) => ({ ...x, inicio: v, fin: !x.fin || x.fin < v ? (v && x.curso === 'presencial' ? sumarDia(v, 1) : v) : x.fin }));
    setErrores(({ inicio: _, fin: __, ...resto }) => resto);
  };

  const guardar = async () => {
    const e: Record<string, string> = {};
    const precio = aCentimos(b.precio);
    if (precio === null) e.precio = 'Escríbelo solo con números, por ejemplo 1450 o 1.450,50.';
    if (!b.inicio) e.inicio = 'Elige el primer día.';
    if (!curso.enLinea && b.ciudad.trim().length < 2) e.ciudad = '¿En qué ciudad es?';
    const plazas = Number(b.plazas);
    if (!Number.isInteger(plazas) || plazas < 1 || plazas > PLAZAS_MAXIMAS) e.plazas = `De 1 a ${PLAZAS_MAXIMAS}.`;
    else if (plazas < ocupadas) e.plazas = `Ya hay ${ocupadas} inscritas: no puede tener menos plazas.`;
    if (Object.keys(e).length) {
      setErrores(e);
      return;
    }
    setGuardando(true);
    const cuerpo = { ...b, plazas, precio, fin: b.fin || b.inicio };
    const r = await pedir('/api/convocatorias', { method: b.id ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) });
    setGuardando(false);
    if (r.ok) {
      alGuardar(r.datos.convocatoria as Convocatoria);
      return;
    }
    const errs = (r.datos.errores as Record<string, string> | undefined) ?? { general: explicar(r) };
    setErrores(errs);
  };

  const enLaWebTexto = curso.enLinea
    ? 'Sale en la página de formaciones con el curso, las fechas y si quedan plazas.'
    : 'Sale en la página de formaciones con el curso, las fechas, la ciudad y si quedan plazas.';

  return (
    <Hoja
      titulo={b.id ? 'Editar convocatoria' : 'Nueva convocatoria'}
      subtitulo={b.id ? undefined : 'Una fecha de formación con sus plazas. Después apuntas a quien se inscriba.'}
      alCerrar={alCerrar}
      pie={
        <>
          <button type="button" className={s.botonSecundario} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="button" className={s.botonPrimario} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : b.id ? 'Guardar cambios' : 'Crear convocatoria'}
          </button>
        </>
      }
    >
      <div className={s.rejillaForm}>
        <div className={s.campo} data-ancho="entero">
          <span className={s.rotuloCampo} id={`${idWeb}-curso`}>
            Formación
          </span>
          <Segmentado
            nombre="curso-form"
            etiqueta="Formación"
            valor={b.curso}
            alCambiar={(v) => poner('curso', v)}
            opciones={CURSOS_CONVOCATORIA.map((c) => ({ id: c.id, texto: c.nombre.replace('Formación ', '').replace(/^./, (l) => l.toUpperCase()) }))}
          />
          <span className={s.ayuda}>{curso.detalle}.</span>
        </div>

        <Campo etiqueta="Primer día" error={errores.inicio}>
          {(p) => <input {...p} data-enfocar type="date" className={s.entrada} value={b.inicio} onChange={(e) => ponerInicio(e.target.value)} />}
        </Campo>
        <Campo etiqueta="Último día" error={errores.fin}>
          {(p) => <input {...p} type="date" className={s.entrada} value={b.fin} min={b.inicio || undefined} onChange={(e) => poner('fin', e.target.value)} />}
        </Campo>

        {!curso.enLinea && (
          <>
            <Campo etiqueta="Ciudad" error={errores.ciudad}>
              {(p) => <input {...p} className={s.entrada} value={b.ciudad} onChange={(e) => poner('ciudad', e.target.value)} placeholder="Bogotá" maxLength={80} autoComplete="off" />}
            </Campo>
            <Campo etiqueta="Lugar" opcional ayuda="La sala o la dirección. No sale en la web." error={errores.lugar}>
              {(p) => <input {...p} className={s.entrada} value={b.lugar} onChange={(e) => poner('lugar', e.target.value)} placeholder="Centro, sala o calle" maxLength={160} autoComplete="off" />}
            </Campo>
          </>
        )}

        <Campo etiqueta="Plazas" error={errores.plazas} ayuda={ocupadas ? `Ahora hay ${ocupadas} inscritas.` : undefined}>
          {(p) => (
            <input {...p} type="number" inputMode="numeric" min={Math.max(1, ocupadas)} max={PLAZAS_MAXIMAS} className={s.entrada} value={b.plazas} onChange={(e) => poner('plazas', e.target.value)} />
          )}
        </Campo>
        <Campo etiqueta="Precio por plaza" ayuda="Solo lo ves tú: nunca sale en la web." error={errores.precio}>
          {(p) => (
            <div className={s.importe}>
              <input {...p} inputMode="decimal" className={s.entrada} value={b.precio} onChange={(e) => poner('precio', e.target.value)} placeholder="1450" autoComplete="off" />
              <select className={s.moneda} aria-label="Moneda" value={b.moneda} onChange={(e) => poner('moneda', e.target.value as Moneda)}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m} title={NOMBRE_MONEDA[m]}>
                    {m === 'EUR' ? '€' : m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Campo>

        <div className={s.filaWeb} data-ancho="entero">
          <div>
            <p className={s.filaWebTitulo}>Mostrar en la web</p>
            <p className={s.ayuda} id={`${idWeb}-web`}>
              {enLaWebTexto} Nunca el precio, el lugar ni los nombres.
              {b.inicio && b.inicio < hoy ? ' Esta fecha ya ha empezado, así que aunque lo marques no saldrá.' : ''}
            </p>
          </div>
          <Interruptor encendido={b.publicada} alCambiar={(v) => poner('publicada', v)} etiqueta="Mostrar en la web" descrito={`${idWeb}-web`} />
        </div>

        {errores.general && (
          <p className={s.errorGeneral} role="alert" data-ancho="entero">
            {errores.general}
          </p>
        )}
      </div>
    </Hoja>
  );
}

/* ==========================================================================
   Formulario de una inscrita
   ========================================================================== */
type Contacto = { id: string; nombre: string; correo: string; whatsapp: string; ciudad: string; tipo: string };

type BorradorInscrita = {
  id?: string;
  nombre: string;
  correo: string;
  telefono: string;
  pagado: string;
  estado: EstadoPago;
  /** Si Sorela ha elegido el estado a mano: entonces ya no se propone solo. */
  estadoTocado: boolean;
  nota: string;
  contacto: string | null;
};

function FormInscrita({
  convocatoria,
  inicial,
  contactos,
  pedirContactos,
  alCerrar,
  alGuardar,
  alBorrar,
}: {
  convocatoria: Convocatoria;
  inicial: BorradorInscrita;
  contactos: Contacto[] | 'cargando' | 'error' | null;
  pedirContactos: () => void;
  alCerrar: () => void;
  alGuardar: (c: Convocatoria) => void;
  alBorrar?: () => void;
}) {
  const [b, setB] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(!inicial.id && !inicial.contacto);
  const { precio, moneda } = convocatoria;
  const idLista = useId();

  useEffect(() => {
    if (buscando) pedirContactos();
  }, [buscando, pedirContactos]);

  const poner = <K extends keyof BorradorInscrita>(k: K, v: BorradorInscrita[K]) => {
    setB((x) => ({ ...x, [k]: v }));
    setErrores((e) => {
      if (!e[k as string] && !e.general) return e;
      const { [k as string]: _, general: __, ...resto } = e;
      return resto;
    });
  };

  const ponerPagado = (texto: string) => {
    setB((x) => {
      const c = aCentimos(texto);
      return { ...x, pagado: texto, estado: x.estadoTocado || c === null ? x.estado : estadoSugerido(c, precio) };
    });
    setErrores(({ pagado: _, ...resto }) => resto);
  };

  /* Quién ya está en esta convocatoria, para no apuntarla dos veces sin querer. */
  const yaDentro = useMemo(() => {
    const ids = new Set<string>();
    for (const i of convocatoria.inscritas) {
      if (i.id === b.id) continue;
      if (i.contacto) ids.add(`c:${i.contacto}`);
      if (i.correo) ids.add(`m:${i.correo}`);
    }
    return ids;
  }, [convocatoria.inscritas, b.id]);

  const resultados = useMemo(() => {
    if (!Array.isArray(contactos)) return [];
    const q = plano(busca.trim());
    const lista = q
      ? contactos.filter((c) => plano(`${c.nombre} ${c.correo} ${c.whatsapp} ${c.ciudad}`).includes(q))
      : contactos.filter((c) => c.tipo === 'alumna');
    return lista.slice(0, 6);
  }, [contactos, busca]);

  const elegir = (c: Contacto) => {
    setB((x) => ({ ...x, nombre: c.nombre || x.nombre, correo: c.correo || '', telefono: c.whatsapp || '', contacto: c.id }));
    setErrores({});
    setBuscando(false);
    setBusca('');
  };

  const guardar = async () => {
    const pagado = aCentimos(b.pagado);
    const e: Record<string, string> = {};
    if (b.nombre.trim().length < 2) e.nombre = 'Escribe su nombre.';
    if (pagado === null) e.pagado = 'Escríbelo solo con números, por ejemplo 450.';
    if (Object.keys(e).length) {
      setErrores(e);
      return;
    }
    setGuardando(true);
    const cuerpo = { convocatoria: convocatoria.id, id: b.id, nombre: b.nombre, correo: b.correo, telefono: b.telefono, pagado, estado: b.estado, nota: b.nota, contacto: b.contacto };
    const r = await pedir('/api/convocatorias/inscritas', { method: b.id ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) });
    setGuardando(false);
    if (r.ok) {
      alGuardar(r.datos.convocatoria as Convocatoria);
      return;
    }
    setErrores((r.datos.errores as Record<string, string> | undefined) ?? { general: explicar(r) });
  };

  const pagadoCent = aCentimos(b.pagado) ?? 0;
  const falta = b.estado === 'pagado' ? 0 : Math.max(precio - pagadoCent, 0);
  const curso = cursoDe(convocatoria.curso);

  return (
    <Hoja
      titulo={b.id ? 'Editar inscrita' : 'Apuntar a alguien'}
      subtitulo={`${curso.nombre}${convocatoria.ciudad ? ` · ${convocatoria.ciudad}` : ''} · ${rangoFechas(convocatoria.inicio, convocatoria.fin)}`}
      alCerrar={alCerrar}
      pie={
        <>
          {alBorrar && (
            <button type="button" className={s.botonPeligro} onClick={alBorrar}>
              Quitar de la convocatoria
            </button>
          )}
          <span className={s.hueco} />
          <button type="button" className={s.botonSecundario} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="button" className={s.botonPrimario} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : b.id ? 'Guardar' : 'Apuntar'}
          </button>
        </>
      }
    >
      <div className={s.rejillaForm}>
        {/* ---------- Elegir de Clientes ---------- */}
        <div className={s.campo} data-ancho="entero">
          {b.contacto && !buscando ? (
            <div className={s.enlazada}>
              <span className={s.enlazadaIcono}>
                <Icono d={I.enlace} size={15} />
              </span>
              <span className={s.enlazadaTexto}>
                Datos copiados de <b>Clientes</b>. Si los cambias aquí, su contacto no se toca.
              </span>
              <button type="button" className={s.enlaceTexto} onClick={() => poner('contacto', null)}>
                Quitar enlace
              </button>
            </div>
          ) : buscando ? (
            <div className={s.buscador}>
              <label className={s.rotuloCampo} htmlFor={`${idLista}-q`}>
                Buscar en Clientes <small>(opcional)</small>
              </label>
              <div className={s.cajaBusqueda}>
                <Icono d={I.lupa} size={16} />
                <input
                  id={`${idLista}-q`}
                  data-enfocar
                  type="search"
                  className={s.entradaBusqueda}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nombre, correo o teléfono"
                  autoComplete="off"
                  aria-controls={`${idLista}-r`}
                />
              </div>
              <div id={`${idLista}-r`} className={s.resultados} aria-live="polite">
                {contactos === 'cargando' || contactos === null ? (
                  <p className={s.resultadosNota}>Cargando tus contactos…</p>
                ) : contactos === 'error' ? (
                  <p className={s.resultadosNota}>No he podido cargar Clientes. Escríbela a mano abajo.</p>
                ) : resultados.length === 0 ? (
                  <p className={s.resultadosNota}>{busca.trim() ? 'Nadie con ese nombre en Clientes. Escríbela a mano abajo.' : 'Escribe para buscar entre tus contactos.'}</p>
                ) : (
                  <>
                    {!busca.trim() && <p className={s.resultadosNota}>Quienes te pidieron información para formarse:</p>}
                    <ul className={s.listaResultados}>
                      {resultados.map((c) => {
                        const dentro = yaDentro.has(`c:${c.id}`) || (c.correo && yaDentro.has(`m:${c.correo}`));
                        return (
                          <li key={c.id}>
                            <button type="button" className={s.resultado} onClick={() => elegir(c)} disabled={!!dentro}>
                              <span className={s.avatar} aria-hidden="true">
                                {iniciales(c.nombre)}
                              </span>
                              <span className={s.resultadoTexto}>
                                <b>{c.nombre || 'Sin nombre'}</b>
                                <span>{[c.correo, c.whatsapp, c.ciudad].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
                              </span>
                              <span className={s.resultadoAccion}>{dentro ? 'Ya está apuntada' : 'Elegir'}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
              <button type="button" className={s.enlaceTexto} onClick={() => setBuscando(false)}>
                No está en Clientes: la escribo a mano
              </button>
            </div>
          ) : (
            <button type="button" className={s.botonBuscar} onClick={() => setBuscando(true)}>
              <Icono d={I.lupa} size={16} />
              Elegir de Clientes
            </button>
          )}
        </div>

        {/* ---------- Sus datos ---------- */}
        <Campo etiqueta="Nombre" error={errores.nombre} ancho="entero">
          {(p) => <input {...p} {...(!buscando ? { 'data-enfocar': true } : {})} className={s.entrada} value={b.nombre} onChange={(e) => poner('nombre', e.target.value)} placeholder="Nombre y apellido" maxLength={80} autoComplete="off" />}
        </Campo>
        <Campo etiqueta="Correo" opcional error={errores.correo}>
          {(p) => <input {...p} type="email" inputMode="email" className={s.entrada} value={b.correo} onChange={(e) => poner('correo', e.target.value)} placeholder="nombre@correo.com" maxLength={160} autoComplete="off" />}
        </Campo>
        <Campo etiqueta="Teléfono" opcional error={errores.telefono}>
          {(p) => <input {...p} type="tel" inputMode="tel" className={s.entrada} value={b.telefono} onChange={(e) => poner('telefono', e.target.value)} placeholder="+57 300 000 0000" maxLength={32} autoComplete="off" />}
        </Campo>

        {/* ---------- El pago ---------- */}
        <Campo
          etiqueta="Ha pagado"
          error={errores.pagado}
          ayuda={precio > 0 ? <>La plaza cuesta {formatearImporte(precio, moneda)}{falta > 0 ? <> · le faltan <b>{formatearImporte(falta, moneda)}</b></> : null}.</> : 'Sin precio en la convocatoria: no puedo calcular lo que falta.'}
        >
          {(p) => (
            <div className={s.importe}>
              <input {...p} inputMode="decimal" className={s.entrada} value={b.pagado} onChange={(e) => ponerPagado(e.target.value)} placeholder="0" autoComplete="off" />
              <span className={s.monedaFija}>{moneda === 'EUR' ? '€' : moneda}</span>
            </div>
          )}
        </Campo>
        <div className={s.campo}>
          <span className={s.rotuloCampo}>Estado del pago</span>
          <Segmentado
            nombre="estado-pago"
            etiqueta="Estado del pago"
            valor={b.estado}
            alCambiar={(v) => setB((x) => ({ ...x, estado: v, estadoTocado: true }))}
            opciones={ESTADOS_PAGO.map((e) => ({ id: e, texto: ETIQUETA_PAGO[e] }))}
          />
          {precio > 0 && (
            <span className={s.atajos}>
              <button type="button" className={s.atajo} onClick={() => setB((x) => ({ ...x, pagado: importeAEscribir(precio), estado: 'pagado', estadoTocado: false }))}>
                Ha pagado todo
              </button>
              <button type="button" className={s.atajo} onClick={() => setB((x) => ({ ...x, pagado: '', estado: 'pendiente', estadoTocado: false }))}>
                Nada todavía
              </button>
            </span>
          )}
        </div>

        <Campo etiqueta="Nota" opcional ancho="entero" error={errores.nota}>
          {(p) => <textarea {...p} className={s.entrada} rows={2} value={b.nota} onChange={(e) => poner('nota', e.target.value)} placeholder="Pagó la señal por Bizum, viene con una compañera…" maxLength={500} />}
        </Campo>

        {errores.general && (
          <p className={s.errorGeneral} role="alert" data-ancho="entero">
            {errores.general}
          </p>
        )}
      </div>
    </Hoja>
  );
}

/* ==========================================================================
   Una convocatoria
   ========================================================================== */

/** La barra de plazas: pagadas, con señal, pendientes y libres, cada una con su tramo. */
function BarraPlazas({ c }: { c: Convocatoria }) {
  const r = resumenDe(c);
  const reducir = useReducedMotion();
  const tramos: { clave: string; n: number }[] = [
    { clave: 'pagado', n: r.pagadas },
    { clave: 'senal', n: r.conSenal },
    { clave: 'pendiente', n: r.pendientes },
  ];
  return (
    <div className={s.barra} role="img" aria-label={`${r.ocupadas} de ${c.plazas} plazas ocupadas: ${r.pagadas} pagadas, ${r.conSenal} con señal, ${r.pendientes} pendientes y ${r.libres} libres.`}>
      {tramos.map(
        (t) =>
          t.n > 0 && (
            <motion.span
              key={t.clave}
              className={s.tramo}
              data-estado={t.clave}
              initial={reducir ? false : { width: 0 }}
              animate={{ width: `${(t.n / c.plazas) * 100}%` }}
              transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 26 }}
            />
          )
      )}
    </div>
  );
}

function TarjetaConvocatoria({
  c,
  hoy,
  abierta,
  alAbrir,
  alEditar,
  alBorrar,
  alPublicar,
  alApuntar,
  alEditarInscrita,
  alBorrarInscrita,
}: {
  c: Convocatoria;
  hoy: string;
  abierta: boolean;
  alAbrir: () => void;
  alEditar: () => void;
  alBorrar: () => void;
  alPublicar: (v: boolean) => void;
  alApuntar: () => void;
  alEditarInscrita: (i: Inscrita) => void;
  alBorrarInscrita: (i: Inscrita) => void;
}) {
  const reducir = useReducedMotion();
  const idWeb = useId();
  const idLista = useId();
  const r = resumenDe(c);
  const curso = cursoDe(c.curso);
  const hoja = hojaCalendario(c.inicio, c.fin);
  const pasada = c.fin < hoy;
  const empezada = c.inicio < hoy;
  const enWeb = c.publicada && !empezada;
  const llena = r.libres === 0;
  const dinero = (n: number) => formatearImporte(n, c.moneda);

  const estadoWeb = !c.publicada
    ? 'Solo la ves tú'
    : empezada
      ? 'Ya empezó: ya no sale en la web'
      : `En la web · ${ETIQUETA_PLAZAS[estadoPlazas(c.plazas, r.ocupadas)]}`;

  return (
    <motion.article
      layout={reducir ? false : 'position'}
      className={s.tarjeta}
      data-pasada={pasada || undefined}
      initial={reducir ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
    >
      {/* ---------- Cabeza: fecha, qué y dónde, y si sale en la web ---------- */}
      <header className={s.tarjetaCabeza}>
        <div className={s.hojaCal} aria-hidden="true">
          <span className={s.hojaMes}>{hoja.mes}</span>
          <span className={s.hojaDias}>{hoja.dias}</span>
          <span className={s.hojaAno}>{hoja.ano}</span>
        </div>
        <div className={s.tarjetaTitulos}>
          <p className={s.tarjetaCurso}>{curso.nombre}</p>
          <h3 className={s.tarjetaCiudad}>{curso.enLinea ? 'Online' : c.ciudad}</h3>
          <p className={s.tarjetaFechas}>
            <span className={s.sinCortar}>{rangoFechas(c.inicio, c.fin)}</span>
            <span aria-hidden="true"> · </span>
            <span className={s.sinCortar}>{diasDeLaSemana(c.inicio, c.fin)}</span>
          </p>
          <p className={s.tarjetaMeta}>
            <span className={s.cuando} data-pasada={pasada || undefined}>
              {cuandoEs(c, hoy)}
            </span>
            {c.lugar && <span className={s.lugar}>{c.lugar}</span>}
          </p>
        </div>
        <div className={s.tarjetaAcciones}>
          <button type="button" className={s.botonIcono} onClick={alEditar} aria-label={`Editar la convocatoria de ${curso.enLinea ? 'la online' : c.ciudad}`}>
            <Icono d={I.lapiz} size={17} />
          </button>
          <button type="button" className={s.botonIcono} data-peligro onClick={alBorrar} aria-label={`Borrar la convocatoria de ${curso.enLinea ? 'la online' : c.ciudad}`}>
            <Icono d={I.papelera} size={17} />
          </button>
        </div>
      </header>

      <div className={s.web} data-en-web={enWeb || undefined}>
        <span className={s.webPunto} aria-hidden="true" />
        <span className={s.webTexto} id={`${idWeb}-estado`}>
          {estadoWeb}
        </span>
        <span className={s.webInterruptor}>
          <span className={s.webRotulo}>Mostrar en la web</span>
          <Interruptor encendido={c.publicada} alCambiar={alPublicar} etiqueta="Mostrar en la web" descrito={`${idWeb}-estado`} />
        </span>
      </div>

      {/* ---------- Las tres cifras ---------- */}
      <div className={s.cifras}>
        <div className={s.cifra} data-ancha>
          <span className={s.cifraRotulo}>Plazas</span>
          <span className={s.cifraValor}>
            {r.ocupadas}
            <small> de {c.plazas}</small>
          </span>
          <BarraPlazas c={c} />
          <span className={s.leyenda}>
            <span data-estado="pagado">{r.pagadas} pagadas</span>
            <span data-estado="senal">{r.conSenal} con señal</span>
            <span data-estado="pendiente">{r.pendientes} pendientes</span>
            <span data-estado="libre">{llena ? 'Completa' : `${r.libres} libres`}</span>
          </span>
        </div>
        <div className={s.cifra}>
          <span className={s.cifraRotulo}>Cobrado</span>
          <span className={s.cifraValor}>{dinero(r.cobrado)}</span>
          <span className={s.cifraNota}>{c.precio > 0 ? `de ${dinero(r.cobrado + r.porCobrar)} en total` : 'sin precio apuntado'}</span>
        </div>
        <div className={s.cifra} data-alerta={r.porCobrar > 0 || undefined}>
          <span className={s.cifraRotulo}>Por cobrar</span>
          <span className={s.cifraValor}>{c.precio > 0 ? dinero(r.porCobrar) : '—'}</span>
          <span className={s.cifraNota}>
            {c.precio === 0
              ? 'pon el precio para calcularlo'
              : r.deudoras.length === 0
                ? r.ocupadas
                  ? 'todas han pagado'
                  : 'nadie apuntada todavía'
                : `de ${r.deudoras.length} ${r.deudoras.length === 1 ? 'persona' : 'personas'}`}
          </span>
        </div>
      </div>

      {/* ---------- Quién falta por pagar ---------- */}
      {r.deudoras.length > 0 && (
        <div className={s.faltan}>
          <p className={s.faltanTitulo}>Falta por pagar</p>
          <ul className={s.faltanLista}>
            {r.deudoras.map(({ inscrita: i, debe }) => (
              <li key={i.id}>
                <button type="button" className={s.deudora} onClick={() => alEditarInscrita(i)} aria-label={`${i.nombre}: ${ETIQUETA_PAGO[i.estado]}${c.precio > 0 ? `, le faltan ${dinero(debe)}` : ''}. Abrir para apuntar el pago.`}>
                  <span className={s.deudoraPunto} data-estado={i.estado} aria-hidden="true" />
                  <span className={s.deudoraNombre}>{i.nombre}</span>
                  {c.precio > 0 && <span className={s.deudoraDebe}>{dinero(debe)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Las inscritas ---------- */}
      <div className={s.inscritasCabeza}>
        <button type="button" className={s.desplegar} aria-expanded={abierta} aria-controls={idLista} onClick={alAbrir}>
          <span className={s.desplegarFlecha} data-abierta={abierta || undefined}>
            <Icono d={I.flecha} size={15} />
          </span>
          Inscritas <span className={s.contador}>{r.ocupadas}</span>
        </button>
        <button
          type="button"
          className={s.botonSecundario}
          data-pequeno
          onClick={alApuntar}
          disabled={llena}
          title={llena ? 'Está completa: sube las plazas para apuntar a alguien más.' : undefined}
        >
          <Icono d={I.mas} size={15} />
          {llena ? 'Completa' : 'Apuntar a alguien'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            id={idLista}
            className={s.inscritasCaja}
            initial={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reducir ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 38 }}
          >
            {c.inscritas.length === 0 ? (
              <p className={s.inscritasVacio}>
                Nadie apuntada todavía. Pulsa <b>Apuntar a alguien</b> y elígela de Clientes o escríbela a mano.
              </p>
            ) : (
              <ul className={s.inscritas}>
                {c.inscritas.map((i) => (
                  <li key={i.id} className={s.inscrita}>
                    <span className={s.avatar} aria-hidden="true">
                      {iniciales(i.nombre)}
                    </span>
                    <span className={s.inscritaQuien}>
                      <b>{i.nombre}</b>
                      <span>{[i.correo, i.telefono].filter(Boolean).join(' · ') || 'Sin correo ni teléfono'}</span>
                      {i.nota && <span className={s.inscritaNota}>{i.nota}</span>}
                    </span>
                    <span className={s.inscritaPago}>
                      <span className={s.inscritaImporte}>{dinero(i.pagado)}</span>
                      <PildoraPago estado={i.estado} />
                    </span>
                    <span className={s.inscritaAcciones}>
                      <button type="button" className={s.botonIcono} onClick={() => alEditarInscrita(i)} aria-label={`Editar a ${i.nombre}`}>
                        <Icono d={I.lapiz} size={16} />
                      </button>
                      <button type="button" className={s.botonIcono} data-peligro onClick={() => alBorrarInscrita(i)} aria-label={`Quitar a ${i.nombre} de la convocatoria`}>
                        <Icono d={I.papelera} size={16} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ==========================================================================
   La pantalla
   ========================================================================== */
export default function Convocatorias() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [lista, setLista] = useState<Convocatoria[]>([]);
  const [pestana, setPestana] = useState<'proximas' | 'pasadas'>('proximas');
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [formConv, setFormConv] = useState<{ borrador: BorradorConvocatoria; ocupadas: number } | null>(null);
  const [formIns, setFormIns] = useState<{ conv: string; borrador: BorradorInscrita } | null>(null);
  const [contactos, setContactos] = useState<Contacto[] | 'cargando' | 'error' | null>(null);
  const [confirmar, dialogo] = useConfirmar();
  const [avisar, aviso] = useAviso();
  const hoy = hoyISO();

  const cargar = useCallback(async () => {
    const r = await pedir('/api/convocatorias');
    if (r.ok) {
      setLista(r.datos.convocatorias as Convocatoria[]);
      setEstado('listo');
    } else setEstado(r.datos.motivo === 'sin-configurar' ? 'sin-configurar' : 'error');
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Cambia una convocatoria por la que devuelve el servidor (o la añade). */
  const poner = useCallback((c: Convocatoria) => {
    setLista((l) => {
      const resto = l.filter((x) => x.id !== c.id);
      return [...resto, c].sort((a, b) => a.inicio.localeCompare(b.inicio));
    });
  }, []);

  const pedirContactos = useCallback(() => {
    setContactos((actual) => {
      if (actual !== null && actual !== 'error') return actual;
      pedir('/api/contactos').then((r) => {
        if (!r.ok) return setContactos('error');
        const crudos = (r.datos.contactos as Record<string, unknown>[]) ?? [];
        setContactos(
          crudos
            .filter((c) => c.estado !== 'Descartado')
            .map((c) => ({
              id: String(c.id ?? ''),
              nombre: String(c.nombre ?? ''),
              correo: String(c.correo ?? ''),
              whatsapp: String(c.whatsapp ?? ''),
              ciudad: String(c.ciudad ?? ''),
              tipo: String(c.tipo ?? ''),
            }))
        );
      });
      return 'cargando';
    });
  }, []);

  const proximas = useMemo(() => lista.filter((c) => c.fin >= hoy), [lista, hoy]);
  const pasadas = useMemo(() => lista.filter((c) => c.fin < hoy).reverse(), [lista, hoy]);
  const vistas = pestana === 'pasadas' && pasadas.length ? pasadas : proximas;
  const hayPublicadas = proximas.some((c) => c.publicada && c.inicio >= hoy);

  /* Con una sola convocatoria a la vista, sus inscritas salen abiertas: es lo
     que se viene a mirar. Con varias, cerradas, para ver todas de un golpe. */
  const estaAbierta = (id: string) => abiertas[id] ?? vistas.length === 1;

  /* ---------- Acciones ---------- */
  const publicar = async (c: Convocatoria, v: boolean) => {
    poner({ ...c, publicada: v });
    const r = await pedir('/api/convocatorias', { method: 'PATCH', body: JSON.stringify({ id: c.id, publicada: v }) });
    if (r.ok) {
      poner(r.datos.convocatoria as Convocatoria);
      avisar(v ? (c.inicio >= hoy ? 'Ya sale en la web, en la página de formaciones.' : 'Marcada, pero como ya empezó no saldrá en la web.') : 'Quitada de la web.', 'hecho');
    } else {
      poner(c);
      avisar(explicar(r));
      if (r.datos.motivo === 'no-existe') cargar();
    }
  };

  const borrarConvocatoria = async (c: Convocatoria) => {
    const n = c.inscritas.length;
    const donde = cursoDe(c.curso).enLinea ? 'la online' : c.ciudad;
    const si = await confirmar({
      titulo: `¿Borrar la convocatoria de ${donde}?`,
      texto: `${rangoFechas(c.inicio, c.fin)}. ${n ? `Se borran también sus ${n} ${n === 1 ? 'inscrita' : 'inscritas'} con todo lo apuntado de sus pagos. ` : ''}${c.publicada ? 'Desaparece de la web. ' : ''}Los contactos de Clientes no se tocan. No se puede deshacer.`,
      boton: 'Borrar convocatoria',
    });
    if (!si) return;
    const r = await pedir(`/api/convocatorias?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' });
    if (r.ok || r.datos.motivo === 'no-existe') {
      setLista((l) => l.filter((x) => x.id !== c.id));
      avisar('Convocatoria borrada.', 'hecho');
    } else avisar(explicar(r, 'borrar'));
  };

  const borrarInscrita = async (c: Convocatoria, i: Inscrita) => {
    const si = await confirmar({
      titulo: `¿Quitar a ${i.nombre}?`,
      texto: `Sale de esta convocatoria y se pierde lo que tenías apuntado de su pago${i.pagado ? ` (${formatearImporte(i.pagado, c.moneda)})` : ''}. Su plaza queda libre. Si está en Clientes, su contacto no se toca. No se puede deshacer.`,
      boton: 'Quitar',
    });
    if (!si) return false;
    const r = await pedir(`/api/convocatorias/inscritas?convocatoria=${encodeURIComponent(c.id)}&id=${encodeURIComponent(i.id)}`, { method: 'DELETE' });
    if (r.ok) {
      poner(r.datos.convocatoria as Convocatoria);
      avisar(`${i.nombre} ya no está en la convocatoria.`, 'hecho');
      return true;
    }
    avisar(explicar(r, 'quitar'));
    if (r.datos.motivo === 'no-existe') cargar();
    return false;
  };

  const abrirApuntar = (c: Convocatoria) =>
    setFormIns({ conv: c.id, borrador: { nombre: '', correo: '', telefono: '', pagado: '', estado: 'pendiente', estadoTocado: false, nota: '', contacto: null } });

  const abrirInscrita = (c: Convocatoria, i: Inscrita) =>
    setFormIns({
      conv: c.id,
      borrador: { id: i.id, nombre: i.nombre, correo: i.correo, telefono: i.telefono, pagado: importeAEscribir(i.pagado), estado: i.estado, estadoTocado: true, nota: i.nota, contacto: i.contacto },
    });

  const convDeForm = formIns ? lista.find((c) => c.id === formIns.conv) : undefined;

  /* ---------- Pintar ---------- */
  const nuevo = () => setFormConv({ borrador: nuevaConvocatoria(), ocupadas: 0 });

  return (
    <div className={s.pantalla}>
      <div className={s.cabeza}>
        <p className={s.intro}>Aquí apuntas cada fecha de formación que abres: sus plazas, quién se ha apuntado y quién te ha pagado.</p>
        {estado === 'listo' && lista.length > 0 && (
          <div className={s.cabezaAcciones}>
            {hayPublicadas && (
              <a href="/formaciones#proximas-fechas" target="_blank" rel="noopener" className={s.enlaceTexto}>
                Ver en la web
                <Icono d={I.fuera} size={14} />
              </a>
            )}
            <button type="button" className={s.botonPrimario} onClick={nuevo}>
              <Icono d={I.mas} size={16} />
              Nueva convocatoria
            </button>
          </div>
        )}
      </div>

      {estado === 'cargando' && (
        <div className={s.esqueletos} aria-busy="true" aria-label="Cargando convocatorias">
          {[0, 1].map((n) => (
            <div key={n} className={s.esqueleto} />
          ))}
        </div>
      )}

      {(estado === 'error' || estado === 'sin-configurar') && (
        <div className={s.vacio} role="alert">
          <p className={s.vacioTitulo}>No he podido cargar las convocatorias</p>
          <p className={s.vacioTexto}>{estado === 'sin-configurar' ? 'La base de datos no está conectada en este entorno.' : 'Puede ser la conexión. Prueba otra vez en un momento.'}</p>
          {estado === 'error' && (
            <button type="button" className={s.botonSecundario} onClick={() => { setEstado('cargando'); cargar(); }}>
              Reintentar
            </button>
          )}
        </div>
      )}

      {estado === 'listo' && lista.length === 0 && (
        <div className={s.vacio}>
          <span className={s.vacioIcono} aria-hidden="true">
            <Icono d={I.calendario} size={26} />
          </span>
          <p className={s.vacioTitulo}>Todavía no hay ninguna convocatoria</p>
          <p className={s.vacioTexto}>
            Cuando cierres una fecha, créala aquí con su ciudad y sus plazas. Después apuntas a quien se inscriba y lo que te ha pagado. Si la marcas para la web, sale sola en la página de formaciones.
          </p>
          <button type="button" className={s.botonPrimario} onClick={nuevo}>
            <Icono d={I.mas} size={16} />
            Crear la primera convocatoria
          </button>
        </div>
      )}

      {estado === 'listo' && lista.length > 0 && (
        <>
          {pasadas.length > 0 && (
            <Segmentado
              nombre="pestanas"
              etiqueta="Qué convocatorias ver"
              valor={pestana}
              alCambiar={setPestana}
              opciones={[
                { id: 'proximas', texto: <>Próximas <span className={s.contadorSeg}>{proximas.length}</span></> },
                { id: 'pasadas', texto: <>Pasadas <span className={s.contadorSeg}>{pasadas.length}</span></> },
              ]}
            />
          )}

          {vistas.length === 0 ? (
            <div className={s.vacio} data-pequeno>
              <p className={s.vacioTitulo}>No hay ninguna fecha por delante</p>
              <p className={s.vacioTexto}>Las que ya pasaron están en «Pasadas». Cuando cierres la siguiente, créala aquí.</p>
            </div>
          ) : (
            <div className={s.lista}>
              <AnimatePresence initial={false}>
                {vistas.map((c) => (
                  <TarjetaConvocatoria
                    key={c.id}
                    c={c}
                    hoy={hoy}
                    abierta={estaAbierta(c.id)}
                    alAbrir={() => setAbiertas((a) => ({ ...a, [c.id]: !estaAbierta(c.id) }))}
                    alEditar={() => setFormConv({ borrador: aBorrador(c), ocupadas: c.inscritas.length })}
                    alBorrar={() => borrarConvocatoria(c)}
                    alPublicar={(v) => publicar(c, v)}
                    alApuntar={() => abrirApuntar(c)}
                    alEditarInscrita={(i) => abrirInscrita(c, i)}
                    alBorrarInscrita={(i) => borrarInscrita(c, i)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {formConv && (
          <FormConvocatoria
            key="conv"
            inicial={formConv.borrador}
            ocupadas={formConv.ocupadas}
            alCerrar={() => setFormConv(null)}
            alGuardar={(c) => {
              const nueva = !formConv.borrador.id;
              poner(c);
              setFormConv(null);
              if (nueva) {
                setPestana('proximas');
                setAbiertas((a) => ({ ...a, [c.id]: true }));
              }
              avisar(nueva ? 'Convocatoria creada. Ya puedes apuntar a quien se inscriba.' : 'Cambios guardados.', 'hecho');
            }}
          />
        )}
        {formIns && convDeForm && (
          <FormInscrita
            key="ins"
            convocatoria={convDeForm}
            inicial={formIns.borrador}
            contactos={contactos}
            pedirContactos={pedirContactos}
            alCerrar={() => setFormIns(null)}
            alGuardar={(c) => {
              const nueva = !formIns.borrador.id;
              poner(c);
              setFormIns(null);
              setAbiertas((a) => ({ ...a, [c.id]: true }));
              avisar(nueva ? `${formIns.borrador.nombre || 'Inscrita'} apuntada.` : 'Guardado.', 'hecho');
            }}
            alBorrar={
              formIns.borrador.id
                ? async () => {
                    const i = convDeForm.inscritas.find((x) => x.id === formIns.borrador.id);
                    if (i && (await borrarInscrita(convDeForm, i))) setFormIns(null);
                  }
                : undefined
            }
          />
        )}
      </AnimatePresence>

      {dialogo}
      {aviso}
    </div>
  );
}
