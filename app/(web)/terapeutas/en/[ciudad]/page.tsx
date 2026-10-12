import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ExploradorTerapeutas from '@/components/ExploradorTerapeutas';
import { GrafoJsonLd } from '@/components/DatosEstructurados';
import { ciudadesConFichas, fichasDeCiudad } from '@/lib/fichas-publicas';
import type { FichaPublica } from '@/lib/fichas-tipos';
import { IMAGEN_COMPARTIR, OG_BASE, absoluta, nodoMigas, type Miga } from '@/lib/sitio';
import { ciudadesDe, cuantas, enumerar, lugarDe, paraMapa } from '@/lib/terapeutas';
import base from '../../terapeutas.module.css';
import css from './ciudad.module.css';

/**
 * Una ciudad: /terapeutas/en/{ciudad}. Por ejemplo /terapeutas/en/sevilla.
 *
 * Es la página que contesta a «drenaje linfático en Sevilla»: el listado y el
 * globo de esa ciudad, con su propio título, su canónica y sus datos
 * estructurados. Solo existe si hay al menos una terapeuta publicada en ella;
 * si no, 404 (una página de ciudad vacía es contenido fino que Google castiga,
 * y a quien llega le promete algo que no hay).
 *
 * El «en/» del camino es para que una ciudad no choque nunca con el slug de
 * una terapeuta: por eso ningún slug puede ser «en» (RESERVADOS, en
 * lib/fichas-tipos.ts).
 *
 * ISR, como el resto del mapa: se genera la primera vez que alguien la abre,
 * se rehace cada cinco minutos como mucho y al instante cuando cambia una
 * ficha de esa ciudad (lib/fichas.ts llama a revalidatePath).
 */
export const revalidate = 300;

export function generateStaticParams(): { ciudad: string }[] {
  return [];
}

type Props = { params: Promise<{ ciudad: string }> };

/** El nombre, el país y cuántas, de la lista (la forma más repetida de escribirla). */
const datosCiudad = (lista: FichaPublica[]) => ciudadesDe(lista)[0];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad } = await params;
  const lista = await fichasDeCiudad(ciudad);
  const c = datosCiudad(lista);
  if (!c) return { title: 'Ciudad sin terapeutas', robots: { index: false } };

  const una = c.n === 1;
  const titulo = `Técnica Divine en ${c.ciudad}: ${una ? 'terapeuta' : 'terapeutas'} de drenaje linfático manual`;
  const nombres = lista.slice(0, 3).map((t) => t.nombre);
  const descripcion = `${cuantas(c.n)} ${una ? 'certificada' : 'certificadas'} en Técnica Divine en ${lugarDe(c)}: ${enumerar(nombres)}${
    lista.length > 3 ? ' y más' : ''
  }. Mira ${una ? 'su ficha y escríbele' : 'sus fichas y escríbeles'} directamente por WhatsApp o Instagram.`;
  const ruta = `/terapeutas/en/${c.ciudadSlug}`;
  /* Con una sola terapeuta, su foto: es a ella a quien se va a ver. Con
     varias, la imagen de la web; elegir a una sería ponerla delante. */
  const conFoto = una && Boolean(lista[0].foto);
  const imagen = conFoto ? { url: lista[0].foto as string, alt: lista[0].nombre } : IMAGEN_COMPARTIR;

  return {
    title: { absolute: titulo },
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      ...OG_BASE,
      type: 'website',
      url: ruta,
      title: titulo,
      description: descripcion,
      images: [imagen],
    },
    /* Su foto es cuadrada y pequeña (256 px): con la tarjeta grande que pone
       el layout raíz saldría por debajo del mínimo. Como en la ficha. */
    twitter: {
      card: conFoto ? 'summary' : 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: [imagen.url],
    },
  };
}

export default async function PaginaCiudad({ params }: Props) {
  const { ciudad } = await params;
  // Primero si existe (una consulta de esa ciudad); la lista entera, solo si sí.
  const lista = await fichasDeCiudad(ciudad);
  const c = datosCiudad(lista);
  if (!c) notFound();
  const ciudades = await ciudadesConFichas();

  const otrasCiudades = ciudades.filter((x) => x.ciudadSlug !== c.ciudadSlug);
  const ruta = `/terapeutas/en/${c.ciudadSlug}`;

  const migas: Miga[] = [
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Localiza tu terapeuta', ruta: '/terapeutas' },
    { nombre: c.ciudad, ruta },
  ];

  const listaLd = {
    '@type': 'ItemList',
    '@id': `${absoluta(ruta)}#lista`,
    name: `Terapeutas certificadas en Técnica Divine en ${lugarDe(c)}`,
    numberOfItems: lista.length,
    itemListElement: lista.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluta(`/terapeutas/${t.slug}`),
      name: t.nombre,
    })),
  };

  return (
    <main className="pagina">
      <GrafoJsonLd nodos={[listaLd, nodoMigas(migas)]} />

      <nav aria-label="Estás aquí" className={css.migas}>
        <ol className="wrap">
          {migas.map((m, i) => (
            <li key={m.ruta}>
              {i < migas.length - 1 ? (
                <Link href={m.ruta}>{m.nombre}</Link>
              ) : (
                <span aria-current="page">{m.nombre}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <section className={`${base.portada} portada-landing`}>
        <div className="wrap">
          <p className={base.antetitulo}>Localiza tu terapeuta</p>
          <h1 className={`${base.titulo} titulo-xl`}>Técnica Divine en {c.ciudad}</h1>
          <p className="lede">
            {cuantas(c.n)} {c.n === 1 ? 'certificada' : 'certificadas'}
            {c.pais !== 'ES' && c.paisNombre ? ` en ${c.paisNombre}` : ''}.{' '}
            {c.n === 1
              ? 'Mira su ficha y escríbele directamente.'
              : 'Mira sus fichas y escribe directamente a la que te encaje.'}
          </p>
        </div>
      </section>

      <ExploradorTerapeutas terapeutas={lista.map(paraMapa)} ciudad={{ nombre: c.ciudad, slug: c.ciudadSlug }} />

      <section className={css.otras} aria-labelledby="otras-ciudades">
        <div className="wrap">
          <h2 id="otras-ciudades" className={css.otrasTitulo}>
            {otrasCiudades.length ? 'Otras ciudades' : 'Todo el mapa'}
          </h2>
          {otrasCiudades.length > 0 && (
            <ul className={css.chips}>
              {otrasCiudades.map((o) => (
                <li key={o.ciudadSlug}>
                  <Link href={`/terapeutas/en/${o.ciudadSlug}`} className={css.chip}>
                    {lugarDe(o)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/terapeutas" className={css.todas}>
            Ver todas las terapeutas certificadas
          </Link>
        </div>
      </section>
    </main>
  );
}
