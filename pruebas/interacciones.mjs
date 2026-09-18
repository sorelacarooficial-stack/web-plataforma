import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/caps';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3000';
const ok = [];
const mal = [];
const check = (n, c) => (c ? ok : mal).push(n);

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

/* ---------- Mapa: clic en un punto abre la ficha ---------- */
await p.goto(B + '/terapeutas', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.locator('g[aria-label^="Marta"]').click();
await p.waitForTimeout(400);
check('mapa: ficha al pinchar punto', await p.getByText('Calle de Ponzano, 42 · Chamberí').isVisible());
await p.screenshot({ path: `${OUT}/int-mapa-ficha.png` });

/* ---------- Filtro reencuadra y apaga los que no cumplen ---------- */
await p.selectOption('select[aria-label="Filtrar por ciudad"]', 'Bilbao');
await p.waitForTimeout(1200);
check('filtro: contador a 1', /1 terapeuta/i.test(await p.getByRole('status').first().innerText()));
await p.screenshot({ path: `${OUT}/int-mapa-filtro.png` });

/* ---------- Sin resultados ---------- */
await p.selectOption('select[aria-label="Filtrar por ciudad"]', 'Zaragoza');
await p.waitForTimeout(900);
check('filtro: estado sin resultados', await p.getByText('Todavía no hay terapeuta Divine en Zaragoza.').isVisible());

/* ---------- Ficha → perfil ---------- */
await p.selectOption('select[aria-label="Filtrar por ciudad"]', 'Todas las ciudades');
await p.waitForTimeout(1200);
await p.locator('g[aria-label^="Lucía"]').click();
await p.waitForTimeout(300);
await p.getByRole('button', { name: 'Ver perfil y reservar' }).click();
await p.waitForURL('**/terapeutas/lucia-ferrer', { timeout: 5000 }).catch(() => {});
check('mapa: "ver perfil" navega a la ficha', p.url().endsWith('/terapeutas/lucia-ferrer'));

/* ---------- Reserva ---------- */
await p.getByRole('button', { name: '17:30' }).click();
await p.getByRole('button', { name: 'Mar 9' }).click();
check('reserva: resumen se actualiza', (await p.locator('form p').first().innerText()).includes('Día 9 de marzo · 17:30'));
await p.locator('input[aria-label="Nombre y apellidos"]').fill('Ana Ruiz');
await p.locator('input[aria-label="Teléfono"]').fill('600111222');
await p.locator('input[aria-label="Correo"]').fill('ana@ejemplo.com');
await p.getByRole('button', { name: 'Confirmar reserva' }).click();
await p.waitForTimeout(400);
check('reserva: confirma', await p.getByText('Solicitud enviada.').isVisible());
await p.screenshot({ path: `${OUT}/int-reserva.png` });

/* ---------- Asistente ---------- */
await p.goto(B + '/', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: 'Abrir el asistente Divine' }).click();
await p.waitForTimeout(400);
await p.getByRole('button', { name: 'Precio y forma de pago' }).click();
await p.waitForTimeout(900);
check('asistente: responde precios', await p.getByText(/1\.450 €, reservas con 350 €/).isVisible());
await p.locator('input[aria-label="Escribe tu pregunta"]').fill('quiero entrar en la comunidad');
await p.getByRole('button', { name: 'Enviar' }).click();
await p.waitForTimeout(900);
check('asistente: responde comunidad', await p.getByText(/todavía no está abierta/).isVisible());
await p.screenshot({ path: `${OUT}/int-asistente.png` });
await p.getByRole('button', { name: 'Cerrar el asistente' }).click();

/* ---------- Tema ---------- */
const antes = await p.evaluate(() => document.documentElement.dataset.tema);
await p.getByRole('button', { name: /Ver en/ }).click();
await p.waitForTimeout(300);
const despues = await p.evaluate(() => document.documentElement.dataset.tema);
check('tema: alterna', antes !== despues);
check('tema: se guarda', (await p.evaluate(() => localStorage.getItem('divine-tema'))) === despues);
await p.reload({ waitUntil: 'networkidle' });
check('tema: persiste tras recargar', (await p.evaluate(() => document.documentElement.dataset.tema)) === despues);
await p.getByRole('button', { name: /Ver en/ }).click();

/* ---------- FAQ ---------- */
const preg = p.getByRole('button', { name: /¿Se puede hacer online\?/ });
await preg.scrollIntoViewIfNeeded();
await preg.click();
await p.waitForTimeout(300);
check('faq: abre respuesta', await p.getByText(/El trabajo manual no se corrige por videollamada/).isVisible());

/* ---------- Lista de espera ---------- */
await p.goto(B + '/comunidad', { waitUntil: 'networkidle' });
await p.locator('input[aria-label="Nombre"]').fill('Marta');
await p.locator('input[aria-label="Correo"]').fill('marta@ejemplo.com');
await p.locator('input[aria-label="Ciudad donde trabajas"]').fill('Gijón');
await p.getByRole('button', { name: 'Apuntarme a la lista' }).click();
await p.waitForTimeout(400);
check('lista de espera: confirma', await p.getByText('Estás dentro.').isVisible());

/* ---------- Contacto ---------- */
await p.goto(B + '/contacto', { waitUntil: 'networkidle' });
await p.locator('input[aria-label="Nombre"]').fill('Lucía');
await p.locator('input[aria-label="Correo"]').fill('l@ejemplo.com');
await p.locator('textarea[aria-label="Cuéntame"]').fill('Quiero información de Madrid.');
await p.getByRole('button', { name: 'Enviar' }).click();
await p.waitForTimeout(400);
check('contacto: confirma', await p.getByText('Recibido.').isVisible());

/* ---------- Navegación y 404 ---------- */
await p.goto(B + '/no-existe-esta-pagina', { waitUntil: 'networkidle' });
check('404: página propia', await p.getByText('Esta página no existe.').isVisible());

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
