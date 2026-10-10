import { NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual } from '@/lib/sesion-servidor';
import { esVideoPropio, puedeVerla } from '@/lib/aula';
import type { Acceso } from '@/lib/accesos';

/**
 * El enlace para ver un vídeo del almacén propio.
 *
 *   GET /api/lecciones/video?id=<idClase>  → { url, caduca }
 *
 * Los vídeos no tienen dirección pública: viven en Firebase Storage sin
 * permisos de lectura. Esta ruta comprueba que quien pide puede ver esa clase
 * y le da un enlace firmado que caduca a los 15 minutos. Si alguien lo copia,
 * deja de funcionar enseguida; y para pedir otro hay que tener la sesión.
 *
 * NO es un candado contra grabar la pantalla: eso no se puede impedir en una
 * web sin DRM. Lo que hay es que el enlace no se puede reenviar y que el
 * reproductor lleva el correo de quien mira por encima del vídeo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIGENCIA_MS = 15 * 60 * 1000;
const ID = /^[A-Za-z0-9_-]{1,200}$/;

export async function GET(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });

  const id = new URL(peticion.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const doc = await baseDeDatos().collection(COLECCIONES.lecciones).doc(id).get();
  if (!doc.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  const v = doc.data() ?? {};
  const video = String(v.video ?? '');
  if (!esVideoPropio(video)) return NextResponse.json({ ok: false, motivo: 'no-es-propio' }, { status: 400 });

  if (sesion.rol !== 'sorela') {
    const accesos = await accesosDe(sesion.uid);
    if (v.publicada === false || !puedeVerla(v.para as Acceso, accesos)) {
      return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
    }
  }

  try {
    const ruta = video.slice('propio:'.length);
    const caduca = Date.now() + VIGENCIA_MS;
    const [url] = await getStorage(aplicacion())
      .bucket(process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`)
      .file(ruta)
      .getSignedUrl({ version: 'v4', action: 'read', expires: caduca });
    return NextResponse.json(
      { ok: true, url, caduca },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[video] no se ha podido firmar el enlace', error);
    return NextResponse.json({ ok: false, motivo: 'sin-almacen' }, { status: 503 });
  }
}
