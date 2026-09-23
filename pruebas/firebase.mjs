/**
 * Comprueba que la llave de Firebase funciona de verdad, antes de meterla en
 * Vercel y descubrir allí que no.
 *
 *   node --env-file=.env.local pruebas/firebase.mjs
 *
 * Escribe un contacto de prueba, lo lee, comprueba que llegó completo y lo
 * borra. No deja rastro. Si algo falla, dice exactamente qué: que la llave no
 * vale, que Firestore no está creado o que las reglas no dejan pasar.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const ok = [];
const mal = [];
const check = (n, c, d) => (c ? ok : mal).push(d ? `${n} — ${d}` : n);

const faltan = ['FIREBASE_PROYECTO_ID', 'FIREBASE_CLIENTE_CORREO', 'FIREBASE_CLAVE_PRIVADA'].filter(
  (v) => !process.env[v]
);
if (faltan.length) {
  console.error('Faltan variables: ' + faltan.join(', '));
  console.error('Ejecuta:  node --env-file=.env.local pruebas/firebase.mjs');
  process.exit(1);
}

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

const db = getFirestore(app);
const ref = db.collection('contactos').doc('prueba-de-conexion@ejemplo.com');

/* ---------- Escribir ---------- */
try {
  await ref.set({
    nombre: 'Prueba de conexión',
    correo: 'prueba-de-conexion@ejemplo.com',
    whatsapp: '+34600000000',
    consentimiento: true,
    origen: 'prueba',
    creado: FieldValue.serverTimestamp(),
  });
  check('la llave sirve para escribir en Firestore', true);
} catch (e) {
  const c = e?.code ?? '';
  check(
    'la llave sirve para escribir en Firestore',
    false,
    c === 5 || /NOT_FOUND/i.test(String(e))
      ? 'Firestore no está creado en este proyecto'
      : /PERMISSION_DENIED/i.test(String(e))
        ? 'la cuenta de servicio no tiene permiso'
        : String(e).slice(0, 200)
  );
  informar();
}

/* ---------- Leer ---------- */
try {
  const d = await ref.get();
  check('lo escrito se puede volver a leer', d.exists);
  check('el dato llega entero', d.data()?.nombre === 'Prueba de conexión', d.data()?.nombre);
  check('la hora la pone el servidor de Google', Boolean(d.data()?.creado));
} catch (e) {
  check('lo escrito se puede volver a leer', false, String(e).slice(0, 160));
}

/* ---------- Borrar, para no dejar basura ---------- */
try {
  await ref.delete();
  check('y se puede borrar (no queda rastro de la prueba)', !(await ref.get()).exists);
} catch (e) {
  check('y se puede borrar', false, String(e).slice(0, 160));
}

/* ---------- Autenticación: ¿la misma llave sirve para los roles? ---------- */
try {
  const lista = await getAuth(app).listUsers(5);
  check('la llave puede gestionar usuarios (hace falta para los roles)', true);
  check(
    'cuántas cuentas hay dadas de alta',
    true,
    lista.users.length === 0
      ? 'ninguna todavía'
      : lista.users.map((u) => u.email ?? u.uid).join(', ')
  );
} catch (e) {
  check(
    'la llave puede gestionar usuarios (hace falta para los roles)',
    false,
    String(e).slice(0, 200)
  );
}

informar();

function informar() {
  console.log('OK (' + ok.length + ')');
  ok.forEach((n) => console.log('  ✓ ' + n));
  if (mal.length) {
    console.log('\nFALLOS (' + mal.length + '):');
    mal.forEach((n) => console.log('  ✗ ' + n));
  }
  process.exit(mal.length ? 1 : 0);
}
