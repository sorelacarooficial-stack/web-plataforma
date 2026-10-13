import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { puedeVerla, tieneElCurso } from '@/lib/aula';
import { revisarAccesos, type Acceso } from '@/lib/accesos';
import { DOCUMENTOS, leerLectura, rutaDePagina, type Documento, type Lectura } from '@/lib/material';

/**
 * El material del curso.
 *
 *   GET                 → { documentos: [...], lectura }   los que puede ver, con su
 *                         portada, y lo que lleva leído de cada uno
 *   GET ?id=<documento> → { paginas: [url…] }     una dirección firmada por página
 *   POST { id, pagina } → apunta hasta dónde ha leído (el lector del aula, al
 *                         abrir, al llegar a la última página y al cerrar)
 *
 * Las páginas no tienen dirección pública. Cada dirección que se da caduca a
 * los 15 minutos; el lector pide otras si se le pasan. Sorela lo ve todo.
 *
 * Con el curso basta, aunque solo haya dejado el abono: el material se lee
 * entero. Lo que espera a la parte práctica son los vídeos.
 *
 * Lo leído va a su ficha (`usuarios/{uid}.lectura`, ver lib/material.ts): con
 * eso el panel da por leído el precurso. Sorela no lleva cuenta: no estudia.
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

/* Todo el material del curso se ve con el curso, aunque solo haya dejado
   el abono: los dossieres SÍ, lo que espera a la parte práctica son las
   clases en vídeo (ver app/api/lecciones). */
const abre = (p: Acceso, a: Acceso[]) => (p.tipo === 'curso' ? tieneElCurso(p.nombre, a) : puedeVerla(p, a));
/** Si lo puede leer quien tiene `accesos` (null: Sorela, que lo ve todo). */
const puedeLeer = (d: Documento, accesos: Acceso[] | null) => accesos === null || d.para.some((p) => abre(p, accesos));

export async function GET(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });

  // Sus accesos y lo que lleva leído salen de la misma lectura de su ficha.
  const ficha = sesion.rol === 'sorela' ? null : await baseDeDatos().collection(COLECCIONES.usuarios).doc(sesion.uid).get().catch(() => null);
  const accesos = sesion.rol === 'sorela' ? null : revisarAccesos(ficha?.get('accesos'));
  const puede = (d: Documento) => puedeLeer(d, accesos);
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
    // Lo leído, solo de lo que puede ver.
    const leido = leerLectura(ficha?.get('lectura'));
    const lectura: Record<string, Lectura> = Object.fromEntries(Object.entries(leido).filter(([id]) => documentos.some((d) => d.id === id)));
    return NextResponse.json({ ok: true, documentos, lectura }, { headers: SIN_CACHE });
  } catch (error) {
    console.error('[material] no se han podido firmar las páginas', error);
    return NextResponse.json({ ok: false, motivo: 'sin-almacen' }, { status: 503 });
  }
}

/**
 * Hasta dónde ha leído un dossier. Solo sube (releer el principio no borra lo
 * leído) y `leido` no se pierde nunca. Una escritura como mucho por llamada, y
 * ninguna si no ha avanzado.
 */
export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  // Sorela no lleva cuenta de lo leído: el material es suyo.
  if (sesion.rol === 'sorela') return NextResponse.json({ ok: true });

  const c = (await peticion.json().catch(() => null)) as { id?: unknown; pagina?: unknown } | null;
  const doc = DOCUMENTOS.find((d) => d.id === c?.id);
  const pagina = Math.floor(Number(c?.pagina));
  if (!doc || !Number.isFinite(pagina) || pagina < 1 || pagina > doc.paginas) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const db = baseDeDatos();
  const ref = db.collection(COLECCIONES.usuarios).doc(sesion.uid);
  try {
    const r = await db.runTransaction(async (t) => {
      const ficha = await t.get(ref);
      if (!ficha.exists) return 'sin-ficha' as const;
      if (!puedeLeer(doc, revisarAccesos(ficha.get('accesos')))) return 'sin-permiso' as const;
      const antes = leerLectura(ficha.get('lectura'))[doc.id] ?? { pagina: 0, leido: false };
      const nueva = Math.max(antes.pagina, pagina);
      const leido = antes.leido || nueva >= doc.paginas;
      if (nueva === antes.pagina && leido === antes.leido) return 'igual' as const;
      t.set(
        ref,
        {
          lectura: {
            [doc.id]: {
              pagina: nueva,
              leido,
              ...(antes.pagina === 0 ? { abierto: FieldValue.serverTimestamp() } : {}),
              ...(leido && !antes.leido ? { leidoEn: FieldValue.serverTimestamp() } : {}),
            },
          },
        },
        { merge: true }
      );
      return 'ok' as const;
    });
    if (r === 'sin-ficha') return NextResponse.json({ ok: false, motivo: r }, { status: 404 });
    if (r === 'sin-permiso') return NextResponse.json({ ok: false, motivo: r }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[material] lectura', e);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
}
