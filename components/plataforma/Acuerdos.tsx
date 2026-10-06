'use client';

import { useCallback, useEffect, useState } from 'react';
import { fechaLarga } from '@/lib/acuerdo';
import css from './plataforma.module.css';

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
          ? `Enviado a ${f.correo}: acuerdo firmado y dossier.`
          : `No ha salido el correo a ${f.correo}. ${c.detalle ?? ''}`
      );
      await cargar();
    } catch {
      setAviso('No he podido reenviarlo. Revisa la conexión y vuelve a intentarlo.');
    } finally {
      setEnviando(null);
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
      <FirmaSorela />

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
          lista.map((f) => (
            <article key={f.referencia} className={css.fila} style={{ padding: '16px 0', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <strong style={{ fontWeight: 500 }}>
                  {f.nombre} {f.apellidos}
                </strong>
                <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                  Doc. {f.documento} · {[f.correo, f.telefono].filter(Boolean).join(' · ')}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                  {f.referencia} · {f.lugar}, {f.firmadoEl ? fechaLarga(f.firmadoEl) : 'sin fecha'}
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: f.correoEnviado ? 'var(--salvia-ink)' : 'var(--arcilla-ink)',
                  }}
                >
                  {f.correoEnviado ? '✓ Correo enviado' : '✕ Correo no enviado'}
                  {!f.correoEnviado && f.correoDetalle ? ` — ${f.correoDetalle}` : ''}
                </span>
              </span>

              <span className={css.acciones}>
                <a
                  className={css.btn}
                  href={`/api/acuerdos/${f.referencia}/pdf`}
                  style={{ textDecoration: 'none' }}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver acuerdo en PDF
                </a>
                <button
                  type="button"
                  className={css.btnLinea}
                  onClick={() => reenviar(f)}
                  disabled={enviando === f.referencia}
                >
                  {enviando === f.referencia ? 'Enviando…' : 'Reenviar correo'}
                </button>
              </span>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

/* ==========================================================================
   La firma de Sorela

   La que va en su lado de cada acuerdo. Se sube una foto —de un papel, del
   carné— y el servidor la limpia: tinta oscura sobre fondo transparente. Lo
   que se ve aquí es exactamente lo que sale en el PDF.

   No se guarda en el código de la web, que es público, sino en la base de
   datos. Ver `lib/firma-sorela.ts`.
   ========================================================================== */

function FirmaSorela() {
  const [firma, setFirma] = useState<string | null | undefined>(undefined);
  const [estado, setEstado] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    fetch('/api/ajustes/firma', { cache: 'no-store' })
      .then((r) => r.json())
      .then((c) => setFirma(c.ok ? (c.firma as string | null) : null))
      .catch(() => setFirma(null));
  }, []);

  async function subir(archivo: File) {
    setSubiendo(true);
    setEstado('');
    try {
      const imagen = await new Promise<string>((ok, mal) => {
        const lector = new FileReader();
        lector.onload = () => ok(String(lector.result));
        lector.onerror = () => mal(lector.error);
        lector.readAsDataURL(archivo);
      });
      const r = await fetch('/api/ajustes/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen }),
      });
      const c = await r.json();
      if (!c.ok) throw new Error(c.motivo);
      setFirma(c.firma);
      setEstado('Firma guardada. A partir de ahora sale en todos los acuerdos.');
    } catch {
      setEstado('No he podido leer esa imagen. Prueba con una foto más nítida, solo de la firma.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <section className={css.tarjeta} style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
      <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontWeight: 500 }}>Tu firma en los acuerdos</strong>
        <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)' }}>
          {firma
            ? 'Esta es la firma que sale en tu lado de cada acuerdo, también en los ya firmados.'
            : 'Sube una foto de tu firma: recórtala para que solo se vea la firma, sin letras alrededor. Se limpia sola.'}
        </span>
        {estado && <span style={{ fontSize: 13, color: 'var(--arcilla-ink)' }}>{estado}</span>}
      </div>

      {firma && (
        <img
          src={firma}
          alt="Tu firma"
          style={{ height: 70, maxWidth: 240, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 8, border: '1px solid var(--line-2)' }}
        />
      )}

      <label className={css.btn} style={{ cursor: subiendo ? 'default' : 'pointer', opacity: subiendo ? 0.6 : 1 }}>
        {subiendo ? 'Guardando…' : firma ? 'Cambiar firma' : 'Subir mi firma'}
        <input
          type="file"
          accept="image/*"
          disabled={subiendo}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) subir(f);
            e.target.value = '';
          }}
        />
      </label>
    </section>
  );
}
