import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * Lo que cada persona lleva visto de cada clase.
 *
 *   GET                                  → { progreso: { [idClase]: { visto, completada } } }
 *   POST { id, visto, completada? }      → lo apunta
 *
 * Va en una subcolección de su ficha, `usuarios/{uid}/progreso/{idClase}`, y
 * solo se toca la de quien ha entrado: el uid sale de la sesión. El reproductor
 * lo manda cada pocos segundos mientras se ve, así que se guarda lo justo.
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

  let cuerpo: { id?: unknown; visto?: unknown; completada?: unknown };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const id = String(cuerpo.id ?? '');
  const visto = Math.max(0, Math.min(36000, Math.round(Number(cuerpo.visto) || 0)));
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  await coleccion(q.sesion.uid)
    .doc(id)
    .set(
      {
        visto,
        // Una clase completada no vuelve a quedar a medias por verla otra vez.
        ...(cuerpo.completada === true ? { completada: true } : {}),
        actualizado: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  return NextResponse.json({ ok: true });
}
