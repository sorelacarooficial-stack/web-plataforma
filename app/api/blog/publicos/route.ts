import { NextResponse } from 'next/server';
import { articulosPublicados } from '@/lib/blog';

/**
 * Los últimos artículos publicados, para las noticias del panel de las
 * alumnas. Pública: es lo mismo que se ve en /blog.
 */

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET() {
  const articulos = (await articulosPublicados(3)).map((a) => ({
    slug: a.slug,
    titulo: a.titulo,
    resumen: a.resumen,
    categoria: a.categoria,
    portada: a.portada?.url ?? null,
    publicado: a.publicado,
  }));
  return NextResponse.json({ ok: true, articulos });
}
