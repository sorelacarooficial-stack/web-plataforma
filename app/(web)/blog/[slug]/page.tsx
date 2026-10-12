import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Cuerpo from '@/components/blog/Cuerpo';
import { articuloPublicado, articulosPublicados } from '@/lib/blog';
import retrato from '@/fotos/sorela-retrato.webp';
import css from '../blog.module.css';

/**
 * Un artículo del blog. Se genera la primera vez que alguien lo abre y se
 * guarda; se rehace cada cinco minutos o al instante cuando Sorela lo edita.
 */
export const revalidate = 300;

const SITIO = 'https://www.sorelacarodivine.com';
const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await articuloPublicado(slug);
  if (!a) return { title: 'Artículo no encontrado', robots: { index: false } };
  return {
    title: a.titulo,
    description: a.resumen,
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: {
      type: 'article',
      title: a.titulo,
      description: a.resumen,
      url: `/blog/${a.slug}`,
      publishedTime: a.publicado ?? undefined,
      modifiedTime: a.actualizado ?? undefined,
      authors: ['Sorela Caro'],
      ...(a.portada ? { images: [{ url: a.portada.url, alt: a.portada.alt }] } : {}),
    },
  };
}

export default async function PaginaArticulo({ params }: Props) {
  const { slug } = await params;
  const a = await articuloPublicado(slug);
  if (!a) notFound();
  const otros = (await articulosPublicados(8)).filter((x) => x.id !== a.id).slice(0, 3);

  /* Para que Google lo entienda como un artículo con autora y fecha. */
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.titulo,
    description: a.resumen,
    datePublished: a.publicado,
    dateModified: a.actualizado ?? a.publicado,
    author: { '@type': 'Person', name: 'Sorela Caro', url: `${SITIO}/sobre` },
    publisher: { '@type': 'Organization', name: 'Sorela Caro · Técnica Divine', url: SITIO },
    mainEntityOfPage: `${SITIO}/blog/${a.slug}`,
    ...(a.portada ? { image: a.portada.url } : {}),
  };

  return (
    <main className="pagina">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, '\\u003c') }} />
      <article>
        <header className={css.articuloCabecera}>
          <Link href="/blog" className={css.volver}>
            ← Blog
          </Link>
          {a.categoria && <p className="antetitulo">{a.categoria}</p>}
          <h1 className={css.articuloTitulo}>{a.titulo}</h1>
          {a.resumen && <p className={css.articuloResumen}>{a.resumen}</p>}
          <div className={css.autora}>
            <Image src={retrato} alt="Sorela Caro" width={44} height={44} className={css.autoraFoto} />
            <span>
              <b>Sorela Caro</b>
              <em>
                {a.publicado ? FECHA.format(new Date(a.publicado)) : ''} · {a.minutos} min de lectura
              </em>
            </span>
          </div>
        </header>

        {a.portada && (
          <div className={css.articuloPortada}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.portada.url} alt={a.portada.alt} />
          </div>
        )}

        <div className={css.articuloCuerpo}>
          <Cuerpo bloques={a.bloques} />
        </div>
      </article>

      <section className={css.llamada}>
        <p className="antetitulo">Técnica Divine</p>
        <h2 className={css.llamadaTitulo}>¿Quieres aprenderlo con tus manos?</h2>
        <p>Te enseño el método en dos etapas: primero online y después presencial, corrigiéndote las manos.</p>
        <Link href="/formaciones" className="btn btn-md">
          Ver la formación
        </Link>
      </section>

      {otros.length > 0 && (
        <section className={css.envoltura}>
          <h2 className={css.masTitulo}>Sigue leyendo</h2>
          <div className={css.rejilla}>
            {otros.map((o) => (
              <Link key={o.id} href={`/blog/${o.slug}`} className={css.tarjeta}>
                <span className={css.tarjetaFoto}>
                  {o.portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.portada.url} alt={o.portada.alt} loading="lazy" />
                  ) : (
                    <span className={css.sinFoto} />
                  )}
                </span>
                <span className={css.meta}>{o.minutos} min</span>
                <span className={css.tarjetaTitulo}>{o.titulo}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
