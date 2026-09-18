/**
 * Convierte las fotos originales del bundle de diseño a WebP con un tamaño
 * razonable para web. Los originales pesan ~91 MB en total (hasta 4704×10188 px),
 * que es inservible en producción incluso pasando por el optimizador de Next.
 *
 *   node scripts/optimizar-imagenes.mjs
 *
 * Escribe en web/fotos/, que se importa estáticamente desde los componentes
 * para que Next calcule dimensiones y placeholder difuminado en el build.
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origen = resolve(raiz, '..', 'project', 'uploads');
const destinoFotos = join(raiz, 'fotos');
const destinoPublic = join(raiz, 'public');

/** @type {{ de: string, a: string, ancho: number, alto?: number, calidad?: number }[]} */
const FOTOS = [
  // Retrato vertical de Sorela: hero a pantalla completa y cabecera de "Sobre".
  // Es 4704×10188, así que se limita por altura, no por anchura.
  { de: 'Cuarta foto Sore.jpg.jpeg', a: 'sorela-retrato.webp', ancho: 1400, alto: 3000 },
  { de: '22.JPG.jpeg', a: 'sorela-alumna.webp', ancho: 1600 },
  { de: '26.JPG.jpeg', a: 'sorela-corrigiendo.webp', ancho: 1800 },
  { de: '_DSC6008.jpg', a: 'trabajo-lumbar.webp', ancho: 1400 },
  { de: '_DSC6175.jpg', a: 'formacion-pierna.webp', ancho: 1400 },
  { de: '_DSC6231.jpg', a: 'sesion-consulta.webp', ancho: 1400 },
  { de: '_DSC6349.jpg', a: 'valoracion-abdomen.webp', ancho: 1800 },
  { de: '_DSC6357.jpg', a: 'sesion-terapeuta.webp', ancho: 1400 },
  // Columna izquierda de la pantalla de acceso a la plataforma.
  { de: '_DSC6223.jpg', a: 'acceso-consulta.webp', ancho: 1400 },
  // Portadas de los cursos del aula de la plataforma (16:10).
  { de: '_DSC6143.jpg', a: 'aula-negocio.webp', ancho: 900 },
];

const LOGO = { de: 'logo_files-1789631085515-p3md.png', a: 'logo-sorela.png', alto: 160 };

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function convertir() {
  await mkdir(destinoFotos, { recursive: true });
  await mkdir(destinoPublic, { recursive: true });

  for (const f of FOTOS) {
    const entrada = join(origen, f.de);
    const salida = join(destinoFotos, f.a);
    const meta = await sharp(entrada).metadata();

    await sharp(entrada)
      .rotate() // respeta la orientación EXIF antes de redimensionar
      .resize({
        width: f.ancho,
        height: f.alto,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: f.calidad ?? 80, effort: 5 })
      .toFile(salida);

    const antes = await stat(entrada);
    const despues = await stat(salida);
    const dim = await sharp(salida).metadata();
    console.log(
      `${f.a.padEnd(26)} ${meta.width}×${meta.height} ${kb(antes.size).padStart(8)}` +
        `  →  ${dim.width}×${dim.height} ${kb(despues.size).padStart(8)}`
    );
  }

  // El logo mantiene PNG por la transparencia; en claro se oscurece por filtro CSS.
  const salidaLogo = join(destinoFotos, LOGO.a);
  await sharp(join(origen, LOGO.de))
    .resize({ height: LOGO.alto, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(salidaLogo);
  const logoMeta = await sharp(salidaLogo).metadata();
  console.log(`${LOGO.a.padEnd(26)} → ${logoMeta.width}×${logoMeta.height} ${kb((await stat(salidaLogo)).size)}`);

  // Favicon e icono de aplicación a partir del mismo logo.
  await sharp(join(origen, LOGO.de))
    .resize(512, 512, { fit: 'contain', background: { r: 23, g: 20, b: 15, alpha: 1 } })
    .png()
    .toFile(join(destinoPublic, 'icono.png'));
  console.log('icono.png                  → 512×512');

  const total = (await readdir(destinoFotos)).length;
  console.log(`\n${total} archivos en web/fotos/`);
}

convertir().catch((e) => {
  console.error(e);
  process.exit(1);
});
