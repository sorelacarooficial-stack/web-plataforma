'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { revisar, type Contacto } from '@/lib/captacion';
import css from './Formularios.module.css';

type Estado = 'quieto' | 'enviando' | 'hecho' | 'fallo';
type Errores = Partial<Record<keyof Contacto, string>>;

const PUNTOS = [
  'Ya me formé con Sorela',
  'Tengo plaza en una formación',
  'Todavía no me he formado',
] as const;

const VACIO = { nombre: '', correo: '', ciudad: '', perfil: PUNTOS[0] as string, nota: '' };

/**
 * Lista de espera de la Comunidad Divine.
 *
 * Antes no enviaba nada: enseñaba «estás dentro» y el contacto se perdía.
 * Ahora pasa por la misma ruta que el resto de la web, así que el dato acaba
 * en Firestore y sale el correo automático.
 *
 * Y lleva casilla de consentimiento, que no tenía. En España es obligatoria
 * antes de recoger un correo, y sin ella la lista entera nace ilegítima.
 */
export default function ListaEspera() {
  const id = useId();
  const [v, setV] = useState(VACIO);
  const [acepta, setAcepta] = useState(false);
  const [senuelo, setSenuelo] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [estado, setEstado] = useState<Estado>('quieto');
  const [conCorreo, setConCorreo] = useState(true);

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

    const datos = { ...v, consentimiento: acepta, origen: 'lista-comunidad', empresa: senuelo };
    const revision = revisar(datos);
    if (!revision.ok) {
      setErrores(revision.errores);
      document.getElementById(`${id}-${Object.keys(revision.errores)[0]}`)?.focus();
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
        setConCorreo(cuerpo.correoEnviado !== false);
        setEstado('hecho');
        return;
      }
      if (cuerpo.errores) {
        setErrores(cuerpo.errores);
        setEstado('quieto');
        return;
      }
      setEstado('fallo');
    } catch {
      setEstado('fallo');
    }
  }

  if (estado === 'hecho') {
    return (
      <div className={css.exito} role="status">
        {/* «Estás dentro» sonaba a haber entrado en algún sitio, y lo que ha
            hecho es guardar su sitio en una lista que todavía no ha abierto. */}
        <h2 className={css.exitoTitulo}>Gracias. Tu sitio está guardado.</h2>
        <p className={css.exitoTexto}>
          {conCorreo
            ? 'Te acabo de mandar un correo para confirmártelo. Te aviso yo en cuanto abra, y entras con el precio fundador. Nada de correos cada semana.'
            : 'Te aviso yo en cuanto abra, y entras con el precio fundador. Nada de correos cada semana.'}
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
          Apuntar a otra persona
        </button>
      </div>
    );
  }

  if (estado === 'fallo') {
    return (
      <div className={css.exito} role="alert">
        <h2 className={css.exitoTitulo}>No he podido guardarlo.</h2>
        <p className={css.exitoTexto}>
          Ha fallado algo por mi parte. Vuelve a intentarlo, o escríbeme por Instagram y te apunto
          yo a mano.
        </p>
        <button type="button" className={css.deshacer} onClick={() => setEstado('quieto')}>
          Probar otra vez
        </button>
      </div>
    );
  }

  const enviando = estado === 'enviando';

  return (
    <form className="columna" style={{ gap: 12 }} onSubmit={enviar} noValidate>
      <h2 className={css.titulo}>Apúntate a la lista</h2>

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

      <input
        {...campo('ciudad')}
        placeholder="Ciudad donde trabajas"
        aria-label="Ciudad donde trabajas"
        autoComplete="address-level2"
      />

      <select {...campo('perfil')} aria-label="En qué punto estás">
        {PUNTOS.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>

      <textarea
        {...campo('nota')}
        rows={3}
        placeholder="¿Qué necesitarías tener ahí dentro?"
        aria-label="Qué necesitarías tener ahí dentro"
      />

      {/* Señuelo antirrobots: fuera de la vista y del orden de tabulación. */}
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
          Acepto que Sorela guarde estos datos para avisarme de la Comunidad Divine.{' '}
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
        disabled={enviando}
      >
        {enviando ? 'Un momento…' : 'Apuntarme a la lista'}
      </button>
      <p className="nota">Apuntarte no te compromete a nada y no te cobra nada.</p>
    </form>
  );
}
