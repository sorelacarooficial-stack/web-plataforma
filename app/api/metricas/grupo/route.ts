import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/permisos';
import { apuntarPersonasEnGrupo } from '@/lib/grupo-whatsapp';
import { hayFirebase } from '@/lib/firebase-servidor';

/**
 * Sorela apunta cuánta gente hay en el grupo de WhatsApp (lo mira en el propio
 * grupo: WhatsApp no deja leerlo desde fuera). Con eso el panel compara los
 * clics del botón con las que de verdad han entrado.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-firebase' }, { status: 503 });
  const cuerpo = await peticion.json().catch(() => ({}));
  const personas = Number(cuerpo?.personas);
  if (!Number.isInteger(personas) || personas < 0 || personas > 1024) {
    return NextResponse.json({ ok: false, motivo: 'numero' }, { status: 400 });
  }
  await apuntarPersonasEnGrupo(personas);
  return NextResponse.json({ ok: true });
}
