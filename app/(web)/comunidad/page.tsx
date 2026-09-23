import type { Metadata } from 'next';
import Link from 'next/link';
import Contador from '@/components/Contador';
import ListaEspera from '@/components/ListaEspera';
import { COMUNIDAD, OBJECIONES, PIEZAS_COMUNIDAD } from '@/lib/contenido';
import css from './comunidad.module.css';

export const metadata: Metadata = {
  title: 'Comunidad de Terapeutas Divine',
  description:
    'La Comunidad de Terapeutas Divine abre el 17 de octubre a las 16:00. Clase en vivo al mes, acompañamiento, canal privado y tu ficha en el mapa por 47 € al mes, precio de lanzamiento.',
};

export default function Comunidad() {
  return (
    <main className="pagina">
      <section className={css.portada}>
        <div className="wrap rejilla-290" style={{ alignItems: 'start' }}>
          <div className="columna" style={{ gap: 24, alignItems: 'flex-start' }}>
            <span className="distintivo">Abre el {COMUNIDAD.apertura}</span>
            {/* En primera persona, y titular distinto del que lleva el inicio:
                si las dos páginas encabezan igual, la segunda parece un error.
                Antes ponía «La membresía de Sorela», que habla de ella en
                tercera persona como si lo contara otro; aquí quien escribe es
                ella y quien lee es una terapeuta a la que conoce. */}
            <h1 className={css.titulo}>Estoy preparando algo especial para ti.</h1>
            <p className="lede max-540" style={{ lineHeight: 1.62 }}>
              El sitio donde sigo enseñando después del curso: una clase en vivo al mes con lo
              nuevo del método, tus casos mirados uno a uno, un canal privado donde preguntarme y
              tu ficha en el mapa.
            </p>
            <p className="texto max-540">
              Abro una sola vez, y quien entre en el lanzamiento se queda con el precio de
              fundadora.
            </p>
            <Contador />
          </div>

          <div className={css.caja}>
            <ListaEspera />
          </div>
        </div>
      </section>

      <section className={css.piezasSeccion}>
        <div className="wrap">
          <p className="antetitulo" style={{ marginBottom: 'clamp(30px,4vw,52px)' }}>
            Qué incluye cada mes
          </p>
          <div className={css.piezas}>
            {PIEZAS_COMUNIDAD.map((m) => (
              <article
                key={m.titulo}
                className={css.pieza}
                style={{ borderTop: `3px solid ${m.color}` }}
              >
                <span className={css.estado}>{m.estado}</span>
                <h3 className={css.piezaTitulo}>{m.titulo}</h3>
                <p className="texto-fijo" style={{ fontSize: 16 }}>
                  {m.texto}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={css.precio}>
        <div className="wrap wrap-900">
          <h2 className={css.precioTitulo}>
            {COMUNIDAD.precio} € {COMUNIDAD.periodo}, precio de lanzamiento.
          </h2>
          <p className={css.precioTexto}>
            Quien entra el 17 de octubre lo conserva mientras siga dentro, aunque después suba.
            Eso sí te lo puedo prometer.
          </p>
        </div>
      </section>

      <section className="seccion-sm superficie">
        <div className="wrap wrap-1000">
          <h2 className="titulo-sm" style={{ marginBottom: 'clamp(26px,3vw,44px)', fontSize: 'clamp(26px,3.4vw,42px)' }}>
            Preguntas de la lista
          </h2>
          <div className="columna">
            {OBJECIONES.map((o) => (
              <div key={o.q} className={css.objecion}>
                <p className={css.objecionP}>{o.q}</p>
                <p className={css.objecionR}>{o.a}</p>
              </div>
            ))}
          </div>
          <p className={css.pieLista}>
            ¿Aún no te has formado?{' '}
            <Link href="/formaciones" className="enlace-fino">
              Empieza por la formación
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
