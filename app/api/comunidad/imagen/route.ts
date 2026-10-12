import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, hayFirebase } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual } from '@/lib/sesion-servidor';
import { tieneMembresia } from '@/lib/accesos';

/**
 * Subir una foto a la comunidad.
 *
 *   POST multipart { archivo } → { ruta, url }
 *
 * Se guarda PRIVADA (sin enlace público) en `comunidad/<uid>/…`, reducida a
 * 1600 px y sin los datos que lleva dentro la foto del móvil (dónde se hizo,
 * con qué teléfono): son fotos de clientas y eso no debe viajar con ellas.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const s = await sesionActual();
  if (!s) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (s.rol !== 'sorela' && !tieneMembresia(await accesosDe(s.uid))) {
    return NextResponse.json({ ok: false, motivo: 'sin-acceso' }, { status: 403 });
  }

  let archivo: File | null = null;
  try {
    const f = (await peticion.formData()).get('archivo');
    archivo = f instanceof File ? f : null;
  } catch {
    /* nada */
  }
  if (!archivo || !/^image\//.test(archivo.type)) return NextResponse.json({ ok: false, texto: 'Eso no es una imagen.' }, { status: 400 });
  if (archivo.size > 20 * 1024 * 1024) return NextResponse.json({ ok: false, texto: 'La foto pesa más de 20 MB.' }, { status: 400 });

  let webp: Buffer;
  try {
    // sharp no copia los metadatos (EXIF, GPS) salvo que se le pida: se van.
    webp = await sharp(Buffer.from(await archivo.arrayBuffer())).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    return NextResponse.json({ ok: false, texto: 'No he podido leer esa foto.' }, { status: 400 });
  }

  const bucket = getStorage(aplicacion()).bucket(process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`);
  const ruta = `comunidad/${s.uid}/${randomBytes(8).toString('hex')}.webp`;
  await bucket.file(ruta).save(webp, { contentType: 'image/webp', metadata: { cacheControl: 'private, max-age=3600' } });
  const [url] = await bucket.file(ruta).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 3600_000 });
  return NextResponse.json({ ok: true, ruta, url });
}
