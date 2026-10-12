import 'server-only';
import { FieldValue, type DocumentData, type DocumentReference } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from './firebase-servidor';

/**
 * Los dos marcadores de la comunidad, en un solo sitio:
 *
 *   · `usuarios/{uid}.stats` — cuántas publicaciones vivas tiene, cuántas
 *     respuestas vivas a OTRAS y cuántos «me gusta» de OTRAS. Son la base de
 *     sus logros y de sus puntos, así que tienen que ser EXACTOS: lo que se
 *     borra se resta.
 *   · `comunidad_actividad/{YYYY-MM}` — el ranking del mes. Un documento por
 *     mes con `{ [uid]: { nombre, puntos } }`. Sorela no puntúa: el ranking es
 *     de las terapeutas.
 *
 * Lo usan la comunidad (publicar, responder, «me gusta», borrar) y el aula
 * (terminar una clase).
 */

export const COLECCION_ACTIVIDAD = 'comunidad_actividad';

/**
 * El mes del ranking, `2026-10`. En UTC, como desde el primer día: las
 * entradas que ya existen están apuntadas así, y al borrar algo antiguo hay
 * que restar en el MISMO documento en que se sumó.
 */
export const mesDe = (fecha: Date = new Date()) => fecha.toISOString().slice(0, 7);
export const esMes = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

export type CampoStats = 'publicaciones' | 'respuestas' | 'meGustaRecibidos';
export type QuienPuntua = { uid: string; nombre?: string; esSorela?: boolean };

/**
 * Lo que suma o resta una acción a los contadores y al ranking, junto, para
 * escribirlo de una vez dentro del mismo lote o transacción que el contenido.
 *
 * Por qué junto: antes se guardaba la publicación y DESPUÉS los puntos, en
 * escrituras sueltas. Si fallaba la segunda, la pantalla daba error con la
 * publicación ya guardada, se reintentaba y salían dos con el doble de puntos.
 * Ahora o se guarda todo o nada.
 *
 * Se agrupa por persona y por mes: borrar una publicación con cien respuestas
 * de cinco compañeras son cinco escrituras de contadores, no cien.
 */
export class Cuentas {
  private stats = new Map<string, Partial<Record<CampoStats, number>>>();
  private meses = new Map<string, Map<string, { puntos: number; nombre?: string }>>();

  contar(uid: string, campo: CampoStats, n = 1) {
    if (!uid || !n) return this;
    const s = this.stats.get(uid) ?? {};
    s[campo] = (s[campo] ?? 0) + n;
    this.stats.set(uid, s);
    return this;
  }

  /** Suma (o resta, con negativo) puntos del ranking en un mes concreto. */
  puntuar(quien: QuienPuntua, puntos: number, mes: string = mesDe()) {
    if (!quien.uid || !puntos || quien.esSorela || !esMes(mes)) return this;
    const m = this.meses.get(mes) ?? new Map<string, { puntos: number; nombre?: string }>();
    const x = m.get(quien.uid) ?? { puntos: 0 };
    x.puntos += puntos;
    // El nombre solo se refresca al sumar: al restar puede venir sin él.
    if (quien.nombre && puntos > 0) x.nombre = quien.nombre;
    m.set(quien.uid, x);
    this.meses.set(mes, m);
    return this;
  }

  /** Cuántas escrituras ocupará: una por persona con contadores y una por mes. */
  get escrituras() {
    return this.stats.size + this.meses.size;
  }

  /**
   * Lo pasa a un lote o a una transacción. `poner` hace un set con merge.
   *
   * `vivas`: si se da, solo se tocan esas personas. A una cuenta ya borrada no
   * se le restan contadores: el set con merge le volvería a crear la ficha,
   * vacía y sin dueña, y aparecería en la lista de cuentas de Sorela.
   */
  volcar(poner: (ref: DocumentReference, datos: DocumentData) => void, vivas?: Set<string>) {
    const db = baseDeDatos();
    for (const [uid, s] of this.stats) {
      if (vivas && !vivas.has(uid)) continue;
      const datos: Record<string, FieldValue> = {};
      for (const [campo, n] of Object.entries(s)) if (n) datos[campo] = FieldValue.increment(n);
      if (Object.keys(datos).length) poner(db.collection(COLECCIONES.usuarios).doc(uid), { stats: datos });
    }
    for (const [mes, m] of this.meses) {
      const datos: Record<string, unknown> = {};
      for (const [uid, x] of m) {
        if (!x.puntos || (vivas && !vivas.has(uid))) continue;
        datos[uid] = { ...(x.nombre ? { nombre: x.nombre } : {}), puntos: FieldValue.increment(x.puntos) };
      }
      if (Object.keys(datos).length) poner(db.collection(COLECCION_ACTIVIDAD).doc(mes), datos);
    }
  }

  /** Lo escribe ya, en un lote propio. */
  async guardar() {
    if (!this.escrituras) return;
    const lote = baseDeDatos().batch();
    let n = 0;
    this.volcar((ref, datos) => {
      lote.set(ref, datos, { merge: true });
      n++;
    });
    if (n) await lote.commit();
  }
}

/**
 * Suma (o resta) a un contador de una persona. Con `update` y no con un set:
 * si la cuenta ya no existe, falla en silencio en vez de resucitar su ficha.
 */
export async function contar(uid: string, campo: CampoStats, n = 1) {
  if (!uid || !n) return;
  await baseDeDatos()
    .collection(COLECCIONES.usuarios)
    .doc(uid)
    .update({ [`stats.${campo}`]: FieldValue.increment(n) })
    .catch(() => null);
}

/**
 * Suma (o resta, con negativo) puntos al ranking de un mes. Por defecto, el
 * de ahora; al borrar algo, el mes en que se creó, que es donde se sumó.
 */
export async function sumarActividad(autora: QuienPuntua, puntos: number, mes: string = mesDe()) {
  await new Cuentas().puntuar(autora, puntos, mes).guardar();
}
