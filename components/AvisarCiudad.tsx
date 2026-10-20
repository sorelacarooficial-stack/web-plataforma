'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { revisar } from '@/lib/captacion';
import css from './Formularios.module.css';
import InfoPrivacidad from '@/components/InfoPrivacidad';
import { CAPA_AVISO_CONVOCATORIA, CAPA_CITA } from '@/lib/privacidad';
import { conLlegada } from '@/lib/llegada';

type Estado = 'quieto' | 'enviando' | 'hecho' | 'fallo';

/**
 * «Avísame cuando haya algo en mi ciudad».
 *
 * Sirve para dos avisos distintos y por eso lleva `para`: en el buscador de
 * terapeutas es «cuando haya una terapeuta cerca» y en /formaciones es
 * «cuando haya una convocatoria cerca». La casilla, la información de
 * privacidad y el origen tienen que decir el aviso que se pide de verdad:
 * prometer uno y apuntar para otro es un consentimiento que no vale.
 *
 * Pasa por la misma ruta que el resto y lleva consentimiento. Pide el nombre
 * además del correo porque el aviso lo escribe Sorela a mano y un correo
 * suelto no se puede saludar. A esta persona no le llega la bienvenida (ver
 * soloAviso en lib/enviar-informacion.ts) ni las campañas (lib/campanas.ts).
 */
const AVISOS = {
  terapeuta: {
    origen: 'avisar-ciudad',
    casilla: 'Tengo 18 años o más y acepto que Sorela Caro use mis datos para avisarme cuando haya una terapeuta cerca.',
    hecho: 'Gracias, te apunto. Cuando haya una terapeuta certificada en tu zona, te lo digo.',
    capa: CAPA_CITA,
  },
  convocatoria: {
    origen: 'avisar-ciudad-formacion',
    casilla: 'Tengo 18 años o más y acepto que Sorela Caro use mis datos para avisarme cuando haya una formación cerca.',
    hecho: 'Gracias, te apunto. Cuando haya una convocatoria en tu zona, te lo digo.',
    capa: CAPA_AVISO_CONVOCATORIA,
  },
} as const;

export default function AvisarCiudad({ para = 'terapeuta' }: { para?: keyof typeof AVISOS }) {
  const aviso = AVISOS[para];
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

    const datos = { ...v, consentimiento: acepta, origen: aviso.origen, empresa: senuelo };
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
        body: JSON.stringify(conLlegada(datos)),
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
        {aviso.hecho}{' '}
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
          {aviso.casilla}{' '}
          <Link href="/legal/privacidad" target="_blank">
            Cómo se tratan
          </Link>
          .
        </span>
      </label>
      <InfoPrivacidad capa={aviso.capa} />

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
