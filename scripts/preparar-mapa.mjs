/**
 * Genera la geometría del mapa de terapeutas.
 *
 *   node scripts/preparar-mapa.mjs
 *
 * Parte de world-atlas a 1:50m (el 1:110m no incluye las Baleares, así que el
 * punto de Palma quedaría en el mar) y se queda solo con los seis países que
 * entran en el encuadre, con las coordenadas redondeadas a 3 decimales
 * (~100 m, de sobra para este nivel de zoom). El resultado se auto-aloja:
 * el mapa no depende de ningún CDN externo.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as topojson from 'topojson-client';

const require = createRequire(import.meta.url);
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAISES = ['Spain', 'Portugal', 'France', 'Andorra', 'Morocco', 'Algeria'];
const DECIMALES = 3;

const topo = require('world-atlas/countries-50m.json');
const todas = topojson.feature(topo, topo.objects.countries).features;

const redondear = (v) =>
  Array.isArray(v[0]) ? v.map(redondear) : [+v[0].toFixed(DECIMALES), +v[1].toFixed(DECIMALES)];

const features = todas
  .filter((f) => PAISES.includes(f.properties.name))
  .map((f) => ({
    type: 'Feature',
    properties: { name: f.properties.name },
    geometry: { type: f.geometry.type, coordinates: redondear(f.geometry.coordinates) },
  }));

const salida = join(raiz, 'public', 'geo', 'peninsula.geo.json');
const json = JSON.stringify({ type: 'FeatureCollection', features });
writeFileSync(salida, json);

console.log(
  `${features.length} países (${features.map((f) => f.properties.name).join(', ')})`
);
console.log(`peninsula.geo.json → ${Math.round(json.length / 1024)} KB`);
