import type { Metadata } from 'next';
import ExploradorTerapeutas from '@/components/ExploradorTerapeutas';
import { GrafoJsonLd } from '@/components/DatosEstructurados';
import { ciudadesConFichas, listarFichasPublicas } from '@/lib/fichas-publicas';
import { IMAGEN_COMPARTIR, OG_BASE, absoluta, nodoMigas } from '@/lib/sitio';
import { ciudadesPorTamano, cuantas, enumerar, paraMapa } from '@/lib/terapeutas';
import css from './terapeutas.module.css';

/**
 * «Localiza tu terapeuta». Es la única página que pelea por la búsqueda de
 * clienta final, no por la de esteticista: quien escribe «drenaje linfático»
 * buscando sesión, no curso.
 *
 * Las fichas salen de Firestore (lib/fichas-publicas). La página se genera una
 * vez y se guarda (ISR): se rehace cada cinco minutos como mucho, y al momento
 * cuando una terapeuta publica, cambia o quita su ficha (lib/fichas.ts llama a
 * revalidatePath). Sin credenciales, por ejemplo al compilar en local, sale
 * con el mapa vacío en vez de romper.
 *
 * El título y la descripción cambian según haya fichas o no. Con fichas, las
 * ciudades entran en el título: es lo que se busca («drenaje linfático en
 * Sevilla»). Sin fichas, nada de ciudades: prometer un listado que no existe
 * hunde la página en cuanto la visitan.
 */
export const revalidate = 300;

const TITULO_BASE = 'Encuentra a tu terapeuta de drenaje linfático manual';

export async function generateMetadata(): Promise<Metadata> {
  const [lista, ciudades] = await Promise.all([listarFichasPublicas(), ciudadesConFichas()]);
  const top = ciudadesPorTamano(ciudades).slice(0, 3).map((c) => c.ciudad);

  /* «Madrid, Sevilla y Bogotá», o «Madrid, Sevilla, Bogotá y más» si hay más. */
  const lugares = ciudades.length > 3 ? `${top.join(', ')} y más` : enumerar(top);
  const una = lista.length === 1;

  const titulo = lista.length ? `Terapeutas de drenaje linfático manual en ${lugares}` : TITULO_BASE;
  const descripcion = lista.length
    ? `${cuantas(lista.length)} ${una ? 'certificada' : 'certificadas'} en Técnica Divine en ${lugares}. Mira ${una ? 'su ficha y escríbele' : 'sus fichas y escríbeles'} directamente por WhatsApp o Instagram.`
    : 'El mapa de las terapeutas certificadas en Técnica Divine. Las primeras están llegando: dime dónde estás y te aviso en cuanto haya una cerca de ti.';

  return {
    title: { absolute: titulo },
    description: descripcion,
    alternates: { canonical: '/terapeutas' },
    openGraph: {
      ...OG_BASE,
      type: 'website',
      url: '/terapeutas',
      title: titulo,
      description: descripcion,
      images: [IMAGEN_COMPARTIR],
    },
  };
}

export default async function Terapeutas() {
  const lista = await listarFichasPublicas();
  const hay = lista.length > 0;

  const migas = [
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Localiza tu terapeuta', ruta: '/terapeutas' },
  ];

  /* La lista, para Google: cada ficha con su dirección. Es el formato de
     «página de resumen» (ItemList con url): le dice qué fichas cuelgan de
     aquí sin repetirlas enteras. Sin fichas no se declara una lista vacía. */
  const listaLd = hay
    ? {
        '@type': 'ItemList',
        '@id': `${absoluta('/terapeutas')}#lista`,
        name: 'Terapeutas certificadas en Técnica Divine',
        numberOfItems: lista.length,
        itemListElement: lista.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absoluta(`/terapeutas/${t.slug}`),
          name: `${t.nombre} · ${t.ciudad}`,
        })),
      }
    : null;

  return (
    <main className="pagina">
      <GrafoJsonLd nodos={[listaLd, nodoMigas(migas)]} />

      <section className={`${css.portada} portada-landing`}>
        <div className="wrap">
          <p className={css.antetitulo}>Terapeutas certificadas en Técnica Divine</p>
          <h1 className={`${css.titulo} titulo-xl`}>Localiza tu terapeuta</h1>
          {/* El texto vale con el mapa lleno y con el mapa vacío: con fichas
              invita a buscar; sin fichas no puede decir «mira quién tienes
              cerca», porque no hay nadie. */}
          <p className="lede">
            {hay
              ? 'Busca tu ciudad, mira su ficha y escríbele directamente. La cita la cierras con ella.'
              : 'Cada terapeuta certificada, con su ficha y su contacto directo. Las primeras están llegando.'}
          </p>
        </div>
      </section>

      <ExploradorTerapeutas terapeutas={lista.map(paraMapa)} />

      <section className={css.pasos} aria-labelledby="como-funciona">
        <div className="wrap">
          <h2 id="como-funciona" className={css.pasosTitulo}>
            Cómo funciona
          </h2>
          <ol className={css.pasosLista}>
            <li>
              <b>Busca tu ciudad</b>
              <span>En el globo, en los filtros o en la lista de ciudades.</span>
            </li>
            <li>
              <b>Mira su ficha</b>
              <span>Cómo trabaja, qué tratamientos hace y dónde está.</span>
            </li>
            <li>
              <b>Escríbele directamente</b>
              <span>Por WhatsApp o Instagram. La cita la cierras con ella, sin intermediarios.</span>
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
