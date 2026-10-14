'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CURSO_DIVINE } from '@/lib/accesos';
import css from './plataforma.module.css';
import i from './invitaciones.module.css';

/**
 * «Dar acceso», en Cuentas: el ÚNICO sitio donde se da acceso a la plataforma.
 *
 * Tres pasos, siempre los mismos: qué le das (el curso o la membresía), a
 * quién (una de las apuntadas a unas fechas, u otra persona) y, si es el
 * curso, qué ha pagado (el abono o todo). Antes de crear el enlace se lee en
 * una frase qué va a pasar. Quien abre el enlace se crea la cuenta (o entra
 * con la suya) y ya tiene su acceso. Cada enlace sirve una vez y caduca a los
 * 30 días. Ver lib/invitaciones.ts.
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

const QUE: { id: QueDa; titulo: string; texto: string }[] = [
  { id: 'curso', titulo: CURSO_DIVINE, texto: 'El curso. Se paga una vez.' },
  { id: 'membresia', titulo: 'Comunidad Divine', texto: 'La membresía. Se paga cada mes.' },
];

const NIVELES: { id: Nivel; titulo: string; texto: string }[] = [
  { id: 'precurso', titulo: 'Solo el abono', texto: 'Ve el precurso, los dosieres y sus fechas. Los vídeos, bloqueados hasta terminar la clase presencial.' },
  { id: 'completo', titulo: 'Todo el curso', texto: 'Ve todo, también las clases en vídeo.' },
];

const PAGO: Record<InscritaOpcion['estado'], string> = { pagado: 'ha pagado todo', senal: 'ha dejado el abono', pendiente: 'sin pagar' };

const dias = (c: ConvOpcion) => {
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', o);
  const fin = f(c.fin, { day: 'numeric', month: 'long' });
  return c.inicio === c.fin ? fin : `${f(c.inicio, { day: 'numeric' })}–${fin}`;
};

const ETIQUETA: Record<QueDa, string> = { curso: 'Curso', membresia: 'Comunidad Divine' };

/** Lo que da, con el nivel del curso: «Curso · solo el abono». */
const queDa = (inv: Invitacion) =>
  inv.que.map((q) => (q === 'curso' ? (inv.completo ? 'Curso completo' : 'Curso · solo el abono') : ETIQUETA[q])).join(' + ');

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';

function mensajeWhatsapp(inv: Invitacion) {
  const pila = inv.nombre?.trim().split(/\s+/)[0];
  const que = inv.que
    .map((q) => (q === 'curso' ? (inv.completo ? `el curso ${CURSO_DIVINE}` : `el precurso de la ${CURSO_DIVINE}`) : 'la membresía de la Comunidad Divine'))
    .join(' y ');
  return `${pila ? `Hola ${pila}! ` : 'Hola! '}Aquí tienes tu acceso a ${que}. Entra en este enlace, crea tu contraseña y ya estás dentro: ${inv.enlace}`;
}

/** Un círculo: lleno si está elegido. Para que se vea de un vistazo cuál es. */
const Marca = ({ on }: { on: boolean }) => (
  <span className={i.marca} data-on={on ? '' : undefined} aria-hidden="true">
    {on && (
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    )}
  </span>
);

