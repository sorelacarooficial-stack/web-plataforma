import type { Metadata } from 'next';
import Image from 'next/image';
import logo from '@/fotos/logo-sorela.png';
import Acuerdo from '@/components/alumnas/Acuerdo';
import Anatomia from '@/components/alumnas/Anatomia';
import AntesDespues from '@/components/alumnas/AntesDespues';
import Evaluacion from '@/components/alumnas/Evaluacion';
import Programa from '@/components/alumnas/Programa';
import Apiladas from '@/components/landing/Apiladas';
import { BotonBrillo, BotonContorno } from '@/components/landing/Botones';
import Cinta from '@/components/landing/Cinta';
import FadeIn from '@/components/landing/FadeIn';
import Magnet from '@/components/landing/Magnet';
import TextoRevelado from '@/components/landing/TextoRevelado';
import Galeria from '@/components/presentacion/Galeria';
import { CINTA_ALUMNAS, METODO_TEXTO, PILARES, QUE_LLEVAS, RESULTADOS } from '@/lib/precurso';
import l from '@/components/landing/landing.module.css';

/**
 * La página del Precurso, para alumnas.
 *
 * Vive en `/alumnas` y además se sirve en `alumnas.sorelacarodivine.com`, que
 * la reescribe el middleware.
 *
 * CÓMO ESTÁ HECHA. Con el mismo sistema que la presentación profesional
 * —`components/landing/`—: portada con el titular a todo lo ancho y el retrato
 * que sigue al ratón, cinta de fotos que se mueve con el scroll, texto que se
 * enciende al leerlo, lista con números enormes sobre blanco, tarjetas que se
 * apilan. Los componentes interactivos que ya tenía —horario, láminas, test,
 * antes y después— se quedan, y se ven en oscuro porque la hoja de la landing
 * les redefine los colores.
 *
 * TODO EMPUJA A UN SITIO: firmar el acuerdo. Es la única llamada principal y
 * aparece tres veces: en la portada, a mitad y al final.
 *
 * LO QUE NO ESTÁ EN ESTA PÁGINA: el protocolo. Las presiones, los tiempos y
 * las maniobras están en el dossier, que llega al firmar. Ver la cabecera de
 * `lib/precurso.ts`.
 */

export const metadata: Metadata = {
  title: 'Precurso Técnica Divine · Juventud linfática',
  description:
    'Dos jornadas presenciales con Sorela Caro: lipodrenaje, modelado corporal y Divine Facial. Dossier, práctica con modelos reales y diploma de terapeuta Divine.',
  robots: { index: false, follow: false },
};

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
        <BotonContorno href="#galeria">Ver resultados</BotonContorno>
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

