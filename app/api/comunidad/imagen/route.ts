import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual } from '@/lib/sesion-servidor';
import { tieneMembresia } from '@/lib/accesos';
import { exigirSesion } from '@/lib/permisos';

/**
 * Subir una foto a la comunidad, o quitarla antes de publicar.
 *
 *   POST multipart { archivo }                       → { ok, ruta, url }
 *   DELETE ?ruta=comunidad/{uid}/{hex}.webp          → { ok }   (409 si ya está publicada)
 *
 * Se guarda PRIVADA (sin enlace público) en `comunidad/<uid>/…`, reducida a
 * 1600 px y sin los datos que lleva dentro la foto del móvil (dónde se hizo,
 * con qué teléfono): son fotos de clientas y eso no debe viajar con ellas.
 *
 * La foto se sube en cuanto se elige, antes de publicar. Si luego se quita del
 * borrador, el DELETE la borra del almacén: si no, se quedaba ahí para
 * siempre, una foto de una clienta sin publicación y sin dueña a la vista.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RUTA = /^comunidad\/[A-Za-z0-9_-]{1,80}\/[a-f0-9]{16}\.webp$/;

const almacen = () => getStorage(aplicacion()).bucket(process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`);

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

  const bucket = almacen();
  const ruta = `comunidad/${s.uid}/${randomBytes(8).toString('hex')}.webp`;
  await bucket.file(ruta).save(webp, { contentType: 'image/webp', metadata: { cacheControl: 'private, max-age=3600' } });
  const [url] = await bucket.file(ruta).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 3600_000 });
  return NextResponse.json({ ok: true, ruta, url });
}

export async function DELETE(peticion: Request) {
  const g = await exigirSesion();
  if (g.error) return g.error;
  const ruta = (new URL(peticion.url).searchParams.get('ruta') || '').slice(0, 200);
  if (!RUTA.test(ruta)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  // Solo las propias. No hace falta tener la Comunidad: limpiar lo suyo se puede siempre.
  if (!ruta.startsWith(`comunidad/${g.sesion.uid}/`)) return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  /* Si ya va en una publicación, no se toca: se quita borrando la publicación. */
  const usada = await baseDeDatos().collection('comunidad_posts').where('imagenes', 'array-contains', ruta).limit(1).get();
  if (!usada.empty) return NextResponse.json({ ok: false, motivo: 'en-uso' }, { status: 409 });
  // Si ya no estaba, da igual: lo que se quería era que no estuviera.
  await almacen().file(ruta).delete({ ignoreNotFound: true });
  return NextResponse.json({ ok: true });
}
