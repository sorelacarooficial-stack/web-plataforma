import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Marquesina from '@/components/Marquesina';
import Apiladas from '@/components/landing/Apiladas';
import Cinta from '@/components/landing/Cinta';
import FadeIn from '@/components/landing/FadeIn';
import Magnet from '@/components/landing/Magnet';
import TextoRevelado from '@/components/landing/TextoRevelado';
import l from '@/components/landing/landing.module.css';
import { CINTA_ALUMNAS } from '@/lib/precurso';
import Acordeon from '@/components/Acordeon';
import Contador from '@/components/Contador';
import Testimonios from '@/components/Testimonios';
import LlamadaDivine from '@/components/LlamadaDivine';
import BotonAsistente from '@/components/BotonAsistente';
import BotonCaptacion from '@/components/BotonCaptacion';
import DatosEstructurados from '@/components/DatosEstructurados';
import {
  FAQS,
  INSTAGRAM,
  INSTAGRAM_USUARIO,
  PILARES,
} from '@/lib/contenido';
import lumbar from '@/fotos/trabajo-lumbar.webp';
import alumna from '@/fotos/sorela-alumna.webp';
import css from './home.module.css';

/**
 * La portada no tenía bloque de metadatos propio: heredaba el `title.default`
 * y la `description` del layout raíz (app/layout.tsx), que siguen sirviendo de
 * respaldo para las rutas sin metadatos propios. Ese título por defecto
 * —«Sorela Caro · Técnica Divine»— solo pelea por el nombre, y la portada es
 * la página que mejor puede ganar «formación drenaje linfático».
 *
 * `absolute` evita que se le aplique la plantilla «%s · Técnica Divine» del
 * layout: con ella el título se iría a 70 caracteres y Google lo cortaría.
 */
export const metadata: Metadata = {
  title: { absolute: 'Formación en drenaje linfático manual con Sorela Caro' },
  description:
    'Te enseño la Técnica Divine, mi método de drenaje linfático manual avanzado: primero la formación online y después dos días presenciales conmigo.',
};

