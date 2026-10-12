import type { Metadata } from 'next';
import Link from 'next/link';
import { articulosPublicados } from '@/lib/blog';
import css from './blog.module.css';

/**
 * El blog: lo que Sorela escribe desde el panel.
 *
 * Se regenera solo cada cinco minutos y, además, al instante cada vez que
 * ella publica o edita algo (ver app/api/blog).
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Blog: drenaje linfático y Técnica Divine',
  description:
    'Artículos de Sorela Caro sobre drenaje linfático, la Técnica Divine, casos reales y el día a día de la cabina.',
};

const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const fecha = (iso: string | null) => (iso ? FECHA.format(new Date(iso)) : '');

export default async function Blog() {
  const articulos = await articulosPublicados();
  const [destacado, ...resto] = articulos;

  return (
    <main className="pagina">
      <section className={css.cabecera}>
        <p className="antetitulo">Blog</p>
        <h1 className={`${css.titulo} degradado`}>Lo que aprendo en cabina</h1>
        <p className={css.entradilla}>
          Drenaje linfático, la Técnica Divine y lo que me enseña cada clienta, contado sin rodeos.
        </p>
      </section>

      {!destacado ? (
        <section className={css.vacio}>
          <p>Muy pronto, el primer artículo.</p>
        </section>
      ) : (
        <>
          <section className={css.envoltura}>
            <Link href={`/blog/${destacado.slug}`} className={css.destacado}>
              <span className={css.destacadoFoto}>
                {destacado.portada ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={destacado.portada.url} alt={destacado.portada.alt} />
                ) : (
                  <span className={css.sinFoto} />
                )}
              </span>
              <span className={css.destacadoTexto}>
                <span className={css.meta}>
                  {destacado.categoria && <b>{destacado.categoria}</b>}
                  {fecha(destacado.publicado)} · {destacado.minutos} min de lectura
                </span>
                <span className={css.destacadoTitulo}>{destacado.titulo}</span>
                <span className={css.resumen}>{destacado.resumen}</span>
                <span className={css.leer}>Leer el artículo →</span>
              </span>
            </Link>
          </section>

          {resto.length > 0 && (
            <section className={css.envoltura}>
              <div className={css.rejilla}>
                {resto.map((a) => (
                  <Link key={a.id} href={`/blog/${a.slug}`} className={css.tarjeta}>
                    <span className={css.tarjetaFoto}>
                      {a.portada ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.portada.url} alt={a.portada.alt} loading="lazy" />
                      ) : (
                        <span className={css.sinFoto} />
                      )}
                    </span>
                    <span className={css.meta}>
                      {a.categoria && <b>{a.categoria}</b>}
                      {a.minutos} min
                    </span>
                    <span className={css.tarjetaTitulo}>{a.titulo}</span>
                    <span className={css.resumen}>{a.resumen}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
