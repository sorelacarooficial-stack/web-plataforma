import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import valoracion from '@/fotos/valoracion-abdomen.webp';
import l from '@/components/landing/landing.module.css';
import FadeIn from '@/components/landing/FadeIn';
import css from './metodo.module.css';

/**
 * El título va en `absolute` para esquivar la plantilla «%s · Técnica Divine»
 * del layout raíz: con ella el resultado diría «Técnica Divine» dos veces y se
 * pasaría de los 60 caracteres que Google enseña antes de cortar.
 *
 * Esta página pelea por la búsqueda de marca («técnica divine»), no por
 * «formación drenaje linfático»: de esa se ocupan la portada y /formaciones.
 */
export const metadata: Metadata = {
  title: { absolute: 'Qué es la Técnica Divine y cómo se trabaja en cabina' },
  description:
    'Divine no es una lista de maniobras que repetir: es aprender a observar, interpretar y decidir antes de poner las manos. Te cuento cómo funciona el método.',
};

/* El número de cada paso va con el tono «-ink» del color, no con el color a
   secas, y no es capricho: cada ficha lleva de fondo el tinte de ese mismo
   color, y --arcilla sobre --arcilla-tint se queda en 4,45 a 1, justo por
   debajo del 4,5 que necesita un texto de este tamaño. Los tokens «-ink»
   existen exactamente para esto: el mismo color, dos pasos más oscuro, para
   cuando va encima de su propio tinte. */
const PASOS = [
  {
    n: '01',
    titulo: 'Observar',
    texto:
      'Postura, tejido, retención, temperatura, cómo se sube a la camilla. Aprendes a mirar con criterio, no con intuición.',
    fondo: 'var(--arcilla-tint)',
    color: 'var(--arcilla-ink)',
  },
  {
    n: '02',
    titulo: 'Interpretar',
    texto:
      'Qué significa lo que ves. Qué está pidiendo ese cuerpo, qué puede esperar y qué no conviene tocar hoy.',
    fondo: 'var(--salvia-tint)',
    color: 'var(--salvia-ink)',
  },
  {
    n: '03',
    titulo: 'Decidir',
    texto:
      'Qué haces, en qué orden y hasta dónde. Con una razón que puedes decir en voz alta delante de tu clienta.',
    fondo: 'var(--azul-tint)',
    color: 'var(--azul-ink)',
  },
];

const NOTAN = [
  {
    titulo: 'Tu clienta lo nota',
    texto: 'Porque por fin alguien le explica qué le pasa y qué vais a hacer con eso.',
    color: 'var(--arcilla)',
  },
  {
    titulo: 'Tú lo notas',
    texto: 'Porque dejas de improvisar el día que el caso se sale del guion.',
    color: 'var(--salvia)',
  },
  {
    titulo: 'Tu negocio lo nota',
    texto: 'Porque vendes planes en lugar de sesiones sueltas, y no discutes el precio.',
    color: 'var(--azul)',
  },
];

export default function Metodo() {
  return (
    <main className="pagina">
      <section className={`${css.portada} portada-landing`}>
        <div className="wrap wrap-900">
          <p className="antetitulo" style={{ marginBottom: 20 }}>
            El método
          </p>
          <h1 className="titulo-xl" style={{ marginBottom: 26 }}>
            La Técnica Divine
          </h1>
          <p className="lede">
            Empieza donde terminan los protocolos: en la lectura del cuerpo que tienes delante.
          </p>
        </div>
      </section>

      <section className={css.seccion}>
        <div className="wrap rejilla" style={{ alignItems: 'start' }}>
          <h2 className="titulo-lg">Es un criterio, no una secuencia.</h2>
          <p className="texto max-520" style={{ lineHeight: 1.66 }}>
            Divine no te da una lista de movimientos que repetir. Te enseña a observar,
            interpretar y decidir. El trabajo manual viene después, y es distinto en cada cuerpo
            porque cada cuerpo lo es.
          </p>
        </div>
      </section>

      {/* Los tres pasos en la lista blanca de números enormes de las landings. */}
      <section className={`panel-blanco ${l.blanca}`}>
        <ol className={l.lista}>
          {PASOS.map((p, i) => (
            <FadeIn as="li" key={p.n} delay={i * 0.1} className={l.item}>
              <span className={l.itemNum}>{p.n}</span>
              <div className={l.itemCuerpo}>
                <h3 className={l.itemNombre}>{p.titulo}</h3>
                <p className={l.itemTexto}>{p.texto}</p>
              </div>
            </FadeIn>
          ))}
        </ol>
      </section>

      <section className={`panel-oscuro ${css.banda}`}>
        <Image
          src={valoracion}
          alt="Valoración manual del abdomen"
          sizes="100vw"
          placeholder="blur"
          className={css.bandaFoto}
        />
        <div className={css.bandaVelo} />
        <div className={css.bandaCaja}>
          <h2 className="titulo-lg max-620" style={{ color: 'var(--inverse-ink)' }}>
            La diferencia se nota en la camilla, no en el diploma.
          </h2>
        </div>
      </section>

      <section className={css.seccion}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 'clamp(14px,2vw,22px)' }}>
          {NOTAN.map((n) => (
            <div key={n.titulo} className={`tarjeta ${css.nota}`}>
              <h3 className={css.notaTitulo}>{n.titulo}</h3>
              <p className="texto-fijo">{n.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={css.seccion}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 'clamp(24px,3vw,40px)' }}>
          <div className={`tarjeta ${css.filtro}`}>
            <p className="antetitulo">
              Ven si
            </p>
            <p className={css.filtroTexto}>
              Ya tienes clientas en camilla y te incomoda repetir el mismo protocolo con cuerpos
              que no se parecen en nada.
            </p>
          </div>
          <div className={`tarjeta ${css.filtro}`}>
            <p className="antetitulo" style={{ color: 'var(--muted)' }}>
              No vengas si
            </p>
            <p className={css.filtroTexto} style={{ color: 'var(--ink-3)' }}>
              Es tu primer contacto con la estética. Divine parte de que ya sabes trabajar con las
              manos; si no, vas a perder el dinero.
            </p>
          </div>
        </div>
      </section>

      <section className={css.cierre}>
        <div className="wrap wrap-800">
          <h2 className={`${css.cierreTitulo} degradado`}>El método se aprende haciéndolo.</h2>
          <Link href="/formaciones" className="btn">
            Ver formaciones y fechas
          </Link>
        </div>
      </section>
    </main>
  );
}
