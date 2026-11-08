'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import InfoPrivacidad from '@/components/InfoPrivacidad';
import { CAPA_RESERVA_PAGADA } from '@/lib/privacidad';
import { CLAVE_RESERVA, type Opcion } from '@/lib/reserva';
import css from './reserva.module.css';

/**
 * Paso 1 de la reserva: antes de pagar, sus datos. Al guardar se va sola al
 * enlace de Stripe de su plan (con la reserva dentro y su correo rellenado).
 */
export default function ReservaDatos({ o, alCerrar, whatsapp }: { o: Opcion; alCerrar: () => void; whatsapp: string }) {
  const [datos, setDatos] = useState({ nombre: '', whatsapp: '', correo: '', empresa: '' });
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<'rellenando' | 'enviando' | 'fallo'>('rellenando');
  const usd = (n: number) => `${n.toLocaleString('es-ES')} USD`;
  const ahora = o.reserva || o.precio || 0;

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', f);
      document.body.style.overflow = '';
    };
  }, [alCerrar]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado('enviando');
    try {
      const r = await fetch('/api/reserva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, opcion: o.id, consentimiento: acepta }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok && j.url) {
        try {
          localStorage.setItem(CLAVE_RESERVA, JSON.stringify({ id: j.id, nombre: datos.nombre, opcion: o.id }));
        } catch {
          /* sin almacenamiento: el pago se cruza igual en Stripe con su número de reserva */
        }
        window.location.href = j.url;
        return;
      }
      if (j.errores) {
        setErrores(j.errores);
        setEstado('rellenando');
        return;
      }
      setEstado('fallo');
    } catch {
      setEstado('fallo');
    }
  };

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
    <div className={css.hojaFondo} onClick={alCerrar} role="dialog" aria-modal="true" aria-label={`Reservar ${o.titulo}`}>
      <form onSubmit={enviar} onClick={(e) => e.stopPropagation()} className={css.hoja}>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" style={estilo.cerrar}>
          ×
        </button>
        <p className={css.paso} style={{ margin: 0 }}>
          Paso 1 de 2 · Tus datos
        </p>
        <h3 style={{ margin: '8px 0 2px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{o.titulo}</h3>
        <p className={css.suave} style={{ margin: 0 }}>
          {o.detalle} · pagas ahora <b>{usd(ahora)}</b>
        </p>

        {campo('nombre', 'Nombre y apellido', 'text', 'Como en tu documento')}
        {campo('whatsapp', 'WhatsApp', 'tel', 'Con el prefijo: +58…, +57…')}
        {campo('correo', 'Correo', 'email', 'Te llega aquí el recibo')}
        <input type="text" tabIndex={-1} autoComplete="off" value={datos.empresa} onChange={(e) => setDatos((d) => ({ ...d, empresa: e.target.value }))} style={{ display: 'none' }} aria-hidden />

        <label style={estilo.acepta}>
          <input
            type="checkbox"
            required
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            style={{ width: 20, height: 20, margin: '1px 0 0', flex: 'none', accentColor: '#8a6a32' }}
          />
          <span>
            He leído y acepto la{' '}
            <Link href="/legal/privacidad" target="_blank" style={estilo.enlace}>
              política de privacidad
            </Link>{' '}
            y el{' '}
            <Link href="/legal/aviso-legal" target="_blank" style={estilo.enlace}>
              aviso legal
            </Link>
            , y que Sorela trate mis datos para gestionar mi reserva.
          </span>
        </label>
        {errores.consentimiento && <span style={estilo.error}>{errores.consentimiento}</span>}
        <div style={{ marginTop: 10 }}>
          <InfoPrivacidad capa={CAPA_RESERVA_PAGADA} claro />
        </div>

        <button
          type="submit"
          className={css.boton}
          disabled={estado === 'enviando' || !acepta}
          style={{ width: '100%', border: 0, fontSize: 18, padding: '17px 16px', marginTop: 16, cursor: 'pointer', opacity: estado === 'enviando' || !acepta ? 0.6 : 1 }}
        >
          {estado === 'enviando' ? 'Un momento…' : `Ir al pago seguro · ${usd(ahora)}`}
          <small>Paso 2 de 2 · tarjeta con Stripe</small>
        </button>
        {estado === 'fallo' && (
          <a
            className={`${css.boton} ${css.botonWa}`}
            href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, quiero reservar: ${o.titulo} (${o.detalle}). No me ha dejado seguir en la web.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            No ha funcionado: escríbenos por WhatsApp
          </a>
        )}
      </form>
    </div>
  );
}

const estilo: Record<string, React.CSSProperties> = {
  cerrar: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, border: 0, borderRadius: 999, background: 'rgba(20,18,16,0.06)', fontSize: 26, lineHeight: 1, cursor: 'pointer', color: '#141210' },
  campo: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 },
  etiqueta: { fontSize: 14, fontWeight: 600 },
  input: { font: 'inherit', fontSize: 17, padding: '13px 15px', borderRadius: 14, border: '1px solid rgba(154,115,64,0.35)', background: '#fffdf9', color: '#141210' },
  inputMal: { borderColor: '#b3261e' },
  error: { fontSize: 13, color: '#b3261e' },
  acepta: { display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, marginTop: 18, fontSize: 14, lineHeight: 1.5, color: 'rgba(20,18,16,0.75)', cursor: 'pointer' },
  enlace: { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 },
};
