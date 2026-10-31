import type { Metadata } from 'next';
import VideoInvitacion from '@/components/VideoInvitacion';
import Contador from '@/components/Contador';
import ListaEspera from '@/components/ListaEspera';
import { OBJECIONES, PIEZAS_MASTERCLASS } from '@/lib/contenido';
import { DIA_APERTURA, HORA_ESPANA } from '@/lib/apertura';
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
  /* Lo mismo que dicen los anuncios de Meta («Antes de tocar»): quien hace
     clic tiene que reconocer en la página lo que acaba de ver. */
  title: { absolute: 'Antes de tocar · Masterclass gratuita para terapeutas y esteticistas' },
  description:
    'Masterclass gratuita en directo con Sorela Caro: qué observar, qué interpretar y cómo decidir antes de tocar. Una hora por Zoom. Apúntate y te mando el enlace.',
};

/**
 * Las horas por país van separadas por « · », y en el móvil la línea podía
 * partir justo antes del punto y dejarlo colgado al principio de la
 * siguiente («· 14:00 en Venezuela»). Con un espacio duro delante, el punto
 * se queda siempre al final de su línea. El texto que se ve es el mismo.
 */
const sinPuntoSuelto = (texto: string) => texto.replaceAll(' · ', '\u00a0· ');

export default function Comunidad() {
  return (
    <main className="pagina">
      {/* La portada es la banda negra de «Membresía Divine» del inicio, la que
          gusta: antes era papel crema con todo en relieve crema sobre crema, y
          en el móvil la fecha, la cuenta atrás y el formulario se fundían con
          el fondo. Sobre el negro, el titular, la cuenta atrás y la tarjeta del
          formulario se leen a la primera. */}
      <section className={css.portada}>
        <div className={`wrap ${css.portadaRejilla}`}>
          <div className={css.portadaTexto}>
            {/* La misma frase de siempre («Abre el viernes 6 de noviembre, 19:00
                (hora de España)»), partida en dos trozos que no se cortan por
                dentro: en el móvil no cabe en una línea, y si el navegador
                elige dónde partir deja «19:00 (HORA DE» arriba y «ESPAÑA)»
                sola abajo. Así parte siempre por la coma. */}
            <p className={css.fecha}>
              <span>Masterclass gratuita · {DIA_APERTURA},</span> <span>{HORA_ESPANA} (hora de España)</span>
            </p>
            {/* En primera persona, y titular distinto del que lleva el inicio:
                si las dos páginas encabezan igual, la segunda parece un error.
                Antes ponía «La membresía de Sorela», que habla de ella en
                tercera persona como si lo contara otro; aquí quien escribe es
                ella y quien lee es una terapeuta a la que conoce. */}
            <h1 className={`${css.titulo} degradado-claro`}>
              Antes de <strong>tocar</strong>.
            </h1>
            {/* Es una lista de espera y nada más: se dice así, sin describir la
                comunidad. Lo de dentro se cuenta el día de la masterclass. */}
            <p className={css.lede}>
              La nueva era de las manos: una hora en directo, gratis, para terapeutas y esteticistas.
              Te enseño qué observar antes de empezar, cómo interpretar lo que ves y cómo decidir qué
              necesita cada cuerpo. Apúntate y te mando el enlace de Zoom.
            </p>
            <VideoInvitacion />
            <Contador sobre="oscuro" />
          </div>

          {/* Sin .caja-landing: esa clase le pone el relieve neumórfico, cuya
              luz blanca sobre el negro se ve como un halo. */}
          <div className={css.caja}>
            <ListaEspera />
          </div>
        </div>
      </section>

      {/* Papel que sube y tapa el borde de la banda negra, como en el inicio y
          en «Sobre mí». Antes esta sección era la oscura; con la portada ya en
          negro, quedaban dos bandas negras seguidas. */}
      <section className={`${css.piezasSeccion} panel-oscuro`}>
        <div className="wrap">
          {/* h2 y no un rótulo: las piezas llevan h3, y sin esto colgaban del
              h2 del formulario («Apúntate a la lista»). */}
          <h2 className={`titulo-sm ${css.seccionTitulo}`}>La masterclass</h2>
          <div className={css.piezas}>
            {PIEZAS_MASTERCLASS.map((m) => (
              <article key={m.titulo} className={css.pieza}>
                <span className={css.estado}>{m.estado}</span>
                <h3 className={css.piezaTitulo}>{m.titulo}</h3>
                <p className={css.piezaTexto}>{sinPuntoSuelto(m.texto)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Aquí iba el precio. Se retira: hasta que abra, solo se habla de la
          lista de espera, y el precio se anuncia con la apertura. */}

      {/* Mismo ancho que la portada y la masterclass: con el contenedor de
          1000 px las preguntas arrancaban 120 px más adentro que todo lo de
          arriba y la página se veía torcida. */}
      <section className={css.preguntas}>
        <div className="wrap">
          <h2 className={`titulo-sm ${css.seccionTitulo}`}>Preguntas</h2>
          <div className="columna">
            {OBJECIONES.map((o) => (
              <div key={o.q} className={css.objecion}>
                <p className={css.objecionP}>{o.q}</p>
                <p className={css.objecionR}>{sinPuntoSuelto(o.a)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
