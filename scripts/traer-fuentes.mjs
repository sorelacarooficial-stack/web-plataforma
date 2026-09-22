/**
 * Trae las tipografías de Google al repositorio.
 *
 *   node scripts/traer-fuentes.mjs
 *
 * Por qué existe: con next/font/google, cada compilación va a buscar los
 * archivos a fonts.gstatic.com. Si ese día Google no responde —o la red por la
 * que sale el servidor de compilación no llega hasta allí—, la compilación
 * entera falla por una tipografía. Teniéndolas dentro, el resultado es el
 * mismo y no dependemos de nadie.
 *
 * Solo hay que volver a ejecutarlo si se cambia de tipografía o si Google
 * publica una versión nueva. El resultado se comprueba en app/fuentes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'app', 'fuentes');

/**
 * Google decide qué formato sirve según quién lo pida: a un navegador viejo le
 * manda .ttf y a uno moderno .woff2, que pesa la mitad. Sin este disfraz nos
 * llevaríamos los archivos grandes.
 */
const NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Se piden las versiones variables (el rango `300..600` en vez de pesos
 * sueltos): un solo archivo cubre todos los grosores y pesa menos que la suma
 * de los estáticos.
 */
const FAMILIAS = [
  { consulta: 'Cormorant+Garamond:ital,wght@0,300..600;1,300..600', nombre: 'cormorant-garamond' },
  { consulta: 'Jost:wght@300..500', nombre: 'jost' },
];

/**
 * Solo el subconjunto latino. Cubre todo el español —tildes, eñes, diéresis,
 * signos de apertura y comillas angulares—, así que el cirílico, el griego y
 * el vietnamita serían kilobytes que nadie va a leer.
 */
const SUBCONJUNTOS = new Set(['latin']);

mkdirSync(DESTINO, { recursive: true });

const resumen = [];

for (const { consulta, nombre } of FAMILIAS) {
  const url = `https://fonts.googleapis.com/css2?family=${consulta}&display=swap`;
  const css = await (await fetch(url, { headers: { 'User-Agent': NAVEGADOR } })).text();

  // Google precede cada bloque con un comentario que nombra el subconjunto:
  // /* latin */ @font-face { ... }. Partiendo por ese comentario quedan
  // alternados el nombre y su bloque.
  const trozos = css.split(/\/\*\s*([a-z-]+)\s*\*\//);

  for (let i = 1; i < trozos.length; i += 2) {
    const subconjunto = trozos[i];
    const bloque = trozos[i + 1];
    if (!SUBCONJUNTOS.has(subconjunto)) continue;

    const enlace = bloque.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (!enlace) continue;
    const estilo = bloque.match(/font-style:\s*(\w+)/)?.[1] ?? 'normal';

    const archivo = `${nombre}-${estilo}-${subconjunto}.woff2`;
    const datos = Buffer.from(await (await fetch(enlace[1])).arrayBuffer());
    writeFileSync(join(DESTINO, archivo), datos);

    resumen.push({
      archivo,
      estilo,
      subconjunto,
      bytes: datos.length,
      unicodeRange: bloque.match(/unicode-range:\s*([^;]+);/)?.[1].trim() ?? '',
    });
    console.log(`  ${archivo.padEnd(46)} ${(datos.length / 1024).toFixed(1).padStart(7)} KB`);
  }
}

writeFileSync(join(DESTINO, 'origen.json'), JSON.stringify(resumen, null, 1) + '\n');

const total = resumen.reduce((s, r) => s + r.bytes, 0);
console.log(`\n${resumen.length} archivos, ${(total / 1024).toFixed(1)} KB en total.`);
console.log('Si cambian los nombres, hay que actualizarlos en app/layout.tsx.');
