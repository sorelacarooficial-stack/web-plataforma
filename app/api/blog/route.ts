import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { COLECCION_BLOG, aArticulo } from '@/lib/blog';
import { idYoutube, minutosDe, slugDe, type Bloque } from '@/lib/blog-tipos';

/**
 * El blog, del lado de Sorela.
 *
 *   GET                       → todos los artículos, también los borradores
 *   POST { id?, titulo, … }   → crea o guarda; con estado «publicado» sale en la web
 *   DELETE ?id=…              → lo borra
 *
 * Al guardar se avisa a la web para que rehaga /blog y la página del artículo
 * en la siguiente visita: lo publicado aparece sin esperar.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const urlValida = (u: string) => /^https:\/\/[^\s"'<>]+$/.test(u);

async function exigirAdmin() {
  if (!hayFirebase()) return { error: NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 }) };
  const s = await sesionActual();
  if (!s) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (s.rol !== 'sorela') return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  return { sesion: s };
}

/** Limpia los bloques que llegan del editor: solo lo que se sabe pintar. */
function limpiarBloques(crudo: unknown): Bloque[] {
  if (!Array.isArray(crudo)) return [];
  const salida: Bloque[] = [];
  for (const b of crudo.slice(0, 200)) {
    if (!b || typeof b !== 'object') continue;
    const x = b as Record<string, unknown>;
    switch (x.tipo) {
      case 'parrafo':
      case 'subtitulo':
        salida.push({ tipo: x.tipo, texto: recortar(x.texto, x.tipo === 'parrafo' ? 6000 : 200) });
        break;
      case 'cita':
        salida.push({ tipo: 'cita', texto: recortar(x.texto, 800), autor: recortar(x.autor, 120) || undefined });
        break;
      case 'lista':
        salida.push({ tipo: 'lista', items: (Array.isArray(x.items) ? x.items : []).slice(0, 40).map((i) => recortar(i, 600)) });
        break;
      case 'imagen': {
        const url = recortar(x.url, 1000);
        if (urlValida(url)) salida.push({ tipo: 'imagen', url, pie: recortar(x.pie, 200) || undefined, alt: recortar(x.alt, 200) || undefined });
        break;
      }
      case 'video': {
        const id = idYoutube(recortar(x.youtube, 200));
        if (id) salida.push({ tipo: 'video', youtube: id });
        break;
      }
    }
  }
  return salida;
}

function refrescarWeb(slug?: string) {
  try {
    revalidatePath('/blog');
    revalidatePath('/'); // la portada lleva el carrusel del blog
    revalidatePath('/sitemap.xml');
    if (slug) revalidatePath(`/blog/${slug}`);
  } catch (e) {
    console.error('[blog] no se ha podido refrescar la web', e);
  }
}

export async function GET() {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const l = await baseDeDatos().collection(COLECCION_BLOG).get();
  const articulos = l.docs
    .map((d) => aArticulo(d.id, d.data()))
    .sort((a, b) => (b.actualizado ?? '').localeCompare(a.actualizado ?? ''));
  return NextResponse.json({ ok: true, articulos });
}

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  let c: Record<string, unknown>;
  try {
    c = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const titulo = recortar(c.titulo, 160);
  const resumen = recortar(c.resumen, 400);
  const categoria = recortar(c.categoria, 60);
  const bloques = limpiarBloques(c.bloques);
  const estado = c.estado === 'publicado' ? 'publicado' : 'borrador';
  const portadaUrl = recortar((c.portada as { url?: string } | null)?.url, 1000);
  const portada = urlValida(portadaUrl)
    ? { url: portadaUrl, alt: recortar((c.portada as { alt?: string }).alt, 200) || titulo }
    : null;

  const errores: Record<string, string> = {};
  if (titulo.length < 4) errores.titulo = 'Ponle un título.';
  if (estado === 'publicado') {
    if (!resumen) errores.resumen = 'Para publicarlo hace falta un resumen: es lo que sale en Google y al compartirlo.';
    if (!bloques.some((b) => (b.tipo === 'parrafo' && b.texto) || b.tipo === 'imagen')) errores.bloques = 'Para publicarlo tiene que tener algo de texto.';
  }
  if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });

  const db = baseDeDatos();
  const col = db.collection(COLECCION_BLOG);
  const id = typeof c.id === 'string' && ID.test(c.id) ? c.id : null;
  const ref = id ? col.doc(id) : col.doc();
  const previo = id ? await ref.get() : null;
  if (id && !previo?.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  const antes = previo?.data() ?? {};

  /* La dirección se fija la primera vez que se publica: cambiarla después
     rompería los enlaces que ya se hayan compartido. Mientras es borrador,
     sigue al título. */
  let slug = antes.estado === 'publicado' && antes.slug ? String(antes.slug) : slugDe(titulo);
  if (slug !== antes.slug) {
    const base = slug;
    for (let n = 2; ; n++) {
      const otro = await col.where('slug', '==', slug).limit(2).get();
      if (otro.docs.every((d) => d.id === ref.id)) break;
      slug = `${base}-${n}`;
    }
  }

  await ref.set(
    {
      titulo,
      resumen,
      categoria,
      portada,
      bloques,
      estado,
      slug,
      minutos: minutosDe(bloques, resumen),
      actualizado: FieldValue.serverTimestamp(),
      ...(previo?.exists ? {} : { creado: FieldValue.serverTimestamp(), autor: g.sesion.uid }),
      ...(estado === 'publicado' && !antes.publicado ? { publicado: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  // Si estaba publicado o se acaba de publicar, la web se rehace.
  if (estado === 'publicado' || antes.estado === 'publicado') refrescarWeb(slug);

  const d = await ref.get();
  return NextResponse.json({ ok: true, articulo: aArticulo(ref.id, d.data() ?? {}) });
}

export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const id = new URL(peticion.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const ref = baseDeDatos().collection(COLECCION_BLOG).doc(id);
  const d = await ref.get();
  if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  const slug = String(d.data()?.slug ?? '');
  await ref.delete();
  refrescarWeb(slug);
  return NextResponse.json({ ok: true });
}
