import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import { BECA } from '@/lib/clase';
import { WHATSAPP_SORELA } from '@/lib/contenido';
import css from '@/components/medellin/medellin.module.css';

/**
 * Landing de la formación presencial en Medellín (28-30 de enero de 2027).
 *
 * OCULTA mientras Sorela no confirme precios (2026-11-19): no sale en el menú,
 * ni en el pie, ni en el sitemap, y no se indexa. Con `MEDELLIN_CLAVE` (o, si
 * no está, `CLASE_CLAVE`) en Vercel solo se abre con `?k=<clave>`. Sin precio
 * en ningún sitio: el botón abre WhatsApp con el mensaje escrito.
 *
 * Los vídeos salen de videos-medellin/ (Remotion) y viven en public/medellin/.
 */

export const metadata: Metadata = {
  title: 'Formación presencial en Medellín',
  description: 'Tres días con Sorela Caro, creadora de la Técnica Divine®. Medellín, 28, 29 y 30 de enero. Solo 10 plazas.',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: '#17140f' };

export const dynamic = 'force-dynamic';

const MENSAJE = `Hola, quiero reservar mi plaza en la formación presencial de Medellín (${BECA.fechas}). ¿Me contáis cómo hacerlo?`;
const WHATSAPP = `https://wa.me/${WHATSAPP_SORELA.replace(/\D/g, '')}?text=${encodeURIComponent(MENSAJE)}`;

/** En la web, el nombre de la marca en español (en lib/clase.ts la certificación sale como «Technique Divine®»). */
const INCLUYE = BECA.incluye.map((i) => i.replace('Technique Divine', 'Técnica Divine'));

const DIAS = [
  { n: '01', titulo: 'Leer el cuerpo', texto: 'Observar antes de tocar. La valoración, la estimulación ganglionar y la secuencia de desbloqueo.' },
  { n: '02', titulo: 'Tonificación y moldeo', texto: 'Ritmo, velocidad y arrastre. Cuerpo completo, con Sorela corrigiendo tus manos sobre la camilla.' },
  { n: '03', titulo: 'Facial, brazos y certificación', texto: 'El protocolo facial y de brazos, práctica supervisada y tu certificación Técnica Divine®.' },
];

const PREGUNTAS = [
  {
    p: '¿Para quién es esta formación?',
    r: 'Para profesionales de la estética y el bienestar que ya trabajan con las manos y quieren un método propio, con criterio. Si empiezas de cero, escríbenos y te orientamos.',
  },
  { p: '¿Dónde es exactamente?', r: 'En Medellín. La dirección del espacio se envía a cada alumna al confirmar su plaza.' },
  { p: '¿Qué incluye?', r: `${INCLUYE.join(', ')}.` },
  { p: '¿Por qué solo 10 plazas?', r: 'Porque Sorela corrige las manos de cada alumna, una a una. Con más gente, eso no se puede hacer bien.' },
  { p: '¿Cómo reservo mi plaza?', r: 'Escríbenos por WhatsApp con el botón de esta página. El equipo te cuenta las condiciones y cómo apartar tu plaza.' },
];

function Boton({ claro }: { claro?: boolean }) {
  return (
    <a className={claro ? css.botonClaro : css.boton} href={WHATSAPP} target="_blank" rel="noopener noreferrer">
      Reservar mi plaza
    </a>
  );
}

function Fechas() {
  return (
    <div className={css.fechas}>
      {['28', '29', '30'].map((d, i) => (
        <div key={d} className={css.fecha}>
          <b>ENE</b>
          <span>{d}</span>
          <small>DÍA {i + 1}</small>
        </div>
      ))}
    </div>
  );
}

