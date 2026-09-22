import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/caps';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3100';

const ok = [];
const mal = [];
const check = (n, c) => (c ? ok : mal).push(n);
const errores = [];

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 950 }, locale: 'es-ES' });
const p = await ctx.newPage();
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));


/* ---------------------------------------------------------------------------
 * Desde que el acceso es real, esta suite necesita una sesión de Firebase.
 * Sin las variables de entorno configuradas no se puede abrir ninguna, así que
 * lo que se comprueba es lo que de verdad importa en ese caso: que la
 * plataforma NO se sirva. Las vistas de dentro se prueban cuando haya un
 * proyecto de Firebase de pruebas.
 * ------------------------------------------------------------------------- */
await p.goto(B + '/entrar', { waitUntil: 'networkidle' });
const authLista = (await p.getByText('El acceso todavía no está conectado').count()) === 0;

if (!authLista) {
  check('sin Firebase: el acceso lo dice en vez de fingir', true);

  await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
  const cuerpo = await p.locator('main').innerText();
  check(
    'sin sesión: la plataforma NO se sirve',
    /todavía no está conectado/i.test(cuerpo)
  );
  check(
    'sin sesión: no se filtra nada de dentro',
    !/Mis clientas|Facturación|Ver como/i.test(cuerpo)
  );
  await p.screenshot({ path: `${OUT}/plataforma-protegida.png` });

  await nav.close();
  console.log('OK (' + ok.length + ') — el resto se salta: hace falta Firebase configurado');
  ok.forEach((n) => console.log('  ✓ ' + n));
  if (mal.length) {
    console.log('\nFALLOS (' + mal.length + '):');
    mal.forEach((n) => console.log('  ✗ ' + n));
  }
  process.exit(mal.length ? 1 : 0);
}

/* ---------- El login entra ---------- */
await p.goto(B + '/entrar', { waitUntil: 'networkidle' });
await p.screenshot({ path: `${OUT}/login-claro.png` });

await p.getByRole('button', { name: '¿Aún no tienes cuenta? Crear cuenta' }).click().catch(async () => {
  await p.getByRole('button', { name: 'Crear cuenta' }).first().click();
});
await p.waitForTimeout(300);
check('login: alterna a registro', await p.getByText('Crea tu cuenta').isVisible());
check('registro: pide nombre', await p.locator('input[aria-label="Nombre y apellidos"]').isVisible());
check('registro: pide condiciones', await p.locator('input[type="checkbox"]').isVisible());
await p.screenshot({ path: `${OUT}/login-registro.png` });

await p.getByRole('button', { name: 'Entrar' }).last().click();
await p.waitForTimeout(300);
await p.locator('input[aria-label="Correo"]').fill('sorela@ejemplo.com');
await p.locator('input[aria-label="Contraseña"]').fill('loquesea');
await p.getByRole('button', { name: 'Entrar', exact: true }).click();
await p.waitForURL('**/plataforma', { timeout: 6000 }).catch(() => {});
check('login: el formulario entra en la plataforma', p.url().endsWith('/plataforma'));

/* ---------- Rol miembro: recorrer todo el menú ---------- */
const MIEMBRO = ['Inicio', 'Comunidad', 'Clases y material', 'Mis clientas', 'Mi agenda', 'Mi ficha pública', 'Facturación', 'Mi acceso'];
for (const s of MIEMBRO) {
  await p.getByRole('button', { name: s, exact: true }).click();
  await p.waitForTimeout(450);
  const vacio = (await p.locator('main').innerText()).trim().length < 120;
  check(`miembro · ${s}: tiene contenido`, !vacio);
  await p.screenshot({ path: `${OUT}/plat-miembro-${s.replace(/[^a-z]/gi, '').toLowerCase()}.png`, fullPage: true });
}

/* ---------- Interacciones dentro de la plataforma ---------- */
await p.getByRole('button', { name: 'Comunidad', exact: true }).click();
await p.waitForTimeout(400);
const like = p.locator('button', { hasText: /me gusta/ }).first();
const antesLike = await like.innerText();
await like.click();
await p.waitForTimeout(250);
check('comunidad: "me gusta" suma', (await like.innerText()) !== antesLike);
await p.getByRole('button', { name: 'Duda', exact: true }).click();
await p.waitForTimeout(350);
check('comunidad: el filtro reduce el feed', (await p.locator('article').count()) === 1);

await p.getByRole('button', { name: 'Clases y material', exact: true }).click();
await p.waitForTimeout(400);
await p.getByRole('button', { name: /Negocio y clientas/ }).first().click();
await p.waitForTimeout(350);
check('aula: cambiar de curso cambia las lecciones', await p.getByText('Cómo llega tu primera clienta').isVisible());

