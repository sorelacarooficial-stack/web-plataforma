import { TESTIMONIOS, type Testimonio } from '@/lib/contenido';
import css from './Testimonios.module.css';

/**
 * Lo que dicen las que ya han pasado por aquí, deslizándose sin parar.
 *
 * El mecanismo es el mismo que el de la barra de la portada
 * (`components/Marquesina.tsx`), y a propósito: está resuelto, está probado y
 * tener dos maneras distintas de hacer lo mismo en la misma web solo sirve
 * para que un día una de las dos se rompa sola. La lista va dos veces y la
 * animación desplaza exactamente el ancho de una copia, así que cuando la
 * primera acaba de salir por la izquierda la segunda está justo donde estaba
 * la primera al empezar, y la costura no se ve.
 *
 * DOS COSAS QUE AQUÍ NO ESTABAN Y HA HABIDO QUE RESOLVER:
 *
 * 1. Con pocos testimonios, un grupo puede ser más estrecho que la pantalla y
 *    entonces se ve el hueco al dar la vuelta. Por eso cada grupo repite la
 *    lista las veces que hagan falta hasta juntar cuatro tarjetas, que a
 *    cualquier ancho razonable ya cubren de sobra.
 *
 * 2. La velocidad no puede ser fija. Con tres testimonios, treinta segundos
 *    por vuelta es un arrastre; con doce, un borrón. Se calcula a razón de
 *    unos siete segundos por tarjeta, así que la velocidad de lectura es la
 *    misma haya los que haya.
 *
 * Y si no hay ninguno, NO se pinta nada. Ni la sección, ni el título, ni un
 * «próximamente». Un apartado de testimonios vacío no es un hueco que rellenar
 * más adelante: es un cartel diciendo que nadie ha dicho nada.
 */

/** Cuántas tarjetas tiene que tener un grupo como mínimo para tapar la vuelta. */
const MINIMO_POR_GRUPO = 4;

/** Segundos que tarda una tarjeta en cruzar. Siete se lee sin agobio. */
const SEGUNDOS_POR_TARJETA = 7;

export default function Testimonios() {
  if (TESTIMONIOS.length === 0) return null;

  const repeticiones = Math.max(1, Math.ceil(MINIMO_POR_GRUPO / TESTIMONIOS.length));
  const porGrupo = TESTIMONIOS.length * repeticiones;
  const vuelta = `${porGrupo * SEGUNDOS_POR_TARJETA}s`;

  return (
    <section className={css.zona} aria-label="Lo que dicen de la Técnica Divine">
      <div className="wrap">
        <p className="antetitulo" style={{ color: 'var(--azul-ink)' }}>
          Lo que dicen
        </p>
      </div>

      <div className={css.ventana}>
        <div
          className={css.tira}
          /* La duración va por variable y no en la hoja de estilos porque
             depende de cuántos haya, y eso solo se sabe aquí. */
          style={{ ['--vuelta' as string]: vuelta }}
        >
          {[0, 1].map((copia) => (
            /* La segunda copia se le esconde a quien navega con lector de
               pantalla: está para tapar la costura, no para leerla dos veces. */
            <div key={copia} className={css.grupo} aria-hidden={copia === 1}>
              {Array.from({ length: repeticiones }).flatMap((_, vez) =>
                TESTIMONIOS.map((t) => (
                  <Tarjeta key={`${copia}-${vez}-${t.nombre}-${t.frase.slice(0, 12)}`} {...t} />
                ))
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

function Tarjeta({ frase, nombre, lugar, de }: Testimonio) {
  return (
    <figure className={css.tarjeta}>
      <div>
        {/* La comilla de apertura, grande y en oro. Va como decoración y no
            dentro del texto: leída en voz alta no aporta nada. */}
        <span className={css.comilla} aria-hidden="true">
          &ldquo;
        </span>
        <blockquote className={css.frase}>{frase}</blockquote>
      </div>

      <figcaption className={css.pie}>
        <span className={css.iniciales} aria-hidden="true">
          {inicialesDe(nombre)}
        </span>
        <span className={css.quien}>
          <span className={css.nombre}>{nombre}</span>
          {(lugar || de) && (
            /* El separador va pegado a la palabra anterior con un espacio duro:
               si se pone suelto, al partir la línea en un móvil estrecho el
               punto se queda solo abriendo el renglón de abajo. */
            <span className={css.detalle}>{[de, lugar].filter(Boolean).join('\u00A0· ')}</span>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
