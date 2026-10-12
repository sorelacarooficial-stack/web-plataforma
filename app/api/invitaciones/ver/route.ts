import { NextResponse } from 'next/server';
import { hayFirebase } from '@/lib/firebase-servidor';
import { ETIQUETA_QUE_DA, MOTIVO_TEXTO, comprobar } from '@/lib/invitaciones';

/**
 * Lo que trae un enlace, para enseñarlo en la pantalla de registro.
 *
 *   GET ?codigo=…  → { ok, que, etiquetas, nombre, correo }  o  { ok:false, motivo, texto }
 *
 * Es pública: quien la llama es alguien que todavía no tiene cuenta. No gasta
 * el enlace ni dice nada que no sepa ya quien lo tiene en la mano.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const codigo = new URL(peticion.url).searchParams.get('codigo') ?? '';
  const r = await comprobar(codigo);
  if (!r.ok) return NextResponse.json({ ok: false, motivo: r.motivo, texto: MOTIVO_TEXTO[r.motivo] }, { status: 200 });
  const { que, nombre, correo } = r.invitacion;
  return NextResponse.json(
    { ok: true, que, etiquetas: que.map((q) => ETIQUETA_QUE_DA[q]), nombre, correo },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
