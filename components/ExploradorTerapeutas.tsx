'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import AvisarCiudad from './AvisarCiudad';
import {
  TODAS,
  TODAS_CIUDADES,
  TODOS_TRATAMIENTOS,
  ciudadesDe,
  cuantas,
  filtrar,
  lugarDe,
  tratamientosDe,
  type TerapeutaMapa,
} from '@/lib/terapeutas';
import css from './ExploradorTerapeutas.module.css';

// El mapa monta la geometría del globo: fuera del bundle inicial de la página.
const MapaTerapeutas = dynamic(() => import('./MapaTerapeutas'), {
  ssr: false,
  loading: () => <div className={css.hueco}>Cargando mapa…</div>,
});

type Props = {
  /**
   * Las fichas publicadas, ya leídas en el servidor (lib/fichas-publicas).
   * Llegan por props y no de un import: así la página se rehace sola cuando
   * una terapeuta publica, sin volver a compilar la web.
   */
  terapeutas: TerapeutaMapa[];
  /**
   * En la página de una ciudad (/terapeutas/en/…): sin filtro de ciudad ni
   * enlaces a ciudades, y el globo empieza mirando a esa ciudad.
   */
  ciudad?: { nombre: string; slug: string };
};

/**
 * El buscador de «Localiza tu terapeuta»: filtros, globo, enlaces por ciudad
 * y tarjetas.
 *
 * Todo lo que importa para Google se pinta en el servidor: las tarjetas y los
 * enlaces a cada ciudad son enlaces de verdad (`<a href>`), así que el
 * buscador llega a cada ficha aunque no ejecute JavaScript. El globo es lo
 * único que se monta solo en el navegador.
 */
