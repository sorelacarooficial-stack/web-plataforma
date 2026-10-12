/**
 * Cómo es un artículo del blog. Solo tipos y utilidades que no tocan la base
 * de datos, para que los use igual el editor del panel (en el navegador) que
 * las páginas públicas (en el servidor).
 */

export type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'imagen'; url: string; pie?: string; alt?: string }
  | { tipo: 'cita'; texto: string; autor?: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'video'; youtube: string };

export type Articulo = {
  id: string;
  slug: string;
  titulo: string;
  resumen: string;
  categoria: string;
  portada: { url: string; alt: string } | null;
  bloques: Bloque[];
  estado: 'borrador' | 'publicado';
  publicado: string | null;
  actualizado: string | null;
  minutos: number;
};

export const CATEGORIAS = ['Drenaje linfático', 'Técnica Divine', 'Formación', 'Bienestar', 'Casos reales', 'Noticias'];

/** «Drenaje linfático: qué es» → «drenaje-linfatico-que-es». */
export function slugDe(t: string): string {
  return (
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'articulo'
  );
}

/** Minutos de lectura, a 220 palabras por minuto. Nunca menos de 1. */
export function minutosDe(bloques: Bloque[], resumen = ''): number {
  const texto = [resumen, ...bloques.map((b) => ('texto' in b ? b.texto : 'items' in b ? b.items.join(' ') : ''))].join(' ');
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 220));
}

/**
 * Formato dentro de un párrafo, lo justo: **negrita**, *cursiva* y
 * [enlaces](https://…). Se trocea en piezas y se pinta con React, nunca como
 * HTML: así un texto pegado de cualquier sitio no puede colar nada.
 */
export type Pieza = { t: 'texto' | 'negrita' | 'cursiva'; v: string } | { t: 'enlace'; v: string; href: string };

export function trocear(texto: string): Pieza[] {
  const piezas: Pieza[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let ultimo = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > ultimo) piezas.push({ t: 'texto', v: texto.slice(ultimo, m.index) });
    if (m[1]) piezas.push({ t: 'negrita', v: m[1] });
    else if (m[2]) piezas.push({ t: 'cursiva', v: m[2] });
    else if (m[3] && /^(https?:\/\/|\/|mailto:)/.test(m[4])) piezas.push({ t: 'enlace', v: m[3], href: m[4] });
    else piezas.push({ t: 'texto', v: m[0] });
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) piezas.push({ t: 'texto', v: texto.slice(ultimo) });
  return piezas;
}

/** El identificador de un vídeo de YouTube a partir de cualquier enlace suyo. */
export function idYoutube(v: string): string {
  const m = v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(v.trim()) ? v.trim() : '';
}
