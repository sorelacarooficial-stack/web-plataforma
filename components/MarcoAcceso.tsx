'use client';

import Image from 'next/image';
import Link from 'next/link';
import CambiarTema from './CambiarTema';
import logo from '@/fotos/logo-sorela.png';
import consulta from '@/fotos/acceso-consulta.webp';
import css from './Acceso.module.css';

/**
 * El decorado de las dos pantallas de la puerta: entrar y registrarse.
 *
 * Vivía dentro de `Acceso.tsx` y ha salido aquí al nacer el registro. No es
 * por ahorrar líneas: es que las dos pantallas son la misma puerta vista desde
 * dos lados, y si el marco estuviera dos veces, un día tendrían la foto
 * distinta o el logotipo en otro sitio y parecerían dos sitios diferentes.
 *
 * Comparten también la hoja de estilos, `Acceso.module.css`, por lo mismo.
 */
export default function MarcoAcceso({ children }: { children: React.ReactNode }) {
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
