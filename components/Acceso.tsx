'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import CambiarTema from './CambiarTema';
import IconoGoogle from './IconoGoogle';
import { auth, hayAuth, proveedorGoogle } from '@/lib/firebase-navegador';
import logo from '@/fotos/logo-sorela.png';
import consulta from '@/fotos/acceso-consulta.webp';
import css from './Acceso.module.css';

type Modo = 'acceso' | 'registro';

/**
 * Pantalla de acceso a la plataforma: la de Sorela y la de sus alumnas y
 * terapeutas certificadas. Es la misma puerta para las tres; el rol se
 * resuelve al autenticar, no aquí.
 *
 * Autentica de verdad contra Firebase. El camino tiene dos pasos y conviene
 * entenderlo: Firebase devuelve al navegador un token que solo vive en la
 * memoria de la pestaña, y con eso el servidor no puede proteger nada. Por eso
 * en cuanto hay token se manda a /api/sesion, que lo cambia por una cookie
 * firmada. Hasta que esa cookie no existe, no se navega a la plataforma.
 */
export default function Acceso() {
  return (
    // useSearchParams obliga a envolver en Suspense para que el resto de la
    // página se siga generando de forma estática.
    <Suspense fallback={<Pantalla />}>
      <Pantalla conParametros />
    </Suspense>
  );
}

function Pantalla({ conParametros = false }: { conParametros?: boolean }) {
  return conParametros ? <Formulario /> : <Marco>{null}</Marco>;
}

/** Traduce los códigos de Firebase, que son ilegibles para quien los recibe. */
function mensaje(codigo: string): string {
  const mapa: Record<string, string> = {
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/invalid-email': 'Ese correo no parece correcto.',
    'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
    'auth/wrong-password': 'El correo o la contraseña no son correctos.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese correo. Entra en vez de registrarte.',
    'auth/weak-password': 'La contraseña necesita al menos seis caracteres.',
    'auth/too-many-requests': 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
    'auth/popup-closed-by-user': 'Has cerrado la ventana de Google antes de terminar.',
    'auth/popup-blocked': 'El navegador ha bloqueado la ventana de Google. Permítela y vuelve a intentarlo.',
    'auth/network-request-failed': 'No hay conexión. Revisa la red y vuelve a intentarlo.',
    'auth/operation-not-allowed': 'Ese método de acceso no está activado en Firebase.',
  };
  return mapa[codigo] || 'No he podido entrar. Vuelve a intentarlo en un momento.';
}

