'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { revisar, type Contacto } from '@/lib/captacion';
import formCss from './Formularios.module.css';
import css from './Reserva.module.css';

type Estado = 'quieto' | 'enviando' | 'hecho' | 'fallo';
type Errores = Partial<Record<keyof Contacto, string>>;

const MOMENTOS = [
  'Mañanas entre semana',
  'Tardes entre semana',
  'Fines de semana',
  'Me adapto a lo que haya',
];

const VACIO = { nombre: '', correo: '', whatsapp: '', perfil: MOMENTOS[0], nota: '' };

/**
 * Petición de cita con una terapeuta certificada.
 *
 * Aquí había un calendario con días de marzo de 2027 y cinco horas libres,
 * todo inventado: ninguna terapeuta tenía agenda de verdad detrás, así que
 * quien elegía «miércoles 3 a las 11:30» estaba eligiendo un hueco que no
 * existía. Elegir una hora falsa es peor que no poder elegir: se da por
 * cerrada una cita que nadie ha reservado.
 *
 * Hasta que cada terapeuta tenga su agenda dentro de la plataforma, esto pide
 * disponibilidad aproximada y la terapeuta cierra la hora por correo. Es más
 * lento y es verdad.
 */
export default function Reserva({ ciudad }: { ciudad: string }) {
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

    const datos = {
      ...v,
      consentimiento: acepta,
      origen: `cita-${ciudad.toLowerCase().replace(/\s+/g, '-')}`,
      empresa: senuelo,
    };
    const revision = revisar(datos);
    const faltaTelefono = !v.whatsapp.trim();
    if (!revision.ok || faltaTelefono) {
      const errs = {
        ...(revision.ok ? {} : revision.errores),
        ...(faltaTelefono ? { whatsapp: 'Escribe tu teléfono.' } : {}),
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

  if (estado === 'hecho') {
    return (
      <div className="formulario">
        <div className={formCss.exito} role="status">
          <h3 className={formCss.exitoTitulo}>Gracias, ya está enviada.</h3>
          <p className={formCss.exitoTexto}>
            Tu petición para la consulta de {ciudad} ha llegado. Te escribe ella por correo con las
            horas que tiene libres, no un robot.
          </p>
          <button
            type="button"
            className={formCss.deshacer}
            style={{ marginTop: 4 }}
            onClick={() => {
              setV(VACIO);
              setAcepta(false);
              setEstado('quieto');
            }}
          >
            Pedir otra cita
          </button>
        </div>
      </div>
    );
  }

  if (estado === 'fallo') {
    return (
      <div className="formulario">
        <div className={formCss.exito} role="alert">
          <h3 className={formCss.exitoTitulo}>No he podido enviarlo.</h3>
          <p className={formCss.exitoTexto}>
            Ha fallado algo por mi parte. Vuelve a intentarlo, por favor.
          </p>
          <button type="button" className={formCss.deshacer} onClick={() => setEstado('quieto')}>
            Probar otra vez
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={css.rejilla}>
      <div className="columna" style={{ gap: 14 }}>
        <p className={css.rotulo}>Cómo funciona</p>
        <ol className={css.pasos}>
          <li>Dejas tu contacto y cuándo te viene bien.</li>
          <li>Ella te escribe con las horas que tiene libres.</li>
          <li>Cerráis la que te encaje.</li>
        </ol>
        <p className="nota" style={{ maxWidth: 320 }}>
          Toda sesión empieza con unos minutos de valoración: no se trabaja sobre un cuerpo sin
          haberlo mirado antes.
        </p>
      </div>

      <form className="formulario" onSubmit={enviar} noValidate>
        <p className={css.resumen}>Consulta de {ciudad}</p>

        <input
          {...campo('nombre')}
          placeholder="Nombre y apellidos"
          aria-label="Nombre y apellidos"
          autoComplete="name"
          autoCapitalize="words"
        />
        {errores.nombre && <p className={formCss.error}>{errores.nombre}</p>}

        <input
          {...campo('whatsapp')}
          type="tel"
          inputMode="tel"
          placeholder="Teléfono"
          aria-label="Teléfono"
          autoComplete="tel"
        />
        {errores.whatsapp && <p className={formCss.error}>{errores.whatsapp}</p>}

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
        {errores.correo && <p className={formCss.error}>{errores.correo}</p>}

        <select {...campo('perfil')} aria-label="Cuándo te viene bien">
          {MOMENTOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>

        <textarea
          {...campo('nota')}
          rows={3}
          placeholder="Cuéntale en dos líneas qué te trae"
          aria-label="Cuéntale en dos líneas qué te trae"
        />

        {/* Señuelo antirrobots. */}
        <div className={formCss.senuelo} aria-hidden="true">
          <label htmlFor={`${id}-empresa`}>No rellenar</label>
          <input
            id={`${id}-empresa`}
            tabIndex={-1}
            autoComplete="off"
            value={senuelo}
            onChange={(e) => setSenuelo(e.target.value)}
          />
        </div>

        <label className={formCss.consentimiento}>
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => {
              setAcepta(e.target.checked);
              if (errores.consentimiento) setErrores((s) => ({ ...s, consentimiento: undefined }));
            }}
            aria-invalid={errores.consentimiento ? true : undefined}
          />
          <span>
            Acepto que se guarden estos datos para gestionar mi cita.{' '}
            <Link href="/legal/privacidad" target="_blank">
              Cómo se tratan
            </Link>
            .
          </span>
        </label>
        {errores.consentimiento && <p className={formCss.error}>{errores.consentimiento}</p>}

        <button
          type="submit"
          className="btn btn-md"
          style={{ marginTop: 6, justifyContent: 'center' }}
          disabled={estado === 'enviando'}
        >
          {estado === 'enviando' ? 'Un momento…' : 'Pedir cita'}
        </button>
      </form>
    </div>
  );
}
