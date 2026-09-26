/**
 * La plataforma por dentro, con sesiones de verdad.
 *
 *   node --env-file=.env.local pruebas/plataforma.mjs
 *
 * Lo que se comprueba es quién ve qué. Es la pregunta de la que cuelga todo lo
 * demás: que a una terapeuta no le aparezca el panel de Sorela, que quien no
 * ha contratado nada no vea un aula vacía, y que quien sí ha contratado algo
 * encuentre sus clases y su agenda donde se le dice que están.
 *
 * Aquí vivía la suite del prototipo: entraba con un correo inventado sin pasar
 * por Firebase y recorría ocho pantallas de maqueta —clientas, facturas y
 * comunidad de mentira— que se retiraron al hacer la plataforma de verdad. No
 * es que fallara: es que llevaba semanas comprobando cosas que ya no existían.
 *
 * Las sesiones se montan como las monta el navegador: cuenta de Firebase,
 * token, cookie firmada. Nada de atajos, porque el atajo es justo lo que aquí
 * hay que probar que no existe. Al terminar se borra todo lo creado.
 */
import { chromium } from 'playwright';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { mkdirSync } from 'node:fs';

const OUT =
  process.env.OUT ||
  '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/plataforma';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3100';

const ok = [];
const mal = [];
const check = (n, c, d) => (c ? ok : mal).push(d ? `${n} — ${d}` : n);

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROYECTO_ID,
      clientEmail: (process.env.FIREBASE_CLIENTE_CORREO || '').trim(),
      privateKey: (process.env.FIREBASE_CLAVE_PRIVADA || '').replace(/\\n/g, '\n'),
    }),
    projectId: process.env.FIREBASE_PROYECTO_ID,
  });
const auth = getAuth(app);
const db = getFirestore(app);

/* Dos cuentas de usar y tirar: una que ha comprado algo y otra que no. El
   dominio ejemplo.com está reservado para esto y no existe, así que no hay
   forma de que un correo salga a alguien de verdad. */
const CUENTAS = [
  {
    clave: 'conAcceso',
    correo: 'prueba-plataforma-con@ejemplo.com',
    nombre: 'Prueba Con Acceso',
    accesos: [{ tipo: 'curso', nombre: 'Formación Base' }],
  },
  {
    clave: 'sinAcceso',
    correo: 'prueba-plataforma-sin@ejemplo.com',
    nombre: 'Prueba Sin Acceso',
    accesos: [],
  },
];

async function limpiar() {
  for (const c of CUENTAS) {
    const u = await auth.getUserByEmail(c.correo).catch(() => null);
    if (!u) continue;
    // La subcolección primero: borrar un documento no borra lo que tiene
    // colgado, y esa agenda se quedaría flotando sin dueño.
    const suya = await db.collection('usuarios').doc(u.uid).collection('agenda').get();
    for (const d of suya.docs) await d.ref.delete().catch(() => {});
    await db.collection('usuarios').doc(u.uid).delete().catch(() => {});
    await auth.deleteUser(u.uid).catch(() => {});
  }
}

/** Una sesión de verdad para ese uid: la misma cookie que pone el navegador. */
async function cookieDe(uid) {
  const custom = await auth.createCustomToken(uid);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  );
  const { idToken } = await r.json();
  if (!idToken) throw new Error('Firebase no ha devuelto token para ' + uid);
  return auth.createSessionCookie(idToken, { expiresIn: 3600000 });
}

/* ==========================================================================
   Adelante
   ========================================================================== */

await limpiar();

const gente = {};
for (const c of CUENTAS) {
  const u = await auth.createUser({
    email: c.correo,
    password: 'PruebaDivine2026!',
    displayName: c.nombre,
  });
  // altaPor es la puerta: sin él, lib/sesion-servidor.ts no abre sesión a
  // nadie que no esté en ADMIN_CORREOS.
  await db.collection('usuarios').doc(u.uid).set({
    correo: c.correo,
    nombre: c.nombre,
    rol: 'miembro',
    accesos: c.accesos,
    altaPor: 'pruebas/plataforma.mjs',
  });
  gente[c.clave] = { ...c, uid: u.uid, cookie: await cookieDe(u.uid) };
}

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fallosDePagina = [];

/** Abre la plataforma con esa cookie y devuelve la página ya cargada. */
async function entrar(cookie) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'es-ES' });
  if (cookie) {
    await ctx.addCookies([
      { name: 'divine_sesion', value: cookie, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    ]);
  }
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fallosDePagina.push(e.message));
  p.on('console', (m) => m.type() === 'error' && fallosDePagina.push(m.text()));
  await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  return { ctx, p };
}

