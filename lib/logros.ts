import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from './firebase-servidor';
import { revisarAccesos } from './accesos';
import { puedeVerla } from './aula';
import { diaDe } from './metricas';
import { LOGROS, type Resumen } from './logros-tipos';

/**
 * Calcula los logros de una persona con lo que ya está guardado: su progreso
 * en las clases, sus contadores de la comunidad y su racha de días.
 *
 * Los conseguidos se apuntan en `usuarios/{uid}/logros/{id}` la primera vez:
 * así se sabe cuáles son NUEVOS (para celebrarlos una sola vez) y cuándo se
 * ganó cada uno.
 */

const DIA = 86_400_000;

/** Apunta que ha entrado hoy y actualiza su racha. Una escritura al día como mucho. */
export async function registrarActividad(uid: string) {
  try {
    const ref = baseDeDatos().collection(COLECCIONES.usuarios).doc(uid);
    const hoy = diaDe();
    const a = ((await ref.get()).get('actividad') ?? {}) as { ultimoDia?: string; racha?: number; mejor?: number };
    if (a.ultimoDia === hoy) return;
    const ayer = diaDe(new Date(Date.now() - DIA));
    const racha = a.ultimoDia === ayer ? (a.racha ?? 0) + 1 : 1;
    await ref.set({ actividad: { ultimoDia: hoy, racha, mejor: Math.max(racha, a.mejor ?? 0) } }, { merge: true });
  } catch (e) {
    console.error('[logros] actividad', e);
  }
}

export async function resumenLogros(uid: string, celebrar: boolean): Promise<Resumen> {
  const db = baseDeDatos();
  const ref = db.collection(COLECCIONES.usuarios).doc(uid);
  const [usuario, progreso, lecciones, guardados, ranking] = await Promise.all([
    ref.get(),
    ref.collection('progreso').get(),
    db.collection(COLECCIONES.lecciones).get(),
    ref.collection('logros').get(),
    db.collection('comunidad_actividad').doc(new Date().toISOString().slice(0, 7)).get(),
  ]);
  const u = usuario.data() ?? {};
  const accesos = revisarAccesos(u.accesos);

  // Las clases que le tocan por lo que tiene contratado (como las ve en el aula).
  const suyas = lecciones.docs.filter((d) => d.get('publicada') !== false && d.get('para') && puedeVerla(d.get('para'), accesos)).map((d) => d.id);
  const hechasSet = new Set(progreso.docs.filter((d) => d.get('completada') === true).map((d) => d.id));
  const hechas = suyas.filter((id) => hechasSet.has(id)).length;
  const total = suyas.length;
  const porcentaje = total ? Math.round((hechas / total) * 100) : 0;

  const stats = (u.stats ?? {}) as { publicaciones?: number; respuestas?: number; meGustaRecibidos?: number };
  const act = (u.actividad ?? {}) as { racha?: number; mejor?: number; ultimoDia?: string };
  const rachaViva = act.ultimoDia === diaDe() || act.ultimoDia === diaDe(new Date(Date.now() - DIA)) ? act.racha ?? 0 : 0;
  const mejor = Math.max(act.mejor ?? 0, rachaViva);

  const puesto = (() => {
    const mapa = (ranking.data() ?? {}) as Record<string, { puntos?: number }>;
    const orden = Object.entries(mapa)
      .filter(([, v]) => (v?.puntos ?? 0) > 0)
      .sort((a, b) => (b[1].puntos ?? 0) - (a[1].puntos ?? 0))
      .map(([k]) => k);
    const i = orden.indexOf(uid);
    return i >= 0 && i < 3 ? 1 : 0;
  })();

  const valor: Record<string, number> = {
    'primera-clase': hechas,
    'mitad-curso': total ? porcentaje : 0,
    'curso-completo': total ? porcentaje : 0,
    'primera-publicacion': stats.publicaciones ?? 0,
    'primera-respuesta': stats.respuestas ?? 0,
    'cinco-respuestas': stats.respuestas ?? 0,
    'diez-me-gusta': Math.max(0, stats.meGustaRecibidos ?? 0),
    podio: puesto,
    'racha-3': mejor,
    'racha-7': mejor,
    'racha-30': mejor,
  };

  const ya = new Map(guardados.docs.map((d) => [d.id, d.get('cuando')?.toDate?.().toISOString() ?? null]));
  const nuevos: string[] = [];
  const logros = LOGROS.map((l) => {
    const progreso = Math.min(l.meta, valor[l.id] ?? 0);
    const conseguido = ya.has(l.id) || progreso >= l.meta;
    if (conseguido && !ya.has(l.id)) nuevos.push(l.id);
    return { ...l, progreso: conseguido ? l.meta : progreso, conseguido, cuando: ya.get(l.id) ?? (conseguido ? new Date().toISOString() : null) };
  });

  // Se apuntan solo al mirarlos la propia persona: así la celebración la ve ella.
  if (celebrar && nuevos.length) {
    const lote = db.batch();
    for (const id of nuevos) lote.set(ref.collection('logros').doc(id), { cuando: FieldValue.serverTimestamp() });
    await lote.commit().catch(() => null);
  }

  return {
    logros,
    nuevos: celebrar ? nuevos : [],
    curso: { hechas, total, porcentaje },
    racha: { actual: rachaViva, mejor },
    certificado: logros.some((l) => l.id === 'curso-completo' && l.conseguido),
  };
}
