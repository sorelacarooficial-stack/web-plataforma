'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAviso, useConfirmar } from './Confirmar';
import {
  CURSOS_CONVOCABLES,
  CURSO_POR_DEFECTO,
  ESTADOS_PAGO,
  ETIQUETA_ACCESO_CURSO,
  ETIQUETA_PAGO,
  ETIQUETA_PLAZAS,
  MONEDAS,
  NOMBRE_MONEDA,
  aCentimos,
  aTextoImporte,
  anoDe,
  capital,
  cursoDe,
  diaDe,
  diasEntre,
  estadoPlazas,
  estadoSugerido,
  hoyISO,
  importe,
  iniciales,
  lineasHorario,
  mesCortoDe,
  rangoFechas,
  resumen,
  semanaCortaDe,
  semanaDe,
  type Convocatoria,
  type EstadoPago,
  type Inscrita,
  type Jornada,
  type Moneda,
} from '@/lib/convocatorias-tipos';
import s from './convocatorias.module.css';

/**
 * Contenido › Formaciones: las convocatorias de verdad.
 *
 * Antes esta pantalla decía «todavía no guarda nada» y Sorela no sabía qué
 * era. Ahora es lo que dice su primera línea: cada fecha que abre de una
 * formación presencial, con sus plazas, quién se ha apuntado y quién le ha
 * pagado. Se ve sin tocar nada lo que más se pregunta: cuántas plazas quedan
 * (con una barra que separa pagadas, con señal y pendientes), cuánto ha
 * cobrado, cuánto le falta y QUIÉN le falta por pagar.
 *
 * TRES COSAS DISTINTAS, y la pantalla las separa a la vista (lo pidió Sorela
 * en mayúsculas):
 *
 *   1. La formación presencial que se paga → la convocatoria: plazas y pagos.
 *   2. El acceso al curso en el aula (precurso, clases y material) → se crea
 *      en UN solo sitio, Cuentas › Dar acceso (aquí solo se ve en qué punto
 *      está). Apuntar a alguien NO lo da.
 *      Marcarla «Pagado» le abre el curso completo si solo tenía el precurso.
 *   3. La membresía de la Comunidad Divine → NO se da desde aquí, nunca.
 *
 * Cada una tiene su color y su icono en toda la pantalla: bronce para lo que
 * se paga, tinta para el acceso al curso y una línea discontinua tachada para
 * la membresía, que aquí solo aparece para decir que no está.
 *
 * «Mostrar en la web» saca la fecha en /formaciones con la ciudad, los días,
 * el horario y si quedan plazas. Nunca el precio, el lugar ni los nombres: lo
 * decide el servidor (lib/convocatorias.ts lee solo esos campos), no esta
 * pantalla.
 */

type Estado = 'cargando' | 'listo' | 'error' | 'sin-configurar';
type Respuesta = { ok: boolean; status: number; datos: Record<string, unknown> };

async function pedir(url: string, init?: RequestInit): Promise<Respuesta> {
  try {
    const r = await fetch(url, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined, cache: 'no-store' });
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
    case 'curso-sin-enlace':
      return 'Este curso todavía no se puede dar con un enlace. Dáselo desde Cuentas cuando tenga cuenta.';
    default:
      return `No se ha podido ${que}. Prueba otra vez en un momento.`;
  }
}

/** Para buscar sin que importen tildes ni mayúsculas: «Rocío» y «rocio» son la misma. */
const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const sumarDia = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const diasHasta = (iso: string, hoy: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);

/** «Faltan 11 días», «Mañana», «En curso»… */
function cuandoEs(c: Convocatoria, hoy: string): string {
  const n = diasHasta(c.inicio, hoy);
  if (n > 1) return `Faltan ${n} días`;
  if (n === 1) return 'Empieza mañana';
  if (n === 0) return 'Empieza hoy';
  return c.fin >= hoy ? 'En curso' : 'Ya terminó';
}

/** La fecha como hoja de calendario: «24–25» grande y «oct 2026» debajo. */
function hojaDe(inicio: string, fin: string) {
  if (!inicio) return { dias: '—', mes: '', ano: '' };
  const f = fin && fin >= inicio ? fin : inicio;
  const mismoMes = inicio.slice(0, 7) === f.slice(0, 7);
  return {
    dias: inicio === f ? diaDe(inicio) : `${diaDe(inicio)}–${diaDe(f)}`,
    mes: mismoMes ? mesCortoDe(inicio) : `${mesCortoDe(inicio)}–${mesCortoDe(f)}`,
    ano: anoDe(inicio) === anoDe(f) ? anoDe(inicio) : `${anoDe(inicio)}–${anoDe(f)}`,
  };
}

/** «sábado y domingo», «3 días, de jueves a sábado». */
function diasDeLaSemana(inicio: string, fin: string): string {
  const dias = diasEntre(inicio, fin || inicio);
  if (!dias.length) return '';
  if (dias.length === 1) return semanaDe(dias[0]);
  if (dias.length === 2) return `${semanaDe(dias[0])} y ${semanaDe(dias[1])}`;
  return `${dias.length} días, de ${semanaDe(dias[0])} a ${semanaDe(dias[dias.length - 1])}`;
}

const dinero = (n: number, m: Moneda) => importe(n, m);
/** «1 pagada», «3 pagadas». */
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const simbolo = (m: Moneda) => (m === 'EUR' ? '€' : m);

/* ==========================================================================
   Iconos (trazo fino, 24 × 24, como los de la plataforma)
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
  enlace: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  hecho: 'M5 12.5l4.5 4.5L19 7.5',
  /** Lo que se paga: una moneda. */
  pago: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1.2 1.7 2.8 2c1.6.3 2.8.8 2.8 2s-1.1 2-2.8 2c-1.3 0-2.3-.4-2.8-1.2M12 6.5V8M12 16v1.5',
  /** El acceso al curso: la pantalla del aula con su «play». */
  aula: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6ZM8 21h8M12 17v4M10.5 8.5v4l3.5-2-3.5-2Z',
  /** La membresía, tachada: aquí no se da. */
  membresia: 'M12 3l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 14.9l-4.6 2.4.9-5.2-3.8-3.6 5.2-.7L12 3ZM4 20L20 4',
  copiar: 'M9 9h10v10H9zM5 15V5h10',
  reloj: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
};

function IconoWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="currentColor">
      <path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.3 4.8 4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.3-.3Z" />
    </svg>
  );
}

