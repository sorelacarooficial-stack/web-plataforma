'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { revisar } from '@/lib/captacion';
import css from './Formularios.module.css';

type Estado = 'quieto' | 'enviando' | 'hecho' | 'fallo';

/**
 * «Avísame cuando haya convocatoria por mi zona».
 *
 * Antes no enviaba nada. Ahora pasa por la misma ruta que el resto y lleva
 * consentimiento. Pide el nombre además del correo porque el aviso lo escribe
 * Sorela a mano y un correo suelto no se puede saludar.
 */
export default function AvisarCiudad() {
  const id = useId();
  const [v, setV] = useState({ nombre: '', correo: '', ciudad: '' });
  const [acepta, setAcepta] = useState(false);
  const [senuelo, setSenuelo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>('quieto');

  const campo = (k: keyof typeof v) => ({
    id: `${id}-${k}`,
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setV((s) => ({ ...s, [k]: e.target.value }));
      setError(null);
    },
    className: 'campo-pastilla',
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === 'enviando') return;

    const datos = { ...v, consentimiento: acepta, origen: 'avisar-ciudad', empresa: senuelo };
    const revision = revisar(datos);
    if (!revision.ok) {
      setError(Object.values(revision.errores)[0] ?? 'Revisa los datos.');
      return;
    }
    if (!v.ciudad.trim()) {
      setError('Dime tu ciudad, que es justo lo que necesito saber.');
      return;
    }

    setEstado('enviando');
    try {
      const r = await fetch('/api/captar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const cuerpo = await r.json().catch(() => ({ ok: false }));
      if (cuerpo.ok) return setEstado('hecho');
      setError(Object.values(cuerpo.errores ?? {})[0] as string | undefined ?? null);
      setEstado(cuerpo.errores ? 'quieto' : 'fallo');
    } catch {
      setEstado('fallo');
    }
  }

  if (estado === 'hecho') {
    return (
      <p className={css.confirmacion} role="status">
        Apuntado. Te escribo en cuanto abra fecha por tu zona.{' '}
        <button
          type="button"
          className={css.deshacer}
          onClick={() => {
            setV({ nombre: '', correo: '', ciudad: '' });
            setAcepta(false);
            setEstado('quieto');
          }}
        >
          Apuntar otra ciudad
        </button>
      </p>
    );
  }

  if (estado === 'fallo') {
    return (
      <p className={css.confirmacion} role="alert">
        No he podido guardarlo. Vuelve a intentarlo, por favor.{' '}
        <button type="button" className={css.deshacer} onClick={() => setEstado('quieto')}>
          Probar otra vez
        </button>
      </p>
    );
  }

  return (
    <form className="columna" style={{ gap: 12, width: '100%' }} onSubmit={enviar} noValidate>
      <div className={css.enLinea}>
        <input
          {...campo('nombre')}
          placeholder="Tu nombre"
          aria-label="Tu nombre"
          autoComplete="name"
          autoCapitalize="words"
          style={{ flex: '1 1 140px' }}
        />
        <input
          {...campo('correo')}
          type="email"
          inputMode="email"
          placeholder="tu@correo.com"
          aria-label="Tu correo"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{ flex: '1 1 180px' }}
        />
        <input
          {...campo('ciudad')}
          placeholder="Tu ciudad"
          aria-label="Tu ciudad"
          autoComplete="address-level2"
          style={{ flex: '1 1 120px' }}
        />
      </div>

      {/* Señuelo antirrobots. */}
      <div className={css.senuelo} aria-hidden="true">
        <label htmlFor={`${id}-empresa`}>No rellenar</label>
        <input
          id={`${id}-empresa`}
          tabIndex={-1}
          autoComplete="off"
          value={senuelo}
          onChange={(e) => setSenuelo(e.target.value)}
        />
      </div>

      <label className={css.consentimiento}>
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
        <span>
          Acepto que Sorela guarde estos datos para avisarme.{' '}
          <Link href="/legal/privacidad" target="_blank">
            Cómo se tratan
          </Link>
          .
        </span>
      </label>

      {error && (
        <p className={css.error} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-linea"
        style={{
          padding: '15px 28px',
          fontSize: '12.5px',
          letterSpacing: '0.16em',
          alignSelf: 'flex-start',
        }}
        disabled={estado === 'enviando'}
      >
        {estado === 'enviando' ? 'Un momento…' : 'Avísame'}
      </button>
    </form>
  );
}
