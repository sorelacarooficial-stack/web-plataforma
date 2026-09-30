'use client';

import { useEffect, useRef, useState } from 'react';
import { TESTIMONIOS, type Testimonio, type Video } from '@/lib/contenido';
import { urlDeVideo } from '@/lib/youtube';
import css from './Testimonios.module.css';

/**
 * Lo que dicen las que ya han pasado por aquí, en vídeo y deslizándose solo.
 *
 * El mecanismo del movimiento es el mismo que el de la barra de la portada
 * (`components/Marquesina.tsx`), y a propósito: está resuelto, está probado y
 * tener dos maneras distintas de hacer lo mismo en la misma web solo sirve
 * para que un día una de las dos se rompa sola. La lista va dos veces y la
 * animación desplaza exactamente el ancho de una copia, así que cuando la
 * primera acaba de salir por la izquierda la segunda está justo donde estaba
 * la primera al empezar, y la costura no se ve.
 *
 * NINGÚN VÍDEO SE CARGA HASTA QUE ALGUIEN LO PIDE. Lo que se ve es la carátula
 * —una imagen— y un botón. El reproductor se monta al pulsar. Seis vídeos
 * cargándose a la vez en la portada la harían inservible en un móvil con datos,
 * y la mayoría de quien pasa por aquí no le va a dar al play a ninguno.
 *
 * Por eso cada tarjeta lleva además la frase escrita: es lo que lee quien no
 * va a pulsar, que son casi todos. Sin ella, esto sería una fila de caras con
 * un triángulo encima que no cuenta nada.
 *
 * Y si no hay ninguno, NO se pinta nada. Ni la sección, ni el título, ni un
 * «próximamente». Un apartado de testimonios vacío no es un hueco que rellenar
 * más adelante: es un cartel diciendo que nadie ha dicho nada.
 */

/** Cuántas tarjetas tiene que tener un grupo como mínimo para tapar la vuelta. */
const MINIMO_POR_GRUPO = 4;

/** Segundos que tarda una tarjeta en cruzar. Siete se mira sin agobio. */
const SEGUNDOS_POR_TARJETA = 7;

