#!/usr/bin/env node
/**
 * Guion → MP4 final (1920×1080, H.264, faststart) + póster.
 *
 *   node scripts/render.mjs <id> [--salida ../public/empieza-aqui/01.mp4] [--fotogramas 1.5,6,20]
 *
 * Con --fotogramas solo saca PNG de esos segundos (para revisar el estilo
 * antes de renderizar entero).
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const args = process.argv.slice(2);
const id = args[0];
const opcion = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const guion = JSON.parse(readFileSync(join(RAIZ, 'guiones', `${id}.json`), 'utf8'));

const serveUrl = await bundle({ entryPoint: join(RAIZ, 'src', 'index.ts'), publicDir: join(RAIZ, 'public') });
const browserExecutable = CHROMIUM;
const chromiumOptions = { gl: 'swangle' };
const composition = await selectComposition({ serveUrl, id: 'Leccion', inputProps: guion, browserExecutable, chromiumOptions });

const fotogramas = opcion('--fotogramas');
mkdirSync(join(RAIZ, 'salida'), { recursive: true });
if (fotogramas) {
  for (const s of fotogramas.split(',').map(Number)) {
    const output = join(RAIZ, 'salida', `${id}-${s}s.png`);
    await renderStill({ serveUrl, composition, inputProps: guion, frame: Math.round(s * 30), output, browserExecutable, chromiumOptions });
    console.log('✓', output);
  }
  process.exit(0);
}

let ultimo = -1;
const tmp = join(RAIZ, 'salida', `${id}.tmp.mp4`);
await renderMedia({
  serveUrl,
  composition,
  inputProps: guion,
  codec: 'h264',
  crf: 20,
  audioBitrate: '160k',
  outputLocation: tmp,
  browserExecutable,
  chromiumOptions,
  concurrency: Number(process.env.HILOS ?? 3),
  onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== ultimo) { ultimo = p; console.log(`${id} ${p * 10}%`); } },
});
const salida = resolve(opcion('--salida') ?? join(RAIZ, 'salida', `${id}.mp4`));
mkdirSync(dirname(salida), { recursive: true });
// Re-codifica a ~1,6 Mb/s de media con buena calidad y moov al principio para que arranque al momento.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-maxrate', '3M', '-bufsize', '6M', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', salida]);
const poster = salida.replace(/\.mp4$/, '.jpg');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '2.2', '-i', salida, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=1280:-1', poster]);
console.log(`\n✓ ${salida}\n✓ ${poster}`);
renameSync(tmp, tmp + '.hecho');
