import Image from 'next/image';
import Link from 'next/link';
import Motas from '@/components/Motas';
import Marquesina from '@/components/Marquesina';
import Acordeon from '@/components/Acordeon';
import ListaEspera from '@/components/ListaEspera';
import {
  EN_LISTA,
  FAQS,
  INSTAGRAM,
  INSTAGRAM_USUARIO,
  PIEZAS_COMUNIDAD,
  TESTIMONIOS,
} from '@/lib/contenido';
import retrato from '@/fotos/sorela-retrato.webp';
import lumbar from '@/fotos/trabajo-lumbar.webp';
import alumna from '@/fotos/sorela-alumna.webp';
import corrigiendo from '@/fotos/sorela-corrigiendo.webp';
import consulta from '@/fotos/sesion-consulta.webp';
import css from './home.module.css';

export default function Home() {
  return (
    <main>
      {/* ---------- Hero: su retrato a sangre, cara libre a la derecha ---------- */}
      <section className={css.hero}>
        <Image
          src={retrato}
          alt="Sorela Caro trabajando sobre una clienta en su consulta"
          priority
          quality={82}
          sizes="100vw"
          placeholder="blur"
          data-hero="1"
          className={css.heroFoto}
        />
        <div className={css.heroVelo} />
        <Motas className={css.heroMotas} />

        <div className={css.heroCaja}>
          <div className={css.heroTexto}>
            <span className={css.sello}>
              <span className={css.selloPunto} />
              Formación presencial en estética avanzada
            </span>

            <h1 className={css.heroTitulo}>Antes de poner las manos, aprende a mirar.</h1>

            <p className={css.heroLede}>
              La Técnica Divine no te da otro protocolo. Te da el criterio para decidir qué
              necesita el cuerpo que hoy tienes en la camilla.
            </p>

            <div className={css.heroAcciones}>
              <Link href="/formaciones" className="btn">
                Ver próximas fechas
              </Link>
              <Link href="/metodo" className="enlace-subrayado">
                Cómo funciona el método
              </Link>
            </div>

            <p className={css.heroFirma}>
              <span className={css.heroRaya} />
              Sorela Caro, creadora del método
            </p>
          </div>
        </div>
      </section>

      <Marquesina />

      {/* ---------- Las dos puertas: qué existe hoy y qué está en beta ----------
           Contesta en el primer scroll qué es esto, qué funciona ya y qué viene.
           La jerarquía de color dice sola cuál es la que tiene fechas abiertas:
           filete de arcilla en la formación, neutro en la comunidad. */}
      <section id="estado" className={`seccion ${css.estado}`}>
        <div className="wrap">
          <div className={css.estadoIntro}>
            <p className="antetitulo">Dos cosas distintas</p>
            <h2 className="titulo-lg max-640">Aquí dentro hay dos cosas. Te digo cuál es cuál.</h2>
            <p className="texto max-520">
              La formación presencial existe, tiene fechas abiertas y es lo único que puedes hacer
              conmigo ahora mismo. Si hoy quieres algo mío, es esto.
            </p>
            <p className="texto max-520">
              La Comunidad Divine es lo que viene después del curso, y está en beta: todavía no
              abre. Lo que sí está abierto es la lista, y las que están dentro son las que deciden
              qué lleva.
            </p>
          </div>

          <div className={css.puertas}>
            <article className={`${css.puerta} ${css.puertaAbierta}`}>
              <span className={css.puertaSello}>Con fechas abiertas</span>
              <h3 className={css.puertaTitulo}>Formación presencial</h3>
              <p className="texto-fijo">
                Madrid, Valencia y Sevilla. Tres días, ocho alumnas, certificado y tu sitio en el
                mapa público.
              </p>
              <Link href="/formaciones" className="btn btn-md">
                Ver próximas fechas
              </Link>
            </article>

            <article className={css.puerta}>
              <span className={`${css.puertaSello} ${css.puertaSelloNeutro}`}>En beta</span>
              <h3 className={css.puertaTitulo}>Comunidad Divine</h3>
              <p className="texto-fijo">
                Todavía no abre. Quien está en la lista entra primero y ayuda a decidir qué lleva
                dentro.
              </p>
              <a href="#lista" className="enlace-subrayado">
                Entrar en la lista de espera
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ---------- El problema ---------- */}
      <section className="seccion">
        <div className="wrap rejilla">
          <div className="columna" style={{ gap: 22 }}>
            <p className="antetitulo">El problema</p>
            <h2 className="titulo-lg">Te enseñaron una secuencia. No a leer un cuerpo.</h2>
            <p className="texto max-480">
              Estos movimientos, este orden, estos minutos. Funciona hasta que entra la clienta
              que no encaja en el guion: la operada hace tres semanas, la que retiene sin causa
              aparente, la que lleva seis meses sin resultados. Y entra cada semana.
            </p>
          </div>
          <div className="foto foto-45">
            <Image
              src={lumbar}
              alt="Manos trabajando la zona lumbar"
              sizes="(max-width: 860px) 100vw, 45vw"
              placeholder="blur"
              style={{ objectPosition: '50% 45%' }}
            />
          </div>
        </div>
      </section>

      {/* ---------- La cita ---------- */}
      <section className={css.cita}>
        <div className="wrap wrap-1040">
          <blockquote className={css.citaTexto}>
            No se trata simplemente de poner las manos. Se trata de saber qué observar, qué
            interpretar y cómo decidir antes de trabajar.
          </blockquote>
          <span className={css.citaFirma}>Sorela Caro</span>
        </div>
      </section>

      {/* ---------- Qué cambia ---------- */}
      <section className="seccion">
        <div className="wrap">
          <h2 className={`titulo-lg max-640 ${css.tituloBloque}`}>
            Se acaba el «vamos a ver cómo responde».
          </h2>
          <div className="rejilla-tarjetas">
            <article className="tarjeta" style={{ borderTop: '3px solid var(--arcilla)' }}>
              <h3>Criterio</h3>
              <p className="texto-fijo">
                En los dos primeros minutos ya sabes qué mirar y qué te está diciendo lo que ves.
              </p>
            </article>
            <article className="tarjeta" style={{ borderTop: '3px solid var(--salvia)' }}>
              <h3>Decisión</h3>
              <p className="texto-fijo">
                Eliges el trabajo para ese cuerpo y ese día. También sabes qué no tocar todavía.
              </p>
            </article>
            <article className="tarjeta" style={{ borderTop: '3px solid var(--azul)' }}>
              <h3>Palabras</h3>
              <p className="texto-fijo">
                Le cuentas a tu clienta qué has visto y por qué trabajas así. Por eso vuelve, y por
                eso paga lo que cuesta.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ---------- Quién está detrás ---------- */}
      <section className="seccion superficie borde-arriba">
        <div className="wrap rejilla-290">
          <div className="foto foto-45">
            <Image
              src={alumna}
              alt="Sorela Caro repasando casos con una alumna"
              sizes="(max-width: 860px) 100vw, 45vw"
              placeholder="blur"
              style={{ objectPosition: '56% 34%' }}
            />
          </div>

          <div className="columna-texto">
            <p className="antetitulo" style={{ color: 'var(--oro)' }}>
              Quién está detrás
            </p>
            <h2 className="titulo-lg">Sorela Caro, creadora de la Técnica Divine.</h2>
            <p className="texto max-500">
              Empecé como todas: aplicando el protocolo que me habían enseñado. Ordené en un método
              lo que hasta entonces llamaba intuición, y ese método es lo que enseño. Doy yo las
              formaciones, corrijo yo en la camilla y respondo yo los correos. La comunidad la voy
              a llevar igual.
            </p>

            <div className={css.datos}>
              <div className="dato" style={{ borderTop: '2px solid var(--arcilla)' }}>
                <span className="dato-cifra" data-count="87">
                  87
                </span>
                <span className="dato-pie">terapeutas formadas por ella</span>
              </div>
              <div className="dato" style={{ borderTop: '2px solid var(--salvia)' }}>
                <span className="dato-cifra">8</span>
                <span className="dato-pie">alumnas por grupo, nunca más</span>
              </div>
              <div className="dato" style={{ borderTop: '2px solid var(--azul)' }}>
                <span className="dato-cifra">0</span>
                <span className="dato-pie">clases delegadas a terceros</span>
              </div>
            </div>

            <div className={css.acciones}>
              <Link href="/sobre" className="btn btn-md">
                Conocer a Sorela
              </Link>
              <a href={INSTAGRAM} className="enlace-fino" target="_blank" rel="noopener">
                {INSTAGRAM_USUARIO}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Banda de formaciones: copy a la izquierda, foto entera a la derecha ---------- */}
      <section className={css.banda}>
        <div className={css.bandaTexto}>
          <div className={css.bandaCaja}>
            <p className="antetitulo" style={{ color: 'var(--accent-inverse)' }}>
              Formaciones presenciales
            </p>
            <h2 className="titulo-lg" style={{ color: 'var(--inverse-ink)' }}>
              A la cuarta sesión te pregunta por qué no ve nada. Y no sabes qué decirle.
            </h2>
            <p className="texto" style={{ color: 'var(--on-inverse-2)' }}>
              Ahí se pierde la clienta, se regala la sesión y se baja el precio. Tres días conmigo
              al lado de la camilla y esa conversación cambia de bando: le explicas qué estás
              viendo, qué toca ahora y por qué.
            </p>
            <Link href="/formaciones" className="btn btn-claro" style={{ marginTop: 8 }}>
              Madrid, Valencia y Sevilla
            </Link>
          </div>
        </div>
        <div className={css.bandaFoto} data-parallax>
          <Image
            src={corrigiendo}
            alt="Sorela Caro corrigiendo a dos alumnas junto a la camilla"
            sizes="(max-width: 860px) 100vw, 50vw"
            placeholder="blur"
            style={{ objectPosition: '46% 30%' }}
          />
        </div>
      </section>

      {/* ---------- La comunidad: por qué existe y en qué punto está ---------- */}
      <section className={css.comunidad}>
        <div className="wrap rejilla">
          <div className="columna-texto" style={{ order: 1 }}>
            <p className="antetitulo">La comunidad</p>
            <h2 className="titulo-lg">Terminar la formación no es llegar.</h2>
            <p className="texto max-480">
              Sales del curso con criterio nuevo y muchas ganas. A las tres semanas aparece el
              primer caso raro, no tienes a quién preguntar y vuelves a lo de siempre. Llevo tiempo
              viendo ese patrón: la Comunidad Divine existe para cortarlo.
            </p>
            <p className="texto max-480">
              Está en beta. Significa que ya sé qué va dentro y todavía no está grabado: cuatro
              piezas están decididas y la quinta la estoy escribiendo. La estoy montando con las que
              ya están en la lista. Primero les pregunto qué necesitan tener dentro, luego lo
              escribo.
            </p>
            <p className="texto max-480">
              El precio y la fecha de apertura, todavía no lo sé. No pongo fecha que no pueda
              cumplir y no te voy a dar un precio que luego cambie. Cuando los tenga, lo sabe la
              lista antes que nadie.
            </p>
          </div>

          <div className="foto foto-45" style={{ order: 2 }}>
            <Image
              src={consulta}
              alt="Sesión de trabajo corporal en consulta"
              sizes="(max-width: 860px) 100vw, 45vw"
              placeholder="blur"
            />
          </div>
        </div>

        <div className="wrap" style={{ marginTop: 'clamp(40px,6vw,72px)' }}>
          <p className="antetitulo" style={{ marginBottom: 'clamp(24px,3vw,36px)' }}>
            Lo que quiero que tenga
          </p>
          <div className={css.piezas}>
            {PIEZAS_COMUNIDAD.map((p) => (
              <article key={p.titulo} className={css.pieza}>
                <span className={css.piezaEstado}>{p.estado}</span>
                <h3 className={css.piezaTitulo}>{p.titulo}</h3>
                <p className="texto-fijo" style={{ fontSize: 16 }}>
                  {p.texto}
                </p>
              </article>
            ))}
          </div>
          <p className={css.remate} style={{ marginTop: 'clamp(30px,4vw,48px)' }}>
            No te lo enseño como si estuviera terminado, porque no lo está.{' '}
            <span style={{ color: 'var(--arcilla)' }}>Te lo enseño para que me digas qué falta.</span>
          </p>
          <Link href="/comunidad" className="enlace-fino" style={{ marginTop: 10 }}>
            Las preguntas de la lista
          </Link>
        </div>
      </section>

      {/* ---------- La lista de espera, con el formulario en la propia home ---------- */}
      <section id="lista" className={`seccion ${css.lista}`}>
        <div className="wrap rejilla-290" style={{ alignItems: 'start' }}>
          <div className="columna-texto">
            <p className="antetitulo">La lista</p>
            <h2 className="titulo-lg">Las primeras de la lista entran con condición de fundadora.</h2>
            <p className="texto max-480">
              Y la mantienen mientras sigan dentro. Eso sí te lo puedo prometer.
            </p>
            <p className="texto max-480">
              No pido tarjeta, no hay reserva que pagar y puedes salirte con un correo. Nada de
              correos cada semana.
            </p>
            <p className="texto max-480">
              Para entrar el día que abra hay que estar certificada conmigo. Para estar en la lista,
              no: si tienes plaza en una formación, apúntate igual. Y si reservas plaza en una de
              las tres, tu sitio en la lista ya va incluido. Si todavía no te has formado, el orden
              es ese. Primero los tres días.
            </p>
            <p className={css.contador}>
              <span data-count={String(EN_LISTA)}>{EN_LISTA}</span> terapeutas están ya en la lista.
            </p>
          </div>

          <div className={css.cajaLista}>
            <ListaEspera />
            <Link href="/formaciones" className="enlace-fino" style={{ marginTop: 6 }}>
              Ver próximas fechas
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Para clientas ---------- */}
      <section className="seccion">
        <div className="wrap rejilla-290" style={{ gap: 'clamp(28px,4vw,60px)' }}>
          <div className="columna-texto">
            <p className="antetitulo" style={{ color: 'var(--azul)' }}>
              Para clientas
            </p>
            <h2 className="titulo-lg">Si está en el mapa, se formó conmigo.</h2>
            <p className="texto max-460">
              Ninguna terapeuta aparece ahí por pagar. Aparece porque hizo la formación, se
              certificó y trabaja con el método. Abre el mapa, mira quién tienes cerca y reserva
              con ella.
            </p>
            <Link href="/terapeutas" className={`btn ${css.btnAzul}`} style={{ marginTop: 4 }}>
              Abrir el mapa
            </Link>
          </div>

          <div className={css.cifras}>
            <div className={css.cifra} style={{ background: 'var(--azul-tint)' }}>
              <span className={css.cifraNum} style={{ color: 'var(--azul)' }} data-count="6">
                6
              </span>
              <span className={css.cifraPie} style={{ color: 'var(--azul-ink)' }}>
                ciudades con consulta abierta
              </span>
            </div>
            <div className={css.cifra} style={{ background: 'var(--salvia-tint)' }}>
              <span className={css.cifraNum} style={{ color: 'var(--salvia)' }} data-count="87">
                87
              </span>
              <span className={css.cifraPie} style={{ color: 'var(--salvia-ink)' }}>
                terapeutas certificadas
              </span>
            </div>
            <div className={css.cifra} style={{ background: 'var(--arcilla-tint)' }}>
              <span className={css.cifraNum} style={{ color: 'var(--arcilla)' }}>
                10 min
              </span>
              <span className={css.cifraPie} style={{ color: 'var(--arcilla-ink)' }}>
                de valoración antes de tocarte
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Testimonios ---------- */}
      <section className={css.testimonios}>
        <div className="wrap">
          <h2 className={`titulo-lg max-620 ${css.tituloBloque}`}>Lo que cambió en su cabina.</h2>
          <div className="rejilla-tarjetas" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))' }}>
            {TESTIMONIOS.map((t) => (
              <figure key={t.nombre} className={css.testimonio}>
                <blockquote className={css.testimonioFrase}>{t.frase}</blockquote>
                <figcaption className={css.testimonioPie}>
                  <span className={css.iniciales}>{t.iniciales}</span>
                  <span className="columna" style={{ gap: 3 }}>
                    <span className={css.testimonioNombre}>{t.nombre}</span>
                    <span className={css.testimonioCiudad}>{t.ciudad}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="seccion superficie">
        <div className="wrap wrap-1000">
          <h2 className={`titulo-sm ${css.tituloFaq}`}>Lo que me preguntáis siempre</h2>
          <Acordeon preguntas={FAQS} />
        </div>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className={css.cierre}>
        <div className="wrap wrap-820">
          <p className="antetitulo" style={{ color: 'var(--accent-inverse)' }}>
            Próxima convocatoria
          </p>
          <h2 className={css.cierreTitulo}>
            Madrid, del 14 al 16 de noviembre. Quedan tres plazas.
          </h2>
          <Link href="/formaciones/formacion-base" className="btn btn-claro" style={{ marginTop: 6 }}>
            Reservar mi plaza
          </Link>
        </div>
      </section>
    </main>
  );
}
