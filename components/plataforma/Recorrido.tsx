'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, type MotionValue } from 'framer-motion';
import { NIVELES, PUNTOS, formatoPuntos } from '@/lib/puntos-tipos';
import { LOGROS } from '@/lib/logros-tipos';
import { recorridoPendiente, type PasoRecorrido, type Recorrido as Guardado } from '@/lib/recorrido-tipos';
import { Icono, InsigniaNivel, Trofeo } from './IconosDivine';
import { hayPuntos } from './Puntos';
import s from './recorrido.module.css';

/**
 * El recorrido de bienvenida: la primera vez que alguien entra, la plataforma
 * se oscurece entera menos lo que se está explicando —el botón de Clases, el
 * de Comunidad, su marcador de puntos…—, que queda dentro de un aro de oro, y
 * al lado sale una tarjeta con lo que hay ahí, «Siguiente», «Atrás» y
 * «Saltar». Al terminarlo se gana su trofeo de bienvenida, «Exploradora
 * Divine», con sus puntos (lib/logros-tipos.ts, lib/puntos-tipos.ts): sale con
 * la Celebración de siempre, con su confeti. Es un trofeo como los demás (las
 * «insignias» de la plataforma son las de cada nivel).
 *
 * Qué se señala lo dicen los atributos `data-recorrido` que pone Plataforma.tsx
 * en sus botones. Cada paso busca el primero de los suyos que SE VE: el mismo
 * «nav-aula» está en la lateral del ordenador y en la barra de abajo del
 * móvil, y la que está escondida (o apartada, como el cajón cerrado del móvil)
 * no cuenta. Así se adapta solo al dispositivo, y al girar el móvil o cambiar
 * el tamaño de la ventana el aro se va a donde esté ahora. Los pasos también
 * dependen de lo que tenga en el menú: sin Comunidad no hay paso de Comunidad;
 * con solo el abono del curso, el de Clases dice que los vídeos esperan a la
 * parte práctica.
 *
 * Lo que se guarda va a su ficha por app/api/recorrido (nada en el
 * navegador): cada paso que ve, si lo termina o lo salta. Si cierra a medias,
 * la próxima vez sigue por donde iba. Se repite cuando quiera con el evento
 * `divine:recorrido` («Ver el recorrido», en el menú), sin volver a dar nada.
 *
 * Nunca dos capas a la vez:
 *   · Si la bienvenida (Onboarding.tsx) se abre al entrar, el recorrido espera
 *     a que se cierre (`divine:onboarding-cerrado`), y a que pase la fiesta
 *     de la Celebración si la hay.
 *   · Mientras está abierto marca `<body data-onboarding>`, la misma señal de
 *     la bienvenida: la Celebración guarda sus fiestas para después y la
 *     bienvenida no se abre encima. Y `data-recorrido`, por si alguien
 *     necesita distinguirlos.
 *   · Si hay otra ventana abierta («Cómo funciona», el lector de un dossier,
 *     el panel de puntos…), espera a que se cierre: nunca se abre encima.
 *
 * Teclado: las flechas y Enter avanzan y retroceden, Escape lo salta (en el
 * último paso solo lo cierra: no se pierde el trofeo por una tecla) y el
 * tabulador no sale de la tarjeta. Con «reducir movimiento», nada se desliza.
 * Sorela no lo tiene (no se monta: ver Plataforma.tsx).
 */

type Paso = {
  id: PasoRecorrido;
  /** Qué señalar: el primero de estos `data-recorrido` que se vea. Vacío: la tarjeta va al centro. */
  objetivo: string[];
  rotulo: string;
  titulo: string;
  texto: string;
};

/** Un rectángulo en la pantalla, con su radio. */
type Caja = { x: number; y: number; w: number; h: number; r: number };
type Geo = { caja: Caja | null; vw: number; vh: number; cw: number; ch: number; suave: boolean };

const TROFEO = LOGROS.find((l) => l.id === 'recorrido')?.nombre ?? 'Exploradora Divine';
/** Lo que trae terminarlo: sus puntos y los del trofeo. */
const PREMIO = PUNTOS.recorrido + PUNTOS.logro;

/** El aire alrededor de lo señalado, el hueco hasta la tarjeta y el margen con el borde. */
const AIRE = 6;
const HUECO = 14;
const MARGEN = 16;
const MUELLE = { type: 'spring' as const, stiffness: 340, damping: 34, mass: 0.9 };

