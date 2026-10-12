import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { revisarAccesos } from '@/lib/accesos';
import { leTocaLaClase } from '@/lib/logros';
import { sumarActividad } from '@/lib/actividad';
import { PUNTOS } from '@/lib/puntos-tipos';

/**
 * Lo que cada persona lleva visto de cada clase.
 *
 *   GET                                  → { progreso: { [idClase]: { visto, completada } } }
 *   POST { id, visto, completada? }      → lo apunta → { ok: true, nueva: boolean }
 *
 * Va en una subcolección de su ficha, `usuarios/{uid}/progreso/{idClase}`, y
 * solo se toca la de quien ha entrado: el uid sale de la sesión. El reproductor
 * lo manda cada pocos segundos mientras se ve, así que se guarda lo justo.
 *
 * Terminar una clase da puntos, así que el POST ya no se cree cualquier id:
 * la clase tiene que existir y tocarle (publicada y de lo que tiene
 * contratado; Sorela, todas). Y se marca terminada UNA sola vez: `nueva` es
 * true solo la vez que pasa de no terminada a terminada. El reproductor repite
 * «terminada» cada diez segundos pasado el 90 %; con esto, el aula solo
 * celebra (y el ranking solo suma) la primera.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,200}$/;

async function quien() {
  if (!hayFirebase()) return { error: NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 }) };
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  return { sesion };
}

const coleccion = (uid: string) =>
  baseDeDatos().collection(COLECCIONES.usuarios).doc(uid).collection('progreso');

export async function GET() {
  const q = await quien();
  if (q.error) return q.error;
  const lista = await coleccion(q.sesion.uid).get();
  const progreso: Record<string, { visto: number; completada: boolean; actualizado: string | null }> = {};
  for (const d of lista.docs) {
    const v = d.data();
    progreso[d.id] = {
      visto: typeof v.visto === 'number' ? v.visto : 0,
      completada: v.completada === true,
      actualizado: v.actualizado?.toDate?.().toISOString() ?? null,
    };
  }
  return NextResponse.json({ ok: true, progreso });
}

export async function POST(peticion: Request) {
  const q = await quien();
  if (q.error) return q.error;
  const { uid, rol } = q.sesion;

  let cuerpo: { id?: unknown; visto?: unknown; completada?: unknown };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const id = String(cuerpo.id ?? '');
  const visto = Math.max(0, Math.min(36000, Math.round(Number(cuerpo.visto) || 0)));
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const quiereTerminar = cuerpo.completada === true;

  const db = baseDeDatos();
  const ref = coleccion(uid).doc(id);
  const fichaRef = db.collection(COLECCIONES.usuarios).doc(uid);
  const leccionRef = db.collection(COLECCIONES.lecciones).doc(id);

  /* En transacción: dos guardados casi a la vez (el de los diez segundos y el
     del final del vídeo) no pueden dar los dos `nueva`. */
  const r = await db.runTransaction(async (t) => {
    const actual = await t.get(ref);
    const yaTerminada = actual.get('completada') === true;
    const nueva = quiereTerminar && !yaTerminada;
    let nombre = '';
    /* La clase se comprueba al empezar a apuntarla y al terminarla, que es
       cuando cuenta. Los guardados de posición de una ya apuntada no vuelven
       a leerla: son la mayoría y así cuestan una lectura, no tres. */
    if (!actual.exists || nueva) {
      const [leccion, ficha] = await t.getAll(leccionRef, fichaRef);
      if (!leccion.exists) return { fallo: 'no-existe' as const };
      if (rol !== 'sorela' && !leTocaLaClase(leccion.data() ?? {}, revisarAccesos(ficha.get('accesos')))) {
        return { fallo: 'sin-acceso' as const };
      }
      const f = ficha.data() ?? {};
      nombre = String(f.nombre || String(f.correo || '').split('@')[0] || 'Terapeuta');
    }
    t.set(
      ref,
      {
        visto,
        // Una clase completada no vuelve a quedar a medias por verla otra vez.
        ...(nueva ? { completada: true, terminada: FieldValue.serverTimestamp() } : {}),
        actualizado: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { nueva, nombre };
  });

  if ('fallo' in r) {
    return NextResponse.json({ ok: false, motivo: r.fallo }, { status: r.fallo === 'no-existe' ? 404 : 403 });
  }

  // Terminar una clase suma al ranking del mes. Si eso falla, la clase ya está apuntada: no se rompe nada.
  if (r.nueva && rol !== 'sorela') {
    await sumarActividad({ uid, nombre: r.nombre }, PUNTOS.clase).catch((e) => console.error('[progreso] ranking', e));
  }
  return NextResponse.json({ ok: true, nueva: r.nueva });
}
