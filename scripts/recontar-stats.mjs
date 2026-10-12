/**
 * Recuenta desde cero los contadores de la comunidad de cada persona
 * (`usuarios/{uid}.stats`), a partir de lo que hay VIVO en la comunidad.
 *
 *   node --env-file=.env.local scripts/recontar-stats.mjs              → solo enseña qué cambiaría
 *   node --env-file=.env.local scripts/recontar-stats.mjs --escribir   → lo escribe
 *
 * POR QUÉ HACE FALTA (una vez). Los puntos y los logros salen de estos
 * contadores, y desde los puntos nuevos tienen que ser EXACTOS: lo que se
 * borra, se resta. Pero lo que se apuntó con el código de antes no lo era:
 * responder en una publicación propia también contaba como «respuesta», y
 * borrar una publicación o una respuesta no restaba nada. Las cuentas que ya
 * existían arrastran ese exceso, y nada lo corrige solo.
 *
 * LAS REGLAS (las mismas que app/api/comunidad/route.ts):
 *   · publicaciones    = sus publicaciones vivas.
 *   · respuestas       = sus respuestas vivas EN PUBLICACIONES DE OTRA
 *                        (responder en lo propio no cuenta).
 *   · meGustaRecibidos = «me gusta» de OTRAS en su contenido vivo
 *                        (dárselo a una misma no cuenta).
 *
 * Se escribe el valor exacto (no un incremento) y solo en las cuentas que
 * existen: a una cuenta borrada no se le vuelve a crear la ficha. Mejor en un
 * rato tranquilo: lo que alguien publique MIENTRAS corre puede perderse del
 * recuento (se puede volver a pasar sin miedo: siempre deja el valor exacto).
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ESCRIBIR = process.argv.includes('--escribir');
const MAX_LOTE = 450;

const faltan = ['FIREBASE_PROYECTO_ID', 'FIREBASE_CLIENTE_CORREO', 'FIREBASE_CLAVE_PRIVADA'].filter((v) => !process.env[v]);
if (faltan.length) {
  console.error('Faltan variables: ' + faltan.join(', '));
  console.error('Ejecuta:  node --env-file=.env.local scripts/recontar-stats.mjs');
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

/** uid → { publicaciones, respuestas, meGustaRecibidos } */
const cuentas = new Map();
const de = (uid) => {
  if (!cuentas.has(uid)) cuentas.set(uid, { publicaciones: 0, respuestas: 0, meGustaRecibidos: 0 });
  return cuentas.get(uid);
};
/** Los «me gusta» de otras en un contenido: el valor es el mes (si puntuó) o `true`. */
const meGustaDeOtras = (v, autor) =>
  Object.entries(v.meGusta ?? {}).filter(([quien, valor]) => Boolean(valor) && quien !== autor).length;

const posts = await db.collection('comunidad_posts').get();
let nRespuestas = 0;
for (const p of posts.docs) {
  const v = p.data();
  const autora = String(v.autor ?? '');
  if (!autora) continue;
  de(autora).publicaciones += 1;
  de(autora).meGustaRecibidos += meGustaDeOtras(v, autora);
  const rs = await p.ref.collection('respuestas').get();
  for (const r of rs.docs) {
    nRespuestas++;
    const rv = r.data();
    const ra = String(rv.autor ?? '');
    if (!ra) continue;
    if (ra !== autora) de(ra).respuestas += 1;
    de(ra).meGustaRecibidos += meGustaDeOtras(rv, ra);
  }
}
console.log(`Comunidad: ${posts.size} publicaciones y ${nRespuestas} respuestas vivas.`);

const usuarios = await db.collection('usuarios').get();
const cambios = [];
for (const u of usuarios.docs) {
  const antes = u.get('stats') ?? {};
  const ahora = cuentas.get(u.id) ?? { publicaciones: 0, respuestas: 0, meGustaRecibidos: 0 };
  const distinto = ['publicaciones', 'respuestas', 'meGustaRecibidos'].some((k) => (Number(antes[k]) || 0) !== ahora[k]);
  if (!distinto) continue;
  cambios.push({ ref: u.ref, ahora });
  const fmt = (k) => `${k} ${Number(antes[k]) || 0}→${ahora[k]}`;
  console.log(`  ${u.get('nombre') || u.id}: ${['publicaciones', 'respuestas', 'meGustaRecibidos'].map(fmt).join(' · ')}`);
}

if (!cambios.length) {
  console.log('Todo cuadra: no hay nada que cambiar.');
  process.exit(0);
}
if (!ESCRIBIR) {
  console.log(`\n${cambios.length} cuentas cambiarían. Para escribirlo, vuelve a ejecutarlo con --escribir.`);
  process.exit(0);
}

for (let i = 0; i < cambios.length; i += MAX_LOTE) {
  const lote = db.batch();
  for (const { ref, ahora } of cambios.slice(i, i + MAX_LOTE)) {
    // `update` con el valor exacto: solo esos tres campos, y falla si la cuenta ya no existe.
    lote.update(ref, {
      'stats.publicaciones': ahora.publicaciones,
      'stats.respuestas': ahora.respuestas,
      'stats.meGustaRecibidos': ahora.meGustaRecibidos,
    });
  }
  await lote.commit();
}
console.log(`\nHecho: ${cambios.length} cuentas al día. Los puntos se recalculan solos la próxima vez que entren.`);
