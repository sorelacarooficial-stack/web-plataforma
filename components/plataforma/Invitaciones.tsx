'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CURSO_DIVINE } from '@/lib/accesos';
import css from './plataforma.module.css';
import i from './invitaciones.module.css';

/**
 * Los enlaces de invitación, en Cuentas: el ÚNICO sitio donde se crean.
 *
 * Sorela cobra, elige qué le da —el curso, la membresía o las dos— y le manda
 * el enlace por WhatsApp. Quien lo abre se crea la cuenta y entra ya con su
 * acceso. Cada enlace sirve una sola vez y caduca a los 30 días.
 *
 * El del curso lleva además sus fechas (la convocatoria: le salen en la
 * agenda), a quién de las inscritas va y el nivel: solo el precurso si ha
 * dejado el abono, o todo si ha pagado. Ver lib/invitaciones.ts.
 */

type QueDa = 'curso' | 'membresia';
type Invitacion = {
  codigo: string;
  enlace: string;
  que: QueDa[];
  nombre: string | null;
  correo: string | null;
  creado: string | null;
  caduca: string;
  estado: 'pendiente' | 'usada' | 'caducada' | 'anulada';
  usadaPor: { correo: string; nombre: string | null; en: string | null } | null;
  convocatoria: string | null;
  completo: boolean;
};

type Nivel = 'precurso' | 'completo';
type InscritaOpcion = { id: string; nombre: string; correo: string; estado: 'pagado' | 'senal' | 'pendiente'; acceso: string };
type ConvOpcion = { id: string; ciudad: string; inicio: string; fin: string; inscritas: InscritaOpcion[] };

const NIVELES: { id: Nivel; titulo: string; texto: string }[] = [
  { id: 'precurso', titulo: 'Con el abono', texto: 'Ha dejado el abono. Ve el precurso, los dosieres y sus fechas; las clases en vídeo, bloqueadas hasta la parte práctica.' },
  { id: 'completo', titulo: 'Curso completo', texto: 'Ha pagado todo. Ve también las clases en vídeo.' },
];

const PAGO: Record<InscritaOpcion['estado'], string> = { pagado: 'Pagado', senal: 'Abono', pendiente: 'Sin pagar' };

const dias = (c: ConvOpcion) => {
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', o);
  const fin = f(c.fin, { day: 'numeric', month: 'long' });
  return c.inicio === c.fin ? fin : `${f(c.inicio, { day: 'numeric' })}–${fin}`;
};

/* Curso y membresía son dos compras distintas y se nombran siempre igual en
   toda la plataforma: «Acceso al curso» (se paga una vez: clases y material
   en el aula) y «Membresía · Comunidad Divine» (se paga cada mes). Antes la
   membresía decía «comunidad y material» y la etiqueta corta era
   «Formación»/«Comunidad», y no quedaba claro cuál abría el aula. */
const OPCIONES: { id: QueDa; titulo: string; texto: string }[] = [
  { id: 'curso', titulo: `Acceso al curso · ${CURSO_DIVINE}`, texto: 'Ha dejado el abono o ha pagado el curso. Abajo eliges sus fechas y qué parte ve. No incluye la membresía.' },
  { id: 'membresia', titulo: 'Membresía · Comunidad Divine', texto: 'La comunidad, que se paga cada mes. No incluye el curso.' },
];

const ETIQUETA: Record<QueDa, string> = { curso: 'Acceso al curso', membresia: 'Membresía Comunidad' };

/** Lo que da, con el nivel del curso: «Curso · solo precurso + Membresía». */
const queDa = (inv: Invitacion) =>
  inv.que.map((q) => (q === 'curso' ? (inv.completo ? 'Curso completo' : 'Curso · solo precurso') : ETIQUETA[q])).join(' + ');

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';

function mensajeWhatsapp(inv: Invitacion) {
  const pila = inv.nombre?.trim().split(/\s+/)[0];
  const que = inv.que
    .map((q) => (q === 'curso' ? (inv.completo ? `el curso ${CURSO_DIVINE}` : `el precurso de la ${CURSO_DIVINE}`) : 'la membresía de la Comunidad Divine'))
    .join(' y ');
  return `${pila ? `Hola ${pila}! ` : 'Hola! '}Aquí tienes tu acceso a ${que}. Entra en este enlace, crea tu contraseña y ya estás dentro: ${inv.enlace}`;
}

