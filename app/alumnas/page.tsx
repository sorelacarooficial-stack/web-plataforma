import type { Metadata } from 'next';
import Image from 'next/image';
import Acuerdo from '@/components/alumnas/Acuerdo';
import AntesDespues from '@/components/alumnas/AntesDespues';
import Evaluacion from '@/components/alumnas/Evaluacion';
import Programa from '@/components/alumnas/Programa';
import { PILARES, QUE_LLEVAS } from '@/lib/precurso';
import css from './alumnas.module.css';

/**
 * La página del Precurso, para alumnas.
 *
 * Vive en `/alumnas` y además se sirve en `alumnas.sorelacarodivine.com`, que
 * la reescribe el middleware. Las dos direcciones enseñan lo mismo a
 * propósito: esconder una solo sirve para que un día nadie sepa por qué da 404.
 *
 * NO LLEVA LA CABECERA NI EL PIE DE LA WEB, y es deliberado: quien llega aquí
 * viene a mirar una formación concreta y, al final, a firmar un documento. Un
 * menú con seis destinos en lo alto es seis maneras de no firmarlo.
 *
 * LO QUE NO ESTÁ EN ESTA PÁGINA: el contenido formativo. La anatomía, el
 * protocolo, las presiones y las maniobras están en el dossier, y el dossier
 * se entrega al firmar el acuerdo de confidencialidad. Publicarlo aquí sería
 * regalar el producto y contradecir el documento que se firma dos secciones
 * más abajo. Ver la cabecera de `lib/precurso.ts`.
 */

export const metadata: Metadata = {
  title: 'Precurso Técnica Divine · Formación para alumnas',
  description:
    'Dos jornadas presenciales con Sorela Caro: lipodrenaje, modelado corporal y Divine Facial. Dossier, práctica con modelos reales y diploma de terapeuta Divine.',
  /* No se indexa. Es la página de quien ya está hablando con Sorela, no una
     puerta de entrada desde una búsqueda; y lleva el acuerdo que se firma. */
  robots: { index: false, follow: false },
};

export default function Alumnas() {
  return (
    <main className={css.pagina}>
      {/* ---------- Portada ---------- */}
      <header className={css.hero}>
        <div className={`wrap ${css.heroCaja}`}>
          <div className={css.heroTexto}>
            <p className={css.sello}>Precurso oficial · plazas limitadas</p>
            <h1 className={css.heroTitulo}>
              Juventud
              <em className={css.heroEnfasis}>linfática</em>
            </h1>
            <p className={css.heroEntradilla}>
              Dos jornadas presenciales con Sorela Caro: lipodrenaje, modelado corporal y Divine
              Facial. Formación limitada, impartida únicamente por la creadora del método.
            </p>
            <div className={css.heroAcciones}>
              <a href="#acuerdo" className={css.heroBoton}>
                Firmar el acuerdo
              </a>
              <a href="#programa" className={css.heroFino}>
                Ver el programa
              </a>
            </div>
          </div>

          <div className={css.heroFoto}>
            <Image
              src="/alumnas/sorela.webp"
              alt="Sorela Caro, creadora de la Técnica Divine"
              width={820}
              height={847}
              priority
              className={css.retrato}
            />
          </div>
        </div>
      </header>

      {/* ---------- Qué es ---------- */}
      <section className={css.seccion}>
        <div className="wrap wrap-1040">
          <p className="antetitulo">El método</p>
          <h2 className={css.titulo}>
            Lo Divine no se improvisa: se siente, se vive y se recuerda.
          </h2>
          <p className={css.entradilla}>
            Un método de drenaje y modelado corporal nacido de más de tres décadas en estética
            avanzada. No es una secuencia cerrada que se aplica igual a todo el mundo: es un orden
            de trabajo que se adapta a cada cuerpo.
          </p>

          <ul className={css.pilares}>
            {PILARES.map((p) => (
              <li key={p.titulo} className={css.pilar}>
                <h3 className={css.pilarTitulo}>{p.titulo}</h3>
                <p className={css.pilarTexto}>{p.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Programa ---------- */}
      <section className={css.seccionOscura} id="programa">
        <div className="wrap wrap-1040">
          <p className="antetitulo" style={{ color: 'var(--accent-inverse)' }}>
            Protocolo de formación
          </p>
          <h2 className={css.tituloClaro}>Dos días. Un método.</h2>
          <p className={css.entradillaClara}>
            Toca cada bloque del horario para ver qué se trabaja. Dossier, evaluación de
            comprensión y práctica con modelos reales, con corrección directa de Sorela.
          </p>
          <Programa />
        </div>
      </section>

      {/* ---------- Evaluación ---------- */}
      <section className={css.seccion}>
        <div className="wrap wrap-1040">
          <p className="antetitulo">Evaluación de comprensión</p>
          <h2 className={css.titulo}>¿Cuánto sabes del sistema linfático?</h2>
          <p className={css.entradilla}>
            Igual que en la formación: responde y comprueba. No hay nota y no se guarda nada.
          </p>
          <Evaluacion />
        </div>
      </section>

      {/* ---------- Antes y después ---------- */}
      <section className={css.seccionSuave}>
        <div className="wrap wrap-1040">
          <p className="antetitulo">Resultado real</p>
          <h2 className={css.titulo}>Antes. Después.</h2>
          <AntesDespues />
        </div>
      </section>

      {/* ---------- Qué te llevas ---------- */}
      <section className={css.seccion}>
        <div className="wrap wrap-1040">
          <p className="antetitulo">Qué te llevas</p>
          <h2 className={css.titulo}>Conviértete en terapeuta Divine.</h2>
          <ul className={css.llevas}>
            {QUE_LLEVAS.map((q) => (
              <li key={q.titulo} className={css.lleva}>
                <h3 className={css.llevaTitulo}>{q.titulo}</h3>
                <p className={css.llevaTexto}>{q.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- El acuerdo ---------- */}
      <section className={css.seccionOscura} id="acuerdo">
        <div className="wrap wrap-820">
          <p className="antetitulo" style={{ color: 'var(--accent-inverse)' }}>
            Paso previo a la formación
          </p>
          <h2 className={css.tituloClaro}>Acuerdo de confidencialidad</h2>
          <p className={css.entradillaClara}>
            Cada alumna firma el acuerdo de confidencialidad y no divulgación de la Técnica Divine
            antes de empezar. Se completa aquí en dos minutos: tus datos, las cláusulas y tu firma.
            Al terminar recibes tu referencia, y Sorela te abre el dossier y tu espacio de alumna.
          </p>
          <div className={css.acuerdoAccion}>
            <Acuerdo />
          </div>
        </div>
      </section>

      <footer className={css.pie}>
        <div className="wrap wrap-1040">
          <p className={css.pieMarca}>Sorela Caro · Formación en estética avanzada</p>
          <p className={css.pieLegal}>
            Formación en técnicas manuales de estética. No sustituye el diagnóstico ni el
            tratamiento médico. Las fotografías de resultados son reales y pueden variar según cada
            persona.
          </p>
        </div>
      </footer>
    </main>
  );
}
