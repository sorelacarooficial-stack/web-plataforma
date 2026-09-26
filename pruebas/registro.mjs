/**
 * El registro de la web, contra el Firebase de verdad.
 *
 *   npm run pruebas:registro
 *
 * Lo que hay que comprobar aquí no es que el formulario guarde —eso se ve a la
 * primera— sino la línea que separa dos cosas que se parecen: TENER CUENTA y
 * TENER ACCESO.
 *
 * Desde que cualquiera puede crearse una cuenta, esa línea es lo único que
 * impide que alguien se dé la Comunidad Divine a sí mismo. Y se puede intentar
 * de dos maneras, las dos probadas abajo: mandando `accesos` en la petición
 * del registro, y mandando un rol de administradora. Si alguna colara, la
 * membresía dejaría de ser de pago sin que nadie se enterara.
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

/* Cuentas de usar y tirar. ejemplo.com está reservado justo para esto: no
   existe, así que no hay forma de que un correo salga a alguien. */
const CORREOS = [
  'prueba-registro@ejemplo.com',
  'prueba-registro-listo@ejemplo.com',
  'prueba-registro-admin@ejemplo.com',
];

async function limpiar() {
  for (const correo of CORREOS) {
    const u = await auth.getUserByEmail(correo).catch(() => null);
    if (u) {
      const suya = await db.collection('usuarios').doc(u.uid).collection('agenda').get();
      for (const d of suya.docs) await d.ref.delete().catch(() => {});
      await db.collection('usuarios').doc(u.uid).delete().catch(() => {});
      await auth.deleteUser(u.uid).catch(() => {});
    }
    await db.collection('contactos').doc(correo).delete().catch(() => {});
  }
}

/**
 * Se registra como lo haría el formulario.
 *
 * Cada llamada va con su IP distinta salvo que se diga otra cosa. No es hacer
 * trampa al freno: es que cada caso de abajo representa a UNA PERSONA, y dos
 * personas no comparten IP. Cuando lo que se quiere probar es precisamente el
 * freno, se pasa la misma a propósito.
 */
let cuantas = 0;
const registrar = (cuerpo, ip) =>
  fetch(B + '/api/registro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip ?? `10.9.0.${++cuantas % 250}`,
    },
    body: JSON.stringify(cuerpo),
  });

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

const BUENO = {
  nombre: 'Prueba Registro',
  correo: CORREOS[0],
  clave: 'unaContraseñaLarga',
  quiere: 'comunidad',
  consentimiento: true,
};

/* ==========================================================================
   Adelante
   ========================================================================== */

await limpiar();

