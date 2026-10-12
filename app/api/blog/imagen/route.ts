import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * Subir una imagen para el blog.
 *
 *   POST multipart { archivo }  → { url }
 *
 * Se reduce a 1800 px de ancho como mucho y se guarda en WebP: una foto del
 * móvil pesa 4 MB y en la web basta con 200 kB. A diferencia del material del
 * curso, estas imágenes SÍ son públicas: son para la web.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const s = await sesionActual();
  if (!s || s.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });

  let archivo: File | null = null;
  try {
    const f = (await peticion.formData()).get('archivo');
    archivo = f instanceof File ? f : null;
  } catch {
    /* sin archivo */
  }
  if (!archivo) return NextResponse.json({ ok: false, motivo: 'sin-archivo' }, { status: 400 });
  if (archivo.size > MAX_BYTES) return NextResponse.json({ ok: false, motivo: 'grande', texto: 'La imagen pesa más de 20 MB.' }, { status: 400 });
  if (!/^image\//.test(archivo.type)) return NextResponse.json({ ok: false, motivo: 'tipo', texto: 'Eso no es una imagen.' }, { status: 400 });

  let webp: Buffer;
  let ancho = 0;
  let alto = 0;
  try {
    const { data, info } = await sharp(Buffer.from(await archivo.arrayBuffer()))
      .rotate() // respeta la orientación con la que se hizo la foto
      .resize({ width: 1800, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    webp = data;
    ancho = info.width;
    alto = info.height;
  } catch {
    return NextResponse.json({ ok: false, motivo: 'tipo', texto: 'No he podido leer esa imagen.' }, { status: 400 });
  }

  const bucket = getStorage(aplicacion()).bucket(
    process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`
  );
  const ruta = `blog/${new Date().getFullYear()}/${randomBytes(8).toString('hex')}.webp`;
  const token = randomUUID();
  await bucket.file(ruta).save(webp, {
    contentType: 'image/webp',
    metadata: { cacheControl: 'public, max-age=31536000, immutable', metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
  return NextResponse.json({ ok: true, url, ancho, alto });
}
