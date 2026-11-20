#!/usr/bin/env node
/**
 * Crudo(s) + transcripción + ficha → vídeo base limpio y guion para Remotion.
 *
 *   node scripts/preparar.mjs fichas/<id>.json
 *
 * Ficha (ver fichas/*.json):
 *   id, numero, titulo, cierre       — lo que se pinta
 *   partes: [{ crudo, transcripcion, quitar?: [[a,b]] }]
 *                                    — uno o varios crudos, en orden; `quitar` en
 *                                      segundos de ESE crudo (tropiezos, repeticiones)
 *   corregir: { "IVAL": "Divine", "T": null }
 *                                    — texto del subtítulo (null = no se pinta)
 *   claves: ["módulos", …]           — palabras en oro 600 + acercamiento 106 %
 *   tarjetas: [{ en: "palabra", hasta?: "palabra", dura?: s, … }]
 *                                    — ancladas a palabras (primera aparición; «palabra#2»
 *                                      para la segunda). Resto de campos: ver src/tipos.ts.
 *
 * Quita silencios > 0,5 s, corrige color (más cálido y limpio), deja la voz a
 * −16 LUFS, pasa a 1920×1080 y recoloca todo al tiempo nuevo.
 */
import { execFileSync } from 'node:child_process';
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
// «$CRUDOS/x.mov» → carpeta de la variable CRUDOS (los crudos no van al repositorio).
const ruta = (r) => resolve(RAIZ, String(r).replace(/^\$(\w+)/, (_, v) => {
  if (!process.env[v]) throw new Error(`Falta la variable ${v} (carpeta de los crudos)`);
  return process.env[v];
}));
const partes = (ficha.partes ?? [{ crudo: ficha.crudo, transcripcion: ficha.transcripcion, quitar: ficha.quitar }]).map((p) => ({
  ...p,
  crudo: ruta(p.crudo),
  transcripcion: ruta(p.transcripcion),
}));
const MARGEN_ANTES = 0.14;
const MARGEN_DESPUES = 0.2;
const SILENCIO_MAX = 0.5;

const duracionDe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const dentro = (s, rangos) => rangos.some(([a, b]) => s >= a && s < b);

/* 1 · Palabras vivas y tramos de cada parte */
const tramos = []; // { parte, a, b }
const palabras = []; // { texto, parte, desde, hasta }
partes.forEach((p, n) => {
  const dur = duracionDe(p.crudo);
  const t = JSON.parse(readFileSync(p.transcripcion, 'utf8'));
  const quitar = p.quitar ?? [];
  const vivas = (t.words ?? t)
    .filter((w) => (w.type ?? 'word') === 'word' && String(w.text).trim())
    .map((w) => ({ texto: String(w.text).trim(), parte: n, desde: Number(w.start), hasta: Number(w.end) }))
    .filter((w) => !dentro((w.desde + w.hasta) / 2, quitar));
  let a = Math.max(0, vivas[0].desde - MARGEN_ANTES);
  let b = vivas[0].hasta + MARGEN_DESPUES;
  for (const w of vivas.slice(1)) {
    const hueco = w.desde - (b - MARGEN_DESPUES);
    const cruzaQuitar = quitar.some(([qa, qb]) => qa < w.desde && qb > b - MARGEN_DESPUES);
    if (hueco > SILENCIO_MAX || cruzaQuitar) {
      tramos.push({ parte: n, a, b });
      a = Math.max(b, w.desde - MARGEN_ANTES);
    }
    b = w.hasta + MARGEN_DESPUES;
  }
  tramos.push({ parte: n, a, b: Math.min(b + 0.3, dur) });
  palabras.push(...vivas);
});

/* 2 · Tiempo de un crudo → tiempo nuevo */
const inicio = [];
let suma = 0;
for (const t of tramos) {
  inicio.push(suma);
  suma += t.b - t.a;
}
const nuevo = (parte, s) => {
  let ultimo = 0;
  for (let i = 0; i < tramos.length; i++) {
    const { parte: p, a, b } = tramos[i];
    if (p !== parte) continue;
    if (s < a) return inicio[i];
    if (s <= b) return inicio[i] + (s - a);
    ultimo = inicio[i] + (b - a);
  }
  return ultimo;
};

