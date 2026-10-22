import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { GRUPO_WHATSAPP } from './apertura';
import { baseDeDatos, COLECCIONES, hayFirebase } from './firebase-servidor';
import { diaDe, esRobot } from './metricas';

/**
 * Cuánta gente pulsa «Entrar al grupo de WhatsApp» y quién no lo ha hecho.
 *
 * Los botones (el aviso de la web al apuntarse y el correo de bienvenida) ya
 * no van directos a WhatsApp: pasan por /grupo, que apunta el clic y redirige
 * al grupo al momento. Sin cookies, como el resto de métricas.
 *
 * Si el enlace lleva a la persona (`c` + firma `f`), el clic queda en su ficha
 * (`grupoClic`): así se sabe quién se ha registrado y NO ha pulsado, y el cron
 * de la mañana le manda un recordatorio (ver `recordatoriosGrupo`).
 *
 * Lo que no se puede saber es si, ya dentro de WhatsApp, le dio a «Unirse».
 * Para eso Sorela apunta a mano cuánta gente hay en el grupo (`personasEnGrupo`)
 * y el panel compara: clics frente a personas dentro.
 */

export type OrigenClic = 'web' | 'correo' | 'recordatorio' | 'plataforma';
const ORIGENES: OrigenClic[] = ['web', 'correo', 'recordatorio', 'plataforma'];

const COLECCION_DIAS = 'grupo_clics_dias';
const AJUSTE = { coleccion: 'ajustes', doc: 'grupo-whatsapp' };

