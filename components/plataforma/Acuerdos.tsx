'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { fechaLarga } from '@/lib/acuerdo';
import { useAviso, useConfirmar } from './Confirmar';
import css from './plataforma.module.css';
import a from './acuerdos.module.css';

/**
 * Los acuerdos de confidencialidad firmados por las alumnas.
 *
 * Cada fila es una firma: quién, con qué documento, cuándo y si le ha llegado el
 * correo con su contrato y su dossier. Desde aquí se abre el PDF del acuerdo
 * firmado —generado en el momento desde la copia guardada al firmar, así que
 * dice exactamente lo que ella firmó— y se puede reenviar el correo.
 *
 * El estado del correo se enseña SIEMPRE, también cuando ha ido bien. Un
 * envío que falla en silencio es justo lo que pasaba antes: la alumna firmaba,
 * no le llegaba nada y nadie se enteraba.
 *
 * Y se puede BORRAR un acuerdo (los duplicados y las firmas de prueba). Es el
 * botón más discreto de la fila a propósito: el acuerdo firmado es la prueba
 * de la confidencialidad y borrarlo no tiene vuelta atrás, así que no puede
 * estar a la altura de «Ver acuerdo en PDF», y antes pregunta diciendo
 * exactamente qué se pierde.
 */

type Fila = {
  referencia: string;
  nombre: string;
  apellidos: string;
  documento: string;
  correo: string;
  telefono: string;
  lugar: string;
  firmadoEl: string;
  estado: string;
  descargas: number;
  correoEnviado: boolean;
  correoDetalle: string;
  correoFecha: string;
};

