/**
 * Las capturas de los manuales, sacadas de la plataforma de verdad.
 *
 *   node --env-file=.env.local docs/capturas.mjs
 *
 * No son maquetas ni pantallas dibujadas: se abre la plataforma real con una
 * sesión de Sorela, se siembra un puñado de datos de ejemplo, se fotografía
 * cada trozo y se borra todo lo sembrado. Al terminar, la base queda como
 * estaba; si algo falla a mitad, el `finally` limpia igualmente.
 *
 * Los datos se escriben DIRECTAMENTE en Firestore y no por la ruta de la web,
 * y eso es importante: apuntar un contacto por `/api/contactos` le manda a esa
 * persona el correo con la información de la Técnica Divine. Para una captura
 * sería mandar correos de verdad a direcciones inventadas.
 *
 * Los nombres son de mentira y se nota que lo son. Aun así, cada captura lleva
 * su pie diciéndolo en el manual: una pantalla de ejemplo que parezca real es
 * justo lo que esta plataforma lleva toda la vida evitando.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(AQUI, 'capturas');
mkdirSync(OUT, { recursive: true });

const B = 'http://localhost:3100';
const CUENTA_PRUEBA = 'alumna-de-ejemplo@ejemplo.com';

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROYECTO_ID,
      clientEmail: process.env.FIREBASE_CLIENTE_CORREO,
      privateKey: (process.env.FIREBASE_CLAVE_PRIVADA || '').replace(/\\n/g, '\n'),
    }),
    projectId: process.env.FIREBASE_PROYECTO_ID,
  });
const auth = getAuth(app);
const db = getFirestore(app);

/* ==========================================================================
   Los datos de ejemplo
   ========================================================================== */

const hoy = new Date();
const dia = (n, h) => Timestamp.fromDate(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n, h));
const haceDias = (n) => Timestamp.fromDate(new Date(Date.now() - n * 86400000));

/* Nombres de pila corrientes y correos en «ejemplo.com», que es un dominio
   reservado justo para esto y no existe. Cada ficha enseña una cosa distinta
   del embudo: una sin atender, una en conversación, una terapeuta y una sin
   clasificar. */
const CONTACTOS = [
  {
    id: 'lucia@ejemplo.com',
    nombre: 'Lucía',
    correo: 'lucia@ejemplo.com',
    whatsapp: '+34600111222',
    ciudad: 'Barcelona',
    perfil: 'Esteticista',
    nota: 'Vio el vídeo del abdomen y quiere probarlo en su cabina.',
    origen: 'formacion',
    estado: 'Nuevo',
    veces: 1,
    creado: haceDias(0.1),
  },
  {
    id: 'marta@ejemplo.com',
    nombre: 'Marta',
    correo: 'marta@ejemplo.com',
    whatsapp: '+34600333444',
    ciudad: 'Madrid',
    perfil: '',
    nota: '',
    origen: 'web',
    estado: 'Contactado',
    veces: 1,
    creado: haceDias(2),
    seguimiento: [
      { cuando: new Date(Date.now() - 86400000).toISOString(), texto: 'Le escribí por WhatsApp. Pregunta por el precio de la sesión.' },
    ],
  },
  {
    id: 'ana@ejemplo.com',
    nombre: 'Ana',
    correo: 'ana@ejemplo.com',
    whatsapp: '',
    ciudad: 'Valencia',
    perfil: 'Fisioterapeuta',
    nota: '',
    origen: 'lista-comunidad',
    estado: 'En conversación',
    veces: 2,
    creado: haceDias(5),
  },
  {
    id: 'carmen@ejemplo.com',
    nombre: 'Carmen',
    correo: 'carmen@ejemplo.com',
    whatsapp: '+34600555666',
    ciudad: '',
    perfil: '',
    nota: '',
    origen: 'contacto',
    estado: 'Nuevo',
    veces: 1,
    creado: haceDias(1),
  },
];

