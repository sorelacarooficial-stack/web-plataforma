import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import retrato from '@/fotos/sorela-retrato.webp';
import corrigiendo from '@/fotos/sorela-corrigiendo.webp';
import alumna from '@/fotos/sorela-alumna.webp';
import valoracion from '@/fotos/valoracion-abdomen.webp';
import css from './sobre.module.css';

export const metadata: Metadata = {
  title: 'Sobre Sorela Caro',
  description:
    'Sorela Caro, creadora de la Técnica Divine. Quince años de cabina, grupos reducidos y ninguna clase delegada.',
};

export default function Sobre() {
  return (
    <main className="pagina">
      <section className={css.cabecera}>
        <div className={`${css.intro} sangrado-izq`}>
          <p className="antetitulo">Sobre</p>
          <h1 className={css.nombre}>Sorela Caro</h1>
          <p className={css.subtitulo}>Creadora de la Técnica Divine.</p>
        </div>
        <div className={css.foto}>
          <Image
            src={retrato}
            alt="Sorela Caro, creadora de la Técnica Divine"
            priority
            sizes="(max-width: 860px) 100vw, 50vw"
            placeholder="blur"
            style={{ objectPosition: '50% 20%' }}
          />
        </div>
      </section>

      <section className="seccion-sm">
        <div className={`wrap wrap-820 ${css.relato}`}>
          <div className="columna" style={{ gap: 20 }}>
            <h2 className="titulo-md">Empecé haciendo lo mismo que todas.</h2>
            <p className={css.parrafo}>
              Aplicaba el protocolo que me habían enseñado. Funcionaba casi siempre. El problema
              era el «casi»: las clientas que no encajaban en el guion y para las que nadie me
              había dado herramientas.
            </p>
            {/* Único hueco de copy pendiente: su historia real, en su voz. */}
            <p className={css.pendiente}>
              Sorela: aquí va tu historia real. Lo de arriba es la estructura. Necesito de ti qué
              te hizo dejar de seguir protocolos y cuándo. Cuanto más concreto, mejor.
            </p>
          </div>

          <div className="columna" style={{ gap: 20 }}>
            <h2 className="titulo-md">Divine nació de ahí.</h2>
            <p className={css.parrafo}>
              De entender que el trabajo importante pasa antes de tocar. De ordenar en un método
              lo que hasta entonces llamaba intuición.
            </p>
          </div>

          <div className={css.tira}>
            <div className="foto foto-11">
              <Image
                src={corrigiendo}
                alt="Sorela Caro guiando las manos de una alumna"
                sizes="(max-width: 700px) 100vw, 260px"
                placeholder="blur"
                style={{ objectPosition: '50% 36%' }}
              />
            </div>
            <div className="foto foto-11">
              <Image
                src={alumna}
                alt="Sorela Caro revisando casos con una alumna"
                sizes="(max-width: 700px) 100vw, 260px"
                placeholder="blur"
                style={{ objectPosition: '58% 36%' }}
              />
            </div>
            <div className="foto foto-11">
              <Image
                src={valoracion}
                alt="Valoración manual del abdomen"
                sizes="(max-width: 700px) 100vw, 260px"
                placeholder="blur"
                style={{ objectPosition: '50% 45%' }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={css.hoy}>
        <div className="wrap">
          <h2 className="titulo-md" style={{ marginBottom: 'clamp(32px,4vw,56px)' }}>
            Hoy formo a terapeutas.
          </h2>
          <div className={css.cifras}>
            {/* Aquí ponía «87 profesionales certificadas» y una lista de
                ciudades —Madrid, Valencia, Sevilla, Bilbao— que venían del
                prototipo y que nadie ha confirmado. Publicar una cifra que no
                se puede sostener es justo lo que no puede hacer una web que
                vive de que se la crean. Vuelven en cuanto Sorela dé las
                reales. */}
            <div className={css.cifra}>
              <p className={css.cifraGrande} data-count="15">
                15
              </p>
              <p className={css.cifraPie}>Años de cabina antes del método</p>
            </div>
            <div className={css.cifra}>
              <p className={css.cifraMedia}>
                Primero online,
                <br />
                después presencial
              </p>
              <p className={css.cifraPie}>Cómo se aprende</p>
            </div>
            <div className={css.cifra}>
              <p className={css.cifraMedia}>Grupos reducidos, ninguna clase delegada</p>
              <p className={css.cifraPie}>Cómo enseño</p>
            </div>
          </div>
        </div>
      </section>

      <section className={css.cierre}>
        <div className="wrap wrap-800">
          <h2 className={css.cierreTitulo}>Si quieres formarte conmigo:</h2>
          <Link href="/formaciones" className="btn">
            Ver formaciones
          </Link>
        </div>
      </section>
    </main>
  );
}
