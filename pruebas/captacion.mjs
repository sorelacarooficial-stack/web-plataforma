/**
 * Captación: el camino completo, con un Apps Script de mentira levantado aquí
 * mismo para poder probar el éxito sin tocar Google.
 *
 * Comprueba lo que de verdad puede salir mal el día de la exposición:
 *  · que el formulario entre en la primera pantalla de un móvil,
 *  · que un fallo del servidor NO se disfrace de «gracias»,
 *  · que el dato que llega a Google sea el correcto y esté normalizado.
 *
 *   node pruebas/captacion.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const OUT =
  process.env.OUT ||
  '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/captacion';
mkdirSync(OUT, { recursive: true });

const ok = [];
const mal = [];
const check = (n, c, d) => (c ? ok : mal).push(d ? `${n} — ${d}` : n);

/* ---------- Apps Script de mentira ---------- */
const recibido = [];
let modoFallo = false;
const falso = createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => (cuerpo += c));
  req.on('end', () => {
    if (modoFallo) {
      // Lo que Google devuelve de verdad cuando el despliegue no es público:
      // una página HTML, no JSON. Es el fallo más común al montarlo.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><title>Se requiere autorización</title></html>');
      return;
    }
    recibido.push(JSON.parse(cuerpo));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
});
await new Promise((r) => falso.listen(4599, r));

/* ---------- La web, con el destino apuntando al script de mentira ----------
   El servidor arranca en su propio grupo de procesos y se mata el grupo
   entero al terminar. Con un kill normal muere «npx» pero sobrevive el Next
   que cuelga de él, y la siguiente ejecución acaba midiendo contra la versión
   vieja: da fallos que no existen y esconde los que sí. */
const PUERTO = 3199;
const SECRETO = 'secreto-de-prueba-12345';

async function puertoLibre() {
  try {
    await fetch(`http://localhost:${PUERTO}/`, { signal: AbortSignal.timeout(700) });
    return false;
  } catch {
    return true;
  }
}

if (!(await puertoLibre())) {
  console.error(
    `El puerto ${PUERTO} está ocupado por otro servidor. Ciérralo antes:\n  fuser -k ${PUERTO}/tcp`
  );
  process.exit(1);
}

const web = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  env: {
    ...process.env,
    APPS_SCRIPT_URL: 'http://127.0.0.1:4599/exec',
    APPS_SCRIPT_SECRETO: SECRETO,
  },
  stdio: 'ignore',
  detached: true,
});

const apagar = () => {
  try {
    process.kill(-web.pid, 'SIGKILL');
  } catch {}
};
process.on('exit', apagar);

const B = `http://localhost:${PUERTO}`;
let arrancado = false;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(B + '/')).ok) {
      arrancado = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!arrancado) {
  console.error('El servidor de pruebas no ha arrancado.');
  apagar();
  process.exit(1);
}

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/** Abre la ventana emergente del inicio y rellena sus tres campos. */
async function rellenar(p, datos = {}) {
  const d = {
    nombre: 'Ana Ruiz',
    correo: 'ana.ruiz@ejemplo.com',
    whatsapp: '600 11 22 33',
    ...datos,
  };
  if ((await p.locator('dialog[open]').count()) === 0) {
    await p.getByRole('button', { name: 'Quiero la información' }).first().click();
    await p.waitForTimeout(450);
  }
  const d1 = p.locator('dialog[open]');
  await d1.getByPlaceholder('Tu nombre').fill(d.nombre);
  await d1.getByPlaceholder('tucorreo@ejemplo.com').fill(d.correo);
  await d1.getByPlaceholder('600 00 00 00').fill(d.whatsapp);
  return d;
}

