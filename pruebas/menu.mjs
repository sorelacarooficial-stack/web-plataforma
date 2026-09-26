/**
 * Menús responsivos: hamburguesa en la web y cajón en la plataforma.
 * Antes la navegación se apretujaba contra el botón de tema en móvil.
 *
 *   node --env-file=.env.local pruebas/menu.mjs
 *
 * La parte de la plataforma necesita una sesión de verdad: desde que el acceso
 * está cerrado, /plataforma sin cookie lleva al acceso y no hay cajón que
 * medir. Antes esto se resolvía mirando si la web decía «el acceso todavía no
 * está conectado» —un texto que ya no sale con Firebase configurado—, así que
 * la prueba entraba en la rama equivocada y se caía buscando un <main> que no
 * existe. Ahora se abre sesión como la abre el navegador y se mide de verdad.
 */
import { chromium } from 'playwright';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/caps';
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3100';

const ok = [];
const mal = [];
const check = (n, c, d) => (c ? ok : mal).push(d ? `${n} — ${d}` : n);

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ================= Web pública ================= */
for (const [w, h] of [[320, 568], [390, 844], [768, 900]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  const ham = p.getByRole('button', { name: 'Abrir el menú' });
  check(`web ${w}px · hay hamburguesa`, await ham.isVisible());
  check(`web ${w}px · el nav de escritorio está oculto`, !(await p.locator('header nav a', { hasText: 'Método' }).first().isVisible()));

  // Nada se pisa en la cabecera
  const solapa = await p.evaluate(() => {
    const els = [...document.querySelectorAll('header > div > *')].map((e) => e.getBoundingClientRect());
    for (let i = 0; i < els.length; i++)
      for (let j = i + 1; j < els.length; j++)
        if (els[i].right > els[j].left + 1 && els[j].right > els[i].left + 1) return true;
    return false;
  });
  check(`web ${w}px · la cabecera no se solapa`, !solapa);

  await ham.click();
  await p.waitForTimeout(450);
  const panel = p.locator('#menu-movil');
  check(`web ${w}px · el menú abre`, await panel.getByRole('link', { name: 'Formaciones' }).isVisible());
  check(`web ${w}px · el menú tiene Entrar`, await panel.getByRole('link', { name: 'Entrar' }).isVisible());
  await p.screenshot({ path: `${OUT}/menu-web-${w}.png` });

  const desborda = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`web ${w}px · el menú no desborda`, !desborda);

  await panel.getByRole('link', { name: 'Formaciones' }).click();
  await p.waitForTimeout(800);
  check(
    `web ${w}px · navega y cierra el menú`,
    new URL(p.url()).pathname === '/formaciones' && !(await p.locator('#menu-movil').isVisible())
  );

  await ctx.close();
}

/* Escritorio: la hamburguesa no debe aparecer */
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  check('web 1440px · sin hamburguesa', !(await p.getByRole('button', { name: 'Abrir el menú' }).isVisible()));
  check('web 1440px · nav completo visible', await p.locator('header nav a', { hasText: 'Método' }).first().isVisible());
  check('web 1440px · botón Entrar visible', await p.locator('header a', { hasText: 'Entrar' }).first().isVisible());
  await ctx.close();
}

/* ================= Plataforma =================
   Hace falta sesión: sin ella, /plataforma lleva al acceso. Se comprueba
   primero que esa puerta está cerrada, y después se abre una sesión de Sorela
   —solo para mirar, no se crea ni se borra nada— para medir el cajón. */
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
  check('plataforma · sin sesión lleva al acceso', new URL(p.url()).pathname === '/entrar', p.url());
  await p.screenshot({ path: `${OUT}/plataforma-protegida-movil.png` });
  await ctx.close();
}

/** La cookie de sesión de Sorela, montada como la monta el navegador. */
const cookieDeSorela = await (async () => {
  const correo = (process.env.ADMIN_CORREOS || '').split(',')[0].trim();
  if (!correo || !process.env.FIREBASE_PROYECTO_ID) return null;
  try {
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
    const usuario = await auth.getUserByEmail(correo);
    const custom = await auth.createCustomToken(usuario.uid);
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: custom, returnSecureToken: true }),
      }
    );
    const { idToken } = await r.json();
    return idToken ? await auth.createSessionCookie(idToken, { expiresIn: 3600000 }) : null;
  } catch (e) {
    check('no se ha podido abrir sesión para medir el cajón', false, String(e).slice(0, 120));
    return null;
  }
})();