export default function Testimonios() {
  /**
   * Cuál se está viendo, o ninguno.
   *
   * Se guarda la clave de la TARJETA y no el índice del testimonio: la misma
   * persona aparece dos veces en la tira —la copia de verdad y la que tapa la
   * costura—, y con el índice se abrirían las dos a la vez, una de ellas fuera
   * de la pantalla, sonando sin que se vea de dónde viene.
   */
  const [abierto, setAbierto] = useState<string | null>(null);

  /**
   * Si hay un dedo o un ratón encima.
   *
   * La parada al pasar el ratón se puede hacer solo con CSS —y así estaba—,
   * pero en un móvil no hay ratón: la tarjeta se está moviendo cuando vas a
   * tocarla, y acabas abriendo la de al lado. `pointerdown` sí llega en los
   * dos sitios, así que en cuanto algo toca la tira, se para.
   */
  const [tocando, setTocando] = useState(false);

  if (TESTIMONIOS.length === 0) return null;

  const repeticiones = Math.max(1, Math.ceil(MINIMO_POR_GRUPO / TESTIMONIOS.length));
  const porGrupo = TESTIMONIOS.length * repeticiones;

  return (
    <section className={css.zona} aria-label="Lo que dicen de la Técnica Divine">
      <div className={`wrap ${css.cabeza}`}>
        <p className="antetitulo" style={{ color: 'var(--azul-ink)' }}>
          Lo que dicen
        </p>
        {/* El titular es una pregunta corta y no un «Testimonios»: la palabra
            «testimonios» avisa de que lo que viene está elegido para convencer,
            y se lee con esa reserva puesta. */}
        <h2 className={`titulo-sm ${css.titulo}`}>Se lo pregunté a ellas.</h2>
        <p className={css.entradilla}>
          Sin guion y sin repetir la toma. Toca para oírlas.
        </p>
      </div>

      <div
        className={css.ventana}
        onPointerEnter={() => setTocando(true)}
        onPointerLeave={() => setTocando(false)}
        /* pointerdown además de enter: en un móvil, `enter` y `down` llegan
           casi a la vez, pero en algunos navegadores el primero se pierde si
           el dedo aterriza ya dentro. */
        onPointerDown={() => setTocando(true)}
      >
        <div
          className={css.tira}
          /* La tira se queda quieta mientras alguien mira: con un vídeo puesto
             —si no, lo que estás viendo se va por la izquierda mientras lo
             ves— y mientras haya un dedo o un ratón encima. */
          data-quieto={abierto || tocando ? '' : undefined}
          /* La duración va por variable y no en la hoja de estilos porque
             depende de cuántos haya, y eso solo se sabe aquí. */
          style={{ ['--vuelta' as string]: `${porGrupo * SEGUNDOS_POR_TARJETA}s` }}
        >
          {[0, 1].map((copia) => (
            /*
             * La segunda copia se le esconde a quien navega con lector de
             * pantalla: está para tapar la costura, no para leerla dos veces.
             * Sus botones llevan además tabIndex -1 —lo pone `Tarjeta` con
             * `decorativa`— porque dejar algo enfocable dentro de un
             * aria-hidden hace que el foco caiga en un sitio que no se anuncia:
             * quien va con el teclado se queda sin saber dónde está. Con el
             * ratón sí se pueden pulsar, que se ven igual que las otras.
             */
            <div key={copia} className={css.grupo} aria-hidden={copia === 1}>
              {Array.from({ length: repeticiones }).flatMap((_, vez) =>
                TESTIMONIOS.map((t, i) => {
                  const clave = `${copia}-${vez}-${i}`;
                  return (
                    <Tarjeta
                      key={clave}
                      testimonio={t}
                      abierto={abierto === clave}
                      decorativa={copia === 1}
                      onAbrir={() => setAbierto(clave)}
                      onCerrar={() => setAbierto(null)}
                    />
                  );
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Las iniciales de un nombre: «María José Pardo» → «MJ». */
function inicialesDe(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase() || '·'
  );
}

function Tarjeta({
  testimonio: { nombre, frase, lugar, de, video },
  abierto,
  decorativa,
  onAbrir,
  onCerrar,
}: {
  testimonio: Testimonio;
  abierto: boolean;
  decorativa: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const pie = [de, lugar].filter(Boolean).join(' · ');

  return (
    <figure className={css.tarjeta}>
      <div className={css.marco}>
        {abierto ? (
          <Reproductor video={video} nombre={nombre} onCerrar={onCerrar} />
        ) : (
          <button
            type="button"
            className={css.portada}
            onClick={onAbrir}
            tabIndex={decorativa ? -1 : undefined}
            aria-label={`Ver el vídeo de ${nombre}`}
          >
            <Caratula video={video} />
            {/* El velo oscuro de abajo: sin él, el nombre en blanco desaparece
                sobre una carátula clara y no hay forma de saberlo de antemano,
                porque las carátulas las pone cada vídeo. */}
            <span className={css.velo} aria-hidden="true" />
            <span className={css.play} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
              </svg>
            </span>
            <span className={css.rotulo}>
              <span className={css.nombre}>{nombre}</span>
              {pie && <span className={css.detalle}>{pie}</span>}
            </span>
          </button>
        )}
      </div>

      <figcaption className={css.pie}>
        <span className={css.iniciales} aria-hidden="true">
          {inicialesDe(nombre)}
        </span>
        <blockquote className={css.frase}>{frase}</blockquote>
      </figcaption>
    </figure>
  );
}

/**
 * La imagen de antes de pulsar.
 *
 * De YouTube se pide la versión `hqdefault`, que existe siempre. Las otras
 * —maxres, sd— no las tienen todos los vídeos, y cuando faltan YouTube
 * devuelve una imagen gris de 120×90 que se estira hasta ocupar la tarjeta
 * entera y queda horrible sin que nada avise.
 */
function Caratula({ video }: { video: Video }) {
  const src =
    video.tipo === 'youtube'
      ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
      : video.poster;

  return (
    // Sin next/image a propósito: las de YouTube vienen de fuera y pasarlas por
    // el optimizador obligaría a declarar su dominio y a que el servidor las
    // descargue; las propias ya van comprimidas desde el script.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={css.imagen}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      /* Si la carátula no carga, se esconde y queda el fondo oscuro con el
         nombre encima. Un icono de imagen rota sería peor. */
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
    />
  );
}

/** Lo que se monta al pulsar, según de dónde salga el vídeo. */
function Reproductor({
  video,
  nombre,
  onCerrar,
}: {
  video: Video;
  nombre: string;
  onCerrar: () => void;
}) {
  const reproductor = useRef<HTMLVideoElement>(null);

  /*
   * Se le pide que arranque desde aquí, y no con el atributo `autoplay`.
   *
   * Con el atributo, en iOS el vídeo con sonido se queda parado sin decir nada:
   * allí la reproducción tiene que salir de un gesto de la persona, y montar
   * una etiqueta que ya viene con autoplay no siempre cuenta como tal. Pidiendo
   * el play a mano justo después del clic, la cadena del gesto se conserva.
   *
   * Y si aun así el navegador dice que no, no pasa nada ni hay que avisar de
   * nada: el reproductor lleva sus controles y la carátula puesta, así que lo
   * único que cambia es que hay que darle al triángulo una vez más.
   */
  useEffect(() => {
    reproductor.current?.play().catch(() => {});
  }, []);

  return (
    <>
      {video.tipo === 'youtube' ? (
        <iframe
          className={css.reproductor}
          src={urlDeVideo(video.id, { arrancar: true })}
          title={`Testimonio de ${nombre}`}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={reproductor}
          className={css.reproductor}
          src={video.src}
          poster={video.poster}
          controls
          playsInline
          /* Aquí es donde empieza la descarga: antes de pulsar no se ha bajado
             ni un byte de vídeo, solo la carátula. */
          preload="auto"
        />
      )}

      <button type="button" className={css.cerrar} onClick={onCerrar} aria-label="Cerrar el vídeo">
        <svg width="13" height="13" viewBox="0 0 15 15" aria-hidden="true">
          <path
            d="M1 1l13 13M14 1L1 14"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </>
  );
}
