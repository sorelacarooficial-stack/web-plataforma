import { MARQUESINA } from '@/lib/contenido';
import css from './Marquesina.module.css';

/**
 * Barra de confianza que se desliza sin parar.
 *
 * La lista va dos veces, y la animación desplaza exactamente el ancho de una
 * copia: cuando la primera termina de salir por la izquierda, la segunda está
 * justo donde estaba la primera al empezar, y el salto atrás no se ve.
 *
 * Que las dos copias vayan cada una en su propio `<div>` no es un capricho: es
 * lo que hace que el truco funcione. Antes los diez trozos colgaban directos de
 * la tira, que además llevaba un margen a la izquierda para alinearse con el
 * resto de la página; ese margen entra en el ancho, así que el 50% que se
 * desplazaba no era el ancho de una copia sino el de una copia más medio
 * margen, y cada vuelta daba un salto. Con los dos grupos, el 50% es el ancho
 * de un grupo por definición, mida lo que mida el texto.
 */
export default function Marquesina() {
  return (
    <section className={css.barra} aria-label="Datos de la formación">
      <div className={css.ventana}>
        <div className={css.tira}>
          {/* La segunda copia se le esconde a quien navega con lector de
              pantalla: está para tapar la costura, no para leerla dos veces. */}
          {[0, 1].map((copia) => (
            <div key={copia} className={css.grupo} aria-hidden={copia === 1}>
              {MARQUESINA.map((texto) => (
                <span key={texto} className={css.item}>
                  <span className={css.punto} />
                  {texto}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
