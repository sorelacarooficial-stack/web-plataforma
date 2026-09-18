import type { Metadata } from 'next';
import Link from 'next/link';
import AvisarCiudad from '@/components/AvisarCiudad';
import { CURSOS, meta, mostrarPlazas, plazasTexto } from '@/lib/cursos';
import css from './formaciones.module.css';

export const metadata: Metadata = {
  title: 'Formaciones',
  description:
    'Tres formaciones al año, ocho alumnas por grupo y cuerpo real desde la primera hora. Madrid, Valencia y Sevilla.',
};

export default function Formaciones() {
  return (
    <main className="pagina">
      <section className={css.portada}>
        <div className="wrap">
          <h1 className="titulo-xl" style={{ marginBottom: 24 }}>
            Formaciones
          </h1>
          <p className="lede">
            Tres al año, ocho alumnas por grupo y cuerpo real desde la primera hora. Cuando se
            llenan, se llenan.
          </p>
        </div>
      </section>

      <section className={css.listado}>
        <div className="wrap columna">
          {CURSOS.map((c) => (
            <article key={c.slug} className={css.curso}>
              <div className="columna" style={{ gap: 14 }}>
                <h2 className={css.cursoNombre}>{c.nombre}</h2>
                <p className={css.cursoMeta}>{meta(c)}</p>
              </div>

              <div className="columna" style={{ gap: 22, alignItems: 'flex-start' }}>
                <p className="texto max-440" style={{ lineHeight: 1.62 }}>
                  {c.frase}
                </p>
                <div className={css.acciones}>
                  {mostrarPlazas(c) && (
                    <span className={css.plazas}>{plazasTexto(c)}</span>
                  )}
                  <Link href={`/formaciones/${c.slug}`} className="btn btn-sm">
                    Ver detalle
                  </Link>
                </div>
              </div>
            </article>
          ))}

          <div className={css.avisame}>
            <h2 className={css.avisameTitulo}>¿Tu ciudad no está?</h2>
            <div className="columna" style={{ gap: 20, alignItems: 'flex-start' }}>
              <p className="texto-fijo max-440">
                Dime dónde estás y te aviso en cuanto abra convocatoria cerca. Si se juntan seis
                en una misma zona, la abro yo.
              </p>
              <AvisarCiudad />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
