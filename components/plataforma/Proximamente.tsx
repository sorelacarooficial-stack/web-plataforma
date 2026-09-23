import css from './proximamente.module.css';

/**
 * Lo que ven alumnas y miembros mientras su espacio se termina de construir.
 *
 * Antes aquí había ocho apartados llenos de clientas, facturas y citas de
 * mentira. No existe ninguna alumna todavía y la comunidad no se ha abierto:
 * enseñar una plataforma llena por dentro sería enseñar un decorado.
 *
 * Así que se dice lo que es —está en preparación— y se dice bien: qué va a
 * haber dentro, y que se avisa por correo cuando se abra. Cuando cada pieza
 * esté hecha de verdad, se cambia su estado aquí y se vuelve a enrutar su
 * vista, que sigue escrita en `Vistas.tsx`.
 */

type Pieza = { titulo: string; texto: string; listo?: boolean };

const ALUMNA: Pieza[] = [
  {
    titulo: 'El aula de tu formación',
    texto: 'Lo que traer el primer día, las fichas de valoración y las grabaciones de repaso.',
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
    titulo: 'Tus clientas y tu agenda',
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
  rol,
  nombre,
}: {
  rol: 'alumna' | 'miembro';
  nombre?: string;
}) {
  const esAlumna = rol === 'alumna';
  const piezas = esAlumna ? ALUMNA : MIEMBRO;
  const pila = (nombre || '').trim().split(/\s+/)[0];

  return (
    <div className={css.envoltura}>
      <section className={css.centro}>
        <span className={css.sello}>
          <span className={css.selloPunto} aria-hidden="true" />
          En preparación
        </span>

        <h2 className={css.titulo}>
          {pila ? `${pila}, tu espacio` : 'Tu espacio'}
          <em className={css.tituloEnfasis}>está a punto</em>
        </h2>

        <p className={css.entradilla}>
          {esAlumna
            ? 'Estamos terminando el aula de la formación. Cuando esté abierta te llegará un correo y podrás entrar con esta misma cuenta.'
            : 'Estamos terminando la comunidad de terapeutas. Cuando esté abierta te llegará un correo y podrás entrar con esta misma cuenta.'}
        </p>

        <span className={css.filete} aria-hidden="true" />

        <p className={css.rotulo}>Lo que vas a encontrar aquí</p>

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
