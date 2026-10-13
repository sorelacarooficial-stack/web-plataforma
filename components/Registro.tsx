'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Marco from './MarcoAcceso';
import { auth, hayAuth } from '@/lib/firebase-navegador';
import css from './Acceso.module.css';
import InfoPrivacidad from '@/components/InfoPrivacidad';
import { CAPA_CUENTA } from '@/lib/privacidad';
import { llegada } from '@/lib/llegada';

/**
 * Crearse una cuenta.
 *
 * Lo que esta pantalla NO puede hacer es prometer acceso. Quien se registra
 * elige su contraseña y entra —eso sí—, pero lo que ve dentro depende de lo
 * que Sorela le haya dado, y al registrarse todavía no le ha dado nada. Así
 * que se dice antes de rellenar nada y se repite al terminar: la cuenta está
 * hecha, el acceso llega cuando ella lo confirme.
 *
 * Dicho de otra manera: esto quita el paso de mandar un enlace a mano, no el
 * de cobrar.
 *
 * La cuenta la crea el servidor (`app/api/registro`), no este navegador. El
 * motivo está explicado allí y conviene leerlo antes de mover nada: si se
 * creara desde aquí habría que abrir la creación de cuentas en la consola de
 * Firebase, y entonces cualquiera podría crearlas sin pasar por la web.
 */

const QUE_QUIERO = [
  {
    id: 'comunidad' as const,
    titulo: 'La Comunidad Divine',
    texto: 'Ya soy terapeuta certificada y quiero entrar en la membresía.',
  },
  {
    id: 'curso' as const,
    titulo: 'La formación',
    texto: 'Quiero formarme en la Técnica Divine.',
  },
];

type Invitacion = { etiquetas: string[]; nombre: string | null; correo: string | null };

