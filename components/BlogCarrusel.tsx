'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import css from './BlogCarrusel.module.css';

/**
 * El blog en la portada: un carrusel de artículos.
 *
 * Se desliza con el dedo en el móvil (scroll-snap, nada de librerías) y con
 * las flechas en el ordenador. La última tarjeta siempre lleva al blog
 * entero, para que con uno o dos artículos no se vea un carrusel cojo.
 */

export type ArticuloCarrusel = {
  slug: string;
  titulo: string;
  resumen: string;
  categoria: string;
  portada: string | null;
  minutos: number;
};

export default function BlogCarrusel({ articulos }: { articulos: ArticuloCarrusel[] }) {
  const pista = useRef<HTMLDivElement>(null);
  const [puede, setPuede] = useState({ atras: false, adelante: true });

  const medir = useCallback(() => {
    const p = pista.current;
    if (!p) return;
    setPuede({ atras: p.scrollLeft > 8, adelante: p.scrollLeft + p.clientWidth < p.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    medir();
    const p = pista.current;
    p?.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      p?.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  }, [medir]);

  const mover = (dir: 1 | -1) => {
    const p = pista.current;
    if (!p) return;
    const tarjeta = p.querySelector<HTMLElement>('[data-tarjeta]');
    const paso = (tarjeta?.offsetWidth ?? 360) + 20;
    p.scrollBy({ left: dir * paso, behavior: 'smooth' });
  };

  return (
    <div className={css.carrusel}>
      <div className={css.cabecera}>
        <div>
          <p className="antetitulo">Blog</p>
          <h2 className={`titulo-lg ${css.titulo}`}>Lo que aprendo en cabina.</h2>
        </div>
        <div className={css.flechas}>
          <button type="button" onClick={() => mover(-1)} disabled={!puede.atras} aria-label="Artículos anteriores">
            ‹
          </button>
          <button type="button" onClick={() => mover(1)} disabled={!puede.adelante} aria-label="Más artículos">
            ›
          </button>
        </div>
      </div>

      <div className={css.pista} ref={pista}>
        {articulos.map((a) => (
          <Link key={a.slug} href={`/blog/${a.slug}`} className={css.tarjeta} data-tarjeta>
            <span className={css.foto}>
              {a.portada ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.portada} alt="" loading="lazy" />
              ) : (
                <span className={css.sinFoto} />
              )}
            </span>
            <span className={css.velo} />
            <span className={css.texto}>
              <span className={css.meta}>
                {a.categoria && <b>{a.categoria}</b>}
                {a.minutos} min de lectura
              </span>
              <span className={css.tarjetaTitulo}>{a.titulo}</span>
              <span className={css.resumen}>{a.resumen}</span>
              <span className={css.leer}>Leer →</span>
            </span>
          </Link>
        ))}
        <Link href="/blog" className={`${css.tarjeta} ${css.final}`} data-tarjeta>
          <span className={css.finalTexto}>
            <span className={css.finalTitulo}>Todo el blog</span>
            <span>Drenaje linfático, la Técnica Divine y lo que me enseña cada clienta.</span>
            <span className={css.leer}>Ir al blog →</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
