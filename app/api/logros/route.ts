import { NextResponse } from 'next/server';
import { hayFirebase } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual } from '@/lib/sesion-servidor';
import { resumenLogros } from '@/lib/logros';
import { tieneMembresia } from '@/lib/accesos';

/**
 * Los logros y los puntos de una persona.
 *   GET            → los propios
 *   GET ?celebrar=1→ los propios, y se marcan los nuevos (para la celebración):
 *                    `puntos.antes` y `puntos.subioNivel` dicen qué celebrar
 *   GET ?uid=      → los de otra, para su perfil (sin celebrar nada). Los
 *                    puntos de todas los ven todas.
 *
 * Respuesta: { ok, esMio, verComunidad, ...Resumen } (lib/logros-tipos.ts),
 * con `puntos`. `verComunidad`: si quien mira tiene la Comunidad Divine (o es
 * Sorela); sin ella, la pantalla no le enseña las vitrinas de la Comunidad.
 * De Sorela, solo { ok, esMio, creadora: true }: es la creadora y no compite,
 * así que no viajan puntos, nivel, trofeos ni racha (ni ceros que pintar).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const s = await sesionActual();
  if (!s) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  const pedido = (new URL(peticion.url).searchParams.get('uid') || '').slice(0, 128) || s.uid;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(pedido)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const esMio = pedido === s.uid;
  // Los accesos de quien MIRA, si mira los de otra (los propios ya los lee el resumen).
  const mios = !esMio && s.rol !== 'sorela' ? await accesosDe(s.uid) : null;
  if (mios && mios.length === 0) {
    return NextResponse.json({ ok: false, motivo: 'sin-acceso' }, { status: 403 });
  }
  // Solo la celebración marca los nuevos como vistos (?celebrar=1).
  const r = await resumenLogros(pedido, esMio && new URL(peticion.url).searchParams.get('celebrar') === '1', esMio);
  /* Si quien mira puede ver lo de la Comunidad (sus vitrinas, el podio):
     quien solo tiene el curso, no. Curso ≠ membresía. */
  const verComunidad = s.rol === 'sorela' || (esMio ? r.miembro : tieneMembresia(mios ?? []));
  const cuerpo = r.creadora ? { ok: true, esMio, creadora: true } : { ok: true, esMio, verComunidad, ...r };
  return NextResponse.json(cuerpo, { headers: { 'Cache-Control': 'private, no-store' } });
}
