'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TESTIMONIOS, type Testimonio, type Video } from '@/lib/contenido';
import { urlDeVideo } from '@/lib/youtube';
import { caratulaDeDrive, urlDeDrive, urlDirectaDeDrive } from '@/lib/drive';
import css from './Testimonios.module.css';

/**
 * Lo que dicen las que ya han pasado por aquí: una fila de vídeos que corren
 * en silencio y se abren al pararse encima de uno.
 *
 * CÓMO FUNCIONA. Las tarjetas se deslizan solas con el mismo mecanismo que la
 * barra de la portada (`components/Marquesina.tsx`): la lista va dos veces y la
 * animación desplaza exactamente el ancho de una copia, así que cuando la
 * primera acaba de salir por la izquierda la segunda está justo donde estaba la
 * primera al empezar, y la costura no se ve.
 *
 * Dentro de cada tarjeta el vídeo está puesto y sonando en mudo. Cuando el
 * ratón —o el dedo, o el foco del teclado— se para encima de uno, ese se
 * «abre»: la fila se detiene, el vídeo se desmutea, salen sus controles y
 * vuelve al principio para que se oiga entero desde el segundo cero.
 *
 * DOS COSAS QUE PARECEN DETALLES Y SON LO QUE HACE QUE ESTO NO REVIENTE UN
 * MÓVIL CON DATOS:
 *
 *   1. Solo se reproduce lo que se está viendo. Un IntersectionObserver
 *      arranca y para cada vídeo según entra y sale de la pantalla. Sin eso,
 *      doce vídeos —seis por dos copias— estarían descodificando a la vez,
 *      la mitad de ellos fuera de la vista.
 *   2. El bucle mudo dura unos segundos, no el vídeo entero. Al llegar al
 *      límite vuelve al principio, así que el navegador solo llega a bajar ese
 *      trozo en lugar del archivo completo. Al abrirlo se quita el límite y se
 *      reproduce hasta el final.
 *
 * Y para quien ha pedido que las cosas no se muevan, nada se mueve: ni la fila
 * ni los vídeos, que se quedan en su carátula con un botón, como estaban antes.
 *
 * Cada tarjeta lleva además la frase escrita. No es un resumen: es lo que lee
 * quien no va a pararse en ninguno, y lo que oye quien navega con lector de
 * pantalla y no puede ver el vídeo.
 *
 * Si no hay ninguno, NO se pinta nada. Ni la sección, ni el título, ni un
 * «próximamente». Un apartado de testimonios vacío no es un hueco que rellenar
 * más adelante: es un cartel diciendo que nadie ha dicho nada.
 */

/** Cuántas tarjetas tiene que tener un grupo como mínimo para tapar la vuelta. */
const MINIMO_POR_GRUPO = 4;

/** Segundos que tarda una tarjeta en cruzar. Siete se mira sin agobio. */
const SEGUNDOS_POR_TARJETA = 7;

/**
 * Cuánto dura el bucle mudo antes de volver al principio.
 *
 * Seis segundos es bastante para ver que alguien está hablando y poco para que
 * el navegador se baje medio archivo. No se usa el atributo `loop` a secas
 * porque eso reproduce el vídeo ENTERO y vuelve a empezar: con vídeos de medio
 * minuto y seis tarjetas, eso es la portada bajándose ciento y pico megas.
 */
const SEGUNDOS_DE_BUCLE = 6;

/**
 * Un testimonio está listo cuando tiene vídeo, nombre y frase.
 *
 * Los tres, no dos. En `lib/contenido.ts` puede haber fichas empezadas —el
 * vídeo puesto y el nombre todavía no—, y esas se saltan en vez de salir con
 * un hueco. Una cara sin nombre no es un testimonio: es una foto.
 */
function estaListo(t: Testimonio): boolean {
  return t.nombre.trim().length > 0 && t.frase.trim().length > 0;
}

/** Si el vídeo puede correr solo dentro de la página o hay que ir al visor de fuera. */
function correSolo(v: Video): boolean {
  return v.tipo === 'archivo' || v.tipo === 'drive';
}

