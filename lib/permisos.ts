import 'server-only';
import { NextResponse } from 'next/server';
import { hayFirebase } from './firebase-servidor';
import { sesionActual, type Sesion } from './sesion-servidor';

/**
 * Las dos puertas de las rutas de la API, en un solo sitio.
 *
 * Cada ruta antigua lleva su copia de `exigirSesion`/`exigirAdmin`; las nuevas
 * usan estas. Devuelven la sesión o la respuesta de error ya hecha:
 *
 *   const g = await exigirSesion();
 *   if (g.error) return g.error;
 *   g.sesion.uid …
 */

export type Guarda = { sesion: Sesion; error?: undefined } | { sesion?: undefined; error: NextResponse };

const fallo = (motivo: string, status: number): Guarda => ({ error: NextResponse.json({ ok: false, motivo }, { status }) });

/** Cualquiera con sesión. */
export async function exigirSesion(): Promise<Guarda> {
  if (!hayFirebase()) return fallo('sin-configurar', 503);
  const s = await sesionActual();
  if (!s) return fallo('sin-sesion', 401);
  return { sesion: s };
}

/** Solo Sorela. */
export async function exigirAdmin(): Promise<Guarda> {
  const g = await exigirSesion();
  if (g.error) return g;
  if (g.sesion.rol !== 'sorela') return fallo('sin-permiso', 403);
  return g;
}
