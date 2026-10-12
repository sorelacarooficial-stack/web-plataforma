import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { aplicacion, hayFirebase } from '@/lib/firebase-servidor';
import { MOTIVO_TEXTO, canjear } from '@/lib/invitaciones';

/**
 * Usar un enlace con una cuenta que YA existe.
 *
 *   POST { codigo, token }   token = el de Firebase tras entrar con su contraseña
 *
 * Es el caso de quien ya era de la comunidad y ahora compra la formación, o al
 * revés: no se le crea otra cuenta, se le suma lo que trae el enlace. Que la
 * cuenta es suya lo demuestra el token, que solo se consigue con su contraseña.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  let cuerpo: { codigo?: unknown; token?: unknown };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  let datos;
  try {
    datos = await getAuth(aplicacion()).verifyIdToken(String(cuerpo.token ?? ''));
  } catch {
    return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  }
  const correo = (datos.email ?? '').toLowerCase();
  const r = await canjear(String(cuerpo.codigo ?? ''), {
    uid: datos.uid,
    correo,
    nombre: (datos.name as string | undefined) ?? null,
  });
  if (!r.ok) {
    return NextResponse.json({ ok: false, motivo: r.motivo, texto: MOTIVO_TEXTO[r.motivo] }, { status: 409 });
  }
  return NextResponse.json({ ok: true, que: r.que });
}
