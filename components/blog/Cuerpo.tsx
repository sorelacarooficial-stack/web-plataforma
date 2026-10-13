import { idYoutube, trocear, type Bloque } from '@/lib/blog-tipos';
import VideoYoutube from '@/components/VideoYoutube';
import css from './cuerpo.module.css';

/**
 * El cuerpo de un artículo: sus bloques pintados con la tipografía de la web.
 *
 * Es el mismo componente para la página pública y para la vista previa del
 * editor del panel, así lo que Sorela ve mientras escribe es exactamente lo
 * que se va a publicar.
 */

function Texto({ texto }: { texto: string }) {
  return (
    <>
      {trocear(texto).map((p, i) =>
        p.t === 'negrita' ? (
          <strong key={i}>{p.v}</strong>
        ) : p.t === 'cursiva' ? (
          <em key={i}>{p.v}</em>
        ) : p.t === 'enlace' ? (
          <a key={i} href={p.href} {...(p.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {})}>
            {p.v}
          </a>
        ) : (
          <span key={i}>{p.v}</span>
        )
      )}
    </>
  );
}

export default function Cuerpo({
  bloques,
  capitular = true,
  titulo,
}: {
  bloques: Bloque[];
  capitular?: boolean;
  /** El título del artículo: nombra los vídeos para el lector de pantalla. */
  titulo?: string;
}) {
  const primerParrafo = bloques.findIndex((b) => b.tipo === 'parrafo');
  // «Vídeo» a secas en todos no servía para distinguirlos: van numerados si
  // hay más de uno y con el título del artículo.
  const videos = bloques.flatMap((b, i) => (b.tipo === 'video' ? [i] : []));
  const nombreVideo = (i: number) => {
    const n = videos.length > 1 ? ` ${videos.indexOf(i) + 1}` : '';
    return titulo ? `Vídeo${n} del artículo «${titulo}»` : `Vídeo${n} del artículo`;
  };
  return (
    <div className={css.cuerpo}>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'parrafo':
            if (!b.texto.trim()) return null;
            return (
              <p key={i} className={capitular && i === primerParrafo ? css.capitular : undefined}>
                {b.texto.split('\n').map((linea, j, todas) => (
                  <span key={j}>
                    <Texto texto={linea} />
                    {j < todas.length - 1 && <br />}
                  </span>
                ))}
              </p>
            );
          case 'subtitulo':
            return b.texto.trim() ? <h2 key={i}>{b.texto}</h2> : null;
          case 'cita':
            return b.texto.trim() ? (
              <blockquote key={i}>
                <p>{b.texto}</p>
                {b.autor && <cite>{b.autor}</cite>}
              </blockquote>
            ) : null;
          case 'lista':
            return b.items.some((x) => x.trim()) ? (
              <ul key={i}>
                {b.items
                  .filter((x) => x.trim())
                  .map((x, j) => (
                    <li key={j}>
                      <Texto texto={x} />
                    </li>
                  ))}
              </ul>
            ) : null;
          case 'imagen':
            return b.url ? (
              <figure key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt={b.alt || b.pie || ''} loading="lazy" decoding="async" />
                {b.pie && <figcaption>{b.pie}</figcaption>}
              </figure>
            ) : null;
          case 'video': {
            const id = idYoutube(b.youtube);
            return id ? (
              <div key={i} className={css.video}>
                {/* Hasta que se pulsa, sin nada de YouTube: ver VideoYoutube. */}
                <VideoYoutube src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} titulo={nombreVideo(i)} />
              </div>
            ) : null;
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
