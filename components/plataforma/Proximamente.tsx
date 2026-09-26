import { cursosDe, tieneMembresia, type Acceso } from '@/lib/accesos';
import css from './proximamente.module.css';

/**
 * La portada de quien no es Sorela: qué tiene ya y qué le falta.
 *
 * Antes aquí había ocho apartados llenos de clientas, facturas y citas de
 * mentira. No existía ninguna alumna todavía y la comunidad no se había
 * abierto: enseñar una plataforma llena por dentro era enseñar un decorado.
 *
 * Ahora dice dos cosas distintas según el caso, y las dos son verdad. A quien
 * tiene algo contratado le dice que sus clases y su agenda están abiertas
 * —porque lo están, y las tiene en el menú— y qué falta. A quien todavía no
 * tiene nada le dice que su espacio está en preparación y que se le avisa por
 * correo, sin prometerle la comunidad si no la ha pagado.
 *
 * Cuando una pieza más esté hecha de verdad, se sube a `YA` con `listo: true`.
 */

type Pieza = { titulo: string; texto: string; listo?: boolean };

/**
 * Lo que ya está hecho y se puede usar hoy, esté contratado un curso o la
 * comunidad. Va primero en la lista: quien entra y lee «próximamente» cinco
 * veces seguidas cierra la pestaña sin llegar a ver que tiene dos apartados
 * funcionando en el menú de la izquierda.
 */
const YA: Pieza[] = [
  {
    titulo: 'Tus clases',
    texto: 'Las grabaciones de lo que has contratado, en «Mis clases».',
    listo: true,
  },
  {
    titulo: 'Tu agenda',
    texto: 'Tus sesiones y tus clientas, con calendario. Solo la ves tú.',
    listo: true,
  },
];

const ALUMNA: Pieza[] = [
  {
    titulo: 'El material de la formación',
    texto: 'Lo que traer el primer día y las fichas de valoración, descargables.',
  },
  {
    titulo: 'Tu certificado',
    texto: 'Descargable en cuanto completes la formación.',
  },
  {
    titulo: 'Tus pagos',
    texto: 'La reserva, el pago final y las facturas, en un sitio.',
  },
  {
    titulo: 'La comunidad de terapeutas',
    texto: 'Entras al terminar la formación. Casos reales, resueltos entre todas.',
  },
];

const MIEMBRO: Pieza[] = [
  {
    titulo: 'Clase en vivo al mes',
    texto: 'Con Sorela, sobre casos que traéis vosotras. Queda grabada.',
  },
  {
    titulo: 'Protocolos y fichas',
    texto: 'El material de consulta rápida que usas con la clienta delante.',
  },
  {
    titulo: 'Tu cartera de clientas',
    texto: 'Quién está en plan, cuántas sesiones lleva y cuándo vuelve.',
  },
  {
    titulo: 'Facturación',
    texto: 'Emitir, cobrar y exportar el trimestre para tu asesoría.',
  },
  {
    titulo: 'Tu ficha pública',
    texto: 'Para que quien busque una terapeuta Divine en tu zona te encuentre.',
  },
];

export default function Proximamente({
  accesos,
  nombre,
}: {
  /** Lo que ha contratado. De aquí sale qué se le enseña. */
  accesos: Acceso[];
  nombre?: string;
}) {
  /*
   * Qué se le enseña sale de lo que ha contratado, no de «qué es».
   *
   * Antes esto dependía de un rol —alumna o miembro— y con eso no se podía
   * representar a quien tiene las dos cosas: al marcarla de una manera perdía
   * la otra, y veía media plataforma. Ahora se suman: si hizo un curso ve lo
   * del aula, si paga la comunidad ve lo de la comunidad, y si tiene las dos
   * ve las dos, sin repetir la línea de la comunidad que ya trae el aula.
   */
  const conCurso = cursosDe(accesos).length > 0;
  const conComunidad = tieneMembresia(accesos);
  /* Si ya tiene algo contratado, tiene aula y agenda en el menú de al lado. Eso
     cambia lo que esta pantalla puede decir sin faltar a la verdad: no es que su
     espacio esté cerrado, es que le falta la mitad. */
  const conAcceso = accesos.length > 0;

  const futuras: Pieza[] = conCurso && conComunidad
    ? // La última de ALUMNA es «la comunidad de terapeutas, entras al
      // terminar», y a quien ya está dentro no se le anuncia como futura.
      [...ALUMNA.slice(0, -1), ...MIEMBRO]
    : conComunidad
      ? MIEMBRO
      : ALUMNA;

  const piezas: Pieza[] = conAcceso ? [...YA, ...futuras] : futuras;

  // Quien todavía no tiene nada contratado ve el texto del aula, que es por
  // donde entra todo el mundo. No se le promete la comunidad, que no ha pagado.
  const esAlumna = !conComunidad;
  const pila = (nombre || '').trim().split(/\s+/)[0];

  return (
    <div className={css.envoltura}>
      <section className={css.centro}>
        <span className={css.sello}>
          <span className={css.selloPunto} aria-hidden="true" />
          {conAcceso ? 'Tu espacio, abierto' : 'En preparación'}
        </span>

        <h2 className={css.titulo}>
          {pila ? `${pila}, tu espacio` : 'Tu espacio'}
          <em className={css.tituloEnfasis}>
            {conAcceso ? 'ya está abierto' : 'está a punto'}
          </em>
        </h2>

        <p className={css.entradilla}>
          {conAcceso
            ? /* Con acceso, la pantalla dice dónde ir en vez de pedir que
                 espere: sus clases y su agenda están en el menú, y decirle
                 «estamos terminando» le haría irse sin abrirlos. */
              'Tienes tus clases y tu agenda a la izquierda. El resto —el material descargable, la certificación y la comunidad— lo estamos terminando, y te avisamos por correo en cuanto se abra.'
            : esAlumna
              ? 'Estamos terminando el aula de la formación. Cuando esté abierta te llegará un correo y podrás entrar con esta misma cuenta.'
              : 'Estamos terminando la comunidad de terapeutas. Cuando esté abierta te llegará un correo y podrás entrar con esta misma cuenta.'}
        </p>

        <span className={css.filete} aria-hidden="true" />

        <p className={css.rotulo}>
          {conAcceso ? 'Lo que tienes y lo que falta' : 'Lo que vas a encontrar aquí'}
        </p>

        <ul className={css.lista}>
          {piezas.map((p) => (
            <li key={p.titulo} className={css.item}>
              <span className={css.itemCuerpo}>
                <span className={css.itemTitulo}>{p.titulo}</span>
                <span className={css.itemTexto}>{p.texto}</span>
              </span>
              <span className={css.itemEstado}>{p.listo ? 'Listo' : 'Próximamente'}</span>
            </li>
          ))}
        </ul>

        <p className={css.pie}>
          Mientras tanto, si necesitas algo escribe a{' '}
          <a href="mailto:sorelacarooficial@gmail.com" className={css.enlace}>
            sorelacarooficial@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
