/**
 * Comprueba los fallos que encontró la auditoría visual, en los mismos anchos
 * donde aparecieron. Cada bloque cita la medida original.
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

/* === 1) Asistente en apaisado: la cabecera y la × se recortaban === */
for (const [w, h] of [[640, 360], [740, 360]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Abrir el asistente Divine' }).click();
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const panel = document.querySelector('section[aria-label="Asistente Divine"]');
    const cerrar = panel?.querySelector('button[aria-label="Cerrar el asistente"]');
    const pr = panel.getBoundingClientRect();
    const cr = cerrar.getBoundingClientRect();
    return {
      cerrarDentro: cr.top >= pr.top - 1 && cr.bottom <= pr.bottom + 1 && cr.height > 0,
      panelDentro: pr.top >= -1 && pr.bottom <= innerHeight + 1,
    };
  });
  check(`apaisado ${w}×${h} · la × de cerrar es alcanzable`, m.cerrarDentro);
  check(`apaisado ${w}×${h} · el panel cabe en la ventana`, m.panelDentro);
  await p.screenshot({ path: `${OUT}/aud-apaisado-${w}.png` });
  await ctx.close();
}

/* === 4) /metodo desbordaba a 320 px (único scroll horizontal de la web) === */
for (const ruta of ['/', '/metodo', '/formaciones', '/comunidad', '/terapeutas', '/sobre', '/contacto', '/entrar', '/plataforma']) {
  const ctx = await nav.newContext({ viewport: { width: 320, height: 568 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + ruta, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const d = await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  check(`320px · ${ruta} sin scroll horizontal`, d.sw <= d.cw + 1, `${d.sw}/${d.cw}`);
  await ctx.close();
}

/* === 3) El flotante tapaba botones de conversión === */
{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  for (const [ruta, texto] of [
    ['/formaciones/formacion-base', 'Reservar plaza'],
    ['/comunidad', 'Apuntarme a la lista'],
  ]) {
    await p.goto(B + ruta, { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    const choca = await p.evaluate((t) => {
      const lanz = document.querySelector('[aria-label="Abrir el asistente Divine"]');
      if (!lanz) return false;
      const l = lanz.getBoundingClientRect();
      const objetivos = [...document.querySelectorAll('a, button')].filter((e) =>
        (e.textContent || '').trim().toLowerCase().includes(t.toLowerCase())
      );
      return objetivos.some((e) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0) return false;
        return r.right > l.left && r.left < l.right && r.bottom > l.top && r.top < l.bottom;
      });
    }, texto);
    check(`1280px · el flotante no tapa «${texto}»`, !choca);
  }

  // El pie ya reserva hueco para el flotante
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  // behavior instant: la página usa scroll suave y un salto de 9000 px no da
  // tiempo a terminar antes de medir.
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await p.waitForTimeout(700);
  const tapaPie = await p.evaluate(() => {
    const lanz = document.querySelector('[aria-label="Abrir el asistente Divine"]');
    const cop = [...document.querySelectorAll('footer p')].pop();
    if (!lanz || !cop) return false;
    const l = lanz.getBoundingClientRect();
    const r = cop.getBoundingClientRect();
    return r.right > l.left && r.left < l.right && r.bottom > l.top && r.top < l.bottom;
  });
  check('1280px · el flotante no tapa el copyright', !tapaPie);
  await p.screenshot({ path: `${OUT}/aud-pie-flotante.png` });
  await ctx.close();
}

/* === 5, 6, 7) Mapa: ficha recortada, leyenda pisada, etiquetas fuera === */
for (const [w, h] of [[320, 568], [390, 844], [768, 900], [1280, 900]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/terapeutas', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1400);

  // Etiquetas de ciudad dentro del mapa
  const fuera = await p.evaluate(() => {
    const svg = document.querySelector('svg[role="img"]');
    if (!svg) return [];
    const caja = svg.getBoundingClientRect();
    return [...svg.querySelectorAll('text')]
      .filter((t) => /^[A-ZÁÉÍÓÚ]/i.test(t.textContent || '') && (t.textContent || '').length > 3)
      .map((t) => ({ txt: t.textContent, r: t.getBoundingClientRect() }))
      .filter((o) => o.r.right > caja.right + 1 || o.r.left < caja.left - 1)
      .map((o) => o.txt);
  });
  check(`mapa ${w}px · las etiquetas de ciudad caben`, fuera.length === 0, fuera.join(', '));

  // Leyenda y atribución no se pisan
  const pisan = await p.evaluate(() => {
    const ley = [...document.querySelectorAll('div')].find((d) => /CONSULTAS DIVINE|consultas? con ese filtro/i.test(d.textContent || '') && d.children.length === 0);
    const fte = [...document.querySelectorAll('div')].find((d) => /Natural Earth/.test(d.textContent || '') && d.children.length === 0);
    if (!ley || !fte) return false;
    const a = ley.getBoundingClientRect();
    const b = fte.getBoundingClientRect();
    return a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top;
  });
  check(`mapa ${w}px · leyenda y atribución no se pisan`, !pisan);

  /* Aquí se pulsaba el punto de «Marta» para medir que su ficha cabía dentro
     del mapa y que la × se alcanzaba. Marta era una de las seis terapeutas
     inventadas que se retiraron: no hay ningún punto que pulsar, y la prueba
     se quedaba treinta segundos esperando a que apareciera.

     Lo que se comprueba ahora es que el mapa vacío no finge: ni un punto ni
     una ficha. Cuando haya terapeutas de verdad, este bloque vuelve a medir la
     ficha, que el código de la ficha sigue ahí. */
  const puntos = await p.locator('svg[role="img"] g[aria-label]').count();
  check(`mapa ${w}px · sin terapeutas, no hay ningún punto`, puntos === 0, puntos + ' puntos');
  check(
    `mapa ${w}px · lo dice con palabras`,
    /todav[íi]a no hay terapeutas/i.test(await p.locator('main').innerText())
  );
  await p.screenshot({ path: `${OUT}/aud-mapa-${w}.png` });
  await ctx.close();
}

/* === 9) Objetivos táctiles === */
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/formaciones/formacion-base', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const pequenos = await p.evaluate(() => {
    const sel = 'footer a, header button, a[class*="volver"], a[class*="enlace-fino"]';
    return [...document.querySelectorAll(sel)]
      .map((e) => ({ t: (e.textContent || '').trim().slice(0, 28), r: e.getBoundingClientRect() }))
      .filter((o) => o.r.width > 0 && o.r.height < 40)
      .map((o) => `${o.t} (${Math.round(o.r.height)}px)`);
  });
  check('390px · objetivos táctiles de al menos 40px', pequenos.length === 0, pequenos.slice(0, 4).join(' · '));
  await ctx.close();
}

/* === 10) Contraste de --muted en tema claro === */
{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  await ctx.addInitScript(() => localStorage.setItem('divine-tema', 'claro'));
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const ratio = await p.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((n) => {
        const v = n / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
    const bg = getComputedStyle(document.body).backgroundColor;
    const hex = muted.replace('#', '');
    const rgb = `rgb(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)})`;
    const a = lum(rgb) + 0.05;
    const b2 = lum(bg) + 0.05;
    return Math.round((Math.max(a, b2) / Math.min(a, b2)) * 100) / 100;
  });
  check('tema claro · --muted llega a 4.5:1', ratio >= 4.5, `${ratio}:1`);
  await ctx.close();
}

await nav.close();

console.log('OK (' + ok.length + ')');
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
} else ok.forEach((n) => console.log('  ✓ ' + n));
process.exit(mal.length ? 1 : 0);
