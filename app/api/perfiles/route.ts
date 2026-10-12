import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, baseDeDatos, COLECCIONES, hayFirebase } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual, type Sesion } from '@/lib/sesion-servidor';

/**
 * Los perfiles, tipo Instagram, SOLO dentro de la plataforma.
 *
 *   GET    ?uid=           → el perfil (sin uid, el propio)
 *   PATCH  { bio, especialidad, ciudad, instagram, recorrido }   → el propio
 *   POST   multipart { tipo: 'portada'|'foto', archivo, pie? }  → el propio
 *   DELETE ?foto=id[&uid=]  → borrar una foto (la propia; Sorela, cualquiera)
 *
 * Quién ve qué: cada una ve siempre el suyo. Los de las demás, solo quien
 * tiene algo contratado (o Sorela): son terapeutas enseñando su trabajo a
 * compañeras, no un escaparate público.
 *
 * Las fotos son privadas en Storage y se sirven con enlaces firmados de una
 * hora. Se reducen y se les quitan los datos del móvil (GPS, modelo).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLECCION = 'perfiles';
const MAX_FOTOS = 60;
const ID = /^[A-Za-z0-9_-]{6,128}$/;
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

const bucket = () =>
  getStorage(aplicacion()).bucket(process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`);

async function firmar(ruta: string | null | undefined) {
  if (!ruta) return null;
  try {
    const [url] = await bucket().file(ruta).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 3600_000 });
    return url;
  } catch {
    return null;
  }
}

async function exigirSesion() {
  if (!hayFirebase()) return { error: NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 }) };
  const s = await sesionActual();
  if (!s) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  return { sesion: s };
}

async function puedeVerOtras(s: Sesion) {
  return s.rol === 'sorela' || (await accesosDe(s.uid)).length > 0;
}

export async function GET(peticion: Request) {
  const g = await exigirSesion();
  if (g.error) return g.error;
  const s = g.sesion;
  const pedido = texto(new URL(peticion.url).searchParams.get('uid'), 128) || s.uid;
  if (!ID.test(pedido)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const esMio = pedido === s.uid;
  if (!esMio && !(await puedeVerOtras(s))) return NextResponse.json({ ok: false, motivo: 'sin-acceso' }, { status: 403 });

  const db = baseDeDatos();
  const [usuario, perfil, fotos, publicaciones] = await Promise.all([
    db.collection(COLECCIONES.usuarios).doc(pedido).get(),
    db.collection(COLECCION).doc(pedido).get(),
    db.collection(COLECCION).doc(pedido).collection('fotos').orderBy('creado', 'desc').limit(MAX_FOTOS).get(),
    db.collection('comunidad_posts').where('autor', '==', pedido).count().get().catch(() => null),
  ]);
  if (!usuario.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  const u = usuario.data() ?? {};
  const p = perfil.data() ?? {};

  const foto = typeof u.foto === 'string' && u.foto.startsWith('data:image/') ? u.foto : null;
  const listaFotos = await Promise.all(
    fotos.docs.map(async (d) => ({ id: d.id, url: await firmar(d.get('ruta')), pie: String(d.get('pie') ?? ''), creado: d.get('creado')?.toDate?.().toISOString() ?? null }))
  );

  return NextResponse.json(
    {
      ok: true,
      esMio,
      puedeModerar: s.rol === 'sorela',
      perfil: {
        uid: pedido,
        nombre: String(u.nombre || (u.correo ? String(u.correo).split('@')[0] : '') || 'Sin nombre'),
        esSorela: u.rol === 'sorela',
        foto,
        portada: await firmar(p.portada),
        bio: String(p.bio ?? ''),
        especialidad: String(p.especialidad ?? ''),
        ciudad: String(p.ciudad ?? ''),
        instagram: String(p.instagram ?? ''),
        recorrido: Array.isArray(p.recorrido) ? p.recorrido : [],
        desde: u.creado?.toDate?.().toISOString() ?? null,
      },
      fotos: listaFotos.filter((f) => f.url),
      publicaciones: publicaciones?.data().count ?? 0,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function PATCH(peticion: Request) {
  const g = await exigirSesion();
  if (g.error) return g.error;
  const c = (await peticion.json().catch(() => ({}))) as Record<string, unknown>;
  const recorrido = (Array.isArray(c.recorrido) ? c.recorrido : [])
    .slice(0, 20)
    .map((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      return { anio: texto(x.anio, 12), titulo: texto(x.titulo, 90), texto: texto(x.texto, 400) };
    })
    .filter((r) => r.titulo);
  const instagram = texto(c.instagram, 40).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '');
  await baseDeDatos()
    .collection(COLECCION)
    .doc(g.sesion.uid)
    .set(
      {
        bio: texto(c.bio, 400),
        especialidad: texto(c.especialidad, 80),
        ciudad: texto(c.ciudad, 80),
        instagram,
        recorrido,
        actualizado: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  return NextResponse.json({ ok: true });
}

export async function POST(peticion: Request) {
  const g = await exigirSesion();
  if (g.error) return g.error;
  const uid = g.sesion.uid;
  let form: FormData;
  try {
    form = await peticion.formData();
  } catch {
    return NextResponse.json({ ok: false, texto: 'No ha llegado la foto.' }, { status: 400 });
  }
  const tipo = form.get('tipo') === 'portada' ? 'portada' : 'foto';
  const archivo = form.get('archivo');
  if (!(archivo instanceof File) || !/^image\//.test(archivo.type)) return NextResponse.json({ ok: false, texto: 'Eso no es una imagen.' }, { status: 400 });
  if (archivo.size > 20 * 1024 * 1024) return NextResponse.json({ ok: false, texto: 'La foto pesa más de 20 MB.' }, { status: 400 });

  const db = baseDeDatos();
  const ref = db.collection(COLECCION).doc(uid);
  if (tipo === 'foto') {
    const n = (await ref.collection('fotos').count().get()).data().count;
    if (n >= MAX_FOTOS) return NextResponse.json({ ok: false, texto: `Puedes tener hasta ${MAX_FOTOS} fotos. Borra alguna para subir más.` }, { status: 400 });
  }

  let webp: Buffer;
  try {
    const img = sharp(Buffer.from(await archivo.arrayBuffer())).rotate();
    webp = await (tipo === 'portada'
      ? img.resize({ width: 1800, height: 600, fit: 'cover', position: 'attention' })
      : img.resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    )
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ ok: false, texto: 'No he podido leer esa foto.' }, { status: 400 });
  }

  const ruta = `perfiles/${uid}/${tipo === 'portada' ? 'portada' : 'fotos'}/${randomBytes(8).toString('hex')}.webp`;
  await bucket().file(ruta).save(webp, { contentType: 'image/webp', metadata: { cacheControl: 'private, max-age=3600' } });

  if (tipo === 'portada') {
    const anterior = (await ref.get()).get('portada');
    await ref.set({ portada: ruta, actualizado: FieldValue.serverTimestamp() }, { merge: true });
    if (anterior) await bucket().file(anterior).delete().catch(() => null);
    return NextResponse.json({ ok: true, url: await firmar(ruta) });
  }
  const nueva = await ref.collection('fotos').add({ ruta, pie: texto(form.get('pie'), 300), creado: FieldValue.serverTimestamp() });
  return NextResponse.json({ ok: true, foto: { id: nueva.id, url: await firmar(ruta), pie: texto(form.get('pie'), 300) } });
}

export async function DELETE(peticion: Request) {
  const g = await exigirSesion();
  if (g.error) return g.error;
  const q = new URL(peticion.url).searchParams;
  const uid = texto(q.get('uid'), 128) || g.sesion.uid;
  const foto = texto(q.get('foto'), 128);
  if (!ID.test(uid) || !ID.test(foto)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  // La propia, o Sorela moderando.
  if (uid !== g.sesion.uid && g.sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  const ref = baseDeDatos().collection(COLECCION).doc(uid).collection('fotos').doc(foto);
  const d = await ref.get();
  if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  await bucket().file(String(d.get('ruta'))).delete().catch(() => null);
  await ref.delete();
  return NextResponse.json({ ok: true });
}