/** El estado de un pago con su icono: no solo el color dice cuál es. */
function PildoraPago({ estado }: { estado: EstadoPago }) {
  return (
    <span className={s.pildora} data-estado={estado}>
      {estado === 'pagado' ? (
        <Icono d={I.hecho} size={13} />
      ) : estado === 'senal' ? (
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
        </svg>
      ) : (
        <Icono d={I.reloj} size={13} />
      )}
      {ETIQUETA_PAGO[estado]}
    </span>
  );
}

/* ==========================================================================
   Controles: segmentado e interruptor
   ========================================================================== */

/** Control segmentado como los de iOS: grupo de opciones con flechas y pastilla que se desliza. */
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
    let j: number;
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
              <motion.span layoutId={`segmento-${nombre}`} className={s.segmentoFondo} transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }} />
            )}
            <span className={s.segmentoTexto}>{o.texto}</span>
          </button>
        );
      })}
    </div>
  );
}

function Interruptor({ encendido, alCambiar, etiqueta, descrito }: { encendido: boolean; alCambiar: (v: boolean) => void; etiqueta: string; descrito?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      aria-describedby={descrito}
      className={s.interruptor}
      data-encendido={encendido || undefined}
      onClick={() => alCambiar(!encendido)}
    >
      <span className={s.interruptorBola} />
    </button>
  );
}

/* ==========================================================================
   Hoja: sube desde abajo en el móvil y flota en el centro en escritorio
   ========================================================================== */
