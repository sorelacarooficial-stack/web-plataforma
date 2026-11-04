import css from './comunidadhomologadas.module.css';

/**
 * «Comunidad» para quien todavía no tiene la membresía.
 *
 * Sustituye a la lista de espera de la masterclass (ComunidadProximamente),
 * que ya no toca: la Comunidad Divine es solo para terapeutas homologadas por
 * Sorela, es decir, quien ha hecho la formación completa de 3 días. A ellas se
 * les presenta en una sesión privada. Aquí no se enseña lo que hay dentro ni
 * el precio: el espacio no se muestra a quien no lo tiene.
 */
export default function ComunidadHomologadas({ nombre }: { nombre: string | null }) {
  const pila = nombre?.trim().split(/\s+/)[0];
  return (
    <section className={css.caja}>
      <p className={css.eyebrow}>Comunidad Divine®</p>
      <h1 className={css.titulo}>
        Solo para terapeutas <strong>homologadas</strong>
      </h1>
      <p className={css.texto}>
        {pila ? `${pila}, la` : 'La'} Comunidad Divine® es el espacio de las terapeutas homologadas por Sorela Caro: quienes han hecho la{' '}
        <b>formación completa de 3 días</b> de la Técnica Divine®.
      </p>
      <p className={css.texto}>
        Cuando completes tu formación y te homologues, Sorela te la presenta en una sesión privada y se abre aquí, en tu
        plataforma.
      </p>
    </section>
  );
}
