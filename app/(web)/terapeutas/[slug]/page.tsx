import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GrafoJsonLd } from '@/components/DatosEstructurados';
import { TarjetaTerapeuta } from '@/components/ExploradorTerapeutas';
import { fichaPublica, fichasDeCiudad } from '@/lib/fichas-publicas';
import { enlaceWhatsapp, type FichaPublica } from '@/lib/fichas-tipos';
import { ID_WEB, IMAGEN_COMPARTIR, OG_BASE, REF_NEGOCIO, absoluta, nodoMigas, type Miga, type Nodo } from '@/lib/sitio';
import { lugarDe, nombreCorto, paraMapa } from '@/lib/terapeutas';
import css from './terapeuta.module.css';

/**
 * La ficha pública de una terapeuta: /terapeutas/{slug}.
 *
 * Es la página que le trae clientas desde Google («drenaje linfático en
 * Getafe», o su propio nombre) y la que ella comparte. Por eso:
 *  - Se genera la primera vez que alguien la abre y se guarda (ISR). Se rehace
 *    cada cinco minutos como mucho, y al instante cuando ella cambia su ficha
 *    (lib/fichas.ts llama a revalidatePath). `generateStaticParams` devuelve
 *    una lista vacía a propósito: no se genera ninguna al compilar, pero la
 *    ruta queda estática en vez de leer Firestore en cada visita.
 *  - Título, descripción, canónica y foto de compartir son suyos, no los de
 *    la web: al pegar el enlace por WhatsApp sale ELLA.
 *  - Datos estructurados: la persona (con su certificación, reconocida por el
 *    negocio de Sorela), dónde trabaja y las migas.
 *
 * Lo que NO hay, y no es un olvido:
 *  - Ni formulario de reserva ni «te lo confirma por correo»: aquí las citas
 *    van directas, por su WhatsApp o su Instagram. Un formulario que acababa
 *    en el buzón de Sorela prometía algo que no pasaba.
 *  - Ni foto de archivo: o su foto real, o sus iniciales. Una foto de stock
 *    con «Sesión en la consulta de María» es una foto que no es de María.
 *  - Ni teléfono en los datos estructurados, ni valoraciones, ni precios.
 */
export const revalidate = 300;

