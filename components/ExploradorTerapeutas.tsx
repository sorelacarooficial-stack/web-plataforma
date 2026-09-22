'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  CIUDADES,
  TERAPEUTAS,
  TODAS_CIUDADES,
  TODOS_TRATAMIENTOS,
  TRATAMIENTOS,
  filtrar,
} from '@/lib/terapeutas';
import css from './ExploradorTerapeutas.module.css';

// El mapa monta d3 y la geometría: fuera del bundle inicial de la página.
const MapaTerapeutas = dynamic(() => import('./MapaTerapeutas'), {
  ssr: false,
  loading: () => <div className={css.hueco}>Cargando mapa…</div>,
});

export default function ExploradorTerapeutas() {
  const router = useRouter();
  const [ciudad, setCiudad] = useState(TODAS_CIUDADES);
  const [tratamiento, setTratamiento] = useState(TODOS_TRATAMIENTOS);

  const filtradas = useMemo(() => filtrar(ciudad, tratamiento), [ciudad, tratamiento]);
  const sinResultados = filtradas.length === 0;

  // Antes, al no haber resultados, se enseñaban tres terapeutas cualesquiera
  // «para no dejar la página vacía». Eso presentaba como cercanas a tres
  // personas que estaban en la otra punta del país. Si no hay resultados, no se
  // enseña ninguna: se explica.
  const visibles = filtradas;
  /** No hay ni una terapeuta dada de alta todavía, en ninguna ciudad. */
  const mapaVacio = TERAPEUTAS.length === 0;
  const enMapa = useMemo(() => new Set(filtradas.map((t) => t.slug)), [filtradas]);

  const resultado = sinResultados
    ? 'Sin resultados'
    : `${filtradas.length} ${filtradas.length === 1 ? 'terapeuta' : 'terapeutas'}`;

  return (
    <>
      <section className={css.filtros}>
        <div className={`wrap ${css.filtrosFila}`}>
          <select
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            aria-label="Filtrar por ciudad"
            className={css.select}
            style={{ flex: '0 1 240px' }}
          >
            {CIUDADES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={tratamiento}
            onChange={(e) => setTratamiento(e.target.value)}
            aria-label="Filtrar por tratamiento"
            className={css.select}
            style={{ flex: '0 1 260px' }}
          >
            {TRATAMIENTOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <span className={css.resultado} role="status">
            {resultado}
          </span>
        </div>
      </section>

      <section className={css.zonaMapa}>
        <div className="wrap">
          <MapaTerapeutas
            terapeutas={TERAPEUTAS}
            visibles={enMapa}
            onVerPerfil={(slug) => router.push(`/terapeutas/${slug}`)}
          />
          {!mapaVacio && (
            <p className={css.pieMapa}>
              Pincha un punto del mapa para ver la ficha y reservar. Los filtros de arriba también
              mueven el mapa.
            </p>
          )}
        </div>
      </section>

      <section className={css.listado}>
        <div className="wrap">
          {sinResultados && (
            <div className={css.vacio}>
              <h2 className={css.vacioTitulo}>
                {mapaVacio
                  ? 'Todavía no hay terapeutas en el mapa.'
                  : `Todavía no hay terapeuta Divine en ${
                      ciudad === TODAS_CIUDADES ? 'esa combinación' : ciudad
                    }.`}
              </h2>
              <p className="texto-fijo" style={{ fontSize: 16 }}>
                {mapaVacio
                  ? 'Las primeras certificadas entrarán aquí en cuanto terminen su formación. Déjame tu contacto y te aviso cuando haya alguna cerca de ti.'
                  : 'Déjame tu contacto y te aviso en cuanto haya una cerca de ti.'}
              </p>
            </div>
          )}

          <div className={css.tarjetas}>
            {visibles.map((t) => (
              <article key={t.slug} className={css.tarjeta}>
                <div className="columna" style={{ gap: 16 }}>
                  <div className={css.identidad}>
                    <span className={css.iniciales}>{t.iniciales}</span>
                    <span className="columna" style={{ gap: 4 }}>
                      <span className={css.nombre}>{t.nombre}</span>
                      <span className={css.ciudad}>{t.ciudad} · certificada</span>
                    </span>
                  </div>
                  <p className={css.frase}>{t.frase}</p>
                </div>

                <Link href={`/terapeutas/${t.slug}`} className="btn-linea" style={{ alignSelf: 'flex-start' }}>
                  Ver perfil
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
