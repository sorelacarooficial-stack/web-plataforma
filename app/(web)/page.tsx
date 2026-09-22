import Image from 'next/image';
import Link from 'next/link';
import Motas from '@/components/Motas';
import Marquesina from '@/components/Marquesina';
import Acordeon from '@/components/Acordeon';
import Contador from '@/components/Contador';
import LlamadaDivine from '@/components/LlamadaDivine';
import BotonAsistente from '@/components/BotonAsistente';
import ListaEspera from '@/components/ListaEspera';
import {
  COMUNIDAD,
  EN_LISTA,
  FAQS,
  INSTAGRAM,
  INSTAGRAM_USUARIO,
  PILARES,
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
      {/* ---------- Hero ---------- */}
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
              Formación en estética avanzada
            </span>

            <h1 className={css.heroTitulo}>Juventud linfática y ganglionar en tus manos.</h1>

            {/* La entradilla describe el trabajo, no promete efectos. «Sin
                aparatología» no se usa como ventaja a propósito: encuadraría la
                técnica como alternativa a un tratamiento médico. */}
            <p className={css.heroLede}>
              La Técnica Divine es drenaje linfático manual llevado más lejos. Aprendes a leer el
              cuerpo que tienes delante y a decidir qué necesita antes de ponerle las manos encima.
            </p>

            {/* Dos salidas y una jerarquía clara: la información abre una ventana
                aquí mismo, la cita abre el asistente. Nadie sale de la página. */}
            <LlamadaDivine
              textoPrincipal="Quiero la información"
              textoCita="Agendar una cita"
              preguntaCita="Quiero agendar una cita. ¿Cómo lo hacemos?"
            />

            <p className={css.heroFirma}>
              <span className={css.heroRaya} />
              Sorela Caro, creadora del método
            </p>
          </div>
        </div>
      </section>

      <Marquesina />

      {/* ---------- Qué es la Técnica Divine ----------
           Sustituye al antiguo bloque «el problema». Quien llega por un QR o por
           Instagram no sabe qué es esto, y sin esa respuesta lo demás no se
           sostiene. El texto habla de técnica y de criterio a propósito: los
           efectos sobre la salud no se prometen en una web de estética. */}
      <section id="metodo" className={`seccion ${css.metodo}`}>
        <div className="wrap rejilla">
          <div className="columna" style={{ gap: 22 }}>
            <p className="antetitulo">Qué es la Técnica Divine</p>
            <h2 className="titulo-lg max-560">
              Un método manual con un orden: primero abrir, después drenar, después moldear.
            </h2>
            <p className="texto max-480">
              Divine es drenaje linfático manual avanzado. Lo creó Sorela Caro sobre la base del
              drenaje clásico, después de quince años de cabina. Se trabaja con las manos y aceite,
              por zonas: abdomen, piernas y glúteos, brazos, cintura, espalda, y el rostro en su
              versión facial.
            </p>
            <p className="texto max-480">
              El orden manda. Primero se abren los ganglios y las estaciones linfáticas con
              pulsaciones lentas y rítmicas. Solo después se arrastra, de proximal a distal,
              siguiendo el recorrido natural del sistema linfático. Sobre esa base llegan las
              maniobras de moldeo.
            </p>
            <p className="texto max-480">
              El protocolo está pautado por fases, pero se ajusta al biotipo de cada persona. Lo
              habitual es terminar la sesión con sensación de ligereza y un contorno más definido.
              La respuesta varía según cada persona y cada momento.
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

        {/* Los cinco pilares: es la estructura con la que Sorela enseña el
            método, y cuenta mejor que cualquier lista de beneficios qué se
            aprende de verdad en la formación. */}
        <div className="wrap" style={{ marginTop: 'clamp(44px,6vw,80px)' }}>
          <p className="antetitulo" style={{ marginBottom: 'clamp(22px,3vw,34px)' }}>
            Los tres pilares
          </p>
          <ol className={css.pilares}>
            {PILARES.map((p, i) => (
              <li key={p.titulo} className={css.pilar}>
                <span className={css.pilarNumero}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className={css.pilarTitulo}>{p.titulo}</h3>
                <p className="texto-fijo" style={{ fontSize: 15.5 }}>
                  {p.texto}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- La cita ---------- */}
      <section className={css.cita}>
        <div className="wrap wrap-1040">
          <blockquote className={css.citaTexto}>
            Cada persona vive una frecuencia diferente, su cuerpo también lo expresa. Aprender a
            observarlo, interpretarlo y decidir cómo trabajar es el verdadero comienzo.
          </blockquote>
          <span className={css.citaFirma}>Sorela Caro</span>
        </div>
      </section>

      {/* ---------- Formaciones: el recorrido ----------
           El orden importa y es la regla del método: primero online, después
           presencial. Por eso se cuenta como un camino de dos etapas y no como
           dos productos que compiten entre sí. */}
      <section id="formaciones" className="seccion superficie borde-arriba">
        <div className="wrap">
          <div className={css.formacionIntro}>
            <p className="antetitulo">Formarte conmigo</p>
            <h2 className="titulo-lg max-640">Para ser terapeuta Divine hay un orden.</h2>
            <p className="texto max-560">
              Para formarte como terapeuta Divine el orden no cambia: primero la formación online,
              después la presencial. Así llegas con la teoría resuelta y los dos días con Sorela se
              dedican enteros a tus manos.
            </p>
          </div>

          <div className={css.etapas}>
            <article className={css.etapa}>
              <span className={css.etapaOrden}>Primera etapa</span>
              <h3 className={css.etapaTitulo}>Formación online</h3>
              <p className="texto-fijo">
                Aquí empieza todo. Trabajas la anatomía linfática, la lógica del método y el
                protocolo por fases antes de ponerte a tocar. Desde tu país y a tu ritmo, para
                llegar preparada a los dos días presenciales.
              </p>
              <ul className={css.etapaLista}>
                <li>Anatomía linfática y lógica del método</li>
                <li>Dossier precurso con el protocolo por fases</li>
                <li>Acceso flexible, desde tu país y a tu ritmo</li>
                <li>Requisito previo para la formación presencial</li>
              </ul>
            </article>

            <article className={`${css.etapa} ${css.etapaDestacada}`}>
              <span className={css.etapaOrden}>Segunda etapa</span>
              <h3 className={css.etapaTitulo}>Formación presencial</h3>
              <p className="texto-fijo">
                Dos jornadas con Sorela. El primer día, lipodrenaje: protocolo completo y
                aplicación. El segundo, moldeo y tonificación. Se practica sobre modelos reales,
                con corrección directa sobre tus manos.
              </p>
              <ul className={css.etapaLista}>
                <li>Día 1 · Lipodrenaje, protocolo completo y aplicación</li>
                <li>Día 2 · Moldeo y tonificación de silueta</li>
                <li>Práctica sobre modelos reales, no solo demostración</li>
                <li>Corrección de Sorela sobre tus manos</li>
              </ul>
            </article>
          </div>

          {/* Fechas: hoy no hay ninguna cerrada, y eso se dice. Poner una fecha
              que luego se mueve cuesta más que no ponerla. */}
          <div className={css.fechas}>
            <div>
              <p className="antetitulo" style={{ color: 'var(--oro)' }}>
                Próximas fechas
              </p>
              <h3 className={css.fechasTitulo}>Sudamérica, próximamente.</h3>
              <p className="texto max-520">
                Las fechas y las ciudades están a punto de confirmarse. Si quieres que te guarde
                sitio antes de que se publiquen, dímelo y te reservo el espacio.
              </p>
            </div>
            <BotonAsistente pregunta="Quiero consultar las próximas fechas en Sudamérica y que me guardes sitio.">
              Consultar fechas
            </BotonAsistente>
          </div>
        </div>
      </section>

      {/* ---------- Quién está detrás ---------- */}
      <section className="seccion">
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

      {/* ---------- Banda: la conversación que cambia ---------- */}
      <section className={css.banda}>
        <div className={css.bandaTexto}>
          <div className={css.bandaCaja}>
            <p className="antetitulo" style={{ color: 'var(--accent-inverse)' }}>
              Por qué cambia tu trabajo
            </p>
            <h2 className="titulo-lg" style={{ color: 'var(--inverse-ink)' }}>
              A la cuarta sesión te pregunta por qué no ve nada. Y no sabes qué decirle.
            </h2>
            <p className="texto" style={{ color: 'var(--on-inverse-2)' }}>
              Ahí se pierde la clienta, se regala la sesión y se baja el precio. Con un método
              detrás, esa conversación cambia de bando: le explicas qué estás viendo, qué toca
              ahora y por qué.
            </p>
            <Link href="/formaciones" className="btn btn-claro" style={{ marginTop: 8 }}>
              Ver las formaciones
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

      {/* ---------- Comunidad Divine ---------- */}
      <section id="comunidad" className={css.comunidad}>
        <div className="wrap">
          <div className={css.comunidadCabeza}>
            <div className={css.comunidadTexto}>
              <p className="antetitulo">Comunidad Divine</p>
              <h2 className="titulo-lg max-560">Terminar la formación no es llegar.</h2>
              <p className="texto max-520">
                Sales del curso con criterio nuevo y muchas ganas. A las tres semanas aparece el
                primer caso raro, no tienes a quién preguntar y vuelves a lo de siempre. La
                Comunidad Divine existe para cortar ese patrón.
              </p>

              <div className={css.precio}>
                <span className={css.precioCifra}>{COMUNIDAD.precio} €</span>
                <span className={css.precioPeriodo}>{COMUNIDAD.periodo}</span>
                <span className={css.precioSello}>{COMUNIDAD.condicion}</span>
              </div>
              <p className="nota" style={{ maxWidth: 440 }}>
                Quien entra ahora conserva ese precio mientras siga dentro.
              </p>
            </div>

            <div className={css.apertura}>
              <p className="antetitulo" style={{ color: 'var(--oro)' }}>
                Abre el {COMUNIDAD.apertura}
              </p>
              <Contador />
              <div className={css.aperturaAcciones}>
                <a href="#lista" className="btn btn-md">
                  Entrar en la lista
                </a>
                <Link href="/comunidad" className="enlace-fino">
                  Qué hay dentro
                </Link>
              </div>
            </div>
          </div>

          <div className={css.piezas}>
            {PIEZAS_COMUNIDAD.map((p) => (
              <article key={p.titulo} className={css.pieza} style={{ borderTopColor: p.color }}>
                <span className={css.piezaEstado}>{p.estado}</span>
                <h3 className={css.piezaTitulo}>{p.titulo}</h3>
                <p className="texto-fijo" style={{ fontSize: 16 }}>
                  {p.texto}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- La lista de espera ---------- */}
      <section id="lista" className={`seccion ${css.lista}`}>
        <div className="wrap rejilla-290" style={{ alignItems: 'start' }}>
          <div className="columna-texto">
            <p className="antetitulo">La lista</p>
            <h2 className="titulo-lg">Las primeras entran con condición de fundadora.</h2>
            <p className="texto max-480">
              Y la conservan mientras sigan dentro. Eso sí te lo puedo prometer.
            </p>
            <p className="texto max-480">
              No pido tarjeta, no hay reserva que pagar y puedes salirte con un correo. Nada de
              correos cada semana.
            </p>
            <p className="texto max-480">
              Para entrar el día que abra hay que estar certificada conmigo. Para estar en la
              lista, no: si ya tienes plaza en una formación, apúntate igual.
            </p>
            <p className={css.contador}>
              <span data-count={String(EN_LISTA)}>{EN_LISTA}</span> terapeutas están ya en la lista.
            </p>
          </div>

          <div className={css.cajaLista}>
            <ListaEspera />
          </div>
        </div>
      </section>

      {/* ---------- Localiza tu terapeuta ---------- */}
      <section className="seccion">
        <div className="wrap rejilla-290" style={{ gap: 'clamp(28px,4vw,60px)' }}>
          <div className="columna-texto">
            <p className="antetitulo" style={{ color: 'var(--azul)' }}>
              Localiza tu terapeuta Divine
            </p>
            <h2 className="titulo-lg">¿No eres profesional? También hay sitio para ti.</h2>
            <p className="texto max-480">
              En el mapa están las terapeutas certificadas por Sorela, con su ciudad y su forma de
              reservar. Cada sesión empieza con unos minutos de valoración: no se trabaja sobre un
              cuerpo sin haberlo mirado antes.
            </p>
            <Link href="/terapeutas" className="btn btn-md" style={{ marginTop: 6 }}>
              Abrir el mapa
            </Link>
          </div>
          <div className="foto foto-45">
            <Image
              src={consulta}
              alt="Sesión de trabajo corporal en consulta"
              sizes="(max-width: 860px) 100vw, 45vw"
              placeholder="blur"
            />
          </div>
        </div>
      </section>

      {/* ---------- Testimonios ---------- */}
      <section className={css.testimonios}>
        <div className="wrap">
          <h2 className={`titulo-lg max-640 ${css.tituloBloque}`}>Lo que dicen sus alumnas.</h2>
          <div className="rejilla-tarjetas">
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

      {/* ---------- Preguntas ---------- */}
      <section className="seccion superficie">
        <div className="wrap wrap-1040">
          <h2 className={`titulo-lg max-640 ${css.tituloBloque}`}>Lo que más me preguntan.</h2>
          <Acordeon preguntas={FAQS} />
        </div>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className={css.cierre}>
        <div className="wrap wrap-1040">
          <h2 className={css.cierreTitulo}>
            Si has llegado hasta aquí, ya sabes que no es otro protocolo.
          </h2>
          <p className={css.cierreTexto}>
            Déjame tu contacto y te mando la información completa: qué es el método, cómo se
            aprende y cuándo son las próximas formaciones.
          </p>
          <LlamadaDivine
            textoPrincipal="Quiero la información"
            textoCita="Agendar una cita"
            preguntaCita="Quiero agendar una cita. ¿Cómo lo hacemos?"
            alineacion="centro"
          />
        </div>
      </section>
    </main>
  );
}
