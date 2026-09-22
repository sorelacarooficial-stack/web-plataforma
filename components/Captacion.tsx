'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { PERFILES, revisar, type Contacto } from '@/lib/captacion';
import { INSTAGRAM, INSTAGRAM_USUARIO, WHATSAPP_SORELA } from '@/lib/contenido';
import css from './Captacion.module.css';

type Estado = 'quieto' | 'enviando' | 'hecho' | 'sinSitio';
type Errores = Partial<Record<keyof Contacto, string>>;

const VACIO = { nombre: '', correo: '', whatsapp: '', perfil: PERFILES[0] };

/**
 * Formulario de captación. Es el único sitio de la web donde hoy entra un dato
 * de verdad, así que está hecho pensando en el peor escenario: una persona de
 * pie en una exposición, con prisa, con una mano y con mala cobertura.
 *
 * De ahí tres decisiones que no son las habituales:
 *
 *  · Cuatro campos y ni uno más. Cada campo extra cuesta contactos.
 *  · Si el servidor falla, NO se dice «gracias». Se enseña la salida por
 *    WhatsApp con el mensaje ya escrito, para que el contacto llegue igual.
 *  · El teclado del móvil se abre en el modo correcto en cada campo. Escribir
 *    un correo con el teclado de texto en vertical es motivo de abandono.
 */
export default function Captacion({ compacto = false }: { compacto?: boolean }) {
  const id = useId();
  const [v, setV] = useState(VACIO);
  const [acepta, setAcepta] = useState(false);
  const [senuelo, setSenuelo] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [estado, setEstado] = useState<Estado>('quieto');
  const [origen, setOrigen] = useState('web');

  // De dónde viene la visita. El QR de la exposición lleva ?e=expo, y así la
  // hoja distingue quién entró por el código y quién por Instagram. Se lee de
  // window y no con useSearchParams para no obligar a toda la home a
  // renderizarse en cliente por un parámetro opcional.
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('e');
    if (e) setOrigen(e.replace(/[^\w-]/g, '').slice(0, 40) || 'web');
  }, []);

  const campo = (k: keyof typeof VACIO) => ({
    id: `${id}-${k}`,
    value: v[k],
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setV((s) => ({ ...s, [k]: ev.target.value }));
      // El error se borra al tocar el campo, no al reenviar: corregir y seguir
      // viendo el aviso en rojo hace pensar que no se ha arreglado.
      if (errores[k]) setErrores((s) => ({ ...s, [k]: undefined }));
    },
    'aria-invalid': errores[k] ? true : undefined,
    'aria-describedby': errores[k] ? `${id}-${k}-error` : undefined,
    className: `campo ${css.campo} ${errores[k] ? css.campoMal : ''}`,
  });

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (estado === 'enviando') return;

    const datos = { ...v, consentimiento: acepta, origen, empresa: senuelo };
    const revision = revisar(datos);
    if (!revision.ok) {
      setErrores(revision.errores);
      const primero = Object.keys(revision.errores)[0];
      document.getElementById(`${id}-${primero}`)?.focus();
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
      if (cuerpo.ok) {
        setEstado('hecho');
        return;
      }
      if (cuerpo.errores) {
        setErrores(cuerpo.errores);
        setEstado('quieto');
        return;
      }
      setEstado('sinSitio');
    } catch {
      // Sin cobertura en el recinto. Mismo desenlace: salida por WhatsApp.
      setEstado('sinSitio');
    }
  }

  if (estado === 'hecho') {
    return (
      <div className={css.exito} role="status">
        <h2 className={css.exitoTitulo}>Ya lo tengo, {v.nombre.trim().split(' ')[0]}.</h2>
        <p className={css.exitoTexto}>
          Te acabo de mandar un correo con la información de la Técnica Divine y las próximas
          fechas. Si no lo ves en un par de minutos, mira en spam: a veces se esconde ahí la
          primera vez.
        </p>
        <Link href="/formaciones" className="btn btn-md">
          Ver las fechas ahora
        </Link>
      </div>
    );
  }

  if (estado === 'sinSitio') {
    const texto = encodeURIComponent(
      `Hola Sorela, soy ${v.nombre}. Te dejo mi contacto para la información de la Técnica Divine: ${v.correo}`
    );
    return (
      <div className={css.exito} role="alert">
        <h2 className={css.exitoTitulo}>No he podido guardarlo.</h2>
        <p className={css.exitoTexto}>
          Ha fallado algo por mi parte y no quiero que pierdas el viaje. Mándame estos mismos datos
          por aquí y te contesto yo:
        </p>
        {WHATSAPP_SORELA ? (
          <a
            className="btn btn-md"
            href={`https://wa.me/${WHATSAPP_SORELA.replace(/\D/g, '')}?text=${texto}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Escribir por WhatsApp
          </a>
        ) : (
          <a className="btn btn-md" href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
            Escribir por Instagram
          </a>
        )}
        <button type="button" className={css.reintentar} onClick={() => setEstado('quieto')}>
          O probar otra vez
        </button>
      </div>
    );
  }

  const enviando = estado === 'enviando';

  return (
    <form className={`${css.forma} ${compacto ? css.compacta : ''}`} onSubmit={enviar} noValidate>
      <div className={css.campos}>
        <div className={css.grupo}>
          <label className={css.etiqueta} htmlFor={`${id}-nombre`}>
            Nombre
          </label>
          <input
            {...campo('nombre')}
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Tu nombre"
          />
          {errores.nombre && (
            <p className={css.error} id={`${id}-nombre-error`}>
              {errores.nombre}
            </p>
          )}
        </div>

        <div className={css.grupo}>
          <label className={css.etiqueta} htmlFor={`${id}-correo`}>
            Correo
          </label>
          <input
            {...campo('correo')}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="tucorreo@ejemplo.com"
          />
          {errores.correo && (
            <p className={css.error} id={`${id}-correo-error`}>
              {errores.correo}
            </p>
          )}
        </div>

        <div className={css.grupo}>
          <label className={css.etiqueta} htmlFor={`${id}-whatsapp`}>
            WhatsApp
          </label>
          <input
            {...campo('whatsapp')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            placeholder="600 00 00 00"
          />
          {errores.whatsapp && (
            <p className={css.error} id={`${id}-whatsapp-error`}>
              {errores.whatsapp}
            </p>
          )}
        </div>

        <div className={css.grupo}>
          <label className={css.etiqueta} htmlFor={`${id}-perfil`}>
            ¿A qué te dedicas?
          </label>
          <select {...campo('perfil')}>
            {PERFILES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Señuelo antirrobots. Fuera de la vista y fuera del orden de tabulación,
          y anunciado como oculto para que un lector de pantalla lo ignore. */}
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
            if (errores.consentimiento) setErrores((s) => ({ ...s, consentimiento: undefined }));
          }}
          aria-invalid={errores.consentimiento ? true : undefined}
        />
        <span>
          Acepto que Sorela guarde estos datos para enviarme la información de la Técnica Divine.{' '}
          <Link href="/legal/privacidad" target="_blank">
            Cómo se tratan
          </Link>
          .
        </span>
      </label>
      {errores.consentimiento && <p className={css.error}>{errores.consentimiento}</p>}

      <button type="submit" className={`btn ${css.enviar}`} disabled={enviando}>
        {enviando ? 'Un momento…' : 'Enviarme la información'}
      </button>

      <p className={css.nota}>
        Un correo con la información y nada más. Sin listas de cada semana. Si prefieres, escribe a{' '}
        <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
          {INSTAGRAM_USUARIO}
        </a>
        .
      </p>
    </form>
  );
}
