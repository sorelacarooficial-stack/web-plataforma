import { NextResponse } from 'next/server';
import { apuntarClic, contactoDelEnlace, destinoGrupo, origenDelEnlace } from '@/lib/grupo-whatsapp';

/**
 * /grupo: apunta que alguien ha pulsado «Entrar al grupo de WhatsApp» y la
 * manda al grupo. Ver lib/grupo-whatsapp.ts.
 *
 * Apuntar tiene un tope de 1,5 s: si Firestore tarda, la persona llega al
 * grupo igual y ese clic se pierde. Llegar al grupo importa más que contarlo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOPE_MS = 1500;

export async function GET(peticion: Request) {
  const q = new URL(peticion.url).searchParams;
  const origen = origenDelEnlace(q.get('o'));
  const contacto = contactoDelEnlace(q.get('c'), q.get('f'));
  const navegador = peticion.headers.get('user-agent') ?? '';

  await Promise.race([apuntarClic(origen, contacto, navegador), new Promise((r) => setTimeout(r, TOPE_MS))]);

  return NextResponse.redirect(destinoGrupo(), {
    status: 302,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