try {
  /* ---------- Lo que no se acepta ---------- */
  for (const [que, cuerpo] of [
    ['sin nombre', { ...BUENO, nombre: '' }],
    ['con un correo que no lo es', { ...BUENO, correo: 'ana@' }],
    ['con una contraseña de cuatro letras', { ...BUENO, clave: 'abcd' }],
    ['sin decir a qué viene', { ...BUENO, quiere: '' }],
    ['sin aceptar la privacidad', { ...BUENO, consentimiento: false }],
  ]) {
    const r = await registrar(cuerpo);
    const c = await r.json().catch(() => ({}));
    check(`no deja registrarse ${que}`, r.status === 400 && Object.keys(c.errores ?? {}).length > 0);
  }

  const creadas = await auth.listUsers(1000);
  check(
    'y nada de eso ha creado una cuenta',
    !creadas.users.some((u) => u.email === CORREOS[0]),
    'se ha colado una'
  );

  /* ---------- El señuelo ---------- */
  const robot = await registrar({ ...BUENO, empresa: 'SEO Services Ltd' });
  const cuerpoRobot = await robot.json().catch(() => ({}));
  check('al robot se le contesta que sí y no se crea nada', cuerpoRobot.ok === true);
  check(
    'y en efecto no se ha creado',
    !(await auth.getUserByEmail(CORREOS[0]).catch(() => null))
  );

  /* ---------- El registro bueno ---------- */
  const r = await registrar(BUENO);
  const c = await r.json().catch(() => ({}));
  check('una persona puede crearse su cuenta', c.ok === true, JSON.stringify(c));

  const usuario = await auth.getUserByEmail(CORREOS[0]).catch(() => null);
  check('la cuenta existe en Firebase', Boolean(usuario));
  check('con su nombre puesto', usuario?.displayName === 'Prueba Registro');

  const ficha = (await db.collection('usuarios').doc(usuario.uid).get()).data() ?? {};
  check('y su ficha dice que se registró ella', ficha.altaPor === 'registro', String(ficha.altaPor));
  check('y a qué viene', ficha.pide === 'comunidad', String(ficha.pide));
  check('NACE SIN ACCESO A NADA', Array.isArray(ficha.accesos) && ficha.accesos.length === 0, JSON.stringify(ficha.accesos));
  check('y con el rol de siempre, no con otro', ficha.rol === 'miembro', String(ficha.rol));

  const claim = (await auth.getUser(usuario.uid)).customClaims?.role;
  check('el rol firmado en el token tampoco es otro', claim === 'miembro', String(claim));

  /* ---------- Cae además en la lista de contactos ---------- */
  const contacto = (await db.collection('contactos').doc(CORREOS[0]).get()).data() ?? {};
  check('aparece en la lista de contactos', contacto.correo === CORREOS[0]);
  check('clasificada por lo que ha pedido', contacto.origen === 'comunidad-registro', String(contacto.origen));
  check('y marcada como que tiene cuenta', contacto.registrada === true);

  /* ---------- Con su cuenta, entra… y no ve nada ---------- */
  const cookie = await cookieDe(usuario.uid);
  const lecciones = await (await fetch(B + '/api/lecciones', { headers: { cookie: `divine_sesion=${cookie}` } })).json();
  check('entra en la plataforma', lecciones.ok === true, JSON.stringify(lecciones));
  check('pero el aula le sale vacía', (lecciones.lecciones ?? []).length === 0);

  for (const ruta of ['/api/contactos', '/api/usuarios', '/api/facturas']) {
    const x = await fetch(B + ruta, { headers: { cookie: `divine_sesion=${cookie}` } });
    check(`y ${ruta} le contesta que no`, x.status === 403, 'estado ' + x.status);
  }

  /* ---------- El freno, con todo desde la misma IP ---------- */
  let frenada = false;
  for (let i = 0; i < 8; i++) {
    const x = await registrar({ ...BUENO, correo: `prueba-rafaga-${i}@ejemplo.com` }, '10.9.9.9');
    if (x.status === 429) frenada = true;
  }
  check('una ráfaga desde la misma IP se corta', frenada);
  const rafaga = (await auth.listUsers(1000)).users.filter((u) => (u.email || '').startsWith('prueba-rafaga-'));
  check('y no se han creado las ocho cuentas', rafaga.length < 8, rafaga.length + ' creadas');
  for (const u of rafaga) {
    await db.collection('usuarios').doc(u.uid).delete().catch(() => {});
    await db.collection('contactos').doc(u.email).delete().catch(() => {});
    await auth.deleteUser(u.uid).catch(() => {});
  }

  /* ---------- Y el mismo correo no se registra dos veces ---------- */
  const otra = await registrar({ ...BUENO, nombre: 'Otra Persona' });
  const cuerpoOtra = await otra.json().catch(() => ({}));
  check(
    'con un correo que ya tiene cuenta, lo dice y no la pisa',
    otra.status === 409 && Boolean(cuerpoOtra.errores?.correo)
  );
  check(
    'y la cuenta de la primera sigue siendo suya',
    (await auth.getUserByEmail(CORREOS[0])).displayName === 'Prueba Registro'
  );

  /* ==========================================================================
     Lo que de verdad importa: intentar darse acceso a uno mismo
     ========================================================================== */

  /* Con accesos escritos a mano en la petición. Si esto colara, cualquiera
     tendría la membresía gratis escribiendo una línea en la consola del
     navegador. */
  const colarse = await registrar({
    ...BUENO,
    correo: CORREOS[1],
    accesos: [{ tipo: 'membresia' }, { tipo: 'curso', nombre: 'Formación Base' }],
  });
  check('se puede registrar mandando accesos (la petición no falla)', (await colarse.json()).ok === true);
  const colada = await auth.getUserByEmail(CORREOS[1]);
  const suFicha = (await db.collection('usuarios').doc(colada.uid).get()).data() ?? {};
  check(
    'PERO LOS ACCESOS QUE SE MANDAN SE TIRAN',
    Array.isArray(suFicha.accesos) && suFicha.accesos.length === 0,
    JSON.stringify(suFicha.accesos)
  );
  const suCookie = await cookieDe(colada.uid);
  const suAula = await (await fetch(B + '/api/lecciones', { headers: { cookie: `divine_sesion=${suCookie}` } })).json();
  check('y su aula sigue vacía', (suAula.lecciones ?? []).length === 0);

  /* Con el rol de administradora. */
  const subirse = await registrar({ ...BUENO, correo: CORREOS[2], rol: 'sorela' });
  check('se puede registrar mandando rol de admin (la petición no falla)', (await subirse.json()).ok === true);
  const subida = await auth.getUserByEmail(CORREOS[2]);
  check(
    'PERO EL ROL QUE SE MANDA SE TIRA',
    (await auth.getUser(subida.uid)).customClaims?.role === 'miembro',
    String((await auth.getUser(subida.uid)).customClaims?.role)
  );
  const cookieSubida = await cookieDe(subida.uid);
  const comoAdmin = await fetch(B + '/api/usuarios', { headers: { cookie: `divine_sesion=${cookieSubida}` } });
  check('y no entra en las cuentas de Sorela', comoAdmin.status === 403, 'estado ' + comoAdmin.status);

  /* ---------- Sorela sí le abre la puerta ---------- */
  const correoAdmin = (process.env.ADMIN_CORREOS || '').split(',')[0].trim();
  const sorela = await auth.getUserByEmail(correoAdmin).catch(() => null);
  if (!sorela) {
    check('no se ha podido probar el paso de Sorela', false, 'no existe ' + correoAdmin);
  } else {
    const cookieSorela = await cookieDe(sorela.uid);
    const dar = await fetch(B + '/api/usuarios', {
      method: 'PATCH',
      headers: { cookie: `divine_sesion=${cookieSorela}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: usuario.uid, accesos: [{ tipo: 'membresia' }] }),
    });
    check('Sorela le da la comunidad desde su pantalla', (await dar.json()).ok === true);

    const ahora = await (await fetch(B + '/api/usuarios', { headers: { cookie: `divine_sesion=${cookieSorela}` } })).json();
    const linea = (ahora.usuarios ?? []).find((u) => u.uid === usuario.uid);
    check('y en la lista se ve que esa persona se registró ella', linea?.seRegistro === true);
    check('y a qué vino', linea?.pide === 'comunidad', String(linea?.pide));
  }
} catch (e) {
  // Sin esto, un fallo a mitad tira el proceso y no se ve nada de lo que ya
  // había pasado, que es lo que hace falta para saber dónde se rompió.
  mal.push('la prueba se cortó: ' + String(e).split('\n')[0]);
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
