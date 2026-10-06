import type { Metadata } from 'next';
import Image from 'next/image';
import logo from '@/fotos/logo-sorela.png';
import Galeria from '@/components/presentacion/Galeria';
import {
  AVISO_IMAGENES,
  CIERRE,
  CIFRAS,
  CUERPOS,
  EFECTOS,
  ESTRUCTURA,
  METODO,
  NOTA_EFECTOS,
  PERFIL,
  PREAMBULO_EFECTOS,
  PRENSA,
  ROSTROS,
  VIDEO,
} from '@/lib/presentacion';
import css from './presentacion.module.css';

/**
 * La presentación profesional de Sorela Caro.
 *
 * Vive en `/presentacion` y se sirve además en
 * `presentacion.sorelacarodivine.com`, que reescribe el middleware.
 *
 * PARA QUIÉN ES. Para quien se plantea representarla, distribuir el método o
 * trabajar con la marca. No es una página de venta a alumnas: no hay precios,
 * no hay cuenta atrás y no se pide el correo a nadie. Lo que tiene que hacer
 * es que alguien que no la conoce de nada entienda en tres minutos quién es,
 * qué ha construido y qué hay montado alrededor.
 *
 * POR QUÉ EMPIEZA EN OSCURO. El resto de la web es papel crema, que es cálido
 * y funciona para quien ya está dentro. Esto se abre en negro con la foto a
 * sangre porque la primera pantalla se la juega entera en tres segundos con
 * alguien que la está mirando desde el móvil mientras hace otra cosa.
 *
 * NO SE INDEXA. Se manda por enlace a quien tenga que verla.
 */

export const metadata: Metadata = {
  title: 'Sorela Caro · Técnica Divine · Presentación profesional',
  description:
    'Treinta años en estética avanzada y un método propio: la Técnica Divine. Trayectoria, metodología, resultados y estructura de formación.',
  robots: { index: false, follow: false },
};

