import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from '@/lib/firebase-servidor';
import { exigirSesion } from '@/lib/permisos';
import { esLeccionInicio, esMarca, leerEstadoInicio } from '@/lib/empieza-aqui';

/**
 * Lo que lleva hecho de «Empieza aquí» (lib/empieza-aqui.ts), en su ficha:
 * `usuarios/{uid}.empiezaAqui = { vistas: [...], marcas: [...] }`.
 *
 *   GET                         → { ok, vistas, marcas }
 *   POST { vista: 'ea-01' }     → «Marcar como vista»
 *   POST { marca: 'celular' }   → lo que no se sabe solo: la guardó en el
 *                                 celular, entró al grupo, añadió la clase al
 *                                 calendario. Se apunta al tocar su botón.
 *
 * No da puntos: así no hace falta comprobar nada más que el id. El uid sale
 * SIEMPRE de la sesión. Sorela no tiene inicio que estrenar (403).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVADO = { 'Cache-Control': 'private, no-store' };
const fallo = (motivo: string, status: number) => NextResponse.json({ ok: false, motivo }, { status });

async function puerta() {
  const g = await exigirSesion();
  if (g.error) return g;
  if (g.sesion.rol === 'sorela') return { error: fallo('creadora', 403) };
  return g;
}

export async function GET() {
  const g = await puerta();
  if (g.error) return g.error;
  try {
    const ficha = await baseDeDatos().collection(COLECCIONES.usuarios).doc(g.sesion.uid).get();
    return NextResponse.json({ ok: true, ...leerEstadoInicio(ficha.get('empiezaAqui')) }, { headers: PRIVADO });
  } catch (e) {
    console.error('[empieza-aqui] leer', e);
    return fallo('error', 500);
  }
}

export async function POST(peticion: Request) {
  const g = await puerta();
  if (g.error) return g.error;
  const c = (await peticion.json().catch(() => null)) as { vista?: unknown; marca?: unknown } | null;
  const vista = c?.vista;
  const marca = c?.marca;
  if (vista !== undefined && !esLeccionInicio(vista)) return fallo('datos', 400);
  if (marca !== undefined && !esMarca(marca)) return fallo('datos', 400);
  if (vista === undefined && marca === undefined) return fallo('datos', 400);

  const cambios: Record<string, unknown> = {};
  if (vista !== undefined) cambios.vistas = FieldValue.arrayUnion(vista);
  if (marca !== undefined) cambios.marcas = FieldValue.arrayUnion(marca);
  try {
    const ref = baseDeDatos().collection(COLECCIONES.usuarios).doc(g.sesion.uid);
    // Toda cuenta con sesión tiene ficha (lib/sesion-servidor): sin ella no se inventa una.
    if (!(await ref.get()).exists) return fallo('sin-ficha', 404);
    await ref.set({ empiezaAqui: cambios }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[empieza-aqui] guardar', e);
    return fallo('error', 500);
  }
}
