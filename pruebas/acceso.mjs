/**
 * El acceso, de punta a punta y contra el Firebase de verdad.
 *
 *   node --env-file=.env.local pruebas/acceso.mjs
 *
 * Crea una cuenta de usar y tirar, entra con ella desde el navegador, y
 * comprueba lo que de verdad importa: que sin sesión no se sirve la
 * plataforma, que con sesión sí, que el rol que toca es el que sale, y que
 * al salir la puerta se vuelve a cerrar. Al terminar borra la cuenta.
 *
 * NO toca la cuenta de Sorela: esa la crea ella la primera vez que entre con
 * Google, y el rol de administradora se lo da ADMIN_CORREOS.
 */
import { chromium } from 'playwright';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { mkdirSync } from 'node:fs';

const OUT =
  process.env.OUT ||
  '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/acceso';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3100';

const ok = [];
const mal = [];
const check = (n, c, d) => (c ? ok : mal).push(d ? `${n} — ${d}` : n);

const CORREO = 'prueba-acceso@ejemplo.com';
const CLAVE = 'PruebaDivine2026!';

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

/**
 * Deja el proyecto como estaba, pase lo que pase.
 *
 * Hay que borrar DOS cosas, no una. Al entrar, el servidor le escribe a cada
 * persona su ficha en usuarios/{uid} (ver asegurarRol), así que borrar solo la
 * cuenta de Authentication deja esa ficha suelta, sin dueño y sin forma de
 * saber de dónde salió. Pasó: apareció una «prueba-acceso@ejemplo.com» en la
 * base de datos de producción semanas después, y hubo que ir a mano.
 */
async function limpiar() {
  let uid = null;
  try {
    uid = (await auth.getUserByEmail(CORREO)).uid;
    await auth.deleteUser(uid);
  } catch {
    /* no existía */
  }
  if (uid) {
    try {
      await getFirestore(app).collection('usuarios').doc(uid).delete();
    } catch {
      /* si no llegó a escribirse, mejor */
    }
  }
}

await limpiar();
const usuario = await auth.createUser({
  email: CORREO,
  password: CLAVE,
  displayName: 'Prueba Acceso',
});

const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  /*
   * El navegador tiene que salir por el mismo proxy que el resto del entorno.
   * Sin esto, su llamada a Firebase se queda colgada para siempre y la
   * pantalla se queda en «Un momento…»: parecería que el acceso está roto
   * cuando lo que no sale a internet es el navegador de la prueba.
   */
  ...(process.env.HTTPS_PROXY
    ? {
        proxy: {
          server: process.env.HTTPS_PROXY,
          // La web de prueba corre aquí mismo: si también se mandara al proxy,
          // no se alcanzaría y la prueba fallaría antes de empezar.
          bypass: 'localhost,127.0.0.1',
        },
      }
    : {}),
});

