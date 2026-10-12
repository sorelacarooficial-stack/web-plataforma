'use client';

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import InfoPrivacidad from '@/components/InfoPrivacidad';
import { fotoCuadrada } from '@/lib/imagen-cliente';
import { PREFIJOS, regionProbable, telefonoCompleto } from '@/lib/prefijos';
import { CAPA_FICHA, DESTINATARIOS_FICHA } from '@/lib/privacidad';
import { PUNTOS } from '@/lib/puntos-tipos';
import {
  ESPECIALIDADES,
  FICHA_VACIA,
  LIMITES,
  PAISES,
  TEXTO_CONSENTIMIENTO,
  TRATAMIENTOS_FICHA,
  avisoProhibida,
  buscarProhibida,
  enlaceWhatsapp,
  fichaPublicaDe,
  normalizarInstagram,
  type DatosFicha,
  type ErroresFicha,
  type Ficha,
  type FichaPublica,
} from '@/lib/fichas-tipos';
import { TarjetaTerapeuta } from '@/components/ExploradorTerapeutas';
import { useConfirmar } from './Confirmar';
import o from './onboarding.module.css';

/**
 * El onboarding: dejar el perfil listo y, si es miembro, su ficha en el mapa.
 *
 * Una ventana por pasos, con una barra que se llena según rellena (no según
 * pulsa «Continuar»): cada foto, cada frase, cada tratamiento la empuja un
 * poco, y al final esperan los puntos. Es lo que hace que se termine.
 *
 *   Miembro:     Foto → Sobre ti → Dónde trabajas → Tu ficha → ¡Listo!
 *   No miembro:  Foto → Sobre ti → Tu ciudad → ¡Listo!
 *
 * Cada «Continuar» guarda su paso: quien cierra a mitad no pierde lo escrito.
 * «Más tarde» apunta que lo ha saltado y ya no se abre sola; se vuelve a abrir
 * con el evento `divine:onboarding` (el «Completa tu perfil» de los puntos).
 *
 * La ficha del mapa SALE SOLA al terminar si ella marca el permiso. El permiso
 * va aparte, con su casilla sin marcar y su información de privacidad delante:
 * es un consentimiento explícito, no una letra pequeña del botón de terminar.
 * La vista previa se pinta con la MISMA función con la que el servidor escribe
 * la copia pública (`fichaPublicaDe`): lo que ve es lo que sale.
 *
 * Mientras está abierta, `<body data-onboarding>`: la Celebración espera a que
 * se cierre (`divine:onboarding-cerrado`) para no tapar la ventana con confeti.
 */

type IdPaso = 'foto' | 'sobre' | 'donde' | 'ficha';

type Respuesta = {
  ok: boolean;
  motivo?: string;
  nombre: string;
  foto: string | null;
  esMiembro: boolean;
  onboarding: { version: number; completado: string | null; saltado: string | null };
  perfil: { bio: string; especialidad: string; ciudad: string; instagram: string };
  ficha: Ficha | null;
};

type Errores = ErroresFicha & { bio?: string; foto?: string };

type RespuestaPost = { ok: boolean; motivo?: string; errores?: Errores; ficha?: Ficha | null; enlace?: string | null };

/** En qué paso se arregla cada campo: un error del servidor lleva a su paso. */
const PASO_DE: Record<string, IdPaso> = {
  foto: 'foto',
  bio: 'sobre',
  sobre: 'sobre',
  especialidad: 'sobre',
  pais: 'donde',
  ciudad: 'donde',
  cp: 'donde',
  direccion: 'donde',
  centro: 'donde',
  mostrarDireccion: 'donde',
  nombre: 'ficha',
  frase: 'ficha',
  tratamientos: 'ficha',
  whatsapp: 'ficha',
  instagram: 'ficha',
  web: 'ficha',
  consentimiento: 'ficha',
  permiso: 'ficha',
};

const POR_MOTIVO: Record<string, string> = {
  'sin-sesion': 'Tu sesión ha caducado. Vuelve a entrar y sigue donde lo dejaste.',
  'sin-configurar': 'La plataforma no está disponible ahora mismo. Inténtalo en un rato.',
};

const pasosDe = (miembro: boolean): IdPaso[] => (miembro ? ['foto', 'sobre', 'donde', 'ficha'] : ['foto', 'sobre', 'donde']);

const tituloPaso = (id: IdPaso, miembro: boolean) =>
  ({ foto: 'Tu foto', sobre: 'Sobre ti', donde: miembro ? 'Dónde trabajas' : 'Tu ciudad', ficha: 'Tu ficha' })[id];

function datosDe(f: Ficha): DatosFicha {
  return {
    nombre: f.nombre,
    centro: f.centro,
    frase: f.frase,
    sobre: f.sobre,
    especialidad: f.especialidad,
    tratamientos: [...f.tratamientos],
    pais: f.pais || 'ES',
    ciudad: f.ciudad,
    cp: f.cp,
    direccion: f.direccion,
    mostrarDireccion: f.mostrarDireccion,
    whatsapp: f.whatsapp,
    instagram: f.instagram,
    web: f.web,
  };
}

/** «+34600111222» → ['ES', '600111222'], para el desplegable de país y el número. */
function partirWhatsapp(w: string, pais: string): [string, string] {
  const valida = (r: string) => PREFIJOS.some((p) => p.region === r);
  if (!w) return [valida(pais) ? pais : regionProbable(), ''];
  const propio = PREFIJOS.find((p) => p.region === pais && w.startsWith(p.prefijo));
  const otro = [...PREFIJOS].sort((a, b) => b.prefijo.length - a.prefijo.length).find((p) => w.startsWith(p.prefijo));
  const p = propio ?? otro;
  return p ? [p.region, w.slice(p.prefijo.length)] : [valida(pais) ? pais : 'ES', w];
}

const fechaCorta = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/* ==========================================================================
   Piezas pequeñas
   ========================================================================== */

/** Un número que cuenta hasta su valor (sin animación si se pide menos movimiento). */
function Cifra({ valor, reducir, duracion = 0.7 }: { valor: number; reducir: boolean; duracion?: number }) {
  const [mostrado, setMostrado] = useState(reducir ? valor : 0);
  const anterior = useRef(reducir ? valor : 0);
  useEffect(() => {
    if (reducir) {
      anterior.current = valor;
      setMostrado(valor);
      return;
    }
    const c = animate(anterior.current, valor, {
      duration: duracion,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setMostrado(Math.round(v)),
    });
    anterior.current = valor;
    return () => c.stop();
  }, [valor, reducir, duracion]);
  return <>{mostrado.toLocaleString('es-ES')}</>;
}

