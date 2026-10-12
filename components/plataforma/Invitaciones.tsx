'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CURSO_DIVINE } from '@/lib/accesos';
import css from './plataforma.module.css';
import i from './invitaciones.module.css';

/**
 * Los enlaces de invitación, en Cuentas.
 *
 * Sorela cobra, elige qué le da —la formación, la Comunidad Divine o las
 * dos— y le manda el enlace por WhatsApp. Quien lo abre se crea la cuenta y
 * entra ya con su acceso. Cada enlace sirve una sola vez y caduca a los 30
 * días. Ver lib/invitaciones.ts.
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
};

const OPCIONES: { id: QueDa; titulo: string; texto: string }[] = [
  { id: 'curso', titulo: CURSO_DIVINE, texto: 'Ha pagado el curso: ve las clases y el material.' },
  { id: 'membresia', titulo: 'Comunidad Divine', texto: 'La membresía: comunidad y material.' },
];

const ETIQUETA: Record<QueDa, string> = { curso: 'Formación', membresia: 'Comunidad' };

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';

function mensajeWhatsapp(inv: Invitacion) {
  const pila = inv.nombre?.trim().split(/\s+/)[0];
  const que = inv.que.map((q) => (q === 'curso' ? CURSO_DIVINE : 'la Comunidad Divine')).join(' y ');
  return `${pila ? `Hola ${pila}! ` : 'Hola! '}Aquí tienes tu acceso a ${que}. Entra en este enlace, crea tu contraseña y ya estás dentro: ${inv.enlace}`;
}

export default function Invitaciones() {
  const [lista, setLista] = useState<Invitacion[] | null>(null);
  const [que, setQue] = useState<QueDa[]>(['curso']);
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
      if (j.ok) setLista(j.invitaciones);
      else setFallo('No he podido cargar los enlaces.');
    } catch {
      setFallo('No hay conexión con el servidor.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alternar = (q: QueDa) =>
    setQue((a) => (a.includes(q) ? a.filter((x) => x !== q) : [...a, q]));

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (creando) return;
    setCreando(true);
    setErrores({});
    try {
      const r = await fetch('/api/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ que, nombre, correo }),
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
        <div>
          <p className={css.rotuloSeccion}>Enlaces de invitación</p>
          <p className={css.apunte} style={{ margin: '6px 0 0', maxWidth: 560 }}>
            Para dar acceso a quien ha pagado: crea su enlace y mándaselo. Se crea la cuenta con su
            contraseña y entra ya con lo que le das. Cada enlace sirve para una sola persona y caduca
            a los 30 días.
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
              Enlace listo{nueva.nombre ? ` para ${nueva.nombre}` : ''} · {nueva.que.map((q) => ETIQUETA[q]).join(' + ')}
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
                  <strong>{inv.nombre || inv.correo || inv.que.map((q) => ETIQUETA[q]).join(' + ')}</strong>
                  <span>
                    {inv.que.map((q) => ETIQUETA[q]).join(' + ')} · caduca el {fecha(inv.caduca)}
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
