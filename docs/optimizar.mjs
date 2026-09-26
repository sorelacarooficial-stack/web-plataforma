/**
 * Las capturas de los manuales, listas para el PDF.
 *
 *   node docs/optimizar.mjs
 *
 * `docs/capturas.mjs` fotografía la plataforma a doble resolución, que es lo
 * que hace que en papel se vean nítidas y no sucias. A ese tamaño cada captura
 * pesa entre 100 y 400 KB, y son doce: el PDF acababa en varios megas y el
 * repositorio cargando con imágenes que solo se usan una vez.
 *
 * Esto deja cada una a 1300 px de ancho —el doble de lo que ocupa en la página,
 * que es justo lo que pide una pantalla de retina— y la guarda con paleta en
 * vez de con color de 24 bits. Una captura de una interfaz tiene veinte colores
 * planos, así que la paleta no se nota y el archivo baja a la décima parte.
 *
 * Las originales no se suben al repositorio (están en .gitignore); las `op-`
 * sí, porque son las que el manual referencia.
 */
import sharp from 'sharp';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CAPTURAS = path.join(AQUI, 'capturas');

/** El ancho al que se dejan. El doble de lo que ocupan en la página. */
const ANCHO = 1300;

/*
 * Qué se optimiza: lo que los manuales enseñan, y solo eso.
 *
 * Se lee de los propios HTML en vez de recorrer la carpeta entera porque
 * `capturas.mjs` fotografía más cosas de las que acaban en los manuales, y
 * cada `op-` que se genera de más es una imagen que se sube al repositorio
 * para no salir en ningún sitio.
 */
const manuales = (await readdir(AQUI)).filter((f) => f.endsWith('.html'));
const usadas = new Set();
for (const manual of manuales) {
  const html = await readFile(path.join(AQUI, manual), 'utf8');
  for (const [, nombre] of html.matchAll(/capturas\/op-([\w-]+\.png)/g)) usadas.add(nombre);
}

let hechas = 0;
for (const archivo of [...usadas].sort()) {
  const origen = path.join(CAPTURAS, archivo);
  const destino = path.join(CAPTURAS, `op-${archivo}`);

  const imagen = sharp(origen);
  let ancho;
  try {
    ({ width: ancho } = await imagen.metadata());
  } catch {
    // La original no está: se regenera con `docs/capturas.mjs`. No se para la
    // tanda por una, pero se dice cuál falta.
    console.log(`  · ${archivo} — NO ESTÁ, se deja la op- que hubiera`);
    continue;
  }

  await imagen
    // withoutEnlargement: una captura estrecha —el formulario, una fila— no se
    // estira hasta 1300, que la dejaría borrosa por agrandar píxeles.
    .resize({ width: Math.min(ANCHO, ancho ?? ANCHO), withoutEnlargement: true })
    .png({ palette: true, effort: 8 })
    .toFile(destino);

  const { size } = await stat(destino);
  console.log(`  · op-${archivo} — ${Math.round(size / 1024)} KB`);
  hechas++;
}

console.log(`\n${hechas} capturas optimizadas.`);
