import { MARQUESINA } from '@/lib/contenido';
import css from './Marquesina.module.css';

/**
 * Barra de confianza infinita. La lista va duplicada porque la animación
 * desplaza exactamente la mitad del ancho: así el corte no se ve nunca.
 */
export default function Marquesina() {
  return (
    <section className={css.barra} aria-label="Datos de la formación">
      <div className={css.ventana}>
        <div className={css.tira}>
          {[...MARQUESINA, ...MARQUESINA].map((texto, i) => (
            <span key={i} className={css.item} aria-hidden={i >= MARQUESINA.length}>
              <span className={css.punto} />
              {texto}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
