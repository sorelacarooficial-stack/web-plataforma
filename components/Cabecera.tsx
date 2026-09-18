import Image from 'next/image';
import Link from 'next/link';
import logo from '@/fotos/logo-sorela.png';
import CambiarTema from './CambiarTema';
import MenuMovil from './MenuMovil';
import { PLATAFORMA_URL } from '@/lib/enlaces';
import css from './Cabecera.module.css';

const NAV = [
  { href: '/metodo', texto: 'Método' },
  { href: '/formaciones', texto: 'Formaciones' },
  { href: '/comunidad', texto: 'Comunidad' },
  { href: '/terapeutas', texto: 'Terapeutas' },
  { href: '/sobre', texto: 'Sobre' },
];

export default function Cabecera() {
  return (
    <header className={css.cabecera}>
      <div className={css.fila}>
        <Link href="/" className={css.logo} aria-label="Sorela Caro · Técnica Divine, ir al inicio">
          <Image src={logo} alt="Sorela Caro · Técnica Divine" priority sizes="200px" />
        </Link>

        {/* A partir de 900 px: navegación completa. Por debajo la sustituye
            el menú hamburguesa, que se encarga de sus propios enlaces. */}
        <nav className={css.nav} aria-label="Principal">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={css.enlace}>
              {n.texto}
            </Link>
          ))}
        </nav>

        <div className={css.acciones}>
          <CambiarTema />
          <Link href={PLATAFORMA_URL} className={css.entrar}>
            Entrar
          </Link>
          <MenuMovil enlaces={NAV} plataformaUrl={PLATAFORMA_URL} />
        </div>
      </div>

      {/* Barra de progreso de lectura; la mueve EfectosScroll. */}
      <span id="progreso-lectura" aria-hidden="true" className={css.progreso} />
    </header>
  );
}