function Formulario() {
  const router = useRouter();
  const parametros = useSearchParams();
  const volver = parametros.get('volver') || '/plataforma';

  const [modo, setModo] = useState<Modo>('acceso');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const esRegistro = modo === 'registro';

  /**
   * El paso que de verdad abre la sesión: cambia el token por la cookie. Si
   * este paso falla, NO se navega a la plataforma, porque allí no habría
   * sesión y rebotaría de vuelta aquí sin explicar por qué.
   */
  async function abrirSesion(credencial: UserCredential) {
    const token = await credencial.user.getIdToken(true);
    const r = await fetch('/api/sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const cuerpo = await r.json().catch(() => ({ ok: false }));
    if (!cuerpo.ok) {
      throw new Error(
        cuerpo.motivo === 'sin-configurar'
          ? 'El servidor todavía no tiene Firebase configurado.'
          : 'No he podido abrir la sesión. Vuelve a intentarlo.'
      );
    }
    router.push(volver);
    // Sin refresh, Next puede servir la plataforma desde su caché de cliente,
    // que se guardó cuando no había sesión.
    router.refresh();
  }

  async function conGoogle() {
    if (cargando) return;
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      await abrirSesion(await signInWithPopup(auth(), proveedorGoogle()));
    } catch (e) {
      setError(traducir(e));
      setCargando(false);
    }
  }

  async function conCorreo(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      if (esRegistro) {
        const credencial = await createUserWithEmailAndPassword(auth(), correo, clave);
        if (nombre.trim()) {
          await updateProfile(credencial.user, { displayName: nombre.trim() });
          // El token se pide de nuevo dentro de abrirSesion, así que el nombre
          // recién puesto ya viaja en él.
        }
        await abrirSesion(credencial);
      } else {
        await abrirSesion(await signInWithEmailAndPassword(auth(), correo, clave));
      }
    } catch (e) {
      setError(traducir(e));
      setCargando(false);
    }
  }

  async function recuperar() {
    setError(null);
    setAviso(null);
    if (!correo.trim()) {
      setError('Escribe tu correo y vuelvo a mandarte el acceso.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth(), correo.trim());
      // Se contesta lo mismo exista o no la cuenta: decir «ese correo no está
      // registrado» permitiría averiguar quién tiene cuenta y quién no.
      setAviso('Si hay una cuenta con ese correo, te acabo de mandar un enlace para cambiarla.');
    } catch (e) {
      setError(traducir(e));
    }
  }

  function traducir(e: unknown): string {
    if (e && typeof e === 'object' && 'code' in e) return mensaje(String((e as { code: string }).code));
    if (e instanceof Error) return e.message;
    return 'No he podido entrar. Vuelve a intentarlo en un momento.';
  }

  if (!hayAuth) {
    return (
      <Marco>
        <h1 className={css.titulo}>El acceso todavía no está conectado.</h1>
        <div className={css.caja}>
          <p className="texto-fijo">
            Falta la configuración de Firebase. En cuanto esté, esta pantalla pedirá tus datos y
            entrarás con tu cuenta.
          </p>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1 className={css.titulo}>{esRegistro ? 'Crea tu cuenta' : 'Entra en tu espacio'}</h1>

      <div className={css.caja}>
        <button type="button" onClick={conGoogle} className={css.google} disabled={cargando}>
          <span className={css.googleMarca}>
            <IconoGoogle size={18} />
          </span>
          <span>{esRegistro ? 'Registrarme con Google' : 'Continuar con Google'}</span>
        </button>

        <div className={css.separador}>
          <span className={css.raya} />
          <span className={css.separadorTexto}>o con tu correo</span>
          <span className={css.raya} />
        </div>

        <form className={css.formulario} onSubmit={conCorreo}>
          {esRegistro && (
            <input
              required
              autoComplete="name"
              placeholder="Nombre y apellidos"
              aria-label="Nombre y apellidos"
              className={css.campo}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          )}

          <input
            required
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Correo"
            aria-label="Correo"
            className={css.campo}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
          <input
            required
            type="password"
            autoComplete={esRegistro ? 'new-password' : 'current-password'}
            placeholder="Contraseña"
            aria-label="Contraseña"
            className={css.campo}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />

          {esRegistro && (
            <label className={css.condiciones}>
              <input type="checkbox" required className={css.casilla} />
              <span>
                Acepto las{' '}
                <Link href="/legal/condiciones" className={css.enlaceFino}>
                  condiciones
                </Link>{' '}
                y la{' '}
                <Link href="/legal/privacidad" className={css.enlaceFino}>
                  política de privacidad
                </Link>
                .
              </span>
            </label>
          )}

          {error && (
            <p className={css.error} role="alert">
              {error}
            </p>
          )}
          {aviso && (
            <p className={css.aviso} role="status">
              {aviso}
            </p>
          )}

          <button type="submit" className={css.enviar} disabled={cargando}>
            {cargando ? 'Un momento…' : esRegistro ? 'Crear cuenta' : 'Entrar'}
          </button>

          {!esRegistro && (
            <button type="button" onClick={recuperar} className={css.olvido}>
              ¿Has olvidado la contraseña?
            </button>
          )}
        </form>
      </div>

      <p className={css.cambio}>
        {esRegistro ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}{' '}
        <button
          type="button"
          onClick={() => {
            setModo(esRegistro ? 'acceso' : 'registro');
            setError(null);
            setAviso(null);
          }}
          className={css.enlaceBoton}
        >
          {esRegistro ? 'Entrar' : 'Crear cuenta'}
        </button>
      </p>

      <p className={css.letraPequena}>
        Si entras con Google usamos solo tu nombre y tu correo. Tu acceso a la comunidad se activa
        cuando te certificas.
      </p>
    </Marco>
  );
}

/** El decorado: foto, logotipo y pie. Igual haya sesión o no. */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className={css.pantalla}>
      <div className={css.foto}>
        <Image
          src={consulta}
          alt="Sesión de trabajo corporal en consulta"
          priority
          placeholder="blur"
          sizes="(max-width: 860px) 100vw, 50vw"
          style={{ objectPosition: '50% 40%' }}
        />
      </div>

      <div className={css.panel}>
        <Link href="/" className={css.logo} aria-label="Sorela Caro · Técnica Divine, ir a la web">
          <Image src={logo} alt="Sorela Caro · Técnica Divine" sizes="200px" />
        </Link>

        {children}

        <div className={css.pie}>
          <Link href="/" className={css.volver}>
            ← Volver a la web
          </Link>
          <CambiarTema />
        </div>
      </div>
    </div>
  );
}