const EVENTOS = [
  { titulo: 'Sesión de abdomen', cuando: dia(0, 10), duracionMin: 60, tipo: 'Sesión', estado: 'Pendiente', conQuien: 'Lucía', telefono: '+34600111222', lugar: 'Cabina', nota: '' },
  { titulo: 'Llamada con una posible alumna', cuando: dia(0, 16), duracionMin: 30, tipo: 'Llamada', estado: 'Hecho', conQuien: 'Marta', telefono: '', lugar: '', nota: '' },
  { titulo: 'Formación presencial · día 1', cuando: dia(3, 9), duracionMin: 300, tipo: 'Formación', estado: 'Pendiente', conQuien: '', telefono: '', lugar: 'Badalona', nota: '' },
  { titulo: 'Sesión de piernas', cuando: dia(4, 11), duracionMin: 75, tipo: 'Sesión', estado: 'Pendiente', conQuien: 'Ana', telefono: '', lugar: 'Cabina', nota: '' },
  { titulo: 'Revisión del temario', cuando: dia(-3, 18), duracionMin: 90, tipo: 'Personal', estado: 'Hecho', conQuien: '', telefono: '', lugar: '', nota: '' },
  { titulo: 'Clase en vivo de la comunidad', cuando: dia(9, 19), duracionMin: 60, tipo: 'Clase en vivo', estado: 'Pendiente', conQuien: '', telefono: '', lugar: 'Zoom', nota: '' },
];

const sembrados = { contactos: [], agenda: [], cuenta: null };

/**
 * Dónde va la agenda de Sorela.
 *
 * Es una función y no una constante porque `admin` se resuelve más abajo, y
 * aquí arriba todavía no existe. Todas las llamadas a esto ocurren después.
 */
const agendaDeSorela = () => db.collection('usuarios').doc(admin.uid).collection('agenda');

async function limpiar() {
  for (const id of sembrados.contactos) await db.collection('contactos').doc(id).delete().catch(() => {});
  // La agenda cuelga de su dueña —usuarios/{uid}/agenda—, no de la raíz.
  for (const id of sembrados.agenda) await agendaDeSorela().doc(id).delete().catch(() => {});
  const u = await auth.getUserByEmail(CUENTA_PRUEBA).catch(() => null);
  if (u) {
    await db.collection('usuarios').doc(u.uid).delete().catch(() => {});
    await auth.deleteUser(u.uid).catch(() => {});
  }
}

/* ==========================================================================
   Adelante
   ========================================================================== */

const correoAdmin = (process.env.ADMIN_CORREOS || '').split(',')[0].trim();
const admin = await auth.getUserByEmail(correoAdmin);
await auth.setCustomUserClaims(admin.uid, { role: 'sorela' });
const custom = await auth.createCustomToken(admin.uid);
const sesion = await (
  await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) }
  )
).json();
const cookie = await auth.createSessionCookie(sesion.idToken, { expiresIn: 3600000 });

// Que la ficha de Sorela tenga nombre, o su línea de la lista sale sin él.
await db.collection('usuarios').doc(admin.uid).set({ nombre: 'Sorela Caro' }, { merge: true });

await limpiar();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

