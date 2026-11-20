// Uso: node render.mjs [id-formato ...] [--fotogramas 0,40,90]
// Sin ids, renderiza todos. Con --fotogramas saca solo esas imágenes (para revisar).
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition, getCompositions } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

// ESCALA=0.6667 → copias de revisión a 720 de ancho directamente (las de Meta, a 1080, al final).
const ESCALA = Number(process.env.ESCALA || 1);
const BROWSER = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const args = process.argv.slice(2);
const iFot = args.indexOf('--fotogramas');
const fotogramas = iFot >= 0 ? args[iFot + 1].split(',').map(Number) : null;
const ids = args.filter((a, i) => !a.startsWith('--') && (iFot < 0 || i !== iFot + 1));

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const comps = await getCompositions(serveUrl, { browserExecutable: BROWSER });
const elegidas = ids.length ? comps.filter((c) => ids.includes(c.id)) : comps;
fs.mkdirSync('out', { recursive: true });

for (const c of elegidas) {
  const composition = await selectComposition({ serveUrl, id: c.id, browserExecutable: BROWSER });
  if (fotogramas) {
    for (const fr of fotogramas) {
      await renderStill({ serveUrl, composition, frame: fr, output: `out/${c.id}-${fr}.jpg`, imageFormat: 'jpeg', browserExecutable: BROWSER, scale: 0.5 });
    }
    console.log('fotogramas', c.id);
    continue;
  }
  const t = Date.now();
  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    crf: 18,
    outputLocation: `out/${c.id}.mp4`,
    browserExecutable: BROWSER,
    concurrency: 4,
    scale: ESCALA,
    jpegQuality: ESCALA < 1 ? 70 : 80,
    chromiumOptions: { gl: 'swangle' },
  });
  console.log('hecho', c.id, Math.round((Date.now() - t) / 1000), 's');
}
