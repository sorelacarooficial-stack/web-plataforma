import type { Metadata } from 'next';
import Link from 'next/link';
import ListaEspera from '@/components/ListaEspera';
import { EN_LISTA, OBJECIONES, PIEZAS_COMUNIDAD } from '@/lib/contenido';
import css from './comunidad.module.css';

export const metadata: Metadata = {
  title: 'Comunidad de Terapeutas Divine',
  description:
    'La Comunidad Divine todavía no existe: la estoy montando. Quien esté en la lista entra primero y ayuda a decidir qué lleva dentro. Gratis y sin compromiso.',
};

export default function Comunidad() {
  return (
    <main className="pagina">
      <section className={css.portada}>
        <div className="wrap rejilla-290" style={{ alignItems: 'start' }}>
          <div className="columna" style={{ gap: 24, alignItems: 'flex-start' }}>
            <span className="distintivo">Lista de espera abierta</span>
            <h1 className={css.titulo}>La Comunidad Divine todavía no existe.</h1>
            <p className="lede max-540" style={{ lineHeight: 1.62 }}>
              Prefiero decírtelo así: la estoy montando. No quiero abrir una comunidad a medias
              para cobrarte desde el primer mes. Cuando esté, entrarán primero las que estén en
              esta lista.
            </p>
            <p className={css.contador}>
              <span data-count={String(EN_LISTA)}>{EN_LISTA}</span> terapeutas están ya en la lista.
            </p>
          </div>

          <div className={css.caja}>
            <ListaEspera />
          </div>
        </div>
      </section>

      <section className={css.piezasSeccion}>
        <div className="wrap">
          <p className="antetitulo" style={{ marginBottom: 'clamp(30px,4vw,52px)' }}>
            Lo que quiero que tenga
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
            Todavía no hay precio. Cuando lo haya, lo sabrás tú antes que nadie.
          </h2>
          <p className={css.precioTexto}>
            Las primeras de la lista entran con condición de fundadora y la mantienen mientras
            sigan dentro. Eso sí te lo puedo prometer.
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
