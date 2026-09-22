/**
 * El titular nuevo es bastante más largo que el anterior. Esto comprueba que
 * en ningún ancho se sale de la caja, se come el botón ni desborda la pantalla.
 *
 *   node pruebas/hero.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT =
  process.env.OUT ||
  '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/hero';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3100';

const ok = [];
const mal = [];
const check = (n, c, d) => (c ? ok : mal).push(d ? `${n} — ${d}` : n);

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const [w, h, movil] of [
  [320, 568, true],
  [390, 844, true],
  [768, 1024, true],
  [1024, 768, false],
  [1280, 720, false],
  [1440, 900, false],
  [1920, 1080, false],
]) {
  const ctx = await nav.newContext({
    viewport: { width: w, height: h },
    isMobile: movil,
    hasTouch: movil,
    locale: 'es-ES',
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  const m = await p.evaluate(() => {
    const sec = document.querySelector('main > section');
    const h1 = document.querySelector('h1');
    const lede = h1.nextElementSibling;
    // Desde que el hero capta, su acción es el botón del formulario.
    const btn = [...sec.querySelectorAll('button')].find((b) =>
      /Enviarme la información/.test(b.textContent || '')
    );
    const firma = sec.querySelector('p:last-of-type');
    const caja = h1.parentElement;
    const r = (e) => e.getBoundingClientRect();
    return {
      seccion: r(sec),
      h1: r(h1),
      lede: r(lede),
      btn: r(btn),
      firma: r(firma),
      caja: r(caja),
      lineas: Math.round(r(h1).height / parseFloat(getComputedStyle(h1).lineHeight)),
      cuerpo: getComputedStyle(h1).fontSize,
      desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      textoH1: h1.textContent.trim(),
      textoBtn: btn.textContent.trim(),
    };
  });

  const et = `${w}px`;
  check(`${et} · el titular es el nuevo`, /mire entera/.test(m.textoH1), m.textoH1);
  check(`${et} · el hero pide el contacto`, /Enviarme la información/.test(m.textoBtn), m.textoBtn);
  check(`${et} · sin scroll horizontal`, !m.desborda);
  check(
    `${et} · la firma cabe dentro del hero`,
    m.firma.bottom <= m.seccion.bottom + 1,
    `firma ${Math.round(m.firma.bottom)} / hero ${Math.round(m.seccion.bottom)}`
  );
  check(
    `${et} · el titular no pisa el texto`,
    m.h1.bottom <= m.lede.top + 1,
    `h1 ${Math.round(m.h1.bottom)} / lede ${Math.round(m.lede.top)}`
  );
  check(
    `${et} · el botón no se sale por la derecha`,
    m.btn.right <= w - 8,
    `btn ${Math.round(m.btn.right)} / ancho ${w}`
  );
  check(
    `${et} · el titular no ocupa más de 5 líneas`,
    m.lineas <= 5,
    `${m.lineas} líneas a ${m.cuerpo}`
  );
  check(`${et} · el texto empieza dentro de la pantalla`, m.h1.top >= 0, `top ${Math.round(m.h1.top)}`);
  check(`${et} · sin errores de consola`, errores.length === 0, errores.join(' | '));

  await p.locator('main > section').first().screenshot({ path: `${OUT}/hero-${w}.png` });
  await ctx.close();
}

/* El titular también tiene que verse en modo oscuro */
{
  const ctx = await nav.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-ES',
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  check('oscuro · el titular está a la vista', await p.locator('h1').isVisible());
  await p.locator('main > section').first().screenshot({ path: `${OUT}/hero-oscuro.png` });
  await ctx.close();
}

await nav.close();

console.log('OK (' + ok.length + ')');
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
} else ok.forEach((n) => console.log('  ✓ ' + n));
process.exit(mal.length ? 1 : 0);
