import { chromium } from 'playwright';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/caps';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3000';
const ok = [];
const mal = [];
const check = (n, c) => (c ? ok : mal).push(n);

/*
 * Los tres formularios de esta prueba se envían de verdad, así que dejan tres
 * contactos en la base de datos. No es un detalle: estaban ahí desde hace
 * semanas —Ana Ruiz, Marta, Lucía— mezclados con los contactos de verdad en la
 * lista de Sorela, que es justo lo que esta plataforma lleva todo el proyecto
 * evitando. Se borran al empezar y al terminar.
 *
 * Sin Firebase configurado no se puede borrar nada, y tampoco hace falta: sin
 * él los formularios no llegan a guardar.
 */
const SEMBRADOS = ['ana@ejemplo.com', 'marta@ejemplo.com', 'l@ejemplo.com'];

const db = process.env.FIREBASE_PROYECTO_ID
  ? getFirestore(
      getApps()[0] ??
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROYECTO_ID,
            clientEmail: (process.env.FIREBASE_CLIENTE_CORREO || '').trim(),
            privateKey: (process.env.FIREBASE_CLAVE_PRIVADA || '').replace(/\\n/g, '\n'),
          }),
          projectId: process.env.FIREBASE_PROYECTO_ID,
        })
    )
  : null;

async function limpiar() {
  if (!db) return;
  for (const id of SEMBRADOS) await db.collection('contactos').doc(id).delete().catch(() => {});
}

await limpiar();

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

/* ---------- Mapa vacío ----------
   Las seis terapeutas del mapa eran inventadas y se han retirado. Lo que hay
   que comprobar ahora es que la página vacía se comporta: que lo dice en vez
   de fingir, y que no queda ningún punto ni ninguna ficha de nadie. */
await p.goto(B + '/terapeutas', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);

const textoMapa = await p.locator('main').innerText();
check('mapa: dice que todavía no hay terapeutas', /todav[íi]a no hay terapeutas/i.test(textoMapa));
check(
  'mapa: no queda ninguna terapeuta inventada',
  !/Marta Ib[áa][ñn]ez|Nuria Sanch[íi]s|Carla Redondo|Luc[íi]a Ferrer/i.test(textoMapa)
);
check('mapa: no quedan puntos que pinchar', (await p.locator('g[aria-label]').count()) === 0);
check(
  'mapa: la leyenda no dice que haya consultas certificadas',
  !/consultas divine certificadas/i.test(textoMapa)
);
check(
  'mapa: el filtro ya no ofrece «Postquirúrgico»',
  !/postquir[úu]rgico/i.test(await p.locator('select[aria-label="Filtrar por tratamiento"]').innerText())
);
await p.screenshot({ path: `${OUT}/int-mapa-vacio.png` });

/* ---------- La ficha de una terapeuta inventada ya no existe ---------- */
const r = await p.request.get(B + '/terapeutas/marta-ibanez');
check('las fichas inventadas devuelven 404', r.status() === 404, String(r.status()));

await p.goto(B + '/', { waitUntil: 'networkidle' });

/* ---------- El formulario del inicio ----------
   La petición de cita vivía en la ficha de una terapeuta, y esas fichas ya no
   existen. La puerta de entrada ahora es la ventana del inicio. */
await p.getByRole('button', { name: 'Quiero la información' }).first().click();
await p.waitForTimeout(500);
const ventana = p.locator('dialog[open]');
await ventana.getByPlaceholder('Tu nombre').fill('Ana Ruiz');
await ventana.getByPlaceholder('tucorreo@ejemplo.com').fill('ana@ejemplo.com');
await ventana.getByPlaceholder('600 00 00 00').fill('600111222');

// Sin aceptar el consentimiento no se envía: es obligatorio antes de recoger
// datos personales.
await ventana.getByRole('button', { name: 'Enviarme la información' }).click();
await p.waitForTimeout(400);
check('formulario: exige el consentimiento', await p.getByText('Necesito que lo aceptes').isVisible());

await ventana.getByRole('checkbox').check();
await ventana.getByRole('button', { name: 'Enviarme la información' }).click();
await p.waitForTimeout(4000);
check(
  'formulario: al enviar contesta algo (no se queda mudo)',
  (await p.getByText('Gracias por contar conmigo').count()) > 0 ||
    (await p.getByText('No he podido guardarlo').count()) > 0
);
await p.screenshot({ path: `${OUT}/int-reserva.png` });
await p.keyboard.press('Escape');
await p.waitForTimeout(300);

