'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CambiarTema from './CambiarTema';
import IconoGoogle from './IconoGoogle';
import logo from '@/fotos/logo-sorela.png';
import consulta from '@/fotos/acceso-consulta.webp';
import css from './Acceso.module.css';

type Modo = 'acceso' | 'registro';

/**
 * Pantalla de acceso a la plataforma: la de Sorela y la de sus alumnas y
 * terapeutas certificadas. Es la misma puerta para las tres; el rol se
 * resuelve al autenticar, no aquí.
 *
 * TODAVÍA NO AUTENTICA: es una maqueta para enseñar la plataforma. Cualquier
 * correo y contraseña entran, y el botón de Google también. No hay sesión, no
 * hay usuarios y no se comprueba nada. Cuando haya proveedor de identidad de
 * verdad (Google + correo), esta pantalla ya tiene la forma definitiva:
 * solo hay que sustituir `entrar` por la llamada real.
 */
export default function Acceso() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('acceso');
  const esRegistro = modo === 'registro';

  const entrar = () => router.push('/plataforma');

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

        <h1 className={css.titulo}>
          {esRegistro ? 'Crea tu cuenta' : 'Entra en tu espacio'}
        </h1>

        <div className={css.caja}>
          <button type="button" onClick={entrar} className={css.google}>
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

          <form
            className={css.formulario}
            onSubmit={(e) => {
              e.preventDefault();
              entrar();
            }}
          >
            {esRegistro && (
              <input
                required
                autoComplete="name"
                placeholder="Nombre y apellidos"
                aria-label="Nombre y apellidos"
                className={css.campo}
              />
            )}

            <input
              required
              type="email"
              autoComplete="email"
              placeholder="Correo"
              aria-label="Correo"
              className={css.campo}
            />
            <input
              required
              type="password"
              autoComplete={esRegistro ? 'new-password' : 'current-password'}
              placeholder="Contraseña"
              aria-label="Contraseña"
              className={css.campo}
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

            <button type="submit" className={css.enviar}>
              {esRegistro ? 'Crear cuenta' : 'Entrar'}
            </button>

            {!esRegistro && (
              <button type="button" onClick={entrar} className={css.olvido}>
                ¿Has olvidado la contraseña?
              </button>
            )}
          </form>
        </div>

        <p className={css.cambio}>
          {esRegistro ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}{' '}
          <button
            type="button"
            onClick={() => setModo(esRegistro ? 'acceso' : 'registro')}
            className={css.enlaceBoton}
          >
            {esRegistro ? 'Entrar' : 'Crear cuenta'}
          </button>
        </p>

        <p className={css.letraPequena}>
          Si entras con Google usamos solo tu nombre y tu correo. Tu acceso a la comunidad se
          activa cuando te certificas.
        </p>

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