export default function Registro({ invitacion }: { invitacion?: string }) {
  const router = useRouter();

  /* Con enlace de invitación, la pantalla cambia: el acceso ya viene dado,
     así que no se pregunta a qué viene ni se avisa de que hay que esperar. */
  const [inv, setInv] = useState<Invitacion | null>(null);
  const [invFallo, setInvFallo] = useState<string | null>(null);
  const [invCargando, setInvCargando] = useState(Boolean(invitacion));
  /* Si ese correo ya tiene cuenta, no se crea otra: se entra con la contraseña
     de siempre y se le suma lo del enlace. */
  const [yaTiene, setYaTiene] = useState(false);

  useEffect(() => {
    if (!invitacion) return;
    fetch(`/api/invitaciones/ver?codigo=${encodeURIComponent(invitacion)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setInv({ etiquetas: j.etiquetas, nombre: j.nombre, correo: j.correo });
          if (j.nombre) setNombre(j.nombre);
          if (j.correo) setCorreo(j.correo);
        } else setInvFallo(j.texto || 'Este enlace no vale.');
      })
      .catch(() => setInvFallo('No he podido comprobar el enlace. Revisa la conexión y recarga.'))
      .finally(() => setInvCargando(false));
  }, [invitacion]);

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [quiere, setQuiere] = useState<'comunidad' | 'curso'>('comunidad');
  const [acepta, setAcepta] = useState(false);
  const [sinNovedades, setSinNovedades] = useState(false);
  /* El señuelo antirrobots: no se ve, no se tabula y nadie lo rellena a mano.
     Si llega con algo, el servidor contesta que sí y no crea nada. */
  const [empresa, setEmpresa] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [hecho, setHecho] = useState(false);

  /** Entra con su contraseña de siempre y le suma lo del enlace. */
  async function anadirAMiCuenta() {
    if (!hayAuth || !invitacion) return;
    try {
      const credencial = await signInWithEmailAndPassword(auth(), correo.trim(), clave);
      const token = await credencial.user.getIdToken(true);
      const r = await fetch('/api/invitaciones/canjear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: invitacion, token }),
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setError(c.texto || 'No he podido añadirlo a tu cuenta. Vuelve a intentarlo.');
        setCargando(false);
        return;
      }
      const s = await fetch('/api/sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if ((await s.json().catch(() => ({ ok: false }))).ok) {
        router.push('/plataforma');
        router.refresh();
        return;
      }
      setHecho(true);
      setCargando(false);
    } catch {
      setErrores({ clave: 'Esa no es la contraseña de tu cuenta. Escribe la de siempre o recupérala desde «Entrar».' });
      setCargando(false);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setErrores({});
    setError(null);

    if (yaTiene) {
      await anadirAMiCuenta();
      return;
    }

    try {
      const r = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          correo,
          clave,
          quiere,
          consentimiento: acepta,
          sinNovedades,
          empresa,
          invitacion: inv ? invitacion : undefined,
          llegada: llegada() ?? undefined,
        }),
      });
      const c = await r.json().catch(() => ({ ok: false }));

      if (!c.ok) {
        /* Con enlace y un correo que ya tiene cuenta: se prueba a entrar con
           la contraseña que acaba de escribir, que muchas veces es la suya. */
        if (inv && c.motivo === 'ya-existe') {
          setYaTiene(true);
          await anadirAMiCuenta();
          return;
        }
        setErrores(c.errores ?? {});
        if (!c.errores || Object.keys(c.errores).length === 0) {
          setError(
            c.motivo === 'ritmo'
              ? 'Has probado varias veces seguidas. Espera un minuto y vuelve.'
              : c.motivo === 'sin-configurar'
                ? 'El registro todavía no está conectado. Escríbeme y te doy la cuenta yo.'
                : 'No he podido crear la cuenta. Vuelve a intentarlo.'
          );
        }
        setCargando(false);
        return;
      }

      setHecho(true);

      /*
       * Y se la deja dentro, sin pedirle la contraseña otra vez.
       *
       * Acaba de escribirla hace dos segundos: mandarla a la pantalla de
       * acceso a teclearla de nuevo es pedirle que demuestre algo que ya ha
       * demostrado. Si este paso falla —Firebase que no contesta—, no pasa
       * nada grave: la cuenta está creada y abajo tiene el enlace para entrar.
       */
      if (hayAuth) {
        try {
          const credencial = await signInWithEmailAndPassword(auth(), correo.trim(), clave);
          const token = await credencial.user.getIdToken(true);
          const s = await fetch('/api/sesion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          if ((await s.json().catch(() => ({ ok: false }))).ok) {
            router.push('/plataforma');
            router.refresh();
            return;
          }
        } catch {
          /* Se queda en la pantalla de «cuenta creada», que ya dice qué hacer. */
        }
      }
      setCargando(false);
    } catch {
      setError('No hay conexión. Revisa la red y vuelve a intentarlo.');
      setCargando(false);
    }
  }

  if (hecho) {
    return (
      <Marco>
        <h1 className={css.titulo}>Ya tienes tu cuenta.</h1>
        <div className={css.caja}>
          {inv ? (
            <p className="texto-fijo">
              Y ya tienes dentro {inv.etiquetas.join(' y ')}. Entra con tu correo y tu contraseña.
            </p>
          ) : (
          <p className="texto-fijo">
            Entra con tu correo y la contraseña que acabas de elegir. Dentro verás tu espacio:
            todavía en preparación hasta que yo te dé{' '}
            {quiere === 'comunidad' ? 'la comunidad' : 'tu formación'}, que es el paso que hago yo.
          </p>
          )}
          {!inv && <p className="texto-fijo">Te escribo en cuanto lo vea.</p>}
        </div>
        <p className={css.cambio}>
          <Link href="/entrar" className={css.enlaceFino}>
            Entrar en mi espacio
          </Link>
        </p>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1 className={css.titulo}>{inv ? (yaTiene ? 'Añádelo a tu cuenta' : 'Bienvenida') : 'Crea tu cuenta'}</h1>

      <div className={css.caja}>
        {invitacion && invCargando && <p className={css.letraPequena}>Comprobando tu enlace…</p>}
        {invFallo && (
          <p className={css.error} role="alert" style={{ marginBottom: 8 }}>
            {invFallo}
          </p>
        )}
        {inv ? (
          <div className={css.invitacion}>
            <span className={css.invitacionRotulo}>Sorela te da acceso a</span>
            {inv.etiquetas.map((e) => (
              <strong key={e} className={css.invitacionQue}>
                {e}
              </strong>
            ))}
            <span className={css.letraPequena} style={{ maxWidth: 'none' }}>
              {yaTiene
                ? 'Ese correo ya tiene cuenta. Escribe tu contraseña de siempre y lo añado a lo que ya tienes.'
                : 'Crea tu contraseña y entras directamente. Si ya tienes cuenta, pon tu correo y tu contraseña de siempre.'}
            </span>
          </div>
        ) : (
          /* Se dice ANTES de que escriba nada, no después de pulsar: si alguien
             rellena cuatro campos creyendo que va a entrar en la comunidad y se
             encuentra con que no, la culpa es de esta pantalla. */
          !invitacion && (
            <p className={css.letraPequena} style={{ maxWidth: 'none', marginBottom: 4 }}>
              Crear la cuenta no te da acceso todavía: el acceso te lo doy yo cuando confirmo tu plaza.
              Esto es para que tengas tu contraseña puesta y no dependas de que yo te mande nada.
            </p>
          )
        )}

        {(!invitacion || inv) && (
        <form className={css.formulario} onSubmit={enviar} noValidate>
          {!inv && (
          <fieldset className={css.opciones}>
            <legend className={css.opcionesTitulo}>A qué vienes</legend>
            {QUE_QUIERO.map((o) => (
              <label
                key={o.id}
                className={`${css.opcion} ${quiere === o.id ? css.opcionElegida : ''}`}
              >
                <input
                  type="radio"
                  name="quiere"
                  value={o.id}
                  checked={quiere === o.id}
                  onChange={() => setQuiere(o.id)}
                  className={css.casilla}
                />
                <span className={css.opcionCuerpo}>
                  <span className={css.opcionTitulo}>{o.titulo}</span>
                  <span className={css.opcionTexto}>{o.texto}</span>
                </span>
              </label>
            ))}
          </fieldset>
          )}

          <input
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Nombre y apellidos"
            aria-label="Nombre y apellidos"
            className={css.campo}
            hidden={yaTiene}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          {errores.nombre && (
            <p className={css.error} role="alert">
              {errores.nombre}
            </p>
          )}

          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Correo"
            aria-label="Correo"
            className={css.campo}
            value={correo}
            readOnly={Boolean(inv?.correo) || yaTiene}
            onChange={(e) => setCorreo(e.target.value)}
          />
          {errores.correo && (
            <p className={css.error} role="alert">
              {errores.correo}
            </p>
          )}

          <input
            type="password"
            autoComplete="new-password"
            placeholder={yaTiene ? 'Tu contraseña de siempre' : 'Contraseña (mínimo 8 caracteres)'}
            aria-label="Contraseña"
            className={css.campo}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          {errores.clave && (
            <p className={css.error} role="alert">
              {errores.clave}
            </p>
          )}

          {/* Fuera de la vista y fuera del tabulador, pero NO con display:none:
              hay robots que se saltan lo que está oculto de esa manera. */}
          <input
            type="text"
            name="empresa"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />

          <label className={css.condiciones}>
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
              className={css.casilla}
            />
            <span>
              {/* «Acepto la política» no es dar permiso para nada concreto: lo
                  que se confirma aquí es la edad (la plataforma es para
                  adultas) y que se ha tenido delante la información. */}
              Soy mayor de edad y he leído la{' '}
              <Link href="/legal/privacidad" className={css.enlaceFino}>
                política de privacidad
              </Link>
              .
            </span>
          </label>
          {errores.consentimiento && (
            <p className={css.error} role="alert">
              {errores.consentimiento}
            </p>
          )}
          {/* La ley deja escribir a quien ya es usuaria sobre formaciones
              parecidas (art. 21.2 LSSI) siempre que pueda negarse AL DARSE DE
              ALTA, de forma sencilla. Esta es esa forma. */}
          <label className={css.condiciones}>
            <input
              type="checkbox"
              checked={sinNovedades}
              onChange={(e) => setSinNovedades(e.target.checked)}
              className={css.casilla}
            />
            <span>No quiero novedades de las formaciones por correo.</span>
          </label>
          <InfoPrivacidad capa={CAPA_CUENTA} />

          {error && (
            <p className={css.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={css.enviar} disabled={cargando}>
            {cargando ? 'Un momento…' : yaTiene ? 'Añadir a mi cuenta' : inv ? 'Crear mi cuenta y entrar' : 'Crear mi cuenta'}
          </button>
          {errores.invitacion && (
            <p className={css.error} role="alert">
              {errores.invitacion}
            </p>
          )}
        </form>
        )}
      </div>

      <p className={css.cambio}>
        ¿Ya tienes cuenta?
        <Link href="/entrar" className={css.enlaceFino}>
          Entrar
        </Link>
      </p>
    </Marco>
  );
}
