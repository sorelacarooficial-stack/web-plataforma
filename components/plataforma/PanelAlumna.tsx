'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as TeclaReact } from 'react';
import { MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { minutos, porBloques, type Leccion, type Progreso } from '@/lib/aula';
import { tieneMembresia, type Acceso } from '@/lib/accesos';
import type { Vista } from '@/lib/plataforma';
import type { ProximaClase, Publicacion } from '@/lib/comunidad-tipos';
import Noticias from './Noticias';
import { PUNTOS, calcularPuntos, formatoPuntos, nivelDe, type ResumenPuntos } from '@/lib/puntos-tipos';
import { LOGROS, OROS_PARA_DIVINE, type EstadoLogro } from '@/lib/logros-tipos';
import type { Lectura } from '@/lib/material';
import { irA } from '@/lib/navegar';
import {
  BarraNivel,
  CaminoNiveles,
  ContadorPuntos,
  DesglosePuntos,
  abrirComoFunciona,
  useDesdeUnaVez,
  useRacha,
  useResumenPuntos,
  useTrofeos,
  type Racha,
} from './Puntos';
import { VitrinaMini, trofeosDeMuestra } from './Logros';
import { CLAVE_VISTO } from './ComoFunciona';
import { Icono, InsigniaNivel, type NombreIcono } from './IconosDivine';
import p from './panelalumna.module.css';

/**
 * El inicio de quien tiene algo contratado: su panel.
 *
 * Arriba, el saludo con su racha de días y SU PRÓXIMA MISIÓN: la siguiente
 * cosa que más le da y más cerca tiene («Termina esta clase: +50 pts y subes
 * a Manos despiertas»), con lo que avanzaría su barra si la hace y un botón
 * que la lleva allí. Debajo, TU CAMINO: la ruta entera de dónde está y qué le
 * toca, paso a paso (hecho, ahora, después o bloqueado), con lo que da cada
 * paso; se toca uno y cuenta qué es y lleva a hacerlo. Quien tiene el curso ve
 * el de la formación; quien tiene la Comunidad, el de la comunidad; con las
 * dos, elige. Después su nivel (insignia, barra, camino de niveles, trofeos y
 * de dónde vienen sus puntos) con «¿Cómo funciona?», y lo de siempre: clases,
 * material, agenda y comunidad.
 *
 * Nada se inventa: todo sale de lo que ya existe. Los puntos y los trofeos,
 * de los avisos de la Celebración (/api/logros); las clases, de /api/lecciones
 * y /api/progreso; la presencial, de /api/agenda (las fechas `formacion-…`);
 * lo que lleva leído del precurso, de /api/material (lo apunta el lector del
 * aula). Las cifras de puntos y niveles, siempre de lib/puntos-tipos.ts.
 *
 * La formación es la del CURSO (curso ≠ membresía): sus trofeos, el
 * certificado y el «x de y» cuentan solo las clases del curso que tiene
 * abiertas, igual que lib/logros.ts. Las de la Comunidad suman sus puntos,
 * nada más.
 *
 * Es el panel de quien aprende: Sorela tiene el suyo (PanelSorela) y aquí
 * solo entra mirando «Ver como», con puntos, trofeos y racha de MUESTRA, nunca
 * los suyos (ella no compite), y sin botones que abran cosas suyas.
 */

type Evento = { id: string; titulo: string; cuando: string | null; tipo: string; estado: string; lugar?: string };
type Doc = { id: string; titulo: string; subtitulo: string; paginas: number; portadaUrl: string };

/* Lo que ve Sorela en «Ver como»: los puntos de una alumna de muestra, no los
   suyos (que no son de alumna). Fijos, para que la pantalla se entienda. */
const TROFEOS_DE_MUESTRA = trofeosDeMuestra();
const PUNTOS_DE_MUESTRA: ResumenPuntos = (() => {
  const c = calcularPuntos({
    clases: 4,
    cursoCompleto: false,
    publicaciones: 0,
    respuestas: 0,
    meGusta: 0,
    dias: 9,
    mejorRacha: 3,
    // Los mismos trofeos que enseña su vitrina de muestra: así las cifras cuadran entre sí.
    logros: TROFEOS_DE_MUESTRA.filter((t) => t.conseguido).length,
    perfilCompleto: true,
    fotos: 2,
    recorrido: true,
  });
  return { ...c, nivel: nivelDe(c.total), antes: null, subioNivel: false };
})();
const RACHA_DE_MUESTRA: Racha = { actual: 3, mejor: 3 };

const saludo = (ahora: Date) => {
  const h = ahora.getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
};
const HOY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const DIA = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const DIA_CORTO = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const DIA_SEMANA = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const minus = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const plural = (n: number, uno: string, varios: string) => `${formatoPuntos(n)} ${n === 1 ? uno : varios}`;
const nombreLogro = (id: string) => LOGROS.find((l) => l.id === id)?.nombre ?? '';
const EASE = [0.22, 1, 0.36, 1] as const;

function Anillo({ valor, bloqueado = false }: { valor: number; bloqueado?: boolean }) {
  const reducir = useReducedMotion();
  const r = 46;
  const cc = 2 * Math.PI * r;
  // La cifra del centro cuenta a la vez que se llena el anillo.
  const mv = useMotionValue(0);
  const texto = useTransform(mv, (v) => `${Math.round(v)}%`);
  useEffect(() => {
    if (reducir) {
      mv.set(valor);
      return;
    }
    const ctrl = animate(mv, valor, { duration: 1.2, ease: EASE, delay: 0.2 });
    return () => ctrl.stop();
  }, [valor, reducir, mv]);
  return (
    <svg viewBox="0 0 110 110" className={p.anillo} aria-hidden="true">
      <circle cx="55" cy="55" r={r} className={p.anilloFondo} />
      <motion.circle
        cx="55"
        cy="55"
        r={r}
        className={p.anilloValor}
        strokeDasharray={cc}
        initial={{ strokeDashoffset: reducir ? cc * (1 - valor / 100) : cc }}
        animate={{ strokeDashoffset: cc * (1 - valor / 100) }}
        transition={{ duration: 1.2, ease: EASE, delay: 0.2 }}
      />
      {bloqueado ? (
        // El candado de sus clases, del mismo trazo que los de la lista.
        <svg x="39" y="38" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={p.anilloCandado}>
          <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
          <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
        </svg>
      ) : (
        <motion.text x="55" y="60" textAnchor="middle" className={p.anilloNumero}>
          {texto}
        </motion.text>
      )}
    </svg>
  );
}

const aparecer = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.5, ease: EASE },
});

/* ==========================================================================
   Tu camino y tu próxima misión: qué se ha hecho y qué toca
   ========================================================================== */

/** Los dibujos de los pasos: los de IconosDivine y el libro del precurso, en su mismo trazo. */
type Glifo = NombreIcono | 'libro';

function GlifoPaso({ g, size = 20 }: { g: Glifo; size?: number }) {
  if (g !== 'libro') return <Icono nombre={g} size={size} />;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 6.6c-1.9-1.4-4.4-2-7.8-2v13c3.4 0 5.9.6 7.8 2 1.9-1.4 4.4-2 7.8-2v-13c-3.4 0-5.9.6-7.8 2z" />
      <path d="M12 6.6v13" />
      <path d="M7 9h2.6M7 12h2.6M14.4 9H17" />
    </svg>
  );
}