export default function Alumnas() {
  return (
    <main className={l.pagina}>
      {/* ================= Portada ================= */}
      <header className={l.hero} style={{ ['--hero-talla' as string]: '17vw' }}>
        <FadeIn as="nav" y={-20} delay={0} className={l.nav}>
          <Image src={logo} alt="Sorela Caro · Técnica Divine" className={l.navLogo} priority sizes="130px" />
          <a href="#metodo">Método</a>
          <a href="#programa">Programa</a>
          <a href="#anatomia">Anatomía</a>
          <a href="#acuerdo">Acuerdo</a>
        </FadeIn>

        <div className={l.heroTituloCaja}>
          <FadeIn delay={0.15} y={40}>
            <h1 className={`${l.heroTitulo} ${l.degradado}`}>Precurso</h1>
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
              alt="Sorela Caro, creadora de la Técnica Divine"
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
            <p className={l.heroLema}>
              Juventud linfática: dos jornadas presenciales con la creadora del método
            </p>
          </FadeIn>
          <FadeIn delay={0.5} y={20}>
            <BotonBrillo href="#acuerdo">Firmar el acuerdo</BotonBrillo>
          </FadeIn>
        </div>
      </header>

      {/* ================= Cinta ================= */}
      <Cinta fotos={CINTA_ALUMNAS} />

      {/* ================= El método =================
          En las esquinas, resultados. Las láminas de anatomía van SOLO en su
          sección: aquí se vende lo que consiguen las manos, no se estudia. */}
      <section className={l.sobre} id="metodo">
        <FadeIn className={`${l.esquina} ${l.esqSI}`} delay={0.1} x={-80} y={0} duration={0.9}>
          <Image src="/trayectoria/rostro-3.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="210px" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqII}`} delay={0.25} x={-80} y={0} duration={0.9}>
          <Image src="/alumnas/resultado-2.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="180px" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqSD}`} delay={0.15} x={80} y={0} duration={0.9}>
          <Image src="/trayectoria/rostro-5.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="210px" />
        </FadeIn>
        <FadeIn className={`${l.esquina} ${l.esqID}`} delay={0.3} x={80} y={0} duration={0.9}>
          <Image src="/alumnas/resultado-4.webp" alt="" width={300} height={375} className={l.esquinaFoto} sizes="220px" />
        </FadeIn>

        <div className={l.sobreTexto}>
          <FadeIn delay={0} y={40}>
            <h2 className={`${l.gigante} ${l.degradado}`}>El método</h2>
          </FadeIn>
          <TextoRevelado texto={METODO_TEXTO} className={l.revelado} />
        </div>

        <FadeIn delay={0.2}>
          <BotonBrillo href="#acuerdo">Quiero mi plaza</BotonBrillo>
        </FadeIn>
      </section>

      {/* Los tres pilares, en su propia franja. Dentro de la sección de las
          esquinas empujaban el titular hacia arriba y las láminas le tapaban
          las letras. */}
      <section className={l.franja}>
        <ul className={l.tres}>
          {PILARES.map((p, i) => (
            <FadeIn as="li" key={p.titulo} delay={i * 0.12} className={l.cuatroItem}>
              <h3 className={l.cuatroTitulo}>{p.titulo}</h3>
              <p className={l.tresTexto}>{p.texto}</p>
            </FadeIn>
          ))}
        </ul>
      </section>

      {/* ================= Lo que te llevas, sobre blanco ================= */}
      <section className={l.blanca}>
        <FadeIn y={40}>
          <h2 className={`${l.gigante} ${l.blancaTitulo}`}>Te llevas</h2>
        </FadeIn>
        <ul className={l.lista}>
          {QUE_LLEVAS.map((q, i) => (
            <FadeIn as="li" key={q.titulo} delay={i * 0.1} className={l.item}>
              <span className={l.itemNum}>{String(i + 1).padStart(2, '0')}</span>
              <div className={l.itemCuerpo}>
                <h3 className={l.itemNombre}>{q.titulo}</h3>
                <p className={l.itemTexto}>{q.texto}</p>
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
              key="abdomen"
              num="01"
              categoria="Corporal"
              nombre="Abdomen y flancos"
              fotos={['/alumnas/resultado-2.webp', '/alumnas/resultado-1.webp', '/alumnas/resultado-3.webp']}
            />,
            <Carta
              key="piernas"
              num="02"
              categoria="Corporal"
              nombre="Piernas y glúteos"
              fotos={['/alumnas/abdomen-2.webp', '/alumnas/resultado-5.webp', '/alumnas/resultado-4.webp']}
            />,
            <Carta
              key="facial"
              num="03"
              categoria="Divine Facial"
              nombre="Una sola sesión"
              fotos={['/trayectoria/rostro-2.webp', '/trayectoria/rostro-6.webp', '/trayectoria/rostro-4.webp']}
            />,
          ]}
        />

        {/* ---- El horario, interactivo ---- */}
        <div className={l.bloque} id="programa">
          <span className={l.rotulo}>Protocolo de formación</span>
          <FadeIn y={40}>
            <h2 className={`${l.gigante} ${l.medio} ${l.degradado}`}>Dos días. Un método.</h2>
          </FadeIn>
          <p className={l.entrada}>
            Toca cada bloque del horario para ver qué se trabaja. Práctica con modelos reales y
            corrección directa de Sorela.
          </p>
          <div className={l.interactivo}>
            <Programa />
          </div>
        </div>

        {/* ---- Las láminas, interactivas ---- */}
        <div className={l.bloque} id="anatomia">
          <span className={l.rotulo}>Lo que hay que saber</span>
          <FadeIn y={40}>
            <h2 className={`${l.gigante} ${l.medio} ${l.degradado}`}>Anatomía</h2>
          </FadeIn>
          <p className={l.entrada}>
            El sistema linfático, lámina a lámina. El protocolo —presiones, tiempos y maniobras—
            está en el dossier, detrás del acuerdo.
          </p>
          <div className={l.interactivo}>
            <Anatomia />
          </div>
        </div>

        {/* ---- Antes y después + galería ---- */}
        <div className={l.bloque} id="galeria">
          <span className={l.rotulo}>Resultado real</span>
          <FadeIn y={40}>
            <h2 className={`${l.gigante} ${l.medio} ${l.degradado}`}>Antes. Después.</h2>
          </FadeIn>
          <p className={l.entrada}>Arrastra la línea para comparar.</p>
          <div className={l.interactivo}>
            <AntesDespues />
          </div>
          <div className={l.interactivo}>
            <Galeria fotos={RESULTADOS} alto columnas={3} />
          </div>
          <p className={l.avisoFotos}>
            Imágenes reales de clientas, cedidas con su autorización. Los resultados dependen de
            cada persona, de su punto de partida y del número de sesiones.
          </p>
        </div>

        {/* ---- El test ---- */}
        <div className={l.bloque} id="test">
          <span className={l.rotulo}>Evaluación de comprensión</span>
          <FadeIn y={40}>
            <h2 className={`${l.gigante} ${l.medio} ${l.degradado}`}>¿Cuánto sabes?</h2>
          </FadeIn>
          <p className={l.entrada}>
            Igual que en la formación: responde y comprueba. No hay nota y no se guarda nada.
          </p>
          <div className={l.interactivo}>
            <Evaluacion />
          </div>
        </div>
      </section>

      {/* ================= El acuerdo, sobre papel =================
          Fondo claro a propósito: la firma se dibuja en tinta oscura, y sobre
          negro no se vería. */}
      <section className={l.claro} id="acuerdo">
        <FadeIn y={40}>
          <h2 className={`${l.gigante} ${l.medio}`} style={{ color: '#141210' }}>
            Firma y empieza
          </h2>
        </FadeIn>
        <p className={l.claroTexto}>
          Cada alumna firma el acuerdo de confidencialidad antes de empezar. Son dos minutos: tus
          datos, las cláusulas y tu firma. Al terminar abres tu dossier en el momento y te llega
          también por correo.
        </p>
        <Acuerdo />
      </section>

      <footer className={l.pie}>
        <p>Sorela Caro · Formación en estética avanzada</p>
        <p>
          Formación en técnicas manuales de estética. No sustituye el diagnóstico ni el tratamiento
          médico.
        </p>
      </footer>
    </main>
  );
}
