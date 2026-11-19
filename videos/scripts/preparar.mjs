#!/usr/bin/env node
/**
 * Crudo + transcripción + ficha → vídeo base limpio y guion para Remotion.
 *
 *   node scripts/preparar.mjs <ficha.json>
 *
 * La ficha (fichas/<id>.json) dice:
 *   { "id": "ea-01", "numero": "01", "titulo": "…", "crudo": "/ruta/crudo.mov",
 *     "transcripcion": "/ruta/palabras.json",   // ElevenLabs Scribe (words[]: text,start,end,type)
 *     "claves": ["perfil", "juntas"],           // palabras en oro 600 + acercamiento
 *     "quitar": [[12.3, 14.1]],                 // tropiezos/repeticiones, en tiempo del CRUDO
 *     "tarjetas": [{ "desde": 8, "hasta": 13, … }], // en tiempo del CRUDO
 *     "cierre": "Completa tu perfil." }
 *
 * Hace: quita silencios largos (> 0,5 s → 0,22 s) y lo de «quitar», corrige
 * color (más cálido y limpio), deja la voz a −16 LUFS, pasa a 1920×1080 y
 * recoloca palabras y tarjetas en el tiempo nuevo. Sin transcripción, corta
 * con silencedetect y no pone subtítulos (solo para pruebas de estilo).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fichaRuta = process.argv[2];
if (!fichaRuta) {
  console.error('Uso: node scripts/preparar.mjs fichas/<id>.json');
  process.exit(1);
}
const ficha = JSON.parse(readFileSync(fichaRuta, 'utf8'));
const MARGEN = 0.12; // aire antes y después de cada frase
const SILENCIO_MAX = 0.5;

const duracionCrudo = Number(
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ficha.crudo]).toString().trim(),
);

/* 1 · Palabras (ElevenLabs Scribe) */
let palabras = [];
if (ficha.transcripcion && existsSync(ficha.transcripcion)) {
  const t = JSON.parse(readFileSync(ficha.transcripcion, 'utf8'));
  const lista = t.words ?? t.transcripts?.[0]?.words ?? t;
  palabras = lista
    .filter((w) => (w.type ?? 'word') === 'word' && String(w.text).trim())
    .map((w) => ({ texto: String(w.text).trim(), desde: Number(w.start), hasta: Number(w.end) }));
}

/* 2 · Tramos que se quedan */
const dentro = (s, rangos) => rangos.some(([a, b]) => s >= a && s < b);
const quitar = ficha.quitar ?? [];
let tramos = [];
if (palabras.length) {
  const vivas = palabras.filter((p) => !dentro((p.desde + p.hasta) / 2, quitar));
  let a = Math.max(0, vivas[0].desde - MARGEN);
  let b = vivas[0].hasta + MARGEN;
  for (const p of vivas.slice(1)) {
    const hueco = p.desde - (b - MARGEN);
    const cruzaQuitar = quitar.some(([qa, qb]) => qa < p.desde && qb > b - MARGEN);
    if (hueco > SILENCIO_MAX || cruzaQuitar) {
      tramos.push([a, b]);
      a = Math.max(b, p.desde - MARGEN);
    }
    b = p.hasta + MARGEN;
  }
  tramos.push([a, Math.min(b + 0.25, duracionCrudo)]);
  palabras = vivas;
} else {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-vn', '-i', ficha.crudo, '-af', `silencedetect=n=-35dB:d=${SILENCIO_MAX}`, '-f', 'null', '-'], {
    encoding: 'utf8',
  }).stderr;
  const s = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const e = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  let a = 0;
  s.forEach((ini, i) => {
    const fin = e[i] ?? duracionCrudo;
    if (ini > a + 0.3) tramos.push([a, ini + 0.15]);
    a = Math.max(0, fin - 0.12);
  });
  if (a < duracionCrudo - 0.3) tramos.push([a, duracionCrudo]);
}

/* 3 · Tiempo del crudo → tiempo nuevo */
const acumulado = [];
let suma = 0;
for (const [a, b] of tramos) {
  acumulado.push(suma);
  suma += b - a;
}
const nuevo = (s) => {
  for (let i = 0; i < tramos.length; i++) {
    const [a, b] = tramos[i];
    if (s < a) return acumulado[i];
    if (s <= b) return acumulado[i] + (s - a);
  }
  return suma;
};

/* 4 · Vídeo base */
const carpeta = join(RAIZ, 'public', ficha.id);
mkdirSync(carpeta, { recursive: true });
const base = join(carpeta, 'base.mp4');
// Cada tramo se corta por separado (el 4K entero en un solo filtro no cabe en memoria) y luego se unen.
const COLOR =
  'scale=1920:1080:flags=lanczos,eq=contrast=1.05:brightness=0.01:saturation=1.07:gamma=0.98,colorbalance=rs=0.03:gs=0.005:bs=-0.035:rm=0.02:bm=-0.02:rh=0.01:bh=-0.015,unsharp=5:5:0.35,format=yuv420p';
const tmp = join(carpeta, 'tramos');
mkdirSync(tmp, { recursive: true });
const lista = tramos.map(([a, b], i) => {
  const salida = join(tmp, `${String(i).padStart(3, '0')}.mkv`);
  const d = b - a;
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', a.toFixed(3), '-i', ficha.crudo, '-t', d.toFixed(3),
    '-vf', COLOR, '-af', `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, d - 0.03).toFixed(3)}:d=0.03`,
    '-r', '30', '-c:v', 'libx264', '-crf', '15', '-preset', 'fast', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '1', salida,
  ]);
  return `file '${salida}'`;
});
writeFileSync(join(tmp, 'lista.txt'), lista.join('\n'));
const voz = 'highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=9';
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'lista.txt'), '-af', voz, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', base], { stdio: 'inherit' });
rmSync(tmp, { recursive: true, force: true });

/* 5 · Guion para Remotion */
const claves = (ficha.claves ?? []).map((c) => c.toLowerCase());
const limpia = (s) => s.toLowerCase().replace(/[.,;:!?¡¿«»"]/g, '');
const pal = palabras.map((p) => ({ texto: p.texto, desde: +nuevo(p.desde).toFixed(3), hasta: +nuevo(p.hasta).toFixed(3), clave: claves.includes(limpia(p.texto)) || undefined }));
const acercamientos = [];
for (const p of pal) if (p.clave && !acercamientos.some((a) => Math.abs(a - p.desde) < 4)) acercamientos.push(p.desde);
const guion = {
  id: ficha.id,
  numero: ficha.numero,
  titulo: ficha.titulo,
  base: `${ficha.id}/base.mp4`,
  duracion: +suma.toFixed(3),
  palabras: pal,
  tarjetas: (ficha.tarjetas ?? []).map((t) => ({ ...t, desde: +nuevo(t.desde).toFixed(3), hasta: +nuevo(t.hasta).toFixed(3) })),
  acercamientos: ficha.acercamientos ?? acercamientos,
  cierre: ficha.cierre,
  musica: existsSync(join(RAIZ, 'public', 'musica', 'cama.mp3')) ? 'musica/cama.mp3' : undefined,
};
mkdirSync(join(RAIZ, 'guiones'), { recursive: true });
writeFileSync(join(RAIZ, 'guiones', `${ficha.id}.json`), JSON.stringify(guion, null, 2));
console.log(`✓ ${ficha.id}: ${duracionCrudo.toFixed(1)} s → ${suma.toFixed(1)} s, ${tramos.length} tramos, ${pal.length} palabras`);
