import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { baseDeDatos, COLECCIONES, hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { leerFirmaSorela } from '@/lib/firma-sorela';
import { resumenLogros } from '@/lib/logros';
import { CURSO_DIVINE } from '@/lib/accesos';

/**
 * El certificado de la Formación Técnica Divine, en PDF.
 *
 * Solo para quien ha terminado TODAS sus clases (el logro «Formación
 * completa»). Se genera al vuelo, apaisado, con su nombre, la fecha en que lo
 * terminó, la firma de Sorela y un código para comprobarlo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORO = rgb(0.54, 0.42, 0.2);
const TINTA = rgb(0.08, 0.07, 0.06);
const GRIS = rgb(0.42, 0.39, 0.35);

export async function GET() {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const s = await sesionActual();
  if (!s) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  const r = await resumenLogros(s.uid, false);
  if (!r.certificado) return NextResponse.json({ ok: false, motivo: 'sin-terminar' }, { status: 403 });

  const u = (await baseDeDatos().collection(COLECCIONES.usuarios).doc(s.uid).get()).data() ?? {};
  const nombre = String(u.nombre || s.nombre || s.correo || 'Alumna');
  const logro = r.logros.find((l) => l.id === 'curso-completo');
  const fecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    logro?.cuando ? new Date(logro.cuando) : new Date()
  );
  const codigo = `TD-${s.uid.slice(0, 6).toUpperCase()}-${(logro?.cuando ?? '').slice(0, 10).replace(/-/g, '')}`;

  const doc = await PDFDocument.create();
  doc.setTitle(`Certificado ${CURSO_DIVINE} · ${nombre}`);
  const page = doc.addPage([842, 595]); // A4 apaisado
  const { width: W, height: H } = page.getSize();
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifIt = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.98, 0.97, 0.95) });
  page.drawRectangle({ x: 26, y: 26, width: W - 52, height: H - 52, borderColor: ORO, borderWidth: 1.4 });
  page.drawRectangle({ x: 34, y: 34, width: W - 68, height: H - 68, borderColor: ORO, borderWidth: 0.5 });

  const centro = (t: string, y: number, f = serif, tam = 14, color = TINTA) =>
    page.drawText(t, { x: (W - f.widthOfTextAtSize(t, tam)) / 2, y, size: tam, font: f, color });

  try {
    const logo = await doc.embedPng(await readFile(path.join(process.cwd(), 'fotos', 'logo-sorela.png')));
    const w = 120;
    page.drawImage(logo, { x: (W - w) / 2, y: H - 120, width: w, height: (logo.height / logo.width) * w });
  } catch {
    /* sin logo, igual de válido */
  }

  centro('CERTIFICADO DE FORMACIÓN', H - 160, sans, 11, ORO);
  centro('Se certifica que', H - 205, serifIt, 16, GRIS);
  const tam = Math.min(40, (W - 160) / Math.max(1, serif.widthOfTextAtSize(nombre, 1)));
  centro(nombre, H - 260, serif, tam, TINTA);
  page.drawLine({ start: { x: W / 2 - 170, y: H - 275 }, end: { x: W / 2 + 170, y: H - 275 }, thickness: 0.6, color: ORO });
  centro(`ha completado la ${CURSO_DIVINE}`, H - 310, serif, 17, TINTA);
  centro(`impartida por Sorela Caro · ${fecha}`, H - 336, serifIt, 14, GRIS);

  try {
    const firma = await leerFirmaSorela();
    if (firma) {
      const img = await doc.embedPng(firma);
      const w = 150;
      page.drawImage(img, { x: W / 2 - w / 2, y: 118, width: w, height: (img.height / img.width) * w });
    }
  } catch {
    /* sin firma */
  }
  page.drawLine({ start: { x: W / 2 - 110, y: 112 }, end: { x: W / 2 + 110, y: 112 }, thickness: 0.5, color: GRIS });
  centro('Sorela Caro · Creadora de la Técnica Divine', 96, sans, 10, GRIS);
  centro(`Código de verificación: ${codigo}`, 58, sans, 8.5, GRIS);

  const bytes = await doc.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Certificado-Tecnica-Divine.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
