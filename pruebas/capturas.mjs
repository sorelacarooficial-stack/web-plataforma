import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/* El puerto del servidor de desarrollo, el mismo que usan las demás pruebas.
   Estaba escrito a mano en dos sitios, y en el 3000, que es donde no está. */
const B = process.env.BASE || 'http://localhost:3100';

const OUT = '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/caps';
mkdirSync(OUT, { recursive: true });

const PAGINAS = [
  { ruta: '/', nombre: 'home', full: false },
  { ruta: '/metodo', nombre: 'metodo', full: false },
  { ruta: '/formaciones', nombre: 'formaciones', full: true },
  { ruta: '/comunidad', nombre: 'comunidad', full: false },
  { ruta: '/terapeutas', nombre: 'terapeutas', full: false },
  /* Aquí se fotografiaban dos páginas más: /formaciones/formacion-base y
     /terapeutas/marta-ibanez. La primera no existe —las formaciones no tienen
     página propia— y la segunda era una de las seis terapeutas inventadas que
     se retiraron. Las dos daban 404 y la captura salía siendo la página de
     «esto no existe», sin que nada lo dijera. */
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
    await page.goto(B + p.ruta, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    await page.screenshot({
      path: `${OUT}/${p.nombre}-${tema}.png`,
      fullPage: p.full,
      /*
       * caret: 'initial' para que Playwright no toque la página.
       *
       * Por defecto, antes de disparar la foto le mete a los campos un
       * `caret-color: transparent` para que no salga el cursor parpadeando. Lo
       * quita después, pero si la siguiente navegación empieza mientras tanto,
       * React encuentra en el DOM un atributo que no venía en el HTML del
       * servidor y canta un fallo de hidratación. Uno que no existe: lo ha
       * provocado la propia herramienta, y este archivo recoge los errores de
       * consola para revisarlos. Aquí no hay ningún campo con el foco puesto,
       * así que no hay cursor que esconder.
       */
      caret: 'initial',
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
  await m.goto(B + r[0], { waitUntil: 'networkidle' });
  await m.waitForTimeout(1400);
  await m.screenshot({ path: `${OUT}/movil-${r[1]}.png`, caret: 'initial' });
}
await movil.close();

await navegador.close();

console.log(errores.length ? 'ERRORES DE CONSOLA:\n' + [...new Set(errores)].join('\n') : 'sin errores de consola');
