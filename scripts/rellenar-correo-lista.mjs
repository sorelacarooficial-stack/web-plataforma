/**
 * Rellena en las fichas de `contactos` lo que lee la regla de «Te necesitan»
 * (lib/atencion.ts) y que las fichas de antes no tienen:
 *
 *   · `correoLista`: qué correo de la lista de espera se le mandó. Lo escriben
 *     ya solos la bienvenida, el registro y la campaña de la lista; esto pone
 *     el de quien se apuntó antes.
 *   · `pidio`: qué pidió y cuándo. Lo escriben ya /api/captar y /api/registro;
 *     esto pone su origen en su fecha de alta, más lo que haya en `envios`.
 *
 *   node --env-file=.env.local scripts/rellenar-correo-lista.mjs              → solo enseña lo que haría
 *   node --env-file=.env.local scripts/rellenar-correo-lista.mjs --escribir   → lo escribe
 *
 * Con --escribir toca PRODUCCIÓN: solo con el visto bueno de Sorela.
 *
 * PLAZO: antes del 12 de noviembre. El historial `correos` se borra a los 30
 * días, y con él la única prueba de que a alguien le llegó la bienvenida
 * ANTIGUA (sin el grupo de WhatsApp): la de Flor es del 13 de octubre, y su
 * marca `bienvenida:…:2026-10-13` también caduca. Las marcas de las campañas
 * no caducan, así que «le llegó el correo nuevo» se puede rehacer siempre.
 *
 * DE DÓNDE SALE `correoLista`, por este orden:
 *   1. La marca de la campaña con la plantilla de la lista
 *      (`campana:lista-espera-grupo-whatsapp:{hash}`) → `lista-espera`.
 *   2. Si no: una bienvenida o un registro enviados (línea del historial o
 *      marca). Con el asunto «Tu sitio en la Comunidad Divine», o posteriores
 *      al cambio de la bienvenida (13 oct, 19:53 UTC), → `lista-espera`;
 *      anteriores → `informacion` (la antigua, sin el grupo).
 *   Sin nada de eso no se escribe: la regla lo toma por «no consta» y no da
 *   ninguna falsa alarma.
 *
 * NUNCA pisa lo que ya hay: una ficha con `correoLista` se salta, y de `pidio`
 * solo se añaden los formularios que falten. Escribe con `update` dentro de
 * una transacción que vuelve a leer la ficha, así que lo que la web haya
 * escrito mientras tanto gana, y una ficha borrada no se vuelve a crear.
 * Las cuentas de prueba (`altaPor: 'prueba'` o su correo en CORREOS_PRUEBA)
 * se saltan.
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ESCRIBIR = process.argv.includes('--escribir');

/** Cuando la bienvenida pasó a ser el correo de la lista con el grupo (commit bda27ac). */
const CAMBIO_BIENVENIDA = new Date('2026-10-13T19:53:00Z');
/** El asunto del correo de la lista (lib/plantillas-bienvenida.ts, ASUNTO_LISTA). */
const ASUNTO_LISTA = 'Tu sitio en la Comunidad Divine';

/* La misma huella que lib/campanas.ts pone en la clave de cada envío. */
const huella = (correo) => createHash('sha256').update(correo.toLowerCase()).digest('hex').slice(0, 24);