export default function Home() {
  return (
    // clip y no hidden: corta lo que asoma por los lados (la cinta de fotos,
    // las esquinas) sin romper las tarjetas que se quedan pegadas al bajar.
    <main style={{ overflowX: 'clip' }}>
      {/* ---------- Hero ----------
           Como las landings: el titular enorme en dorado, el retrato que sigue
           al ratón y, abajo, la firma a un lado y las dos llamadas al otro. */}
      <section className={css.portada}>
        <div className={css.portadaTituloCaja}>
          <FadeIn delay={0.15} y={40}>
            <h1 className={`${css.portadaTitulo} degradado`}>
              Juventud linfática y ganglionar en tus manos.
            </h1>
          </FadeIn>
        </div>

        {/* La posición va en un div propio y la animación dentro: si fueran
            en el mismo, el transform de la animación pisaría el que centra. */}
        <div className={css.portadaRetrato}>
          <FadeIn delay={0.6} y={30}>
            <Magnet margen={150} fuerza={3}>
              <Image
                src="/landing/sorela-recorte.webp"
                alt="Sorela Caro, creadora de la Técnica Divine"
                width={514}
                height={598}
                className={css.portadaRetratoFoto}
                priority
                sizes="(max-width: 640px) 260px, (max-width: 1024px) 400px, 470px"
              />
            </Magnet>
          </FadeIn>
        </div>

        <div className={css.portadaPie}>
          <FadeIn delay={0.35} y={20} className={css.portadaLema}>
            <span className={css.sello}>
              <span className={css.selloPunto} />
              Formación en estética avanzada
            </span>
            <p className={css.heroFirma}>
              <span className={css.heroRaya} />
              Sorela Caro, creadora del método
            </p>
          </FadeIn>

          {/* Dos salidas y una jerarquía clara: la información abre una ventana
              aquí mismo, la cita abre el asistente. Nadie sale de la página. */}
          <FadeIn delay={0.5} y={20}>
            <LlamadaDivine
              textoPrincipal="Quiero la información"
              textoCita="Agendar una cita"
              preguntaCita="Quiero agendar una cita. ¿Cómo lo hacemos?"
              sobre="oscuro"
            />
          </FadeIn>
        </div>
      </section>

      {/* La cinta de antes y después, que se mueve con la página. */}
      <Cinta fotos={CINTA_ALUMNAS} />

      <Marquesina />

      {/* ---------- Qué es la Técnica Divine ----------
           Sustituye al antiguo bloque «el problema». Quien llega por un QR o por
           Instagram no sabe qué es esto, y sin esa respuesta lo demás no se
           sostiene. El texto habla de técnica y de criterio a propósito: los
           efectos sobre la salud no se prometen en una web de estética. */}
      <section id="metodo" className={`${l.sobre} ${css.metodo}`}>
        <FadeIn className={`${l.esquina} ${l.esqSI}`} delay={0.1} x={-80} y={0} duration={0.9}>
          <Image src={lumbar} alt="Manos trabajando la zona lumbar" className={l.esquinaFoto} sizes="210px" placeholder="blur" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqSD}`} delay={0.15} x={80} y={0} duration={0.9}>
          <Image src="/alumnas/manos.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="210px" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqII}`} delay={0.25} x={-80} y={0} duration={0.9}>
          <Image src="/trayectoria/sesion-1.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="180px" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqID}`} delay={0.3} x={80} y={0} duration={0.9}>
          <Image src="/alumnas/camilla.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="220px" />
        </FadeIn>

        <div className={l.sobreTexto}>
          <FadeIn y={40} className={css.centro}>
            <p className="antetitulo">Qué es la Técnica Divine</p>
            <h2 className="titulo-lg max-640">
              Un método manual con un orden: primero estimular, después drenar, después moldear.
            </h2>
          </FadeIn>
          <TextoRevelado
            className={l.revelado}
            texto="Divine es drenaje linfático manual avanzado. Nació de casi treinta años de cabina, de ordenar sobre la base del drenaje clásico lo que hasta entonces llamaba intuición. Se trabaja con las manos y aceite, por zonas: abdomen, piernas y glúteos, brazos, cintura, espalda, y el rostro en su versión facial."
          />
          <TextoRevelado
            className={l.revelado}
            texto="El orden manda. Primero se trabajan los ganglios y las estaciones linfáticas con pulsaciones lentas y rítmicas. Solo después se arrastra, de proximal a distal, siguiendo el recorrido natural del sistema linfático. Sobre esa base llegan las maniobras de moldeo."
          />
          <TextoRevelado
            className={l.revelado}
            texto="El protocolo está pautado por fases, pero se ajusta al biotipo de cada persona. Lo habitual es terminar la sesión con sensación de ligereza y un contorno más definido. La respuesta varía según cada persona y cada momento."
          />
        </div>
      </section>

      {/* Los tres pilares: es el orden con el que Sorela enseña el método, y
          cuenta mejor que cualquier lista de beneficios qué se aprende de
          verdad en la formación. En blanco y con números enormes, como la
          lista de las landings. */}
      <section className={`panel-blanco ${l.blanca}`}>
        <FadeIn y={40}>
          <p className={`${l.gigante} ${l.blancaTitulo}`}>Los tres pilares</p>
        </FadeIn>
        <ol className={l.lista}>
          {PILARES.map((p, i) => (
            <FadeIn as="li" key={p.titulo} delay={i * 0.1} className={l.item}>
              <span className={l.itemNum}>{String(i + 1).padStart(2, '0')}</span>
              <div className={l.itemCuerpo}>
                <h3 className={l.itemNombre}>{p.titulo}</h3>
                <p className={l.itemTexto}>{p.texto}</p>
              </div>
            </FadeIn>
          ))}
        </ol>
      </section>

      {/* ---------- La cita ---------- */}
      <div className="panel-oscuro">
      <section className={css.cita}>
        <div className="wrap wrap-1040">
          <blockquote className={css.citaCaja}>
            <TextoRevelado
              className={css.citaTexto}
              texto="Cada persona vive una frecuencia diferente, su cuerpo también lo expresa. Aprender a observarlo, interpretarlo y decidir cómo trabajar es el verdadero comienzo."
            />
          </blockquote>
          <span className={css.citaFirma}>Sorela Caro</span>
        </div>
      </section>

      {/* ---------- Formaciones: el recorrido ----------
           El orden importa y es la regla del método: primero online, después
           presencial. Por eso se cuenta como un camino de dos etapas y no como
           dos productos que compiten entre sí. */}
      <section id="formaciones" className="seccion">
        <div className="wrap">
          <FadeIn y={40} className={css.formacionIntro}>
            <p className="antetitulo">Formarte conmigo</p>
            <h2 className="titulo-lg max-640">Para ser terapeuta Divine hay un orden.</h2>
            <p className="texto max-560">
              Para formarte como terapeuta Divine el orden no cambia: primero la formación online,
              después la presencial. Así llegas con la teoría resuelta y los dos días conmigo se
              dedican enteros a tus manos.
            </p>
          </FadeIn>

          <div>
            <Apiladas
              tarjetas={[
                <article key="online" className={css.etapa}>
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
                </article>,
                <article key="presencial" className={`${css.etapa} ${css.etapaDestacada}`}>
                  <span className={css.etapaOrden}>Segunda etapa</span>
                  <h3 className={css.etapaTitulo}>Formación presencial</h3>
                  <p className="texto-fijo">
                    Dos jornadas conmigo. El primer día, lipodrenaje: protocolo completo y
                    aplicación. El segundo, moldeo y tonificación. Se practica sobre modelos reales,
                    con corrección directa sobre tus manos.
                  </p>
                  <ul className={css.etapaLista}>
                    <li>Día 1 · Lipodrenaje, protocolo completo y aplicación</li>
                    <li>Día 2 · Moldeo y tonificación de silueta</li>
                    <li>Práctica sobre modelos reales, no solo demostración</li>
                    <li>Te corrijo sobre tus manos</li>
                  </ul>
                </article>,
              ]}
            />
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

      </div>

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
            <h2 className="titulo-lg">Soy Sorela Caro y llevo casi treinta años en cabina.</h2>

            <div className={css.acciones}>
              <Link href="/sobre" className="btn btn-md">
                Conóceme
              </Link>
              <a href={INSTAGRAM} className="enlace-fino" target="_blank" rel="noopener">
                {INSTAGRAM_USUARIO}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Lo que dicen ----------
           Va entre «quién está detrás» y la comunidad: justo después de saber
           quién es ella y justo antes de que se le pida algo. Si no hay
           testimonios cargados, el componente no pinta nada y las dos
           secciones quedan pegadas como si esto no existiera. */}
      <Testimonios />

      {/* ---------- Comunidad Divine ----------
           Una sola idea y un solo botón. Antes esta sección contaba lo que hay
           dentro, ponía precio y desplegaba cinco piezas: mucha lectura para
           algo que todavía no se puede comprar. Lo único que se puede hacer
           hoy es apuntarse, así que es lo único que se pide. */}
      <section id="comunidad" className={css.lanzamiento}>
        <div className="wrap">
          <div className={css.lanzamientoCaja}>
            <p className={css.lanzamientoSello}>Próximamente</p>

            <h2 className={`${css.lanzamientoTitulo} degradado`}>
              Membresía
              <em className={css.lanzamientoTituloEnfasis}>Divine</em>
            </h2>

            <p className={css.lanzamientoPie}>Lista de espera abierta</p>

            <Contador sobre="oscuro" />

            <BotonCaptacion
              className={`btn btn-md ${css.lanzamientoBoton}`}
              titulo="Entra en la lista de espera"
              entradilla="Te aviso en cuanto abra la Membresía Divine, y entras con el precio fundador. No pido tarjeta y puedes salirte con un correo."
              etiquetaVentana="Entrar en la lista de espera de la Membresía Divine"
              origen="comunidad"
            >
              Entrar en la lista de espera
            </BotonCaptacion>
          </div>
        </div>
      </section>

      {/* ---------- Preguntas ---------- */}
      <section className={`seccion panel-blanco ${css.preguntas}`}>
        <div className="wrap wrap-1040">
          <h2 className={`titulo-lg max-640 ${css.tituloBloque}`}>Lo que más me preguntan.</h2>
          <Acordeon preguntas={FAQS} />
          {/*
            Las mismas preguntas, dichas en el formato que lee un buscador. Se
            le pasa la MISMA lista que al acordeón, no una copia: si mañana
            cambia una respuesta, cambia en los dos sitios a la vez. Y va aquí
            y no en otra página porque este bloque solo se puede declarar donde
            las preguntas de verdad se ven.
          */}
          <DatosEstructurados preguntas={FAQS} />
        </div>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className={`panel-oscuro ${css.cierre}`}>
        <div className="wrap wrap-1040">
          <h2 className={`${css.cierreTitulo} degradado`}>
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
            sobre="oscuro"
          />
        </div>
      </section>
    </main>
  );
}