try {
  /* ---------- Sin sesión, la puerta está cerrada ---------- */
  {
    const { ctx, p } = await entrar(null);
    check('sin sesión, /plataforma lleva al acceso', new URL(p.url()).pathname === '/entrar', p.url());
    const cuerpo = await p.locator('body').innerText();
    check(
      'sin sesión, no se filtra nada de dentro',
      !/Panel de Sorela|Quién puede entrar|Ver como/i.test(cuerpo)
    );
    await p.screenshot({ path: `${OUT}/sin-sesion.png` });
    await ctx.close();
  }

  /* ---------- Con algo contratado: clases y agenda ---------- */
  {
    const { ctx, p } = await entrar(gente.conAcceso.cookie);
    check('con acceso, entra en la plataforma', new URL(p.url()).pathname === '/plataforma', p.url());
    const menu = await p.locator('nav').innerText();
    check('con acceso, tiene «Mis clases»', /Mis clases/i.test(menu), menu.replace(/\n+/g, ' | '));
    check('con acceso, tiene «Mi agenda»', /Mi agenda/i.test(menu), menu.replace(/\n+/g, ' | '));

    const cuerpo = await p.locator('body').innerText();
    check(
      'con acceso, NO ve nada de administración',
      !/Panel de Sorela|Quién puede entrar|Subir contenido|Facturación/i.test(cuerpo)
    );
    check('con acceso, NO ve el selector «Ver como»', !/Ver como/i.test(cuerpo));

    // La agenda, abierta de verdad: que el calendario se pinte y el formulario
    // esté, no solo que la línea del menú exista.
    await p.getByRole('button', { name: /^Mi agenda$/i }).click();
    await p.waitForTimeout(1500);
    const agenda = await p.locator('main').innerText();
    check('la agenda del miembro trae su calendario', /Pulsa un día/i.test(agenda));
    check('la agenda del miembro deja apuntar', /Apuntar en la agenda/i.test(agenda));
    check('la agenda del miembro empieza vacía', /No tienes nada apuntado/i.test(agenda));
    await p.screenshot({ path: `${OUT}/miembro-agenda.png`, fullPage: true });

    await p.getByRole('button', { name: /^Mis clases$/i }).click();
    await p.waitForTimeout(1500);
    const aula = await p.locator('main').innerText();
    check(
      'el aula dice que no hay clases en vez de inventarlas',
      /Todavía no hay ninguna clase/i.test(aula),
      aula.slice(0, 120).replace(/\n+/g, ' | ')
    );
    await ctx.close();
  }

  /* ---------- Sin nada contratado: una sola puerta ---------- */
  {
    const { ctx, p } = await entrar(gente.sinAcceso.cookie);
    const cuerpo = await p.locator('body').innerText();
    check('sin acceso, NO se le ofrece el aula', !/Mis clases/i.test(cuerpo));
    check('sin acceso, NO se le ofrece la agenda', !/Mi agenda/i.test(cuerpo));
    check('sin acceso, se le dice que su espacio está en preparación', /En preparación/i.test(cuerpo));
    await p.screenshot({ path: `${OUT}/miembro-sin-acceso.png`, fullPage: true });
    await ctx.close();
  }

  /* ---------- Sorela ---------- */
  {
    const correoAdmin = (process.env.ADMIN_CORREOS || '').split(',')[0].trim();
    const sorela = await auth.getUserByEmail(correoAdmin).catch(() => null);
    if (!sorela) {
      check('no se ha podido probar la vista de Sorela', false, 'no existe ' + correoAdmin);
    } else {
      const { ctx, p } = await entrar(await cookieDe(sorela.uid));
      const menu = await p.locator('nav').innerText();
      for (const apartado of ['Panel', 'Clientes', 'Agenda', 'Facturación', 'Subir contenido', 'Cuentas']) {
        check(`Sorela tiene «${apartado}»`, new RegExp(`^${apartado}$`, 'im').test(menu));
      }
      check('Sorela puede mirar como miembro', /Ver como/i.test(await p.locator('body').innerText()));
      await p.screenshot({ path: `${OUT}/sorela.png`, fullPage: true });
      await ctx.close();
    }
  }

  check(
    'ninguna pantalla ha lanzado un error',
    fallosDePagina.length === 0,
    fallosDePagina.slice(0, 3).join(' / ')
  );
} finally {
  await nav.close();
  await limpiar();
}

console.log(`OK (${ok.length})`);
ok.forEach((n) => console.log('  ✓ ' + n));
if (mal.length) {
  console.log(`\nFALLA (${mal.length})`);
  mal.forEach((n) => console.log('  ✗ ' + n));
  process.exit(1);
}
