import { NextResponse } from 'next/server';
import { hayFirebase } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual } from '@/lib/sesion-servidor';
import { resumenLogros } from '@/lib/logros';

/**
 * Los logros y los puntos de una persona.
 *   GET            → los propios
 *   GET ?celebrar=1→ los propios, y se marcan los nuevos (para la celebración):
 *                    `puntos.antes` y `puntos.subioNivel` dicen qué celebrar
 *   GET ?uid=      → los de otra, para su perfil (sin celebrar nada). Los
 *                    puntos de todas los ven todas.
 *
 * Respuesta: { ok, esMio, ...Resumen } (lib/logros-tipos.ts), con `puntos`.
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
  if (!esMio && s.rol !== 'sorela' && (await accesosDe(s.uid)).length === 0) {
    return NextResponse.json({ ok: false, motivo: 'sin-acceso' }, { status: 403 });
  }
  // Solo la celebración marca los nuevos como vistos (?celebrar=1).
  const r = await resumenLogros(pedido, esMio && new URL(peticion.url).searchParams.get('celebrar') === '1', esMio);
  const cuerpo = r.creadora ? { ok: true, esMio, creadora: true } : { ok: true, esMio, ...r };
  return NextResponse.json(cuerpo, { headers: { 'Cache-Control': 'private, no-store' } });
}
