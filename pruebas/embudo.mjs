/**
 * El camino de venta del CRM (lib/embudo.ts) y la regla de precios de los
 * correos (lib/plantillas-campana.ts), probados solos, sin red.
 *
 *   node pruebas/embudo.mjs
 *
 * Se convierten a JavaScript con TypeScript en una carpeta temporal (igual
 * que pruebas/atencion.mjs) y se borra al acabar.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const carpeta = mkdtempSync(join(tmpdir(), 'embudo-'));
const hechos = new Set();
function compilar(rel) {
  if (hechos.has(rel)) return;
  hechos.add(rel);
  const { outputText } = ts.transpileModule(readFileSync(join(RAIZ, `${rel}.ts`), 'utf8'), {
    fileName: `${rel}.ts`,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const destino = join(carpeta, `${rel}.js`);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, outputText);
  for (const [, dep] of outputText.matchAll(/require\("(\.{1,2}\/[^"]+)"\)/g)) {
    const sig = posix.join(posix.dirname(rel), dep);
    if (existsSync(join(RAIZ, `${sig}.ts`))) compilar(sig);
  }
}

let bien = 0;
const fallos = [];
const caso = (nombre, fn) => {
  try {
    fn();
    bien++;
  } catch (e) {
    fallos.push(`${nombre}: ${e.message}`);
  }
};
const igual = (a, b, que = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${que} esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)}`);
};

try {
  compilar('lib/embudo');
  const E = createRequire(import.meta.url)(join(carpeta, 'lib/embudo.js'));
  const ahora = new Date('2026-11-11T12:00:00Z');
  const hace = (dias) => new Date(ahora.getTime() - dias * 86_400_000).toISOString();

  // Etapas
  caso('apuntada sin más → interesada', () => igual(E.etapaDe({ estado: 'Nuevo' }), 'interesada'));
  caso('Contactado → hablando', () => igual(E.etapaDe({ estado: 'Contactado' }), 'hablando'));
  caso('reserva sin pagar → reservo (aunque esté Contactado)', () => igual(E.etapaDe({ estado: 'Contactado', reserva: { pagoConfirmado: false } }), 'reservo'));
  caso('reserva pagada → pago', () => igual(E.etapaDe({ estado: 'Nuevo', reserva: { pagoConfirmado: true } }), 'pago'));
  caso('Cerrado a mano sin reserva (transferencia) → pago', () => igual(E.etapaDe({ estado: 'Cerrado' }), 'pago'));
  caso('cuenta con curso → alumna, aunque esté descartada', () => igual(E.etapaDe({ estado: 'Descartado', cuenta: { alumna: true } }), 'alumna'));
  caso('de baja → fuera', () => igual(E.etapaDe({ estado: 'Nuevo', deBaja: true }), 'fuera'));
  caso('pagó y luego de baja de correos → sigue en pago', () => igual(E.etapaDe({ reserva: { pagoConfirmado: true }, deBaja: true }), 'pago'));

  // Escribir hoy
  caso('interesada sin más → hoy no', () => igual(E.porQueHoy({ estado: 'Nuevo' }, ahora), null));
  caso('te necesita → hoy (necesita)', () => igual(E.porQueHoy({ estado: 'Nuevo', situacion: { grupo: 'te-necesita' } }, ahora)?.motivo, 'necesita'));
  caso('reservó sin pagar y sin notas → hoy (reservo)', () => igual(E.porQueHoy({ reserva: { pagoConfirmado: false } }, ahora)?.motivo, 'reservo'));
  caso('reservó sin pagar con nota de ayer → hoy no', () =>
    igual(E.porQueHoy({ reserva: { pagoConfirmado: false }, seguimiento: [{ cuando: hace(1) }] }, ahora), null));
  caso('hablando, «Ya le escribí» hace 1 día → hoy no', () => igual(E.porQueHoy({ estado: 'Contactado', estadoCambiado: hace(1) }, ahora), null));
  caso('hablando, última nota hace 4 días → se enfría', () => {
    const h = E.porQueHoy({ estado: 'Contactado', estadoCambiado: hace(10), seguimiento: [{ cuando: hace(4) }] }, ahora);
    igual(h?.motivo, 'frio');
    igual(h?.texto, 'Sin noticias hace 4 días');
  });
  caso('pagó sin acceso → hoy (pago)', () => igual(E.porQueHoy({ reserva: { pagoConfirmado: true } }, ahora)?.motivo, 'pago'));
  caso('alumna o fuera → nunca hoy', () => {
    igual(E.porQueHoy({ cuenta: { alumna: true }, situacion: { grupo: 'te-necesita' } }, ahora), null);
    igual(E.porQueHoy({ estado: 'Descartado', situacion: { grupo: 'te-necesita' } }, ahora), null);
  });

  // País
  caso('país por prefijo', () => {
    igual(E.paisDe('+57 300 123 4567'), 'Colombia');
    igual(E.paisDe('+58 412 1234567'), 'Venezuela');
    igual(E.paisDe('686 15 45 56'), 'España');
    igual(E.paisDe('+591 7 1234567'), 'Bolivia');
    igual(E.paisDe('+1 305 555 0101'), 'EE. UU. / Caribe');
    igual(E.paisDe('0034 686154556'), 'España');
    igual(E.paisDe('3001234567'), null, 'sin prefijo y corto: no se adivina');
    igual(E.paisDe(''), null);
  });
  caso('wa.me: 9 cifras españolas llevan el 34', () => {
    igual(E.numeroWhatsapp('686 15 45 56'), '34686154556');
    igual(E.numeroWhatsapp('+57 300 123 4567'), '573001234567');
  });

  // Mensajes: las reglas de la casa
  caso('a una interesada: sin precio y sin la Comunidad', () => {
    const t = E.mensajeEtapa({ nombre: 'Ana López', estado: 'Nuevo' });
    if (!t.startsWith('Hola Ana,')) throw new Error(t);
    if (/USD|€|\$|\d{3}/.test(t)) throw new Error(`lleva precio: ${t}`);
    if (/comunidad|membres/i.test(t)) throw new Error(`habla de la Comunidad: ${t}`);
  });
  caso('nunca la Comunidad ni la Membresía antes de ser alumna', () => {
    for (const c of [{ estado: 'Contactado' }, { reserva: { pagoConfirmado: false, titulo: 'Beca' } }, { reserva: { pagoConfirmado: true } }]) {
      const t = E.mensajeEtapa(c);
      if (/comunidad|membres/i.test(t)) throw new Error(t);
    }
  });
  caso('Membresía solo a homologadas', () => {
    if (/membres/i.test(E.mensajeEtapa({ cuenta: { alumna: true, homologada: false } }))) throw new Error('a una alumna sin homologar');
    if (!/Membresía/.test(E.mensajeEtapa({ cuenta: { alumna: true, homologada: true } }))) throw new Error('a una homologada');
  });
  caso('hablando: el precio de la beca con el punto de miles', () => {
    const t = E.mensajeEtapa({ estado: 'Contactado' });
    if (!t.includes('1.950 USD') || !t.includes('150 USD')) throw new Error(t);
  });
  caso('sin interés: sin mensaje', () => igual(E.mensajeEtapa({ estado: 'Descartado' }), ''));

  // Precios en los correos
  compilar('lib/plantillas-campana');
  const P = createRequire(import.meta.url)(join(carpeta, 'lib/plantillas-campana.js'));
  caso('llevaPrecio', () => {
    for (const t of ['Beca por 1.950 USD', 'reserva con 150$', '49 €', 'USD 750', 'solo 98 dólares', 'US$ 250']) igual(P.llevaPrecio(t), true, t);
    for (const t of ['Hola {nombre}', 'el 28 de enero', '10 plazas', 'a las 19:00', 'Medellín 2027']) igual(P.llevaPrecio(t), false, t);
  });
  caso('el grupo de Contactos es de captación', () => igual(P.AUDIENCIAS_CAPTACION.includes('grupo'), true));
} catch (e) {
  fallos.push(`no se ha podido cargar: ${e.message}`);
} finally {
  rmSync(carpeta, { recursive: true, force: true });
}

console.log(`El camino de venta: ${bien} casos bien, ${fallos.length} mal.`);
for (const f of fallos) console.log(`  ✗ ${f}`);
process.exitCode = fallos.length ? 1 : 0;