export default function ExploradorTerapeutas({ terapeutas, ciudad: enCiudad }: Props) {
  const router = useRouter();
  const id = useId();
  const [ciudad, setCiudad] = useState(TODAS);
  const [tratamiento, setTratamiento] = useState(TODAS);

  const ciudades = useMemo(() => ciudadesDe(terapeutas), [terapeutas]);
  const tratamientos = useMemo(() => tratamientosDe(terapeutas), [terapeutas]);
  const filtradas = useMemo(() => filtrar(terapeutas, ciudad, tratamiento), [terapeutas, ciudad, tratamiento]);
  const enMapa = useMemo(() => new Set(filtradas.map((t) => t.slug)), [filtradas]);

  /** No hay ni una terapeuta publicada todavía, en ninguna ciudad. */
  const mapaVacio = terapeutas.length === 0;
  const sinResultados = !mapaVacio && filtradas.length === 0;
  const hayFiltro = ciudad !== TODAS || tratamiento !== TODAS;

  /* Los filtros solo salen si filtran algo: un desplegable con una sola
     ciudad, o con un único tratamiento, no deja elegir nada. */
  const filtroCiudad = !enCiudad && ciudades.length > 1;
  const filtroTratamiento = tratamientos.length > 1;
  const conFiltros = filtroCiudad || filtroTratamiento;

  /* En la página de una ciudad, el globo empieza en ella y no en la península. */
  const inicio = useMemo(() => {
    if (!enCiudad) return undefined;
    const conSitio = terapeutas.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng));
    if (!conSitio.length) return undefined;
    return {
      lng: conSitio.reduce((s, t) => s + t.lng, 0) / conSitio.length,
      lat: conSitio.reduce((s, t) => s + t.lat, 0) / conSitio.length,
      k: 2.8,
      nombre: enCiudad.nombre,
    };
  }, [enCiudad, terapeutas]);

  const quitarFiltros = () => {
    setCiudad(TODAS);
    setTratamiento(TODAS);
  };

  return (
    <>
      {conFiltros && (
        <section className={css.filtros} aria-label="Filtrar terapeutas">
          <div className={`wrap ${css.filtrosFila}`}>
            {filtroCiudad && (
              <select
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                aria-label="Filtrar por ciudad"
                className={css.select}
              >
                <option value={TODAS}>{TODAS_CIUDADES}</option>
                {ciudades.map((c) => (
                  <option key={c.ciudadSlug} value={c.ciudadSlug}>
                    {c.ciudad}
                  </option>
                ))}
              </select>
            )}

            {filtroTratamiento && (
              <select
                value={tratamiento}
                onChange={(e) => setTratamiento(e.target.value)}
                aria-label="Filtrar por tratamiento"
                className={css.select}
              >
                <option value={TODAS}>{TODOS_TRATAMIENTOS}</option>
                {tratamientos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            <span className={css.resultado} role="status">
              {sinResultados ? 'Sin resultados' : cuantas(filtradas.length)}
            </span>
          </div>
        </section>
      )}

      <section className={css.zonaMapa}>
        <div className="wrap">
          <MapaTerapeutas
            terapeutas={terapeutas}
            visibles={enMapa}
            inicio={inicio}
            onVerPerfil={(slug) => router.push(`/terapeutas/${slug}`)}
          />
          {!mapaVacio && (
            <p className={css.pieMapa}>
              Pulsa un punto del globo para ver quién trabaja ahí.
              {conFiltros ? ' Los filtros de arriba también mueven el globo.' : ''}
            </p>
          )}
        </div>
      </section>

      {/* Las ciudades, como enlaces: cada una tiene su propia página, que es la
          que aparece cuando alguien busca «drenaje linfático en Sevilla». */}
      {!enCiudad && ciudades.length > 0 && (
        <nav className={css.ciudades} aria-labelledby={`${id}-ciudades`}>
          <div className="wrap">
            <h2 id={`${id}-ciudades`} className={css.rotulo}>
              Por ciudad
            </h2>
            <ul className={css.chips}>
              {ciudades.map((c) => (
                <li key={c.ciudadSlug}>
                  <Link
                    href={`/terapeutas/en/${c.ciudadSlug}`}
                    className={css.chip}
                    aria-label={`${lugarDe(c)}: ${cuantas(c.n)}`}
                  >
                    {lugarDe(c)}
                    <span className={css.chipN} aria-hidden="true">
                      {c.n}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      <section className={css.listado} aria-labelledby={`${id}-listado`}>
        <div className="wrap">
          {mapaVacio ? (
            <div className={css.vacio}>
              <span className={css.vacioIcono} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
                  <circle cx="12" cy="10" r="2.4" />
                </svg>
              </span>
              <h2 id={`${id}-listado`} className={css.vacioTitulo}>
                Las primeras terapeutas están llegando
              </h2>
              <p className={css.vacioTexto}>
                Aquí aparecerán las terapeutas certificadas en Técnica Divine, cada una con su ficha y
                su contacto directo. Déjame tu ciudad y te aviso en cuanto haya una cerca de ti.
              </p>
              <div className={css.vacioForm}>
                <AvisarCiudad />
              </div>
            </div>
          ) : (
            <>
              <div className={css.listadoCabeza}>
                <h2 id={`${id}-listado`} className={css.listadoTitulo}>
                  {enCiudad ? `Terapeutas en ${enCiudad.nombre}` : 'Todas las terapeutas'}
                </h2>
                {hayFiltro && !sinResultados && (
                  <button type="button" className={css.quitar} onClick={quitarFiltros}>
                    Quitar filtros
                  </button>
                )}
              </div>

              {sinResultados && (
                <div className={css.sinResultados} role="status">
                  <p>
                    <b>Ninguna terapeuta con ese filtro.</b> Prueba con otro tratamiento u otra ciudad.
                  </p>
                  <button type="button" className="btn-linea" onClick={quitarFiltros}>
                    Ver todas
                  </button>
                </div>
              )}

              <ul className={css.tarjetas}>
                {filtradas.map((t) => (
                  <li key={t.slug}>
                    <TarjetaTerapeuta t={t} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Con fichas, el aviso va al final: para quien no ha encontrado a
          nadie en su zona. Con el mapa vacío ya está arriba. */}
      {!mapaVacio && (
        <section className={css.aviso} aria-labelledby={`${id}-aviso`}>
          <div className={`wrap ${css.avisoFila}`}>
            <div className={css.avisoTexto}>
              <h2 id={`${id}-aviso`} className={css.avisoTitulo}>
                ¿No hay ninguna cerca de ti?
              </h2>
              <p>Déjame tu ciudad y te aviso en cuanto haya una terapeuta certificada en tu zona.</p>
            </div>
            <div className={css.avisoForm}>
              <AvisarCiudad />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * La tarjeta de una terapeuta, tal como sale en el listado.
 *
 * Se exporta para que cualquier vista previa de la ficha (el onboarding de la
 * plataforma, por ejemplo) pueda pintar EXACTAMENTE esta, con
 * `comoEnlace={false}` para que no lleve a una página que todavía no existe.
 *
 * Toda la tarjeta es pulsable, pero el enlace es uno solo, el del nombre: un
 * lector de pantalla oye «María García, enlace» y no cinco enlaces seguidos
 * a la misma página.
 */
export function TarjetaTerapeuta({ t, comoEnlace = true }: { t: TerapeutaMapa; comoEnlace?: boolean }) {
  return (
    <article className={css.tarjeta}>
      <div className={css.identidad}>
        {t.foto ? (
          // Foto de Storage con su token: <img> y no next/image, que pediría
          // abrir ese dominio en next.config para ganar nada a este tamaño.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={css.foto} src={t.foto} alt="" width={64} height={64} loading="lazy" />
        ) : (
          <span className={css.iniciales} aria-hidden="true">
            {t.iniciales}
          </span>
        )}
        <div className={css.quien}>
          <h3 className={css.nombre}>
            {comoEnlace ? (
              <Link href={`/terapeutas/${t.slug}`} className={css.enlace}>
                {t.nombre}
              </Link>
            ) : (
              t.nombre
            )}
          </h3>
          {t.centro && <p className={css.centro}>{t.centro}</p>}
          <p className={css.ciudad}>{lugarDe(t)}</p>
        </div>
      </div>

      <p className={css.sello}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3.5 8.4 6.6 11.3 12.5 4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Certificada en Técnica Divine
      </p>

      {t.frase && <p className={css.frase}>{t.frase}</p>}

      {t.tratamientos.length > 0 && (
        <ul className={css.etiquetas} aria-label="Tratamientos">
          {t.tratamientos.map((tr) => (
            <li key={tr}>{tr}</li>
          ))}
        </ul>
      )}

      <span className={css.ver} aria-hidden="true">
        Ver ficha y contacto <span className={css.flecha}>→</span>
      </span>
    </article>
  );
}