/** Un navegador ya dentro de la plataforma, del tamaño que se pida. */
async function dentro(w, h) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES' });
  await ctx.addCookies([
    { name: 'divine_sesion', value: cookieDeSorela, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
  const p = await ctx.newPage();
  await p.goto(B + '/plataforma', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { ctx, p };
}

for (const [w, h] of cookieDeSorela ? [[320, 568], [390, 844]] : []) {
  const { ctx, p } = await dentro(w, h);

  const lateralFuera = await p.evaluate(() => {
    const el = document.querySelector('#menu-plataforma');
    return el ? el.getBoundingClientRect().right <= 1 : false;
  });
  check(`plataforma ${w}px · el cajón arranca cerrado`, lateralFuera);
  check(`plataforma ${w}px · hay hamburguesa`, await p.getByRole('button', { name: 'Abrir el menú' }).isVisible());

  await p.getByRole('button', { name: 'Abrir el menú' }).click();
  await p.waitForTimeout(550);
  check(`plataforma ${w}px · el cajón abre`, await p.getByRole('button', { name: 'Clientes', exact: true }).isVisible());
  check(`plataforma ${w}px · el cajón tiene los roles`, await p.getByRole('button', { name: 'Sorela (admin)', exact: true }).isVisible());
  await p.screenshot({ path: `${OUT}/menu-plataforma-${w}.png` });

  await p.getByRole('button', { name: 'Clientes', exact: true }).click();
  await p.waitForTimeout(600);
  const cerrado = await p.evaluate(() => {
    const el = document.querySelector('#menu-plataforma');
    return el ? el.getBoundingClientRect().right <= 1 : false;
  });
  check(`plataforma ${w}px · al elegir sección se cierra`, cerrado);
  check(`plataforma ${w}px · ha cambiado de vista`, await p.getByText('Tus clientes').first().isVisible());

  const desborda = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`plataforma ${w}px · sin desbordamiento`, !desborda);

  await ctx.close();
}

/* Escritorio: la lateral es fija y sin hamburguesa */
if (cookieDeSorela) {
  const { ctx, p } = await dentro(1440, 900);
  check('plataforma 1440px · sin hamburguesa', !(await p.getByRole('button', { name: 'Abrir el menú' }).isVisible()));
  check('plataforma 1440px · la lateral está a la vista', await p.getByRole('button', { name: 'Clientes', exact: true }).isVisible());
  await ctx.close();
}

/* ================= La puerta de acceso =================
   Aquí se comprobaba que el botón de «Continuar con Google» llevara los cuatro
   colores oficiales. Ese botón ya no existe, y no por descuido: se quitó junto
   con el registro para que nadie que llegue por el buscador pueda darse de
   alta solo. Lo que hay que comprobar ahora es justo lo contrario —que no hay
   por dónde crearse una cuenta—, que es lo que sostiene todo lo demás. */
{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  await p.goto(B + '/entrar', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const cuerpo = await p.locator('body').innerText();
  check('login · pide correo y contraseña', await p.locator('input[aria-label="Correo"]').isVisible());
  check('login · no se puede crear una cuenta desde aquí', !/Crear cuenta|Crea tu cuenta|Reg[íi]strate/i.test(cuerpo), cuerpo.slice(0, 120).replace(/\n+/g, ' | '));
  check('login · no hay entrada con Google', !/Continuar con Google/i.test(cuerpo));
  check('login · sin cartel de maqueta', !/Maqueta para revisi[óo]n/i.test(cuerpo));
  await p.screenshot({ path: `${OUT}/login.png` });
  await ctx.close();
}

await nav.close();

console.log('OK (' + ok.length + ')');
if (mal.length) {
  console.log('\nFALLOS (' + mal.length + '):');
  mal.forEach((n) => console.log('  ✗ ' + n));
} else ok.forEach((n) => console.log('  ✓ ' + n));
process.exit(mal.length ? 1 : 0);
