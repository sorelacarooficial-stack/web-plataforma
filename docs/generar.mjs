/**
 * Convierte los manuales de HTML a PDF con el Chromium que ya está instalado.
 *
 *   node docs/generar.mjs
 *   CLAVE_SORELA='...' node docs/generar.mjs    (con la contraseña dentro)
 *
 * Con CLAVE_SORELA puesta escribe ADEMÁS una copia en `docs/privado/` con la
 * contraseña rellenada en su hueco. Esa carpeta está en .gitignore y no se
 * sube nunca: el repositorio es público, y ahí la contraseña de la
 * administradora sería descargable por cualquiera junto a su correo. El manual
 * que sí se sube deja el hueco en blanco para escribirla a mano.
 *
 * Se imprime desde un file:// para que las fuentes y el logotipo del propio
 * repositorio se carguen: dentro de un PDF no hay red, así que una tipografía
 * traída de fuera se quedaría sin cargar y saldría todo en Times New Roman.
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const DOCS = [
  ['manual-cuentas', 'Dar acceso a una persona'],
  ['manual-plataforma', 'Tu plataforma, de un vistazo'],
];

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await nav.newContext({ locale: 'es-ES' })).newPage();

for (const [nombre, titulo] of DOCS) {
  const origen = path.join(AQUI, `${nombre}.html`);
  const salida = path.join(AQUI, `${nombre}.pdf`);

  await p.goto(pathToFileURL(origen).href, { waitUntil: 'networkidle' });
  // Sin esto el PDF puede salir con las fuentes a medio cargar.
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);

  await p.pdf({
    path: salida,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    // El número de página, discreto y con el mismo gris del texto suave. La
    // primera no lo lleva: es la portada.
    footerTemplate: `
      <div style="width:100%;padding:0 16mm;font-family:sans-serif;font-size:7pt;letter-spacing:.14em;color:#a79e92;display:flex;justify-content:space-between">
        <span>${titulo}</span>
        <span class="pageNumber"></span>
      </div>`,
    margin: { top: '17mm', right: '16mm', bottom: '19mm', left: '16mm' },
  });

  const kb = Math.round(statSync(salida).size / 1024);
  console.log(`✓ ${nombre}.pdf · ${kb} KB`);

  /* La copia con la contraseña escrita, si se ha pedido. Se rellena el hueco
     que el HTML deja marcado con `data-clave` y se imprime a otra carpeta. */
  const clave = process.env.CLAVE_SORELA;
  if (clave) {
    const hueco = await p.locator('[data-clave]').count();
    if (hueco) {
      await p.evaluate((c) => {
        const dd = document.querySelector('[data-clave]');
        if (dd) dd.textContent = c;
        // El aviso cambia: en esta copia la contraseña ya no está en blanco,
        // y lo que hay que decir es qué abre este papel.
        document.querySelectorAll('[data-sin-clave]').forEach((e) => (e.hidden = true));
        document.querySelectorAll('[data-con-clave]').forEach((e) => (e.hidden = false));
      }, clave);
      await p.waitForTimeout(200);
      mkdirSync(path.join(AQUI, 'privado'), { recursive: true });
      const privado = path.join(AQUI, 'privado', `${nombre}.pdf`);
      await p.pdf({
        path: privado,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width:100%;padding:0 16mm;font-family:sans-serif;font-size:7pt;letter-spacing:.14em;color:#a79e92;display:flex;justify-content:space-between">
            <span>${titulo}</span>
            <span class="pageNumber"></span>
          </div>`,
        margin: { top: '17mm', right: '16mm', bottom: '19mm', left: '16mm' },
      });
      console.log(`  ↳ privado/${nombre}.pdf · con la contraseña dentro, NO se sube`);
    }
  }
}

await nav.close();
