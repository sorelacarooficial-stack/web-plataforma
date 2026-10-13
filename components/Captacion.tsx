'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { revisar, type Contacto } from '@/lib/captacion';
import { INSTAGRAM, INSTAGRAM_USUARIO, WHATSAPP_SORELA } from '@/lib/contenido';
import css from './Captacion.module.css';
import InfoPrivacidad from '@/components/InfoPrivacidad';
import { CAPA_INFORMACION } from '@/lib/privacidad';
import { conLlegada } from '@/lib/llegada';
import { GRUPO_WHATSAPP } from '@/lib/apertura';

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
        body: JSON.stringify(conLlegada(datos)),
      });
      const cuerpo = await r.json().catch(() => ({ ok: false }));
      if (cuerpo.ok) {
        // La confirmación no habla del correo (salga o no): solo del grupo.
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
        {/* La usuaria no quería que la confirmación prometiera envíos («te
            mando», «te escribo»): el siguiente paso es uno solo y lo da quien
            se apunta, entrar en el grupo de WhatsApp. */}
        <h2 className={css.exitoTitulo}>
          Gracias, {v.nombre.trim().split(' ')[0]}. Ya te has apuntado.
        </h2>
        <ol className={css.pasos} aria-label="Cómo sigue">
          <li className={css.paso} data-hecho>
            <span className={css.pasoMarca} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.2 4.2L19 7" />
              </svg>
            </span>
            <span>Tus datos, guardados</span>
          </li>
          <li className={css.paso}>
            <span className={css.pasoMarca} aria-hidden="true">2</span>
            <span>Entra en el grupo de WhatsApp</span>
          </li>
        </ol>
        <a href={GRUPO_WHATSAPP} target="_blank" rel="noopener noreferrer" className={css.grupoWhatsapp}>
          <span className={css.grupoIcono} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 2.2a9.7 9.7 0 0 0-8.3 14.8L2.3 21.8l4.9-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.5-.3Z" />
            </svg>
          </span>
          <span className={css.grupoTexto}>
            <b>Grupo de WhatsApp</b>
            <span>Técnica Divine · con Sorela</span>
          </span>
          <span className={css.grupoFlecha} aria-hidden="true">
            Entrar →
          </span>
        </a>
        <Link href="/formaciones" className={css.reintentar}>
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
          Tengo 14 años o más y acepto que Sorela Caro use mis datos para la lista de espera y para avisarme de la apertura y de las formaciones.{' '}
          <Link href="/legal/privacidad" target="_blank">
            Cómo se tratan
          </Link>
          .
        </span>
      </label>
      {errores.consentimiento && <p className={css.error}>{errores.consentimiento}</p>}
      <InfoPrivacidad capa={CAPA_INFORMACION} />

      <button type="submit" className={`btn ${css.enviar}`} disabled={enviando}>
        {enviando ? 'Un momento…' : 'Apuntarme'}
      </button>

      <p className={css.nota}>
        Al terminar verás el enlace al grupo de WhatsApp. Si prefieres, escribe a{' '}
        <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
          {INSTAGRAM_USUARIO}
        </a>
        .
      </p>
    </form>
  );
}
