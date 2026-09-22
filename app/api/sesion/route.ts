import { NextResponse } from 'next/server';
import { hayFirebase } from '@/lib/firebase-servidor';
import { cerrarSesion, crearSesion, sesionActual } from '@/lib/sesion-servidor';

/**
 * Abrir, consultar y cerrar la sesión.
 *
 *   POST   → el navegador manda su token de Firebase y recibe una cookie
 *   GET    → quién está dentro ahora mismo
 *   DELETE → salir
 *
 * El token del navegador nunca se guarda: se cambia una sola vez por la cookie
 * y se olvida.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion: Request) {
  if (!hayFirebase()) {
    console.error('[sesion] Faltan las variables de Firebase en el entorno.');
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }

  let tokenId: string | undefined;
  try {
    tokenId = (await peticion.json())?.token;
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  if (!tokenId || typeof tokenId !== 'string') {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  try {
    const sesion = await crearSesion(tokenId);
    return NextResponse.json({ ok: true, sesion });
  } catch (e) {
    // Token caducado, de otro proyecto o manipulado. No se distingue en la
    // respuesta: dar detalles solo ayuda a quien está probando.
    console.error('[sesion] Token rechazado:', e);
    return NextResponse.json({ ok: false, motivo: 'token' }, { status: 401 });
  }
}

export async function GET() {
  const sesion = await sesionActual();
  return NextResponse.json({ ok: true, sesion });
}

export async function DELETE() {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