export default function Invitaciones() {
  const [lista, setLista] = useState<Invitacion[] | null>(null);
  const [convs, setConvs] = useState<ConvOpcion[]>([]);
  const [que, setQue] = useState<QueDa[]>(['curso']);
  /* '' = sin fecha. Se pone sola la primera convocatoria que haya. */
  const [conv, setConv] = useState<string>('');
  /* '' = otra persona (se escribe a mano). */
  const [inscrita, setInscrita] = useState<string>('');
  const [nivel, setNivel] = useState<Nivel>('precurso');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState<Invitacion | null>(null);
  /* Si al crearla se le mandó por correo: 'enviado', 'fallido' o null (sin correo). */
  const [envio, setEnvio] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/invitaciones')).json();
      if (j.ok) {
        setLista(j.invitaciones);
        const cs: ConvOpcion[] = j.convocatorias ?? [];
        setConvs(cs);
        setConv((c) => (c && cs.some((x) => x.id === c) ? c : cs[0]?.id ?? ''));
      } else setFallo('No he podido cargar los enlaces.');
    } catch {
      setFallo('No hay conexión con el servidor.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Desde Formaciones, «Crear acceso al curso» llega aquí con la convocatoria
     y la inscrita en la dirección: se dejan elegidas, una sola vez. */
  const seccion = useRef<HTMLElement>(null);
  const desdeFormaciones = useRef(false);
  useEffect(() => {
    if (desdeFormaciones.current || convs.length === 0) return;
    const q = new URLSearchParams(window.location.search);
    const c = convs.find((x) => x.id === q.get('conv'));
    if (!c) return;
    desdeFormaciones.current = true;
    const x = c.inscritas.find((y) => y.id === q.get('inscrita'));
    setQue((a) => (a.includes('curso') ? a : [...a, 'curso']));
    setConv(c.id);
    setInscrita(x?.id ?? '');
    setNombre(x?.nombre ?? '');
    setCorreo(x?.correo ?? '');
    setNivel(x?.estado === 'pagado' ? 'completo' : 'precurso');
    window.history.replaceState(null, '', `${window.location.pathname}?v=cuentas`);
    seccion.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [convs]);

  const alternar = (q: QueDa) =>
    setQue((a) => (a.includes(q) ? a.filter((x) => x !== q) : [...a, q]));

  const conCurso = que.includes('curso');
  const convActual = convs.find((c) => c.id === conv) ?? null;
  const inscritaActual = convActual?.inscritas.find((x) => x.id === inscrita) ?? null;

  /* Al elegir a una inscrita: su nombre y su correo, y el nivel que toca por
     lo que ha pagado (solo «Pagado» abre todo). */
  const elegirInscrita = (id: string) => {
    setInscrita(id);
    const x = convActual?.inscritas.find((y) => y.id === id);
    setNombre(x?.nombre ?? '');
    setCorreo(x?.correo ?? '');
    setNivel(x?.estado === 'pagado' ? 'completo' : 'precurso');
  };

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (creando) return;
    setCreando(true);
    setErrores({});
    try {
      const r = await fetch('/api/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          que,
          nombre,
          correo,
          ...(conCurso ? { convocatoria: conv || null, inscrita: conv ? inscrita || null : null, nivel } : {}),
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErrores(j.errores ?? { general: 'No he podido crear el enlace.' });
      } else {
        setNueva(j.invitacion);
        setEnvio(j.correo ?? null);
        setLista((l) => [j.invitacion, ...(l ?? [])]);
        setNombre('');
        setCorreo('');
        setInscrita('');
        setNivel('precurso');
        // La fila de la inscrita ya dice «Enlace sin usar».
        cargar();
      }
    } catch {
      setErrores({ general: 'No hay conexión con el servidor.' });
    }
    setCreando(false);
  }

  async function copiar(inv: Invitacion) {
    try {
      await navigator.clipboard.writeText(inv.enlace);
      setCopiado(inv.codigo);
      setTimeout(() => setCopiado((c) => (c === inv.codigo ? null : c)), 2200);
    } catch {
      window.prompt('Copia el enlace:', inv.enlace);
    }
  }

  async function anular(inv: Invitacion) {
    if (!window.confirm('¿Anular este enlace? Quien lo tenga ya no podrá usarlo.')) return;
    const r = await fetch(`/api/invitaciones?codigo=${encodeURIComponent(inv.codigo)}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({ ok: false }));
    if (j.ok) {
      setLista((l) => l?.map((x) => (x.codigo === inv.codigo ? { ...x, estado: 'anulada' } : x)) ?? l);
      if (nueva?.codigo === inv.codigo) setNueva(null);
    } else setFallo(j.motivo === 'usada' ? 'Ese enlace ya se ha usado: el acceso se quita desde su cuenta.' : 'No he podido anularlo.');
  }

  /* Solo los que siguen sin usar: son los únicos con algo que hacer (copiar,
     reenviar, anular). Los usados ya están en la lista de cuentas de abajo, y
     los caducados o anulados no sirven para nada; enseñarlos era ruido. */
  const visibles = (lista ?? []).filter((x) => x.estado === 'pendiente');

  const acciones = (inv: Invitacion) => (
    <>
      <button type="button" className={css.btnLinea} onClick={() => copiar(inv)}>
        {copiado === inv.codigo ? '¡Copiado!' : 'Copiar enlace'}
      </button>
      <a
        className={i.whatsapp}
        href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsapp(inv))}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
    </>
  );

  return (
    <section className={i.seccion} ref={seccion}>
      <div className={i.cabecera}>
        <div>
          <p className={css.rotuloSeccion}>Enlaces de invitación</p>
          <p className={css.apunte} style={{ margin: '6px 0 0', maxWidth: 560 }}>
            El único sitio para dar acceso, al curso o a la membresía: crea su enlace y mándaselo. Se
            crea la cuenta con su contraseña (o entra con la suya, si ya tiene) y le aparece lo que le
            das. Cada enlace sirve para una sola persona y caduca a los 30 días.
          </p>
        </div>
      </div>

      <form className={i.formulario} onSubmit={crear} noValidate>
        <div className={i.opciones} role="group" aria-label="Qué le das">
          {OPCIONES.map((o) => {
            const on = que.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                className={i.opcion}
                data-on={on ? '' : undefined}
                aria-pressed={on}
                onClick={() => alternar(o.id)}
              >
                <span className={i.check} aria-hidden="true">
                  {on && (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </span>
                <span className={i.opcionTexto}>
                  <strong>{o.titulo}</strong>
                  <span>{o.texto}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errores.que && <p className={css.errorCampo}>{errores.que}</p>}

        {conCurso && (
          <div className={i.curso}>
            <div className={i.cursoFila}>
              <label className={css.etiquetaCampo}>
                Fechas del curso
                <select
                  className={css.campoCaja}
                  value={conv}
                  onChange={(e) => {
                    setConv(e.target.value);
                    setInscrita('');
                  }}
                >
                  {convs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ciudad} · {dias(c)}
                    </option>
                  ))}
                  <option value="">Sin fechas</option>
                </select>
                {errores.convocatoria && <span className={css.errorCampo}>{errores.convocatoria}</span>}
              </label>
              {convActual && (
                <label className={css.etiquetaCampo}>
                  Persona apuntada
                  <select className={css.campoCaja} value={inscrita} onChange={(e) => elegirInscrita(e.target.value)}>
                    <option value="">Otra persona (escribo sus datos)</option>
                    {convActual.inscritas.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre} · {PAGO[x.estado]}
                        {x.acceso === 'ya-tiene-cuenta' ? ' · ya tiene cuenta' : x.acceso === 'enlace-sin-usar' ? ' · enlace sin usar' : ''}
                      </option>
                    ))}
                  </select>
                  {errores.inscrita && <span className={css.errorCampo}>{errores.inscrita}</span>}
                </label>
              )}
            </div>
            <p className={i.cursoNota}>
              {convActual
                ? 'Sus días de la presencial le salen solos en la agenda.'
                : 'Sin fechas no le sale nada en la agenda. Elige la convocatoria si ya sabe cuándo viene.'}
              {inscritaActual?.acceso === 'enlace-sin-usar' && ' Ya tenía un enlace sin usar: al crear este, el anterior deja de valer.'}
            </p>
            <div className={i.niveles} role="radiogroup" aria-label="Qué parte del curso">
              {NIVELES.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="radio"
                  aria-checked={nivel === n.id}
                  className={i.nivel}
                  data-on={nivel === n.id ? '' : undefined}
                  onClick={() => setNivel(n.id)}
                >
                  <strong>{n.titulo}</strong>
                  <span>{n.texto}</span>
                </button>
              ))}
            </div>
            {nivel === 'precurso' && (
              <p className={i.cursoNota}>
                {convActual
                  ? 'Cuando la marques «Pagado» en Formaciones, se le abre el curso completo sola y le llega un correo.'
                  : 'Para abrirle luego el curso completo, márcala «Pagado» en Formaciones (si está apuntada) o cámbialo en su cuenta.'}
              </p>
            )}
          </div>
        )}

        <div className={i.campos}>
          <label className={css.etiquetaCampo}>
            Para quién <span className={i.opcional}>(opcional)</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre, para reconocerla" className={css.campoCaja} />
          </label>
          <label className={css.etiquetaCampo}>
            Su correo <span className={i.opcional}>(opcional)</span>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="Si lo pones, le llega por correo y solo vale para ese correo"
              className={css.campoCaja}
            />
            {errores.correo && <span className={css.errorCampo}>{errores.correo}</span>}
          </label>
          <button type="submit" className={css.btn} disabled={creando || que.length === 0}>
            {creando ? 'Creando…' : 'Crear enlace'}
          </button>
        </div>
        {errores.general && <p className={css.errorCampo}>{errores.general}</p>}
      </form>

      <AnimatePresence>
        {nueva && (
          <motion.div
            className={i.nueva}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <p className={i.nuevaRotulo}>
              Enlace listo{nueva.nombre ? ` para ${nueva.nombre}` : ''} · {queDa(nueva)}
            </p>
            {/* Frases enteras, en minúscula y en los verdes y tejas claros que
                se leen sobre el negro: los de la plataforma, pensados para el
                papel, aquí se quedaban en 2,7 a 1. */}
            {envio === 'enviado' && (
              <p className={i.nuevaBien}>
                Ya le ha llegado por correo a {nueva.correo}. Si quieres, mándaselo también por WhatsApp.
              </p>
            )}
            {envio === 'fallido' && (
              <p className={i.nuevaMal}>
                El correo no ha salido: cópiale el enlace y mándaselo tú.
              </p>
            )}
            <code className={i.enlace}>{nueva.enlace}</code>
            <div className={i.nuevaAcciones}>
              {acciones(nueva)}
              <button type="button" className={i.nuevaCerrar} onClick={() => setNueva(null)}>
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {fallo && <p className={css.errorCampo}>{fallo}</p>}

      {visibles.length > 0 && (
        <>
          <p className={i.rotuloLista}>Enlaces sin usar · {visibles.length}</p>
          <ul className={i.lista}>
            {visibles.map((inv) => (
              <li key={inv.codigo} className={i.fila} data-estado={inv.estado}>
                <span className={i.filaQuien}>
                  <strong>{inv.nombre || inv.correo || queDa(inv)}</strong>
                  <span>
                    {queDa(inv)}
                    {inv.convocatoria && convs.find((c) => c.id === inv.convocatoria)
                      ? ` · ${(() => {
                          const c = convs.find((x) => x.id === inv.convocatoria)!;
                          return `${c.ciudad} ${dias(c)}`;
                        })()}`
                      : ''}{' '}
                    · caduca el {fecha(inv.caduca)}
                  </span>
                </span>
                <span className={i.filaAcciones}>
                  {acciones(inv)}
                  <button type="button" className={css.enlaceAccion} onClick={() => anular(inv)}>
                    Anular
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
