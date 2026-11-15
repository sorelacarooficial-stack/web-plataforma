import 'server-only';
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from './firebase-servidor';

/**
 * Freno compartido contra formularios en ráfaga (spam).
 *
 * Los frenos de cada ruta viven en memoria, y en Vercel cada copia del
 * servidor lleva su propia cuenta y se borra a menudo: un robot que manda
 * despacio, o que cae en copias distintas, no se para nunca. Este cuenta en
 * Firestore, que es la misma para todas las copias: como mucho `max` envíos
 * por IP y por formulario en cada hora.
 *
 * La IP no se guarda: solo un resumen con sal secreta (no se puede deshacer).
 * Cada documento lleva `caduca`: en la consola de Firebase se puede poner una
 * regla TTL sobre ese campo en la colección `ritmo` para que se borren solos.
 *
 * Si Firestore falla, deja pasar: mejor un envío de más que perder a una
 * persona de verdad.
 */

const COLECCION = 'ritmo';
const HORA = 60 * 60 * 1000;

const SAL =
  process.env.METRICAS_SAL ||
  (process.env.FIREBASE_CLAVE_PRIVADA ? createHash('sha256').update(`ritmo|${process.env.FIREBASE_CLAVE_PRIVADA}`).digest('hex') : '');

/** true = ya ha mandado demasiados esta hora; hay que pararlo. */
export async function demasiadosEstaHora(formulario: string, ip: string, max = 20): Promise<boolean> {
  if (!ip || !SAL || !hayFirebase()) return false;
  const ventana = Math.floor(Date.now() / HORA);
  const huella = createHash('sha256').update(`${SAL}|${ip}`).digest('hex').slice(0, 24);
  const ref = baseDeDatos().collection(COLECCION).doc(`${formulario}-${huella}-${ventana}`);
  try {
    return await ref.firestore.runTransaction(async (t) => {
      const d = await t.get(ref);
      const n = (Number(d.get('n')) || 0) + 1;
      t.set(ref, { n, caduca: Timestamp.fromMillis((ventana + 2) * HORA) });
      return n > max;
    });
  } catch (e) {
    console.error('[ritmo]', formulario, e);
    return false;
  }
}
