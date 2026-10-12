import type { Metadata } from 'next';
import Link from 'next/link';
import Contador from '@/components/Contador';
import ListaEspera from '@/components/ListaEspera';
import { COMUNIDAD, OBJECIONES, PIEZAS_MASTERCLASS } from '@/lib/contenido';
import { DIA_APERTURA } from '@/lib/apertura';
import css from './comunidad.module.css';

/**
 * Se usa «Comunidad Divine», que es como la nombran el pie de página, el
 * asistente y el contador; «Comunidad de Terapeutas Divine» solo aparece
 * dentro de la plataforma. El título aclara para quién es —terapeutas ya
 * certificadas— para que no se cuele quien todavía busca formarse.
 *
 * La descripción ya no lleva la fecha de apertura ni el precio: la fecha
 * caduca el día del lanzamiento y en Google tarda semanas en refrescarse, así
 * que quedaría anunciando algo que ya pasó. Ambos están en la página, que sí
 * se actualiza sola.
 */
export const metadata: Metadata = {
  title: { absolute: 'La Comunidad Divine para terapeutas ya certificadas' },
  // Sin lo que incluye: se presenta en la masterclass de la apertura (lib/contenido.ts).
  description:
    'Donde sigo enseñando cuando acaba el curso. La presento en una masterclass en directo por Zoom: apúntate a la lista de espera y te mando el enlace.',
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
            <h1 className={`${css.titulo} degradado`}>Estoy preparando algo especial para ti.</h1>
            <p className="lede max-540" style={{ lineHeight: 1.62 }}>
              El sitio donde sigo enseñando después del curso. Lo que hay dentro te lo cuento el{' '}
              {DIA_APERTURA} en una masterclass en directo por Zoom.
            </p>
            <p className="texto max-540">
              Apúntate a la lista de espera y te mando el enlace.
            </p>
            <Contador />
          </div>

          <div className={`${css.caja} caja-landing`}>
            <ListaEspera />
          </div>
        </div>
      </section>

      <section className={`${css.piezasSeccion} panel-blanco`}>
        <div className="wrap">
          <p className="antetitulo" style={{ marginBottom: 'clamp(30px,4vw,52px)' }}>
            La masterclass de la apertura
          </p>
          <div className={css.piezas}>
            {PIEZAS_MASTERCLASS.map((m) => (
              <article key={m.titulo} className={`tarjeta ${css.pieza}`}>
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

      {/* Aquí iba el precio. Se retira: hasta que abra, solo se habla de la
          lista de espera, y el precio se anuncia con la apertura. */}

      <section className="seccion-sm">
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