function Visto({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

function Candado({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    </svg>
  );
}

type EstadoPaso = 'hecho' | 'ahora' | 'pendiente' | 'bloqueado';

/** Lo que se puede hacer desde un paso o una misión. */
type Accion = {
  texto: string;
  hacer?: () => void;
  /** Un enlace en vez de un botón (el certificado). */
  href?: string;
  /** Si solo cambia de pantalla: en «Ver como» funciona; lo demás (abrir la bienvenida o el recorrido) no. */
  navega?: boolean;
};

type PasoBase = {
  id: string;
  icono: Glifo;
  /** Corto, bajo el círculo: «Recorrido». */
  nombre: string;
  titulo: string;
  texto: string;
  hecho: boolean;
  bloqueado?: boolean;
  /** Lo que se ve bajo el nombre en vez del estado: «2 de 8», «24 oct». */
  dato?: string;
  progreso?: { valor: number; total: number; texto: string };
  /** Los puntos que da, con los de su trofeo si lo trae. */
  premio?: number;
  /** Lo que acompaña a la cifra: «por clase». */
  premioTexto?: string;
  trofeo?: string;
  accion?: Accion;
  /** Sin botón, lo que hay que hacer: «Vuelve mañana». */
  etiqueta?: string;
};
type PasoCamino = PasoBase & { estado: EstadoPaso };
type Ruta = { id: 'formacion' | 'comunidad'; nombre: string; pasos: PasoCamino[] };

type Mision = {
  id: string;
  icono: Glifo;
  titulo: string;
  texto?: string;
  /** Los puntos que da hacerla, con los trofeos que trae. */
  puntos: number;
  /** Los trofeos que trae (una clase puede traer dos: «Primer paso» y «A mitad de camino»). */
  trofeos?: string[];
  clase?: { portada?: string; meta: string };
  accion?: Accion;
  etiqueta?: string;
};

type Presencial = { cuando: Date; dias: number; lugar: string };

/**
 * La próxima formación presencial, de su agenda: las fechas que trae su
 * convocatoria (`formacion-<convocatoria>-<día>`). La primera que queda por
 * delante (o la de hoy, que aún dura), con cuántos días tiene desde ella.
 * `pasada`: tuvo fechas y ya han pasado todas (con el abono, el panel pide la
 * agenda desde un año atrás para saberlo): no es lo mismo que no tener fecha.
 */
function presencialDe(eventos: Evento[] | null): { proxima: Presencial | null; pasada: boolean } {
  const fechas = (eventos ?? [])
    .filter((e) => e.id.startsWith('formacion-') && e.cuando && e.estado !== 'Cancelado')
    .map((e) => ({ e, t: new Date(e.cuando!).getTime() }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  const primera = fechas.find((x) => x.t > Date.now() - 12 * 3600_000);
  if (!primera) return { proxima: null, pasada: fechas.length > 0 };
  const convocatoria = primera.e.id.replace(/-\d{4}-\d{2}-\d{2}$/, '-');
  const dias = fechas.filter((x) => x.e.id.startsWith(convocatoria) && x.t >= primera.t).length;
  return { proxima: { cuando: new Date(primera.t), dias: Math.max(1, dias), lugar: primera.e.lugar ?? '' }, pasada: false };
}

/** «el trofeo «A»», «los trofeos «A» y «B»». */
function conTrofeos(n: string[]): string {
  const q = n.map((x) => `«${x}»`);
  if (q.length === 1) return `con el trofeo ${q[0]}`;
  return `con los trofeos ${q.slice(0, -1).join(', ')} y ${q[q.length - 1]}`;
}

/** La misión de terminar una clase: lo que da y, si los trae, sus trofeos. */
function misionDeClase(s: Leccion & { modulo?: string }, pct: number, ir: (v: Vista) => void, puntos: number = PUNTOS.clase, trofeos: string[] = []): Mision {
  return {
    id: 'clase',
    icono: 'clases',
    titulo: `Termina «${s.titulo}»`,
    puntos,
    trofeos,
    clase: {
      portada: s.portada,
      meta: [s.modulo, s.duracion ? minutos(s.duracion) : '', pct > 0 ? `vas por el ${pct} %` : ''].filter(Boolean).join(' · '),
    },
    accion: { texto: pct > 0 ? 'Seguir' : 'Empezar', hacer: () => ir('aula'), navega: true },
  };
}

/** «es hoy», «es mañana», «faltan 12 días». */
function cuantoFalta(cuando: Date): string {
  const hoy = new Date();
  const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const b = Date.UTC(cuando.getFullYear(), cuando.getMonth(), cuando.getDate());
  const dias = Math.round((b - a) / 86_400_000);
  return dias <= 0 ? 'es hoy' : dias === 1 ? 'es mañana' : `faltan ${dias} días`;
}

type Contexto = {
  puntos: ResumenPuntos | null;
  trofeos: EstadoLogro[] | null;
  racha: Racha | null;
  conCurso: boolean;
  miembro: boolean;
  soloPrecurso: boolean;
  /** Si dijo «Saltar» en el recorrido: deja de ser la primera misión (va después de su clase). */
  recorridoSaltado: boolean;
  /**
   * Clases DEL CURSO que puede ver (sin las bloqueadas), y cuántas ha
   * terminado: las que cuenta el certificado (lib/logros.ts). Las de la
   * Comunidad no cuentan para la formación: curso ≠ membresía.
   */
  abiertas: number;
  hechas: number;
  /** Si hay alguna clase publicada para ella, aunque sea bloqueada. */
  hayClases: boolean;
  /** Los vídeos del curso, esperando a la parte práctica (solo el abono), y cuántos son. */
  cursoBloqueado: boolean;
  bloqueadas: number;
  /** La siguiente clase que puede hacer y no ha terminado (del curso o de la Comunidad). */
  siguiente: (Leccion & { modulo?: string }) | null;
  pctSiguiente: number;
  presencial: Presencial | null;
  /** Tuvo fecha de presencial y ya pasó (aunque sus vídeos sigan esperando a la parte práctica). */
  presencialPasada: boolean;
  /** Lo que lleva leído del precurso (null: no se sabe o no lo tiene). */
  precurso: (Lectura & { paginas: number }) | null;
  ir: (v: Vista) => void;
};

function conEstados(pasos: PasoBase[]): PasoCamino[] {
  let yaHayAhora = false;
  return pasos.map((x) => {
    let estado: EstadoPaso = 'pendiente';
    if (x.hecho) estado = 'hecho';
    else if (x.bloqueado) estado = 'bloqueado';
    else if (!yaHayAhora) {
      estado = 'ahora';
      yaHayAhora = true;
    }
    return { ...x, estado };
  });
}

/**
 * Todo lo que el panel cuenta del progreso, sacado de lo que hay: sus
 * caminos y su próxima misión. Se calcula en un sitio para que el camino y la
 * misión digan siempre lo mismo.
 */
function progresoDe(x: Contexto): { rutas: Ruta[]; mision: Mision } {
  const d = x.puntos?.desglose;
  const logro = (id: string) => x.trofeos?.find((t) => t.id === id);
  const tiene = (id: string) => Boolean(logro(id)?.conseguido);
  const evento = (nombre: string) => () => window.dispatchEvent(new Event(nombre));

  /* ---------- Los primeros pasos (los dos caminos empiezan igual) ---------- */

  const recorridoHecho = tiene('recorrido') || (d?.recorrido ?? 0) > 0;
  const recorrido: PasoBase = {
    id: 'recorrido',
    icono: 'brujula',
    nombre: 'Recorrido',
    titulo: recorridoHecho ? 'Recorrido de bienvenida' : 'Haz el recorrido de bienvenida',
    texto: recorridoHecho
      ? `Tu trofeo «${nombreLogro('recorrido')}» ya está en tu vitrina. Repítelo cuando quieras.`
      : 'Un minuto para conocer tu espacio: dónde está cada cosa y cómo se suman puntos. Al terminarlo, tu trofeo de bienvenida.',
    hecho: recorridoHecho,
    premio: PUNTOS.recorrido + PUNTOS.logro,
    trofeo: nombreLogro('recorrido'),
    accion: { texto: recorridoHecho ? 'Repetir' : 'Empezar', hacer: evento('divine:recorrido') },
  };

  const perfilHecho = tiene('perfil-completo') || (d?.perfil ?? 0) > 0;
  const perfil: PasoBase = {
    id: 'perfil',
    icono: 'perfil',
    nombre: 'Perfil',
    titulo: perfilHecho ? 'Tu perfil' : 'Completa tu perfil',
    texto: perfilHecho ? 'Tu foto, tu ciudad y unas líneas sobre ti: listo.' : 'Tu foto, tu ciudad y unas líneas sobre ti. Es lo primero que se ve de ti.',
    hecho: perfilHecho,
    premio: PUNTOS.perfil + PUNTOS.logro,
    trofeo: nombreLogro('perfil-completo'),
    accion: perfilHecho
      ? { texto: 'Ver mi perfil', hacer: () => x.ir('perfil'), navega: true }
      : { texto: 'Completar', hacer: evento('divine:onboarding') },
  };

  /* ---------- La formación ---------- */

  /* La presencial está hecha si ya no hay ninguna por delante y sus vídeos
     están abiertos: los vídeos se desbloquean al completar la parte práctica.
     Con el curso pagado entero y una fecha por delante, la fecha manda. Con
     el abono, si su fecha ya pasó, también está hecha (aunque sus vídeos
     sigan esperando): no se le dice que «saldrá su fecha». */
  const presencialHecha = (!x.soloPrecurso && !x.presencial) || (x.soloPrecurso && !x.presencial && x.presencialPasada);
  const cuando = x.presencial?.cuando ?? null;

  /* El precurso está hecho si lo ha leído hasta el final (lo apunta el lector
     del aula) o si ya pasó la presencial, que es para lo que se lee. */
  const leido = Boolean(x.precurso?.leido);
  const precursoHecho = presencialHecha || leido;
  const paginaPrecurso = x.precurso?.pagina ?? 0;
  const precurso: PasoBase = {
    id: 'precurso',
    icono: 'libro',
    nombre: 'Precurso',
    titulo: precursoHecho ? 'El precurso' : paginaPrecurso > 1 ? 'Termina el precurso' : 'Lee el precurso',
    texto: presencialHecha
      ? 'La base de todo, para repasar cuando quieras: lo tienes siempre en tu aula.'
      : leido
        ? `Leído entero. Repásalo antes de la formación presencial${cuando ? ` (${cuantoFalta(cuando)})` : ''}: lo tienes en tu aula, junto a los dosieres.`
        : `Para leer antes de la formación presencial${cuando ? ` (${cuantoFalta(cuando)})` : ''}. Lo tienes en tu aula, junto a los dosieres.`,
    hecho: precursoHecho,
    dato: !precursoHecho && x.precurso && paginaPrecurso > 1 ? `Pág. ${paginaPrecurso}` : undefined,
    progreso:
      !precursoHecho && x.precurso && paginaPrecurso > 1
        ? { valor: paginaPrecurso, total: x.precurso.paginas, texto: `Página ${paginaPrecurso} de ${x.precurso.paginas}` }
        : undefined,
    accion: { texto: precursoHecho ? 'Repasar' : paginaPrecurso > 1 ? 'Seguir leyendo' : 'Leer el precurso', hacer: () => x.ir('aula'), navega: true },
  };

  const presencial: PasoBase = {
    id: 'presencial',
    icono: 'mapa',
    nombre: 'Presencial',
    titulo: 'Formación presencial',
    texto: presencialHecha
      ? x.soloPrecurso
        ? 'Hecha. Tus clases en vídeo estarán disponibles aquí una vez terminada la clase presencial.'
        : 'Hecha: tu formación ya está abierta entera.'
      : cuando
        ? `${mayus(HOY.format(cuando))} · ${HORA.format(cuando)}${x.presencial?.lugar ? ` · ${x.presencial.lugar}` : ''}${(x.presencial?.dias ?? 1) > 1 ? ` · ${x.presencial?.dias} días` : ''}.${x.soloPrecurso ? ' Al completarla se desbloquean tus clases en vídeo.' : ''}`
        : 'Tu fecha saldrá aquí y en tu agenda en cuanto esté confirmada. Al completarla se desbloquean tus clases en vídeo.',
    hecho: presencialHecha,
    dato: cuando ? (cuantoFalta(cuando) === 'es hoy' ? 'Hoy' : DIA_CORTO.format(cuando).replace('.', '')) : undefined,
    accion: cuando ? { texto: 'Ver en mi agenda', hacer: () => x.ir('agenda'), navega: true } : undefined,
  };

  const todasBloqueadas = x.cursoBloqueado;
  const clasesHechas = !todasBloqueadas && x.abiertas > 0 && x.hechas >= x.abiertas;
  const clases: PasoBase = {
    id: 'clases',
    icono: 'clases',
    nombre: 'Clases',
    titulo: 'Clases en vídeo',
    texto: !x.hayClases
      ? 'Todavía no hay clases publicadas. En cuanto Sorela las publique, aparecen aquí.'
      : todasBloqueadas
        ? `${x.bloqueadas === 1 ? 'Tu clase estará disponible' : `Tus ${x.bloqueadas} clases estarán disponibles`} una vez terminada la clase presencial. Mientras, ya puedes leer el precurso y los dosieres.`
        : clasesHechas
          ? 'Las has terminado todas. Repasa cuando quieras: las manos se afinan repitiendo.'
          : `Cada clase que terminas suma +${PUNTOS.clase}. Llevas ${x.hechas} de ${x.abiertas}.`,
    hecho: clasesHechas,
    bloqueado: todasBloqueadas,
    dato: todasBloqueadas ? 'Bloqueadas' : x.abiertas > 0 ? `${x.hechas} de ${x.abiertas}` : undefined,
    progreso:
      !todasBloqueadas && x.abiertas > 0
        ? { valor: x.hechas, total: x.abiertas, texto: `${x.hechas} de ${plural(x.abiertas, 'clase', 'clases')}` }
        : undefined,
    premio: PUNTOS.clase,
    premioTexto: 'por clase',
    accion: x.hayClases && !todasBloqueadas ? { texto: clasesHechas ? 'Repasar' : 'Ir a clase', hacer: () => x.ir('aula'), navega: true } : undefined,
  };

  const certificadoHecho = tiene('curso-completo') || (d?.curso ?? 0) > 0;
  const faltan = Math.max(0, x.abiertas - x.hechas);
  const certificado: PasoBase = {
    id: 'certificado',
    icono: 'curso',
    nombre: 'Certificado',
    titulo: 'Tu certificado',
    texto: certificadoHecho
      ? 'Formación completa: tu certificado ya es tuyo.'
      : todasBloqueadas || x.abiertas === 0
        ? 'Llega al terminar todas tus clases en vídeo.'
        : `Llega al terminar todas tus clases: ${faltan === 1 ? 'te falta 1' : `te faltan ${faltan}`}.`,
    hecho: certificadoHecho,
    // Se abre al terminar las clases: hasta entonces, con su candado.
    bloqueado: !certificadoHecho,
    premio: PUNTOS.curso + PUNTOS.logro,
    trofeo: nombreLogro('curso-completo'),
    accion: certificadoHecho ? { texto: 'Descargar', href: '/api/certificado' } : undefined,
  };

  /* ---------- La comunidad ---------- */

  const publicoYa = tiene('primera-publicacion') || (d?.publicaciones ?? 0) > 0;
  const presentarte: PasoBase = {
    id: 'presentarte',
    icono: 'publicaciones',
    nombre: 'Preséntate',
    titulo: publicoYa ? 'Ya te has presentado' : 'Preséntate en la comunidad',
    texto: publicoYa
      ? 'Tu primera publicación ya está en el muro. Cada caso que compartes suma.'
      : 'Tu primera publicación: quién eres, dónde trabajas o un caso que te haya hecho pensar.',
    hecho: publicoYa,
    premio: PUNTOS.publicacion + PUNTOS.logro,
    trofeo: nombreLogro('primera-publicacion'),
    accion: { texto: publicoYa ? 'Ir al muro' : 'Publicar', hacer: () => x.ir('comunidad'), navega: true },
  };

  const respondioYa = tiene('primera-respuesta') || (d?.respuestas ?? 0) > 0;
  const ayudar: PasoBase = {
    id: 'ayudar',
    icono: 'respuestas',
    nombre: 'Ayuda',
    titulo: respondioYa ? 'Ya echas una mano' : 'Responde a una compañera',
    texto: respondioYa
      ? 'Tu primera respuesta ya ha ayudado a alguien. Cada una suma.'
      : 'Contesta una duda o comenta el caso de otra terapeuta: lo que sabes le sirve.',
    hecho: respondioYa,
    premio: PUNTOS.respuesta + PUNTOS.logro,
    trofeo: nombreLogro('primera-respuesta'),
    accion: { texto: respondioYa ? 'Ir al muro' : 'Ver el muro', hacer: () => x.ir('comunidad'), navega: true },
  };

  const semanaHecha = tiene('racha-7') || (d?.racha ?? 0) > 0;
  const lleva = x.racha?.actual ?? null;
  const racha: PasoBase = {
    id: 'racha',
    icono: 'racha',
    nombre: 'Racha',
    titulo: 'Siete días seguidos',
    texto: semanaHecha
      ? `Una semana entera sin fallar: conseguido. A los 30 días seguidos llega el oro (+${PUNTOS.racha30}).`
      : lleva !== null
        ? `Llevas ${plural(lleva, 'día seguido', 'días seguidos')}. Entra cada día: cada día suma +${PUNTOS.dia}, y a los 7, +${PUNTOS.racha7}.`
        : `Entra cada día: cada día suma +${PUNTOS.dia}, y a los 7 seguidos, +${PUNTOS.racha7}.`,
    hecho: semanaHecha,
    dato: !semanaHecha && lleva !== null ? `${Math.min(lleva, 7)} de 7` : undefined,
    progreso: !semanaHecha && lleva !== null ? { valor: Math.min(lleva, 7), total: 7, texto: `${Math.min(lleva, 7)} de 7 días` } : undefined,
    premio: PUNTOS.racha7 + PUNTOS.logro,
    trofeo: nombreLogro('racha-7'),
    etiqueta: semanaHecha ? undefined : 'Vuelve mañana',
  };

  const podioYa = tiene('podio');
  const podio: PasoBase = {
    id: 'podio',
    icono: 'medalla',
    nombre: 'Podio',
    titulo: podioYa ? 'Has estado en el podio' : 'Sube al podio del mes',
    texto: podioYa
      ? 'Cerraste un mes entre las 3 más activas. Cada mes hay un podio nuevo.'
      : 'Cierra un mes entre las 3 más activas de la comunidad. El ranking empieza de cero cada día 1.',
    hecho: podioYa,
    premio: PUNTOS.logro,
    trofeo: nombreLogro('podio'),
    accion: { texto: 'Ver el ranking', hacer: () => irA('comunidad', { ver: 'ranking' }), navega: true },
  };

  const rutas: Ruta[] = [];
  if (x.conCurso)
    rutas.push({ id: 'formacion', nombre: 'Tu formación', pasos: conEstados([recorrido, perfil, precurso, presencial, clases, certificado]) });
  if (x.miembro)
    rutas.push({ id: 'comunidad', nombre: 'Tu comunidad', pasos: conEstados([recorrido, perfil, presentarte, ayudar, racha, podio]) });

  /* ---------- La próxima misión ----------
     La primera que toca, de la que más da y antes se hace a la que menos: lo
     de llegar (recorrido y perfil), la clase siguiente, estrenarse en la
     comunidad, el precurso mientras espera la presencial, las fotos de su
     trabajo, compartir… Y si no queda nada, volver mañana. Si saltó el
     recorrido, va justo después de la clase siguiente: no tapa sus clases. */

  const desdePaso = (s: PasoBase): Mision => ({
    id: s.id,
    icono: s.icono,
    titulo: s.titulo,
    texto: s.texto,
    puntos: s.premio ?? 0,
    trofeos: s.trofeo ? [s.trofeo] : undefined,
    accion: s.accion,
  });

  let mision: Mision | null = null;
  // Si lo saltó, el recorrido no se queda de primera misión para siempre: va después de su clase.
  if (!recorridoHecho && !x.recorridoSaltado) mision = desdePaso(recorrido);
  else if (!perfilHecho) mision = desdePaso(perfil);
  else if (x.siguiente) {
    /* Lo que da terminarla: la clase y, si es del CURSO y la que toca, sus
       trofeos de la formación (y el curso entero). Las de la Comunidad dan
       sus puntos, nada más: no cuentan para la formación. */
    let pts = PUNTOS.clase;
    const trofeos: string[] = [];
    let orosNuevos = 0;
    const sumaTrofeo = (id: string, extra = 0) => {
      const l = logro(id);
      if (!l || l.conseguido) return;
      if (id !== 'primera-clase' && l.falta !== 1) return;
      pts += PUNTOS.logro + extra;
      trofeos.push(l.nombre);
      if (l.escalon === 'oro') orosNuevos++;
    };
    if (x.siguiente.para?.tipo === 'curso') {
      sumaTrofeo('primera-clase');
      sumaTrofeo('mitad-curso');
      sumaTrofeo('curso-completo', PUNTOS.curso);
      // Si su oro es el que completa los del trofeo Divine, también llega ese.
      const divine = logro('divine');
      const oros = (x.trofeos ?? []).filter((t) => t.escalon === 'oro' && t.conseguido).length;
      if (orosNuevos && divine && !divine.conseguido && oros + orosNuevos >= OROS_PARA_DIVINE) {
        pts += PUNTOS.logro;
        trofeos.push(divine.nombre);
      }
    }
    mision = misionDeClase(x.siguiente, x.pctSiguiente, x.ir, pts, trofeos);
  } else if (!recorridoHecho) mision = desdePaso(recorrido);
  else if (x.miembro && !publicoYa) mision = desdePaso(presentarte);
  else if (x.miembro && !respondioYa) mision = desdePaso(ayudar);
  else if (x.conCurso && !precursoHecho) {
    mision = {
      id: 'precurso',
      icono: 'libro',
      titulo: paginaPrecurso > 1 ? 'Termina el precurso' : 'Lee el precurso',
      texto: [
        cuando ? `Prepárate para la presencial: ${cuantoFalta(cuando)}.` : 'Prepárate para la formación presencial.',
        x.precurso && paginaPrecurso > 1 ? `Vas por la página ${paginaPrecurso} de ${x.precurso.paginas}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      puntos: 0,
      accion: { texto: paginaPrecurso > 1 ? 'Seguir' : 'Leer', hacer: () => x.ir('aula'), navega: true },
    };
  }
  if (!mision && perfilHecho) {
    const fotos = Math.round((d?.fotos ?? 0) / PUNTOS.foto);
    if (d && fotos < PUNTOS.fotosMax) {
      const conTrofeo = ['fotos-5', 'fotos-10'].map(logro).find((l) => l && !l.conseguido && l.falta === 1);
      mision = {
        id: 'foto',
        icono: 'fotos',
        titulo: fotos === 0 ? 'Sube una foto de tu trabajo' : 'Sube otra foto de tu trabajo',
        texto: `Tu perfil es tu escaparate: cada foto suma, hasta ${PUNTOS.fotosMax}.`,
        puntos: PUNTOS.foto + (conTrofeo ? PUNTOS.logro : 0),
        trofeos: conTrofeo ? [conTrofeo.nombre] : undefined,
        accion: { texto: 'Subir', hacer: () => x.ir('perfil'), navega: true },
      };
    }
  }
  if (!mision && x.miembro) {
    const conTrofeo = ['publicaciones-5', 'publicaciones-15'].map(logro).find((l) => l && !l.conseguido && l.falta === 1);
    mision = {
      id: 'publicar',
      icono: 'publicaciones',
      titulo: 'Comparte un caso en la comunidad',
      texto: `Y cada respuesta a una compañera, +${PUNTOS.respuesta}.`,
      puntos: PUNTOS.publicacion + (conTrofeo ? PUNTOS.logro : 0),
      trofeos: conTrofeo ? [conTrofeo.nombre] : undefined,
      accion: { texto: 'Publicar', hacer: () => x.ir('comunidad'), navega: true },
    };
  }
  if (!mision) {
    mision = {
      id: 'manana',
      icono: 'racha',
      titulo: 'Vuelve mañana',
      texto:
        lleva !== null
          ? `Llevas ${plural(lleva, 'día seguido', 'días seguidos')}: mañana tu racha sigue y suma +${PUNTOS.dia}.`
          : `Cada día que entras suma +${PUNTOS.dia}.`,
      puntos: PUNTOS.dia,
      etiqueta: 'Mañana',
    };
  }

  return { rutas, mision };
}

/** Lo que pasa con su nivel si hace la misión: «Subes a…» o cuánto le quedará. */
function lineaNivel(pts: number, r: ResumenPuntos): { texto: string; sube: boolean } | null {
  if (pts <= 0 || !r.nivel.siguiente) return null;
  const tras = nivelDe(r.total + pts);
  if (tras.n > r.nivel.n) return { texto: `Subes a ${tras.nombre}`, sube: true };
  return { texto: `Te quedarán ${formatoPuntos(r.nivel.falta - pts)} pts para ${r.nivel.siguiente.nombre}`, sube: false };
}

/** La barra de su nivel con lo que añadiría la misión, en un oro más claro que late. */
function Previa({ r, pts }: { r: ResumenPuntos; pts: number }) {
  const reducir = useReducedMotion();
  const e = r.nivel;
  if (!e.siguiente) return null;
  const tramo = e.siguiente.desde - e.desde;
  const ya = Math.max(0, Math.min(1, e.progreso));
  const luego = Math.max(ya, Math.min(1, (r.total + pts - e.desde) / tramo));
  const extra = `${(luego - ya) * 100}%`;
  return (
    <span className={p.previa} aria-hidden="true">
      <i className={p.previaYa} style={{ width: `${ya * 100}%` }} />
      <motion.i
        className={p.previaLuego}
        style={{ left: `${ya * 100}%` }}
        initial={{ width: reducir ? extra : '0%' }}
        animate={{ width: extra }}
        transition={{ delay: 0.6, duration: 0.8, ease: EASE }}
      />
    </span>
  );
}

function TarjetaMision({
  m,
  r,
  soloVer,
  otraClase,
  ir,
}: {
  m: Mision;
  r: ResumenPuntos | null;
  soloVer: boolean;
  /** Si la misión no es una clase pero tiene una por hacer: un enlace pequeño para ir a ella. */
  otraClase: { titulo: string; empezada: boolean } | null;
  ir: (v: Vista) => void;
}) {
  const activa = Boolean(m.accion && (!soloVer || m.accion.navega));
  const nivel = r ? lineaNivel(m.puntos, r) : null;
  const dentro = (
    <>
      {m.clase ? (
        <span className={p.misionFoto}>
          {m.clase.portada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.clase.portada} alt="" />
          ) : null}
          <span className={p.play} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </span>
      ) : (
        <span className={p.misionMedalla} aria-hidden="true">
          <GlifoPaso g={m.icono} size={24} />
        </span>
      )}
      <span className={p.misionTexto}>
        <span className={p.misionRotulo}>Tu próxima misión</span>
        <strong>{m.titulo}</strong>
        {m.clase ? <span className={p.misionMeta}>{m.clase.meta}</span> : m.texto ? <span className={p.misionMeta}>{m.texto}</span> : null}
        {(m.puntos > 0 || m.trofeos?.length) && (
          <span className={p.misionPremio}>
            {m.puntos > 0 && <b>+{formatoPuntos(m.puntos)} pts</b>}
            {m.trofeos?.length ? <span>{conTrofeos(m.trofeos)}</span> : null}
          </span>
        )}
        {r && nivel && (
          <span className={p.misionNivel}>
            <Previa r={r} pts={m.puntos} />
            <em data-sube={nivel.sube ? '' : undefined}>{nivel.texto}</em>
          </span>
        )}
      </span>
      {activa ? (
        <span className={p.misionIr} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />
          </svg>
        </span>
      ) : m.etiqueta || (soloVer && m.accion) ? (
        <span className={p.misionEtiqueta}>{soloVer && m.accion ? 'De muestra' : m.etiqueta}</span>
      ) : null}
    </>
  );

  return (
    <div className={p.misionCaja}>
      {activa && m.accion?.href ? (
        <a className={p.mision} href={m.accion.href}>
          {dentro}
        </a>
      ) : activa ? (
        <button type="button" className={p.mision} onClick={m.accion?.hacer}>
          {dentro}
        </button>
      ) : (
        <div className={p.mision} data-quieta="">
          {dentro}
        </div>
      )}
      {otraClase && (
        <button type="button" className={p.otraClase} onClick={() => ir('aula')}>
          {otraClase.empezada ? 'O sigue con' : 'O empieza'} «{otraClase.titulo}» <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

/** Lo que se lee bajo cada círculo del camino. */
function estadoCorto(x: PasoCamino): string {
  if (x.estado === 'hecho') return 'Hecho';
  if (x.dato) return x.dato;
  if (x.estado === 'ahora') return 'Ahora';
  if (x.estado === 'bloqueado') return 'Bloqueado';
  return 'Después';
}

const ETIQUETA_ESTADO: Record<EstadoPaso, string> = { hecho: 'Hecho', ahora: 'Ahora', pendiente: 'Después', bloqueado: 'Bloqueado' };

function TuCamino({ rutas, soloVer }: { rutas: Ruta[] | null; soloVer: boolean }) {
  const base = useId();
  const [elegida, setElegida] = useState<Ruta['id'] | null>(null);
  // undefined: el paso de «ahora» (o el último, si ya está todo); null: ninguno abierto.
  const [abierto, setAbierto] = useState<string | null | undefined>(undefined);
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);

  if (!rutas) {
    return (
      <motion.section className={`${p.tarjeta} ${p.camino}`} {...aparecer(1)} aria-labelledby={`${base}-titulo`}>
        <header className={p.caminoCabecera}>
          <div>
            <h3 id={`${base}-titulo`}>Tu camino</h3>
          </div>
        </header>
        <div className={p.esqueleto} aria-busy="true" aria-label="Cargando tu camino" />
      </motion.section>
    );
  }
  if (rutas.length === 0) return null;

  // Por defecto, el primer camino que aún tiene algo por hacer.
  const porDefecto = rutas.find((r) => r.pasos.some((x) => x.estado !== 'hecho'))?.id ?? rutas[0].id;
  const ruta = rutas.find((r) => r.id === elegida) ?? rutas.find((r) => r.id === porDefecto)!;
  const pasos = ruta.pasos;
  const ahora = pasos.find((x) => x.estado === 'ahora') ?? null;
  const hechos = pasos.filter((x) => x.estado === 'hecho').length;
  const abiertoDe = abierto === undefined ? (ahora?.id ?? pasos[pasos.length - 1].id) : abierto;

  const elegir = (id: Ruta['id']) => {
    setElegida(id);
    setAbierto(undefined);
  };
  // Las pestañas, con las flechas (como manda el patrón de pestañas).
  const alTecla = (e: TeclaReact<HTMLButtonElement>, k: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const j = (k + (e.key === 'ArrowRight' ? 1 : -1) + rutas.length) % rutas.length;
    elegir(rutas[j].id);
    pestanas.current[j]?.focus();
  };

  return (
    <motion.section className={`${p.tarjeta} ${p.camino}`} {...aparecer(1)} aria-labelledby={`${base}-titulo`}>
      <header className={p.caminoCabecera}>
        <div>
          <h3 id={`${base}-titulo`}>Tu camino</h3>
          <p className={p.caminoResumen}>
            {hechos === pasos.length ? (
              <>Camino completo. Todo lo que hagas a partir de aquí sigue sumando.</>
            ) : (
              <>
                Llevas <b>{hechos}</b> de {pasos.length}
                {ahora ? (
                  <>
                    {' '}
                    · Ahora: <b>{minus(ahora.titulo)}</b>
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
        {rutas.length > 1 && (
          <div className={p.rutas} role="tablist" aria-label="Qué camino ver">
            {rutas.map((r, k) => (
              <button
                key={r.id}
                ref={(el) => {
                  pestanas.current[k] = el;
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${r.id}`}
                aria-selected={r.id === ruta.id}
                aria-controls={`${base}-ruta`}
                tabIndex={r.id === ruta.id ? 0 : -1}
                onClick={() => elegir(r.id)}
                onKeyDown={(e) => alTecla(e, k)}
              >
                {r.id === ruta.id && <motion.span layoutId={`${base}-pildora`} className={p.rutaPildora} transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                <span className={p.rutaTexto}>{r.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div
        id={`${base}-ruta`}
        className={p.ruta}
        role={rutas.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={rutas.length > 1 ? `${base}-tab-${ruta.id}` : undefined}
        style={{ '--pasos': pasos.length } as CSSProperties}
      >
        {pasos.map((x, i) => {
          const id = `${base}-${ruta.id}-${x.id}`;
          const abiertoEste = abiertoDe === x.id;
          const primero = i === 0;
          const ultimo = i === pasos.length - 1;
          const llega = !primero && pasos[i - 1].estado === 'hecho';
          const accion = x.accion && (!soloVer || x.accion.navega || x.accion.href) ? x.accion : null;
          return (
            <Fragment key={`${ruta.id}-${x.id}`}>
              <button
                type="button"
                className={p.paso}
                data-estado={x.estado}
                data-primero={primero ? '' : undefined}
                data-ultimo={ultimo ? '' : undefined}
                data-llega={llega ? '' : undefined}
                aria-expanded={abiertoEste}
                aria-controls={id}
                onClick={() => setAbierto(abiertoEste ? null : x.id)}
                style={{ '--i': i } as CSSProperties}
              >
                <span className={p.pasoNodo}>
                  <motion.span
                    key={x.estado}
                    className={p.pasoGlifo}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.15 + i * 0.07 }}
                  >
                    {x.estado === 'hecho' ? <Visto size={20} /> : x.estado === 'bloqueado' ? <Candado size={18} /> : <GlifoPaso g={x.icono} size={20} />}
                  </motion.span>
                </span>
                <span className={p.pasoTexto}>
                  <strong>{x.nombre}</strong>
                  <em aria-hidden="true">{estadoCorto(x)}</em>
                </span>
                {x.premio ? (
                  <span className={p.pasoPremio} aria-hidden="true">
                    +{formatoPuntos(x.premio)}
                  </span>
                ) : (
                  <span className={p.pasoPremioVacio} aria-hidden="true" />
                )}
                {/* Para el lector, todo en una frase: «Clases: ahora, 2 de 8. Paso 5 de 6. +50 puntos por clase». */}
                <span className={p.soloLector}>
                  {`: ${minus(ETIQUETA_ESTADO[x.estado])}${x.dato && x.estado !== 'hecho' ? `, ${x.dato}` : ''}. Paso ${i + 1} de ${pasos.length}.`}
                  {x.premio ? ` +${formatoPuntos(x.premio)} puntos${x.premioTexto ? ` ${x.premioTexto}` : ''}.` : ''}
                </span>
              </button>

              {/* El detalle de cada paso está siempre en la página (cerrado, no se ve
                  ni se enfoca): en el móvil se abre bajo su paso; en el ordenador,
                  debajo de la fila. */}
              <div
                id={id}
                className={p.detalle}
                data-abierto={abiertoEste ? '' : undefined}
                data-tramo={x.estado === 'hecho' && !ultimo ? '' : undefined}
                data-ultimo={ultimo ? '' : undefined}
              >
                <div className={p.detalleDentro}>
                  <div className={p.detalleCaja}>
                    <p className={p.detalleRotulo} data-estado={x.estado}>
                      Paso {i + 1} de {pasos.length} · {ETIQUETA_ESTADO[x.estado]}
                    </p>
                    <p className={p.detalleTitulo}>{x.titulo}</p>
                    <p className={p.detalleTexto}>{x.texto}</p>
                    {x.progreso && (
                      <div className={p.detalleProgreso}>
                        <span
                          className={p.detalleBarra}
                          role="progressbar"
                          aria-label={x.titulo}
                          aria-valuemin={0}
                          aria-valuemax={x.progreso.total}
                          aria-valuenow={x.progreso.valor}
                          aria-valuetext={x.progreso.texto}
                        >
                          <i style={{ width: `${Math.min(100, (x.progreso.valor / Math.max(1, x.progreso.total)) * 100)}%` }} />
                        </span>
                        <span>{x.progreso.texto}</span>
                      </div>
                    )}
                    <div className={p.detallePie}>
                      {x.premio ? (
                        <span className={p.detallePremio} data-hecho={x.estado === 'hecho' ? '' : undefined}>
                          {x.estado === 'hecho' ? <Visto size={15} /> : <Icono nombre="logros" size={16} />}
                          <b>+{formatoPuntos(x.premio)} pts</b>
                          {x.premioTexto ? <span>{x.premioTexto}</span> : null}
                          {x.trofeo ? <span>· trofeo «{x.trofeo}»</span> : null}
                          {x.estado === 'hecho' ? <span className={p.soloLector}>(ya son tuyos)</span> : null}
                        </span>
                      ) : null}
                      {accion?.href ? (
                        <a className={p.detalleBoton} href={accion.href}>
                          {accion.texto}
                        </a>
                      ) : accion ? (
                        <button type="button" className={p.detalleBoton} data-suave={x.estado === 'hecho' ? '' : undefined} onClick={accion.hacer}>
                          {accion.texto}
                        </button>
                      ) : x.accion && soloVer ? (
                        <span className={p.detalleEtiqueta}>De muestra</span>
                      ) : x.etiqueta ? (
                        <span className={p.detalleEtiqueta}>{x.etiqueta}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </motion.section>
  );
}

/* ==========================================================================
   El panel
   ========================================================================== */

export default function PanelAlumna({
  nombre,
  foto,
  accesos,
  ir,
  muestra = false,
  recorridoSaltado = false,
}: {
  nombre: string;
  foto: string | null;
  accesos: Acceso[];
  ir: (v: Vista) => void;
  /** Sorela mirando «Ver como»: puntos de muestra y sin botones que abran cosas suyas. */
  muestra?: boolean;
  /** Si dijo «Saltar» en el recorrido de bienvenida (sin haberlo terminado nunca). */
  recorridoSaltado?: boolean;
}) {
  // Null hasta montar: el servidor (UTC) y el navegador (su hora) no tienen por
  // qué estar en el mismo día. Se escribe solo con la hora de quien mira.
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => setAhora(new Date()), []);
  const [lecciones, setLecciones] = useState<Leccion[] | null>(null);
  const [progreso, setProgreso] = useState<Record<string, Progreso>>({});
  const [docs, setDocs] = useState<Doc[]>([]);
  const [lectura, setLectura] = useState<Record<string, Lectura>>({});
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [com, setCom] = useState<{ publicaciones: Publicacion[]; proximaClase: ProximaClase } | null>(null);
  // Los puntos llegan solos (los reparte la Celebración con `divine:puntos`).
  const llegados = useResumenPuntos();
  const puntos = muestra ? PUNTOS_DE_MUESTRA : llegados;
  // La subida desde lo que vio la última vez, solo la primera vez que se pinta (no en cada vuelta a Inicio).
  const desde = useDesdeUnaVez('panel-alumna', muestra ? null : llegados);
  const trofeosLlegados = useTrofeos();
  const trofeos = muestra ? TROFEOS_DE_MUESTRA : trofeosLlegados;
  // Su racha de días: llega con los puntos (de Sorela no hay racha que pedir).
  const rachaLlegada = useRacha(!muestra);
  const racha = muestra ? RACHA_DE_MUESTRA : rachaLlegada;
  // «Nuevo» en «¿Cómo funciona?» hasta que lo abre la primera vez (solo comodidad: vive en este navegador).
  const [nuevo, setNuevo] = useState(false);
  useEffect(() => {
    try {
      setNuevo(!window.localStorage.getItem(CLAVE_VISTO));
    } catch {
      setNuevo(false);
    }
  }, []);

  const miembro = tieneMembresia(accesos);
  const conCurso = accesos.some((a) => a.tipo === 'curso');
  // Solo con el abono del curso: el material ya; los vídeos, tras la parte práctica.
  const soloPrecurso = accesos.some((a) => a.tipo === 'curso' && a.completo === false);

  useEffect(() => {
    const json = (u: string) => fetch(u).then((r) => r.json()).catch(() => ({ ok: false }));
    json('/api/lecciones').then((j) => setLecciones(j.ok ? j.lecciones ?? [] : []));
    json('/api/progreso').then((j) => j.ok && setProgreso(j.progreso ?? {}));
    json('/api/material').then((j) => {
      if (!j.ok) return;
      setDocs(j.documentos ?? []);
      setLectura(j.lectura ?? {});
    });
    /* Con el abono, la agenda desde un año atrás: así se sabe si su presencial
       ya pasó (y no se le dice que «saldrá su fecha»). */
    const haceUnAno = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    json(soloPrecurso ? `/api/agenda?desde=${haceUnAno}` : '/api/agenda').then((j) => setEventos(j.ok ? j.eventos ?? [] : []));
    // Solo lo del muro: el ranking entero no hace falta aquí.
    if (miembro) json('/api/comunidad?solo=muro').then((j) => j.ok && setCom({ publicaciones: j.publicaciones ?? [], proximaClase: j.proximaClase ?? null }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Si /api/logros no responde (error, sin red), el camino y la misión no se
     quedan cargando para siempre: a los pocos segundos, la clase siguiente
     como misión (sin puntos de trofeos, que no se saben) y sin camino. */
  const [sinLogros, setSinLogros] = useState(false);
  const faltanLogros = !muestra && lecciones !== null && llegados === null && trofeosLlegados === null;
  useEffect(() => {
    if (!faltanLogros) return;
    const t = setTimeout(() => setSinLogros(true), 6000);
    return () => clearTimeout(t);
  }, [faltanLogros]);

  /* Si le llegan puntos nuevos con el panel abierto (ha vuelto de una clase,
     ha publicado…), «Tu nivel» se ilumina un momento. La fiesta grande la
     hace la Celebración; esto solo dice «aquí ha cambiado algo». */
  const [brilla, setBrilla] = useState(0);
  const totalVisto = useRef<number | null>(null);
  const totalAhora = puntos?.total ?? null;
  useEffect(() => {
    if (totalAhora === null) return;
    const antes = totalVisto.current;
    totalVisto.current = totalAhora;
    if (antes !== null && totalAhora > antes) setBrilla((b) => b + 1);
  }, [totalAhora]);
  useEffect(() => {
    if (!brilla) return;
    const t = setTimeout(() => setBrilla(0), 1700);
    return () => clearTimeout(t);
  }, [brilla]);

  const ordenadas = useMemo(
    () => (lecciones ? porBloques(lecciones).flatMap((b) => b.lecciones.map((l) => ({ ...l, modulo: l.modulo || b.nombre }))) : []),
    [lecciones]
  );
  // Los vídeos del curso esperan a la parte práctica si todos los suyos salen bloqueados.
  const delCurso = ordenadas.filter((l) => l.para?.tipo === 'curso');
  const bloqueadasCurso = delCurso.filter((l) => l.bloqueada).length;
  const cursoBloqueado = bloqueadasCurso > 0 && bloqueadasCurso === delCurso.length;
  /* Las clases que cuentan para su progreso, las mismas en todo el panel (el
     anillo, la frase, el camino y el certificado): con el curso, las del
     curso que tiene abiertas, como lib/logros.ts; sin curso, las que tenga. */
  const cuentan = ordenadas.filter((l) => !l.bloqueada && (!conCurso || l.para?.tipo === 'curso'));
  const hechas = cuentan.filter((l) => progreso[l.id]?.completada).length;
  const pct = cuentan.length ? Math.round((hechas / cuentan.length) * 100) : 0;
  const siguiente = ordenadas.find((l) => !l.bloqueada && !progreso[l.id]?.completada) ?? ordenadas.find((l) => !l.bloqueada);
  const pSig = siguiente ? progreso[siguiente.id] : undefined;
  const pctSig = siguiente?.duracion && pSig?.visto ? Math.min(99, Math.round((pSig.visto / siguiente.duracion) * 100)) : 0;
  const minutosVistos = Math.round(Object.values(progreso).reduce((s, x) => s + (x.visto || 0), 0) / 60);
  const proximos = (eventos ?? []).filter((e) => e.estado !== 'Cancelado' && e.cuando && new Date(e.cuando).getTime() > Date.now() - 3600_000).slice(0, 3);
  const pila = (nombre || '').trim().split(/\s+/)[0];

  /* El camino y la misión, cuando ya se sabe lo suficiente para no decir algo
     que no es: las clases y lo que tiene ganado (puntos o trofeos). El camino
     espera además a la agenda, que dice si la presencial está por delante. */
  const listo = lecciones !== null && (puntos !== null || trofeos !== null);
  const sigPendiente = siguiente && !siguiente.bloqueada && !progreso[siguiente.id]?.completada ? siguiente : null;
  const docPrecurso = docs.find((d) => d.id === 'precurso');
  const leidoPrecurso = lectura.precurso;
  const precurso = docPrecurso ? { pagina: leidoPrecurso?.pagina ?? 0, leido: Boolean(leidoPrecurso?.leido), paginas: docPrecurso.paginas } : null;
  const calculado = useMemo(
    () => {
      if (!listo) return null;
      const pres = presencialDe(eventos);
      return progresoDe({
        puntos,
        trofeos,
        racha,
        conCurso,
        miembro,
        soloPrecurso,
        recorridoSaltado,
        abiertas: conCurso ? cuentan.length : 0,
        hechas: conCurso ? hechas : 0,
        hayClases: delCurso.length > 0,
        cursoBloqueado,
        bloqueadas: bloqueadasCurso,
        siguiente: sigPendiente,
        pctSiguiente: pctSig,
        presencial: pres.proxima,
        presencialPasada: pres.pasada,
        precurso,
        ir,
      });
    },
    // `ir` cambia en cada pintado de Plataforma y no cambia lo que se calcula.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listo, puntos, trofeos, racha, conCurso, miembro, soloPrecurso, recorridoSaltado, cuentan.length, hechas, delCurso.length, cursoBloqueado, bloqueadasCurso, sigPendiente, pctSig, eventos, precurso?.pagina, precurso?.leido, precurso?.paginas]
  );
  // Sin /api/logros: la clase siguiente, como el antiguo «Seguir donde lo dejé».
  const mision = calculado?.mision ?? (sinLogros && sigPendiente ? misionDeClase(sigPendiente, pctSig, ir) : null);
  const rutas = calculado && eventos !== null ? calculado.rutas : sinLogros && !calculado ? [] : null;
  // Cuántos días lleva la racha cuenta para la semana entera (los siete puntitos).
  const semana = racha ? Math.min(7, racha.actual) : 0;

  return (
    // Con «reducir movimiento», las tarjetas aparecen sin desplazarse.
    <MotionConfig reducedMotion="user">
    <div className={p.panel}>
      {/* ---------- Saludo, racha y la próxima misión ---------- */}
      <motion.section className={p.hero} {...aparecer(0)}>
        <div className={p.heroTexto}>
          {/* La hora del servidor es UTC y la de quien mira, la suya: cerca de
              medianoche daban otro día y otro saludo. Hasta montar, un hueco y
              «Hola»; luego, su fecha y su saludo. */}
          <span className={p.fecha}>{ahora ? mayus(HOY.format(ahora)) : ' '}</span>
          <h2 className={p.saludo}>{`${ahora ? saludo(ahora) : 'Hola'}${pila ? `, ${pila}` : ''}`}</h2>
          {/* Hasta que llega la racha, su hueco: así la frase y la misión no saltan al llegar. */}
          {!racha && !muestra && !sinLogros && <span className={p.rachaHueco} aria-hidden="true" />}
          {racha && racha.actual > 0 && (
            <p className={p.racha}>
              <Icono nombre="racha" size={18} className={p.rachaIcono} />
              <span>
                <b>
                  <ContadorPuntos valor={racha.actual} desde={muestra ? undefined : 0} />
                </b>{' '}
                {racha.actual === 1 ? 'día seguido' : 'días seguidos'}
              </span>
              <span className={p.rachaSemana} aria-hidden="true">
                {Array.from({ length: 7 }, (_, k) => (
                  <i key={k} data-lleno={k < semana ? '' : undefined} style={{ '--k': k } as CSSProperties} />
                ))}
              </span>
              <span className={p.soloLector}>
                {racha.mejor >= 7 ? '' : `${semana} de 7 para la semana entera, que da +${PUNTOS.racha7} puntos.`}
              </span>
            </p>
          )}
          <p className={p.frase}>
            {soloPrecurso && cursoBloqueado
              ? 'Tu formación empieza con el precurso y los dosieres: ya puedes leerlos. Las clases en vídeo del curso estarán disponibles una vez terminada la clase presencial.'
              : cuentan.length === 0
              ? 'Tu espacio está abierto. En cuanto Sorela publique tus clases, aparecen aquí.'
              : hechas === 0
                ? 'Tu formación te está esperando. Empieza por la primera clase, a tu ritmo.'
                : hechas === cuentan.length
                  ? 'Has terminado todas las clases. Repasa cuando quieras: las manos se afinan repitiendo.'
                  : `Llevas ${hechas} de ${cuentan.length} clases. Sigue así: cada sesión se nota en las manos.`}
          </p>
          {/* Con la misión, siempre a un toque de su clase siguiente, aunque la misión sea otra cosa. */}
          {mision ? (
            <TarjetaMision
              m={mision}
              r={puntos}
              soloVer={muestra}
              otraClase={mision.id !== 'clase' && sigPendiente ? { titulo: sigPendiente.titulo, empezada: pctSig > 0 } : null}
              ir={ir}
            />
          ) : sinLogros ? null : (
            <div className={p.misionEsqueleto} aria-busy="true" aria-label="Cargando tu próxima misión" />
          )}
        </div>
        <div className={p.heroProgreso}>
          {/* Con el abono y todo esperando a la parte práctica, el candado en vez de un 0 %. */}
          <Anillo valor={pct} bloqueado={conCurso && cursoBloqueado} />
          <div className={p.datos}>
            <span>
              <b>
                <ContadorPuntos valor={hechas} />
              </b>{' '}
              {hechas === 1 ? 'clase hecha' : 'clases hechas'}
            </span>
            <span>
              <b>
                <ContadorPuntos valor={minutosVistos} />
              </b>{' '}
              min de estudio
            </span>
            {conCurso && (
              <span>
                <b>{pct === 100 ? 'Listo' : 'Al 100 %'}</b> tu certificado
              </span>
            )}
          </div>
        </div>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className={p.heroFoto} />
        )}
      </motion.section>

      {/* ---------- Tu camino: dónde está y qué le toca ---------- */}
      <TuCamino rutas={rutas} soloVer={muestra} />

      {/* ---------- Tu nivel: la barra grande, sus trofeos y de dónde vienen ---------- */}
      <motion.section
        className={`${p.tarjeta} ${p.oscura} ${p.nivel}`}
        {...aparecer(2)}
        aria-labelledby="panel-tu-nivel"
        data-brilla={brilla ? '' : undefined}
      >
        <div className={p.nivelIzquierda}>
          <header className={`${p.cabecera} ${p.nivelCabecera}`}>
            {puntos && <InsigniaNivel n={puntos.nivel.n} size={58} className={p.nivelInsignia} title={`Nivel ${puntos.nivel.n}: ${puntos.nivel.nombre}`} />}
            <h3 id="panel-tu-nivel">Tu nivel</h3>
            {puntos && (
              <span className={p.nivelTotal}>
                <ContadorPuntos valor={puntos.total} desde={desde} />
                <small>puntos</small>
              </span>
            )}
          </header>
          {puntos ? (
            <>
              <BarraNivel total={puntos.total} desde={desde} tamano="grande" />
              <CaminoNiveles total={puntos.total} />
            </>
          ) : (
            <div className={p.esqueletoOscuro} aria-busy="true" aria-label="Cargando tus puntos" />
          )}
          {/* Sin membresía, sin las vitrinas de la Comunidad: para ella aún no existe. */}
          <VitrinaMini logros={trofeos} soloVer={muestra} sinComunidad={!miembro} />
        </div>
        <div className={p.nivelDerecha}>
          <div className={p.deDonde}>
            <p className={p.rotuloOro}>De dónde vienen tus puntos</p>
            {puntos ? <DesglosePuntos desglose={puntos.desglose} /> : <div className={p.esqueletoOscuro} aria-busy="true" aria-label="Cargando tus puntos" />}
            <p className={p.nivelNota}>Salen de lo que haces aquí. Si algo se borra, sus puntos se van con ello.</p>
          </div>
          <button
            type="button"
            className={p.comoFunciona}
            onClick={() => {
              setNuevo(false);
              abrirComoFunciona();
            }}
          >
            <span className={p.comoIcono} aria-hidden="true">
              ?
            </span>
            <span className={p.comoTexto}>
              <strong>
                ¿Cómo funciona?
                {nuevo && <span className={p.nuevo}>Nuevo</span>}
              </strong>
              <em>Puntos, niveles y trofeos{miembro ? ', y el ranking del mes' : ''}, en un minuto</em>
            </span>
            <span className={p.comoFlecha} aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </motion.section>

      {/* ---------- Noticias: la apertura de la comunidad, en grande ---------- */}
      <Noticias yaEsMiembro={miembro} ir={ir} />

      <div className={p.rejilla}>
        {/* ---------- Clases ---------- */}
        <motion.section className={p.tarjeta} {...aparecer(3)}>
          <header className={p.cabecera}>
            <h3>Tus clases</h3>
            <button type="button" className={p.enlace} onClick={() => ir('aula')}>
              Ver todas →
            </button>
          </header>
          {lecciones === null ? (
            <div className={p.esqueleto} />
          ) : ordenadas.length === 0 ? (
            <p className={p.vacio}>
              Todavía no hay clases publicadas.
            </p>
          ) : (
            <ul className={p.clases}>
              {ordenadas.slice(0, 4).map((l) => {
                const pr = progreso[l.id];
                const v = pr?.completada ? 100 : l.duracion && pr?.visto ? Math.min(99, Math.round((pr.visto / l.duracion) * 100)) : 0;
                return (
                  <li key={l.id}>
                    <button type="button" onClick={() => ir('aula')}>
                      <span className={p.mini}>
                        {l.portada ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.portada} alt="" />
                        ) : null}
                      </span>
                      <span className={p.claseTexto}>
                        <strong>{l.titulo}</strong>
                        <em>{l.modulo}</em>
                      </span>
                      <span className={p.estado} data-hecha={pr?.completada ? '' : undefined}>
                        {l.bloqueada ? (
                          <>
                            <Candado size={14} />
                            <span className={p.soloLector}>Disponible al terminar la clase presencial</span>
                          </>
                        ) : pr?.completada ? '✓' : `${v}%`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>

        {/* ---------- Material ---------- */}
        <motion.section className={p.tarjeta} {...aparecer(4)}>
          <header className={p.cabecera}>
            <h3>Tu material</h3>
            <button type="button" className={p.enlace} onClick={() => ir('aula')}>
              Abrir →
            </button>
          </header>
          {docs.length === 0 ? (
            <p className={p.vacio}>Los dosieres de cada día aparecerán aquí.</p>
          ) : (
            <div className={p.dossieres}>
              {docs.map((d) => (
                <button key={d.id} type="button" className={p.dossier} onClick={() => ir('aula')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.portadaUrl} alt="" draggable={false} />
                  <span>
                    <strong>{d.titulo}</strong>
                    <em>{d.paginas} páginas</em>
                  </span>
                </button>
              ))}
            </div>
          )}
        </motion.section>

        {/* ---------- Agenda ---------- */}
        <motion.section className={p.tarjeta} {...aparecer(5)}>
          <header className={p.cabecera}>
            <h3>Tu agenda</h3>
            <button type="button" className={p.enlace} onClick={() => ir('agenda')}>
              {proximos.length ? 'Ver agenda →' : 'Apuntar algo →'}
            </button>
          </header>
          {eventos === null ? (
            <div className={p.esqueleto} />
          ) : proximos.length === 0 ? (
            <p className={p.vacio}>Nada apuntado. Tu agenda es para tus sesiones con clientas: apúntalas y te las recuerda.</p>
          ) : (
            <ul className={p.eventos}>
              {proximos.map((e) => (
                <li key={e.id}>
                  <span className={p.eventoDia}>
                    <b>{new Date(e.cuando!).getDate()}</b>
                    <em>{DIA_SEMANA.format(new Date(e.cuando!)).replace('.', '')}</em>
                  </span>
                  <span className={p.eventoTexto}>
                    <strong>{e.titulo}</strong>
                    <em>
                      {HORA.format(new Date(e.cuando!))} · {e.tipo}
                    </em>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* ---------- Comunidad ---------- */}
        <motion.section className={`${p.tarjeta} ${p.oscura}`} {...aparecer(6)}>
          <header className={p.cabecera}>
            <h3>Comunidad</h3>
            {miembro && (
              <button type="button" className={p.enlace} onClick={() => ir('comunidad')}>
                Entrar →
              </button>
            )}
          </header>
          {/* Sin membresía no se enseña nada de dentro: solo que viene. */}
          {!miembro ? (
            <p className={p.vacioClaro}>Próximamente. Se presenta en la masterclass de apertura.</p>
          ) : com?.proximaClase ? (
            <div className={p.claseVivo}>
              <span>Próxima clase en vivo</span>
              <strong>{com.proximaClase.titulo}</strong>
              <em>{mayus(DIA.format(new Date(com.proximaClase.cuando)))} · {HORA.format(new Date(com.proximaClase.cuando))}</em>
            </div>
          ) : null}
          {!miembro ? null : com && com.publicaciones.length > 0 ? (
            <ul className={p.posts}>
              {com.publicaciones.slice(0, 2).map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => ir('comunidad')}>
                    <strong>{x.titulo}</strong>
                    <em>
                      {x.autora.nombre} · {x.respuestas} {x.respuestas === 1 ? 'respuesta' : 'respuestas'}
                    </em>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={p.vacioClaro}>
              Sé la primera en compartir un caso.
            </p>
          )}
        </motion.section>
      </div>
    </div>
    </MotionConfig>
  );
}
