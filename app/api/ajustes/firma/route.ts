import { NextResponse } from 'next/server';
import { hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { borrarFirmaSorela, guardarFirmaSorela, leerFirmaSorela, limpiarFirma } from '@/lib/firma-sorela';

/**
 * La firma de Sorela para los acuerdos. Solo Sorela, en las tres.
 *
 *   GET    → la firma guardada, para enseñarla en la plataforma.
 *   POST   → sube una foto; se limpia y se guarda. Devuelve cómo ha quedado.
 *   DELETE → la quita.
 *
 * Ver `lib/firma-sorela.ts`: por qué vive en Firestore y no en el código.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Una foto de móvil en base64 ronda los 3-5 MB. Más que eso no es una firma. */
const MAX = 8_000_000;

async function soloSorela() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });
  return null;
}

const comoDataUrl = (png: Buffer | null) => (png ? `data:image/png;base64,${png.toString('base64')}` : null);

export async function GET() {
  const no = await soloSorela();
  if (no) return no;
  return NextResponse.json({ ok: true, firma: comoDataUrl(await leerFirmaSorela()) });
}

export async function POST(peticion: Request) {
  const no = await soloSorela();
  if (no) return no;

  let imagen = '';
  try {
    imagen = String((await peticion.json()).imagen ?? '');
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const m = imagen.match(/^data:image\/[a-z+.-]+;base64,(.+)$/i);
  if (!m || imagen.length > MAX) {
    return NextResponse.json({ ok: false, motivo: 'imagen' }, { status: 400 });
  }

  try {
    const limpia = await limpiarFirma(Buffer.from(m[1], 'base64'));
    await guardarFirmaSorela(limpia);
    return NextResponse.json({ ok: true, firma: comoDataUrl(limpia) });
  } catch (error) {
    console.error('[firma] no se ha podido procesar la imagen', error);
    return NextResponse.json({ ok: false, motivo: 'no-se-lee' }, { status: 422 });
  }
}

export async function DELETE() {
  const no = await soloSorela();
  if (no) return no;
  await borrarFirmaSorela();
  return NextResponse.json({ ok: true });
}
