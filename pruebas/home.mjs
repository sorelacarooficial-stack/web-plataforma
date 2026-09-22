/**
 * La home como canal de captación: el método explicado, las dos etapas de
 * formación y la comunidad con precio y fecha.
 *
 * Lo que antes comprobaba este archivo —«las dos puertas», la comunidad en
 * beta y sin precio— ya no existe: la comunidad abre el 17 de octubre y cuesta
 * 47 €. Las comprobaciones del inicio nuevo viven en pruebas/inicio-nuevo.mjs.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT='/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/caps';
mkdirSync(OUT,{recursive:true});
const B=process.env.BASE||'http://localhost:3100';
const ok=[],mal=[];const check=(n,c,d)=>(c?ok:mal).push(d?`${n} — ${d}`:n);

const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await nav.newContext({viewport:{width:1440,height:900},locale:'es-ES'});
const p=await ctx.newPage();
const errores=[];
p.on('pageerror',e=>errores.push(e.message));
p.on('console',m=>m.type()==='error'&&errores.push(m.text()));
await p.goto(B+'/',{waitUntil:'networkidle'});
await p.waitForTimeout(900);

const txt=await p.locator('main').innerText();

check('explica qué es la Técnica Divine', /primero abrir, despu[ée]s drenar/i.test(txt));
// innerText aplica text-transform: los rótulos llegan en mayúsculas, así que se compara sin distinguir caja.
check('están las cinco piezas de la comunidad', /agenda inteligente/i.test(txt) && /telegram/i.test(txt));
check('promete condición de fundadora', /fundador/i.test(txt));
check('la comunidad tiene precio', /47\s*€/.test(txt));
check('ya no aparece el precio antiguo', !/49\s*€/.test(txt));
check('anuncia la fecha de apertura', /17 de octubre/i.test(txt));

// El bloque de la lista ya no está en el inicio: la lista se entra por la
// misma ventana emergente que todo lo demás, desde el botón de la comunidad.
// El formulario largo con ciudad sigue vivo, pero en /comunidad.
check('el inicio ya no lleva el formulario largo dentro', (await p.locator('input[aria-label="Ciudad donde trabajas"]').count()) === 0);
check('ya no hay anclas rotas a #lista', (await p.locator('a[href="#lista"]').count()) === 0);

// El hero capta: su acción principal es el formulario, no un enlace. Desde
// que la web recibe tráfico de un QR, quien llega decide en esa pantalla.
const hero = p.locator('main section').first();
check(
  'el hero pide el contacto',
  await hero.getByRole('button', { name: 'Quiero la información' }).isVisible()
);
check(
  'el hero ofrece agendar sin dejar el dato todavía',
  await hero.getByRole('button', { name: 'Agendar una cita' }).isVisible()
);

// Entrar en la lista abre la misma ventana que el resto del inicio.
await p.getByRole('button', { name: 'Entrar en la lista' }).click();
await p.waitForTimeout(600);
const ventana = p.locator('dialog[open]');
check('«Entrar en la lista» abre la ventana', await ventana.isVisible());
check('la ventana habla de la lista', /Entra en la lista/i.test(await ventana.innerText()));
check(
  'y lleva la casilla de consentimiento sin premarcar',
  (await ventana.getByRole('checkbox').isVisible()) && !(await ventana.getByRole('checkbox').isChecked())
);
await p.screenshot({path:`${OUT}/home-lista.png`});
await p.keyboard.press('Escape');
await p.waitForTimeout(300);

// /comunidad ya no duplica el bloque
await p.goto(B+'/comunidad',{waitUntil:'networkidle'});
await p.waitForTimeout(600);
const com=await p.locator('main').innerText();
check('/comunidad ya no repite "Terminar la formación no es llegar"', !/Terminar la formación no es llegar/.test(com));
check('/comunidad conserva su formulario y sus objeciones', /Apúntate a la lista/.test(com) && /¿Cuándo abre\?/.test(com));

// Sin desbordamiento a 320
const movil=await nav.newContext({viewport:{width:320,height:568},locale:'es-ES'});
const m=await movil.newPage();
await m.goto(B+'/',{waitUntil:'networkidle'});
await m.waitForTimeout(900);
check('320px · la home sigue sin scroll horizontal', await m.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
await m.screenshot({path:`${OUT}/home-320.png`,fullPage:true});
await movil.close();

await nav.close();
console.log('OK ('+ok.length+')');
if(mal.length){console.log('\nFALLOS ('+mal.length+'):');mal.forEach(n=>console.log('  ✗ '+n));}else ok.forEach(n=>console.log('  ✓ '+n));
const e=[...new Set(errores)];
console.log(e.length?'\nERRORES DE CONSOLA:\n'+e.join('\n'):'\nsin errores de consola');
process.exit(mal.length?1:0);
