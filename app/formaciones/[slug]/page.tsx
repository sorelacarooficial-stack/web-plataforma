import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CURSOS,
  cancelacionTexto,
  comoEs,
  getCurso,
  metaLarga,
  mostrarPlazas,
  plazasTexto,
  reservaTexto,
} from '@/lib/cursos';
import { FAQS_CURSO } from '@/lib/contenido';
import pierna from '@/fotos/formacion-pierna.webp';
import css from './curso.module.css';

export function generateStaticParams() {
  return CURSOS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const curso = getCurso(slug);
  if (!curso) return { title: 'Formación no encontrada' };
  return {
    title: curso.nombre,
    description: curso.promesa,
    openGraph: { title: curso.nombre, description: curso.promesa },
  };
}

export default async function FichaCurso({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const curso = getCurso(slug);
  if (!curso) notFound();

  return (
    <main className="pagina">
      <section className={css.portada}>
        <div className="wrap">
          <Link href="/formaciones" className={`volver ${css.volver}`}>
            ← Todas las formaciones
          </Link>

          <div className={css.cabeza}>
            <div className="columna" style={{ gap: 22 }}>
              <h1 className={css.titulo}>{curso.nombre}</h1>
              <p className="lede max-520">{curso.promesa}</p>
              <p className={css.meta}>{metaLarga(curso)}</p>
            </div>

            <div className="columna" style={{ gap: 14, alignItems: 'flex-start' }}>
              <Link href="/contacto" className="btn">
                Reservar plaza
              </Link>
              {mostrarPlazas(curso) && (
                <span className={css.plazas}>{plazasTexto(curso)}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="seccion-sm">
        <div className="wrap rejilla-290" style={{ alignItems: 'start' }}>
          <h2 className="titulo-md">El domingo sales sabiendo:</h2>
          <ul className={css.capacidades}>
            {curso.capacidades.map((cap) => (
              <li key={cap} className={css.capacidad}>
                <span className={css.bolita} />
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={css.comoSon}>
        <div className="wrap rejilla">
          <div className="columna" style={{ gap: 20 }}>
            <p className="antetitulo" style={{ color: 'var(--salvia-ink)' }}>
              Cómo son los tres días
            </p>
            <h2 className="titulo-md">Ocho alumnas. Cuerpo real desde la primera hora.</h2>
            <p className="texto max-480" style={{ color: 'var(--salvia-ink)' }}>
              {comoEs(curso)}
            </p>
          </div>
          <div className="foto foto-11">
            <Image
              src={pierna}
              alt="Trabajo manual sobre pierna durante la formación"
              sizes="(max-width: 860px) 100vw, 45vw"
              placeholder="blur"
              style={{ objectPosition: '50% 45%' }}
            />
          </div>
        </div>
      </section>

      <section className="seccion-sm">
        <div className={`wrap ${css.detalles}`}>
          <div className="columna" style={{ gap: 22 }}>
            <h2 className="titulo-xs">Qué incluye</h2>
            <ul className={css.incluye}>
              {curso.incluye.map((inc) => (
                <li key={inc} className={css.incluyeItem}>
                  <span className={css.guion}>—</span>
                  <span>{inc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="columna" style={{ gap: 22 }}>
            <h2 className="titulo-xs">Qué traes tú</h2>
            <p className="texto-fijo">
              Manos con kilómetros y clientas de verdad. No pido titulación concreta: pido que
              sepas lo que es una cabina a las siete de la tarde.
            </p>
          </div>

          <div className={css.precio}>
            <p className={css.precioCifra}>{curso.precio} €</p>
            <p className={css.precioTexto}>{reservaTexto(curso)}</p>
            <p className={css.precioNota}>{cancelacionTexto(curso)}</p>
            <Link href="/contacto" className="btn btn-md btn-claro" style={{ marginTop: 6 }}>
              Reservar plaza
            </Link>
          </div>
        </div>
      </section>

      <section className="seccion-sm superficie borde-arriba">
        <div className="wrap wrap-1000">
          <h2 className="titulo-sm" style={{ marginBottom: 'clamp(26px,3vw,40px)' }}>
            Antes de reservar
          </h2>
          <div className="columna">
            {FAQS_CURSO.map((f) => (
              <div key={f.q} className={css.faq}>
                <p className={css.faqP}>{f.q}</p>
                <p className={css.faqR}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