/* ================= 1. El formulario cabe sin hacer scroll ================= */
for (const [w, h, nombre] of [
  [390, 844, 'iPhone normal'],
  [360, 740, 'Android normal'],
  [375, 667, 'iPhone SE'],
  [430, 932, 'iPhone grande'],
]) {
  const ctx = await nav.newContext({
    viewport: { width: w, height: h },
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  await p.goto(B + '/?e=expo', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);

  // Lo que tiene que verse sin hacer scroll ya no es un formulario entero,
  // sino el botón que lo abre. El formulario se mide después, dentro de la
  // ventana, donde el alto de la página ya no lo condiciona.
  const m = await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /Quiero la información/.test(x.textContent || '')
    );
    const h1 = document.querySelector('h1');
    const cab = document.querySelector('header');
    return {
      botonAbajo: b ? b.getBoundingClientRect().bottom : null,
      botonAlto: b ? b.getBoundingClientRect().height : 0,
      tituloArriba: h1.getBoundingClientRect().top,
      cabeceraAbajo: cab.getBoundingClientRect().bottom,
      alto: window.innerHeight,
      desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });

  const utilConBarra = m.alto * 0.88;
  check(
    `${nombre} ${w}×${h} · el botón principal se ve sin scroll, con la barra del navegador puesta`,
    m.botonAbajo !== null && m.botonAbajo <= utilConBarra,
    `botón ${Math.round(m.botonAbajo)} / útil ${Math.round(utilConBarra)} de ${m.alto}`
  );
  check(
    `${nombre} ${w}×${h} · el botón principal se puede tocar con el dedo`,
    m.botonAlto >= 44,
    `${Math.round(m.botonAlto)}px`
  );
  check(
    `${nombre} ${w}×${h} · la cabecera no tapa el titular`,
    m.tituloArriba >= m.cabeceraAbajo - 1,
    `titular en ${Math.round(m.tituloArriba)}, cabecera acaba en ${Math.round(m.cabeceraAbajo)}`
  );
  check(`${nombre} ${w}×${h} · sin scroll horizontal`, !m.desborda);

  // Y ahora, dentro de la ventana: campos tocables y sin zoom de Safari.
  await p.getByRole('button', { name: 'Quiero la información' }).first().click();
  await p.waitForTimeout(450);
  const dentro = await p.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    const campos = [...d.querySelectorAll('input:not([type="checkbox"]):not([tabindex="-1"])')];
    const casilla = d.querySelector('input[type="checkbox"]');
    const env = [...d.querySelectorAll('button')].find((b) =>
      /Enviarme la información/.test(b.textContent || '')
    );
    return {
      minimoCampo: Math.min(...campos.map((c) => c.getBoundingClientRect().height)),
      tipoLetra: campos.map((c) => parseFloat(getComputedStyle(c).fontSize)),
      altoCasilla: casilla.closest('label').getBoundingClientRect().height,
      envioVisible: env ? env.getBoundingClientRect().bottom <= window.innerHeight : false,
      cuantos: campos.length,
    };
  });
  check(`${nombre} ${w}×${h} · la ventana pide tres campos`, dentro.cuantos === 3, String(dentro.cuantos));
  check(
    `${nombre} ${w}×${h} · los campos se pueden tocar con el dedo`,
    dentro.minimoCampo >= 44,
    `${Math.round(dentro.minimoCampo)}px`
  );
  check(
    `${nombre} ${w}×${h} · Safari no hará zoom al tocar un campo`,
    dentro.tipoLetra.every((t) => t >= 16),
    dentro.tipoLetra.join('/')
  );
  check(
    `${nombre} ${w}×${h} · la casilla se puede marcar con el dedo`,
    dentro.altoCasilla >= 40,
    `${Math.round(dentro.altoCasilla)}px de etiqueta`
  );
  check(`${nombre} ${w}×${h} · el botón de enviar entra en la ventana`, dentro.envioVisible);

  await p.screenshot({ path: `${OUT}/movil-${w}x${h}.png` });
  await ctx.close();
}

