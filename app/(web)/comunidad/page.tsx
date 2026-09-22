import type { Metadata } from 'next';
import Link from 'next/link';
import Contador from '@/components/Contador';
import ListaEspera from '@/components/ListaEspera';
import { COMUNIDAD, OBJECIONES, PIEZAS_COMUNIDAD } from '@/lib/contenido';
import css from './comunidad.module.css';

export const metadata: Metadata = {
  title: 'Comunidad de Terapeutas Divine',
  description:
    'La Comunidad Divine abre el 17 de octubre a las 16:00. Clase mensual, acompañamiento, canal privado y agenda inteligente por 47 € al mes, con precio fundador para las primeras.',
};

export default function Comunidad() {
  return (
    <main className="pagina">
      <section className={css.portada}>
        <div className="wrap rejilla-290" style={{ alignItems: 'start' }}>
          <div className="columna" style={{ gap: 24, alignItems: 'flex-start' }}>
            <span className="distintivo">Abre el {COMUNIDAD.apertura}</span>
            {/* Titular distinto del que lleva el inicio a propósito: si las dos
                páginas encabezan con la misma frase, la segunda parece un error. */}
            <h1 className={css.titulo}>Lo que viene después de certificarte.</h1>
            <p className="lede max-540" style={{ lineHeight: 1.62 }}>
              Una clase en vivo al mes, tus casos mirados uno a uno, un canal privado donde
              preguntar y la agenda inteligente para no vivir pegada al móvil. Y tu ficha en el
              mapa, donde las clientas buscan.
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
            Lo que hay dentro
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
            {COMUNIDAD.precio} € {COMUNIDAD.periodo}, con precio fundador para las primeras.
          </h2>
          <p className={css.precioTexto}>
            Quien entra ahora conserva ese precio mientras siga dentro, aunque más adelante suba.
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