/* El origen como nombre de campo, igual que /api/captar. */
const claveDeOrigen = (origen) =>
  String(origen ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

const aFecha = (x) => {
  if (!x) return null;
  const d = typeof x.toDate === 'function' ? x.toDate() : x instanceof Date ? x : new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
};

/* La misma regla que esPrueba (lib/atencion-servidor.ts). */
const correosPrueba = () =>
  new Set(
    (process.env.CORREOS_PRUEBA ?? '')
      .split(/[\s,;]+/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)
  );
const esPrueba = (correo, usuario, pruebas) => {
  const alta = typeof usuario?.altaPor === 'string' ? usuario.altaPor : '';
  return alta === 'prueba' || alta.startsWith('pruebas/') || (Boolean(correo) && pruebas.has(correo));
};

/**
 * Lo que haría, sin escribir nada. `db` es un Firestore de firebase-admin.
 * Devuelve una línea por ficha: lo que le pondría o por qué se la salta.
 */
export async function planear(db) {
  const pruebas = correosPrueba();
  const [contactos, usuarios, campanas, lineas, marcas] = await Promise.all([
    db.collection('contactos').get(),
    db.collection('usuarios').select('correo', 'altaPor').get(),
    db.collection('campanas').select('plantilla').get(),
    // Solo lo que hace falta del historial (no pasa de 30 días: son pocas).
    db.collection('correos').select('para', 'tipo', 'estado', 'asunto', 'cuando').get(),
    db.collection('correos_enviados').select('cuando').get(),
  ]);

  const usuarioDe = new Map(usuarios.docs.map((d) => [String(d.get('correo') ?? '').trim().toLowerCase(), { uid: d.id, altaPor: d.get('altaPor') }]));
  const deLaLista = campanas.docs.filter((d) => d.get('plantilla') === 'lista-espera').map((d) => d.id);
  const marca = new Map(marcas.docs.map((d) => [d.id, aFecha(d.get('cuando'))]));
  const lineasDe = new Map();
  for (const d of lineas.docs) {
    const para = String(d.get('para') ?? '').toLowerCase();
    if (!lineasDe.has(para)) lineasDe.set(para, []);
    lineasDe.get(para).push({ tipo: d.get('tipo'), estado: d.get('estado'), asunto: String(d.get('asunto') ?? ''), cuando: aFecha(d.get('cuando')) });
  }

  const plan = [];
  for (const doc of contactos.docs) {
    const v = doc.data();
    const correo = String(v.correo ?? '').trim().toLowerCase();
    const fila = { id: doc.id, nombre: String(v.nombre ?? '').trim() || '(sin nombre)', correoLista: null, pidio: {}, salto: null };
    if (esPrueba(correo, usuarioDe.get(correo), pruebas)) {
      plan.push({ ...fila, salto: 'cuenta de prueba' });
      continue;
    }

    /* ---- correoLista ---- */
    if (!v.correoLista && correo) {
      // 1. La campaña con la plantilla de la lista: su marca no caduca.
      const deCampana = deLaLista
        .map((id) => marca.get(`campana:${id}:${huella(correo)}`))
        .filter((c) => c !== undefined)
        .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0));
      if (deCampana.length) {
        fila.correoLista = { plantilla: 'lista-espera', estado: 'enviado', por: 'campana', cuando: deCampana[0], fuente: 'la campaña de la lista' };
      } else {
        // 2. Bienvenidas y registros enviados: líneas del historial y marcas.
        const uid = usuarioDe.get(correo)?.uid;
        const candidatos = [
          ...(lineasDe.get(correo) ?? [])
            .filter((l) => l.estado === 'enviado' && (l.tipo === 'bienvenida' || l.tipo === 'registro'))
            .map((l) => ({ por: l.tipo, cuando: l.cuando, asunto: l.asunto, fuente: 'el historial' })),
          ...[...marca]
            .filter(([clave]) => clave.startsWith(`bienvenida:${doc.id.slice(0, 80)}:`) || (uid && clave === `registro:${uid}`))
            .map(([clave, cuando]) => ({ por: clave.startsWith('registro:') ? 'registro' : 'bienvenida', cuando, asunto: '', fuente: 'la marca de envío' })),
        ].map((c) => ({
          ...c,
          lista: c.asunto.startsWith(ASUNTO_LISTA) || (c.cuando !== null && c.cuando.getTime() >= CAMBIO_BIENVENIDA.getTime()),
        }));
        const masNuevo = (xs) => xs.sort((a, b) => (b.cuando?.getTime() ?? 0) - (a.cuando?.getTime() ?? 0))[0];
        // Si alguna vez le llegó el de la lista, eso es lo que cuenta.
        const elegido = masNuevo(candidatos.filter((c) => c.lista)) ?? masNuevo(candidatos);
        if (elegido) {
          fila.correoLista = {
            plantilla: elegido.lista ? 'lista-espera' : 'informacion',
            estado: 'enviado',
            por: elegido.por,
            cuando: elegido.cuando,
            fuente: elegido.fuente,
          };
        }
      }
    }

    /* ---- pidio ---- */
    const ya = v.pidio && typeof v.pidio === 'object' ? v.pidio : {};
    const pidio = {};
    const apuntar = (origen, cuando) => {
      const k = claveDeOrigen(origen);
      if (!k || k in ya || !cuando) return;
      if (!pidio[k] || cuando.getTime() > pidio[k].getTime()) pidio[k] = cuando;
    };
    apuntar(v.origen, aFecha(v.creado));
    const envios = await doc.ref.collection('envios').select('origen', 'cuando').get();
    for (const e of envios.docs) apuntar(e.get('origen'), aFecha(e.get('cuando')));
    fila.pidio = pidio;

    if (!fila.correoLista && !Object.keys(pidio).length) fila.salto = v.correoLista ? 'ya lo tiene todo' : 'nada que rellenar';
    plan.push(fila);
  }
  return plan;
}