/* ================= 2. Envío correcto ================= */
{
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  await p.goto(B + '/?e=expo', { waitUntil: 'networkidle' });
  await rellenar(p);

  await p.locator('dialog[open]').getByRole('button', { name: 'Enviarme la información' }).click();
  await p.waitForTimeout(400);
  check(
    'sin aceptar el consentimiento · no se envía y lo avisa',
    (await p.getByText('Necesito que lo aceptes').count()) > 0 && recibido.length === 0
  );

  await p.locator('dialog[open]').getByRole('checkbox').check();
  await p.locator('dialog[open]').getByRole('button', { name: 'Enviarme la información' }).click();
  await p.waitForTimeout(1200);

  check('envío correcto · confirma en pantalla', (await p.getByText('Ya estás dentro, Ana').count()) > 0);
  check('envío correcto · ha llegado un contacto al script', recibido.length === 1);

  const d = recibido[0] || {};
  check('el teléfono llega normalizado con prefijo', d.whatsapp === '+34600112233', d.whatsapp);
  check('el correo llega en minúsculas', d.correo === 'ana.ruiz@ejemplo.com', d.correo);
  check('llega el secreto compartido', d.secreto === SECRETO);
  check('llega marcado de dónde viene (el QR)', d.origen === 'expo', d.origen);
  check('llega el consentimiento', d.consentimiento === true);
  check('NO llega el campo señuelo', !('empresa' in d), JSON.stringify(Object.keys(d)));
  check('no se pide perfil: solo los tres campos', !('perfil' in d), JSON.stringify(Object.keys(d)));

  await p.screenshot({ path: `${OUT}/exito.png` });
  await ctx.close();
}

/* ================= 3. Si Google falla, no se dice «gracias» ================= */
{
  modoFallo = true;
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await rellenar(p, { nombre: 'Marta Gil', correo: 'marta@ejemplo.com' });
  await p.locator('dialog[open]').getByRole('checkbox').check();
  await p.locator('dialog[open]').getByRole('button', { name: 'Enviarme la información' }).click();
  await p.waitForTimeout(1500);

  check('si Google falla · NO se dice que ha ido bien', (await p.getByText('Ya estás dentro').count()) === 0);
  check('si Google falla · se avisa a la persona', (await p.getByText('No he podido guardarlo').count()) > 0);
  check(
    'si Google falla · se ofrece una salida para no perder el contacto',
    (await p.getByRole('link', { name: /WhatsApp|Instagram/ }).count()) > 0
  );
  await p.screenshot({ path: `${OUT}/fallo.png` });
  modoFallo = false;
  await ctx.close();
}

/* ================= 4. Validación en el servidor ================= */
{
  const enviar = (body) =>
    fetch(B + '/api/captar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const bueno = {
    nombre: 'Ana Ruiz',
    correo: 'ana@ejemplo.com',
    whatsapp: '600111222',
    consentimiento: true,
  };

  const antes = recibido.length;
  check('el servidor rechaza sin consentimiento', (await enviar({ ...bueno, consentimiento: false })).status === 400);
  check('el servidor rechaza un correo inválido', (await enviar({ ...bueno, correo: 'ana@' })).status === 400);
  check('el servidor rechaza un móvil inválido', (await enviar({ ...bueno, whatsapp: '12' })).status === 400);
  check('el servidor rechaza un cuerpo que no es JSON', (await enviar('x')).status === 400);
  check('nada de lo rechazado ha llegado a Google', recibido.length === antes);

  // Quinto envío seguido desde la misma IP: el freno tiene que saltar.
  let frenado = false;
  for (let i = 0; i < 8; i++) {
    const r = await enviar({ ...bueno, correo: `ana${i}@ejemplo.com` });
    if (r.status === 429) frenado = true;
  }
  check('el freno por IP corta el envío en ráfaga', frenado);
}

/* ================= 5. Accesibilidad de los campos ================= */
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Quiero la información' }).first().click();
  await p.waitForTimeout(450);
  for (const n of ['Nombre', 'Correo', 'Teléfono']) {
    check(`el campo ${n} tiene nombre accesible`, (await p.getByLabel(n, { exact: true }).count()) > 0);
  }
  const teclados = await p.evaluate(() => ({
    correo: document.querySelector('input[type="email"]')?.inputMode,
    tel: document.querySelector('input[type="tel"]')?.inputMode,
  }));
  check('el correo abre el teclado de correo', teclados.correo === 'email');
  check('el móvil abre el teclado numérico', teclados.tel === 'tel');
  await ctx.close();
}

await nav.close();
apagar();
falso.close();

console.log('OK (' + ok.length + ')');
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
} else ok.forEach((n) => console.log('  ✓ ' + n));
process.exit(mal.length ? 1 : 0);