export default function Acuerdos() {
  const [lista, setLista] = useState<Fila[] | null>(null);
  const [fallo, setFallo] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [confirmar, dialogo] = useConfirmar();
  const [avisar, avisoFlotante] = useAviso();
  const reducir = useReducedMotion();

  const cargar = useCallback(async () => {
    setFallo('');
    try {
      const r = await fetch('/api/acuerdos', { cache: 'no-store' });
      const c = await r.json();
      if (!r.ok || !c.ok) throw new Error(c.motivo ?? String(r.status));
      setLista(c.acuerdos as Fila[]);
    } catch (e) {
      setLista([]);
      setFallo(`No he podido leer los acuerdos (${String((e as Error).message)}).`);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function reenviar(f: Fila) {
    setEnviando(f.referencia);
    setAviso('');
    try {
      const r = await fetch(`/api/acuerdos/${f.referencia}/reenviar`, { method: 'POST' });
      const c = await r.json();
      setAviso(
        c.enviado
          ? `Enviado a ${f.correo}${f.estado === 'aprobado' ? ': acuerdo firmado y dossier.' : ': acuse con su acuerdo (sin dossier, aún no está aprobado).'}`
          : `No ha salido el correo a ${f.correo}. ${c.detalle ?? ''}`
      );
      await cargar();
    } catch {
      setAviso('No he podido reenviarlo. Revisa la conexión y vuelve a intentarlo.');
    } finally {
      setEnviando(null);
    }
  }

  async function aprobar(f: Fila) {
    if (!window.confirm(`¿Aprobar el acuerdo de ${f.nombre} ${f.apellidos}? Le llegará su dossier a ${f.correo}.`)) return;
    setEnviando(f.referencia);
    setAviso('');
    try {
      const r = await fetch(`/api/acuerdos/${f.referencia}/aprobar`, { method: 'POST' });
      const c = await r.json();
      setAviso(
        c.enviado
          ? `Aprobado. ${f.nombre} ya tiene su dossier en ${f.correo}.`
          : `Aprobado, pero el correo no ha salido. ${c.detalle ?? ''} Pulsa «Reenviar correo».`
      );
      await cargar();
    } catch {
      setAviso('No se ha podido aprobar. Vuelve a intentarlo.');
    } finally {
      setEnviando(null);
    }
  }

  async function borrar(f: Fila) {
    const quien = `${f.nombre} ${f.apellidos}`.trim() || f.correo;
    const si = await confirmar({
      titulo: `¿Borrar el acuerdo de ${quien}?`,
      texto:
        `El acuerdo firmado es la prueba de confidencialidad; si lo borras, se pierde el PDF y no se puede recuperar. ` +
        `Se borran su firma, sus datos, el registro de descargas del dossier y sus correos del historial, y el enlace de su dossier deja de funcionar. ` +
        `Referencia ${f.referencia}.`,
      boton: 'Borrar acuerdo',
    });
    if (!si) return;
    setBorrando(f.referencia);
    setAviso('');
    try {
      const r = await fetch(`/api/acuerdos/${f.referencia}`, { method: 'DELETE' });
      const c = await r.json().catch(() => ({}));
      if (!r.ok || !c.ok) throw new Error(c.motivo ?? String(r.status));
      // Fuera de la lista en el acto (las cifras de arriba salen de ella) y luego se relee.
      setLista((l) => (l ? l.filter((x) => x.referencia !== f.referencia) : l));
      avisar(`Acuerdo de ${quien} borrado.`, 'hecho');
      await cargar();
    } catch (e) {
      avisar(`No se ha podido borrar el acuerdo (${String((e as Error).message)}). Sigue en la lista; vuelve a intentarlo.`);
    } finally {
      setBorrando(null);
    }
  }

  if (lista === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando los acuerdos…</p>
      </div>
    );
  }

  const sinCorreo = lista.filter((f) => !f.correoEnviado).length;

  return (
    <div className={css.columna}>
      {!fallo && (
        <div className={css.rejillaKpis}>
          <article className={css.kpi}>
            <span className={css.kpiValor}>{lista.length}</span>
            <span className={css.kpiLabel}>Acuerdos firmados</span>
            <span className={css.kpiNota}>Desde alumnas.sorelacarodivine.com</span>
          </article>
          <article className={css.kpi}>
            <span className={css.kpiValor}>{sinCorreo}</span>
            <span className={css.kpiLabel}>Sin correo enviado</span>
            <span className={css.kpiNota}>{sinCorreo ? 'Reenvíalos desde aquí' : 'Todo enviado'}</span>
          </article>
          <article className={css.kpi}>
            <span className={css.kpiValor}>{lista.filter((f) => f.estado !== 'aprobado' && f.estado !== 'anulado').length}</span>
            <span className={css.kpiLabel}>Por aprobar</span>
            <span className={css.kpiNota}>Sin aprobar no reciben el dossier</span>
          </article>
          <article className={css.kpi}>
            <span className={css.kpiValor}>{lista.reduce((t, f) => t + f.descargas, 0)}</span>
            <span className={css.kpiLabel}>Descargas del dossier</span>
            <span className={css.kpiNota}>Desde el enlace del correo</span>
          </article>
        </div>
      )}

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={css.btnLinea} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}

      {aviso && (
        <p className={css.avisoBien} role="status">
          {aviso}
        </p>
      )}

      <section className={css.tarjeta}>
        {lista.length === 0 ? (
          <p className={css.vacioTexto}>
            {fallo
              ? 'No puedo decirte si hay acuerdos hasta que se puedan leer.'
              : 'Todavía no ha firmado nadie. En cuanto una alumna firme en la landing, su acuerdo aparece aquí.'}
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {lista.map((f) => {
              const aprobado = f.estado === 'aprobado';
              const ocupada = enviando === f.referencia || borrando === f.referencia;
              return (
                <motion.article
                  key={f.referencia}
                  className={`${css.fila} ${a.fila}`}
                  layout={reducir ? false : 'position'}
                  exit={reducir ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -16, transition: { duration: 0.22 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                >
                  <span className={a.datos}>
                    <strong className={a.nombre}>
                      {f.nombre} {f.apellidos}
                    </strong>
                    {/* Cada dato en su trozo: el teléfono y el documento no se parten nunca
                        («+34» en una línea y el número en otra se lee y se copia mal); el
                        correo, que es largo, sí puede partirse si no cabe. */}
                    <span className={a.meta}>
                      <span className={a.entero}>Doc. {f.documento}</span>
                      {f.correo && <> · <span className={a.correo}>{f.correo}</span></>}
                      {f.telefono && <> · <span className={a.entero}>{f.telefono}</span></>}
                    </span>
                    <span className={a.meta}>
                      {f.referencia} · {f.lugar}, {f.firmadoEl ? fechaLarga(f.firmadoEl) : 'sin fecha'}
                    </span>
                    <span className={a.estados}>
                      <span className={a.estado} data-tono={aprobado ? 'bien' : 'espera'}>
                        {/* «Por aprobar», como la cifra de arriba: así cabe junto al estado del correo. */}
                        {aprobado ? 'Aprobado' : 'Por aprobar'}
                      </span>
                      <span className={a.estado} data-tono={f.correoEnviado ? 'bien' : 'mal'}>
                        {f.correoEnviado ? 'Correo enviado' : 'Correo no enviado'}
                      </span>
                      {!f.correoEnviado && f.correoDetalle && <span className={a.detalle}>{f.correoDetalle}</span>}
                    </span>
                  </span>

                  <span className={`${css.acciones} ${a.acciones}`}>
                    <a
                      className={css.btn}
                      href={`/api/acuerdos/${f.referencia}/pdf`}
                      style={{ textDecoration: 'none' }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver acuerdo en PDF
                    </a>
                    {f.estado !== 'aprobado' && f.estado !== 'anulado' && (
                      <button type="button" className={css.btnComunidad} onClick={() => aprobar(f)} disabled={ocupada}>
                        Aprobar y enviar dossier
                      </button>
                    )}
                    <button type="button" className={css.btnLinea} onClick={() => reenviar(f)} disabled={ocupada}>
                      {enviando === f.referencia ? 'Enviando…' : 'Reenviar correo'}
                    </button>
                    <button
                      type="button"
                      className={a.borrar}
                      onClick={() => borrar(f)}
                      disabled={ocupada}
                      aria-label={`Borrar el acuerdo de ${f.nombre} ${f.apellidos} (${f.referencia})`}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 11.6A2 2 0 0 0 9.4 20.5h5.2a2 2 0 0 0 2-1.9L17.5 7M9.5 7V4.5h5V7" />
                      </svg>
                      <span>{borrando === f.referencia ? 'Borrando…' : 'Borrar'}</span>
                    </button>
                  </span>
                </motion.article>
              );
            })}
          </AnimatePresence>
        )}
      </section>
      {dialogo}
      {avisoFlotante}
    </div>
  );
}

/* La firma de Sorela ya está guardada (ajustes/firma) y sale en cada acuerdo.
   El recuadro para subirla se ha quitado de aquí; si algún día hay que
   cambiarla, la ruta /api/ajustes/firma sigue funcionando. */
