'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TESTIMONIOS, type Testimonio, type Video } from '@/lib/contenido';
import { urlDeVideo } from '@/lib/youtube';
import { caratulaDeDrive, urlDeDrive, urlDirectaDeDrive } from '@/lib/drive';
import css from './Testimonios.module.css';

/**
 * Lo que dicen las que ya han pasado por aquí: los vídeos puestos, corriendo
 * en silencio, y se abren con sonido al pararse en uno.
 *
 * ESTO YA NO SE DESLIZA SOLO, y el cambio no es de gusto. Una fila que se
 * mueve sola obliga a perseguir la tarjeta que quieres mirar: justo cuando vas
 * a tocarla, se ha ido. En un teléfono es peor, porque además compite con el
 * dedo que está haciendo scroll. Ahora:
 *
 *   · En pantalla ancha, una rejilla. Se ven las tres de una vez, quietas.
 *   · En pantalla estrecha, una fila que arrastras tú, con parada en cada
 *     tarjeta. Se mueve cuando tú la mueves y se queda donde la dejas.
 *
 * Lo que sí se mantiene: los vídeos corren en silencio y se abren con sonido
 * al pararse encima —o al tocarlos—, que es lo que se pidió desde el principio.
 *
 * NINGÚN VÍDEO ENTERO SE BAJA HASTA QUE ALGUIEN LO PIDE. Lo que corre es un
 * bucle de unos segundos, sin sonido y en pequeño, de unas decenas de
 * kilobytes. El archivo completo se monta al abrir la tarjeta.
 *
 * Cada tarjeta lleva además la frase escrita: es lo que lee quien no va a
 * abrir ninguna, y lo que oye quien navega con lector de pantalla.
 *
 * Y si no hay ninguno, NO se pinta nada. Ni la sección, ni el título. Un
 * apartado de testimonios vacío es un cartel diciendo que nadie ha dicho nada.
 */

/** Cuánto dura el bucle mudo antes de volver al principio, en segundos. */
const SEGUNDOS_DE_BUCLE = 6;

/**
 * Un testimonio está listo cuando tiene vídeo, nombre y frase.
 *
 * Los tres, no dos. En `lib/contenido.ts` puede haber fichas empezadas —el
 * vídeo puesto y el nombre todavía no— y esas se saltan en vez de salir con un
 * hueco. Una cara sin nombre no es un testimonio: es una foto.
 */
function estaListo(t: Testimonio): boolean {
  return t.nombre.trim().length > 0 && t.frase.trim().length > 0;
}

/** Si el vídeo puede correr dentro de la página o hay que ir al visor de fuera. */
function correSolo(v: Video): boolean {
  return v.tipo === 'archivo' || v.tipo === 'drive';
}

