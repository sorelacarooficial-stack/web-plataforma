import Link from 'next/link';
import { INSTAGRAM, INSTAGRAM_USUARIO } from '@/lib/contenido';
import { PLATAFORMA_URL } from '@/lib/enlaces';
import css from './PieDePagina.module.css';

const COLUMNAS = [
  {
    titulo: 'Formación',
    enlaces: [
      { href: '/metodo', texto: 'Método' },
      { href: '/formaciones', texto: 'Formaciones' },
      { href: '/comunidad', texto: 'Comunidad Divine' },
    ],
  },
  {
    titulo: 'Clientas',
    enlaces: [{ href: '/terapeutas', texto: 'Localiza tu terapeuta' }],
  },
  {
    titulo: 'Divine',
    enlaces: [
      { href: '/sobre', texto: 'Sobre Sorela' },
      { href: '/contacto', texto: 'Contacto' },
      { href: PLATAFORMA_URL, texto: 'Entrar en la plataforma' },
    ],
  },
  {
    titulo: 'Legal',
    enlaces: [
      { href: '/legal/aviso-legal', texto: 'Aviso legal' },
      { href: '/legal/privacidad', texto: 'Privacidad' },
      { href: '/legal/cookies', texto: 'Cookies' },
      { href: '/legal/condiciones', texto: 'Condiciones de contratación' },
    ],
  },
];

export default function PieDePagina() {
  return (
    <footer className={css.pie}>
      <div className="wrap">
        <div className={css.rejilla}>
          <div className={css.marca}>
            <p className={css.nombre}>
              Técnica Divine
              <br />
              <span className={css.firma}>Sorela Caro</span>
            </p>
            <a href={INSTAGRAM} className={css.enlace} rel="me noopener" target="_blank">
              Instagram {INSTAGRAM_USUARIO}
            </a>
          </div>

          {COLUMNAS.map((col) => (
            <div key={col.titulo} className={css.columna}>
              <p className={css.titulo}>{col.titulo}</p>
              {col.enlaces.map((e) => (
                <Link key={e.href} href={e.href} className={css.enlace}>
                  {e.texto}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <p className={css.copyright}>
          © {new Date().getFullYear()} Sorela Caro. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
