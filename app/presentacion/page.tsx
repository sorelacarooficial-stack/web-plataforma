import type { Metadata } from 'next';
import Image from 'next/image';
import logo from '@/fotos/logo-sorela.png';
import Apiladas from '@/components/landing/Apiladas';
import { BotonBrillo, BotonContorno } from '@/components/landing/Botones';
import Cinta from '@/components/landing/Cinta';
import FadeIn from '@/components/landing/FadeIn';
import Magnet from '@/components/landing/Magnet';
import TextoRevelado from '@/components/landing/TextoRevelado';
import Video from '@/components/landing/Video';
import VideoEscala from '@/components/landing/VideoEscala';
import Galeria from '@/components/presentacion/Galeria';
import Revista from '@/components/presentacion/Revista';
import { WHATSAPP_SORELA } from '@/lib/contenido';
import {
  AVISO_IMAGENES,
  CIERRE,
  CIFRAS,
  CINTA,
  CUERPOS,
  EFECTOS,
  ESTRUCTURA,
  NOTA_EFECTOS,
  PERFIL,
  PREAMBULO_EFECTOS,
  ROSTROS,
  SERVICIOS,
  VIDEO,
} from '@/lib/presentacion';
import l from '@/components/landing/landing.module.css';
import css from './presentacion.module.css';

/**
 * La presentación profesional de Sorela Caro.
 *
 * Vive en `/presentacion` y se sirve además en
 * `presentacion.sorelacarodivine.com`, que reescribe el middleware.
 *
 * PARA QUIÉN ES. Para quien se plantea representarla o trabajar con la marca.
 * No hay precios ni formularios: tiene que hacer que alguien que no la conoce
 * quiera escribirle, y el único botón principal es ese, escribirle.
 *
 * CÓMO ESTÁ HECHA. Sigue la estructura de la referencia que eligió Sorela
 * —portada con el titular a todo lo ancho y el retrato que sigue al ratón,
 * cinta de fotos que se mueve con el scroll, texto que se enciende al leerlo,
 * lista con números enormes sobre blanco, tarjetas que se apilan— con su
 * tipografía, sus dorados y sus fotos. Los componentes están en
 * `components/landing/` y los comparte con la landing de alumnas.
 *
 * NO SE INDEXA. Se manda por enlace a quien tenga que verla.
 */

export const metadata: Metadata = {
  title: 'Sorela Caro · Técnica Divine',
  description:
    'Treinta años en estética avanzada y un método propio: la Técnica Divine. Trayectoria, metodología, resultados y estructura de formación.',
  robots: { index: false, follow: false },
};

const WHATSAPP = `https://wa.me/${WHATSAPP_SORELA.replace(/\D/g, '')}?text=${encodeURIComponent(
  'Hola, Sorela. He visto tu presentación profesional y me gustaría hablar contigo.'
)}`;

/** Una tarjeta de resultados: número, qué es, y tres fotos. */
function Carta({
  num,
  categoria,
  nombre,
  fotos,
}: {
  num: string;
  categoria: string;
  nombre: string;
  fotos: [string, string, string];
}) {
  return (
    <>
      <div className={l.cartaCabeza}>
        <div className={l.cartaIzq}>
          <span className={`${l.cartaNum} ${l.degradado}`}>{num}</span>
          <div>
            <span className={l.cartaCategoria}>{categoria}</span>
            <h3 className={l.cartaNombre}>{nombre}</h3>
          </div>
        </div>
        <BotonContorno href="#galeria">Ver galería</BotonContorno>
      </div>
      <div className={l.cartaFotos}>
        <div className={l.cartaCol}>
          <Image src={fotos[0]} alt="" width={700} height={500} className={`${l.cartaFoto} ${l.cartaFotoA}`} sizes="(max-width: 768px) 40vw, 460px" />
          <Image src={fotos[1]} alt="" width={700} height={700} className={`${l.cartaFoto} ${l.cartaFotoB}`} sizes="(max-width: 768px) 40vw, 460px" />
        </div>
        <Image src={fotos[2]} alt="" width={900} height={1100} className={`${l.cartaFoto} ${l.cartaFotoAlta}`} sizes="(max-width: 768px) 60vw, 700px" />
      </div>
    </>
  );
}