export default function Invitaciones() {
  const [lista, setLista] = useState<Invitacion[] | null>(null);
  const [convs, setConvs] = useState<ConvOpcion[]>([]);
  /* Nada elegido al principio: así se elige a conciencia y no por descuido. */
  const [que, setQue] = useState<QueDa | null>(null);
  /* '' = sin fechas. Se pone sola la primera convocatoria que haya. */
  const [conv, setConv] = useState<string>('');
  /* '' = otra persona (se escriben sus datos). */
  const [inscrita, setInscrita] = useState<string>('');
  const [nivel, setNivel] = useState<Nivel | null>(null);
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

  const conCurso = que === 'curso';
  const convActual = conCurso ? convs.find((c) => c.id === conv) ?? null : null;
  const inscritaActual = convActual?.inscritas.find((x) => x.id === inscrita) ?? null;
  /* Los datos se escriben a mano si no es una de las apuntadas. */
  const aMano = !inscritaActual;

  /* Al elegir a una apuntada: sus datos, y lo que ha pagado decide el paso 3
     (solo «Pagado» abre todo). Se puede cambiar. */
  const elegirInscrita = (id: string) => {
    setInscrita(id);
    const x = convActual?.inscritas.find((y) => y.id === id);
    setNombre(x?.nombre ?? '');
    setCorreo(x?.correo ?? '');
    setNivel(x ? (x.estado === 'pagado' ? 'completo' : 'precurso') : null);
  };

  const elegirQue = (q: QueDa) => {
    setQue(q);
    setErrores({});
    if (q === 'membresia') {
      setInscrita('');
      setNivel(null);
    }
  };

  const listo = que !== null && (!conCurso || nivel !== null);

  /* La frase que dice qué va a pasar, antes de crear nada. */
  const quien = (inscritaActual?.nombre || nombre.trim() || '').split(/\s+/)[0];
  const destino = (inscritaActual?.correo || correo.trim()).toLowerCase();
  const resumen = !listo
    ? null
    : [
        conCurso
          ? `${quien || 'Quien abra el enlace'} entra en la ${CURSO_DIVINE}${convActual ? ` (${convActual.ciudad}, ${dias(convActual)})` : ''}.`
          : `${quien || 'Quien abra el enlace'} entra en la Comunidad Divine. No incluye el curso.`,
        conCurso && nivel === 'precurso'
          ? `Verá el precurso, los dosieres y sus fechas; los vídeos, bloqueados hasta terminar la clase presencial. ${
              inscritaActual ? 'Se le abren solos cuando la marques «Pagado» en Formaciones.' : 'Cuando pague el resto, se los abres en su cuenta › Gestionar acceso.'
            }`
          : conCurso
            ? 'Verá todo el curso, también los vídeos.'
            : '',
        destino ? `Le llega el enlace a ${destino}.` : 'Sin correo: copia el enlace y mándaselo por WhatsApp.',
        'Si ya tiene cuenta, entra con su contraseña de siempre.',
      ]
        .filter(Boolean)
        .join(' ');

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (creando || !listo || !que) return;
    setCreando(true);
    setErrores({});
    try {
      const r = await fetch('/api/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          que: [que],
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
        setQue(null);
        setNombre('');
        setCorreo('');
        setInscrita('');
        setNivel(null);
        // La fila de la apuntada ya dice «Enlace sin usar».
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
    <section className={i.seccion}>
      <div className={i.cabecera}>
        <p className={css.rotuloSeccion}>Dar acceso</p>
        <p className={css.apunte} style={{ margin: '6px 0 0', maxWidth: 600 }}>
          El único sitio para dar acceso a la plataforma. Le llega un enlace: con él se crea su cuenta, o
          entra con la suya si ya tiene.
        </p>
      </div>

      <form className={i.formulario} onSubmit={crear} noValidate>
        <fieldset className={i.paso}>
          <legend className={i.pasoCabeza}>
            <span className={i.pasoNum}>1</span>
            ¿Qué le das?
          </legend>
          <div className={i.eleccion} role="radiogroup" aria-label="Qué le das">
            {QUE.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={que === o.id}
                className={i.opcion}
                data-on={que === o.id ? '' : undefined}
                onClick={() => elegirQue(o.id)}
              >
                <Marca on={que === o.id} />
                <span className={i.opcionTexto}>
                  <strong>{o.titulo}</strong>
                  <span>{o.texto}</span>
                </span>
              </button>
            ))}
          </div>
          {errores.que && <p className={css.errorCampo}>{errores.que}</p>}
        </fieldset>

        {que && (
          <fieldset className={i.paso}>
            <legend className={i.pasoCabeza}>
              <span className={i.pasoNum}>2</span>
              ¿A quién?
            </legend>
            {conCurso && (
              <div className={i.dosCampos}>
                <label className={css.etiquetaCampo}>
                  Fechas del curso
                  <select
                    className={css.campoCaja}
                    value={conv}
                    onChange={(e) => {
                      setConv(e.target.value);
                      elegirInscrita('');
                    }}
                  >
                    {convs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.ciudad} · {dias(c)}
                      </option>
                    ))}
                    <option value="">Sin fechas todavía</option>
                  </select>
                  {errores.convocatoria && <span className={css.errorCampo}>{errores.convocatoria}</span>}
                </label>
                {convActual && (
                  <label className={css.etiquetaCampo}>
                    Persona
                    <select className={css.campoCaja} value={inscrita} onChange={(e) => elegirInscrita(e.target.value)}>
                      <option value="">Otra persona (escribo sus datos)</option>
                      {convActual.inscritas.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nombre}
                        </option>
                      ))}
                    </select>
                    {errores.inscrita && <span className={css.errorCampo}>{errores.inscrita}</span>}
                  </label>
                )}
              </div>
            )}
            {inscritaActual && (
              <p className={i.ficha}>
                <strong>{inscritaActual.nombre}</strong> · {inscritaActual.correo || 'sin correo'} · {PAGO[inscritaActual.estado]}
                {inscritaActual.acceso === 'ya-tiene-cuenta' && <span className={i.aviso}>Ya tiene acceso con su cuenta: no hace falta otro enlace. Cuando pague el resto, márcala «Pagado» en Formaciones y se le abre todo.</span>}
                {inscritaActual.acceso === 'enlace-sin-usar' && <span className={i.aviso}>Ya tiene un enlace sin usar: al crear este, el anterior deja de valer.</span>}
              </p>
            )}
            {aMano && (
              <div className={i.dosCampos}>
                <label className={css.etiquetaCampo}>
                  Nombre
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Para reconocerla en la lista" className={css.campoCaja} />
                </label>
                <label className={css.etiquetaCampo}>
                  Correo
                  <input
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="Le llega el enlace y solo vale para este correo"
                    className={css.campoCaja}
                  />
                  {errores.correo && <span className={css.errorCampo}>{errores.correo}</span>}
                </label>
              </div>
            )}
          </fieldset>
        )}

        {conCurso && (
          <fieldset className={i.paso}>
            <legend className={i.pasoCabeza}>
              <span className={i.pasoNum}>3</span>
              ¿Qué ha pagado?
            </legend>
            <div className={i.eleccion} role="radiogroup" aria-label="Qué ha pagado">
              {NIVELES.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="radio"
                  aria-checked={nivel === n.id}
                  className={i.opcion}
                  data-on={nivel === n.id ? '' : undefined}
                  onClick={() => setNivel(n.id)}
                >
                  <Marca on={nivel === n.id} />
                  <span className={i.opcionTexto}>
                    <strong>{n.titulo}</strong>
                    <span>{n.texto}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {resumen && (
          <div className={i.resumen}>
            <p className={i.resumenRotulo}>Así queda</p>
            <p className={i.resumenTexto}>{resumen}</p>
            <button type="submit" className={i.crear} disabled={creando}>
              {creando ? 'Creando…' : destino ? 'Crear y enviar el enlace' : 'Crear el enlace'}
            </button>
          </div>
        )}
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
          <p className={i.rotuloLista}>Enlaces enviados que aún no ha usado nadie · {visibles.length}</p>
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