export default function Testimonios() {
  /**
   * Cuál está abierto, o ninguno.
   *
   * Se guarda la clave de la TARJETA y no el índice del testimonio: la misma
   * persona aparece dos veces en la fila —la copia de verdad y la que tapa la
   * costura—, y con el índice se abrirían las dos a la vez, una de ellas fuera
   * de la pantalla, sonando sin que se vea de dónde viene.
   */
  const [abierto, setAbierto] = useState<string | null>(null);

  /**
   * Si hay un dedo o un ratón encima de la fila.
   *
   * La parada al pasar el ratón se puede hacer solo con CSS —y así estaba—,
   * pero en un móvil no hay ratón: la tarjeta se está moviendo cuando vas a
   * tocarla, y acabas abriendo la de al lado. `pointerdown` sí llega en los
   * dos sitios, así que en cuanto algo toca la fila, se para.
   */
  const [tocando, setTocando] = useState(false);

  /**
   * Si esta persona ha pedido que las cosas no se muevan.
   *
   * Se mira en el navegador y no con una regla de CSS porque aquí no cambia
   * solo el aspecto: cambia si los vídeos arrancan solos o no, y eso hay que
   * decidirlo en JavaScript. Empieza en `false` y se corrige al montar, así
   * que el servidor y el navegador pintan lo mismo en la primera pasada.
   */
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mirar = () => setQuieto(consulta.matches);
    mirar();
    consulta.addEventListener('change', mirar);
    return () => consulta.removeEventListener('change', mirar);
  }, []);

  const listos = TESTIMONIOS.filter(estaListo);
  if (listos.length === 0) return null;

  const repeticiones = Math.max(1, Math.ceil(MINIMO_POR_GRUPO / listos.length));
  const porGrupo = listos.length * repeticiones;

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
          Sin guion y sin repetir la toma. Párate en una y te la cuenta entera.
        </p>
      </div>

      <div
        className={css.ventana}
        onPointerEnter={() => setTocando(true)}
        onPointerLeave={() => {
          setTocando(false);
          /* Al sacar el ratón de la fila entera se cierra lo que hubiera
             abierto. Sin esto, el vídeo se queda sonando mientras sigues
             bajando por la página y no se ve de dónde viene el ruido. */
          setAbierto(null);
        }}
        /* pointerdown además de enter: en un móvil, `enter` y `down` llegan
           casi a la vez, pero en algunos navegadores el primero se pierde si
           el dedo aterriza ya dentro. */
        onPointerDown={() => setTocando(true)}
      >
        <div
          className={css.tira}
          /* La fila se queda quieta mientras alguien mira: con un vídeo abierto
             —si no, lo que estás oyendo se va por la izquierda mientras lo
             oyes— y mientras haya un dedo o un ratón encima. */
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
                listos.map((t, i) => {
                  const clave = `${copia}-${vez}-${i}`;
                  return (
                    <Tarjeta
                      key={clave}
                      testimonio={t}
                      abierto={abierto === clave}
                      decorativa={copia === 1}
                      quieto={quieto}
                      onAbrir={() => setAbierto(clave)}
                      onCerrar={() => setAbierto((a) => (a === clave ? null : a))}
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
  quieto,
  onAbrir,
  onCerrar,
}: {
  testimonio: Testimonio;
  abierto: boolean;
  decorativa: boolean;
  quieto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const iniciales = inicialesDe(nombre);
  /* Con espacio duro antes del punto: si no, en una pantalla estrecha el
     separador se queda solo al principio de la línea siguiente. */
  const pie = [de, lugar].filter(Boolean).join(' · ');

  /**
   * Si el archivo en crudo no ha podido cargarse.
   *
   * Pasa más de lo que gustaría cuando los vídeos están en Drive: Google corta
   * las descargas enlazadas desde fuera. En ese caso la tarjeta deja de
   * intentar el bucle mudo y se comporta como antes: carátula, botón, y al
   * pulsar el visor de Drive dentro del marco. Se ve el vídeo, que es lo que
   * hay que conseguir.
   */
  const [roto, setRoto] = useState(false);

  const enVivo = correSolo(video) && !quieto && !roto;

  return (
    <figure className={css.tarjeta}>
      <div
        className={css.marco}
        data-abierto={abierto ? '' : undefined}
        /* Pararse encima abre. En un ratón esto llega solo; en una pantalla
           táctil no hay «pararse», y por eso además está el botón de debajo,
           que abre al tocar. */
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') onAbrir();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') onCerrar();
        }}
      >
        <span className={css.respaldo} aria-hidden="true">
          {iniciales}
        </span>

        {enVivo ? (
          <Bucle video={video} abierto={abierto} alFallar={() => setRoto(true)} />
        ) : abierto && !correSolo(video) ? (
          <Externo video={video} nombre={nombre} />
        ) : (
          <Caratula video={video} />
        )}

        {/* El velo y el rótulo desaparecen con el vídeo abierto: ahí ya no hay
            que adivinar de quién es, y tapan la cara justo cuando se está
            mirando. Los controles del vídeo ocupan ese mismo sitio. */}
        {!abierto && (
          <>
            {/* Sin el velo, el nombre en blanco desaparece sobre un fotograma
                claro, y no hay forma de saberlo de antemano porque el fotograma
                lo pone cada vídeo. */}
            <span className={css.velo} aria-hidden="true" />
            <span className={css.rotulo}>
              <span className={css.nombre}>{nombre}</span>
              {pie && <span className={css.detalle}>{pie}</span>}
            </span>
          </>
        )}

        {/* El triángulo solo cuando no hay nada moviéndose: si el vídeo ya está
            corriendo en silencio, un botón de play encima dice una mentira. */}
        {!enVivo && !abierto && (
          <span className={css.play} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="21" height="21">
              <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
            </svg>
          </span>
        )}

        {/*
         * El botón que cubre la tarjeta entera.
         *
         * Existe aunque el ratón ya abra al pasar por encima, y no sobra: en
         * una pantalla táctil no hay «pasar por encima», y quien va con el
         * teclado necesita algo a lo que llegar tabulando. Va por debajo de los
         * controles del vídeo —de ahí que se quite al abrir— para no robarles
         * el clic.
         */}
        {!abierto && (
          <button
            type="button"
            className={css.tocar}
            onClick={onAbrir}
            onFocus={onAbrir}
            tabIndex={decorativa ? -1 : undefined}
            aria-label={`Ver y oír el vídeo de ${nombre}`}
          />
        )}
      </div>

      <figcaption className={css.pie}>
        <span className={css.iniciales} aria-hidden="true">
          {iniciales}
        </span>
        <blockquote className={css.frase}>{frase}</blockquote>
      </figcaption>
    </figure>
  );
}

