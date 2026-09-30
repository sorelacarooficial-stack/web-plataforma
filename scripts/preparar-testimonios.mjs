/**
 * Deja los vídeos de los testimonios listos para la web.
 *
 *   npm run testimonios -- ~/Descargas/testimonios
 *
 * Coge los vídeos de una carpeta —tal y como salen del móvil o de Drive— y
 * escribe en `public/testimonios/` TRES archivos por cada uno. Después hay que
 * pegar las rutas en `TESTIMONIOS`, en `lib/contenido.ts`; el script imprime el
 * bloque ya escrito para copiarlo.
 *
 * POR QUÉ TRES ARCHIVOS Y NO UNO.
 *
 *   1. `-bucle.mp4` — los primeros segundos, SIN SONIDO y en pequeño. Es lo
 *      que se ve corriendo en la portada, en las cinco tarjetas a la vez.
 *      Pesa unos cientos de kilobytes, así que las cinco juntas cuestan menos
 *      que una foto grande.
 *   2. `.mp4` — el vídeo entero, con sonido y a 720. Solo se baja cuando
 *      alguien se para en una tarjeta y la abre.
 *   3. `.jpg` — la carátula, para el primer instante y para cuando alguien ha
 *      pedido que las cosas no se muevan.
 *
 * Con un solo archivo habría que elegir entre dos males: o el bucle de la
 * portada se baja el vídeo entero —cinco veces medio minuto de vídeo, en la
 * primera pantalla, con datos— o la portada enseña una foto fija. Partiéndolo,
 * la portada se mueve y cuesta poco.
 *
 * Los seis originales pesaban 173 MB entre todos. Un móvil con datos tardaría
 * minutos solo en la portada.
 *
 * Hace falta ffmpeg. En Ubuntu: `sudo apt install ffmpeg`.
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const correr = promisify(execFile);

const ORIGEN = process.argv[2];
const DESTINO = path.join(process.cwd(), 'public', 'testimonios');

/** Alto del vídeo completo. 720 basta de sobra para una tarjeta de 270 px. */
const ALTO = 720;

/** Alto del bucle mudo. La tarjeta mide 272 px; 540 es el doble, para
    pantallas de mucha densidad, y no más. */
const ALTO_BUCLE = 540;

/** Cuántos segundos dura el bucle mudo. Los mismos que espera el componente. */
const SEGUNDOS_BUCLE = 6;

/** Segundo del que se saca la carátula. El 0 suele pillar el parpadeo. */
const SEGUNDO_CARATULA = 1.2;

/**
 * Hasta qué altura del original se recorta el bucle y la carátula.
 *
 * ESTO ESTÁ AQUÍ POR LOS SUBTÍTULOS. Los vídeos vienen con el subtítulo
 * quemado en la imagen, más o menos a media altura. En la tarjeta de la
 * portada, que mide 272 px, ese texto no se lee —es demasiado pequeño— pero sí
 * se ve: un rectángulo gris flotando en medio de la cara, y encima repitiendo
 * el nombre que ya está escrito debajo. Recortando por encima de esa franja
 * queda un primer plano limpio, que además es mejor encuadre para una tarjeta
 * estrecha que el plano entero.
 *
 * El vídeo completo NO se recorta: ahí el subtítulo se lee y hace falta.
 */
const ALTO_UTIL = 0.53;

/**
 * Cuánto se acerca el recorte: el ancho de la ventana, sobre el ancho original.
 *
 * Cuanto más pequeño, más primer plano y menos fondo. 0,333 deja la cara
 * ocupando alrededor de la mitad del ancho de la tarjeta, que es encuadre de
 * retrato. Con la ventana grande sobraba fondo por arriba y las tarjetas se
 * veían vacías.
 *
 * Y no se puede agrandar sin romper la alineación: dos de las cuatro se
 * sentaron más bajas, con los ojos casi tocando la franja del subtítulo, así
 * que por debajo de ellas no queda sitio. Una ventana mayor no cabría ahí y
 * habría que empujarla hacia arriba, que es exactamente lo que dejaba sus
 * caras a una altura distinta de las demás.
 */
const ACERCAMIENTO = 0.333;

/**
 * Cuánto aire queda por encima de la cabeza, sobre el alto de la tarjeta.
 *
 * ESTO ES LO QUE ALINEA UNAS CON OTRAS. Recortar siempre desde arriba no vale:
 * cada persona se sentó a una altura distinta, así que unas salían con medio
 * palmo de techo encima y otras con la frente pegada al borde. Puestas en fila
 * se ve enseguida, aunque no se sepa decir por qué.
 *
 * Se fija por la coronilla y no por la línea de los ojos, y es por algo que
 * costó una vuelta entera: la coronilla se ve de un vistazo en un fotograma y
 * se mide sin equivocarse. Los ojos hay que estimarlos, y estimándolos un poco
 * bajos —que es lo que pasó— el recorte sube y corta las cabezas.
 */
const CORONILLA = 0.1;

/**
 * Dónde está la cara de cada uno, de 0 a 1 sobre el original: `x` el centro a
 * lo ancho, `y` la coronilla a lo alto. Va en un `encuadre.json` junto a los
 * vídeos, con el nombre del archivo sin extensión:
 *
 *   { "6": { "x": 0.617, "y": 0.146 } }
 *
 * Lo que no esté listado se centra a lo ancho y se da por hecho que la cabeza
 * empieza donde suele empezar en un plano medio.
 */
const ENCUADRE_POR_DEFECTO = { x: 0.5, y: 0.2 };

