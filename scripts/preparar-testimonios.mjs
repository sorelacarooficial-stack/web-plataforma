/**
 * Deja los vídeos de los testimonios listos para la web.
 *
 *   npm run testimonios -- ~/Descargas/testimonios
 *
 * Coge los vídeos de una carpeta —tal y como salen del móvil o de Drive— y
 * escribe en `public/testimonios/` una versión comprimida de cada uno y su
 * carátula. Después hay que pegar las rutas en `TESTIMONIOS`, en
 * `lib/contenido.ts`; el script imprime el bloque ya escrito para copiarlo.
 *
 * POR QUÉ HAY QUE COMPRIMIRLOS Y NO SUBIRLOS TAL CUAL. Los seis que hay ahora
 * pesan 173 MB entre todos. Un móvil con datos tardaría minutos en cargar la
 * portada, y eso suponiendo que no se cansara antes. Bajados a 720 px de alto
 * y con un ritmo de datos razonable, los mismos seis se quedan en unos pocos
 * megas sin que se note en una pantalla de teléfono, que es donde se van a ver.
 *
 * Y NO SE CARGAN HASTA QUE ALGUIEN LOS PIDE: la portada enseña la carátula
 * —una imagen de 30 o 40 kB— y el vídeo solo empieza a bajar al pulsar. Ver
 * `components/Testimonios.tsx`.
 *
 * Hace falta ffmpeg. En Ubuntu: `sudo apt install ffmpeg`.
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const correr = promisify(execFile);

const ORIGEN = process.argv[2];
const DESTINO = path.join(process.cwd(), 'public', 'testimonios');

/** Alto al que se dejan. 720 basta de sobra para una tarjeta de 270 px. */
const ALTO = 720;

/** Segundo del que se saca la carátula. El 0 suele pillar el parpadeo. */
const SEGUNDO_CARATULA = 1.2;

if (!ORIGEN) {
  console.error(
    'Falta la carpeta con los vídeos.\n\n  npm run testimonios -- ruta/a/la/carpeta\n'
  );
  process.exit(1);
}

/** Si ffmpeg está instalado. Sin él no hay nada que hacer. */
async function hayFfmpeg() {
  try {
    await correr('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

if (!(await hayFfmpeg())) {
  console.error('No encuentro ffmpeg. En Ubuntu se instala con:\n\n  sudo apt install ffmpeg\n');
  process.exit(1);
}

/** Cuánto dura y de qué tamaño es, para poder decirlo al terminar. */
async function medir(archivo) {
  const { stdout } = await correr('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json',
    archivo,
  ]);
  const d = JSON.parse(stdout);
  const v = d.streams?.[0] ?? {};
  return {
    ancho: v.width ?? 0,
    alto: v.height ?? 0,
    segundos: Math.round(Number(d.format?.duration ?? 0)),
  };
}

const kb = (b) => Math.round(b / 1024);
const mb = (b) => (b / 1048576).toFixed(1);

await mkdir(DESTINO, { recursive: true });

const entradas = (await readdir(ORIGEN))
  .filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f))
  /* Por nombre y con orden numérico: los archivos se llaman 1, 2, 10, y un
     orden alfabético pondría el 10 detrás del 1. */
  .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

if (entradas.length === 0) {
  console.error(`No hay ningún vídeo en ${ORIGEN}`);
  process.exit(1);
}

console.log(`${entradas.length} vídeos en ${ORIGEN}\n`);

const hechos = [];

for (const archivo of entradas) {
  const entrada = path.join(ORIGEN, archivo);
  const nombre = path.parse(archivo).name.replace(/[^\w-]/g, '-').toLowerCase();
  const salidaVideo = path.join(DESTINO, `${nombre}.mp4`);
  const salidaPoster = path.join(DESTINO, `${nombre}.jpg`);

  const antes = (await stat(entrada)).size;
  const medida = await medir(entrada);

  await correr('ffmpeg', [
    '-y',
    '-i', entrada,
    // Se baja a ALTO de alto manteniendo la proporción. El -2 del ancho deja
    // que ffmpeg elija un número par, que es lo que H.264 necesita.
    '-vf', `scale=-2:${ALTO}`,
    '-c:v', 'libx264',
    // crf 26 y preset lento: tarda más en comprimir, una sola vez, y el
    // archivo sale bastante más pequeño con la misma pinta.
    '-crf', '26',
    '-preset', 'slow',
    // El perfil que entienden hasta los móviles viejos.
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    // faststart mueve el índice al principio del archivo: sin esto el
    // navegador tiene que descargarlo entero antes de empezar a verlo.
    '-movflags', '+faststart',
    '-c:a', 'aac',
    '-b:a', '96k',
    // Un solo canal: son personas hablando a la cámara del móvil, no música.
    '-ac', '1',
    salidaVideo,
  ]);

  await correr('ffmpeg', [
    '-y',
    '-ss', String(SEGUNDO_CARATULA),
    '-i', entrada,
    '-frames:v', '1',
    '-vf', `scale=-2:${ALTO}`,
    '-q:v', '4',
    salidaPoster,
  ]);

  const despues = (await stat(salidaVideo)).size;
  const poster = (await stat(salidaPoster)).size;
  hechos.push({ nombre, despues, poster });

  console.log(
    `  ✓ ${archivo.padEnd(14)} ${medida.ancho}×${medida.alto} · ${medida.segundos}s · ` +
      `${mb(antes)} MB → ${mb(despues)} MB  (carátula ${kb(poster)} kB)`
  );
}

const total = hechos.reduce((s, h) => s + h.despues + h.poster, 0);
console.log(`\n${hechos.length} listos · ${mb(total)} MB en total, carátulas incluidas.`);

console.log(`
Ahora pega esto en TESTIMONIOS, dentro de lib/contenido.ts, y rellena el
nombre y la frase de cada una. La frase NO es opcional: es lo que lee quien
no va a darle al play, que son casi todos.
`);

for (const { nombre } of hechos) {
  console.log(`  {
    nombre: '',
    video: { tipo: 'archivo', src: '/testimonios/${nombre}.mp4', poster: '/testimonios/${nombre}.jpg' },
    frase: '',
    de: '',
    lugar: '',
  },`);
}
