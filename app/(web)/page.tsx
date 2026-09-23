import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Motas from '@/components/Motas';
import Marquesina from '@/components/Marquesina';
import Acordeon from '@/components/Acordeon';
import Contador from '@/components/Contador';
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
import retrato from '@/fotos/sorela-retrato.webp';
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

            {/* Sin entradilla a propósito. El titular y el botón bastan para
                decidir, y lo que es la Técnica Divine se explica entero en la
                sección de abajo, que es donde alguien lo va a leer de verdad. */}

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
              Un método manual con un orden: primero estimular, después drenar, después moldear.
            </h2>
            <p className="texto max-480">
              Divine es drenaje linfático manual avanzado. Lo creé yo sobre la base del drenaje
              clásico, después de casi treinta años de cabina. Se trabaja con las manos y aceite,
              por zonas: abdomen, piernas y glúteos, brazos, cintura, espalda, y el rostro en su
              versión facial.
            </p>
            <p className="texto max-480">
              El orden manda. Primero se trabajan los ganglios y las estaciones linfáticas con
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

        {/* Los tres pilares: es el orden con el que Sorela enseña el método, y
            cuenta mejor que cualquier lista de beneficios qué se aprende de
            verdad en la formación. */}
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
              después la presencial. Así llegas con la teoría resuelta y los dos días conmigo se
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
                Dos jornadas conmigo. El primer día, lipodrenaje: protocolo completo y
                aplicación. El segundo, moldeo y tonificación. Se practica sobre modelos reales,
                con corrección directa sobre tus manos.
              </p>
              <ul className={css.etapaLista}>
                <li>Día 1 · Lipodrenaje, protocolo completo y aplicación</li>
                <li>Día 2 · Moldeo y tonificación de silueta</li>
                <li>Práctica sobre modelos reales, no solo demostración</li>
                <li>Te corrijo yo, sobre tus manos</li>
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
            <h2 className="titulo-lg">Soy Sorela Caro y la Técnica Divine la creé yo.</h2>

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

      {/* ---------- Comunidad Divine ----------
           Una sola idea y un solo botón. Antes esta sección contaba lo que hay
           dentro, ponía precio y desplegaba cinco piezas: mucha lectura para
           algo que todavía no se puede comprar. Lo único que se puede hacer
           hoy es apuntarse, así que es lo único que se pide. */}
      <section id="comunidad" className={css.lanzamiento}>
        <div className="wrap">
          <div className={css.lanzamientoCaja}>
            <p className={css.lanzamientoSello}>Próximamente</p>

            <h2 className={css.lanzamientoTitulo}>
              Membresía
              <em className={css.lanzamientoTituloEnfasis}>Divine</em>
            </h2>

            <p className={css.lanzamientoPie}>Lista de espera abierta</p>

            <Contador />

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
      <section className="seccion superficie">
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