try {
  for (const c of CONTACTOS) {
    const { id, ...resto } = c;
    await db.collection('contactos').doc(id).set(resto);
    sembrados.contactos.push(id);
  }
  for (const e of EVENTOS) {
    const ref = await agendaDeSorela().add({ ...e, creado: Timestamp.now() });
    sembrados.agenda.push(ref.id);
  }

  const ctx = await nav.newContext({
    viewport: { width: 1500, height: 1000 },
    // El doble de resolución: en un PDF impreso, una captura a 1× se ve sucia.
    deviceScaleFactor: 2,
    locale: 'es-ES',
  });
  await ctx.addCookies([
    { name: 'divine_sesion', value: cookie, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
  const p = await ctx.newPage();

  /** Abre una vista del menú y espera a que cargue lo suyo. */
  async function ir(nombre) {
    await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
    await p.waitForTimeout(900);
    const b = p.getByRole('button', { name: new RegExp(`^${nombre}$`, 'i') }).first();
    if (await b.count()) await b.click();
    await p.waitForTimeout(1600);
  }

  /** Fotografía un trozo de la pantalla, no la pantalla entera. */
  async function foto(sel, archivo, opciones = {}) {
    const el = typeof sel === 'string' ? p.locator(sel).first() : sel;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(250);
    await el.screenshot({ path: path.join(OUT, `${archivo}.png`), ...opciones });
    console.log(`  · ${archivo}.png`);
  }

  /* ---------- El menú ---------- */
  await ir('Panel');
  console.log('menú:');
  await foto('aside, nav', 'menu');

  /* ---------- Clientes ---------- */
  await ir('Clientes');
  console.log('clientes:');
  /* Se fotografía el elemento entero y no un recorte por coordenadas: la caja
     se mueve con el ancho de la ventana, y un recorte fijo acababa cortando la
     primera columna por la mitad. */
  await foto('main', 'clientes');
  const embudo = p.locator('main > div > div').first();
  if (await embudo.count()) await foto(embudo, 'clientes-embudo');
  const fila = p.locator('main article').filter({ hasText: 'Lucía' }).first();
  if (await fila.count()) await foto(fila, 'clientes-fila');

  /* ---------- La ficha de una persona ---------- */
  const abrir = p.getByRole('button', { name: /ficha|ver ficha|abrir/i }).first();
  if (await abrir.count()) {
    await abrir.click();
    await p.waitForTimeout(1200);
    const ficha = p.locator('dialog[open]').first();
    if (await ficha.count()) await foto(ficha, 'ficha');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  }

  /* ---------- Añadir contacto ---------- */
  const anadir = p.getByRole('button', { name: /añadir contacto/i }).first();
  if (await anadir.count()) {
    await anadir.click();
    await p.waitForTimeout(1000);
    const panel = p.locator('dialog[open]').first();
    if (await panel.count()) await foto(panel, 'anadir-cliente');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
  }

  /* ---------- Agenda ---------- */
  await ir('Agenda');
  console.log('agenda:');
  await foto('section[aria-label="Calendario del mes"]', 'calendario');
  await foto('main', 'agenda');

  /* ---------- Cuentas ---------- */
  await ir('Cuentas');
  console.log('cuentas:');
  await foto('main', 'cuentas');

  // El formulario de alta, relleno pero sin enviar todavía.
  await p.getByLabel(/correo/i).first().fill(CUENTA_PRUEBA);
  await p.getByLabel(/nombre/i).first().fill('Alumna de ejemplo');
  /* Se fotografía la SECCIÓN que envuelve al formulario y no el <form>: el
     formulario mide justo lo que ocupan sus campos, así que el recuadro del
     último —con su marco de foco— quedaba cortado por el borde de la imagen y
     en el manual parecía que la pantalla estaba mal hecha. */
  const formulario = p.locator('form').first().locator('xpath=..');
  await foto(formulario, 'cuentas-formulario');

  // Y ahora sí: se da el alta para fotografiar el recuadro del enlace.
  await p.getByRole('button', { name: /crear la cuenta/i }).first().click();
  await p.waitForTimeout(3000);
  sembrados.cuenta = CUENTA_PRUEBA;
  await p.evaluate(() => {
    /* El enlace de verdad lleva el código de un solo uso de esa cuenta. Aunque
       la cuenta se borra al terminar y el código deja de valer, un manual que
       se comparte no es sitio para enseñarlo: se cambia por uno de la misma
       forma y la misma longitud, que es lo que el manual quiere mostrar. */
    const caja = [...document.querySelectorAll('code')].find((c) => c.textContent.includes('oobCode'));
    if (caja) {
      caja.textContent = caja.textContent.replace(/oobCode=[^&]+/, 'oobCode=' + 'x'.repeat(48));
    }
  });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  const enlace = p.locator('main section').first();
  await foto(enlace, 'cuentas-enlace');

  // La lista con la cuenta nueva dentro.
  const lista = p.locator('main section').nth(1);
  if (await lista.count()) await foto(lista, 'cuentas-lista');

  await ctx.close();
} finally {
  await nav.close();
  await limpiar();
  const [c, a, u] = await Promise.all([
    db.collection('contactos').get(),
    agendaDeSorela().get(),
    db.collection('usuarios').get(),
  ]);
  console.log(`\nlimpieza: ${c.size} contactos · ${a.size} en la agenda · ${u.size} cuentas`);
}
