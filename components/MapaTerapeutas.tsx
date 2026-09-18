'use client';

import { geoMercator, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { ZoomTransform, zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Terapeuta } from '@/lib/terapeutas';
import css from './MapaTerapeutas.module.css';

type Geo = {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: { name: string }; geometry: GeoJSON.Geometry }[];
};

/** Encuadre: península, Baleares y el norte de África que asoma. */
const VISTA: GeoJSON.MultiPoint = {
  type: 'MultiPoint',
  coordinates: [
    [-9.8, 35.6],
    [4.7, 35.6],
    [4.7, 44.2],
    [-9.8, 44.2],
  ],
};

export default function MapaTerapeutas({
  terapeutas,
  visibles,
  onVerPerfil,
}: {
  terapeutas: Terapeuta[];
  /** Slugs que pasan el filtro; el resto se apagan sin desaparecer. */
  visibles: Set<string>;
  onVerPerfil: (slug: string) => void;
}) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [geo, setGeo] = useState<Geo | null>(null);
  const [error, setError] = useState(false);
  const [medida, setMedida] = useState({ w: 0, h: 0 });
  const [tr, setTr] = useState<ZoomTransform>(zoomIdentity);
  const [activo, setActivo] = useState<Terapeuta | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  /* ---------------- Geometría ---------------- */
  useEffect(() => {
    let vivo = true;
    fetch('/geo/peninsula.geo.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: Geo) => vivo && setGeo(d))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);

  /* ---------------- Medida ---------------- */
  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const medir = () => {
      const r = caja.getBoundingClientRect();
      setMedida({ w: Math.max(320, r.width), h: Math.max(240, r.height) });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja);
    return () => ro.disconnect();
  }, []);

  const { w, h } = medida;

  const proyeccion = useMemo(() => {
    if (!w || !h) return null;
    // El margen derecho es mayor que el izquierdo porque las etiquetas de
    // Barcelona y Valencia se dibujan a la derecha de su punto y se salían
    // del mapa (30-35 px fuera a 320-390 px de ancho).
    const margen = Math.min(46, Math.max(26, w * 0.09));
    return geoMercator().fitExtent(
      [
        [26, 26],
        [w - margen, h - 30],
      ],
      VISTA
    );
  }, [w, h]);

  const trazo = useMemo(() => (proyeccion ? geoPath(proyeccion) : null), [proyeccion]);

  const puntos = useMemo(() => {
    if (!proyeccion) return new Map<string, [number, number]>();
    const m = new Map<string, [number, number]>();
    for (const t of terapeutas) {
      const p = proyeccion([t.lng, t.lat]);
      if (p) m.set(t.slug, [p[0], p[1]]);
    }
    return m;
  }, [proyeccion, terapeutas]);

  /* ---------------- Zoom y arrastre ---------------- */
  const comportamiento = useMemo(() => {
    if (!w || !h) return null;
    return d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 9])
      .translateExtent([
        [0, 0],
        [w, h],
      ]);
  }, [w, h]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !comportamiento) return;
    const sel = select(svg);
    comportamiento
      .on('start', () => setArrastrando(true))
      .on('end', () => setArrastrando(false))
      .on('zoom', (ev) => setTr(ev.transform));
    sel.call(comportamiento).on('dblclick.zoom', null);
    return () => {
      sel.on('.zoom', null);
    };
  }, [comportamiento]);

  const aplicar = useCallback(
    (destino: ZoomTransform, ms: number) => {
      const svg = svgRef.current;
      if (!svg || !comportamiento) return;
      select(svg).transition().duration(ms).call(comportamiento.transform, destino);
    },
    [comportamiento]
  );

  const escalar = (factor: number) => {
    const svg = svgRef.current;
    if (!svg || !comportamiento) return;
    select(svg).transition().duration(260).call(comportamiento.scaleBy, factor);
  };

  /* ---------------- Reencuadre al filtrar ---------------- */
  // Se guarda la firma del filtro para no reencuadrar en cada render.
  const firma = [...visibles].sort().join(',');
  const firmaPrev = useRef(firma);

  useEffect(() => {
    if (firma === firmaPrev.current) return;
    firmaPrev.current = firma;
    setActivo(null);

    if (!proyeccion || !w || !h) return;
    const dentro = terapeutas.filter((t) => visibles.has(t.slug));

    if (!dentro.length) {
      aplicar(zoomIdentity, 500);
      return;
    }
    if (dentro.length === 1) {
      const p = puntos.get(dentro[0].slug);
      if (!p) return;
      aplicar(
        zoomIdentity.translate(w / 2, h / 2).scale(3.4).translate(-p[0], -p[1]),
        600
      );
      return;
    }

    const xs = dentro.map((t) => puntos.get(t.slug)![0]);
    const ys = dentro.map((t) => puntos.get(t.slug)![1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const k = Math.max(
      1,
      Math.min(6, 0.8 / Math.max((x1 - x0) / w, (y1 - y0) / h))
    );
    aplicar(
      zoomIdentity
        .translate(w / 2, h / 2)
        .scale(k)
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
      600
    );
  }, [firma, visibles, terapeutas, proyeccion, puntos, w, h, aplicar]);

  /* ---------------- Leyenda ---------------- */
  const dentro = visibles.size;
  const leyenda =
    dentro === terapeutas.length
      ? 'Consultas Divine certificadas'
      : dentro === 0
        ? 'Sin consultas con ese filtro'
        : `${dentro} ${dentro === 1 ? 'consulta' : 'consultas'} con ese filtro`;

  /* ---------------- Posición de la ficha ---------------- */
  // La ficha se ancla centrada sobre el punto y desplazada hacia arriba, así
  // que hay que acotarla a la caja: si no, `overflow: hidden` le corta el lado
  // derecho —con el botón × dentro— y la parte de arriba.
  const fichaPos = (() => {
    if (!activo) return null;
    const p = puntos.get(activo.slug);
    if (!p) return null;
    const anchoFicha = Math.min(250, w - 24);
    const medio = anchoFicha / 2;
    const altoFicha = 210;
    return {
      ancho: anchoFicha,
      left: Math.min(Math.max(medio + 12, tr.applyX(p[0])), w - medio - 12),
      top: Math.min(Math.max(altoFicha + 12, tr.applyY(p[1]) - 22), h - 12),
    };
  })();

  if (error) {
    return (
      <div ref={cajaRef} className={css.caja}>
        <p className={css.cargando}>No se ha podido cargar el mapa</p>
      </div>
    );
  }

  return (
    <div ref={cajaRef} className={css.caja}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className={`${css.svg} ${arrastrando ? css.arrastrando : ''}`}
        role="img"
        aria-label="Mapa de España con las consultas de las terapeutas Divine certificadas"
      >
        <g transform={tr.toString()}>
          <g>
            {trazo &&
              geo?.features.map((f) => (
                <path key={f.properties.name} d={trazo(f as never) ?? undefined} className={css.tierra} />
              ))}
          </g>
          <g>
            {terapeutas.map((t) => {
              const p = puntos.get(t.slug);
              if (!p) return null;
              const on = visibles.has(t.slug);
              // Si el punto está pegado al borde derecho, la etiqueta se
              // escribe hacia la izquierda: si no, "Barcelona" se sale del
              // mapa entera en pantallas estrechas.
              const alBorde = t.dx > 0 && p[0] > w * 0.68;
              const etiquetaX = alBorde ? -t.dx : t.dx;
              const anclaje = alBorde ? 'end' : t.dx > 0 ? 'start' : 'middle';
              return (
                <g key={t.slug} transform={`translate(${p[0]},${p[1]})`} opacity={on ? 1 : 0.55}>
                  <g transform={`scale(${1 / tr.k})`}>
                    <text
                      x={etiquetaX}
                      y={t.dy}
                      textAnchor={anclaje}
                      className={`${css.ciudad} ${on ? '' : css.ciudadOff}`}
                    >
                      {t.ciudad}
                    </text>
                    <g
                      className={`${css.pin} ${on ? '' : css.pinOff}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivo(t);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${t.nombre}, ${t.ciudad}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActivo(t);
                        }
                      }}
                    >
                      <circle r={17} />
                      <text dy={4.5}>{t.iniciales}</text>
                    </g>
                  </g>
                </g>
              );
            })}
          </g>
        </g>
        {/* Capa de fondo para cerrar la ficha al pinchar fuera de un punto. */}
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill="transparent"
          onClick={() => setActivo(null)}
          style={{ pointerEvents: activo ? 'auto' : 'none' }}
        />
      </svg>

      <div className={css.zoom}>
        <button type="button" onClick={() => escalar(1.6)} title="Acercar" aria-label="Acercar">
          +
        </button>
        <button type="button" onClick={() => escalar(1 / 1.6)} title="Alejar" aria-label="Alejar">
          −
        </button>
      </div>

      <div className={css.leyenda}>{leyenda}</div>
      <div className={css.fuente}>Geometría: Natural Earth</div>

      {!geo && <div className={css.cargando}>Cargando mapa…</div>}

      {activo && fichaPos && (
        <div
          className={css.ficha}
          style={{ left: fichaPos.left, top: fichaPos.top, width: fichaPos.ancho }}
        >
          <button
            type="button"
            className={css.fichaCerrar}
            aria-label="Cerrar"
            onClick={() => setActivo(null)}
          >
            ×
          </button>
          <h3>{activo.nombre}</h3>
          <p className={css.fichaCiudad}>{activo.ciudad} · certificada por Sorela</p>
          <p className={css.fichaDir}>{activo.direccion}</p>
          <p className={css.fichaTrat}>{activo.tratamientos.join(' · ')}</p>
          <button
            type="button"
            className={css.fichaVer}
            onClick={() => onVerPerfil(activo.slug)}
          >
            Ver perfil y reservar
          </button>
        </div>
      )}
    </div>
  );
}