/** Igual que `idContacto` de atencion-servidor; aquí sin importarlo para no cerrar un ciclo con los correos. */
const idContacto = (correo: string) => correo.trim().toLowerCase().replace(/\//g, '_');

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';

function llave(): string | null {
  return process.env.BAJA_SECRETO || process.env.FIREBASE_CLAVE_PRIVADA || null;
}

const firmar = (id: string, k: string) => createHmac('sha256', k).update(`grupo:${id}`).digest('base64url').slice(0, 16);

/**
 * El enlace del botón. Con correo, firmado para esa persona: nadie puede
 * marcar como «ha pulsado» a otra cambiando la dirección.
 */
export function enlaceGrupo(origen: OrigenClic, correo?: string | null): string {
  const base = `${WEB}/grupo?o=${origen}`;
  const k = llave();
  if (!correo || !k) return base;
  const id = idContacto(correo);
  return `${base}&c=${Buffer.from(id).toString('base64url')}&f=${firmar(id, k)}`;
}

/** El id de contacto del enlace, solo si la firma cuadra. */
export function contactoDelEnlace(c: string | null, f: string | null): string | null {
  const k = llave();
  if (!c || !f || !k) return null;
  let id: string;
  try {
    id = Buffer.from(c, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!id.includes('@') || id.length > 200) return null;
  const a = Buffer.from(firmar(id, k));
  const b = Buffer.from(f);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export const origenDelEnlace = (o: string | null): OrigenClic => (ORIGENES.includes(o as OrigenClic) ? (o as OrigenClic) : 'web');

/**
 * Apunta un clic. Nunca lanza: el que pulsa tiene que llegar al grupo aunque
 * Firestore falle. Los robots (los que revisan enlaces de correo, las vistas
 * previas) no cuentan.
 */
export async function apuntarClic(origen: OrigenClic, contacto: string | null, navegador: string): Promise<void> {
  if (!hayFirebase() || esRobot(navegador)) return;
  const db = baseDeDatos();
  const dia = diaDe();
  try {
    await Promise.all([
      db
        .collection(COLECCION_DIAS)
        .doc(dia)
        .set({ dia, total: FieldValue.increment(1), [origen]: FieldValue.increment(1) }, { merge: true }),
      contacto
        ? db.runTransaction(async (t) => {
            const ref = db.collection(COLECCIONES.contactos).doc(contacto);
            const v = await t.get(ref);
            if (!v.exists) return;
            const previo = v.get('grupoClic');
            t.set(
              ref,
              {
                grupoClic: {
                  ...(previo?.primero ? {} : { primero: FieldValue.serverTimestamp(), origen }),
                  ultimo: FieldValue.serverTimestamp(),
                  veces: FieldValue.increment(1),
                },
              },
              { merge: true }
            );
          })
        : null,
    ]);
  } catch (e) {
    console.warn('[grupo] no se ha podido apuntar el clic:', e instanceof Error ? e.message : e);
  }
}

export const destinoGrupo = () => GRUPO_WHATSAPP;

/* ------------------------------------------------------------ el embudo */

export type EmbudoGrupo = {
  /** Apuntadas a la lista de espera de la masterclass. */
  registradas: number;
  /** Las apuntadas desde que se cuentan los clics (`grupoMedido`). */
  medidas: number;
  /** De ellas, cuántas han pulsado el botón (con su enlace personal). */
  pulsaron: number;
  /** Clics totales (con y sin nombre: también los de la web antes de saber quién era). */
  clics: number;
  clicsPorOrigen: Record<OrigenClic, number>;
  /** Las que llevan más de un día sin pulsar. */
  sinPulsar: number;
  /** Recordatorios ya enviados. */
  recordadas: number;
  /** Lo que Sorela apunta a mano: cuánta gente hay dentro del grupo. */
  enGrupo: number | null;
  enGrupoCuando: string | null;
};

export async function embudoGrupo(): Promise<EmbudoGrupo | null> {
  if (!hayFirebase()) return null;
  const db = baseDeDatos();
  const [lista, dias, ajuste] = await Promise.all([
    db.collection(COLECCIONES.contactos).where('lista', '==', true).select('grupoClic', 'grupoMedido', 'creado', 'recordatorioGrupo').get(),
    db.collection(COLECCION_DIAS).get(),
    db.collection(AJUSTE.coleccion).doc(AJUSTE.doc).get(),
  ]);
  const haceUnDia = Date.now() - 864e5;
  let medidas = 0;
  let pulsaron = 0;
  let sinPulsar = 0;
  let recordadas = 0;
  for (const d of lista.docs) {
    if (!d.get('grupoMedido')) continue;
    medidas++;
    if (d.get('grupoClic.primero')) pulsaron++;
    else if ((d.get('creado')?.toMillis?.() ?? 0) < haceUnDia) sinPulsar++;
    if (d.get('recordatorioGrupo')) recordadas++;
  }
  const clicsPorOrigen = Object.fromEntries(ORIGENES.map((o) => [o, 0])) as Record<OrigenClic, number>;
  let clics = 0;
  for (const d of dias.docs) {
    clics += Number(d.get('total') ?? 0);
    for (const o of ORIGENES) clicsPorOrigen[o] += Number(d.get(o) ?? 0);
  }
  const enGrupo = ajuste.exists ? Number(ajuste.get('personas')) : NaN;
  return {
    registradas: lista.size,
    medidas,
    pulsaron,
    clics,
    clicsPorOrigen,
    sinPulsar,
    recordadas,
    enGrupo: Number.isFinite(enGrupo) ? enGrupo : null,
    enGrupoCuando: ajuste.get('cuando')?.toDate?.().toISOString() ?? null,
  };
}

/** Sorela apunta cuánta gente hay en el grupo (lo mira en WhatsApp). */
export async function apuntarPersonasEnGrupo(personas: number): Promise<void> {
  await baseDeDatos()
    .collection(AJUSTE.coleccion)
    .doc(AJUSTE.doc)
    .set({ personas, cuando: FieldValue.serverTimestamp() }, { merge: true });
}

/* ------------------------------------------------------ el recordatorio */

/** Cuánto se espera antes de recordar, y hasta cuándo tiene sentido hacerlo. */
const ESPERA_MS = 864e5;
const HASTA_MS = 10 * 864e5;

/**
 * Quien se apuntó hace entre 1 y 10 días y no ha pulsado el botón recibe UN
 * recordatorio. Lo llama el cron de la mañana (`tareasDelDia`).
 */
export async function pendientesDeRecordatorio(ahora = Date.now()) {
  if (!hayFirebase()) return [];
  const r = await baseDeDatos()
    .collection(COLECCIONES.contactos)
    .where('lista', '==', true)
    .select('correo', 'nombre', 'creado', 'grupoClic', 'grupoMedido', 'recordatorioGrupo')
    .get();
  return r.docs
    .filter((d) => d.get('grupoMedido') === true)
    .filter((d) => {
      const creado = d.get('creado')?.toMillis?.() ?? 0;
      return creado && ahora - creado >= ESPERA_MS && ahora - creado <= HASTA_MS && !d.get('grupoClic.primero') && !d.get('recordatorioGrupo');
    })
    .map((d) => ({ id: d.id, correo: String(d.get('correo') ?? ''), nombre: (d.get('nombre') as string | null) ?? null }))
    .filter((p) => p.correo.includes('@'));
}

export async function marcarRecordada(id: string) {
  await baseDeDatos().collection(COLECCIONES.contactos).doc(id).set({ recordatorioGrupo: FieldValue.serverTimestamp() }, { merge: true });
}
