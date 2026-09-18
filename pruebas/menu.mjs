/**
 * Menús responsivos: hamburguesa en la web y cajón en la plataforma.
 * Antes la navegación se apretujaba contra el botón de tema en móvil.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/caps';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3100';

const ok = [];
const mal = [];
const check = (n, c, d) => (c ? ok : mal).push(d ? `${n} — ${d}` : n);

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ================= Web pública ================= */
for (const [w, h] of [[320, 568], [390, 844], [768, 900]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  const ham = p.getByRole('button', { name: 'Abrir el menú' });
  check(`web ${w}px · hay hamburguesa`, await ham.isVisible());
  check(`web ${w}px · el nav de escritorio está oculto`, !(await p.locator('header nav a', { hasText: 'Método' }).first().isVisible()));

  // Nada se pisa en la cabecera
  const solapa = await p.evaluate(() => {
    const els = [...document.querySelectorAll('header > div > *')].map((e) => e.getBoundingClientRect());
    for (let i = 0; i < els.length; i++)
      for (let j = i + 1; j < els.length; j++)
        if (els[i].right > els[j].left + 1 && els[j].right > els[i].left + 1) return true;
    return false;
  });
  check(`web ${w}px · la cabecera no se solapa`, !solapa);

  await ham.click();
  await p.waitForTimeout(450);
  const panel = p.locator('#menu-movil');
  check(`web ${w}px · el menú abre`, await panel.getByRole('link', { name: 'Formaciones' }).isVisible());
  check(`web ${w}px · el menú tiene Entrar`, await panel.getByRole('link', { name: 'Entrar' }).isVisible());
  await p.screenshot({ path: `${OUT}/menu-web-${w}.png` });

  const desborda = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`web ${w}px · el menú no desborda`, !desborda);

  await panel.getByRole('link', { name: 'Formaciones' }).click();
  await p.waitForTimeout(800);
  check(
    `web ${w}px · navega y cierra el menú`,
    new URL(p.url()).pathname === '/formaciones' && !(await p.locator('#menu-movil').isVisible())
  );

  await ctx.close();
}

/* Escritorio: la hamburguesa no debe aparecer */
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  check('web 1440px · sin hamburguesa', !(await p.getByRole('button', { name: 'Abrir el menú' }).isVisible()));
  check('web 1440px · nav completo visible', await p.locator('header nav a', { hasText: 'Método' }).first().isVisible());
  check('web 1440px · botón Entrar visible', await p.locator('header a', { hasText: 'Entrar' }).first().isVisible());
  await ctx.close();
}

/* ================= Plataforma ================= */
for (const [w, h] of [[320, 568], [390, 844]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  const lateralFuera = await p.evaluate(() => {
    const el = document.querySelector('#menu-plataforma');
    return el ? el.getBoundingClientRect().right <= 1 : false;
  });
  check(`plataforma ${w}px · el cajón arranca cerrado`, lateralFuera);
  check(`plataforma ${w}px · hay hamburguesa`, await p.getByRole('button', { name: 'Abrir el menú' }).isVisible());

  await p.getByRole('button', { name: 'Abrir el menú' }).click();
  await p.waitForTimeout(550);
  check(`plataforma ${w}px · el cajón abre`, await p.getByRole('button', { name: 'Mis clientas', exact: true }).isVisible());
  check(`plataforma ${w}px · el cajón tiene los roles`, await p.getByRole('button', { name: 'Sorela (admin)', exact: true }).isVisible());
  await p.screenshot({ path: `${OUT}/menu-plataforma-${w}.png` });

  await p.getByRole('button', { name: 'Mis clientas', exact: true }).click();
  await p.waitForTimeout(600);
  const cerrado = await p.evaluate(() => {
    const el = document.querySelector('#menu-plataforma');
    return el ? el.getBoundingClientRect().right <= 1 : false;
  });
  check(`plataforma ${w}px · al elegir sección se cierra`, cerrado);
  check(`plataforma ${w}px · ha cambiado de vista`, await p.getByText('Clientas activas').isVisible());

  const desborda = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`plataforma ${w}px · sin desbordamiento`, !desborda);

  await ctx.close();
}

/* Escritorio: la lateral es fija y sin hamburguesa */
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  check('plataforma 1440px · sin hamburguesa', !(await p.getByRole('button', { name: 'Abrir el menú' }).isVisible()));
  check('plataforma 1440px · la lateral está a la vista', await p.getByRole('button', { name: 'Mis clientas', exact: true }).isVisible());
  await ctx.close();
}

/* ================= Logotipo de Google ================= */
{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/entrar', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const colores = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Continuar con Google/.test(b.textContent || ''));
    const svg = btn?.querySelector('svg');
    return svg ? [...svg.querySelectorAll('path')].map((x) => x.getAttribute('fill')) : [];
  });
  const oficiales = ['#EA4335', '#4285F4', '#FBBC05', '#34A853'];
  check('login · el botón lleva el logotipo oficial de Google', oficiales.every((c) => colores.includes(c)), colores.join(' '));
  check('login · sin cartel de maqueta', !(await p.getByText(/Maqueta para revisión/).isVisible().catch(() => false)));
  await p.screenshot({ path: `${OUT}/login-google.png` });
  await ctx.close();
}

await nav.close();

console.log('OK (' + ok.length + ')');
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
} else ok.forEach((n) => console.log('  ✓ ' + n));
process.exit(mal.length ? 1 : 0);