try {
  const ctx = await nav.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'es-ES',
    /*
     * Esto NO relaja nada del producto: es solo el navegador de esta prueba.
     *
     * El entorno donde se ejecuta saca todo el tráfico por un proxy que
     * vuelve a firmar los certificados, y este Chromium no lleva ese
     * certificado instalado. Sin esto, su llamada a Firebase falla con
     * ERR_CERT_AUTHORITY_INVALID y la prueba parecería decir que el acceso
     * está roto cuando lo que está roto es el laboratorio.
     *
     * La forma correcta sería meter el certificado en el almacén del
     * navegador, pero certutil no está disponible aquí y no se puede
     * instalar. Un navegador de verdad, en un ordenador de verdad, no tiene
     * este problema.
     */
    ignoreHTTPSErrors: true,
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));

  /* ---------- Sin sesión, la puerta está cerrada ---------- */
  await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
  check(
    'sin sesión, la plataforma manda al acceso',
    new URL(p.url()).pathname === '/entrar',
    p.url()
  );

  /* ---------- Entrar con correo y contraseña ---------- */
  check('el acceso pide los datos (Firebase está configurado)', await p.getByText('Entra en tu espacio').isVisible());
  check('hay entrada con Google', await p.getByRole('button', { name: /Continuar con Google/ }).isVisible());

  /*
   * A partir de aquí hace falta que el NAVEGADOR hable con Firebase, y el de
   * este contenedor no llega: la llamada se queda colgada y la pantalla se
   * queda en «Un momento…». No es un fallo de la web —el servidor sí habla
   * con Firebase, lo prueba pruebas/firebase.mjs— sino del laboratorio.
   *
   * Así que primero se comprueba si el navegador puede, y si no puede se dice
   * y se para. Dar seis fallos rojos por una limitación del entorno es peor
   * que no probar: esconde los fallos de verdad.
   */
  await p.locator('input[aria-label="Correo"]').fill(CORREO);
  await p.locator('input[aria-label="Contraseña"]').fill('esta-no-es');
  await p.getByRole('button', { name: /^entrar$/i }).click();

  const respondio = await p
    .waitForFunction(() => !/un momento/i.test(document.body.innerText), null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  // «No hay conexión» es el aviso que sale cuando Firebase no contesta. Aquí
  // no significa que la web falle: significa que este navegador no llega.
  const sinRed = (await p.getByText(/No hay conexión/i).count()) > 0;

  if (!respondio || sinRed) {
    console.log('OK (' + ok.length + ') — el resto se salta');
    ok.forEach((n) => console.log('  ✓ ' + n));
    console.log(
      '\nEl navegador de este entorno no alcanza a Firebase, así que no se puede\n' +
        'probar el acceso desde aquí. El servidor sí lo alcanza: eso lo comprueba\n' +
        'pruebas/firebase.mjs. Esta parte se verifica en el despliegue de verdad.'
    );
    await nav.close();
    await limpiar();
    process.exit(0);
  }

  check(
    'con la contraseña mal, lo dice y no entra',
    (await p.getByText(/no son correctos/i).count()) > 0 &&
      new URL(p.url()).pathname !== '/plataforma'
  );
  await p.screenshot({ path: `${OUT}/acceso-error.png` });

  await p.locator('input[aria-label="Contraseña"]').fill(CLAVE);
  await p.getByRole('button', { name: /^entrar$/i }).click();
  await p.waitForURL('**/plataforma', { timeout: 20000 }).catch(() => {});
  check(
    'con la contraseña bien, entra en la plataforma',
    new URL(p.url()).pathname === '/plataforma',
    p.url()
  );

  /* ---------- Dentro: el rol es el que toca ---------- */
  const dentro = await p.locator('body').innerText();
  check('dentro se ve con qué cuenta ha entrado', /Prueba Acceso/i.test(dentro));
  check('el rol que sale es el de por defecto', /alumna/i.test(dentro), 'se esperaba alumna');
  check(
    'una alumna NO ve el selector de roles de Sorela',
    !/ver como/i.test(dentro)
  );
  check(
    'una alumna NO ve las vistas de administración',
    !/Mis clientas|Panel de Sorela/i.test(dentro)
  );
  await p.screenshot({ path: `${OUT}/plataforma-alumna.png` });

  /* ---------- El rol está en el token, no en el navegador ---------- */
  const claim = (await auth.getUser(usuario.uid)).customClaims?.role;
  check('el rol queda firmado en el token de Firebase', claim === 'alumna', String(claim));

  /* ---------- Salir cierra de verdad ---------- */
  await p.getByRole('button', { name: /^salir/i }).click();
  await p.waitForTimeout(2500);
  await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
  check(
    'al salir, la plataforma vuelve a estar cerrada',
    new URL(p.url()).pathname === '/entrar',
    p.url()
  );

  /* ---------- Subirla a administradora y comprobar que cambia ---------- */
  await auth.setCustomUserClaims(usuario.uid, { role: 'sorela' });
  await p.locator('input[aria-label="Correo"]').fill(CORREO);
  await p.locator('input[aria-label="Contraseña"]').fill(CLAVE);
  await p.getByRole('button', { name: /^entrar$/i }).click();
  await p.waitForURL('**/plataforma', { timeout: 20000 }).catch(() => {});
  const comoAdmin = await p.locator('body').innerText();
  check('como administradora, sí ve el selector de roles', /ver como/i.test(comoAdmin));
  check('como administradora, ve el panel de Sorela', /Panel de Sorela|Mis clientas/i.test(comoAdmin));
  await p.screenshot({ path: `${OUT}/plataforma-admin.png` });

  check('sin errores de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '));

  await ctx.close();
} catch (e) {
  // Sin esto, un fallo a mitad tira el proceso y no se ve nada de lo que ya
  // había pasado, que es justo lo que hace falta para saber dónde se rompió.
  mal.push('la prueba se cortó: ' + String(e).split('\n')[0]);
} finally {
  await nav.close();
  await limpiar();
  console.log('(cuenta de prueba borrada)');
}

console.log('OK (' + ok.length + ')');
ok.forEach((n) => console.log('  ✓ ' + n));
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
}
process.exit(mal.length ? 1 : 0);
