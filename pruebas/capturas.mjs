import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/caps';
mkdirSync(OUT, { recursive: true });

const PAGINAS = [
  { ruta: '/', nombre: 'home', full: false },
  { ruta: '/metodo', nombre: 'metodo', full: false },
  { ruta: '/formaciones', nombre: 'formaciones', full: true },
  { ruta: '/formaciones/formacion-base', nombre: 'curso', full: false },
  { ruta: '/comunidad', nombre: 'comunidad', full: false },
  { ruta: '/terapeutas', nombre: 'terapeutas', full: false },
  { ruta: '/terapeutas/marta-ibanez', nombre: 'terapeuta', full: false },
  { ruta: '/sobre', nombre: 'sobre', full: false },
  { ruta: '/contacto', nombre: 'contacto', full: true },
];

const errores = [];

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const tema of ['claro', 'oscuro']) {
  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'es-ES',
  });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('divine-tema', t); } catch {}
  }, tema);

  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`[${tema}] ${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => errores.push(`[${tema}] ${page.url()} :: ${e.message}`));

  for (const p of PAGINAS) {
    await page.goto('http://localhost:3000' + p.ruta, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    await page.screenshot({
      path: `${OUT}/${p.nombre}-${tema}.png`,
      fullPage: p.full,
    });
  }
  await ctx.close();
}

// Móvil
const movil = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'es-ES',
});
const m = await movil.newPage();
for (const r of [['/', 'home'], ['/terapeutas', 'terapeutas']]) {
  await m.goto('http://localhost:3000' + r[0], { waitUntil: 'networkidle' });
  await m.waitForTimeout(1400);
  await m.screenshot({ path: `${OUT}/movil-${r[1]}.png` });
}
await movil.close();

await navegador.close();

console.log(errores.length ? 'ERRORES DE CONSOLA:\n' + [...new Set(errores)].join('\n') : 'sin errores de consola');
