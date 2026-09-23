import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import valoracion from '@/fotos/valoracion-abdomen.webp';
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

const PASOS = [
  {
    n: '01',
    titulo: 'Observar',
    texto:
      'Postura, tejido, retención, temperatura, cómo se sube a la camilla. Aprendes a mirar con criterio, no con intuición.',
    fondo: 'var(--arcilla-tint)',
    color: 'var(--arcilla)',
  },
  {
    n: '02',
    titulo: 'Interpretar',
    texto:
      'Qué significa lo que ves. Qué está pidiendo ese cuerpo, qué puede esperar y qué no conviene tocar hoy.',
    fondo: 'var(--salvia-tint)',
    color: 'var(--salvia)',
  },
  {
    n: '03',
    titulo: 'Decidir',
    texto:
      'Qué haces, en qué orden y hasta dónde. Con una razón que puedes decir en voz alta delante de tu clienta.',
    fondo: 'var(--azul-tint)',
    color: 'var(--azul)',
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
      <section className={css.portada}>
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

      <section className={css.pasos}>
        <div className="wrap columna" style={{ gap: 'clamp(20px,2.6vw,28px)' }}>
          {PASOS.map((p) => (
            <article key={p.n} className={css.paso} style={{ background: p.fondo }}>
              <div className={css.pasoCabeza}>
                <span className={css.pasoNum} style={{ color: p.color }}>
                  {p.n}
                </span>
                <h3 className={css.pasoTitulo}>{p.titulo}</h3>
              </div>
              <p className="texto max-520" style={{ lineHeight: 1.66 }}>
                {p.texto}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={css.banda}>
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

      <section className={`${css.seccion} superficie`}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 'clamp(28px,4vw,56px)' }}>
          {NOTAN.map((n) => (
            <div key={n.titulo} className={css.nota} style={{ borderTop: `2px solid ${n.color}` }}>
              <h3 className={css.notaTitulo}>{n.titulo}</h3>
              <p className="texto-fijo">{n.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={css.seccion}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 'clamp(24px,3vw,40px)' }}>
          <div className={css.filtro} style={{ background: 'var(--surface)', border: '1px solid var(--salvia-line)' }}>
            <p className="antetitulo" style={{ color: 'var(--salvia)' }}>
              Ven si
            </p>
            <p className={css.filtroTexto}>
              Ya tienes clientas en camilla y te incomoda repetir el mismo protocolo con cuerpos
              que no se parecen en nada.
            </p>
          </div>
          <div className={css.filtro} style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)' }}>
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
          <h2 className={css.cierreTitulo}>El método se aprende haciéndolo.</h2>
          <Link href="/formaciones" className="btn">
            Ver formaciones y fechas
          </Link>
        </div>
      </section>
    </main>
  );
}