await p.getByRole('button', { name: 'Mis clientas', exact: true }).click();
await p.waitForTimeout(400);
await p.getByRole('button', { name: 'Sin volver', exact: true }).click();
await p.waitForTimeout(350);
check('crm: el filtro deja una clienta', (await p.locator('article').count()) === 1);

await p.getByRole('button', { name: 'Mi acceso', exact: true }).click();
await p.waitForTimeout(400);
check('acceso: la comunidad se presenta en beta', await p.getByText('En beta').first().isVisible());
check('acceso: sin precio ni cuota', !/49|cuota|Próximo cobro/i.test(await p.locator('main').innerText()));

/* ---------- Rol alumna ---------- */
await p.getByRole('button', { name: 'Alumna', exact: true }).click();
await p.waitForTimeout(450);
check('alumna: vuelve a Inicio', await p.getByText('Técnica Divine · Formación Base').first().isVisible());
for (const s of ['Mi formación', 'Comunidad', 'Mis pagos']) {
  await p.getByRole('button', { name: s, exact: true }).click();
  await p.waitForTimeout(400);
  check(`alumna · ${s}: tiene contenido`, (await p.locator('main').innerText()).trim().length > 120);
}
await p.getByRole('button', { name: 'Comunidad', exact: true }).click();
await p.waitForTimeout(400);
check('alumna: no puede publicar', (await p.locator('textarea[aria-label="Escribe una publicación"]').count()) === 0);
check('alumna: ve el aviso de solo lectura', await p.getByText(/Para escribir en la comunidad necesitas terminar la formación/).isVisible());
await p.screenshot({ path: `${OUT}/plat-alumna-comunidad.png`, fullPage: true });

/* ---------- Rol Sorela ---------- */
await p.getByRole('button', { name: 'Sorela (admin)', exact: true }).click();
await p.waitForTimeout(450);
check('sorela: entra en su panel', await p.getByText('Panel de Sorela').isVisible());
for (const s of ['Leads', 'Formaciones', 'Subir contenido', 'Facturación', 'Comunidad']) {
  await p.getByRole('button', { name: s, exact: true }).click();
  await p.waitForTimeout(450);
  check(`sorela · ${s}: tiene contenido`, (await p.locator('main').innerText()).trim().length > 120);
  await p.screenshot({ path: `${OUT}/plat-sorela-${s.replace(/[^a-z]/gi, '').toLowerCase()}.png`, fullPage: true });
}
check('sorela: no tiene aula con progreso', (await p.getByRole('button', { name: 'Clases y material', exact: true }).count()) === 0);
check('sorela: no tiene acceso de miembro', (await p.getByRole('button', { name: 'Mi acceso', exact: true }).count()) === 0);

await p.getByRole('button', { name: 'Subir contenido', exact: true }).click();
await p.waitForTimeout(450);
const pub = p.getByRole('button', { name: 'Despublicar' }).first();
await pub.click();
await p.waitForTimeout(300);
check('subir contenido: publicar/despublicar cambia el estado', await p.getByRole('button', { name: 'Publicar' }).first().isVisible());

/* ---------- Tema oscuro ---------- */
await p.getByRole('button', { name: /Ver en/ }).click();
await p.waitForTimeout(400);
check('plataforma: el tema cambia', (await p.evaluate(() => document.documentElement.dataset.tema)) === 'oscuro');
await p.screenshot({ path: `${OUT}/plat-sorela-oscuro.png`, fullPage: true });
await p.getByRole('button', { name: /Ver en/ }).click();

/* ---------- Salir ---------- */
await p.getByRole('button', { name: 'Salir' }).click();
await p.waitForURL('**/', { timeout: 6000 }).catch(() => {});
check('plataforma: "Salir" vuelve a la web', new URL(p.url()).pathname === '/');

/* ---------- Móvil ---------- */
const movil = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
const m = await movil.newPage();
for (const [ruta, nombre] of [['/entrar', 'login'], ['/plataforma', 'plataforma']]) {
  await m.goto(B + ruta, { waitUntil: 'networkidle' });
  await m.waitForTimeout(900);
  const desborda = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`móvil · ${nombre}: sin desbordamiento horizontal`, !desborda);
  await m.screenshot({ path: `${OUT}/movil-${nombre}.png` });
}
await movil.close();

await nav.close();

console.log('OK (' + ok.length + '):');
ok.forEach((n) => console.log('  ✓ ' + n));
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
}
const e = [...new Set(errores)];
console.log(e.length ? '\nERRORES DE CONSOLA:\n' + e.join('\n') : '\nsin errores de consola');
process.exit(mal.length ? 1 : 0);