if (!ORIGEN) {
  console.error('Falta la carpeta con los vídeos.\n\n  npm run testimonios -- ruta/a/la/carpeta\n');
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

/* El encuadre de cada uno, si lo hay. Sin el fichero, todos centrados. */
let encuadres = {};
try {
  encuadres = JSON.parse(await readFile(path.join(ORIGEN, 'encuadre.json'), 'utf8'));
} catch {
  /* No hay, y no pasa nada. */
}

console.log(`${entradas.length} vídeos en ${ORIGEN}\n`);

/**
 * El recorte vertical para el bucle y la carátula.
 *
 * Se queda con la parte de arriba —hasta ALTO_UTIL— y, de ella, la franja de
 * 9:16 centrada donde diga el encuadre. Los números salen pares porque H.264
 * no admite dimensiones impares.
 */
function recorte(ancho, alto, cara) {
  const techo = alto * ALTO_UTIL;

  let w = Math.floor((ancho * ACERCAMIENTO) / 2) * 2;
  let h = Math.floor(((w * 16) / 9) / 2) * 2;

  /* Si con ese acercamiento la ventana no cabe por encima del subtítulo, se
     acerca un poco más. Pasa con quien se sentó más bajo: sus ojos están
     cerca de la franja del subtítulo y por debajo ya no queda sitio. */
  if (h > techo) {
    h = Math.floor(techo / 2) * 2;
    w = Math.floor(((h * 9) / 16) / 2) * 2;
  }

  const cabeza = alto * cara.y;
  /* La ventana se coloca para dejar CORONILLA de aire por encima de la cabeza,
     y se empuja dentro de los límites si se sale. Al empujarla el aire cambia
     un poco; es preferible eso a colarse en el subtítulo. */
  const y = Math.max(0, Math.min(techo - h, Math.round(cabeza - h * CORONILLA)));
  const x = Math.max(0, Math.min(ancho - w, Math.round(ancho * cara.x - w / 2)));

  return `crop=${w}:${h}:${Math.floor(x / 2) * 2}:${Math.floor(y / 2) * 2}`;
}

const hechos = [];

for (const archivo of entradas) {
  const entrada = path.join(ORIGEN, archivo);
  const nombre = path.parse(archivo).name.replace(/[^\w-]/g, '-').toLowerCase();
  const salidaVideo = path.join(DESTINO, `${nombre}.mp4`);
  const salidaBucle = path.join(DESTINO, `${nombre}-bucle.mp4`);
  const salidaPoster = path.join(DESTINO, `${nombre}.jpg`);

  const antes = (await stat(entrada)).size;
  const medida = await medir(entrada);
  const cara = { ...ENCUADRE_POR_DEFECTO, ...(encuadres[nombre] ?? {}) };
  const corte = recorte(medida.ancho, medida.alto, cara);

  // ---- El vídeo entero, con sonido ----
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

  // ---- El bucle mudo de la portada ----
  await correr('ffmpeg', [
    '-y',
    '-i', entrada,
    '-t', String(SEGUNDOS_BUCLE),
    '-vf', `${corte},scale=-2:${ALTO_BUCLE}`,
    '-c:v', 'libx264',
    // Más compresión que el completo: esto se ve a 272 px y en movimiento,
    // donde el ojo perdona mucho más que en una tarjeta abierta.
    '-crf', '30',
    '-preset', 'slow',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    // Sin pista de sonido, no en silencio: una pista muda igual pesa y hay
    // navegadores que se resisten a arrancar solos si el vídeo tiene audio.
    '-an',
    salidaBucle,
  ]);

  // ---- La carátula ----
  await correr('ffmpeg', [
    '-y',
    '-ss', String(SEGUNDO_CARATULA),
    '-i', entrada,
    '-frames:v', '1',
    // La carátula lleva el mismo recorte que el bucle: es lo que se ve en su
    // lugar mientras carga y cuando el movimiento está desactivado, así que si
    // encuadraran distinto se vería el salto.
    '-vf', `${corte},scale=-2:${ALTO_BUCLE}`,
    '-q:v', '4',
    salidaPoster,
  ]);

  const despues = (await stat(salidaVideo)).size;
  const bucle = (await stat(salidaBucle)).size;
  const poster = (await stat(salidaPoster)).size;
  hechos.push({ nombre, despues, bucle, poster });

  console.log(
    `  ✓ ${archivo.padEnd(14)} ${medida.ancho}×${medida.alto} · ${medida.segundos}s · ` +
      `${mb(antes)} MB → ${mb(despues)} MB  (bucle ${kb(bucle)} kB · carátula ${kb(poster)} kB)`
  );
}

const enPortada = hechos.reduce((s, h) => s + h.bucle + h.poster, 0);
const total = hechos.reduce((s, h) => s + h.despues + h.bucle + h.poster, 0);
console.log(`\n${hechos.length} listos.`);
console.log(`  La portada carga ${mb(enPortada)} MB: solo los bucles y las carátulas.`);
console.log(`  El resto, ${mb(total - enPortada)} MB, solo si alguien abre una tarjeta.`);

console.log(`
Ahora pega esto en TESTIMONIOS, dentro de lib/contenido.ts, y rellena el
nombre y la frase de cada una. La frase NO es opcional: es lo que se lee
mientras el vídeo corre en silencio, que es casi siempre.
`);

for (const { nombre } of hechos) {
  console.log(`  {
    nombre: '',
    video: {
      tipo: 'archivo',
      src: '/testimonios/${nombre}.mp4',
      bucle: '/testimonios/${nombre}-bucle.mp4',
      poster: '/testimonios/${nombre}.jpg',
    },
    frase: '',
    de: '',
    lugar: '',
  },`);
}
