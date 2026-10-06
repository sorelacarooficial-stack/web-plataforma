/**
 * Genera la tierra del globo del mapa de terapeutas, en puntos.
 *
 *   node scripts/preparar-globo.mjs
 *
 * El globo no dibuja los continentes como manchas: los dibuja como una nube
 * de puntos de luz repartidos por la tierra firme. Se ve más fino que un
 * relleno plano y, sobre todo, es barato: pintar diez mil puntos es más
 * rápido que recortar polígonos en cada fotograma mientras el globo gira.
 *
 * LOS PUNTOS SALEN DE UNA ESPIRAL DE FIBONACCI, no de una cuadrícula de
 * latitud y longitud. En una cuadrícula los puntos se amontonan en los polos
 * —todos los meridianos se juntan ahí— y el globo sale con dos manchas
 * blancas arriba y abajo. La espiral reparte los puntos a la misma distancia
 * en toda la esfera.
 *
 * De cada punto solo se guarda si cae en tierra, con dos decimales (~1 km),
 * en una lista plana [lng, lat, lng, lat, …] para que pese poco.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoBounds, geoContains } from 'd3-geo';
import * as topojson from 'topojson-client';

const require = createRequire(import.meta.url);
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Cuántos puntos en toda la esfera. Unos 0,9° entre vecinos. */
const TOTAL = 52000;

const topo = require('world-atlas/land-50m.json');
const tierra = topojson.feature(topo, topo.objects.land);

/*
 * La tierra, partida en sus trozos —cada continente, cada isla—, cada uno con
 * la caja que lo encierra.
 *
 * Preguntar a la tierra entera si contiene un punto obliga a recorrer todas
 * las costas del mundo para cada uno de los 52.000 puntos: unos siete
 * minutos. Mirando antes la caja de cada trozo, casi todos se descartan con
 * una comparación y solo se recorren las costas de los que de verdad están
 * cerca: baja a menos de un minuto, con exactamente los mismos puntos.
 */
const geometrias = tierra.type === 'FeatureCollection' ? tierra.features.map((f) => f.geometry) : [tierra.geometry];
const trozos = geometrias
  .flatMap((g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]))
  .map((poligono) => {
    const f = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: poligono } };
    return { f, caja: geoBounds(f) };
  });

function enTierra(lng, lat) {
  for (const { f, caja } of trozos) {
    const [[x0, y0], [x1, y1]] = caja;
    if (lat < y0 || lat > y1) continue;
    /* Una caja que cruza el antimeridiano tiene x0 > x1. */
    const dentroX = x0 <= x1 ? lng >= x0 && lng <= x1 : lng >= x0 || lng <= x1;
    if (!dentroX) continue;
    if (geoContains(f, [lng, lat])) return true;
  }
  return false;
}

const dorado = Math.PI * (3 - Math.sqrt(5));
const salida = [];

for (let i = 0; i < TOTAL; i++) {
  const y = 1 - (i / (TOTAL - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const theta = dorado * i;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lng = ((((Math.atan2(Math.sin(theta) * r, Math.cos(theta) * r) * 180) / Math.PI) + 540) % 360) - 180;
  /* La Antártida no se pinta: ocupa media parte de abajo del globo y no hay
     ninguna terapeuta que buscar allí. */
  if (lat < -60) continue;
  if (enTierra(lng, lat)) salida.push(+lng.toFixed(2), +lat.toFixed(2));
}

const archivo = join(raiz, 'public', 'geo', 'tierra-puntos.json');
const json = JSON.stringify(salida);
writeFileSync(archivo, json);
console.log(`${salida.length / 2} puntos de tierra → ${Math.round(json.length / 1024)} KB`);