/** La barra dorada: se llena con muelle y, al subir, suelta un «+N %» que se desvanece. */
function Barra({ pct, reducir }: { pct: number; reducir: boolean }) {
  const anterior = useRef(pct);
  const [subidas, setSubidas] = useState<{ id: number; n: number }[]>([]);
  useEffect(() => {
    const n = pct - anterior.current;
    anterior.current = pct;
    if (n <= 0 || reducir) return;
    const id = Date.now();
    setSubidas((s) => [...s.slice(-2), { id, n }]);
    const t = setTimeout(() => setSubidas((s) => s.filter((x) => x.id !== id)), 1300);
    return () => clearTimeout(t);
  }, [pct, reducir]);

  return (
    <div className={o.pista} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Perfil completado">
      <motion.span
        className={o.relleno}
        data-lleno={pct >= 100 ? '' : undefined}
        initial={false}
        animate={{ width: `${Math.max(pct, 3)}%` }}
        transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 110, damping: 17, mass: 0.9 }}
      >
        <span className={o.punta} aria-hidden="true" />
        <AnimatePresence>
          {subidas.map((s) => (
            <motion.span
              key={s.id}
              className={o.subida}
              aria-hidden="true"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: -16 }}
              exit={{ opacity: 0, y: -26 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              +{s.n}%
            </motion.span>
          ))}
        </AnimatePresence>
      </motion.span>
    </div>
  );
}

function AvisoCampo({ texto, id }: { texto?: string; id?: string }) {
  if (!texto) return null;
  return (
    <p className={o.error} id={id} role="alert">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" strokeWidth="1.7" />
        <path d="M12 7.5v6M12 17h.01" />
      </svg>
      {texto}
    </p>
  );
}

const Icono = {
  whatsapp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  web: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  camara: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  ),
};

/**
 * La vista previa: la tarjeta del listado público TAL CUAL (la exporta el
 * propio buscador para esto, sin enlace), pintada con una `FichaPublica` hecha
 * con la misma función que usa el servidor al publicar. Debajo, los botones
 * de contacto, que en la web salen en su página: así puede probar que su
 * WhatsApp abre bien antes de publicar.
 */
function VistaPrevia({ t }: { t: FichaPublica }) {
  const sinNada = !t.nombre && !t.frase && !t.ciudad;
  return (
    <>
      <div className={o.tarjetaWeb} aria-label="Así sales en el listado del mapa" role="group">
        {sinNada ? (
          <p className={o.hueco}>Aquí aparecerá tu tarjeta según la vayas rellenando.</p>
        ) : (
          <TarjetaTerapeuta t={t} comoEnlace={false} />
        )}
      </div>
      <p className={o.rotulo}>Y en tu ficha, para escribirte</p>
      {t.whatsapp || t.instagram || t.web ? (
        <div className={o.tarjetaContacto}>
          {t.whatsapp && (
            <a className={o.contactoPrincipal} href={enlaceWhatsapp(t.whatsapp, t.nombre)} target="_blank" rel="noopener noreferrer">
              {Icono.whatsapp}
              WhatsApp
            </a>
          )}
          {t.instagram && (
            <a className={o.contacto} href={`https://www.instagram.com/${t.instagram}/`} target="_blank" rel="noopener noreferrer">
              {Icono.instagram}@{t.instagram}
            </a>
          )}
          {t.web && (
            <a className={o.contacto} href={t.web} target="_blank" rel="noopener noreferrer">
              {Icono.web}
              Web
            </a>
          )}
        </div>
      ) : (
        <p className={o.hueco}>Todavía sin contacto: pon tu WhatsApp o tu Instagram.</p>
      )}
    </>
  );
}

/* ==========================================================================
   El onboarding
   ========================================================================== */

