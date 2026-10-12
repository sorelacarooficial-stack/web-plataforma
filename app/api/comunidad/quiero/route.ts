import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * «Quiero ser parte del cambio Divine»: apuntarse a la Comunidad desde la
 * plataforma, antes de que abra.
 *
 *   GET   → { quiere }    si ya se ha apuntado
 *   POST  → la apunta
 *
 * Se guarda en su ficha (para que el botón recuerde que ya lo pulsó) y en los
 * contactos del CRM, que es donde Sorela trabaja a quién escribir. A Sorela le
 * llega además un aviso flotante (ver app/api/novedades).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!hayFirebase()) return NextResponse.json({ ok: false }, { status: 503 });
  const s = await sesionActual();
  if (!s) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  const d = await baseDeDatos().collection(COLECCIONES.usuarios).doc(s.uid).get();
  return NextResponse.json({ ok: true, quiere: Boolean(d.data()?.quiereComunidad) });
}

export async function POST() {
  if (!hayFirebase()) return NextResponse.json({ ok: false }, { status: 503 });
  const s = await sesionActual();
  if (!s) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  const db = baseDeDatos();
  await db.collection(COLECCIONES.usuarios).doc(s.uid).set({ quiereComunidad: FieldValue.serverTimestamp() }, { merge: true });

  if (s.correo) {
    const correo = s.correo.toLowerCase();
    const ref = db.collection(COLECCIONES.contactos).doc(correo.replace(/\//g, '_'));
    const previo = await ref.get();
    await ref.set(
      {
        correo,
        nombre: s.nombre ?? previo.data()?.nombre ?? '',
        quiereComunidad: true,
        actualizado: FieldValue.serverTimestamp(),
        // Si ya estaba en el CRM no se le cambia el estado ni el origen: se
        // sabe de dónde vino y por dónde va la conversación.
        ...(previo.exists
          ? {}
          : { origen: 'comunidad-plataforma', estado: 'Nuevo', veces: 1, creado: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );
  }
  return NextResponse.json({ ok: true, quiere: true });
}
