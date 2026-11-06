'use client';

import { useState } from 'react';
import { CIUDADES_PAGO, FORMACIONES_PAGO, GRUPO_COMUNIDAD, type FormacionPago } from '@/lib/reserva';
import css from './reserva.module.css';

/**
 * Lo que hace la alumna nada más pagar: deja sus datos (y su ciudad si es
 * presencial) y entra en el grupo de la Comunidad Divine, el mismo para todas.
 */
export default function GraciasFormulario({ formacion, pago, whatsapp }: { formacion: FormacionPago | null; pago: string; whatsapp: string }) {
  const [f, setF] = useState<string>(formacion ?? '');
  const [ciudad, setCiudad] = useState('');
  const [datos, setDatos] = useState({ nombre: '', whatsapp: '', correo: '', empresa: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<'rellenando' | 'enviando' | 'hecho' | 'fallo'>('rellenando');
  const elegida = FORMACIONES_PAGO.find((x) => x.id === f);
  const wa = (t: string) => `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(t)}`;
  const resumen = `${elegida?.nombre ?? 'mi formación'}${elegida?.presencial && ciudad ? ` en ${ciudad}` : ''}`;
  const grupo = GRUPO_COMUNIDAD || wa(`Hola, soy ${datos.nombre || '…'}. Acabo de pagar: ${resumen}. ¿Me añadís a la Comunidad Divine?`);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado('enviando');
    try {
      const r = await fetch('/api/reserva-pagada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, formacion: f, ciudad, pago }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) return setEstado('hecho');
      if (j.errores) {
        setErrores(j.errores);
        return setEstado('rellenando');
      }
      setEstado('fallo');
    } catch {
      setEstado('fallo');
    }
  };

  if (estado === 'hecho' || estado === 'fallo') {
    return (
      <section className={css.bloque} style={{ maxWidth: 520, margin: '0 auto', paddingTop: 30, textAlign: 'center' }}>
        <p className={css.paso}>{estado === 'hecho' ? '✓ Datos guardados' : 'Último paso'}</p>
        <h2 style={{ margin: '8px 0 6px', fontSize: 30, fontWeight: 300, letterSpacing: '-0.035em' }}>
          Entra en la <strong>Comunidad Divine</strong>
        </h2>
        <p className={css.suave}>Ahí subimos todo: eventos, cursos, avisos de tu formación y tutoriales de la plataforma.</p>
        <a className={css.boton} href={grupo} target="_blank" rel="noopener noreferrer" style={{ fontSize: 18, padding: '18px 16px' }}>
          Entrar en la Comunidad
          {!GRUPO_COMUNIDAD && <small>por WhatsApp</small>}
        </a>
        {estado === 'fallo' && (
          <a
            className={`${css.boton} ${css.botonWa}`}
            href={wa(`Hola, acabo de pagar: ${resumen}. Mis datos: ${datos.nombre}, ${datos.whatsapp}, ${datos.correo}.`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            No se han guardado tus datos: mándanoslos por WhatsApp
          </a>
        )}
      </section>
    );
  }

  const campo = (k: 'nombre' | 'whatsapp' | 'correo', etiqueta: string, tipo: string, ayuda: string) => (
    <label style={estilo.campo}>
      <span style={estilo.etiqueta}>{etiqueta}</span>
      <input
        type={tipo}
        required
        value={datos[k]}
        onChange={(e) => setDatos((d) => ({ ...d, [k]: e.target.value }))}
        placeholder={ayuda}
        autoComplete={k === 'nombre' ? 'name' : k === 'correo' ? 'email' : 'tel'}
        style={{ ...estilo.input, ...(errores[k] ? estilo.inputMal : {}) }}
      />
      {errores[k] && <span style={estilo.error}>{errores[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={enviar} className={css.bloque} style={{ maxWidth: 520, margin: '0 auto', paddingTop: 30 }}>
      <p className={css.paso}>Un minuto: déjanos tus datos</p>
      <p className={css.suave} style={{ marginTop: 6 }}>
        Así te reconocemos y te mandamos todo lo de tu formación.
      </p>

      {!formacion && (
        <label style={estilo.campo}>
          <span style={estilo.etiqueta}>¿Qué has pagado?</span>
          <select required value={f} onChange={(e) => setF(e.target.value)} style={estilo.input}>
            <option value="">Elige…</option>
            {FORMACIONES_PAGO.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
          {errores.formacion && <span style={estilo.error}>{errores.formacion}</span>}
        </label>
      )}

      {elegida?.presencial && (
        <div style={estilo.campo}>
          <span style={estilo.etiqueta}>¿En qué ciudad la haces?</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {CIUDADES_PAGO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCiudad(c)}
                aria-pressed={ciudad === c}
                style={{ ...estilo.ciudad, ...(ciudad === c ? estilo.ciudadOn : {}) }}
              >
                {c}
              </button>
            ))}
          </div>
          {errores.ciudad && <span style={estilo.error}>{errores.ciudad}</span>}
        </div>
      )}

      {campo('nombre', 'Nombre y apellido', 'text', 'Como en tu documento')}
      {campo('whatsapp', 'WhatsApp', 'tel', 'Con el prefijo: +58…, +57…')}
      {campo('correo', 'Correo', 'email', 'El mismo que pusiste al pagar')}
      <input type="text" name="empresa" tabIndex={-1} autoComplete="off" value={datos.empresa} onChange={(e) => setDatos((d) => ({ ...d, empresa: e.target.value }))} style={{ display: 'none' }} aria-hidden />

      <button type="submit" className={css.boton} disabled={estado === 'enviando' || (elegida?.presencial && !ciudad) || !f} style={{ width: '100%', border: 0, fontSize: 18, padding: '18px 16px', marginTop: 22, cursor: 'pointer', opacity: estado === 'enviando' ? 0.6 : 1 }}>
        {estado === 'enviando' ? 'Guardando…' : 'Guardar y entrar en la Comunidad'}
      </button>
    </form>
  );
}

const estilo: Record<string, React.CSSProperties> = {
  campo: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 18 },
  etiqueta: { fontSize: 14, fontWeight: 600, color: '#141210' },
  input: { font: 'inherit', fontSize: 17, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(154,115,64,0.35)', background: '#fffdf9', color: '#141210' },
  inputMal: { borderColor: '#b3261e' },
  error: { fontSize: 13, color: '#b3261e' },
  ciudad: { font: 'inherit', fontSize: 17, fontWeight: 600, padding: '16px 10px', borderRadius: 14, border: '1px solid rgba(154,115,64,0.35)', background: '#fffdf9', color: '#141210', cursor: 'pointer' },
  ciudadOn: { background: '#17140f', color: '#f3d9ae', borderColor: '#17140f' },
};