export default async function Medellin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const clave = process.env.MEDELLIN_CLAVE || process.env.CLASE_CLAVE;
  const k = typeof q.k === 'string' ? q.k : '';

  if (clave && k !== clave) {
    return (
      <main className={css.cerrado}>
        <p>Esta página se abre con su enlace.</p>
      </main>
    );
  }

  return (
    <main className={css.pagina}>
      {/* ── Portada ── */}
      <section className={css.portada}>
        <div className={css.portadaTexto}>
          <p className={css.ante}>Formación presencial · Medellín</p>
          <h1 className={css.titular}>
            Aprende la Técnica Divine® <strong className={css.oro}>con su creadora</strong>.
          </h1>
          <p className={css.entrada}>
            Tres días con Sorela Caro, corrigiendo tus manos una a una. {BECA.fechas[0].toUpperCase() + BECA.fechas.slice(1)} de 2027.
          </p>
          <Fechas />
          <div className={css.accion}>
            <Boton />
            <span className={css.plazasMini}>Solo {BECA.plazas} plazas</span>
          </div>
        </div>
        <div className={css.marcoVideo}>
          <video className={css.videoAncho} src="/medellin/landing-16x9.mp4" poster="/medellin/landing-16x9.jpg" autoPlay muted loop playsInline preload="metadata" />
          <video className={css.videoAlto} src="/medellin/landing-9x16.mp4" poster="/medellin/landing-9x16.jpg" autoPlay muted loop playsInline preload="metadata" />
        </div>
      </section>

      {/* ── Quién es Sorela ── */}
      <section className={css.sorela}>
        <div className={css.sorelaFoto}>
          <Image src="/medellin/sorela-retrato.webp" alt="Sorela Caro, creadora de la Técnica Divine" fill sizes="(max-width: 900px) 100vw, 45vw" />
        </div>
        <div className={css.sorelaTexto}>
          <p className={css.anteOro}>Quién te enseña</p>
          <h2 className={css.h2}>
            Sorela Caro. <strong>Creó el método.</strong> Ahora lo enseña en persona.
          </h2>
          <p className={css.parrafo}>
            Treinta años con las manos en el cuerpo y más de 25.000 casos. La Técnica Divine® nace de esa práctica: observar antes de tocar,
            entender qué pide cada cuerpo y trabajar con ritmo, criterio y respeto.
          </p>
          <div className={css.cifras}>
            <div>
              <b>30</b>
              <span>años de práctica</span>
            </div>
            <div>
              <b>+25.000</b>
              <span>casos</span>
            </div>
            <div>
              <b>1</b>
              <span>método propio</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Qué aprendes ── */}
      <section className={css.dias}>
        <p className={css.anteOro}>Qué aprendes</p>
        <h2 className={css.h2}>
          Tres días. <strong>Un método completo.</strong>
        </h2>
        <div className={css.tarjetas}>
          {DIAS.map((d) => (
            <article key={d.n} className={css.tarjeta}>
              <span className={css.numero}>Día {d.n}</span>
              <h3>{d.titulo}</h3>
              <p>{d.texto}</p>
            </article>
          ))}
        </div>
        <ul className={css.incluye}>
          {INCLUYE.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>

      {/* ── Fechas y plazas ── */}
      <section className={css.plazas}>
        <p className={css.anteClaro}>Medellín · enero de 2027</p>
        <h2 className={css.h2Claro}>
          Solo <strong className={css.oro}>{BECA.plazas} plazas</strong>. Ni una más.
        </h2>
        <p className={css.parrafoClaro}>Porque aquí no eres una más: Sorela te mira trabajar y te corrige, una a una.</p>
        <Fechas />
        <div className={css.asientos} aria-label={`${BECA.plazas} plazas`}>
          {Array.from({ length: BECA.plazas }).map((_, i) => (
            <span key={i}>{String(i + 1).padStart(2, '0')}</span>
          ))}
        </div>
        <Boton claro />
      </section>

      {/* ── Preguntas ── */}
      <section className={css.preguntas}>
        <h2 className={css.h2}>
          Preguntas <strong>frecuentes</strong>
        </h2>
        {PREGUNTAS.map((x) => (
          <details key={x.p} className={css.pregunta}>
            <summary>{x.p}</summary>
            <p>{x.r}</p>
          </details>
        ))}
      </section>

      {/* ── Cierre ── */}
      <section className={css.cierre}>
        <Image src="/medellin/logo-oro.webp" alt="Sorela Caro · Técnica Divine" width={505} height={270} className={css.logo} />
        <h2 className={css.h2Claro}>
          Medellín · <strong className={css.oro}>28, 29 y 30 de enero</strong>
        </h2>
        <Boton claro />
        <p className={css.nota}>Te contestamos por WhatsApp.</p>
      </section>
    </main>
  );
}
