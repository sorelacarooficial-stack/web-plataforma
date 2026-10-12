import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { hayFirebase } from '@/lib/firebase-servidor';
import { darDeBaja, firmaBaja } from '@/lib/correos';

/** Confirma una baja. La firma impide dar de baja a otra persona cambiando el correo del enlace. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false }, { status: 503 });
  const cuerpo = (await peticion.json().catch(() => ({}))) as { c?: unknown; f?: unknown };
  const correo = Buffer.from(String(cuerpo.c ?? '').slice(0, 400), 'base64url').toString('utf8').toLowerCase();
  const f = Buffer.from(String(cuerpo.f ?? ''));
  const bien = Buffer.from(firmaBaja(correo));
  if (!correo.includes('@') || f.length !== bien.length || !timingSafeEqual(f, bien)) {
    return NextResponse.json({ ok: false, motivo: 'enlace' }, { status: 400 });
  }
  await darDeBaja(correo);
  return NextResponse.json({ ok: true });
}
