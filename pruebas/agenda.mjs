/**
 * La agenda de cada una, contra el Firebase de verdad.
 *
 *   node --env-file=.env.local pruebas/agenda.mjs
 *
 * Lo que se comprueba aquí no es que la agenda funcione —eso se ve a la
 * primera— sino que la agenda de una NO se ve desde la cuenta de otra. Es la
 * única parte de esta pantalla que no se nota si está mal: dos terapeutas
 * probándola cada una en su casa verían sus cosas y todo parecería correcto
 * hasta el día en que una escribe el teléfono de una clienta y lo lee otra.
 *
 * Se levantan dos cuentas de usar y tirar, se les da sesión de verdad —cookie
 * firmada por Firebase, no un atajo— y se intenta, a mano, lo que un atacante
 * intentaría: leer, editar y borrar un evento de la otra sabiendo su
 * identificador. Al terminar se borra todo lo creado.
 *
 * NO toca la cuenta de Sorela más que para leer su agenda y comprobar que no
 * le aparece nada de las dos cuentas de prueba.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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

/* Las dos cuentas de prueba. El dominio ejemplo.com está reservado justo para
   esto: no existe, así que no hay forma de que un correo salga a alguien. */
const CUENTAS = [
  { correo: 'prueba-agenda-a@ejemplo.com', nombre: 'Prueba Agenda A', accesos: [{ tipo: 'membresia' }] },
  { correo: 'prueba-agenda-b@ejemplo.com', nombre: 'Prueba Agenda B', accesos: [{ tipo: 'curso', nombre: 'Formación Base' }] },
];

/**
 * Deja el proyecto como estaba.
 *
 * Se borra la ficha de usuarios ADEMÁS de la cuenta de Authentication, y la
 * subcolección de la agenda antes que la ficha: en Firestore, borrar un
 * documento NO borra lo que tiene colgado, así que la agenda se quedaría
 * flotando en la base de datos sin ningún documento padre que la delate.
 */