export function generateStaticParams(): { slug: string }[] {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

/** Termina en punto si no termina ya en algo. Las frases las escribe cada una. */
const conPunto = (s: string) => (/[.!?…»"”)]$/.test(s) ? s : `${s}.`);

/** Recorta en la última palabra entera antes del límite. */
function recortar(s: string, max: number) {
  if (s.length <= max) return s;
  const corte = s.slice(0, max - 1);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}

const tituloDe = (t: FichaPublica) => `${t.nombre} · Terapeuta de Técnica Divine en ${t.ciudad}`;

function descripcionDe(t: FichaPublica) {
  const partes = [
    `${t.nombre}, terapeuta certificada en Técnica Divine en ${lugarDe(t)}${t.centro ? ` (${t.centro})` : ''}.`,
    t.frase ? conPunto(t.frase) : '',
    'Escríbele directamente para pedir tu cita.',
  ];
  return recortar(partes.filter(Boolean).join(' '), 160);
}

const instagramDe = (usuario: string) => `https://www.instagram.com/${usuario}/`;

/** «https://www.centroluz.es/inicio» → «centroluz.es». */
function dominioDe(web: string) {
  try {
    return new URL(web).hostname.replace(/^www\./, '');
  } catch {
    return web;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await fichaPublica(slug);
  if (!t) return { title: 'Terapeuta no encontrada', robots: { index: false } };

  const titulo = tituloDe(t);
  const descripcion = descripcionDe(t);
  const ruta = `/terapeutas/${t.slug}`;
  /* Su foto es la imagen de compartir. Es cuadrada y pequeña, así que en X
     va como tarjeta pequeña: en la grande saldría recortada y borrosa. */
  const imagen = t.foto ? { url: t.foto, alt: t.nombre } : IMAGEN_COMPARTIR;

  return {
    title: { absolute: titulo },
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      ...OG_BASE,
      type: 'profile',
      url: ruta,
      title: titulo,
      description: descripcion,
      images: [imagen],
    },
    twitter: {
      card: t.foto ? 'summary' : 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: [imagen.url],
    },
  };
}

export default async function FichaTerapeuta({ params }: Props) {
  const { slug } = await params;
  const t = await fichaPublica(slug);
  if (!t) notFound();

  const deSuCiudad = await fichasDeCiudad(t.ciudadSlug);
  const otras = deSuCiudad.filter((o) => o.slug !== t.slug);
  const corto = nombreCorto(t);
  const muestraDireccion = Boolean(t.direccion);
  const rutaCiudad = `/terapeutas/en/${t.ciudadSlug}`;

  const migas: Miga[] = [
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Localiza tu terapeuta', ruta: '/terapeutas' },
    { nombre: t.ciudad, ruta: rutaCiudad },
    { nombre: t.nombre, ruta: `/terapeutas/${t.slug}` },
  ];

  const lineaDireccion = [t.direccion, [t.cp, t.ciudad].filter(Boolean).join(' '), t.paisNombre]
    .filter(Boolean)
    .join(', ');
  const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lineaDireccion)}`;

  /* El texto «sobre ella» lo escribe ella, con sus saltos de párrafo. */
  const parrafos = t.sobre
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className="pagina">
      <GrafoJsonLd nodos={grafoDe(t, migas)} />

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

      {/* ---------- Quién es y cómo escribirle ---------- */}
      <section className={css.cabecera}>
        <div className={`wrap ${css.cabeceraFila}`}>
          <div className={css.retrato}>
            {t.foto ? (
              // Su foto real, servida desde Storage con su token. <img> y no
              // next/image: el dominio no está abierto en next.config y la foto
              // ya viene recortada y ligera.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.foto} alt={`${t.nombre}, terapeuta de Técnica Divine en ${t.ciudad}`} width={220} height={220} />
            ) : (
              <span className={css.iniciales} aria-hidden="true">
                {t.iniciales}
              </span>
            )}
          </div>

          <div className={css.intro}>
            <p className={css.sello}>
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path d="M3.5 8.4 6.6 11.3 12.5 4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Terapeuta certificada en Técnica Divine
            </p>
            <h1 className={css.nombre}>{t.nombre}</h1>
            {(t.centro || t.especialidad) && (
              <p className={css.datos}>{[t.centro, t.especialidad].filter(Boolean).join(' · ')}</p>
            )}
            <p className={css.lugar}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
                <circle cx="12" cy="10" r="2.4" />
              </svg>
              {t.paisNombre ? `${t.ciudad}, ${t.paisNombre}` : t.ciudad}
            </p>
            {t.frase && <p className={css.frase}>{t.frase}</p>}
            <Contactos t={t} />
          </div>
        </div>
      </section>

      {/* ---------- Su ficha ---------- */}
      <section className={css.cuerpo}>
        <div className={`wrap ${css.cuerpoRejilla}`}>
          <div className={css.principal}>
            {parrafos.length > 0 && (
              <section className={css.bloque} aria-labelledby="sobre">
                <h2 id="sobre" className={css.bloqueTitulo}>
                  Sobre {corto}
                </h2>
                {parrafos.map((p, i) => (
                  <p key={i} className={css.texto}>
                    {p}
                  </p>
                ))}
              </section>
            )}

            {t.tratamientos.length > 0 && (
              <section className={css.bloque} aria-labelledby="tratamientos">
                <h2 id="tratamientos" className={css.bloqueTitulo}>
                  Tratamientos
                </h2>
                <ul className={css.tratamientos}>
                  {t.tratamientos.map((tr) => (
                    <li key={tr}>{tr}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className={css.lateral}>
            <section className={css.tarjeta} aria-labelledby="ubicacion">
              <h2 id="ubicacion" className={css.tarjetaTitulo}>
                Dónde trabaja
              </h2>
              {muestraDireccion ? (
                <>
                  <address className={css.direccion}>
                    {t.direccion}
                    <br />
                    {[t.cp, t.ciudad].filter(Boolean).join(' ')}
                    {t.paisNombre && (
                      <>
                        <br />
                        {t.paisNombre}
                      </>
                    )}
                  </address>
                  <a href={comoLlegar} className={css.enlace} target="_blank" rel="noopener">
                    Cómo llegar
                  </a>
                </>
              ) : (
                <p className={css.tarjetaTexto}>
                  En {t.paisNombre ? `${t.ciudad} (${t.paisNombre})` : t.ciudad}. La dirección exacta te la da{' '}
                  {corto} cuando le escribas.
                </p>
              )}
              <Link href={rutaCiudad} className={css.enlace}>
                Ver el mapa de {t.ciudad}
              </Link>
            </section>

            <section className={css.tarjeta} aria-labelledby="certificacion">
              <h2 id="certificacion" className={css.tarjetaTitulo}>
                Certificación
              </h2>
              <p className={css.tarjetaTexto}>
                Formada en la Técnica Divine, el método de drenaje linfático manual creado por Sorela Caro.
              </p>
              <Link href="/metodo" className={css.enlace}>
                Conoce el método
              </Link>
            </section>
          </aside>
        </div>
      </section>

      {/* ---------- Pedir cita ---------- */}
      <section className={css.contacto} aria-labelledby="pedir-cita">
        <div className="wrap">
          <h2 id="pedir-cita" className={css.contactoTitulo}>
            Pide tu cita a {corto}
          </h2>
          <p className={css.contactoTexto}>
            Las citas van directas: le escribes tú y te contesta ella, sin intermediarios.
          </p>
          <Contactos t={t} />
        </div>
      </section>

      {/* ---------- Otras de su ciudad ---------- */}
      {otras.length > 0 && (
        <section className={css.otras} aria-labelledby="otras">
          <div className="wrap">
            <div className={css.otrasCabeza}>
              <h2 id="otras" className={css.otrasTitulo}>
                Otras terapeutas en {t.ciudad}
              </h2>
              <Link href={rutaCiudad} className={css.enlace}>
                Ver las {deSuCiudad.length} de {t.ciudad}
              </Link>
            </div>
            <ul className={css.otrasLista}>
              {otras.slice(0, 3).map((o) => (
                <li key={o.slug}>
                  <TarjetaTerapeuta t={paraMapa(o)} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}

/**
 * Los botones para escribirle. Van directos a su WhatsApp (con un saludo ya
 * escrito), a su Instagram y a su web: nada pasa por la web de Sorela.
 *
 * Los enlaces que ella ha escrito llevan `ugc`: le dicen a Google que el
 * enlace lo ha puesto la persona de la ficha, no la casa. El de WhatsApp,
 * `nofollow`: es un chat, no una página que posicionar.
 */
function Contactos({ t }: { t: FichaPublica }) {
  return (
    <div className={css.contactos}>
      {t.whatsapp && (
        <a href={enlaceWhatsapp(t.whatsapp, t.nombre)} className={`btn btn-md ${css.boton}`} target="_blank" rel="noopener nofollow">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
          </svg>
          Escribir por WhatsApp
        </a>
      )}
      {t.instagram && (
        <a href={instagramDe(t.instagram)} className={`btn-linea ${css.boton} ${css.botonLinea}`} target="_blank" rel="noopener ugc">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          @{t.instagram}
        </a>
      )}
      {t.web && (
        <a href={t.web} className={`btn-linea ${css.boton} ${css.botonLinea}`} target="_blank" rel="noopener ugc">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
          </svg>
          {dominioDe(t.web)}
        </a>
      )}
    </div>
  );
}

/**
 * Los datos estructurados de la ficha.
 *
 * Solo lo que se ve en la página y nada más: Google lo contrasta, y un dato
 * que no está a la vista le hace desconfiar del bloque entero. Por eso la
 * calle y el código postal entran solo si ella los enseña, las coordenadas
 * solo si son las de su consulta (no el centro de la ciudad), y no hay
 * teléfono, ni valoraciones, ni precios.
 *
 * La ficha de negocio (BeautySalon) solo sale con nombre de centro Y dirección
 * a la vista: un negocio local sin calle, o con un nombre inventado
 * («Consulta de María»), es justo lo que Google no se cree. Sin eso, su lugar
 * de trabajo es un `Place` con lo que sí se sabe.
 */
function grafoDe(t: FichaPublica, migas: Miga[]): (Nodo | null)[] {
  const url = absoluta(`/terapeutas/${t.slug}`);
  const idPersona = `${url}#terapeuta`;
  const idLugar = `${url}#lugar`;
  const muestra = Boolean(t.direccion);
  const exacta = muestra && t.precision === 'exacta' && Number.isFinite(t.lat) && Number.isFinite(t.lng);
  const sameAs = [t.instagram ? instagramDe(t.instagram) : '', t.web].filter(Boolean);
  const redondo = (n: number) => Math.round(n * 1e5) / 1e5;

  const direccion: Nodo = {
    '@type': 'PostalAddress',
    addressLocality: t.ciudad,
    ...(t.pais ? { addressCountry: t.pais } : {}),
    ...(muestra ? { streetAddress: t.direccion } : {}),
    ...(muestra && t.cp ? { postalCode: t.cp } : {}),
  };
  const geo = exacta ? { geo: { '@type': 'GeoCoordinates', latitude: redondo(t.lat), longitude: redondo(t.lng) } } : {};

  const esNegocio = muestra && Boolean(t.centro);
  const lugar: Nodo = esNegocio
    ? {
        '@type': 'BeautySalon',
        '@id': idLugar,
        name: t.centro,
        url,
        ...(t.foto ? { image: t.foto } : {}),
        address: direccion,
        ...geo,
        employee: { '@id': idPersona },
        ...(sameAs.length ? { sameAs } : {}),
      }
    : {
        '@type': 'Place',
        '@id': idLugar,
        name: muestra ? t.direccion : lugarDe(t),
        address: direccion,
        ...geo,
      };

  const persona: Nodo = {
    '@type': 'Person',
    '@id': idPersona,
    name: t.nombre,
    url,
    ...(t.foto ? { image: t.foto } : {}),
    jobTitle: 'Terapeuta de Técnica Divine',
    ...(t.frase ? { description: t.frase } : {}),
    ...(t.tratamientos.length ? { knowsAbout: t.tratamientos } : {}),
    /* La certificación, reconocida por el negocio de Sorela: el mismo
       `#negocio` que describe el layout en todas las páginas. */
    hasCredential: {
      '@type': 'EducationalOccupationalCredential',
      name: 'Terapeuta certificada en Técnica Divine',
      credentialCategory: 'certificate',
      recognizedBy: REF_NEGOCIO,
    },
    workLocation: { '@id': idLugar },
    ...(esNegocio ? { worksFor: { '@id': idLugar } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };

  const pagina: Nodo = {
    '@type': 'ProfilePage',
    '@id': `${url}#pagina`,
    url,
    name: tituloDe(t),
    inLanguage: 'es-ES',
    isPartOf: { '@id': ID_WEB },
    mainEntity: { '@id': idPersona },
    ...(t.publicadaEl ? { dateCreated: t.publicadaEl } : {}),
    ...(t.actualizado ? { dateModified: t.actualizado } : {}),
  };

  return [pagina, persona, lugar, nodoMigas(migas)];
}
