/**
 * Las imágenes del dossier, en el formato que entiende una imprenta.
 *
 *   node docs/preparar-impresion.mjs
 *
 * Toma las de `public/alumnas/` —las que usa la web— y deja una copia en JPEG
 * en `docs/impresion/`, que es la que referencia `docs/ilustraciones.mjs`.
 *
 * POR QUÉ NO SE USAN LAS DE LA WEB DIRECTAMENTE. Porque son WebP, y Chromium,
 * que es quien imprime el PDF, no sabe guardar un WebP dentro de un PDF: lo
 * descomprime a mapa de bits sin comprimir. El mismo documento, con las mismas
 * imágenes, pesaba 13 MB en vez de 1,8 MB. Un dossier de 13 MB no se puede
 * enviar por correo, que es justo para lo que existe.
 *
 * La calidad 78 con submuestreo de color es deliberada: a 150 puntos por
 * pulgada sobre papel no se distingue de la original, y es la diferencia entre
 * un archivo que llega a una bandeja de entrada y otro que rebota.
 */
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGEN = path.join(AQUI, '..', 'public', 'alumnas');
const DESTINO = path.join(AQUI, 'impresion');

mkdirSync(DESTINO, { recursive: true });

let total = 0;
let cuantas = 0;
for (const archivo of readdirSync(ORIGEN).filter((f) => f.endsWith('.webp'))) {
  const salida = path.join(DESTINO, archivo.replace(/\.webp$/, '.jpg'));
  await sharp(path.join(ORIGEN, archivo))
    .jpeg({ quality: 78, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toFile(salida);
  total += statSync(salida).size;
  cuantas++;
}

console.log(`${cuantas} imágenes · ${Math.round(total / 1024)} kB en docs/impresion/`);