/**
 * Lo escribe. Cada ficha en su transacción: se vuelve a leer y solo se pone
 * lo que siga faltando. Devuelve cuántas fichas ha cambiado.
 */
export async function aplicar(db, plan, FieldPath) {
  let cambiadas = 0;
  for (const f of plan) {
    if (f.salto) continue;
    const ref = db.collection('contactos').doc(f.id);
    const hecho = await db.runTransaction(async (t) => {
      const d = await t.get(ref);
      if (!d.exists) return false;
      const pares = [];
      if (f.correoLista && !d.get('correoLista')) {
        const { fuente: _fuente, ...correoLista } = f.correoLista;
        pares.push(new FieldPath('correoLista'), correoLista);
      }
      const ya = d.get('pidio') ?? {};
      for (const [k, cuando] of Object.entries(f.pidio)) if (!(k in ya)) pares.push(new FieldPath('pidio', k), cuando);
      if (!pares.length) return false;
      t.update(ref, ...pares);
      return true;
    });
    if (hecho) cambiadas++;
  }
  return cambiadas;
}

const dia = (d) => (d ? new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' }).format(d) : 'sin fecha');

/** El plan con palabras, una línea por ficha. */
export function contar(plan) {
  const lineas = [];
  for (const f of plan) {
    if (f.salto) {
      lineas.push(`  · ${f.nombre}: se salta (${f.salto})`);
      continue;
    }
    const partes = [];
    if (f.correoLista) {
      const c = f.correoLista;
      partes.push(`correoLista → ${c.plantilla} (por ${c.por}, ${dia(c.cuando)}, según ${c.fuente})`);
    }
    const p = Object.entries(f.pidio);
    if (p.length) partes.push(`pidio + ${p.map(([k, t]) => `${k} (${dia(t)})`).join(', ')}`);
    lineas.push(`  · ${f.nombre}: ${partes.join(' · ')}`);
  }
  const conCorreo = plan.filter((f) => f.correoLista);
  const porPlantilla = (p) => conCorreo.filter((f) => f.correoLista.plantilla === p).length;
  lineas.push(
    '',
    `  correoLista en ${conCorreo.length} fichas: ${porPlantilla('lista-espera')} con el correo de la lista, ${porPlantilla('informacion')} con la bienvenida antigua.`,
    `  pidio en ${plan.filter((f) => !f.salto && Object.keys(f.pidio).length).length} fichas · ${plan.filter((f) => f.salto).length} se saltan.`
  );
  return lineas.join('\n');
}

/* ------------------------------------------------------------ a correr */

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (esPrincipal) {
  const faltan = ['FIREBASE_PROYECTO_ID', 'FIREBASE_CLIENTE_CORREO', 'FIREBASE_CLAVE_PRIVADA'].filter((v) => !process.env[v]);
  if (faltan.length) {
    console.error('Faltan variables: ' + faltan.join(', '));
    console.error('Ejecuta:  node --env-file=.env.local scripts/rellenar-correo-lista.mjs');
    process.exit(1);
  }
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { FieldPath, getFirestore } = await import('firebase-admin/firestore');
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
  const db = getFirestore(app);

  const plan = await planear(db);
  console.log(`${ESCRIBIR ? 'Esto es lo que se va a escribir' : 'Esto es lo que haría (no escribe nada)'}:\n`);
  console.log(contar(plan));
  if (!ESCRIBIR) {
    console.log('\nPara escribirlo, con el visto bueno de Sorela y antes del 12 de noviembre: añade --escribir.');
    process.exit(0);
  }
  const n = await aplicar(db, plan, FieldPath);
  console.log(`\nHecho: ${n} fichas cambiadas.`);
  process.exit(0);
}
