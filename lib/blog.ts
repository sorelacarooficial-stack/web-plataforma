import { baseDeDatos, hayFirebase } from './firebase-servidor';
import { minutosDe, type Articulo, type Bloque } from './blog-tipos';

/**
 * El blog, del lado del servidor: leer artículos de Firestore.
 *
 * La colección es `articulos`. Las páginas públicas solo ven los publicados;
 * el panel de Sorela los ve todos (ver app/api/blog).
 */

export const COLECCION_BLOG = 'articulos';

const fecha = (v: unknown): string | null => (v as { toDate?: () => Date })?.toDate?.().toISOString() ?? null;

export function aArticulo(id: string, v: FirebaseFirestore.DocumentData): Articulo {
  const bloques = (Array.isArray(v.bloques) ? v.bloques : []) as Bloque[];
  return {
    id,
    slug: String(v.slug ?? id),
    titulo: String(v.titulo ?? ''),
    resumen: String(v.resumen ?? ''),
    categoria: String(v.categoria ?? ''),
    portada: v.portada?.url ? { url: String(v.portada.url), alt: String(v.portada.alt ?? '') } : null,
    bloques,
    estado: v.estado === 'publicado' ? 'publicado' : 'borrador',
    publicado: fecha(v.publicado),
    actualizado: fecha(v.actualizado),
    minutos: Number(v.minutos) || minutosDe(bloques, String(v.resumen ?? '')),
  };
}

/** Los publicados, el más reciente primero. Si la base no contesta, ninguno. */
export async function articulosPublicados(limite = 60): Promise<Articulo[]> {
  if (!hayFirebase()) return [];
  try {
    const l = await baseDeDatos()
      .collection(COLECCION_BLOG)
      .where('estado', '==', 'publicado')
      .get();
    return l.docs
      .map((d) => aArticulo(d.id, d.data()))
      .sort((a, b) => (b.publicado ?? '').localeCompare(a.publicado ?? ''))
      .slice(0, limite);
  } catch (e) {
    console.error('[blog] no se han podido leer los artículos', e);
    return [];
  }
}

export async function articuloPublicado(slug: string): Promise<Articulo | null> {
  if (!hayFirebase() || !/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  try {
    const l = await baseDeDatos().collection(COLECCION_BLOG).where('slug', '==', slug).limit(1).get();
    const d = l.docs[0];
    if (!d) return null;
    const a = aArticulo(d.id, d.data());
    return a.estado === 'publicado' ? a : null;
  } catch (e) {
    console.error('[blog] no se ha podido leer el artículo', e);
    return null;
  }
}
