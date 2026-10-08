import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * La foto de perfil de quien ha entrado.
 *
 *   POST   { imagen: 'data:image/webp;base64,…' }  → la guarda
 *   DELETE                                          → la quita
 *
 * El navegador ya la manda recortada en cuadrado y reducida a 256 px, así que
 * aquí solo se comprueba que es una imagen y que no es enorme. Se guarda en la
 * ficha de la persona y cada una solo puede tocar la suya: el uid sale de la
 * sesión, no del cuerpo de la petición.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Una imagen de 256 px en webp ronda los 20 KB; con este tope cabe de sobra. */
const MAX_CARACTERES = 300_000;
const FORMA = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

async function quien() {
  if (!hayFirebase()) return { error: NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 }) };
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  return { sesion };
}

export async function POST(peticion: Request) {
  const q = await quien();
  if (q.error) return q.error;

  let imagen = '';
  try {
    imagen = String((await peticion.json())?.imagen ?? '');
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  if (imagen.length > MAX_CARACTERES) {
    return NextResponse.json({ ok: false, motivo: 'grande' }, { status: 413 });
  }
  if (!FORMA.test(imagen)) {
    return NextResponse.json({ ok: false, motivo: 'formato' }, { status: 400 });
  }

  await baseDeDatos()
    .collection(COLECCIONES.usuarios)
    .doc(q.sesion.uid)
    .set({ foto: imagen, fotoCambiada: FieldValue.serverTimestamp() }, { merge: true });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const q = await quien();
  if (q.error) return q.error;
  await baseDeDatos()
    .collection(COLECCIONES.usuarios)
    .doc(q.sesion.uid)
    .set({ foto: FieldValue.delete(), fotoCambiada: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true });
}