export default function Presentacion() {
  return (
    <main className={css.pagina}>
      {/* ================= Portada ================= */}
      <header className={css.hero}>
        <div className={css.heroFoto}>
          <Image
            src="/trayectoria/sorela.webp"
            alt="Sorela Caro"
            width={1100}
            height={1650}
            className={css.retrato}
            priority
            sizes="(max-width: 860px) 100vw, 46vw"
          />
        </div>

        <div className={`wrap ${css.heroCaja}`}>
          <div className={css.heroTexto}>
            {/* El logotipo oficial, el mismo archivo que la cabecera de la web.
                Es dorado sobre transparente, así que sobre el negro del hero
                va tal cual, sin filtro. */}
            <Image src={logo} alt="Sorela Caro · Técnica Divine" className={css.marca} priority sizes="210px" />
            <p className={css.sello}>Presentación profesional</p>
            <h1 className={css.heroTitulo}>
              {PERFIL.nombre}
              <em className={css.heroEnfasis}>Técnica Divine</em>
            </h1>
            <p className={css.heroLema}>{PERFIL.titular}</p>
            <p className={css.heroEntradilla}>{PERFIL.entradilla}</p>
          </div>
        </div>
      </header>

      {/* ================= El vídeo =================
          El hueco se enseña aunque todavía no haya vídeo: así se ve dónde va a
          ir y la página no cambia de forma el día que se suba. */}
      <section className={css.seccionVideo} id="video">
        <div className="wrap">
          <p className={css.rotulo}>La técnica, explicada</p>
          <div className={css.video}>
            {VIDEO ? (
              <video
                className={css.videoReal}
                src={VIDEO.src}
                poster={VIDEO.cartel}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <div className={css.videoHueco}>
                <span className={css.videoIcono} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
                <p className={css.videoTexto}>Vídeo de presentación</p>
                <p className={css.videoFino}>Aquí va el vídeo horizontal con la técnica explicada.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= Cifras ================= */}
      <section className={css.cifras}>
        <ul className={`wrap ${css.cifrasLista}`}>
          {CIFRAS.map((c) => (
            <li key={c.texto} className={css.cifra}>
              <span className={css.cifraDato}>{c.dato}</span>
              <span className={css.cifraTexto}>{c.texto}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ================= El método ================= */}
      <section className={css.seccion} id="metodo">
        <div className="wrap">
          <p className={css.rotulo}>El método</p>
          <h2 className={css.titulo}>
            El arte del drenaje y el <em>modelado corporal</em>
          </h2>

          <div className={css.metodo}>
            <ul className={css.metodoLista}>
              {METODO.map((m) => (
                <li key={m.titulo} className={css.metodoItem}>
                  <h3 className={css.metodoTitulo}>{m.titulo}</h3>
                  <p className={css.metodoTexto}>{m.texto}</p>
                </li>
              ))}
            </ul>

            <figure className={css.metodoFoto}>
              <Image
                src="/trayectoria/sesion-1.webp"
                alt="Sesión de Técnica Divine"
                width={1000}
                height={1333}
                className={css.metodoImagen}
                sizes="(max-width: 860px) 100vw, 40vw"
              />
            </figure>
          </div>
        </div>
      </section>

      {/* ================= Efectos ================= */}
      <section className={css.seccionClara} id="efectos">
        <div className="wrap">
          <p className={css.rotulo}>Efectos y respuesta fisiológica</p>
          <h2 className={css.titulo}>
            Lo que ocurre en el <em>cuerpo</em>
          </h2>

          <div className={css.preambulo}>
            {PREAMBULO_EFECTOS.map((p) => (
              <p key={p} className={css.preambuloTexto}>
                {p}
              </p>
            ))}
          </div>

          <ul className={css.efectos}>
            {EFECTOS.map((g) => (
              <li key={g.titulo} className={css.efecto}>
                <h3 className={css.efectoTitulo}>{g.titulo}</h3>
                <ul className={css.efectoPuntos}>
                  {g.puntos.map((p) => (
                    <li key={p} className={css.efectoPunto}>
                      {p}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <p className={css.nota}>{NOTA_EFECTOS}</p>
        </div>
      </section>

      {/* ================= Resultados ================= */}
      <section className={css.seccion} id="resultados">
        <div className="wrap">
          <p className={css.rotulo}>Resultados</p>
          <h2 className={css.titulo}>
            Una sesión. <em>Las mismas manos.</em>
          </h2>
          <p className={css.entradilla}>
            Antes y después de una sola sesión de Técnica Divine Facial.
          </p>

          <Galeria fotos={ROSTROS} />

          <h3 className={css.subtitulo}>Corporal</h3>
          <p className={css.entradilla}>
            Procesos de varias sesiones sobre abdomen, flancos y piernas.
          </p>

          <Galeria fotos={CUERPOS} alto columnas={3} />

          <p className={css.aviso}>{AVISO_IMAGENES}</p>
        </div>
      </section>

      {/* ================= Prensa ================= */}
      <section className={css.seccionClara} id="prensa">
        <div className="wrap">
          <p className={css.rotulo}>En prensa</p>
          <h2 className={css.titulo}>
            «La técnica del futuro <em>en estética»</em>
          </h2>

          <p className={css.entradilla}>
            Reportajes publicados sobre el método. Toca cualquiera para leerlo.
          </p>

          <Galeria fotos={PRENSA} alto columnas={3} />
        </div>
      </section>

      {/* ================= Estructura ================= */}
      <section className={css.seccion} id="estructura">
        <div className="wrap">
          <p className={css.rotulo}>Lo que hay montado</p>
          <h2 className={css.titulo}>
            No es un curso. Es una <em>estructura</em>
          </h2>

          <ul className={css.estructura}>
            {ESTRUCTURA.map((e) => (
              <li key={e.titulo} className={css.bloque}>
                <h3 className={css.bloqueTitulo}>{e.titulo}</h3>
                <ul className={css.bloqueLista}>
                  {e.items.map((i) => (
                    <li key={i} className={css.bloqueItem}>
                      {i}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <figure className={css.equipo}>
            <Image
              src="/trayectoria/equipo-2.webp"
              alt="El equipo de Técnica Divine"
              width={1200}
              height={700}
              className={css.equipoFoto}
              sizes="100vw"
            />
          </figure>
        </div>
      </section>

      {/* ================= Cierre ================= */}
      <section className={css.cierre}>
        <div className="wrap">
          <h2 className={css.cierreTitulo}>{CIERRE.titulo}</h2>
          {CIERRE.parrafos.map((p) => (
            <p key={p} className={css.cierreTexto}>
              {p}
            </p>
          ))}
          <p className={css.lema}>{CIERRE.lema}</p>
          <p className={css.remate}>{CIERRE.remate}</p>
        </div>
      </section>

      <footer className={css.pie}>
        <div className={`wrap ${css.pieCaja}`}>
          <Image src={logo} alt="Sorela Caro · Técnica Divine" className={css.pieLogo} sizes="150px" />
          <p className={css.pieMarca}>
            {PERFIL.nombre} · {PERFIL.oficio}
          </p>
          <a className={css.pieEnlace} href="https://www.sorelacarodivine.com">
            sorelacarodivine.com
          </a>
        </div>
      </footer>
    </main>
  );
}
