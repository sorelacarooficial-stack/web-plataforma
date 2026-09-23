'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { revisar, type Contacto } from '@/lib/captacion';
import { INSTAGRAM, INSTAGRAM_USUARIO, WHATSAPP_SORELA } from '@/lib/contenido';
import css from './Captacion.module.css';

type Estado = 'quieto' | 'enviando' | 'hecho' | 'sinSitio';
type Errores = Partial<Record<keyof Contacto, string>>;

const VACIO = { nombre: '', correo: '', whatsapp: '' };

/**
 * Formulario de captación. Es la única puerta por la que hoy entra un dato de
 * verdad en el negocio, y está hecho pensando en el peor escenario: alguien de
 * pie, con prisa, con una mano y con mala cobertura.
 *
 * Tres campos y ni uno más. Cada campo que se añade cuesta contactos, y el
 * nombre, el correo y el teléfono son los tres que permiten continuar la
 * conversación. Lo demás se pregunta luego, hablando.
 */
export default function Captacion({
  compacto = false,
  titulo,
  entradilla,
  origenForzado,
}: {
  compacto?: boolean;
  titulo?: string;
  entradilla?: string;
  /** Gana al parámetro de la dirección: lo usa quien abre la ventana desde el asistente. */
  origenForzado?: string;
}) {
  const id = useId();
  const [v, setV] = useState(VACIO);
  const [acepta, setAcepta] = useState(false);
  const [senuelo, setSenuelo] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [estado, setEstado] = useState<Estado>('quieto');
  const [conCorreo, setConCorreo] = useState(true);
  const [origen, setOrigen] = useState('web');

  // De dónde viene la visita. Un QR puede llevar ?e=expo, y así en Firestore
  // se distingue quién entró por el código y quién por Instagram. Se lee de
  // window y no con useSearchParams para no obligar a toda la página a
  // renderizarse en cliente por un parámetro opcional.
  useEffect(() => {
    if (origenForzado) {
      setOrigen(origenForzado);
      return;
    }
    const e = new URLSearchParams(window.location.search).get('e');
    if (e) setOrigen(e.replace(/[^\w-]/g, '').slice(0, 40) || 'web');
  }, [origenForzado]);

  const campo = (k: keyof typeof VACIO) => ({
    id: `${id}-${k}`,
    value: v[k],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
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

    // El teléfono es opcional para el servidor, porque la lista de la comunidad
    // no lo pide. Este formulario sí lo pide, así que aquí sí se exige: un
    // campo con asterisco que se puede dejar en blanco confunde.
    const faltaTelefono = !v.whatsapp.trim();
    if (!revision.ok || faltaTelefono) {
      const errores = {
        ...(revision.ok ? {} : revision.errores),
        ...(faltaTelefono ? { whatsapp: 'Escribe tu teléfono.' } : {}),
      };
      setErrores(errores);
      const primero = Object.keys(errores)[0];
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
        // El servidor dice si el correo salió de verdad. Sin esto, la pantalla
        // prometería un correo que quizá no ha llegado a enviarse, y esa
        // promesa incumplida se paga con una persona esperando.
        setConCorreo(cuerpo.correoEnviado !== false);
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
      // Sin cobertura. Mismo desenlace: salida por WhatsApp.
      setEstado('sinSitio');
    }
  }

  if (estado === 'hecho') {
    return (
      <div className={css.exito} role="status">
        {/* El título hablaba de estar «dentro», y quien lo lee no ha entrado en
            ningún sitio: acaba de dejar su contacto. Ahora se le agradece, que
            es lo que toca, y se le dice exactamente qué va a pasar. */}
        <h2 className={css.exitoTitulo}>
          Gracias por contar conmigo, {v.nombre.trim().split(' ')[0]}.
        </h2>
        <p className={css.exitoTexto}>
          {conCorreo ? (
            <>
              Te acabo de mandar un correo con toda la información de la Técnica Divine: qué es,
              cómo se aprende y cuándo son las próximas formaciones. Si no lo ves en un par de
              minutos, mira en spam: la primera vez suele esconderse ahí.
            </>
          ) : (
            <>
              Ya tengo tus datos. Te escribo yo con toda la información de la Técnica Divine —qué
              es, cómo se aprende y cuándo son las próximas formaciones—. No tienes que hacer nada
              más.
            </>
          )}
        </p>
        <Link href="/formaciones" className="btn btn-md">
          Ver las formaciones
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
      {titulo && <h2 className={css.titulo}>{titulo}</h2>}
      {entradilla && <p className={css.entradilla}>{entradilla}</p>}

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
            Teléfono
          </label>
          <input
            {...campo('whatsapp')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="send"
            placeholder="600 00 00 00"
          />
          {errores.whatsapp && (
            <p className={css.error} id={`${id}-whatsapp-error`}>
              {errores.whatsapp}
            </p>
          )}
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