/* 3 · Vídeo base: cada tramo por separado (el 4K entero no cabe en memoria) y luego se unen */
const carpeta = join(RAIZ, "public", ficha.id);
const soloGuion = process.argv.includes("--solo-guion") && existsSync(join(carpeta, "base.mp4"));
const tmp = join(carpeta, 'tramos');
const COLOR =
  'scale=1920:1080:flags=lanczos,eq=contrast=1.05:brightness=0.01:saturation=1.07:gamma=0.98,colorbalance=rs=0.03:gs=0.005:bs=-0.035:rm=0.02:bm=-0.02:rh=0.01:bh=-0.015,unsharp=5:5:0.35,format=yuv420p';
// --solo-guion: rehace solo el guion (tarjetas, claves) si el base.mp4 ya existe.
if (!soloGuion) {
mkdirSync(tmp, { recursive: true });
const lista = tramos.map(({ parte, a, b }, i) => {
  const salida = join(tmp, `${String(i).padStart(3, '0')}.mkv`);
  const d = b - a;
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', a.toFixed(3), '-i', partes[parte].crudo, '-t', d.toFixed(3),
    '-vf', COLOR, '-af', `aresample=48000,afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, d - 0.04).toFixed(3)}:d=0.04`,
    '-r', '30', '-c:v', 'libx264', '-crf', '15', '-preset', 'fast', '-threads', '2', '-c:a', 'pcm_s16le', '-ac', '1', salida,
  ]);
  return `file '${salida}'`;
});
writeFileSync(join(tmp, 'lista.txt'), lista.join('\n'));
const voz = 'highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000';
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'lista.txt'), '-af', voz, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-threads', '2', '-c:a', 'aac', '-b:a', '192k', join(carpeta, 'base.mp4')], { stdio: 'inherit' });
rmSync(tmp, { recursive: true, force: true });
}

/* 4 · Guion para Remotion */
const limpia = (s) => s.toLowerCase().replace(/[.,;:!?¡¿«»"]/g, '');
const corregir = ficha.corregir ?? {};
const claves = (ficha.claves ?? []).map(limpia);
const pal = palabras
  .map((p) => {
    const texto = p.texto in corregir ? corregir[p.texto] : p.texto;
    return { texto, desde: +nuevo(p.parte, p.desde).toFixed(3), hasta: +nuevo(p.parte, p.hasta).toFixed(3), clave: claves.includes(limpia(texto ?? '')) || undefined };
  })
  .filter((p) => p.texto);

const ancla = (ref) => {
  const [txt, n = '1'] = String(ref).split('#');
  const hits = pal.filter((p) => limpia(p.texto) === limpia(txt));
  const p = hits[Number(n) - 1];
  if (!p) throw new Error(`${ficha.id}: no encuentro la palabra «${ref}»`);
  return p;
};
const tarjetas = (ficha.tarjetas ?? []).map(({ en, hasta, dura, ...resto }) => {
  const desde = Math.max(0, ancla(en).desde - 0.15);
  const fin = hasta ? ancla(hasta).hasta + 0.4 : desde + (dura ?? 5);
  return { ...resto, desde: +desde.toFixed(3), hasta: +Math.min(fin, suma - 0.1).toFixed(3) };
});
const acercamientos = [];
for (const p of pal) if (p.clave && !acercamientos.some((a) => Math.abs(a - p.desde) < 4)) acercamientos.push(p.desde);

const guion = {
  id: ficha.id,
  numero: ficha.numero,
  titulo: ficha.titulo,
  base: `${ficha.id}/base.mp4`,
  duracion: +suma.toFixed(3),
  palabras: pal,
  tarjetas,
  acercamientos,
  cierre: ficha.cierre,
  musica: existsSync(join(RAIZ, 'public', 'musica', 'cama.mp3')) ? 'musica/cama.mp3' : undefined,
};
mkdirSync(join(RAIZ, 'guiones'), { recursive: true });
writeFileSync(join(RAIZ, 'guiones', `${ficha.id}.json`), JSON.stringify(guion, null, 2));
console.log(`✓ ${ficha.id}: → ${suma.toFixed(1)} s, ${tramos.length} tramos, ${pal.length} palabras, ${tarjetas.length} tarjetas`);