function Hoja({ titulo, subtitulo, alCerrar, children, pie, estrecha }: { titulo: string; subtitulo?: string; alCerrar: () => void; children: ReactNode; pie: ReactNode; estrecha?: boolean }) {
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
      // Con la pregunta de borrar abierta encima, manda ella.
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
      if (!caja.current.contains(document.activeElement)) {
        e.preventDefault();
        a.focus();
      } else if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
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
        data-estrecha={estrecha || undefined}
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
          <button type="button" className={s.botonIcono} onClick={alCerrar} aria-label="Cerrar">
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
  ancho,
  children,
}: {
  etiqueta: string;
  opcional?: string;
  ayuda?: ReactNode;
  error?: string;
  ancho?: 'entero';
  children: (p: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const describe = [ayuda ? `${id}-a` : '', error ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={s.campo} data-ancho={ancho}>
      <label htmlFor={id} className={s.rotuloCampo}>
        {etiqueta}
        {opcional && <small> ({opcional})</small>}
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

/** Quita un error de la lista al tocar su campo. */
const sinError = (e: Record<string, string>, ...campos: string[]) => {
  if (!campos.some((c) => e[c]) && !e.general) return e;
  const r = { ...e };
  for (const c of [...campos, 'general']) delete r[c];
  return r;
};

/* ==========================================================================
   Formulario de la convocatoria
   ========================================================================== */
type BorradorConvocatoria = {
  id?: string;
  curso: string;
  inicio: string;
  fin: string;
  horario: Record<string, Jornada>;
  ciudad: string;
  lugar: string;
  plazas: string;
  precio: string;
  moneda: Moneda;
  abierta: boolean;
  publicada: boolean;
};

const nuevaConvocatoria = (): BorradorConvocatoria => ({
  curso: CURSO_POR_DEFECTO.id,
  inicio: '',
  fin: '',
  horario: {},
  ciudad: '',
  lugar: '',
  plazas: '',
  precio: '',
  moneda: 'EUR',
  abierta: true,
  publicada: false,
});

const aBorrador = (c: Convocatoria): BorradorConvocatoria => ({
  id: c.id,
  curso: c.curso,
  inicio: c.inicio,
  fin: c.fin,
  horario: { ...c.horario },
  ciudad: c.ciudad,
  lugar: c.lugar,
  plazas: c.plazas === null ? '' : String(c.plazas),
  precio: c.precio === null ? '' : aTextoImporte(c.precio),
  moneda: c.moneda,
  abierta: c.abierta,
  publicada: c.publicada,
});

function FormConvocatoria({ inicial, ocupadas, alCerrar, alGuardar }: { inicial: BorradorConvocatoria; ocupadas: number; alCerrar: () => void; alGuardar: (c: Convocatoria) => void }) {
  const [b, setB] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const idWeb = useId();
  const hoy = hoyISO();
  const dias = diasEntre(b.inicio, b.fin || b.inicio).slice(0, 7);

  const poner = <K extends keyof BorradorConvocatoria>(k: K, v: BorradorConvocatoria[K]) => {
    setB((x) => ({ ...x, [k]: v }));
    setErrores((e) => sinError(e, k as string));
  };

  /* Al elegir el primer día se propone el último: la presencial son dos
     jornadas seguidas, así que casi siempre es el día siguiente. */
  const ponerInicio = (v: string) => {
    setB((x) => ({ ...x, inicio: v, fin: !x.fin || x.fin < v ? (v ? sumarDia(v, 1) : '') : x.fin }));
    setErrores((e) => sinError(e, 'inicio', 'fin'));
  };

  const ponerHora = (dia: string, lado: keyof Jornada, v: string) => {
    setB((x) => {
      const j = { desde: x.horario[dia]?.desde ?? '', hasta: x.horario[dia]?.hasta ?? '', [lado]: v };
      const horario = { ...x.horario };
      if (!j.desde && !j.hasta) delete horario[dia];
      else horario[dia] = j;
      return { ...x, horario };
    });
    setErrores((e) => sinError(e, `horario.${dia}`));
  };

  const guardar = async () => {
    const e: Record<string, string> = {};
    const precio = b.precio.trim() ? aCentimos(b.precio) : null;
    if (b.precio.trim() && precio === null) e.precio = 'Escríbelo solo con números, por ejemplo 1450 o 1.450,50.';
    if (!b.inicio) e.inicio = 'Elige el primer día.';
    if (b.ciudad.trim().length < 2) e.ciudad = 'Escribe la ciudad.';
    const plazas = b.plazas.trim() ? Number(b.plazas) : null;
    if (plazas !== null && (!Number.isInteger(plazas) || plazas < 1 || plazas > 500)) e.plazas = 'Entre 1 y 500, o en blanco si aún no lo sabes.';
    else if (plazas !== null && plazas < ocupadas) e.plazas = `Ya hay ${ocupadas} inscritas: no puede tener menos plazas.`;
    if (Object.keys(e).length) return setErrores(e);

    setGuardando(true);
    // Solo el horario de los días que tiene: si se acortan las fechas, el día que sobra no viaja.
    const horario = Object.fromEntries(dias.filter((d) => b.horario[d]).map((d) => [d, b.horario[d]]));
    const cuerpo = { ...b, fin: b.fin || b.inicio, horario, plazas, precio };
    const r = await pedir('/api/convocatorias', { method: b.id ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) });
    setGuardando(false);
    if (r.ok) return alGuardar(r.datos.convocatoria as Convocatoria);
    setErrores((r.datos.errores as Record<string, string> | undefined) ?? { general: explicar(r) });
  };

  const curso = cursoDe(b.curso);

  return (
    <Hoja
      titulo={b.id ? 'Editar convocatoria' : 'Nueva convocatoria'}
      subtitulo="Una fecha de la formación presencial, con sus plazas y su precio. Después apuntas a quien se inscriba."
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
          <span className={s.rotuloCampo}>Formación</span>
          {CURSOS_CONVOCABLES.length > 1 ? (
            <Segmentado nombre="curso" etiqueta="Formación" valor={b.curso} alCambiar={(v) => poner('curso', v)} opciones={CURSOS_CONVOCABLES.map((c) => ({ id: c.id, texto: c.nombre }))} />
          ) : (
            <p className={s.cursoFijo}>
              <span className={s.cursoFijoIcono}>
                <Icono d={I.pago} size={16} />
              </span>
              <span>
                <b>{curso.modalidad}</b> · {curso.nombre}
              </span>
            </p>
          )}
        </div>

        <Campo etiqueta="Primer día" error={errores.inicio}>
          {(p) => <input {...p} data-enfocar type="date" className={s.entrada} value={b.inicio} onChange={(e) => ponerInicio(e.target.value)} />}
        </Campo>
        <Campo etiqueta="Último día" error={errores.fin}>
          {(p) => <input {...p} type="date" className={s.entrada} value={b.fin} min={b.inicio || undefined} onChange={(e) => poner('fin', e.target.value)} />}
        </Campo>

        {dias.length > 0 && (
          <fieldset className={s.horario} data-ancho="entero">
            <legend className={s.rotuloCampo}>
              Horario <small>(opcional)</small>
            </legend>
            {dias.map((d) => (
              <div key={d} className={s.horarioDia}>
                <span className={s.horarioNombre}>
                  {capital(semanaCortaDe(d))} {diaDe(d)}
                </span>
                <input type="time" className={s.entrada} aria-label={`${capital(semanaDe(d))} ${diaDe(d)}: empieza`} value={b.horario[d]?.desde ?? ''} onChange={(e) => ponerHora(d, 'desde', e.target.value)} />
                <span className={s.horarioA} aria-hidden="true">
                  a
                </span>
                <input type="time" className={s.entrada} aria-label={`${capital(semanaDe(d))} ${diaDe(d)}: acaba`} value={b.horario[d]?.hasta ?? ''} onChange={(e) => ponerHora(d, 'hasta', e.target.value)} />
                {errores[`horario.${d}`] && <em className={s.error}>{errores[`horario.${d}`]}</em>}
              </div>
            ))}
          </fieldset>
        )}

        <Campo etiqueta="Ciudad" error={errores.ciudad}>
          {(p) => <input {...p} className={s.entrada} value={b.ciudad} onChange={(e) => poner('ciudad', e.target.value)} placeholder="Vigo" maxLength={80} autoComplete="off" />}
        </Campo>
        <Campo etiqueta="Lugar" opcional="no sale en la web" error={errores.lugar}>
          {(p) => <input {...p} className={s.entrada} value={b.lugar} onChange={(e) => poner('lugar', e.target.value)} placeholder="Centro, sala o calle" maxLength={160} autoComplete="off" />}
        </Campo>

        <Campo etiqueta="Plazas" opcional="en blanco: por definir" error={errores.plazas} ayuda={ocupadas ? `Ahora hay ${ocupadas} inscritas.` : undefined}>
          {(p) => <input {...p} type="number" inputMode="numeric" min={Math.max(1, ocupadas)} max={500} className={s.entrada} value={b.plazas} onChange={(e) => poner('plazas', e.target.value)} placeholder="Por definir" />}
        </Campo>
        <Campo etiqueta="Precio por plaza" opcional="en blanco: por definir" ayuda="Solo lo ves tú: nunca sale en la web." error={errores.precio}>
          {(p) => (
            <div className={s.importe}>
              <input {...p} inputMode="decimal" className={s.entrada} value={b.precio} onChange={(e) => poner('precio', e.target.value)} placeholder="Por definir" autoComplete="off" />
              <select className={s.moneda} aria-label="Moneda" value={b.moneda} onChange={(e) => poner('moneda', e.target.value as Moneda)}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m} title={NOMBRE_MONEDA[m]}>
                    {simbolo(m)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Campo>

        <div className={s.filaInterruptor} data-ancho="entero">
          <div>
            <p className={s.filaInterruptorTitulo}>Inscripciones abiertas</p>
            <p className={s.ayuda} id={`${idWeb}-abierta`}>
              Se puede apuntar gente. Cerradas, la web lo dice y deja de ofrecer plaza.
            </p>
          </div>
          <Interruptor encendido={b.abierta} alCambiar={(v) => poner('abierta', v)} etiqueta="Inscripciones abiertas" descrito={`${idWeb}-abierta`} />
        </div>
        <div className={s.filaInterruptor} data-ancho="entero">
          <div>
            <p className={s.filaInterruptorTitulo}>Mostrar en la web</p>
            <p className={s.ayuda} id={`${idWeb}-web`}>
              Sale en la página de formaciones con la ciudad, las fechas, el horario y si quedan plazas. Nunca el precio, el lugar ni los nombres.
              {b.inicio && b.inicio < hoy ? ' Esta fecha ya ha empezado: aunque lo marques, no saldrá.' : ''}
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
type Contactos = Contacto[] | 'cargando' | 'error' | null;

type BorradorInscrita = {
  id?: string;
  nombre: string;
  correo: string;
  /** No se pregunta: viene de Clientes si se eligió de ahí, y al editar se conserva. */
  telefono: string;
  pagado: string;
  estado: EstadoPago;
  /** Tampoco se pregunta: si ya tenía una nota de antes, se conserva tal cual. */
  nota: string;
  contacto: string | null;
};

const nuevaInscrita = (): BorradorInscrita => ({ nombre: '', correo: '', telefono: '', pagado: '', estado: 'pendiente', nota: '', contacto: null });

/* Lo que ha pagado, en las palabras de Sorela. Es lo que decide su acceso
   (con el abono, los PDF; con todo, también los vídeos) y lo que se cobra. */
const PAGOS: { id: EstadoPago; texto: string }[] = [
  { id: 'pendiente', texto: 'Nada todavía' },
  { id: 'senal', texto: 'El abono' },
  { id: 'pagado', texto: 'Todo' },
];

const FORMA_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Apuntar a alguien: solo lo imprescindible, sin nada opcional.
 *
 *   · Nombre: al escribirlo salen las de Clientes que encajan; al elegir una
 *     se rellena el resto solo. Si no está, se escribe y ya.
 *   · Correo: obligatorio. Sin él no se le puede dar acceso al curso, que es
 *     lo siguiente que se hace con una inscrita.
 *   · Qué ha pagado: nada, el abono o todo. El importe solo se pregunta
 *     cuando hace falta (el abono; y en «todo» viene puesto el precio).
 *
 * El móvil y la nota ya no se piden: el móvil está en su ficha de Clientes y
 * no hace falta para apuntarla ni para darle acceso; la nota era opcional.
 */
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
  contactos: Contactos;
  pedirContactos: () => void;
  alCerrar: () => void;
  alGuardar: (c: Convocatoria, nombre: string, aviso?: string) => void;
  alBorrar?: () => void;
}) {
  const [b, setB] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  /* Las de Clientes salen mientras escribe el nombre y se cierran al elegir. */
  const [sugerir, setSugerir] = useState(false);
  const { precio, moneda } = convocatoria;
  const id = useId();

  useEffect(() => {
    pedirContactos();
  }, [pedirContactos]);

  const poner = <K extends keyof BorradorInscrita>(k: K, v: BorradorInscrita[K]) => {
    setB((x) => ({ ...x, [k]: v }));
    setErrores((e) => sinError(e, k as string));
  };

  /* Nada = 0. Todo = el precio de la plaza, ya escrito (se cambia si hubo
     descuento). El abono, lo que diga Sorela: se deja en blanco para que no
     se cuele el precio entero como abono. */
  const ponerEstado = (estado: EstadoPago) => {
    setB((x) => ({
      ...x,
      estado,
      pagado:
        estado === 'pendiente'
          ? ''
          : estado === 'pagado'
            ? precio !== null && precio > 0
              ? aTextoImporte(precio)
              : x.estado === 'pagado'
                ? x.pagado
                : ''
            : x.estado === 'senal'
              ? x.pagado
              : '',
    }));
    setErrores((e) => sinError(e, 'pagado'));
  };

  /* Quién ya está en esta convocatoria, para no apuntarla dos veces sin querer. */
  const yaDentro = useMemo(() => {
    const ids = new Set<string>();
    for (const i of convocatoria.inscritas) {
      if (i.id === b.id) continue;
      if (i.contacto) ids.add(`c:${i.contacto}`);
      if (i.correo) ids.add(`m:${i.correo.toLowerCase()}`);
    }
    return ids;
  }, [convocatoria.inscritas, b.id]);

  const resultados = useMemo(() => {
    if (!sugerir || !Array.isArray(contactos)) return [];
    const q = plano(b.nombre.trim());
    if (q.length < 2) return [];
    return contactos.filter((c) => plano(`${c.nombre} ${c.correo} ${c.whatsapp}`).includes(q)).slice(0, 5);
  }, [contactos, b.nombre, sugerir]);

  const elegir = (c: Contacto) => {
    setB((x) => ({ ...x, nombre: c.nombre || x.nombre, correo: c.correo || x.correo, telefono: c.whatsapp || '', contacto: c.id }));
    setErrores({});
    setSugerir(false);
  };

  const guardar = async () => {
    const e: Record<string, string> = {};
    const correo = b.correo.trim().toLowerCase();
    const pagado = b.estado === 'pendiente' ? 0 : aCentimos(b.pagado);
    if (b.nombre.trim().length < 2) e.nombre = 'Escribe su nombre.';
    if (!correo) e.correo = 'Escribe su correo: con él se le da acceso al curso.';
    else if (!FORMA_CORREO.test(correo)) e.correo = 'Ese correo no tiene forma de correo.';
    else if (yaDentro.has(`m:${correo}`)) e.correo = 'Ya está apuntada en estas fechas.';
    if (b.estado !== 'pendiente') {
      if (pagado === null || pagado <= 0) e.pagado = b.estado === 'senal' ? 'Escribe cuánto ha dejado, solo con números: 400.' : 'Escribe cuánto ha pagado, solo con números: 900.';
      else if (b.estado === 'senal' && precio !== null && precio > 0 && pagado >= precio) e.pagado = 'Eso ya es la plaza entera: elige «Todo».';
    }
    if (Object.keys(e).length) return setErrores(e);
    setGuardando(true);
    const cuerpo = { convocatoria: convocatoria.id, id: b.id, nombre: b.nombre, correo, telefono: b.telefono, pagado, estado: b.estado, nota: b.nota, contacto: b.contacto };
    const r = await pedir('/api/convocatorias/inscritas', { method: b.id ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) });
    setGuardando(false);
    if (r.ok) return alGuardar(r.datos.convocatoria as Convocatoria, b.nombre.trim(), r.datos.aviso as string | undefined);
    setErrores((r.datos.errores as Record<string, string> | undefined) ?? { general: explicar(r) });
  };

  const pagadoCent = aCentimos(b.pagado) ?? 0;
  const falta = precio === null ? 0 : Math.max(precio - pagadoCent, 0);
  const describeNombre = errores.nombre ? `${id}-ne` : undefined;

  return (
    <Hoja
      titulo={b.id ? 'Editar inscrita' : 'Apuntar a alguien'}
      subtitulo={`${cursoDe(convocatoria.curso).modalidad} · ${convocatoria.ciudad} · ${rangoFechas(convocatoria.inicio, convocatoria.fin)}`}
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
        {/* ---------- Nombre, con las de Clientes debajo mientras escribe ---------- */}
        <div className={s.campo} data-ancho="entero">
          <label htmlFor={`${id}-n`} className={s.rotuloCampo}>
            Nombre
          </label>
          <input
            id={`${id}-n`}
            data-enfocar
            className={s.entrada}
            value={b.nombre}
            onChange={(e) => {
              poner('nombre', e.target.value);
              setSugerir(true);
            }}
            placeholder="Nombre y apellido"
            maxLength={80}
            autoComplete="off"
            aria-invalid={errores.nombre ? true : undefined}
            aria-describedby={describeNombre}
          />
          <div aria-live="polite">
            {resultados.length > 0 && (
              <ul className={s.listaResultados} aria-label="Coinciden en Clientes">
                {resultados.map((c) => {
                  const dentro = yaDentro.has(`c:${c.id}`) || (!!c.correo && yaDentro.has(`m:${c.correo.toLowerCase()}`));
                  return (
                    <li key={c.id}>
                      <button type="button" className={s.resultado} onClick={() => elegir(c)} disabled={dentro}>
                        <span className={s.avatar} aria-hidden="true">
                          {iniciales(c.nombre)}
                        </span>
                        <span className={s.resultadoTexto}>
                          <b>{c.nombre || 'Sin nombre'}</b>
                          <span>{c.correo || 'Sin correo'}</span>
                        </span>
                        <span className={s.resultadoAccion}>{dentro ? 'Ya está apuntada' : 'Elegir'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {b.contacto && (
            <div className={s.enlazada}>
              <span className={s.enlazadaIcono}>
                <Icono d={I.enlace} size={15} />
              </span>
              <span className={s.enlazadaTexto}>
                Elegida de <b>Clientes</b>.
              </span>
              <button type="button" className={s.enlaceTexto} onClick={() => poner('contacto', null)}>
                Quitar
              </button>
            </div>
          )}
          {errores.nombre && (
            <em id={`${id}-ne`} className={s.error}>
              {errores.nombre}
            </em>
          )}
        </div>

        <Campo etiqueta="Correo" error={errores.correo} ancho="entero">
          {(p) => <input {...p} type="email" inputMode="email" className={s.entrada} value={b.correo} onChange={(e) => poner('correo', e.target.value)} placeholder="nombre@correo.com" maxLength={160} autoComplete="off" />}
        </Campo>

        {/* ---------- Lo que ha pagado: tres respuestas, y el importe solo si hace falta ---------- */}
        <div className={s.campo} data-ancho="entero">
          <span className={s.rotuloCampo}>¿Qué ha pagado?</span>
          <Segmentado nombre="estado-pago" etiqueta="Qué ha pagado" valor={b.estado} alCambiar={ponerEstado} opciones={PAGOS} />
        </div>
        {b.estado !== 'pendiente' && (
          <Campo
            etiqueta={b.estado === 'senal' ? '¿Cuánto ha dejado?' : '¿Cuánto ha pagado?'}
            error={errores.pagado}
            ancho="entero"
            ayuda={
              precio === null
                ? 'El precio de la plaza está por definir.'
                : b.estado === 'pagado'
                  ? `La plaza entera, ${dinero(precio, moneda)}. Cámbialo si le hiciste descuento.`
                  : falta > 0 && pagadoCent > 0
                    ? `La plaza cuesta ${dinero(precio, moneda)}: le faltarán ${dinero(falta, moneda)}.`
                    : `La plaza cuesta ${dinero(precio, moneda)}.`
            }
          >
            {(p) => (
              <div className={s.importe}>
                <input {...p} inputMode="decimal" className={s.entrada} value={b.pagado} onChange={(e) => poner('pagado', e.target.value)} placeholder={b.estado === 'senal' ? '400' : '0'} autoComplete="off" />
                <span className={s.monedaFija}>{simbolo(moneda)}</span>
              </div>
            )}
          </Campo>
        )}

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
   Acceso al curso: el enlace y la confirmación de cuenta
   ========================================================================== */
type HojaAcceso =
  | { tipo: 'enlace'; conv: Convocatoria; inscrita: Inscrita; enlace: string; nuevo: boolean; correo: string | null };

/** El mensaje de WhatsApp: el curso con su nombre, que es lo único que abre. */
function mensajeWhatsapp(nombre: string, curso: string, enlace: string, caduca: string | null) {
  const pila = nombre.trim().split(/\s+/)[0];
  const hasta = caduca ? ` Sirve una sola vez y caduca el ${new Date(caduca).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.` : ' Sirve una sola vez.';
  return `${pila ? `¡Hola ${pila}! ` : '¡Hola! '}Aquí tienes tu acceso al curso ${curso} en la plataforma: entra en este enlace, crea tu contraseña y verás sus clases y su material.${hasta} ${enlace}`;
}

function HojaEnlace({ h, alCerrar, avisar }: { h: Extract<HojaAcceso, { tipo: 'enlace' }>; alCerrar: () => void; avisar: (t: string, tipo?: 'error' | 'hecho') => void }) {
  const curso = cursoDe(h.conv.curso);
  const caduca = h.inscrita.acceso.caduca;
  const texto = mensajeWhatsapp(h.inscrita.nombre, curso.nombre, h.enlace, caduca);
  const digitos = h.inscrita.telefono.replace(/\D/g, '');
  const whatsapp = `https://wa.me/${digitos.length >= 8 ? digitos : ''}?text=${encodeURIComponent(texto)}`;
  const campo = useRef<HTMLInputElement>(null);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(h.enlace);
      avisar('Enlace copiado.', 'hecho');
    } catch {
      // Sin permiso para el portapapeles: se deja seleccionado para copiarlo a mano.
      campo.current?.select();
      avisar('No he podido copiarlo solo: está seleccionado, cópialo tú.');
    }
  };

  return (
    <Hoja
      estrecha
      titulo={h.nuevo ? 'Enlace de acceso creado' : 'Su enlace de acceso'}
      subtitulo={`Para ${h.inscrita.nombre}`}
      alCerrar={alCerrar}
      pie={
        <button type="button" className={s.botonPrimario} onClick={alCerrar}>
          Hecho
        </button>
      }
    >
      <div className={s.acceso}>
        <p className={s.accesoQue}>
          <span className={s.accesoIcono}>
            <Icono d={I.aula} size={18} />
          </span>
          <span>
            <b>Acceso al curso · {curso.nombre}</b>
            <span>Sus clases y su material en el aula.</span>
          </span>
        </p>
        <p className={s.sinMembresia}>
          <Icono d={I.membresia} size={15} />
          No incluye la membresía de la Comunidad Divine.
        </p>

        <label className={s.rotuloCampo} htmlFor="enlace-acceso">
          Enlace de un solo uso
        </label>
        <input id="enlace-acceso" ref={campo} className={s.entrada} value={h.enlace} readOnly onFocus={(e) => e.target.select()} data-enfocar />
        <div className={s.accesoBotones}>
          <button type="button" className={s.botonSecundario} onClick={copiar}>
            <Icono d={I.copiar} size={16} />
            Copiar
          </button>
          <a className={s.botonWhatsapp} href={whatsapp} target="_blank" rel="noopener noreferrer">
            <IconoWhatsapp />
            WhatsApp
          </a>
        </div>
        <p className={s.ayuda}>
          Al abrirlo se crea su cuenta con su contraseña y entra ya con el curso.
          {caduca ? ` Caduca el ${new Date(caduca).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.` : ''}
          {/* No se dice que le haya llegado por correo: ese envío sale después
              de contestar y puede no salir (automatización apagada o fallo).
              Lo seguro es lo que hay en pantalla: Copiar o WhatsApp. */}
          {h.correo ? ` Solo vale con ${h.correo}.` : ''}
        </p>
      </div>
    </Hoja>
  );
}

function BarraPlazas({ c }: { c: Convocatoria }) {
  const r = resumen(c);
  const reducir = useReducedMotion();
  if (c.plazas === null) return null;
  const total = c.plazas;
  return (
    <div
      className={s.barra}
      role="img"
      aria-label={`${r.ocupadas} de ${total} plazas ocupadas: ${plural(r.porEstado.pagado, 'pagada', 'pagadas')}, ${r.porEstado.senal} con abono, ${plural(r.porEstado.pendiente, 'pendiente', 'pendientes')} y ${plural(r.libres ?? 0, 'libre', 'libres')}.`}
    >
      {ESTADOS_PAGO.map(
        (e) =>
          r.porEstado[e] > 0 && (
            <motion.span
              key={e}
              className={s.tramo}
              data-estado={e}
              initial={reducir ? false : { width: 0 }}
              animate={{ width: `${(r.porEstado[e] / total) * 100}%` }}
              transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 26 }}
            />
          )
      )}
    </div>
  );
}

/**
 * El acceso al curso de una inscrita, solo para verlo: se da en Cuentas ›
 * Dar acceso, el único sitio donde se da. Si ya tiene un enlace sin usar, se
 * puede volver a ver para copiarlo.
 */
function AccesoFila({ i, alVer }: { i: Inscrita; alVer: () => void }) {
  const e = i.acceso.estado;
  return (
    <span className={s.accesoFila} data-estado={e}>
      <span className={s.accesoChip} data-estado={e}>
        <Icono d={e === 'ya-tiene-cuenta' ? I.hecho : I.aula} size={13} />
        {ETIQUETA_ACCESO_CURSO[e]}
      </span>
      {e === 'enlace-sin-usar' && i.acceso.enlace && (
        <button type="button" className={s.enlaceTexto} onClick={alVer}>
          Ver enlace
        </button>
      )}
    </span>
  );
}

function TarjetaConvocatoria({
  c,
  hoy,
  abierta,
  alAbrir,
  alEditar,
  alBorrar,
  alCambiar,
  alApuntar,
  alEditarInscrita,
  alBorrarInscrita,
  alVerEnlace,
}: {
  c: Convocatoria;
  hoy: string;
  abierta: boolean;
  alAbrir: () => void;
  alEditar: () => void;
  alBorrar: () => void;
  alCambiar: (cambio: { publicada?: boolean; abierta?: boolean }) => void;
  alApuntar: () => void;
  alEditarInscrita: (i: Inscrita) => void;
  alBorrarInscrita: (i: Inscrita) => void;
  alVerEnlace: (i: Inscrita) => void;
}) {
  const reducir = useReducedMotion();
  const id = useId();
  const r = resumen(c);
  const curso = cursoDe(c.curso);
  const hoja = hojaDe(c.inicio, c.fin);
  const pasada = c.fin < hoy;
  const empezada = c.inicio < hoy;
  const llena = r.libres === 0;
  const horario = lineasHorario(c);

  const estadoWeb = !c.publicada ? 'Solo la ves tú' : empezada ? 'Ya empezó: ya no sale en la web' : `En la web · ${ETIQUETA_PLAZAS[estadoPlazas(c.plazas, r.ocupadas, c.abierta)]}`;

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
      {/* ---------- Cuándo, qué y dónde ---------- */}
      <header className={s.tarjetaCabeza}>
        <div className={s.hojaCal} aria-hidden="true">
          <span className={s.hojaMes}>{hoja.mes}</span>
          <span className={s.hojaDias}>{hoja.dias}</span>
          <span className={s.hojaAno}>{hoja.ano}</span>
        </div>
        <div className={s.tarjetaTitulos}>
          <p className={s.tarjetaCurso}>
            <Icono d={I.pago} size={14} />
            {curso.modalidad}
            {/* En móvil el nombre del curso partía el rótulo en tres líneas
                y empujaba la ciudad, que es lo que se busca primero. Ya está
                en las tarjetas de arriba, así que ahí se queda solo el tipo. */}
            <span className={s.tarjetaCursoNombre}> · {curso.nombre}</span>
          </p>
          <h3 className={s.tarjetaCiudad}>{c.ciudad}</h3>
          <p className={s.tarjetaFechas}>
            <span className={s.sinCortar}>{capital(rangoFechas(c.inicio, c.fin))}</span>
            <span aria-hidden="true"> · </span>
            <span className={s.sinCortar}>{diasDeLaSemana(c.inicio, c.fin)}</span>
          </p>
          {horario.length > 0 && (
            <ul className={s.horas}>
              {horario.map((h) => (
                <li key={h}>{capital(h)}</li>
              ))}
            </ul>
          )}
          <p className={s.tarjetaMeta}>
            <span className={s.cuando} data-pasada={pasada || undefined}>
              {cuandoEs(c, hoy)}
            </span>
            {c.lugar && <span className={s.lugar}>{c.lugar}</span>}
          </p>
        </div>
        <div className={s.tarjetaAcciones}>
          <button type="button" className={s.botonIcono} onClick={alEditar} aria-label={`Editar la convocatoria de ${c.ciudad}`}>
            <Icono d={I.lapiz} size={17} />
          </button>
          <button type="button" className={s.botonIcono} data-peligro onClick={alBorrar} aria-label={`Borrar la convocatoria de ${c.ciudad}`}>
            <Icono d={I.papelera} size={17} />
          </button>
        </div>
      </header>

      {/* ---------- Los dos interruptores ---------- */}
      <div className={s.interruptores}>
        <span className={s.interruptorFila}>
          <span className={s.interruptorTexto} id={`${id}-ab`}>
            <b>Inscripciones</b>
            <span>{c.abierta ? 'Abiertas' : 'Cerradas'}</span>
          </span>
          <Interruptor encendido={c.abierta} alCambiar={(v) => alCambiar({ abierta: v })} etiqueta="Inscripciones abiertas" descrito={`${id}-ab`} />
        </span>
        <span className={s.interruptorFila} data-en-web={(c.publicada && !empezada) || undefined}>
          <span className={s.interruptorTexto} id={`${id}-web`}>
            <b>Mostrar en la web</b>
            <span>
              <span className={s.webPunto} aria-hidden="true" />
              {estadoWeb}
            </span>
          </span>
          <Interruptor encendido={c.publicada} alCambiar={(v) => alCambiar({ publicada: v })} etiqueta="Mostrar en la web" descrito={`${id}-web`} />
        </span>
      </div>

      {/* ---------- Las tres cifras ---------- */}
      <div className={s.cifras}>
        <div className={s.cifra} data-ancha>
          <span className={s.cifraRotulo}>Plazas</span>
          {c.plazas === null ? (
            <>
              <span className={s.cifraValor}>
                {r.ocupadas}
                <small> {r.ocupadas === 1 ? 'apuntada' : 'apuntadas'}</small>
              </span>
              <span className={s.cifraNota}>Plazas por definir</span>
            </>
          ) : (
            <>
              <span className={s.cifraValor}>
                {r.ocupadas}
                <small> de {c.plazas}</small>
              </span>
              <BarraPlazas c={c} />
            </>
          )}
          <span className={s.leyenda}>
            <span data-estado="pagado">{plural(r.porEstado.pagado, 'pagada', 'pagadas')}</span>
            <span data-estado="senal">{r.porEstado.senal} con abono</span>
            <span data-estado="pendiente">{plural(r.porEstado.pendiente, 'pendiente', 'pendientes')}</span>
            {c.plazas !== null && <span data-estado="libre">{llena ? 'Completa' : plural(r.libres ?? 0, 'libre', 'libres')}</span>}
          </span>
        </div>
        <div className={s.cifra}>
          <span className={s.cifraRotulo}>Cobrado</span>
          <span className={s.cifraValor}>{dinero(r.cobrado, c.moneda)}</span>
          <span className={s.cifraNota}>{c.precio === null ? 'Precio por definir' : `Plaza a ${dinero(c.precio, c.moneda)}`}</span>
        </div>
        <div className={s.cifra} data-alerta={(r.porCobrar ?? 0) > 0 || undefined}>
          <span className={s.cifraRotulo}>Por cobrar</span>
          <span className={s.cifraValor}>{r.porCobrar === null ? 'Por definir' : dinero(r.porCobrar, c.moneda)}</span>
          <span className={s.cifraNota}>
            {r.deben.length === 0 ? (r.ocupadas ? 'Todas han pagado' : 'Nadie apuntada todavía') : `${r.deben.length} ${r.deben.length === 1 ? 'persona' : 'personas'} sin pagar del todo`}
          </span>
        </div>
      </div>

      {/* ---------- Quién falta por pagar ---------- */}
      {r.deben.length > 0 && (
        <div className={s.faltan}>
          <p className={s.faltanTitulo}>Falta por pagar</p>
          <ul className={s.faltanLista}>
            {r.deben.map(({ inscrita: i, debe }) => (
              <li key={i.id}>
                <button type="button" className={s.deudora} onClick={() => alEditarInscrita(i)} aria-label={`${i.nombre}: ${ETIQUETA_PAGO[i.estado]}${debe !== null ? `, le faltan ${dinero(debe, c.moneda)}` : ''}. Abrir para apuntar el pago.`}>
                  <span className={s.deudoraPunto} data-estado={i.estado} aria-hidden="true" />
                  <span className={s.deudoraNombre}>{i.nombre}</span>
                  {debe !== null && <span className={s.deudoraDebe}>{dinero(debe, c.moneda)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Las inscritas ---------- */}
      <div className={s.inscritasCabeza}>
        <button type="button" className={s.desplegar} aria-expanded={abierta} aria-controls={`${id}-lista`} onClick={alAbrir}>
          <span className={s.desplegarFlecha} data-abierta={abierta || undefined}>
            <Icono d={I.flecha} size={15} />
          </span>
          Inscritas <span className={s.contador}>{r.ocupadas}</span>
        </button>
        <button type="button" className={s.botonSecundario} data-pequeno onClick={alApuntar} disabled={llena} title={llena ? 'Está completa: sube las plazas para apuntar a alguien más.' : undefined}>
          <Icono d={I.mas} size={15} />
          {llena ? 'Completa' : 'Apuntar a alguien'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            id={`${id}-lista`}
            className={s.inscritasCaja}
            initial={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reducir ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 38 }}
          >
            {c.inscritas.length === 0 ? (
              <p className={s.inscritasVacio}>
                Nadie apuntada todavía. Pulsa <b>Apuntar a alguien</b>.
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
                      <span>{[i.correo, i.telefono].filter(Boolean).join(' · ') || 'Sin correo ni móvil'}</span>
                      {i.nota && <span className={s.inscritaNota}>{i.nota}</span>}
                    </span>
                    <span className={s.inscritaPago}>
                      <span className={s.inscritaImporte}>{dinero(i.pagado, c.moneda)}</span>
                      <PildoraPago estado={i.estado} />
                    </span>
                    <AccesoFila i={i} alVer={() => alVerEnlace(i)} />
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
  const [hojaAcceso, setHojaAcceso] = useState<HojaAcceso | null>(null);
  const [contactos, setContactos] = useState<Contactos>(null);
  const contactosPedidos = useRef(false);
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
    setLista((l) => [...l.filter((x) => x.id !== c.id), c].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.ciudad.localeCompare(b.ciudad, 'es')));
  }, []);

  /* Clientes se pide solo la primera vez que se abre el buscador, y una vez. */
  const pedirContactos = useCallback(() => {
    if (contactosPedidos.current) return;
    contactosPedidos.current = true;
    setContactos('cargando');
    pedir('/api/contactos').then((r) => {
      if (!r.ok) {
        contactosPedidos.current = false;
        return setContactos('error');
      }
      const crudos = (r.datos.contactos as Record<string, unknown>[]) ?? [];
      setContactos(
        crudos
          .filter((c) => c.estado !== 'Descartado')
          .map((c) => ({ id: String(c.id ?? ''), nombre: String(c.nombre ?? ''), correo: String(c.correo ?? ''), whatsapp: String(c.whatsapp ?? ''), ciudad: String(c.ciudad ?? ''), tipo: String(c.tipo ?? '') }))
      );
    });
  }, []);

  const proximas = useMemo(() => lista.filter((c) => c.fin >= hoy), [lista, hoy]);
  const pasadas = useMemo(() => lista.filter((c) => c.fin < hoy).reverse(), [lista, hoy]);
  const vistas = pestana === 'pasadas' && pasadas.length ? pasadas : proximas;
  const hayEnLaWeb = proximas.some((c) => c.publicada && c.inicio >= hoy);
  /* Con una sola convocatoria a la vista, sus inscritas salen abiertas: es lo
     que se viene a mirar. Con varias, cerradas, para verlas todas de un golpe. */
  const estaAbierta = (id: string) => abiertas[id] ?? vistas.length === 1;

  /* ---------- Acciones ---------- */
  const cambiarInterruptor = async (c: Convocatoria, cambio: { publicada?: boolean; abierta?: boolean }) => {
    poner({ ...c, ...cambio });
    const r = await pedir('/api/convocatorias', { method: 'PATCH', body: JSON.stringify({ id: c.id, ...cambio }) });
    if (!r.ok) {
      poner(c);
      avisar(explicar(r));
      if (r.datos.motivo === 'no-existe') cargar();
      return;
    }
    poner(r.datos.convocatoria as Convocatoria);
    if (cambio.publicada !== undefined) {
      avisar(cambio.publicada ? (c.inicio >= hoy ? 'Ya sale en la web, en la página de formaciones.' : 'Marcada, pero como ya empezó no saldrá en la web.') : 'Quitada de la web.', 'hecho');
    } else avisar(cambio.abierta ? 'Inscripciones abiertas.' : 'Inscripciones cerradas: la web ya no ofrece plaza.', 'hecho');
  };

  const borrarConvocatoria = async (c: Convocatoria) => {
    const n = c.inscritas.length;
    const enlaces = c.inscritas.filter((i) => i.acceso.estado === 'enlace-sin-usar').length;
    const si = await confirmar({
      titulo: `¿Borrar la convocatoria de ${c.ciudad}?`,
      texto: `${capital(rangoFechas(c.inicio, c.fin))}. ${n ? `Se borran también sus ${n} ${n === 1 ? 'inscrita' : 'inscritas'} con todo lo apuntado de sus pagos. ` : ''}${enlaces ? `Sus ${enlaces === 1 ? 'enlace de acceso sin usar deja' : `${enlaces} enlaces de acceso sin usar dejan`} de valer. ` : ''}${c.publicada ? 'Desaparece de la web. ' : ''}Los accesos al curso ya dados y los contactos de Clientes no se tocan. No se puede deshacer.`,
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
    const enlace = i.acceso.estado === 'enlace-sin-usar';
    const si = await confirmar({
      titulo: `¿Quitar a ${i.nombre}?`,
      texto: `Sale de esta convocatoria y se pierde lo apuntado de su pago${i.pagado ? ` (${dinero(i.pagado, c.moneda)})` : ''}. Su plaza queda libre.${enlace ? ' Su enlace de acceso sin usar deja de valer.' : ''}${i.acceso.estado === 'ya-tiene-cuenta' ? ' El acceso al curso que ya tiene se queda: se quita en Cuentas si hace falta.' : ''} Su contacto de Clientes no se toca. No se puede deshacer.`,
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

  const verEnlace = (c: Convocatoria, i: Inscrita) => {
    if (i.acceso.enlace) setHojaAcceso({ tipo: 'enlace', conv: c, inscrita: i, enlace: i.acceso.enlace, nuevo: false, correo: i.correo || null });
  };

  const abrirInscrita = (c: Convocatoria, i: Inscrita) =>
    setFormIns({
      conv: c.id,
      borrador: { id: i.id, nombre: i.nombre, correo: i.correo, telefono: i.telefono, pagado: i.pagado ? aTextoImporte(i.pagado) : '', estado: i.estado, nota: i.nota, contacto: i.contacto },
    });

  const convDeForm = formIns ? lista.find((c) => c.id === formIns.conv) : undefined;
  const nueva = () => setFormConv({ borrador: nuevaConvocatoria(), ocupadas: 0 });

  /* ---------- Pintar ---------- */
  return (
    <div className={s.pantalla}>
      <div className={s.cabeza}>
        <p className={s.intro}>Aquí apuntas cada fecha que abres de la formación presencial: sus plazas, quién se ha apuntado y quién te ha pagado.</p>
        {estado === 'listo' && lista.length > 0 && (
          <div className={s.cabezaAcciones}>
            {hayEnLaWeb && (
              <a href="/formaciones#proximas-fechas" target="_blank" rel="noopener" className={s.enlaceTexto}>
                Ver en la web
                <Icono d={I.fuera} size={14} />
              </a>
            )}
            <button type="button" className={s.botonPrimario} onClick={nueva}>
              <Icono d={I.mas} size={16} />
              Nueva convocatoria
            </button>
          </div>
        )}
      </div>

      {estado === 'cargando' && (
        <div className={s.esqueletos} aria-busy="true" aria-label="Cargando convocatorias">
          <div className={s.esqueleto} />
          <div className={s.esqueleto} />
        </div>
      )}

      {(estado === 'error' || estado === 'sin-configurar') && (
        <div className={s.vacio} role="alert">
          <p className={s.vacioTitulo}>No he podido cargar las convocatorias</p>
          <p className={s.vacioTexto}>{estado === 'sin-configurar' ? 'La base de datos no está conectada en este entorno.' : 'Puede ser la conexión. Prueba otra vez en un momento.'}</p>
          {estado === 'error' && (
            <button
              type="button"
              className={s.botonSecundario}
              onClick={() => {
                setEstado('cargando');
                cargar();
              }}
            >
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
          <p className={s.vacioTexto}>Cuando cierres una fecha, créala aquí con su ciudad. Las plazas y el precio pueden quedar por definir. Después apuntas a quien se inscriba y lo que te ha pagado.</p>
          <button type="button" className={s.botonPrimario} onClick={nueva}>
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
                    alCambiar={(cambio) => cambiarInterruptor(c, cambio)}
                    alApuntar={() => setFormIns({ conv: c.id, borrador: nuevaInscrita() })}
                    alEditarInscrita={(i) => abrirInscrita(c, i)}
                    alBorrarInscrita={(i) => borrarInscrita(c, i)}
                    alVerEnlace={(i) => verEnlace(c, i)}
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
              const esNueva = !formConv.borrador.id;
              poner(c);
              setFormConv(null);
              if (esNueva) {
                setPestana('proximas');
                setAbiertas((a) => ({ ...a, [c.id]: true }));
              }
              avisar(esNueva ? 'Convocatoria creada. Ya puedes apuntar a quien se inscriba.' : 'Cambios guardados.', 'hecho');
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
            alGuardar={(c, nombre, avisoServidor) => {
              const esNueva = !formIns.borrador.id;
              poner(c);
              setFormIns(null);
              setAbiertas((a) => ({ ...a, [c.id]: true }));
              avisar(
                avisoServidor === 'enlace-anulado'
                  ? 'Guardado. Como ha cambiado su correo, su enlace de acceso anterior ya no vale: crea otro en Cuentas › Dar acceso.'
                  : esNueva
                    ? `${nombre} apuntada. Para que vea el precurso, dale acceso en Cuentas › Dar acceso.`
                    : 'Guardado.',
                'hecho'
              );
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
        {hojaAcceso?.tipo === 'enlace' && <HojaEnlace key="enlace" h={hojaAcceso} alCerrar={() => setHojaAcceso(null)} avisar={avisar} />}
      </AnimatePresence>

      {dialogo}
      {aviso}
    </div>
  );
}
