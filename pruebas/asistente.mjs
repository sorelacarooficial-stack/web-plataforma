/**
 * Comprueba que el panel del asistente no se come la pantalla.
 *
 * El fallo original, medido: a 320 px los cinco chips de sugerencias envolvían
 * en cinco filas y ocupaban 230 px de los 448 disponibles, dejando la ventana
 * de mensajes en 73 px. Y una palabra larga sin espacios estiraba la burbuja
 * hasta 821 px dentro de un panel de 292.
 */
import { chromium } from 'playwright';

const B = process.env.BASE || 'http://localhost:3100';
const ANCHOS = [
  [320, 568],
  [360, 640],
  [390, 844],
  [480, 800],
  [768, 900],
  [1440, 900],
];

const ok = [];
const mal = [];
const check = (n, c, detalle) => (c ? ok : mal).push(detalle ? `${n} — ${detalle}` : n);

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const [w, h] of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Abrir el asistente Divine' }).click();
  await p.waitForTimeout(500);

  const medir = () =>
    p.evaluate(() => {
      const caja = (s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const panel = document.querySelector('section[aria-label="Asistente Divine"]');
      const msgs = panel?.querySelector('[aria-live]');
      const chips = [...(panel?.children ?? [])].find((c) => c.querySelector('button') && !c.matches('form') && c !== panel.firstElementChild && c !== msgs);
      const burbujas = [...(msgs?.querySelectorAll('p') ?? [])].map((el) => ({
        sw: el.scrollWidth,
        cw: el.clientWidth,
      }));
      const r = panel?.getBoundingClientRect();
      return {
        panel: r ? { t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } : null,
        msgs: msgs ? { h: Math.round(msgs.getBoundingClientRect().height) } : null,
        chipsH: chips ? Math.round(chips.getBoundingClientRect().height) : 0,
        burbujas,
        dentroVentana: r ? r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= -1 : false,
        desbordaDoc: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });

  const abierto = await medir();
  check(`${w}px · el panel cabe en la ventana`, abierto.dentroVentana);
  check(`${w}px · el chat no desborda la página`, !abierto.desbordaDoc);

  // Lo que importa no es el porcentaje absoluto, sino que las sugerencias no
  // ocupen más que la propia conversación: ese era el fallo (230 px de chips
  // contra 73 px de mensajes).
  check(
    `${w}px · los chips no ocupan más que los mensajes`,
    abierto.chipsH <= abierto.msgs.h,
    `chips ${abierto.chipsH}px vs mensajes ${abierto.msgs.h}px`
  );

  // Palabra larga sin espacios
  await p.locator('input[aria-label="Escribe tu pregunta"]').fill('a'.repeat(40));
  // Exacto: desde que el hero tiene «Enviarme la información», un nombre
  // parcial encaja con dos botones distintos de la página.
  await p.getByRole('button', { name: 'Enviar', exact: true }).click();
  await p.waitForTimeout(800);

  const lleno = await medir();
  const rota = lleno.burbujas.find((b) => b.sw > b.cw + 2);
  check(`${w}px · una palabra larga no rompe la burbuja`, !rota, rota ? `${rota.sw}px en ${rota.cw}px` : '');
  check(`${w}px · con conversación, los chips desaparecen`, lleno.chipsH === 0);
  check(
    `${w}px · la ventana de mensajes tiene alto usable`,
    lleno.msgs.h >= 160,
    `${lleno.msgs?.h}px`
  );
  check(`${w}px · el panel sigue dentro de la ventana`, lleno.dentroVentana);

  await ctx.close();
}

await nav.close();

console.log('OK (' + ok.length + ')');
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
} else {
  ok.forEach((n) => console.log('  ✓ ' + n));
}
process.exit(mal.length ? 1 : 0);