export default function Testimonios() {
  /** Cuál está abierto, por su posición en la lista. O ninguno. */
  const [abierto, setAbierto] = useState<number | null>(null);

  /**
   * Si esta persona ha pedido que las cosas no se muevan.
   *
   * Se mira en el navegador y no con una regla de CSS porque aquí no cambia
   * solo el aspecto: cambia si los vídeos arrancan solos o no, y eso se decide
   * en JavaScript. Empieza en `false` y se corrige al montar, así que el
   * servidor y el navegador pintan lo mismo en la primera pasada.
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

  return (
    <section className={css.zona} aria-label="Lo que dicen de la Técnica Divine">
      <div className="wrap">
        <div className={css.cabeza}>
          <p className="antetitulo" style={{ color: 'var(--azul-ink)' }}>
            Lo que dicen
          </p>
          {/* El titular es una pregunta corta y no un «Testimonios»: la palabra
              «testimonios» avisa de que lo que viene está elegido para
              convencer, y se lee con esa reserva puesta. */}
          <h2 className={`titulo-sm ${css.titulo}`}>Se lo pregunté a ellas.</h2>
          <p className={css.entradilla}>
            Sin guion y sin repetir la toma. Toca una y te la cuenta entera.
          </p>
        </div>

        {/*
         * En ancho es una rejilla y en estrecho una fila que se arrastra. Lo
         * decide el CSS con la misma marca, así que no hay dos listas ni dos
         * componentes: es la misma, colocada de dos maneras.
         */}
        <ul
          className={css.lista}
          /* Al sacar el ratón de la lista entera se cierra lo que hubiera
             abierto: si no, el vídeo se queda sonando mientras sigues bajando
             por la página y no se ve de dónde viene el ruido. */
          onPointerLeave={() => setAbierto(null)}
        >
          {listos.map((t, i) => (
            <li key={`${t.nombre}-${i}`} className={css.celda}>
              <Tarjeta
                testimonio={t}
                abierto={abierto === i}
                quieto={quieto}
                onAbrir={() => setAbierto(i)}
                onCerrar={() => setAbierto((a) => (a === i ? null : a))}
              />
            </li>
          ))}
        </ul>
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
  quieto,
  onAbrir,
  onCerrar,
}: {
  testimonio: Testimonio;
  abierto: boolean;
  quieto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const iniciales = inicialesDe(nombre);
  /* Con espacio duro antes del punto: si no, en una pantalla estrecha el
     separador se queda solo al principio de la línea siguiente. */
  const pie = [de, lugar].filter(Boolean).join(' · ');

  /**
   * Si el archivo no ha podido cargarse.
   *
   * Pasa cuando los vídeos están en Drive, que corta las descargas enlazadas
   * desde fuera. En ese caso la tarjeta deja de intentar el bucle y se comporta
   * como antes: carátula, botón, y al pulsar el visor dentro del marco.
   */
  const [roto, setRoto] = useState(false);

  const enVivo = correSolo(video) && !quieto && !roto;

  return (
    <figure className={css.tarjeta}>
      <div
        className={css.marco}
        data-abierto={abierto ? '' : undefined}
        /* Pararse encima abre, con el ratón. En una pantalla táctil no existe
           «pararse», y por eso además está el botón de debajo, que abre al
           tocar. */
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
         * Existe aunque el ratón ya abra al pasar por encima: en una pantalla
         * táctil no hay «pasar por encima», y quien va con el teclado necesita
         * algo a lo que llegar tabulando. Se quita al abrir para no robarle el
         * clic a los controles del vídeo.
         */}
        {!abierto && (
          <button
            type="button"
            className={css.tocar}
            onClick={onAbrir}
            onFocus={onAbrir}
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
 * la vista. Al abrirse: vuelve al principio, se le quita el silencio y salen
 * sus controles.
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
      /* Un poco de margen para que el vídeo ya esté rodando cuando se le vea,
         en vez de arrancar a la vista de todos. */
      { rootMargin: '200px', threshold: 0.01 }
    );
    vigia.observe(v);
    return () => vigia.disconnect();
    /*
     * Depende de `src` a propósito: al abrirse cambia el archivo, y con él la
     * etiqueta <video> entera —lleva `key`—. Sin volver a mirar aquí, el vigía
     * se quedaba observando el elemento viejo, ya desenganchado del documento,
     * que nunca más entra ni sale de la pantalla. Resultado: después de abrir
     * una tarjeta una vez, esa tarjeta se reproducía para siempre, también
     * fuera de la vista. Justo lo que este vigía existe para evitar.
     */
  }, [src]);

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
   * El bucle corto, para cuando no hay un archivo de bucle aparte.
   *
   * Mientras está mudo, al pasar del límite vuelve al principio. Abierto, no:
   * ahí se reproduce hasta el final, que es lo que la persona ha pedido.
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
         va llegando según se reproduce. */
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
 * movimiento desactivado, o si el archivo ha fallado.
 *
 * De YouTube se pide `hqdefault`, que existe siempre. Las otras —maxres, sd—
 * no las tienen todos los vídeos, y cuando faltan YouTube devuelve una imagen
 * gris de 120×90 que se estira hasta ocupar la tarjeta entera.
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
