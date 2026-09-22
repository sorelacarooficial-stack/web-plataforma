/**
 * El inicio rehecho para captación: ventana emergente, chatbot enlazado,
 * cuenta atrás y las secciones nuevas.
 *
 *   node pruebas/inicio-nuevo.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT =
  process.env.OUT ||
  '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/nuevo';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3100';

const ok = [];
const mal = [];
const check = (n, c, d) => (c ? ok : mal).push(d ? `${n} — ${d}` : n);

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ================= Contenido del inicio ================= */
{
  const ctx = await nav.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-ES',
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  p.on('pageerror', (e) => errores.push('excepción: ' + e.message));
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);

  const h1 = await p.locator('h1').innerText();
  check('el titular es el nuevo', /Juventud linf[áa]tica y ganglionar en tus manos/i.test(h1), h1);

  const texto = await p.locator('main').innerText();
  check('está la frase nueva de Sorela', /frecuencia diferente/i.test(texto));
  check('explica qué es la Técnica Divine', /primero abrir, despu[ée]s drenar/i.test(texto));
  check('están los tres pilares', /observar antes de tocar/i.test(texto));
  check('está la formación online', /formaci[óo]n online/i.test(texto));
  check('está la formación presencial', /formaci[óo]n presencial/i.test(texto));
  check('dice el orden online primero', /primero la formaci[óo]n online/i.test(texto));
  check('anuncia fechas en Sudamérica', /sudam[ée]rica/i.test(texto));
  check('la comunidad cuesta 47 €', /47\s*€/.test(texto));
  check('dice precio fundador', /fundador/i.test(texto));
  check('dice la fecha de apertura', /17 de octubre/i.test(texto));
  check('está el mapa de terapeutas', /localiza tu terapeuta/i.test(texto));

  /* Nada de reclamos sanitarios: el filtro que evita una sanción. */
  const PROHIBIDO = [
    /toxina/i,
    /desintoxic/i,
    /\d\s*(a\s*\d\s*)?litros/i,
    /defensas|inmunitar|inmunidad/i,
    /hormonal|menstrual/i,
    /antiinflamatori|analg[ée]sic/i,
    /linfedema|di[áa]stasis|postoperatori/i,
    /celulitis/i,
    /quema|elimina.{0,12}grasa|p[ée]rdida de peso/i,
    /la [úu]nica t[ée]cnica|n[ºo°]\s*1|n[úu]mero uno/i,
    /20\.?000 casos/i,
    /cura|garantiza/i,
  ];
  const encontrados = PROHIBIDO.filter((r) => r.test(texto)).map((r) => String(r));
  check('sin reclamos sanitarios prohibidos', encontrados.length === 0, encontrados.join(' , '));

  check('sin errores de consola', errores.length === 0, errores.slice(0, 2).join(' | '));

  /* ---- Cuenta atrás ---- */
  const cuenta = await p.evaluate(() => {
    const cifras = [...document.querySelectorAll('li span')]
      .map((s) => s.textContent.trim())
      .filter((t) => /^\d{2,}$/.test(t));
    return cifras.slice(0, 4);
  });
  check('la cuenta atrás muestra cifras', cuenta.length >= 4, cuenta.join(':'));
  check(
    'la cuenta atrás no está a cero',
    cuenta.some((c) => Number(c) > 0),
    cuenta.join(':')
  );

  await ctx.close();
}

/* ================= La ventana emergente ================= */
for (const [w, h, movil] of [
  [1440, 900, false],
  [390, 844, true],
]) {
  const ctx = await nav.newContext({
    viewport: { width: w, height: h },
    isMobile: movil,
    hasTouch: movil,
    locale: 'es-ES',
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  const et = movil ? 'móvil' : 'escritorio';
  const abrir = p.getByRole('button', { name: 'Quiero la información' }).first();
  check(`${et} · el botón principal está a la vista`, await abrir.isVisible());

  await abrir.click();
  await p.waitForTimeout(500);

  const dlg = p.locator('dialog[open]');
  check(`${et} · la ventana abre`, await dlg.isVisible());
  check(`${et} · pide nombre`, await dlg.getByLabel('Nombre', { exact: true }).isVisible());
  check(`${et} · pide correo`, await dlg.getByLabel('Correo', { exact: true }).isVisible());
  check(`${et} · pide teléfono`, await dlg.getByLabel('Teléfono', { exact: true }).isVisible());
  check(
    `${et} · tiene consentimiento sin premarcar`,
    (await dlg.getByRole('checkbox').isVisible()) && !(await dlg.getByRole('checkbox').isChecked())
  );

  // El foco tiene que estar dentro: es lo que hace que se pueda usar con teclado.
  const focoDentro = await p.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    return d ? d.contains(document.activeElement) : false;
  });
  check(`${et} · el foco entra en la ventana`, focoDentro);

  await p.screenshot({ path: `${OUT}/modal-${et}.png` });

  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  check(`${et} · Escape la cierra`, (await p.locator('dialog[open]').count()) === 0);

  await ctx.close();
}

/* ================= El chatbot desde los botones ================= */
{
  const ctx = await nav.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'es-ES',
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  await p.getByRole('button', { name: 'Agendar una cita' }).first().click();
  await p.waitForTimeout(1300);

  const panel = p.locator('section[aria-label="Asistente Divine"]');
  check('«Agendar una cita» abre el chatbot', await panel.isVisible());
  const conversacion = await panel.innerText();
  check('el chatbot recibe la pregunta ya escrita', /agendar una cita/i.test(conversacion));
  check(
    'el chatbot contesta ofreciendo guardar el sitio',
    /guardo el sitio|te confirmo|opciones de agenda/i.test(conversacion),
    conversacion.slice(-160).replace(/\n/g, ' ')
  );
  await p.screenshot({ path: `${OUT}/chatbot-cita.png` });

  // Y no debe prometer fechas inventadas
  check('el chatbot no promete fechas cerradas', !/14 al 16 de noviembre|30 de enero/i.test(conversacion));

  await ctx.close();
}

{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: 'Consultar fechas' }).click();
  await p.waitForTimeout(1300);
  const conv = await p.locator('section[aria-label="Asistente Divine"]').innerText();
  check('«Consultar fechas» abre el chatbot con la consulta', /sudam[ée]rica/i.test(conv));
  check(
    'y contesta que están por confirmar',
    /a punto de confirmarse|todav[íi]a no te puedo dar/i.test(conv),
    conv.slice(-160).replace(/\n/g, ' ')
  );
  await ctx.close();
}

await nav.close();

console.log('OK (' + ok.length + ')');
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
} else ok.forEach((n) => console.log('  ✓ ' + n));
process.exit(mal.length ? 1 : 0);
