import 'server-only';
import { FieldPath } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from './firebase-servidor';
import { COLECCION_DIAS, COLECCION_MESES, diaDe } from './metricas';

/**
 * Borra los resúmenes de «personas distintas» de los días y meses ya cerrados.
 *
 * Hoy el conteo es por MES (metricas_meses/{mes}/personas): se borran cuando
 * el mes ha cerrado y han pasado DIAS_PERSONAS. Los de día son los de antes
 * del cambio y se siguen limpiando.
 *
 * Para contar cuántas personas distintas entran cada día, `/api/m` guarda en
 * `metricas_dias/{día}/personas` un documento por cada resumen irreversible de
 * IP + navegador + día. Ese resumen solo sirve MIENTRAS el día está abierto
 * (para no contar dos veces a la misma): en cuanto el día acaba, la cifra ya
 * está sumada en el propio documento del día y los resúmenes sobran. Antes se
 * quedaban para siempre, y la política de privacidad tiene que poder decir un
 * plazo cierto. Ese plazo es este: se borran a partir del segundo día.
 *
 * Solo toca esa subcolección: los contadores del día (vistas, países,
 * páginas…) no identifican a nadie y se quedan para las Métricas de Sorela.
 */

export const DIAS_PERSONAS = 2;

export async function purgarPersonasMetricas(): Promise<{ dias: number; borrados: number }> {
  if (!hayFirebase()) return { dias: 0, borrados: 0 };
  const db = baseDeDatos();
  const corte = diaDe(new Date(Date.now() - DIAS_PERSONAS * 86_400_000));
  /* Los días son `AAAA-MM-DD`, que se ordenan igual como texto que como
     fecha: todo lo que queda por debajo del corte ya está cerrado. */
  const dias = await db
    .collection(COLECCION_DIAS)
    .where(FieldPath.documentId(), '<', corte)
    .select()
    .get();
  let borrados = 0;
  for (const dia of dias.docs) {
    // Por tandas de 400: un lote de Firestore no admite más de 500 escrituras.
    for (;;) {
      const tanda = await dia.ref.collection('personas').limit(400).select().get();
      if (tanda.empty) break;
      const lote = db.batch();
      tanda.docs.forEach((d) => lote.delete(d.ref));
      await lote.commit();
      borrados += tanda.size;
      if (tanda.size < 400) break;
    }
  }
  /* Los resúmenes del mes (los que evitan contar dos veces a quien vuelve):
     se borran en cuanto el mes ha cerrado y han pasado los DIAS_PERSONAS. */
  const mesCerrado = corte.slice(0, 7);
  const meses = await db.collection(COLECCION_MESES).where(FieldPath.documentId(), '<', mesCerrado).select().get();
  for (const mes of meses.docs) {
    for (;;) {
      const tanda = await mes.ref.collection('personas').limit(400).select().get();
      if (tanda.empty) break;
      const lote = db.batch();
      tanda.docs.forEach((d) => lote.delete(d.ref));
      await lote.commit();
      borrados += tanda.size;
      if (tanda.size < 400) break;
    }
    await mes.ref.delete().catch(() => {});
  }
  return { dias: dias.size, borrados };
}
