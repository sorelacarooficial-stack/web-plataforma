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
    console.error('[sesion] No se pudo abrir la sesión:', e);

    /*
     * Dos cosas muy distintas caían antes en el mismo «token»:
     *
     *   - el token del navegador no vale (caducado, de otro proyecto), que es
     *     culpa de quien entra y se arregla volviendo a intentarlo;
     *   - la llave del servidor está mal puesta, que no es culpa suya y no se
     *     arregla nunca por mucho que insista.
     *
     * Decir «vuelve a intentarlo» en el segundo caso es mandar a alguien a dar
     * vueltas. Así que se separan. Del error real no sale nada hacia fuera:
     * solo se mira para elegir cuál de los dos es.
     */
    const texto = String((e as Error)?.message || e);
    const esDelServidor = /DECODER|PEM|private key|invalid_grant|Invalid JWT|signature|credential/i.test(
      texto
    );

    return esDelServidor
      ? NextResponse.json({ ok: false, motivo: 'servidor' }, { status: 500 })
      : NextResponse.json({ ok: false, motivo: 'token' }, { status: 401 });
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
