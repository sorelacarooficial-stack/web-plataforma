/**
 * Captura la home entera, sección por sección, para poder revisarla sin
 * desplegar. Recorre la página de arriba abajo esperando a que cada bloque
 * termine su animación de entrada antes de fotografiarlo.
 *
 *   node pruebas/inicio-capturas.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';

const OUT =
  process.env.OUT ||
  '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/inicio';
const B = process.env.BASE || 'http://localhost:3100';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const NOMBRES = [
  'hero',
  'marquesina',
  'dos-puertas',
  'el-problema',
  'la-cita',
  'que-cambia',
  'quien-esta-detras',
  'formaciones',
  'comunidad-beta',
  'lista-de-espera',
  'para-clientas',
  'testimonios',
  'preguntas',
  'cierre',
];

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function capturar(ancho, alto, sufijo, movil) {
  const ctx = await nav.newContext({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: movil ? 2 : 1,
    isMobile: !!movil,
    hasTouch: !!movil,
    locale: 'es-ES',
    // Sin movimiento: el revelado al hacer scroll deja los bloques a opacidad 0
    // hasta que se pasa por ellos, y en una captura salen en blanco.
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);

  const total = await p.locator('main > section').count();

  for (let i = 0; i < total; i++) {
    const s = p.locator('main > section').nth(i);
    await s.scrollIntoViewIfNeeded();
    await p.waitForTimeout(700);
    const nombre = NOMBRES[i] || `seccion-${i + 1}`;
    const n = String(i + 1).padStart(2, '0');
    await s.screenshot({ path: `${OUT}/${n}-${nombre}${sufijo}.png` });
  }

  // El pie, que va fuera de <main>
  const pie = p.locator('footer');
  await pie.scrollIntoViewIfNeeded();
  await p.waitForTimeout(900);
  await pie.screenshot({ path: `${OUT}/${String(total + 1).padStart(2, '0')}-pie${sufijo}.png` });

  // El asistente abierto, que es parte de la home aunque flote
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Abrir el asistente Divine' }).click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${String(total + 2).padStart(2, '0')}-asistente${sufijo}.png` });

  await ctx.close();
  return total;
}

const n = await capturar(1440, 900, '', false);
console.log(`${n} secciones + pie + asistente en escritorio`);

await capturar(390, 844, '-movil', true);
console.log('lo mismo en móvil');

await nav.close();
console.log(`\nCapturas en ${OUT}`);
