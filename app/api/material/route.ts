import { NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, hayFirebase } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual } from '@/lib/sesion-servidor';
import { puedeVerla } from '@/lib/aula';
import { DOCUMENTOS, rutaDePagina, type Documento } from '@/lib/material';

/**
 * El material del curso.
 *
 *   GET                 → { documentos: [...] }   los que puede ver, con su portada
 *   GET ?id=<documento> → { paginas: [url…] }     una dirección firmada por página
 *
 * Las páginas no tienen dirección pública. Cada dirección que se da caduca a
 * los 15 minutos; el lector pide otras si se le pasan. Sorela lo ve todo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIGENCIA_MS = 15 * 60 * 1000;
const SIN_CACHE = { 'Cache-Control': 'no-store' };

function almacen() {
  return getStorage(aplicacion()).bucket(
    process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`
  );
}

async function firmar(ruta: string, caduca: number) {
  const [url] = await almacen().file(ruta).getSignedUrl({ version: 'v4', action: 'read', expires: caduca });
  return url;
}

export async function GET(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });

  const accesos = sesion.rol === 'sorela' ? null : await accesosDe(sesion.uid);
  const puede = (d: Documento) => accesos === null || d.para.some((p) => puedeVerla(p, accesos));
  const caduca = Date.now() + VIGENCIA_MS;
  const id = new URL(peticion.url).searchParams.get('id');

  try {
    if (id) {
      const doc = DOCUMENTOS.find((d) => d.id === id);
      if (!doc) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
      if (!puede(doc)) return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
      const paginas = await Promise.all(
        Array.from({ length: doc.paginas }, (_, i) => firmar(rutaDePagina(doc.id, i + 1), caduca))
      );
      return NextResponse.json({ ok: true, paginas, caduca }, { headers: SIN_CACHE });
    }

    const documentos = await Promise.all(
      DOCUMENTOS.filter(puede).map(async ({ para: _para, ...d }) => ({
        ...d,
        portadaUrl: await firmar(rutaDePagina(d.id, d.portada), caduca),
      }))
    );
    return NextResponse.json({ ok: true, documentos }, { headers: SIN_CACHE });
  } catch (error) {
    console.error('[material] no se han podido firmar las páginas', error);
    return NextResponse.json({ ok: false, motivo: 'sin-almacen' }, { status: 503 });
  }
}