/* ---------- Asistente ---------- */
await p.goto(B + '/', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: 'Abrir el asistente Divine' }).click();
await p.waitForTimeout(400);
await p.getByRole('button', { name: 'Quiero agendar una cita' }).click();
await p.waitForTimeout(900);
check('asistente: ofrece guardar el sitio', await p.getByText(/Te guardo el sitio/).isVisible());
await p.locator('input[aria-label="Escribe tu pregunta"]').fill('quiero entrar en la comunidad');
await p.getByRole('button', { name: 'Enviar', exact: true }).click();
await p.waitForTimeout(900);
// La comunidad ya tiene precio y fecha: el asistente no puede seguir diciendo
// que no está abierta ni que no tiene precio.
check('asistente: responde comunidad con precio y fecha', await p.getByText(/47 € al mes/).isVisible());
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
const preg = p.getByRole('button', { name: /¿Se puede hacer todo online\?/ });
await preg.scrollIntoViewIfNeeded();
await preg.click();
await p.waitForTimeout(300);
check('faq: abre respuesta', await p.getByText(/Las manos no se corrigen por videollamada/).isVisible());

/* ---------- Lista de espera ---------- */
await p.goto(B + '/comunidad', { waitUntil: 'networkidle' });
await p.locator('input[aria-label="Nombre"]').fill('Marta');
await p.locator('input[aria-label="Correo"]').fill('marta@ejemplo.com');
await p.locator('input[aria-label="Ciudad donde trabajas"]').fill('Gijón');

await p.getByRole('button', { name: 'Apuntarme a la lista' }).click();
await p.waitForTimeout(400);
check('lista: exige el consentimiento', await p.getByText('Necesito que lo aceptes').isVisible());

await p.locator('form input[type="checkbox"]').check();
await p.getByRole('button', { name: 'Apuntarme a la lista' }).click();
await p.waitForTimeout(1500);
// Sin Firebase ni Apps Script configurados, el formulario dice que no ha
// podido guardarlo, que es lo correcto: lo que se comprueba es que contesta
// una cosa o la otra, nunca que se quede mudo.
check(
  'lista de espera: contesta al enviar',
  (await p.getByText('Tu sitio está guardado').count()) > 0 ||
    (await p.getByText('No he podido guardarlo.').count()) > 0
);

/* ---------- Contacto ---------- */
await p.goto(B + '/contacto', { waitUntil: 'networkidle' });
await p.locator('input[aria-label="Nombre"]').fill('Lucía');
await p.locator('input[aria-label="Correo"]').fill('l@ejemplo.com');
await p.locator('textarea[aria-label="Cuéntame"]').fill('Quiero información de Madrid.');
// Sin aceptar el consentimiento no se envía.
await p.getByRole('button', { name: 'Enviar', exact: true }).click();
await p.waitForTimeout(400);
check('contacto: exige el consentimiento', await p.getByText('Necesito que lo aceptes').isVisible());

await p.locator('form input[type="checkbox"]').check();
await p.getByRole('button', { name: 'Enviar', exact: true }).click();
await p.waitForTimeout(4000);
check(
  'contacto: contesta al enviar',
  (await p.getByText('Gracias por escribirme').count()) > 0 ||
    (await p.getByText('No he podido enviarlo.').count()) > 0
);

/* ---------- Navegación y 404 ---------- */
await p.goto(B + '/no-existe-esta-pagina', { waitUntil: 'networkidle' });
check('404: página propia', await p.getByText('Esta página no existe.').isVisible());

await nav.close();
await limpiar();

console.log('OK (' + ok.length + '):');
ok.forEach((n) => console.log('  ✓ ' + n));
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
}
/* El 404 del navegador al pedir la página que no existe lo provoca la propia
   prueba dos líneas más arriba: contarlo como error de consola sería teñir de
   rojo justo lo que se está comprobando que funciona. */
const e = [...new Set(errores)].filter((m) => !/status of 404/.test(m));
console.log(e.length ? '\nERRORES DE CONSOLA:\n' + e.join('\n') : '\nsin errores de consola');
process.exit(mal.length ? 1 : 0);