export default function Presentacion() {
  return (
    <main className={l.pagina}>
      {/* ================= Portada ================= */}
      <header className={l.hero} style={{ ['--hero-talla' as string]: '13.6vw' }}>
        <FadeIn as="nav" y={-20} delay={0} className={l.nav}>
          <Image src={logo} alt="Sorela Caro · Técnica Divine" className={l.navLogo} priority sizes="130px" />
          <a href="#trayectoria">Trayectoria</a>
          <a href="#metodo">Método</a>
          <a href="#resultados">Resultados</a>
          <a href="#contacto">Contacto</a>
        </FadeIn>

        <div className={l.heroTituloCaja}>
          <FadeIn delay={0.15} y={40}>
            <h1 className={`${l.heroTitulo} ${l.degradado}`}>Sorela Caro</h1>
          </FadeIn>
        </div>

        {/* La posición va en un div propio y la animación dentro. Si van en
            el mismo elemento, el transform de la animación pisa el que
            centra el retrato y se queda descolocado a la derecha. */}
        <div className={l.retrato}>
        <FadeIn delay={0.6} y={30}>
          <Magnet margen={150} fuerza={3}>
            <Image
              src="/landing/sorela-recorte.webp"
              alt="Sorela Caro"
              width={514}
              height={598}
              className={l.retratoFoto}
              priority
              sizes="(max-width: 640px) 270px, (max-width: 1024px) 430px, 500px"
            />
          </Magnet>
        </FadeIn>
        </div>

        <div className={l.heroPie}>
          <FadeIn delay={0.35} y={20}>
            <p className={l.heroLema}>Treinta años de manos y un método propio: la Técnica Divine</p>
          </FadeIn>
          <FadeIn delay={0.5} y={20}>
            <BotonBrillo href={WHATSAPP} externo>
              Hablemos
            </BotonBrillo>
          </FadeIn>
        </div>
      </header>

      {/* ================= El vídeo =================
          Va justo después de la portada, como pidió: es lo primero que tiene
          que ver quien llega. Crece hasta el borde según se baja. */}
      <section className={css.video}>
        <VideoEscala>
          {VIDEO ? (
            <Video src={VIDEO.src} cartel={VIDEO.cartel} />
          ) : (
            <div className={l.videoHueco}>
              <Image src="/trayectoria/sesion-2.webp" alt="" fill className={l.videoFondo} sizes="100vw" />
              <span className={l.videoPlay} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
              <p className={l.videoTexto}>La Técnica Divine, explicada</p>
              <p className={l.videoFino}>Vídeo próximamente</p>
            </div>
          )}
        </VideoEscala>
      </section>

      {/* ================= Cinta ================= */}
      <Cinta fotos={CINTA} />

      {/* ================= Trayectoria ================= */}
      <section className={l.sobre} id="trayectoria">
        <FadeIn className={`${l.esquina} ${l.esqSI}`} delay={0.1} x={-80} y={0} duration={0.9}>
          <Image src="/trayectoria/revista-1.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="210px" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqII}`} delay={0.25} x={-80} y={0} duration={0.9}>
          <Image src="/trayectoria/rostro-1.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="180px" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqSD}`} delay={0.15} x={80} y={0} duration={0.9}>
          <Image src="/trayectoria/equipo.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="210px" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqID}`} delay={0.3} x={80} y={0} duration={0.9}>
          <Image src="/trayectoria/sesion-2.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="220px" />
        </FadeIn>

        <div className={l.sobreTexto}>
          <FadeIn delay={0} y={40}>
            <h2 className={`${l.gigante} ${l.degradado}`}>Sobre mí</h2>
          </FadeIn>
          <TextoRevelado texto={PERFIL.entradilla} className={l.revelado} />
        </div>

        <FadeIn delay={0.2}>
          <BotonBrillo href={WHATSAPP} externo>
            Hablemos
          </BotonBrillo>
        </FadeIn>
      </section>

      {/* Las cifras, en su propia franja: dentro de la sección de las
          esquinas empujaban el titular hacia las fotos. */}
      <section className={l.franja}>
        <ul className={css.cifras}>
          {CIFRAS.map((c, i) => (
            <FadeIn as="li" key={c.texto} delay={i * 0.1} className={css.cifra}>
              <span className={`${css.cifraDato} ${l.degradado}`}>{c.dato}</span>
              <span className={css.cifraTexto}>{c.texto}</span>
            </FadeIn>
          ))}
        </ul>
      </section>

      {/* ================= El método, sobre blanco ================= */}
      <section className={l.blanca} id="metodo">
        <FadeIn y={40}>
          <h2 className={`${l.gigante} ${l.blancaTitulo}`}>El método</h2>
        </FadeIn>
        <ul className={l.lista}>
          {SERVICIOS.map((s, i) => (
            <FadeIn as="li" key={s.nombre} delay={i * 0.1} className={l.item}>
              <span className={l.itemNum}>{String(i + 1).padStart(2, '0')}</span>
              <div className={l.itemCuerpo}>
                <h3 className={l.itemNombre}>{s.nombre}</h3>
                <p className={l.itemTexto}>{s.texto}</p>
              </div>
            </FadeIn>
          ))}
        </ul>
      </section>

      {/* ================= La parte oscura que sube ================= */}
      <section className={l.oscura} id="resultados">
        <FadeIn y={40}>
          <h2 className={`${l.gigante} ${l.degradado}`}>Resultados</h2>
        </FadeIn>

        <Apiladas
          tarjetas={[
            <Carta
              key="facial"
              num="01"
              categoria="Divine Facial"
              nombre="Una sola sesión"
              fotos={[ROSTROS[0], ROSTROS[3], ROSTROS[4]]}
            />,
            <Carta
              key="cuerpo"
              num="02"
              categoria="Corporal"
              nombre="Proceso por sesiones"
              fotos={[CUERPOS[0], CUERPOS[2], CUERPOS[1]]}
            />,
            <Carta
              key="formacion"
              num="03"
              categoria="Formación"
              nombre="Sobre modelo real"
              fotos={['/trayectoria/sesion-1.webp', '/alumnas/manos.webp', '/trayectoria/equipo-2.webp']}
            />,
          ]}
        />

        {/* ---- Galería completa, ampliable ---- */}
        <div className={l.bloque} id="galeria">
          <span className={l.rotulo}>Galería</span>
          <FadeIn y={40}>
            <h2 className={`${l.gigante} ${l.medio} ${l.degradado}`}>Antes y después</h2>
          </FadeIn>
          <div className={css.galeria}>
            <Galeria fotos={ROSTROS} />
          </div>
          <div className={css.galeria}>
            <Galeria fotos={CUERPOS} alto columnas={3} />
          </div>
          <p className={l.avisoFotos}>{AVISO_IMAGENES}</p>
        </div>

        {/* ---- Efectos: el texto que escribió Sorela, tal cual ---- */}
        <div className={l.bloque} id="efectos">
          <span className={l.rotulo}>Efectos y respuesta fisiológica</span>
          <FadeIn y={40}>
            <h2 className={`${l.gigante} ${l.medio} ${l.degradado}`}>Lo que ocurre en el cuerpo</h2>
          </FadeIn>
          {PREAMBULO_EFECTOS.map((p) => (
            <p key={p} className={l.entrada}>
              {p}
            </p>
          ))}
          <ul className={l.cuatro}>
            {EFECTOS.map((g, i) => (
              <FadeIn as="li" key={g.titulo} delay={i * 0.1} className={l.cuatroItem}>
                <h3 className={l.cuatroTitulo}>{g.titulo}</h3>
                <ul className={l.cuatroLista}>
                  {g.puntos.map((p) => (
                    <li key={p} className={l.cuatroPunto}>
                      {p}
                    </li>
                  ))}
                </ul>
              </FadeIn>
            ))}
          </ul>
          <p className={l.nota}>{NOTA_EFECTOS}</p>
        </div>

        {/* ---- Prensa ---- */}
        <div className={l.bloque} id="prensa">
          <span className={l.rotulo}>En prensa</span>
          <FadeIn y={40}>
            <h2 className={`${l.gigante} ${l.medio} ${l.degradado}`}>La técnica del futuro</h2>
          </FadeIn>
          <p className={l.entrada}>Reportajes publicados sobre el método. Toca cualquiera para leerlo.</p>
          <Revista />
        </div>

        {/* ---- Lo que hay montado ---- */}
        <div className={l.bloque} id="estructura">
          <span className={l.rotulo}>No es un curso</span>
          <FadeIn y={40}>
            <h2 className={`${l.gigante} ${l.medio} ${l.degradado}`}>Es una estructura</h2>
          </FadeIn>
          <ul className={css.tres}>
            {ESTRUCTURA.map((e, i) => (
              <FadeIn as="li" key={e.titulo} delay={i * 0.12} className={l.cuatroItem}>
                <h3 className={l.cuatroTitulo}>{e.titulo}</h3>
                <ul className={l.cuatroLista}>
                  {e.items.map((it) => (
                    <li key={it} className={l.cuatroPunto}>
                      {it}
                    </li>
                  ))}
                </ul>
              </FadeIn>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= Cierre ================= */}
      <section className={l.cierre} id="contacto">
        <FadeIn y={40}>
          <h2 className={`${l.gigante} ${l.degradado}`}>Hablemos</h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className={l.cierreTexto}>{CIERRE.parrafos[0]}</p>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className={l.cierreLema}>{CIERRE.lema}</p>
        </FadeIn>
        <FadeIn delay={0.3}>
          <BotonBrillo href={WHATSAPP} externo>
            Escribir a Sorela
          </BotonBrillo>
        </FadeIn>
        <Image src={logo} alt="Sorela Caro · Técnica Divine" className={l.cierreLogo} sizes="150px" />
      </section>

      <footer className={l.pie}>
        <p>
          {PERFIL.nombre} · {PERFIL.oficio}
        </p>
        <a href="https://www.sorelacarodivine.com">sorelacarodivine.com</a>
      </footer>
    </main>
  );
}