/**
 * El vídeo que corre en silencio dentro de la tarjeta.
 *
 * Mudo, sin controles y dando vueltas a sus primeros segundos mientras está a
 * la vista. Al abrirse: vuelve al principio, se le quita el silencio, se le
 * quita el límite del bucle y salen sus controles.
 */
function Bucle({
  video,
  abierto,
  alFallar,
}: {
  video: Video;
  abierto: boolean;
  alFallar: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  /** Si está a la vista. Fuera de la pantalla no se reproduce nada. */
  const [alaVista, setAlaVista] = useState(false);

  /*
   * Dos archivos, no uno.
   *
   * Mientras corre en mudo se usa el bucle: unos segundos, sin sonido y en
   * pequeño, unas decenas de kilobytes. Al abrirse se monta el vídeo entero.
   * Si no hay bucle —un vídeo de Drive, o uno propio sin preparar— se usa el
   * completo para las dos cosas: funciona igual, solo que la portada pesa.
   *
   * El cambio de archivo no da salto en pantalla porque la carátula es la
   * misma en los dos, y React vuelve a montar la etiqueta con ella puesta.
   */
  const bucle = video.tipo === 'archivo' ? video.bucle : undefined;
  const entero =
    video.tipo === 'drive'
      ? urlDirectaDeDrive(video.id)
      : video.tipo === 'archivo'
        ? video.src
        : '';
  const src = abierto ? entero : (bucle ?? entero);
  const poster =
    video.tipo === 'drive' ? caratulaDeDrive(video.id) : (video as { poster?: string }).poster;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const vigia = new IntersectionObserver(
      ([e]) => setAlaVista(e.isIntersecting),
      /* Un poco de margen para que el vídeo de la tarjeta que está entrando ya
         esté rodando cuando se le vea, en vez de arrancar a la vista de todos. */
      { rootMargin: '200px', threshold: 0.01 }
    );
    vigia.observe(v);
    return () => vigia.disconnect();
    /*
     * Depende de `src` a propósito, y no es una dependencia de adorno: al
     * abrirse cambia el archivo, y con él la etiqueta <video> entera —lleva
     * `key`—. Sin volver a mirar aquí, el vigía se quedaba observando el
     * elemento viejo, ya desenganchado del documento, que nunca más entra ni
     * sale de la pantalla. Resultado: después de abrir una tarjeta por primera
     * vez, esa tarjeta se quedaba reproduciéndose para siempre, también fuera
     * de la vista. Justo lo que este vigía existe para evitar.
     */
  }, [src]);

  /* Arrancar y parar según entre y salga, y según se abra. */
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!alaVista) {
      v.pause();
      return;
    }
    if (abierto) {
      v.currentTime = 0;
      v.muted = false;
    } else {
      v.muted = true;
    }
    /* Si el navegador dice que no —en un móvil con ahorro de datos puede
       pasar—, no hay nada que avisar: se queda la carátula puesta y el botón
       de debajo sigue funcionando. */
    v.play().catch(() => {});
  }, [alaVista, abierto]);

  /**
   * El bucle corto.
   *
   * Mientras está mudo, al pasar del límite vuelve al principio. Abierto, no:
   * ahí se reproduce hasta el final, que es lo que la persona ha pedido al
   * pararse encima.
   */
  const vigilarElTiempo = useCallback(() => {
    const v = ref.current;
    if (!v || abierto || bucle) return;
    if (v.currentTime > SEGUNDOS_DE_BUCLE) v.currentTime = 0;
  }, [abierto, bucle]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      /* La clave cambia con el archivo para que el navegador vuelva a cargar
         de verdad al pasar del bucle al vídeo entero, en vez de quedarse con
         lo que ya tenía en memoria. */
      key={src}
      ref={ref}
      className={css.reproductor}
      src={src}
      poster={poster}
      muted
      playsInline
      controls={abierto}
      /* Con un bucle aparte —que ya dura solo unos segundos— se repite solo y
         sin costura. Sin él hay que cortar a mano, y eso da un salto visible
         cada vuelta; es el precio de no tener el archivo preparado. */
      loop={!abierto && !!bucle}
      /* `metadata` y no `auto`: se baja lo justo para poder empezar, y el resto
         va llegando según se reproduce. Con `auto` el navegador intentaría
         bajarse los seis archivos enteros nada más abrir la página. */
      preload="metadata"
      onTimeUpdate={vigilarElTiempo}
      onError={alFallar}
      /* Cuando acaba, vuelve al principio y se queda quieto. No se rearranca
         solo: quien lo ha visto entero no quiere que empiece otra vez sin
         haberlo pedido, y el último fotograma congelado parece una avería. */
      onEnded={(e) => {
        e.currentTarget.pause();
        e.currentTarget.currentTime = 0;
      }}
    />
  );
}

/**
 * La imagen de antes de pulsar, para cuando no hay bucle: en YouTube, con el
 * movimiento desactivado, o si el archivo en crudo ha fallado.
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
      : video.tipo === 'drive'
        ? caratulaDeDrive(video.id)
        : video.poster;

  return (
    // Sin next/image a propósito: las de YouTube y las de Drive vienen de fuera
    // y pasarlas por el optimizador obligaría a declarar sus dominios y a que
    // el servidor las descargue; las propias ya van comprimidas desde el
    // script. Si no carga, se esconde y queda el respaldo con las iniciales.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={css.imagen}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
    />
  );
}

/** El marco de fuera: YouTube, o el visor de Drive cuando el archivo ha fallado. */
function Externo({ video, nombre }: { video: Video; nombre: string }) {
  if (video.tipo === 'archivo') return null;

  return (
    <iframe
      className={css.reproductor}
      src={video.tipo === 'youtube' ? urlDeVideo(video.id, { arrancar: true }) : urlDeDrive(video.id)}
      title={`Testimonio de ${nombre}`}
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