async function limpiar() {
  for (const c of CUENTAS) {
    const u = await auth.getUserByEmail(c.correo).catch(() => null);
    if (!u) continue;
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

/** Una llamada a la agenda como la haría esa persona desde su navegador. */
async function como(cookie, metodo, ruta = '', cuerpo) {
  const r = await fetch(`${B}/api/agenda${ruta}`, {
    method: metodo,
    headers: {
      cookie: `divine_sesion=${cookie}`,
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  return { estado: r.status, cuerpo: await r.json().catch(() => ({})) };
}

/** Mañana a las diez, en ISO, que es lo que manda el navegador. */
function manana(horas = 10) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(horas, 0, 0, 0);
  return d.toISOString();
}

/* ==========================================================================
   Adelante
   ========================================================================== */

await limpiar();

const gente = [];
for (const c of CUENTAS) {
  const u = await auth.createUser({ email: c.correo, password: 'PruebaDivine2026!', displayName: c.nombre });
  // altaPor y accesos: sin lo primero no la dejarían entrar (ver
  // lib/sesion-servidor.ts) y sin lo segundo no tendría la agenda en el menú.
  await db.collection('usuarios').doc(u.uid).set({
    correo: c.correo,
    nombre: c.nombre,
    rol: 'miembro',
    accesos: c.accesos,
    altaPor: 'pruebas/agenda.mjs',
  });
  gente.push({ ...c, uid: u.uid, cookie: await cookieDe(u.uid) });
}
const [a, b] = gente;

try {
  /* ---------- Sin sesión no hay agenda ---------- */
  const anonimo = await fetch(`${B}/api/agenda`);
  check('sin sesión, la agenda no contesta datos', anonimo.status === 401, 'estado ' + anonimo.status);

  /* ---------- Cada una apunta lo suyo ---------- */
  const puestoA = await como(a.cookie, 'POST', '', {
    titulo: 'Sesión con una clienta de A',
    cuando: manana(10),
    duracionMin: 60,
    tipo: 'Sesión',
    conQuien: 'Clienta de A',
    telefono: '+34600000001',
  });
  check('una miembro puede apuntar en su agenda', puestoA.cuerpo.ok === true, JSON.stringify(puestoA.cuerpo));

  const puestoB = await como(b.cookie, 'POST', '', {
    titulo: 'Sesión con una clienta de B',
    cuando: manana(12),
    duracionMin: 45,
    tipo: 'Sesión',
    conQuien: 'Clienta de B',
  });
  check('la segunda también', puestoB.cuerpo.ok === true, JSON.stringify(puestoB.cuerpo));

  /* ---------- Y solo lo suyo ---------- */
  const veA = await como(a.cookie, 'GET');
  const veB = await como(b.cookie, 'GET');
  const titulos = (r) => (r.cuerpo.eventos ?? []).map((e) => e.titulo);

  check('A ve su evento', titulos(veA).includes('Sesión con una clienta de A'));
  check('A NO ve el de B', !titulos(veA).includes('Sesión con una clienta de B'), titulos(veA).join(' | '));
  check('B ve su evento', titulos(veB).includes('Sesión con una clienta de B'));
  check('B NO ve el de A', !titulos(veB).includes('Sesión con una clienta de A'), titulos(veB).join(' | '));
  check('cada una ve exactamente un evento', veA.cuerpo.eventos?.length === 1 && veB.cuerpo.eventos?.length === 1);

  /* ---------- Con el identificador de la otra en la mano ---------- */
  const idDeB = puestoB.cuerpo.id;

  const intentoEditar = await como(a.cookie, 'PATCH', '', { id: idDeB, estado: 'Cancelado' });
  check(
    'A no puede cancelar el evento de B ni sabiendo su id',
    intentoEditar.cuerpo.ok !== true,
    JSON.stringify(intentoEditar.cuerpo)
  );

  const intentoBorrar = await como(a.cookie, 'DELETE', `?id=${encodeURIComponent(idDeB)}`);
  /* Esta contesta ok, y es correcto: A ha borrado un documento que no existe
     EN SU agenda, y borrar lo que no está no es un error. Lo que importa no es
     la respuesta sino lo que queda en la base de datos. */
  const siguePuesto = await como(b.cookie, 'GET');
  check(
    'el evento de B sigue en su sitio después del intento de borrado',
    titulos(siguePuesto).includes('Sesión con una clienta de B'),
    'respuesta del borrado: ' + JSON.stringify(intentoBorrar.cuerpo)
  );

  /* ---------- Y está guardado donde se cree que está ---------- */
  const enLaRaiz = await db.collection('agenda').get();
  check(
    'no se ha escrito nada en la colección «agenda» de la raíz',
    enLaRaiz.size === 0,
    enLaRaiz.size + ' documentos'
  );
  const bajoA = await db.collection('usuarios').doc(a.uid).collection('agenda').get();
  check('el evento de A está colgado de A', bajoA.size === 1, bajoA.size + ' documentos');

  /* ---------- La de Sorela, aparte ---------- */
  const correoAdmin = (process.env.ADMIN_CORREOS || '').split(',')[0].trim();
  const sorela = await auth.getUserByEmail(correoAdmin).catch(() => null);
  if (sorela) {
    const veSorela = await como(await cookieDe(sorela.uid), 'GET');
    check('Sorela entra en su agenda', veSorela.cuerpo.ok === true, JSON.stringify(veSorela.cuerpo));
    check(
      'Sorela NO ve los eventos de las dos cuentas de prueba',
      !titulos(veSorela).some((t) => /clienta de [AB]$/.test(t)),
      titulos(veSorela).join(' | ')
    );
  } else {
    check('no se ha podido comprobar la agenda de Sorela', false, 'no existe ' + correoAdmin);
  }

  /* ---------- Marcar y borrar lo propio sí funciona ---------- */
  const marcado = await como(a.cookie, 'PATCH', '', { id: puestoA.cuerpo.id, estado: 'Hecho' });
  check('A sí puede marcar lo suyo como hecho', marcado.cuerpo.ok === true, JSON.stringify(marcado.cuerpo));
  const borrado = await como(a.cookie, 'DELETE', `?id=${encodeURIComponent(puestoA.cuerpo.id)}`);
  const vacia = await como(a.cookie, 'GET');
  check(
    'A sí puede borrar lo suyo',
    borrado.cuerpo.ok === true && (vacia.cuerpo.eventos ?? []).length === 0,
    JSON.stringify(vacia.cuerpo.eventos)
  );
} finally {
  await limpiar();
}

console.log(`OK (${ok.length})`);
ok.forEach((n) => console.log('  ✓ ' + n));
if (mal.length) {
  console.log(`\nFALLA (${mal.length})`);
  mal.forEach((n) => console.log('  ✗ ' + n));
  process.exit(1);
}
