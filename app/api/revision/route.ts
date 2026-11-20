import { NextResponse } from 'next/server';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { COLECCION_REVISION, ID_PIEZAS } from '@/lib/revision';

/**
 * Comentarios de la página de revisión (/revision).
 *
 *   GET                                  → { ok, comentarios }
 *   POST { pieza, tipo, texto, autor }   → { ok, comentario }
 *   PATCH { id, hecho }                  → { ok }   (marcar un cambio como hecho)
 *
 * Sin cuenta a propósito: Sorela entra desde el móvil con el enlace y escribe.
 * La página no se indexa y aquí solo se guardan opiniones sobre las piezas,
 * nada privado. El freno por IP evita que un script llene la colección.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Comentario = {
  id: string;
  pieza: string;
  tipo: 'ok' | 'cambio';
  texto: string;
  autor: string;
  fecha: string;
  hecho: boolean;
};

const HUELLAS = new Map<string, number[]>();
function vaDemasiadoRapido(ip: string) {
  const ahora = Date.now();
  const previas = (HUELLAS.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  previas.push(ahora);
  HUELLAS.set(ip, previas);
  if (HUELLAS.size > 500) for (const [k, m] of HUELLAS) if (m.every((t) => ahora - t >= 60_000)) HUELLAS.delete(k);
  return previas.length > 15;
}

const ipDe = (p: Request) => p.headers.get('x-forwarded-for')?.split(',')[0].trim() || p.headers.get('x-real-ip') || 'desconocida';

export async function GET() {
  if (!hayFirebase()) return NextResponse.json({ ok: true, comentarios: [] });
  const snap = await baseDeDatos().collection(COLECCION_REVISION).orderBy('fecha', 'asc').limit(1000).get();
  const comentarios: Comentario[] = snap.docs.map((d) => {
    const c = d.data();
    return {
      id: d.id,
      pieza: String(c.pieza),
      tipo: c.tipo === 'ok' ? 'ok' : 'cambio',
      texto: String(c.texto ?? ''),
      autor: String(c.autor ?? ''),
      fecha: String(c.fecha),
      hecho: c.hecho === true,
    };
  });
  return NextResponse.json({ ok: true, comentarios }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  if (vaDemasiadoRapido(ipDe(peticion))) return NextResponse.json({ ok: false, motivo: 'ritmo' }, { status: 429 });
  let c: Record<string, unknown>;
  try {
    c = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const pieza = String(c.pieza ?? '');
  const tipo: Comentario['tipo'] = c.tipo === 'ok' ? 'ok' : 'cambio';
  const texto = String(c.texto ?? '').trim().slice(0, 2000);
  const autor = String(c.autor ?? '').trim().slice(0, 40) || 'Sorela';
  if (!ID_PIEZAS.has(pieza) || (tipo === 'cambio' && texto.length < 2)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const datos = { pieza, tipo, texto, autor, fecha: new Date().toISOString(), hecho: false };
  const ref = await baseDeDatos().collection(COLECCION_REVISION).add(datos);
  return NextResponse.json({ ok: true, comentario: { id: ref.id, ...datos } satisfies Comentario });
}

export async function PATCH(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  if (vaDemasiadoRapido(ipDe(peticion))) return NextResponse.json({ ok: false, motivo: 'ritmo' }, { status: 429 });
  let c: Record<string, unknown>;
  try {
    c = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const id = String(c.id ?? '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const ref = baseDeDatos().collection(COLECCION_REVISION).doc(id);
  if (!(await ref.get()).exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  await ref.update({ hecho: c.hecho === true });
  return NextResponse.json({ ok: true });
}
