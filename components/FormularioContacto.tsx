'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { revisar, type Contacto } from '@/lib/captacion';
import { INSTAGRAM, INSTAGRAM_USUARIO } from '@/lib/contenido';
import css from './Formularios.module.css';

const MOTIVOS = [
  'Quiero formarme',
  'Lista de espera de la comunidad',
  'Soy clienta y busco terapeuta',
  'Colaboración',
];

type Estado = 'quieto' | 'enviando' | 'hecho' | 'fallo';
type Errores = Partial<Record<keyof Contacto, string>>;

const VACIO = { nombre: '', correo: '', perfil: MOTIVOS[0], nota: '' };

/**
 * Formulario de contacto.
 *
 * Antes no enviaba nada: decía «recibido» y el mensaje se perdía. Ahora pasa
 * por la misma ruta que el resto de la web, con su casilla de consentimiento.
 * El motivo viaja como «perfil» y el mensaje como «nota», que son los campos
 * que ya entiende la ruta: un formulario más no necesita una tubería más.
 */
export default function FormularioContacto() {
  const id = useId();
  const [v, setV] = useState(VACIO);
  const [acepta, setAcepta] = useState(false);
  const [senuelo, setSenuelo] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [estado, setEstado] = useState<Estado>('quieto');

  const campo = (k: keyof typeof VACIO) => ({
    id: `${id}-${k}`,
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setV((s) => ({ ...s, [k]: e.target.value }));
      if (errores[k as keyof Contacto]) setErrores((s) => ({ ...s, [k]: undefined }));
    },
    'aria-invalid': errores[k as keyof Contacto] ? true : undefined,
    className: 'campo',
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === 'enviando') return;

    const datos = { ...v, consentimiento: acepta, origen: 'contacto', empresa: senuelo };
    const revision = revisar(datos);
    const faltaMensaje = v.nota.trim().length < 5;
    if (!revision.ok || faltaMensaje) {
      const errs = {
        ...(revision.ok ? {} : revision.errores),
        ...(faltaMensaje ? { nota: 'Cuéntame un poco más, para poder contestarte.' } : {}),
      };
      setErrores(errs);
      document.getElementById(`${id}-${Object.keys(errs)[0]}`)?.focus();
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
      if (cuerpo.errores) {
        setErrores(cuerpo.errores);
        return setEstado('quieto');
      }
      setEstado('fallo');
    } catch {
      setEstado('fallo');
    }
  }

  return (
    <div className={css.contactoCaja}>
      {estado === 'hecho' ? (
        <div className={css.exito} role="status">
          <h2 className={css.exitoTitulo}>Recibido.</h2>
          <p className={css.exitoTexto}>
            Te contesto yo, y tardo menos de 48 horas. Si es urgente, por Instagram voy más rápido.
          </p>
          <button
            type="button"
            className={css.deshacer}
            style={{ marginTop: 4 }}
            onClick={() => {
              setV(VACIO);
              setAcepta(false);
              setEstado('quieto');
            }}
          >
            Escribir otro mensaje
          </button>
        </div>
      ) : estado === 'fallo' ? (
        <div className={css.exito} role="alert">
          <h2 className={css.exitoTitulo}>No he podido enviarlo.</h2>
          <p className={css.exitoTexto}>
            Ha fallado algo por mi parte y no quiero que pierdas el mensaje. Escríbeme por{' '}
            <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
              {INSTAGRAM_USUARIO}
            </a>{' '}
            y te contesto igual.
          </p>
          <button type="button" className={css.deshacer} onClick={() => setEstado('quieto')}>
            O probar otra vez
          </button>
        </div>
      ) : (
        <form className="columna" style={{ gap: 12 }} onSubmit={enviar} noValidate>
          <input
            {...campo('nombre')}
            placeholder="Nombre"
            aria-label="Nombre"
            autoComplete="name"
            autoCapitalize="words"
          />
          {errores.nombre && <p className={css.error}>{errores.nombre}</p>}

          <input
            {...campo('correo')}
            type="email"
            inputMode="email"
            placeholder="Correo"
            aria-label="Correo"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {errores.correo && <p className={css.error}>{errores.correo}</p>}

          <select {...campo('perfil')} aria-label="Motivo">
            {MOTIVOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          <textarea {...campo('nota')} rows={5} placeholder="Cuéntame" aria-label="Cuéntame" />
          {errores.nota && <p className={css.error}>{errores.nota}</p>}

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
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => {
                setAcepta(e.target.checked);
                if (errores.consentimiento)
                  setErrores((s) => ({ ...s, consentimiento: undefined }));
              }}
              aria-invalid={errores.consentimiento ? true : undefined}
            />
            <span>
              Acepto que Sorela guarde estos datos para contestarme.{' '}
              <Link href="/legal/privacidad" target="_blank">
                Cómo se tratan
              </Link>
              .
            </span>
          </label>
          {errores.consentimiento && <p className={css.error}>{errores.consentimiento}</p>}

          <button
            type="submit"
            className="btn btn-md"
            style={{ marginTop: 6, justifyContent: 'center' }}
            disabled={estado === 'enviando'}
          >
            {estado === 'enviando' ? 'Un momento…' : 'Enviar'}
          </button>
        </form>
      )}
    </div>
  );
}