export default function Onboarding({ inicial, nombre, esMiembro: miembroDeEntrada }: { inicial: boolean; nombre: string; esMiembro: boolean }) {
  const reducir = useReducedMotion() ?? false;
  const [montado, setMontado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState('');

  const [esMiembro, setEsMiembro] = useState(miembroDeEntrada);
  const [yaCompletado, setYaCompletado] = useState(false);
  const [ficha, setFicha] = useState<Ficha | null>(null);

  const [foto, setFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [bio, setBio] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [f, setF] = useState<DatosFicha>({ ...FICHA_VACIA, nombre });
  const [region, setRegion] = useState('ES');
  const [numero, setNumero] = useState('');
  const [acepto, setAcepto] = useState(false);

  const [paso, setPaso] = useState(0);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<null | { nuevo: boolean; enlace: string | null; estado: Ficha['estado'] | null }>(null);

  const [confirmar, dialogo] = useConfirmar();
  const ventana = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const abiertaDeEntrada = useRef(false);
  const idTitulo = useId();
  const id = useId();

  const pasos = pasosDe(esMiembro);
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const ultimo = paso >= pasos.length - 1;

  const poner = <K extends keyof DatosFicha>(k: K, v: DatosFicha[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrores((e) => ({ ...e, [k]: undefined, general: undefined }));
  };

  /* ------------------------------------------------------------ cargar */

  const cargar = useCallback(async () => {
    setCargado(false);
    setFallo('');
    try {
      const r = await fetch('/api/ficha', { cache: 'no-store' });
      const j = (await r.json()) as Respuesta;
      if (!r.ok || !j.ok) throw new Error(j.motivo ?? String(r.status));
      const fi = j.ficha;
      const esp = (ESPECIALIDADES as readonly string[]).includes(j.perfil.especialidad) ? j.perfil.especialidad : (fi?.especialidad ?? '');
      const base: DatosFicha = fi
        ? datosDe(fi)
        : { ...FICHA_VACIA, nombre: j.nombre || nombre, pais: regionProbable(), ciudad: j.perfil.ciudad, instagram: j.perfil.instagram };
      if (!base.ciudad) base.ciudad = j.perfil.ciudad;
      if (!base.instagram) base.instagram = j.perfil.instagram;
      const [reg, num] = partirWhatsapp(base.whatsapp, base.pais);
      const textoBio = j.perfil.bio || fi?.sobre || '';

      setEsMiembro(j.esMiembro);
      setYaCompletado(Boolean(j.onboarding.completado));
      setFicha(fi);
      setFoto(j.foto);
      setEspecialidad(esp);
      setBio(textoBio);
      setF(base);
      setRegion(reg);
      setNumero(num);
      // Si ya dio su permiso (y no lo retiró), la casilla sale marcada: lo dio ella.
      setAcepto(Boolean(fi?.consentimiento));
      setErrores({});
      setHecho(null);

      // Se empieza por lo que falta, no por el principio: quien vuelve a
      // terminarlo no tiene que pasar otra vez por la foto que ya puso.
      const lista = pasosDe(j.esMiembro);
      const falta: IdPaso | undefined = !j.foto
        ? 'foto'
        : !textoBio.trim() || !esp
          ? 'sobre'
          : !base.ciudad.trim()
            ? 'donde'
            : j.esMiembro
              ? 'ficha'
              : undefined;
      setPaso(falta ? lista.indexOf(falta) : 0);
      setCargado(true);
    } catch (e) {
      const m = (e as Error).message;
      setFallo(POR_MOTIVO[m] ?? 'No he podido cargar tu perfil. Revisa la conexión y vuelve a intentarlo.');
    }
  }, [nombre]);

  const abrir = useCallback(() => {
    setAbierto(true);
    cargar();
  }, [cargar]);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!inicial || abiertaDeEntrada.current) return;
    abiertaDeEntrada.current = true;
    abrir();
  }, [inicial, abrir]);

  useEffect(() => {
    // Si ya está abierta, no se vuelve a cargar: se perdería lo que lleva escrito.
    const alPedir = () => !document.body.hasAttribute('data-onboarding') && abrir();
    window.addEventListener('divine:onboarding', alPedir);
    return () => window.removeEventListener('divine:onboarding', alPedir);
  }, [abrir]);

  /* Mientras está abierta: la marca en <body> (la Celebración espera) y el
     fondo quieto. Al cerrarse —o si la pantalla se va con ella abierta— se
     quita la marca y se avisa. */
  useEffect(() => {
    if (!abierto) return;
    document.body.setAttribute('data-onboarding', '');
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.removeAttribute('data-onboarding');
      document.body.style.overflow = antes;
      window.dispatchEvent(new Event('divine:onboarding-cerrado'));
    };
  }, [abierto]);

  const cerrar = useCallback(() => {
    if (enviando) return;
    // Cerrar sin terminar es «más tarde»: se apunta y ya no se abre sola.
    if (!hecho && !yaCompletado) {
      fetch('/api/ficha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'saltar' }),
      }).catch(() => null);
    }
    setAbierto(false);
  }, [enviando, hecho, yaCompletado]);

  /* Teclado: Escape cierra (salvo si hay una pregunta encima) y el tabulador
     no se escapa de la ventana. */
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      const v = ventana.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar();
        return;
      }
      if (e.key !== 'Tab' || !v) return;
      const enfocables = [...v.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')].filter(
        (x) => x.offsetParent !== null
      );
      if (!enfocables.length) return;
      const primero = enfocables[0];
      const final = enfocables[enfocables.length - 1];
      if (!v.contains(document.activeElement)) {
        e.preventDefault();
        primero.focus();
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        final.focus();
      } else if (!e.shiftKey && document.activeElement === final) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto, cerrar]);

  // Cada paso empieza arriba y con el foco en su título (lo lee el lector de pantalla).
  useEffect(() => {
    if (!abierto || !cargado) return;
    cuerpo.current?.scrollTo({ top: 0 });
    // El paso nuevo entra cuando el anterior ha terminado de irse (unos 250 ms):
    // se espera a que esté para no dejar el foco en un título que desaparece.
    const t = setTimeout(() => titulo.current?.focus({ preventScroll: true }), reducir ? 0 : 280);
    return () => clearTimeout(t);
  }, [abierto, cargado, paso, hecho, reducir]);

  /* ------------------------------------------------------------ enviar */

  async function enviar(c: Record<string, unknown>): Promise<RespuestaPost> {
    try {
      const r = await fetch('/api/ficha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
      const j = (await r.json().catch(() => null)) as RespuestaPost | null;
      if (j && typeof j === 'object') return j;
      return { ok: false, errores: { general: 'No se ha podido guardar. Inténtalo otra vez.' } };
    } catch {
      return { ok: false, errores: { general: 'Sin conexión. Revisa internet y vuelve a intentarlo.' } };
    }
  }

  /** Enseña los errores y lleva al primer paso que tiene alguno. */
  function mostrarErrores(r: RespuestaPost) {
    const e: Errores = { ...(r.errores ?? {}) };
    if (!r.errores) e.general = POR_MOTIVO[r.motivo ?? ''] ?? 'No se ha podido guardar. Inténtalo otra vez.';
    // La ficha llama «sobre» a lo que aquí es «Sobre ti» (bio): es el mismo texto.
    if (e.sobre && !e.bio) e.bio = e.sobre;
    setErrores(e);
    const indices = Object.keys(e)
      .map((k) => pasos.indexOf(PASO_DE[k]))
      .filter((i) => i >= 0);
    if (indices.length) setPaso(Math.min(...indices));
  }

  /** Lo que se manda de la ficha: todo, con el WhatsApp ya con su prefijo. */
  const fichaCompleta = (): DatosFicha => ({
    ...f,
    sobre: bio,
    especialidad: especialidad || f.especialidad,
    whatsapp: numero.trim() ? telefonoCompleto(region, numero) : '',
  });

  async function elegirFoto(archivo?: File) {
    if (!archivo) return;
    setSubiendo(true);
    setErrores((e) => ({ ...e, foto: undefined }));
    try {
      const imagen = await fotoCuadrada(archivo);
      const r = await fetch('/api/perfil/foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen }),
      });
      if (!r.ok) throw new Error('No se ha podido guardar la foto. Prueba con otra.');
      setFoto(imagen);
      // Para quien pinte el avatar de arriba (lo puede escuchar la cabecera).
      window.dispatchEvent(new CustomEvent('divine:foto', { detail: imagen }));
      // Si la ficha ya está en la web, se le cambia también la foto.
      if (ficha?.estado === 'publicada') {
        const g = await enviar({ accion: 'guardar', ficha: {} });
        if (g.ok && g.ficha) setFicha(g.ficha);
      }
    } catch (e) {
      setErrores((x) => ({ ...x, foto: (e as Error).message || 'No se ha podido guardar la foto. Prueba con otra.' }));
    } finally {
      setSubiendo(false);
      if (entradaFoto.current) entradaFoto.current.value = '';
    }
  }

  async function terminar(conFicha: boolean) {
    setEnviando(true);
    let enlace: string | null = null;
    let estado: Ficha['estado'] | null = ficha?.estado ?? null;
    if (conFicha) {
      const yaFuera = ficha?.estado === 'publicada' || ficha?.estado === 'oculta';
      const publicar = !yaFuera && acepto;
      const r = await enviar({
        accion: publicar ? 'publicar' : 'guardar',
        // Al perfil interno, solo si es un usuario válido (si no, lo dice la ficha).
        perfil: { instagram: normalizarInstagram(f.instagram) ?? undefined },
        ficha: fichaCompleta(),
        ...(publicar ? { consentimiento: true } : {}),
      });
      if (!r.ok) {
        setEnviando(false);
        return mostrarErrores(r);
      }
      if (r.ficha) {
        setFicha(r.ficha);
        estado = r.ficha.estado;
        enlace = r.enlace ?? (r.ficha.estado === 'publicada' && r.ficha.slug ? `/terapeutas/${r.ficha.slug}` : null);
      }
    }
    const c = await enviar({ accion: 'completar' });
    setEnviando(false);
    if (!c.ok) return mostrarErrores(c);
    setHecho({ nuevo: !yaCompletado, enlace, estado });
    setYaCompletado(true);
    // «Algo ha cambiado»: la Celebración pide los puntos y, al cerrar esta
    // ventana, celebra los +100 (espera a `divine:onboarding-cerrado`).
    window.dispatchEvent(new Event('divine:logros'));
  }

  async function continuar() {
    if (enviando) return;
    setErrores({});
    if (actual === 'foto') return setPaso(paso + 1);

    if (actual === 'sobre') {
      const p = esMiembro ? buscarProhibida(bio) : null;
      if (p) return setErrores({ bio: avisoProhibida(p) });
      setEnviando(true);
      const r = await enviar({
        accion: 'guardar',
        perfil: { bio, ...(especialidad ? { especialidad } : {}) },
        ...(esMiembro ? { ficha: { sobre: bio, ...(especialidad ? { especialidad } : {}) } } : {}),
      });
      setEnviando(false);
      if (!r.ok) return mostrarErrores(r);
      if (r.ficha) setFicha(r.ficha);
      return setPaso(paso + 1);
    }

    if (actual === 'donde') {
      if (f.ciudad.trim().length < 2) return setErrores({ ciudad: 'Escribe tu ciudad.' });
      if (esMiembro && f.mostrarDireccion && f.direccion.trim().length < 4)
        return setErrores({ direccion: 'Escribe la dirección o apaga «Enseñar la dirección».' });
      const p = esMiembro ? buscarProhibida(f.centro) : null;
      if (p) return setErrores({ centro: avisoProhibida(p) });
      setEnviando(true);
      const r = await enviar({
        accion: 'guardar',
        perfil: { ciudad: f.ciudad },
        ...(esMiembro
          ? { ficha: { pais: f.pais, ciudad: f.ciudad, centro: f.centro, mostrarDireccion: f.mostrarDireccion, direccion: f.direccion, cp: f.cp } }
          : {}),
      });
      if (!r.ok) {
        setEnviando(false);
        return mostrarErrores(r);
      }
      if (r.ficha) setFicha(r.ficha);
      if (!esMiembro) return terminar(false);
      setEnviando(false);
      return setPaso(paso + 1);
    }

    // Tu ficha: lo que se escribe con faltas se dice aquí, antes de mandar nada.
    const vivos: Errores = {};
    for (const k of ['frase'] as const) {
      const pr = buscarProhibida(f[k]);
      if (pr) vivos[k] = avisoProhibida(pr);
    }
    if (Object.keys(vivos).length) return setErrores(vivos);
    return terminar(true);
  }

  async function quitarDelMapa() {
    const si = await confirmar({
      titulo: '¿Quitar tu ficha del mapa?',
      texto:
        'Deja de verse en la web en ese momento. Lo que has escrito se queda guardado aquí; si un día quieres volver a salir, tendrás que dar tu permiso otra vez.',
      boton: 'Quitar del mapa',
    });
    if (!si) return;
    setEnviando(true);
    const r = await enviar({ accion: 'despublicar' });
    setEnviando(false);
    if (!r.ok) return mostrarErrores(r);
    setFicha(r.ficha ?? null);
    setAcepto(false);
  }

  /* ------------------------------------------------------------ progreso */

  const piezas = esMiembro
    ? [
        Boolean(foto),
        bio.trim().length >= 12,
        Boolean(especialidad),
        f.ciudad.trim().length >= 2,
        f.frase.trim().length >= 10,
        f.tratamientos.length > 0,
        Boolean(numero.trim() || f.instagram.trim()),
        acepto || ficha?.estado === 'publicada' || ficha?.estado === 'oculta',
      ]
    : [Boolean(foto), bio.trim().length >= 12, Boolean(especialidad), f.ciudad.trim().length >= 2];
  const pct = hecho ? 100 : Math.round((piezas.filter(Boolean).length / piezas.length) * 100);

  const vista = fichaPublicaDe({
    ...fichaCompleta(),
    uid: 'vista-previa',
    slug: ficha?.slug ?? 'vista-previa',
    foto,
    lat: 0,
    lng: 0,
    precision: 'ciudad',
    actualizado: '',
    publicadaEl: '',
  });

  const prohibidaFrase = esMiembro ? buscarProhibida(f.frase) : null;
  const prohibidaCentro = esMiembro ? buscarProhibida(f.centro) : null;
  const prohibidaBio = esMiembro ? buscarProhibida(bio) : null;

  const yaFuera = ficha?.estado === 'publicada' || ficha?.estado === 'oculta';
  const textoBoton = enviando
    ? 'Guardando…'
    : !ultimo
      ? 'Continuar'
      : !esMiembro
        ? 'Terminar'
        : yaFuera
          ? 'Guardar y terminar'
          : acepto
            ? 'Publicar y terminar'
            : 'Terminar sin publicar';

  if (!montado) return null;

  /* ------------------------------------------------------------ pintar */

  return createPortal(
    <>
      <AnimatePresence>
        {abierto && (
          <motion.div
            className={o.velo}
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducir ? 0 : 0.2 }}
          >
            <motion.div
              ref={ventana}
              className={o.ventana}
              data-ancha={cargado && !hecho && actual === 'ficha' ? '' : undefined}
              role="dialog"
              aria-modal="true"
              aria-labelledby={cargado ? idTitulo : undefined}
              aria-label={cargado ? undefined : 'Completa tu perfil'}
              initial={reducir ? false : { y: 28, opacity: 0, scale: 0.985 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={reducir ? { opacity: 0 } : { y: 18, opacity: 0 }}
              transition={{ duration: reducir ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* --------- La cabeza oscura: progreso y puntos --------- */}
              <header className={o.cabeza}>
                <div className={o.cabezaFila}>
                  <span className={o.rotuloOscuro}>{hecho ? 'Perfil listo' : 'Completa tu perfil'}</span>
                  {!hecho && (
                    <button type="button" className={o.masTarde} onClick={cerrar} disabled={enviando}>
                      Más tarde
                    </button>
                  )}
                </div>

                <div className={o.progresoFila}>
                  <span className={o.porcentaje}>
                    Perfil <b><Cifra valor={pct} reducir={reducir} />%</b>
                  </span>
                  <span className={o.premio} data-hecho={hecho?.nuevo || yaCompletado ? '' : undefined}>
                    {hecho?.nuevo ? (
                      <>
                        {Icono.check} +{PUNTOS.perfil} pts conseguidos
                      </>
                    ) : yaCompletado ? (
                      <>
                        {Icono.check} Puntos ya sumados
                      </>
                    ) : (
                      <>+{PUNTOS.perfil} pts al terminar</>
                    )}
                  </span>
                </div>
                <Barra pct={pct} reducir={reducir} />

                {cargado && !hecho && (
                  <>
                    <ol className={o.pasos}>
                      {pasos.map((p, i) => (
                        <li key={p} data-estado={i < paso ? 'hecho' : i === paso ? 'ahora' : undefined} aria-current={i === paso ? 'step' : undefined}>
                          <button type="button" className={o.pasoBoton} onClick={() => i < paso && !enviando && setPaso(i)} disabled={i >= paso || enviando}>
                            <span className={o.pasoNum} aria-hidden="true">
                              {i < paso ? Icono.check : i + 1}
                            </span>
                            <span className={o.pasoTexto}>{tituloPaso(p, esMiembro)}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <p className={o.pasoMovil}>
                      Paso {paso + 1} de {pasos.length} · <b>{tituloPaso(actual, esMiembro)}</b>
                    </p>
                  </>
                )}
              </header>

              {/* --------- El cuerpo --------- */}
              <div className={o.cuerpo} ref={cuerpo}>
                {!cargado && !fallo && (
                  <div className={o.cargando} role="status">
                    <span className={o.girando} aria-hidden="true" />
                    Cargando tu perfil…
                  </div>
                )}

                {fallo && (
                  <div className={o.banda} role="alert">
                    <p>{fallo}</p>
                    <button type="button" className={o.btnOscuro} onClick={cargar}>
                      Reintentar
                    </button>
                  </div>
                )}

                {cargado && hecho && (
                  <Hecho
                    hecho={hecho}
                    esMiembro={esMiembro}
                    reducir={reducir}
                    tituloRef={titulo}
                    idTitulo={idTitulo}
                    cerrar={() => setAbierto(false)}
                  />
                )}

                {cargado && !hecho && (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.section
                      key={actual}
                      className={o.paso}
                      data-paso={actual}
                      initial={reducir ? false : { opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reducir ? { opacity: 0 } : { opacity: 0, x: -14 }}
                      transition={{ duration: reducir ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {actual === 'foto' && (
                        <div className={o.contenido}>
                          <h2 className={o.titulo} id={idTitulo} ref={titulo} tabIndex={-1}>
                            Ponle cara a tu perfil
                          </h2>
                          <p className={o.entradilla}>
                            Una foto tuya, de frente y con buena luz. La verán tus compañeras en la comunidad
                            {esMiembro ? ' y, si publicas tu ficha, quien te busque en el mapa.' : '.'}
                          </p>
                          <div className={o.fotoZona}>
                            <button
                              type="button"
                              className={o.fotoGrande}
                              onClick={() => entradaFoto.current?.click()}
                              disabled={subiendo}
                              aria-label={foto ? 'Cambiar tu foto' : 'Subir tu foto'}
                              data-vacia={foto ? undefined : ''}
                            >
                              {foto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={foto} alt="" />
                              ) : (
                                <span className={o.fotoIniciales}>{vista.iniciales}</span>
                              )}
                              <span className={o.fotoCamara} aria-hidden="true">
                                {Icono.camara}
                              </span>
                              {subiendo && <span className={o.fotoCargando} aria-hidden="true" />}
                            </button>
                            <div className={o.fotoAcciones}>
                              <button type="button" className={o.btnOscuro} onClick={() => entradaFoto.current?.click()} disabled={subiendo}>
                                {subiendo ? 'Subiendo…' : foto ? 'Cambiar foto' : 'Subir una foto'}
                              </button>
                              <p className={o.ayuda}>Se recorta en cuadrado. Mejor una foto vertical, con la cara arriba.</p>
                              {foto && !subiendo && (
                                <p className={o.bien}>
                                  {Icono.check} Foto guardada
                                </p>
                              )}
                            </div>
                          </div>
                          <AvisoCampo texto={errores.foto} />
                          <input ref={entradaFoto} type="file" accept="image/*" hidden onChange={(e) => elegirFoto(e.target.files?.[0])} />
                        </div>
                      )}

                      {actual === 'sobre' && (
                        <div className={o.contenido}>
                          <h2 className={o.titulo} id={idTitulo} ref={titulo} tabIndex={-1}>
                            Cuéntanos quién eres
                          </h2>
                          <p className={o.entradilla}>Dos cosas: a qué te dedicas y unas líneas sobre cómo trabajas.</p>

                          <fieldset className={o.grupo}>
                            <legend className={o.etiqueta}>A qué te dedicas</legend>
                            <div className={o.chips} role="radiogroup" aria-label="A qué te dedicas">
                              {ESPECIALIDADES.map((e) => (
                                <button
                                  key={e}
                                  type="button"
                                  role="radio"
                                  aria-checked={especialidad === e}
                                  className={o.chip}
                                  onClick={() => {
                                    setEspecialidad(e);
                                    setErrores((x) => ({ ...x, especialidad: undefined }));
                                  }}
                                >
                                  {especialidad === e && Icono.check}
                                  {e}
                                </button>
                              ))}
                            </div>
                            <AvisoCampo texto={errores.especialidad} />
                          </fieldset>

                          <div className={o.campo}>
                            <label className={o.etiqueta} htmlFor={`${id}-bio`}>
                              Sobre ti
                            </label>
                            <textarea
                              id={`${id}-bio`}
                              rows={5}
                              maxLength={400}
                              value={bio}
                              onChange={(e) => {
                                setBio(e.target.value);
                                setErrores((x) => ({ ...x, bio: undefined, sobre: undefined }));
                              }}
                              placeholder="Cómo trabajas, desde cuándo, qué cuidas en cada sesión."
                              aria-invalid={errores.bio || prohibidaBio ? true : undefined}
                              aria-describedby={`${id}-bio-ayuda`}
                            />
                            <div className={o.campoPie}>
                              <p className={o.ayuda} id={`${id}-bio-ayuda`}>
                                {esMiembro
                                  ? 'Sale en tu perfil y en tu ficha del mapa. Habla de cómo trabajas, no de lo que cura.'
                                  : 'Lo verán tus compañeras en tu perfil.'}
                              </p>
                              <span className={o.contador}>{bio.length}/400</span>
                            </div>
                            <AvisoCampo texto={errores.bio ?? (prohibidaBio ? avisoProhibida(prohibidaBio) : undefined)} />
                          </div>
                        </div>
                      )}

                      {actual === 'donde' && (
                        <div className={o.contenido}>
                          <h2 className={o.titulo} id={idTitulo} ref={titulo} tabIndex={-1}>
                            {esMiembro ? '¿Dónde trabajas?' : '¿Dónde vives?'}
                          </h2>
                          <p className={o.entradilla}>
                            {esMiembro
                              ? 'Con esto te situamos en el mapa «Localiza tu terapeuta». Tú decides si se ve la calle.'
                              : 'Así tus compañeras saben quién está cerca.'}
                          </p>

                          <div className={esMiembro ? o.dos : undefined}>
                            {esMiembro && (
                              <div className={o.campo}>
                                <label className={o.etiqueta} htmlFor={`${id}-pais`}>
                                  País
                                </label>
                                <select id={`${id}-pais`} value={f.pais} onChange={(e) => poner('pais', e.target.value)} aria-invalid={errores.pais ? true : undefined}>
                                  {PAISES.map((p) => (
                                    <option key={p.codigo} value={p.codigo}>
                                      {p.bandera} {p.nombre}
                                    </option>
                                  ))}
                                </select>
                                <AvisoCampo texto={errores.pais} />
                              </div>
                            )}
                            <div className={o.campo}>
                              <label className={o.etiqueta} htmlFor={`${id}-ciudad`}>
                                Ciudad
                              </label>
                              <input
                                id={`${id}-ciudad`}
                                maxLength={LIMITES.ciudad}
                                value={f.ciudad}
                                onChange={(e) => poner('ciudad', e.target.value)}
                                placeholder="Sevilla"
                                autoComplete="address-level2"
                                aria-invalid={errores.ciudad ? true : undefined}
                              />
                              <AvisoCampo texto={errores.ciudad} />
                            </div>
                          </div>

                          {esMiembro && (
                            <>
                              <div className={o.campo}>
                                <label className={o.etiqueta} htmlFor={`${id}-centro`}>
                                  Nombre de tu centro o cabina <span className={o.opcional}>(si tiene)</span>
                                </label>
                                <input
                                  id={`${id}-centro`}
                                  maxLength={LIMITES.centro}
                                  value={f.centro}
                                  onChange={(e) => poner('centro', e.target.value)}
                                  placeholder="Estudio Alma"
                                  aria-invalid={errores.centro || prohibidaCentro ? true : undefined}
                                />
                                <AvisoCampo texto={errores.centro ?? (prohibidaCentro ? avisoProhibida(prohibidaCentro) : undefined)} />
                              </div>

                              <div className={o.interruptorFila}>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={f.mostrarDireccion}
                                  className={o.interruptor}
                                  onClick={() => poner('mostrarDireccion', !f.mostrarDireccion)}
                                  aria-describedby={`${id}-dir-ayuda`}
                                >
                                  <span className={o.interruptorBola} aria-hidden="true" />
                                </button>
                                <div>
                                  <p className={o.interruptorTitulo}>Enseñar la dirección de mi cabina</p>
                                  <p className={o.ayuda} id={`${id}-dir-ayuda`}>
                                    {f.mostrarDireccion
                                      ? 'Saldrá tu calle y un botón de «Cómo llegar».'
                                      : 'Sales en el centro de tu ciudad, sin calle. Lo más tranquilo si trabajas en casa.'}
                                  </p>
                                </div>
                              </div>

                              {f.mostrarDireccion && (
                                <div className={o.dosDir}>
                                  <div className={o.campo}>
                                    <label className={o.etiqueta} htmlFor={`${id}-dir`}>
                                      Dirección
                                    </label>
                                    <input
                                      id={`${id}-dir`}
                                      maxLength={LIMITES.direccion}
                                      value={f.direccion}
                                      onChange={(e) => poner('direccion', e.target.value)}
                                      placeholder="Calle Feria, 12, local 2"
                                      autoComplete="street-address"
                                      aria-invalid={errores.direccion ? true : undefined}
                                    />
                                    <AvisoCampo texto={errores.direccion} />
                                  </div>
                                  <div className={o.campo}>
                                    <label className={o.etiqueta} htmlFor={`${id}-cp`}>
                                      Código postal
                                    </label>
                                    <input
                                      id={`${id}-cp`}
                                      maxLength={LIMITES.cp}
                                      value={f.cp}
                                      onChange={(e) => poner('cp', e.target.value)}
                                      placeholder="41003"
                                      inputMode="text"
                                      autoComplete="postal-code"
                                      aria-invalid={errores.cp ? true : undefined}
                                    />
                                    <AvisoCampo texto={errores.cp} />
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {actual === 'ficha' && (
                        <div className={o.fichaRejilla}>
                          <div className={o.fichaFormulario}>
                            <h2 className={o.titulo} id={idTitulo} ref={titulo} tabIndex={-1}>
                              Tu ficha en el mapa
                            </h2>
                            <p className={o.entradilla}>
                              Por estar en la Comunidad Divine puedes salir en «Localiza tu terapeuta». Quien te encuentre te escribe
                              directamente a ti.
                            </p>

                            {ficha?.ocultaPorSorela && (
                              <div className={o.nota} role="status">
                                Sorela ha ocultado tu ficha por ahora. Puedes seguir cambiándola; si quieres saber por qué, escríbele.
                              </div>
                            )}

                            <div className={o.campo}>
                              <label className={o.etiqueta} htmlFor={`${id}-nombre`}>
                                Tu nombre en la ficha
                              </label>
                              <input
                                id={`${id}-nombre`}
                                maxLength={LIMITES.nombre}
                                value={f.nombre}
                                onChange={(e) => poner('nombre', e.target.value)}
                                autoComplete="name"
                                aria-invalid={errores.nombre ? true : undefined}
                              />
                              <AvisoCampo texto={errores.nombre} />
                            </div>

                            <div className={o.campo}>
                              <label className={o.etiqueta} htmlFor={`${id}-frase`}>
                                Tu frase
                              </label>
                              <input
                                id={`${id}-frase`}
                                maxLength={LIMITES.frase}
                                value={f.frase}
                                onChange={(e) => poner('frase', e.target.value)}
                                placeholder="Drenaje con calma, en una cabina luminosa del centro."
                                aria-invalid={errores.frase || prohibidaFrase ? true : undefined}
                              />
                              <div className={o.campoPie}>
                                <p className={o.ayuda}>Una línea que diga cómo trabajas. Sin precios ni promesas.</p>
                                <span className={o.contador}>
                                  {f.frase.length}/{LIMITES.frase}
                                </span>
                              </div>
                              <AvisoCampo texto={errores.frase ?? (prohibidaFrase ? avisoProhibida(prohibidaFrase) : undefined)} />
                            </div>

                            <fieldset className={o.grupo}>
                              <legend className={o.etiqueta}>Tratamientos que haces</legend>
                              <div className={o.chips} role="group" aria-label="Tratamientos que haces">
                                {TRATAMIENTOS_FICHA.map((t) => {
                                  const marcado = f.tratamientos.includes(t);
                                  return (
                                    <button
                                      key={t}
                                      type="button"
                                      aria-pressed={marcado}
                                      className={o.chip}
                                      onClick={() =>
                                        poner(
                                          'tratamientos',
                                          marcado ? f.tratamientos.filter((x) => x !== t) : TRATAMIENTOS_FICHA.filter((x) => x === t || f.tratamientos.includes(x))
                                        )
                                      }
                                    >
                                      {marcado && Icono.check}
                                      {t}
                                    </button>
                                  );
                                })}
                              </div>
                              <AvisoCampo texto={errores.tratamientos} />
                            </fieldset>

                            <fieldset className={o.grupo}>
                              <legend className={o.etiqueta}>Por dónde te escriben</legend>
                              <p className={o.ayuda}>Al menos uno de los dos: WhatsApp o Instagram.</p>

                              <div className={o.campo}>
                                <label className={o.subEtiqueta} htmlFor={`${id}-wa`}>
                                  WhatsApp
                                </label>
                                <div className={o.telefono}>
                                  <select
                                    value={region}
                                    onChange={(e) => {
                                      setRegion(e.target.value);
                                      setErrores((x) => ({ ...x, whatsapp: undefined }));
                                    }}
                                    aria-label="País del WhatsApp"
                                    disabled={numero.trim().startsWith('+')}
                                  >
                                    {PREFIJOS.map((p) => (
                                      <option key={p.region} value={p.region}>
                                        {p.bandera} {p.prefijo}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    id={`${id}-wa`}
                                    type="tel"
                                    inputMode="tel"
                                    value={numero}
                                    onChange={(e) => {
                                      setNumero(e.target.value);
                                      setErrores((x) => ({ ...x, whatsapp: undefined }));
                                    }}
                                    placeholder="600 123 456"
                                    autoComplete="tel-national"
                                    aria-invalid={errores.whatsapp ? true : undefined}
                                  />
                                </div>
                                <AvisoCampo texto={errores.whatsapp} />
                              </div>

                              <div className={o.dos}>
                                <div className={o.campo}>
                                  <label className={o.subEtiqueta} htmlFor={`${id}-ig`}>
                                    Instagram
                                  </label>
                                  <div className={o.conPrefijo}>
                                    <span aria-hidden="true">@</span>
                                    <input
                                      id={`${id}-ig`}
                                      maxLength={60}
                                      value={f.instagram}
                                      onChange={(e) => poner('instagram', e.target.value.replace(/^@/, ''))}
                                      placeholder="tucuenta"
                                      autoCapitalize="none"
                                      autoCorrect="off"
                                      spellCheck={false}
                                      aria-invalid={errores.instagram ? true : undefined}
                                    />
                                  </div>
                                  <AvisoCampo texto={errores.instagram} />
                                </div>
                                <div className={o.campo}>
                                  <label className={o.subEtiqueta} htmlFor={`${id}-web`}>
                                    Web <span className={o.opcional}>(si tienes)</span>
                                  </label>
                                  <input
                                    id={`${id}-web`}
                                    type="url"
                                    inputMode="url"
                                    maxLength={LIMITES.web}
                                    value={f.web}
                                    onChange={(e) => poner('web', e.target.value)}
                                    placeholder="https://tuweb.com"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    aria-invalid={errores.web ? true : undefined}
                                  />
                                  <AvisoCampo texto={errores.web} />
                                </div>
                              </div>
                            </fieldset>

                            {/* El permiso, aparte y sin marcar. Con su información delante. */}
                            <section className={o.permiso} aria-labelledby={`${id}-permiso`}>
                              <h3 className={o.permisoTitulo} id={`${id}-permiso`}>
                                {yaFuera ? 'Tu ficha está en el mapa' : 'Tu permiso para publicarla'}
                              </h3>
                              {yaFuera ? (
                                <>
                                  <p className={o.permisoTexto}>
                                    {ficha?.estado === 'oculta'
                                      ? 'Diste tu permiso, pero ahora mismo está oculta.'
                                      : `Publicada${ficha?.publicadaEl ? ` desde el ${fechaCorta(ficha.publicadaEl)}` : ''}. Lo que cambies aquí se ve en la web al guardar.`}
                                  </p>
                                  <div className={o.permisoAcciones}>
                                    {ficha?.estado === 'publicada' && ficha.slug && (
                                      <a className={o.enlace} href={`/terapeutas/${ficha.slug}`} target="_blank" rel="noopener noreferrer">
                                        Ver mi ficha pública ↗
                                      </a>
                                    )}
                                    <button type="button" className={o.btnPeligro} onClick={quitarDelMapa} disabled={enviando}>
                                      Quitar mi ficha del mapa
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <label className={o.casillaFila}>
                                    <input
                                      type="checkbox"
                                      checked={acepto}
                                      onChange={(e) => {
                                        setAcepto(e.target.checked);
                                        setErrores((x) => ({ ...x, consentimiento: undefined }));
                                      }}
                                      aria-describedby={`${id}-permiso-texto`}
                                    />
                                    <span className={o.casilla} aria-hidden="true">
                                      {Icono.check}
                                    </span>
                                    <span className={o.casillaTexto}>Sí, quiero que mi ficha salga en el mapa</span>
                                  </label>
                                  <p className={o.permisoTexto} id={`${id}-permiso-texto`}>
                                    {TEXTO_CONSENTIMIENTO}
                                  </p>
                                  <p className={o.ayuda}>Si no la marcas, tu ficha se guarda y la publicas cuando quieras.</p>
                                </>
                              )}
                              <AvisoCampo texto={errores.consentimiento} />
                              <InfoPrivacidad capa={CAPA_FICHA} claro destinatarios={DESTINATARIOS_FICHA} />
                            </section>
                          </div>

                          <aside className={o.fichaVista} aria-label="Vista previa">
                            <p className={o.rotulo}>Vista previa · así sales en el mapa</p>
                            <VistaPrevia t={vista} />
                            <p className={o.ayuda}>
                              {f.mostrarDireccion
                                ? 'Con la dirección a la vista y un botón de «Cómo llegar».'
                                : 'Sin calle: en el mapa sales en el centro de tu ciudad.'}
                            </p>
                          </aside>
                        </div>
                      )}
                    </motion.section>
                  </AnimatePresence>
                )}
              </div>

              {/* --------- El pie: atrás y seguir --------- */}
              {cargado && !hecho && (
                <footer className={o.pie}>
                  {(errores.general || errores.permiso) && (
                    <div className={o.banda} role="alert">
                      <p>{errores.permiso ?? errores.general}</p>
                    </div>
                  )}
                  <div className={o.pieBotones}>
                    {paso > 0 ? (
                      <button type="button" className={o.btnLinea} onClick={() => setPaso(paso - 1)} disabled={enviando}>
                        Atrás
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" className={o.btnOscuro} onClick={continuar} disabled={enviando || subiendo} data-oro={ultimo ? '' : undefined}>
                      {textoBoton}
                    </button>
                  </div>
                </footer>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {dialogo}
    </>,
    document.body
  );
}

/* ==========================================================================
   ¡Listo!
   ========================================================================== */

function Hecho({
  hecho,
  esMiembro,
  reducir,
  tituloRef,
  idTitulo,
  cerrar,
}: {
  hecho: { nuevo: boolean; enlace: string | null; estado: Ficha['estado'] | null };
  esMiembro: boolean;
  reducir: boolean;
  tituloRef: RefObject<HTMLHeadingElement | null>;
  idTitulo: string;
  cerrar: () => void;
}) {
  return (
    <div className={o.hecho}>
      <motion.span
        className={o.hechoSello}
        aria-hidden="true"
        initial={reducir ? false : { scale: 0.4, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
      >
        <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </motion.span>

      <h2 className={o.hechoTitulo} id={idTitulo} ref={tituloRef} tabIndex={-1}>
        {hecho.nuevo ? '¡Perfil listo!' : 'Cambios guardados'}
      </h2>

      {hecho.nuevo && (
        <p className={o.hechoPuntos}>
          <span className={o.hechoCifra}>
            +<Cifra valor={PUNTOS.perfil} reducir={reducir} duracion={1.1} />
          </span>
          <span className={o.hechoUnidad}>puntos</span>
        </p>
      )}

      {hecho.estado === 'publicada' && hecho.enlace ? (
        <div className={o.hechoFicha}>
          <p className={o.hechoFichaTitulo}>Tu ficha ya está en el mapa</p>
          <p className={o.entradilla}>Quien busque una terapeuta en tu ciudad te encuentra y te escribe directamente.</p>
          <a className={o.btnOro} href={hecho.enlace} target="_blank" rel="noopener noreferrer">
            Ver mi ficha pública ↗
          </a>
          <p className={o.ayuda}>Puedes cambiarla o quitarla cuando quieras desde «Completa tu perfil».</p>
        </div>
      ) : hecho.estado === 'oculta' ? (
        <p className={o.entradilla}>Tu ficha está guardada, pero ahora mismo está oculta. Si quieres saber por qué, escribe a Sorela.</p>
      ) : esMiembro ? (
        <p className={o.entradilla}>Tu ficha se ha guardado sin publicar. Cuando quieras salir en el mapa, vuelve aquí y marca tu permiso.</p>
      ) : (
        <p className={o.entradilla}>
          Cuando entres en la Comunidad Divine podrás publicar tu ficha en «Localiza tu terapeuta», para que las clientas de tu
          ciudad te encuentren.
        </p>
      )}

      <button type="button" className={o.btnOscuro} onClick={cerrar}>
        Ir a la plataforma
      </button>
    </div>
  );
}
