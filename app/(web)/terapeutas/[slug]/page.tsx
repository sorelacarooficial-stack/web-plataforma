import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Reserva from '@/components/Reserva';
import { TERAPEUTAS, getTerapeuta, nombreCorto } from '@/lib/terapeutas';
import sesion from '@/fotos/sesion-terapeuta.webp';
import css from './terapeuta.module.css';

export function generateStaticParams() {
  return TERAPEUTAS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = getTerapeuta(slug);
  if (!t) return { title: 'Terapeuta no encontrada' };
  return {
    title: `${t.nombre} · ${t.ciudad}`,
    description: t.sobre,
    openGraph: { title: `${t.nombre}, terapeuta Divine en ${t.ciudad}`, description: t.sobre },
  };
}

export default async function FichaTerapeuta({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = getTerapeuta(slug);
  if (!t) notFound();

  return (
    <main className="pagina">
      <section className={css.cabecera}>
        <div className={css.foto}>
          <Image
            src={sesion}
            alt={`Sesión en la consulta de ${t.nombre}`}
            sizes="(max-width: 860px) 100vw, 50vw"
            placeholder="blur"
            style={{ objectPosition: '50% 40%' }}
          />
        </div>

        <div className={`${css.intro} sangrado-izq`}>
          <Link href="/terapeutas" className="volver">
            ← Volver al mapa
          </Link>
          <h1 className={css.nombre}>{t.nombre}</h1>
          <p className={css.rotulo}>Terapeuta Divine certificada · {t.ciudad}</p>
          <p className="texto max-440" style={{ lineHeight: 1.62 }}>
            {t.sobre}
          </p>
          <a href="#reservar" className="btn btn-md" style={{ marginTop: 6 }}>
            Reservar cita
          </a>
        </div>
      </section>

      <section className="seccion-xs">
        <div className={`wrap ${css.fichas}`}>
          <div className={css.ficha} style={{ borderTop: '2px solid var(--arcilla)' }}>
            <h2 className={css.fichaTitulo} style={{ color: 'var(--arcilla)' }}>
              Qué trabajo
            </h2>
            <ul className={css.tratamientos}>
              {t.tratamientos.map((tr) => (
                <li key={tr}>{tr}</li>
              ))}
            </ul>
          </div>

          <div className={css.ficha} style={{ borderTop: '2px solid var(--salvia)' }}>
            <h2 className={css.fichaTitulo} style={{ color: 'var(--salvia)' }}>
              Dónde estoy
            </h2>
            <p className={css.fichaTexto}>{t.direccion}</p>
            <Link href="/terapeutas" className="enlace-fino" style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 300 }}>
              Verlo en el mapa
            </Link>
          </div>

          <div className={css.ficha} style={{ borderTop: '2px solid var(--azul)' }}>
            <h2 className={css.fichaTitulo} style={{ color: 'var(--azul)' }}>
              Certificación
            </h2>
            <p className={css.fichaTexto}>
              Formada conmigo en la Técnica Divine, en {t.anio}.
            </p>
          </div>
        </div>
      </section>

      <section id="reservar" className={css.reserva}>
        <div className="wrap wrap-1000">
          <h2 className="titulo-md" style={{ marginBottom: 10 }}>
            Reservar con {nombreCorto(t)}
          </h2>
          <p className={css.reservaLede}>
            Elige día y hora. Te lo confirma ella por correo, no un robot.
          </p>
          <Reserva ciudad={t.ciudad} />
        </div>
      </section>
    </main>
  );
}
