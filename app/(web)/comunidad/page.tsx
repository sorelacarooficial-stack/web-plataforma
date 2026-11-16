import type { Metadata } from 'next';
import Link from 'next/link';
import BotonGrupo from '@/components/BotonGrupo';
import css from './comunidad.module.css';

/**
 * /comunidad, versión provisional (2026-11-15).
 *
 * Fue la landing de la masterclass del 6 de noviembre (repetida el 8). Ya
 * pasó, y la página seguía enseñando la fecha y un formulario cuyo correo de
 * bienvenida todavía dice «el viernes 6 de noviembre» (lib/plantillas-
 * bienvenida.ts lee lib/apertura.ts). Hasta decidir si habrá otra masterclass,
 * aquí no hay fecha ni formulario: se dice la verdad y se da un camino.
 *
 * La versión anterior está en git (antes del commit «Web: sin cuenta atrás
 * pasada ni oferta caducada»), con su vídeo y sus piezas, por si vuelve.
 */
export const metadata: Metadata = {
  title: { absolute: 'Masterclass gratuita · Técnica Divine' },
  description:
    'Masterclass gratuita en directo con Sorela Caro para terapeutas y esteticistas. Entra en el grupo de WhatsApp y te aviso de la próxima.',
};

export default function Comunidad() {
  return (
    <main className="pagina">
      <section className={css.portada}>
        <div className={`wrap ${css.portadaRejilla}`}>
          <div className={css.portadaTexto}>
            <p className={css.fecha}>
              <span>Masterclass gratuita · próxima fecha, pronto</span>
            </p>
            <h1 className={`${css.titulo} degradado-claro`}>
              Antes de <strong>tocar</strong>.
            </h1>
            <p className={css.lede}>
              Una hora en directo, gratis, para terapeutas y esteticistas: qué observar antes de
              empezar, cómo interpretar lo que ves y cómo decidir qué necesita cada cuerpo. La
              última ya fue. Entra en el grupo de WhatsApp y te aviso de la próxima.
            </p>
            <BotonGrupo />
            <p className={css.lede} style={{ marginTop: 24 }}>
              <Link href="/formaciones" className="enlace-fino">
                Ver las formaciones →
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