function pasosDe(o: { grupos: string[]; miembro: boolean; bloqueadas: boolean; conAcceso: boolean; conCurso: boolean; hechoAntes: boolean }): Paso[] {
  const hay = (g: string) => o.grupos.includes(g);
  // Con un solo apartado no hay menú (Plataforma lo esconde): el inicio se explica en el centro.
  const conMenu = o.grupos.length > 1;
  const lista: Paso[] = [
    {
      id: 'inicio',
      objetivo: conMenu ? ['nav-inicio'] : [],
      rotulo: 'Inicio',
      titulo: o.conAcceso ? 'Tu panel' : 'Tu espacio',
      texto: o.conAcceso
        ? `Aquí ves de un vistazo cómo vas: ${o.conCurso ? 'tu formación, ' : ''}tu nivel, tus puntos y lo próximo que tienes. Desde aquí empiezas cada día.`
        : 'Ya tienes tu sitio dentro. En cuanto se abra tu formación, aquí verás tu panel con todo tu progreso.',
    },
  ];
  if (hay('aula'))
    lista.push({
      id: 'aula',
      objetivo: ['nav-aula'],
      rotulo: 'Clases',
      titulo: 'Tus clases y tu material',
      texto: o.bloqueadas
        ? 'El precurso y los dosieres ya están abiertos: léelos con calma. Las clases en vídeo del curso se desbloquean una vez completada la parte práctica.'
        : `Tus clases en orden, con su material. Sigue donde lo dejaste: cada clase que terminas suma +${PUNTOS.clase} puntos.`,
    });
  if (hay('comunidad'))
    lista.push({
      id: 'comunidad',
      objetivo: ['nav-comunidad'],
      rotulo: 'Comunidad',
      titulo: o.miembro ? 'Tu comunidad' : 'La Comunidad Divine',
      // Sin membresía no se cuenta lo que hay dentro: solo que llega.
      texto: o.miembro
        ? `Comparte tus casos, responde a tus compañeras y sigue el ranking del mes. Publicar suma +${PUNTOS.publicacion} y responder, +${PUNTOS.respuesta}.`
        : 'Llegará pronto. Cuando se abra, aquí tendrás tu sitio con las demás terapeutas.',
    });
  if (hay('agenda'))
    lista.push({
      id: 'agenda',
      objetivo: ['nav-agenda'],
      rotulo: 'Agenda',
      titulo: 'Tu agenda',
      texto: o.conCurso
        ? 'Tus fechas de formación salen aquí solas, en tu calendario. Y puedes apuntar tus propias citas.'
        : 'Tus citas y tus sesiones con clientas, en tu calendario: apúntalas y te las recuerda.',
    });
  lista.push(
    {
      id: 'perfil',
      // En el menú si lo tiene; si no, su foto de arriba, que lleva al perfil.
      objetivo: ['nav-perfil', 'avatar'],
      rotulo: 'Perfil',
      titulo: 'Tu perfil',
      texto: `Tu foto, quién eres y tu vitrina de trofeos. Cada trofeo que ganas suma +${PUNTOS.logro} puntos.`,
    },
    {
      id: 'puntos',
      objetivo: ['puntos'],
      rotulo: 'Tus puntos',
      titulo: 'Así subes de nivel',
      // «Cada clase», solo a quien tiene clases (aunque esperen a la parte práctica).
      texto: `Todo suma: cada día que entras (+${PUNTOS.dia}), ${o.conAcceso && hay('aula') ? 'cada clase que terminas, ' : ''}completar tu perfil (+${PUNTOS.perfil})… Ábrelo cuando quieras para ver de dónde sale cada punto.`,
    },
    {
      id: 'final',
      objetivo: [],
      rotulo: 'Último paso',
      titulo: o.hechoAntes ? 'Ya lo conoces todo' : '¡Ya conoces tu espacio!',
      texto: o.hechoAntes
        ? `Tu trofeo «${TROFEO}» ya está en tu vitrina. Vuelve a este recorrido cuando quieras desde el menú.`
        : `Termina el recorrido y llévate tu trofeo de bienvenida, «${TROFEO}», con +${formatoPuntos(PREMIO)} puntos.`,
    }
  );
  return lista;
}

/** Si algo de lo de alrededor va fijo o pegado en la pantalla (la barra del móvil, la lateral del ordenador). */
function vaFijo(el: HTMLElement): boolean {
  for (let x: HTMLElement | null = el; x && x !== document.body; x = x.parentElement) {
    const p = getComputedStyle(x).position;
    if (p === 'fixed' || p === 'sticky') return true;
  }
  return false;
}

/**
 * Lo señalado, a la vista: si está fuera (por arriba o por abajo), se lleva al
 * centro. Lo que va fijo o pegado no se lleva con la página (eso la movía por
 * detrás de la capa, cientos de píxeles): como mucho se desplaza la caja que
 * lo lleva dentro, la lateral en una pantalla baja.
 */
