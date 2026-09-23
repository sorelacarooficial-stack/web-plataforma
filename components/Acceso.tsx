'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth';
import CambiarTema from './CambiarTema';
import { auth, hayAuth } from '@/lib/firebase-navegador';
import logo from '@/fotos/logo-sorela.png';
import consulta from '@/fotos/acceso-consulta.webp';
import css from './Acceso.module.css';

/**
 * Puerta de la plataforma.
 *
 * Es una puerta CERRADA: aquí no se crean cuentas. Las da de alta Sorela, una
 * a una, cuando alguien se matricula o se certifica. Antes esta pantalla tenía
 * un botón de Google y un formulario de registro abierto, y eso significaba
 * que cualquiera que llegase por el buscador podía darse de alta en la
 * plataforma privada de un negocio que todavía no ha abierto.
 *
 * Importante para quien mantenga esto: quitar el registro de aquí NO lo cierra
 * del todo. La clave del navegador es pública por diseño y con ella se puede
 * llamar a Firebase desde fuera. El cierre de verdad está en la consola:
 * Authentication → Settings → User actions → impedir la creación de cuentas.
 * Esta pantalla y esa casilla van juntas; una sin la otra no basta.
 *
 * El acceso tiene dos pasos y conviene entenderlo: Firebase devuelve al
 * navegador un token que solo vive en la memoria de la pestaña, y con eso el
 * servidor no puede proteger nada. Por eso en cuanto hay token se manda a
 * /api/sesion, que lo cambia por una cookie firmada. Hasta que esa cookie no
 * existe, no se navega a la plataforma.
 */
export default function Acceso() {
  return (
    // useSearchParams obliga a envolver en Suspense para que el resto de la
    // página se siga generando de forma estática.
    <Suspense fallback={<Marco>{null}</Marco>}>
      <Formulario />
    </Suspense>
  );
}

/** Traduce los códigos de Firebase, que son ilegibles para quien los recibe. */
function mensaje(codigo: string): string {
  const mapa: Record<string, string> = {
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/invalid-email': 'Ese correo no parece correcto.',
    'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
    'auth/wrong-password': 'El correo o la contraseña no son correctos.',
    'auth/user-disabled': 'Esa cuenta está desactivada.',
    'auth/too-many-requests': 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
    'auth/network-request-failed': 'No hay conexión. Revisa la red y vuelve a intentarlo.',
    'auth/operation-not-allowed': 'El acceso con correo no está activado en Firebase.',
    // Este sale cuando el dominio desde el que se entra no está en la lista de
    // dominios autorizados de Firebase. Sin un mensaje propio caía en el
    // genérico —«vuelve a intentarlo»— y quien lo viera volvería a intentarlo
    // cien veces, porque reintentar no lo arregla nunca.
    'auth/unauthorized-domain':
      'Este dominio no está autorizado en Firebase. Hay que añadirlo en Authentication → Settings → Authorized domains.',
    'auth/invalid-api-key': 'La clave de Firebase del navegador no es válida.',
  };
  return mapa[codigo] || 'No he podido entrar. Vuelve a intentarlo en un momento.';
}

function Formulario() {
  const router = useRouter();
  const parametros = useSearchParams();
  const volver = parametros.get('volver') || '/plataforma';

  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

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
      // Los tres casos se resuelven de forma distinta, así que se cuentan de
      // forma distinta. Decir «vuelve a intentarlo» cuando el fallo está en la
      // configuración del servidor es mandar a alguien a dar vueltas.
      throw new Error(
        cuerpo.motivo === 'sin-configurar'
          ? 'El servidor todavía no tiene Firebase configurado.'
          : cuerpo.motivo === 'cerrada'
            ? 'Tu cuenta es correcta, pero la plataforma todavía no está abierta. Te aviso en cuanto lo esté.'
            : cuerpo.motivo === 'servidor'
              ? 'Tu contraseña es correcta, pero el servidor no ha podido abrir la sesión. Es un problema de configuración, no tuyo.'
              : 'No he podido abrir la sesión. Vuelve a intentarlo.'
      );
    }
    router.push(volver);
    // Sin refresh, Next puede servir la plataforma desde su caché de cliente,
    // que se guardó cuando no había sesión.
    router.refresh();
  }

  async function conCorreo(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      await abrirSesion(await signInWithEmailAndPassword(auth(), correo.trim(), clave));
    } catch (e) {
      setError(traducir(e));
      setCargando(false);
    }
  }

  async function recuperar() {
    setError(null);
    setAviso(null);
    if (!correo.trim()) {
      setError('Escribe tu correo y te mando el enlace para cambiarla.');
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
      <h1 className={css.titulo}>Entra en tu espacio</h1>

      <div className={css.caja}>
        <form className={css.formulario} onSubmit={conCorreo}>
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
            autoComplete="current-password"
            placeholder="Contraseña"
            aria-label="Contraseña"
            className={css.campo}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />

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
            {cargando ? 'Un momento…' : 'Entrar'}
          </button>

          <button type="button" onClick={recuperar} className={css.olvido}>
            ¿Has olvidado la contraseña?
          </button>
        </form>
      </div>

      {/* Quien llegue aquí sin cuenta tiene que salir con algo, no con una
          puerta cerrada y nada más. */}
      <p className={css.letraPequena}>
        Este acceso es para alumnas y terapeutas certificadas. Las cuentas las doy yo cuando te
        matriculas.{' '}
        <Link href="/formaciones" className={css.enlaceFino}>
          Ver las formaciones
        </Link>
        .
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