function aLaVista(el: HTMLElement, suave: boolean) {
  const r = el.getBoundingClientRect();
  if (r.top >= 64 && r.bottom <= window.innerHeight - 88) return;
  const behavior: ScrollBehavior = suave ? 'smooth' : 'auto';
  if (!vaFijo(el)) return el.scrollIntoView({ block: 'center', behavior });
  for (let x = el.parentElement; x && x !== document.body; x = x.parentElement) {
    const o = getComputedStyle(x).overflowY;
    if ((o === 'auto' || o === 'scroll') && x.scrollHeight > x.clientHeight) {
      const c = x.getBoundingClientRect();
      x.scrollBy({ top: r.top + r.height / 2 - (c.top + c.height / 2), behavior });
      return;
    }
  }
}

/** Lo que se ve de verdad: ni escondido, ni dentro de algo inerte, ni apartado fuera de la pantalla. */
function seVe(el: HTMLElement): boolean {
  if (el.closest('[inert]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  return r.right > 0 && r.left < window.innerWidth;
}

function buscar(ids: string[]): HTMLElement | null {
  for (const id of ids) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-recorrido="${id}"]`)) if (seVe(el)) return el;
  }
  return null;
}

/** El radio del aro: el del propio elemento o, si es una envoltura sin esquinas, el de lo que lleva dentro. */
function radioDe(el: HTMLElement): number {
  const de = (x: Element) => parseFloat(getComputedStyle(x).borderTopLeftRadius) || 0;
  const propio = de(el);
  return propio || (el.firstElementChild ? de(el.firstElementChild) : 0);
}

/**
 * Dónde va la tarjeta: al lado de lo señalado si cabe (la lateral del
 * ordenador), si no debajo, si no encima; y si no cabe en ningún sitio, abajo
 * del todo. Nunca fuera de la pantalla.
 */
function colocar(caja: Caja | null, cw: number, ch: number, vw: number, vh: number): { left: number; top: number } {
  const enX = (x: number) => Math.max(MARGEN, Math.min(x, vw - cw - MARGEN));
  const enY = (y: number) => Math.max(MARGEN, Math.min(y, vh - ch - MARGEN));
  if (!caja) return { left: enX((vw - cw) / 2), top: enY((vh - ch) / 2) };
  if (vw - (caja.x + caja.w) >= cw + HUECO + MARGEN && caja.w < vw * 0.45) {
    return { left: caja.x + caja.w + HUECO, top: enY(caja.y + caja.h / 2 - ch / 2) };
  }
  const left = enX(caja.x + caja.w / 2 - cw / 2);
  if (vh - (caja.y + caja.h) >= ch + HUECO + MARGEN) return { left, top: caja.y + caja.h + HUECO };
  if (caja.y >= ch + HUECO + MARGEN) return { left, top: caja.y - HUECO - ch };
  return { left, top: enY(vh - ch - MARGEN) };
}

const casiIgual = (a: number, b: number) => Math.abs(a - b) < 0.5;
const mismaCaja = (a: Caja | null, b: Caja | null) =>
  a === b || (!!a && !!b && casiIgual(a.x, b.x) && casiIgual(a.y, b.y) && casiIgual(a.w, b.w) && casiIgual(a.h, b.h) && casiIgual(a.r, b.r));

/**
 * Otra ventana abierta que no sea la tarjeta del recorrido: «Cómo funciona»,
 * el lector de un dossier, una pregunta… (las que se declaran modales).
 */
const otraVentana = () => Boolean(document.querySelector('[aria-modal="true"]:not([data-recorrido-carta]), [role="alertdialog"]'));

/** Libre: ni la bienvenida, ni una fiesta, ni otra ventana abiertas. */
const libre = () => !document.body.hasAttribute('data-onboarding') && !document.querySelector('[data-celebracion]') && !otraVentana();

/** Lo que se dice si no se ha podido guardar el final, según lo que conteste el servidor. */
function textoFallo(motivo: unknown): string {
  if (motivo === 'sin-sesion') return 'Tu sesión ha caducado. Vuelve a entrar y termínalo desde el menú, en «Ver el recorrido».';
  if (motivo === 'sin-ficha') return 'No encuentro tu cuenta. Vuelve a entrar y termínalo desde el menú, en «Ver el recorrido».';
  return 'No se ha podido guardar. Revisa la conexión y vuelve a pulsar.';
}

async function enviar(cuerpo: Record<string, unknown>): Promise<{ ok?: boolean; primeraVez?: boolean; motivo?: string } | null> {
  try {
    const r = await fetch('/api/recorrido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      // Que llegue aunque cierre la pestaña justo después de «Saltar».
      keepalive: true,
    });
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

export default function Recorrido({
  inicial,
  esperarBienvenida = false,
  grupos,
  miembro,
  bloqueadas,
  conAcceso,
  conCurso = false,
  nombre,
  alAbrir,
  alTerminar,
  alSaltar,
}: {
  /** Cómo lo dejó, leído por el servidor al entrar. null: no se sabe (no se abre solo). */
  inicial: Guardado | null;
  /** Si la bienvenida se va a abrir al entrar: el recorrido va después. */
  esperarBienvenida?: boolean;
  /** Los apartados de su menú (ids de gruposDe), para saber qué pasos tiene. */
  grupos: string[];
  miembro: boolean;
  /** Si sus clases en vídeo esperan a la parte práctica (solo el abono del curso). */
  bloqueadas: boolean;
  conAcceso: boolean;
  /** Si tiene algún curso (aunque sea con el abono): sin él no se le habla de su formación. */
  conCurso?: boolean;
  nombre: string;
  /** Al abrirse: Plataforma cierra el cajón del móvil, si estaba abierto. */
  alAbrir?: () => void;
  /** Al terminarlo (no al saltarlo). */
  alTerminar?: () => void;
  /** Al saltarlo sin haberlo terminado nunca: su panel deja de ponérselo de primera misión. */
  alSaltar?: () => void;
}) {
  const reducir = useReducedMotion() ?? false;
  const [montado, setMontado] = useState(false);
  const [estado, setEstado] = useState<Guardado>(inicial ?? { estado: null, paso: null, pasos: [], hecho: false });
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [visible, setVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const [anuncio, setAnuncio] = useState('');
  const [pista, setPista] = useState(false);
  // Si la bienvenida ya no está en medio (o no la había).
  const [listo, setListo] = useState(!esperarBienvenida);

  const idTitulo = useId();
  const idTexto = useId();
  const carta = useRef<HTMLDivElement>(null);
  const botonSeguir = useRef<HTMLButtonElement>(null);
  const volverA = useRef<HTMLElement | null>(null);
  const intentado = useRef(false);
  const colocada = useRef(false);
  const ultimoCambio = useRef(0);
  // Los pasos que aún se están guardando: el final espera a que lleguen (el servidor los pide).
  const guardando = useRef(new Set<Promise<unknown>>());
  // Los que ha visto en esta visita, por si alguno no llegó a guardarse (ver `terminar`).
  const vistos = useRef(new Set<PasoRecorrido>());

  // El aro (posición, tamaño y radio) y la tarjeta, en valores de movimiento:
  // al cambiar de paso se deslizan con muelle; al desplazar la página, siguen al momento.
  const fx = useMotionValue(0);
  const fy = useMotionValue(0);
  const fw = useMotionValue(0);
  const fh = useMotionValue(0);
  const fr = useMotionValue(0);
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);

  // Las listas que llegan por props cambian de identidad en cada pintado; se comparan por contenido.
  const clave = grupos.join(',');
  const pasos = useMemo(
    () => pasosDe({ grupos: clave.split(','), miembro, bloqueadas, conAcceso, conCurso, hechoAntes: estado.hecho }),
    [clave, miembro, bloqueadas, conAcceso, conCurso, estado.hecho]
  );
  const total = pasos.length;
  const paso = pasos[Math.min(i, total - 1)];
  const ultimo = i >= total - 1;
  const pila = nombre.trim().split(/\s+/)[0] || '';

  // Las funciones del teclado y de las medidas leen siempre lo último.
  const pasosRef = useRef(pasos);
  const iRef = useRef(i);
  const abiertoRef = useRef(abierto);
  // Los avisos a Plataforma llegan como funciones nuevas en cada pintado: por referencia, para que `abrir` no cambie.
  const avisos = useRef({ alAbrir, alTerminar, alSaltar });
  /* De diseño, y declarado antes que los demás: las medidas (también de
     diseño, más abajo) tienen que leer ya el paso nuevo, no el anterior. */
  useLayoutEffect(() => {
    pasosRef.current = pasos;
    iRef.current = i;
    abiertoRef.current = abierto;
    avisos.current = { alAbrir, alTerminar, alSaltar };
  });

  useEffect(() => setMontado(true), []);

  /* ------------------------------------------------------------ abrir y cerrar */

  const abrir = useCallback(
    (desde: PasoRecorrido | null) => {
      intentado.current = true;
      const k = desde && desde !== 'final' ? pasosRef.current.findIndex((p) => p.id === desde) : -1;
      // El aro sale del centro de la pantalla hacia el primer paso.
      fx.set(window.innerWidth / 2);
      fy.set(window.innerHeight / 2);
      fw.set(0);
      fh.set(0);
      colocada.current = false;
      ultimoCambio.current = performance.now();
      setVisible(false);
      setGeo(null);
      setFallo('');
      setAnuncio('');
      setPista(false);
      setI(Math.max(0, k));
      setAbierto(true);
      avisos.current.alAbrir?.();
      /* Su marcador de puntos se señala en un paso: que tenga sus puntos aunque
         la Celebración, que es quien los reparte, espere a que esto se cierre.
         Casi siempre ya han llegado (la Celebración mira al entrar): entonces
         no se piden otra vez, que es la petición más cara de la plataforma. */
      if (!hayPuntos())
        fetch('/api/logros')
          .then((r) => r.json())
          .then((j) => {
            if (j?.ok && j.puntos) window.dispatchEvent(new CustomEvent('divine:puntos', { detail: j.puntos }));
            if (j?.ok && Array.isArray(j.logros)) window.dispatchEvent(new CustomEvent('divine:trofeos', { detail: j.logros }));
            if (j?.ok && j.racha) window.dispatchEvent(new CustomEvent('divine:racha', { detail: j.racha }));
          })
          .catch(() => null);
    },
    [fx, fy, fw, fh]
  );

  /* Se abre solo una vez por visita, si está pendiente: después de la
     bienvenida (si la hay) y con un respiro al entrar, para que se vea dónde
     se está. Si en ese momento hay una fiesta u otra ventana abierta, espera a
     que se cierre (el vigía ve cuándo se quita del <body>). */
  useEffect(() => {
    if (listo) return;
    const alCerrar = () => setListo(true);
    window.addEventListener('divine:onboarding-cerrado', alCerrar);
    // Por si la bienvenida no llegara a abrirse: pasado un rato, se mira igual.
    const t = setTimeout(() => !document.body.hasAttribute('data-onboarding') && setListo(true), 8000);
    return () => {
      window.removeEventListener('divine:onboarding-cerrado', alCerrar);
      clearTimeout(t);
    };
  }, [listo]);

  const pendiente = recorridoPendiente(inicial) && recorridoPendiente(estado);
  const desdeGuardado = inicial?.paso ?? null;
  useEffect(() => {
    if (!listo || !pendiente || intentado.current) return;
    let vigia: MutationObserver | null = null;
    let t: ReturnType<typeof setTimeout>;
    let ronda: ReturnType<typeof setInterval> | undefined;
    const parar = () => {
      vigia?.disconnect();
      clearInterval(ronda);
    };
    const probar = () => {
      if (intentado.current || abiertoRef.current) return parar();
      if (!libre()) return;
      parar();
      abrir(desdeGuardado);
    };
    t = setTimeout(() => {
      probar();
      if (intentado.current) return;
      vigia = new MutationObserver(() => {
        clearTimeout(t);
        t = setTimeout(probar, 500);
      });
      vigia.observe(document.body, { childList: true, attributes: true, attributeFilter: ['data-onboarding'] });
      // Por si lo que estaba abierto se cierra sin tocar el <body> (el lector va dentro de la página).
      ronda = setInterval(probar, 2500);
    }, esperarBienvenida ? 1600 : 1100);
    return () => {
      clearTimeout(t);
      parar();
    };
  }, [listo, pendiente, desdeGuardado, abrir, esperarBienvenida]);

  // «Ver el recorrido»: a mano, cuando quiera, desde el principio. No da nada otra vez.
  useEffect(() => {
    const alPedir = () => {
      if (abiertoRef.current || document.body.hasAttribute('data-onboarding') || otraVentana()) return;
      enviar({ accion: 'repetir' });
      abrir(null);
    };
    window.addEventListener('divine:recorrido', alPedir);
    return () => window.removeEventListener('divine:recorrido', alPedir);
  }, [abrir]);

  /* Mientras está abierto: la marca en <body> (ver arriba). Al cerrarse, el
     foco vuelve a donde estaba. */
  useEffect(() => {
    if (!abierto) return;
    const b = document.body;
    b.setAttribute('data-onboarding', '');
    b.setAttribute('data-recorrido', '');
    // Se apunta aquí y no al pulsar: si se abrió desde el cajón del móvil, el cajón ya ha devuelto el foco a su botón.
    const a = document.activeElement;
    volverA.current = a instanceof HTMLElement && a !== b ? a : null;
    const t = setTimeout(() => botonSeguir.current?.focus({ preventScroll: true }), reducir ? 0 : 260);
    return () => {
      clearTimeout(t);
      b.removeAttribute('data-recorrido');
      b.removeAttribute('data-onboarding');
      const v = volverA.current;
      volverA.current = null;
      if (v?.isConnected && !v.closest('[inert]')) v.focus({ preventScroll: true });
      // Si lo que lo abrió ya no está (el «Empezar» del panel de puntos, que se cierra), al marcador o al título.
      else (buscar(['puntos'])?.querySelector<HTMLElement>('button') ?? document.querySelector<HTMLElement>('main h1, main h2'))?.focus({ preventScroll: true });
    };
  }, [abierto, reducir]);

  /* ------------------------------------------------------------ pasos */

  const idActual = abierto ? paso?.id : undefined;
  const yaHecho = estado.hecho;
  /* Cada paso que ve se guarda (y así, si cierra a medias, sigue por ahí).
     Repitiéndolo ya hecho no se guarda nada: no cambia nada. */
  useEffect(() => {
    if (!idActual || yaHecho) return;
    vistos.current.add(idActual);
    const p = enviar({ accion: 'paso', paso: idActual });
    const pendientes = guardando.current;
    pendientes.add(p);
    p.finally(() => pendientes.delete(p));
    setEstado((e) => (e.estado === null ? { ...e, estado: 'en-curso' } : e));
  }, [idActual, yaHecho]);

  const siguiente = () => {
    if (enviando) return;
    if (ultimo) return terminar();
    cambiar(i + 1);
  };
  const atras = () => i > 0 && !enviando && cambiar(i - 1);

  function cambiar(k: number) {
    ultimoCambio.current = performance.now();
    setFallo('');
    setI(k);
    const p = pasos[k];
    if (p) setAnuncio(`Paso ${k + 1} de ${total}: ${p.titulo}. ${p.texto}`);
  }

  function saltar() {
    if (enviando) return;
    if (!estado.hecho) {
      enviar({ accion: 'saltar', paso: paso?.id });
      setEstado((e) => ({ ...e, estado: 'saltado' }));
      // La primera vez que lo salta, una pista de dónde está para cuando quiera.
      setPista(true);
      avisos.current.alSaltar?.();
    }
    setAbierto(false);
  }

  /* Cerrar sin más: ni se guarda ni cuenta como «Saltar». En el último paso
     (Escape, o «Cerrar» si no se ha podido guardar): quien ha llegado hasta
     ahí no pierde su trofeo por una tecla; la próxima vez se le vuelve a abrir. */
  function cerrar() {
    if (enviando) return;
    setAbierto(false);
  }

  async function terminar() {
    setEnviando(true);
    setFallo('');
    // Los pasos que se están guardando, antes: el servidor mira que haya pasado por ellos.
    await Promise.allSettled([...guardando.current]);
    let r = await enviar({ accion: 'hecho' });
    /* Si alguno de los que ha visto no llegó a guardarse (un corte de red a
       medio camino), se mandan otra vez y se prueba una vez más. */
    if (r?.motivo === 'sin-pasos') {
      await Promise.allSettled([...vistos.current].map((x) => enviar({ accion: 'paso', paso: x })));
      r = await enviar({ accion: 'hecho' });
    }
    setEnviando(false);
    if (!r?.ok) {
      setFallo(textoFallo(r?.motivo));
      return;
    }
    const nueva = !estado.hecho || Boolean(r.primeraVez);
    setEstado((e) => ({ ...e, estado: 'hecho', hecho: true }));
    setAbierto(false);
    avisos.current.alTerminar?.();
    /* Ya cerrado (sin la marca en <body>), la Celebración mira y saca el trofeo
       con su confeti y sus puntos. Se le da el tiempo de la salida. */
    if (nueva) setTimeout(() => window.dispatchEvent(new Event('divine:logros')), reducir ? 60 : 380);
  }

  // El teclado llama siempre a la última versión.
  const acciones = useRef({ siguiente, atras, saltar, cerrar });
  useEffect(() => {
    acciones.current = { siguiente, atras, saltar, cerrar };
  });

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      // Si otra ventana ya lo ha atendido o está encima, la tecla es suya.
      if (e.defaultPrevented || otraVentana()) return;
      const c = carta.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (iRef.current >= pasosRef.current.length - 1) acciones.current.cerrar();
        else acciones.current.saltar();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        acciones.current.siguiente();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        acciones.current.atras();
      } else if (e.key === 'Enter') {
        // Sobre un botón de la tarjeta, Enter ya lo pulsa él.
        if (document.activeElement instanceof HTMLButtonElement && c?.contains(document.activeElement)) return;
        e.preventDefault();
        acciones.current.siguiente();
      } else if (e.key === 'Tab' && c) {
        const enfocables = [...c.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')];
        if (!enfocables.length) return;
        const primero = enfocables[0];
        const final = enfocables[enfocables.length - 1];
        if (!c.contains(document.activeElement)) {
          e.preventDefault();
          primero.focus();
        } else if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          final.focus();
        } else if (!e.shiftKey && document.activeElement === final) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto]);

  // Si el foco se ha quedado fuera (el «Atrás» desaparece en el primer paso), vuelve a «Siguiente».
  useEffect(() => {
    if (!abierto || !visible) return;
    const c = carta.current;
    if (c && !c.contains(document.activeElement)) botonSeguir.current?.focus({ preventScroll: true });
  }, [abierto, visible, i]);

  /* ------------------------------------------------------------ medir y colocar */

  const medir = useCallback(() => {
    const p = pasosRef.current[iRef.current];
    if (!p) return;
    const el = buscar(p.objetivo);
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let caja: Caja | null = null;
    if (el) {
      const r = el.getBoundingClientRect();
      const w = r.width + AIRE * 2;
      const h = r.height + AIRE * 2;
      caja = { x: r.left - AIRE, y: r.top - AIRE, w, h, r: Math.min(Math.max(radioDe(el) + AIRE, 12), w / 2, h / 2) };
    }
    const cw = carta.current?.offsetWidth ?? Math.min(360, vw - 32);
    const ch = carta.current?.offsetHeight ?? 260;
    // Durante el cambio de paso (y el desplazamiento que lo acompaña), con muelle; después, al momento.
    const suave = performance.now() - ultimoCambio.current < 520;
    setGeo((g) =>
      g && mismaCaja(g.caja, caja) && g.vw === vw && g.vh === vh && casiIgual(g.cw, cw) && casiIgual(g.ch, ch)
        ? g
        : { caja, vw, vh, cw, ch, suave }
    );
  }, []);

  // Antes de pintar: así la tarjeta sale ya en su sitio.
  useLayoutEffect(() => {
    if (abierto) medir();
  }, [abierto, i, medir]);

  // Lo señalado, a la vista (ver aLaVista).
  useEffect(() => {
    if (!abierto) return;
    const el = buscar(paso?.objetivo ?? []);
    if (el) aLaVista(el, !reducir);
  }, [abierto, i, paso, reducir]);

  // Al cambiar el tamaño, girar el móvil, desplazar (la página o la lateral) o cambiar de alto la tarjeta.
  useEffect(() => {
    if (!abierto) return;
    let raf = 0;
    const pedir = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(medir);
    };
    window.addEventListener('resize', pedir);
    window.addEventListener('scroll', pedir, { capture: true, passive: true });
    const vigia = new ResizeObserver(pedir);
    if (carta.current) vigia.observe(carta.current);
    const el = buscar(pasosRef.current[iRef.current]?.objetivo ?? []);
    if (el) vigia.observe(el);
    // La lateral y la píldora del menú se asientan en unos 300 ms: se mira otra vez.
    const t = setTimeout(pedir, 340);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener('resize', pedir);
      window.removeEventListener('scroll', pedir, { capture: true });
      vigia.disconnect();
    };
  }, [abierto, i, medir]);

  useLayoutEffect(() => {
    if (!abierto || !geo) return;
    const c = geo.caja ?? { x: geo.vw / 2, y: geo.vh / 2, w: 0, h: 0, r: 0 };
    const { left, top } = colocar(geo.caja, geo.cw, geo.ch, geo.vw, geo.vh);
    // La primera vez, la tarjeta aparece ya en su sitio; el aro sí viaja desde el centro.
    if (!colocada.current) {
      cx.set(left);
      cy.set(top);
      colocada.current = true;
      setVisible(true);
    }
    const pares: [MotionValue<number>, number][] = [
      [fx, c.x],
      [fy, c.y],
      [fw, c.w],
      [fh, c.h],
      [fr, c.r],
      [cx, left],
      [cy, top],
    ];
    const conMuelle = geo.suave && !reducir;
    const vivas = pares.map(([v, n]) => (conMuelle ? animate(v, n, MUELLE) : (v.set(n), null)));
    return () => vivas.forEach((a) => a?.stop());
  }, [abierto, geo, reducir, fx, fy, fw, fh, fr, cx, cy]);

  // Al pulsar dentro del aro, se avanza: lo señalado «responde».
  function alPulsarCapa(e: MouseEvent<HTMLDivElement>) {
    const c = geo?.caja;
    if (!c || e.target !== e.currentTarget) return;
    if (e.clientX >= c.x && e.clientX <= c.x + c.w && e.clientY >= c.y && e.clientY <= c.y + c.h) siguiente();
  }

  // La pista de después de saltarlo se va sola.
  useEffect(() => {
    if (!pista) return;
    const t = setTimeout(() => setPista(false), 6000);
    return () => clearTimeout(t);
  }, [pista]);

  if (!montado || !paso) return null;

  /* ------------------------------------------------------------ pintar */

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {abierto && (
          <motion.div
            key="recorrido"
            className={s.capa}
            onClick={alPulsarCapa}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducir ? 0 : 0.28 }}
          >
            <motion.span
              className={s.foco}
              data-vacio={geo?.caja ? undefined : ''}
              style={{ x: fx, y: fy, width: fw, height: fh, borderRadius: fr }}
              aria-hidden="true"
            />

            <motion.div
              ref={carta}
              className={s.carta}
              data-recorrido-carta=""
              role="dialog"
              aria-modal="true"
              aria-labelledby={idTitulo}
              aria-describedby={idTexto}
              style={{ x: cx, y: cy }}
              initial={{ opacity: 0, scale: reducir ? 1 : 0.96 }}
              animate={{ opacity: visible ? 1 : 0, scale: visible || reducir ? 1 : 0.96 }}
              exit={{ opacity: 0, scale: reducir ? 1 : 0.98 }}
              transition={{ duration: reducir ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={s.cabeza}>
                <span className={s.rotulo}>
                  {paso.rotulo}
                  <span className={s.cuenta}>
                    {' '}
                    · {i + 1} de {total}
                  </span>
                </span>
                {!ultimo && (
                  <button type="button" className={s.saltar} onClick={saltar} disabled={enviando}>
                    Saltar
                  </button>
                )}
              </div>

              <motion.div
                key={paso.id}
                className={s.contenido}
                initial={reducir ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                {i === 0 && !estado.hecho && (
                  <p className={s.saludo}>
                    {pila ? `Bienvenida, ${pila}.` : 'Bienvenida.'} En un minuto te enseño tu espacio.
                  </p>
                )}
                <h2 className={s.titulo} id={idTitulo}>
                  {paso.titulo}
                </h2>
                <p className={s.texto} id={idTexto}>
                  {paso.texto}
                </p>

                {paso.id === 'puntos' && (
                  <div className={s.niveles}>
                    <ol className={s.nivelesFila} aria-label={`Los ${NIVELES.length} niveles`}>
                      {NIVELES.map((n, k) => (
                        <motion.li
                          key={n.n}
                          initial={reducir ? false : { opacity: 0, y: 6, scale: 0.8 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: 0.08 + k * 0.06, type: 'spring', stiffness: 420, damping: 22 }}
                        >
                          <InsigniaNivel n={n.n} size={34} title={`Nivel ${n.n}: ${n.nombre}`} />
                        </motion.li>
                      ))}
                    </ol>
                    <p className={s.nivelesPie}>
                      De «{NIVELES[0].nombre}» a «{NIVELES[NIVELES.length - 1].nombre}»
                    </p>
                  </div>
                )}

                {paso.id === 'final' && (
                  <div className={s.insignia} data-hecha={estado.hecho ? '' : undefined}>
                    <motion.span
                      className={s.insigniaCopa}
                      initial={reducir ? false : { scale: 0.5, rotate: -10, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
                    >
                      <Trofeo escalon="bronce" glifo="brujula" size={64} title={`Trofeo ${TROFEO}`} />
                    </motion.span>
                    <span className={s.insigniaTexto}>
                      <span className={s.insigniaRotulo}>{estado.hecho ? 'Ya es tuyo' : 'Tu trofeo de bienvenida'}</span>
                      <span className={s.insigniaNombre}>{TROFEO}</span>
                      {!estado.hecho && <span className={s.premio}>+{formatoPuntos(PREMIO)} pts</span>}
                    </span>
                  </div>
                )}
              </motion.div>

              {fallo && (
                <p className={s.fallo} role="alert">
                  {fallo}
                </p>
              )}

              {/* Los puntitos del camino: el de ahora, alargado; los ya vistos, en oro. */}
              <ol className={s.camino} aria-hidden="true">
                {pasos.map((p, k) => (
                  <li key={p.id} data-hecho={k < i ? '' : undefined} data-ahora={k === i ? '' : undefined} />
                ))}
              </ol>

              <div className={s.botones}>
                {/* Si el final no se ha podido guardar, se puede salir igual (y volver desde el menú). */}
                {ultimo && fallo ? (
                  <button type="button" className={s.atras} onClick={cerrar} disabled={enviando}>
                    Cerrar
                  </button>
                ) : (
                  i > 0 && (
                    <button type="button" className={s.atras} onClick={atras} disabled={enviando}>
                      Atrás
                    </button>
                  )
                )}
                <button
                  ref={botonSeguir}
                  type="button"
                  className={s.seguir}
                  onClick={siguiente}
                  disabled={enviando}
                  data-oro={ultimo && !estado.hecho ? '' : undefined}
                >
                  {enviando ? 'Guardando…' : ultimo ? (estado.hecho ? 'Terminar' : 'Recoger mi trofeo') : 'Siguiente'}
                  {!ultimo && !enviando && (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                  {ultimo && !estado.hecho && !enviando && <Icono nombre="logros" size={17} grosor={1.8} />}
                </button>
              </div>

              <p className={s.oculto} aria-live="polite">
                {anuncio}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pista && !abierto && (
          <motion.p
            key="pista"
            className={s.pista}
            role="status"
            initial={reducir ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducir ? 0 : 0.3 }}
          >
            <Icono nombre="brujula" size={18} />
            <span>
              Cuando quieras, lo tienes en el menú: <b>Ver el recorrido</b>.
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body
  );
}
