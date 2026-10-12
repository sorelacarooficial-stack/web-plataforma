import { NextResponse } from 'next/server';
import { hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import {
  DIRECCION,
  adjunto,
  borrar,
  datosRespuesta,
  guardarEnviado,
  hayBuzon,
  leer,
  listar,
  marcar,
  motivoBuzon,
  type Carpeta,
} from '@/lib/buzon';
import { mandarCorreo } from '@/lib/correos';
import { escapar } from '@/lib/plantillas-correo';

/**
 * El buzón hola@ (solo Sorela).
 *
 *   GET ?carpeta=&pagina=           → la lista
 *   GET ?carpeta=&uid=              → un correo entero
 *   GET ?carpeta=&uid=&adjunto=i    → descargar un adjunto
 *   PATCH { carpeta, uid, leido?, destacado? }
 *   DELETE ?carpeta=&uid=           → a la papelera (o fuera, si ya está ahí)
 *   POST { para, asunto, texto, responde?: { carpeta, uid } } → enviar
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CARPETAS: Carpeta[] = ['entrada', 'enviados', 'papelera', 'spam'];
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function exigirAdmin() {
  if (!hayFirebase()) return { error: NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 }) };
  const s = await sesionActual();
  if (!s) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (s.rol !== 'sorela') return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  if (!hayBuzon()) return { error: NextResponse.json({ ok: false, motivo: 'sin-buzon', direccion: DIRECCION }) };
  return { sesion: s };
}

const carpetaDe = (v: unknown): Carpeta => (CARPETAS.includes(v as Carpeta) ? (v as Carpeta) : 'entrada');
const uidDe = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const fallo = (e: unknown) => {
  console.error('[buzon]', e);
  return NextResponse.json({ ok: false, motivo: 'imap', detalle: motivoBuzon(e) }, { status: 502 });
};

export async function GET(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const q = new URL(peticion.url).searchParams;
  const carpeta = carpetaDe(q.get('carpeta'));
  const uid = uidDe(q.get('uid'));
  try {
    if (uid && q.has('adjunto')) {
      const a = await adjunto(carpeta, uid, Number(q.get('adjunto')) || 0);
      if (!a) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
      return new NextResponse(new Uint8Array(a.contenido), {
        headers: {
          'Content-Type': a.tipo || 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
          'Cache-Control': 'private, no-store',
        },
      });
    }
    if (uid) {
      const m = await leer(carpeta, uid);
      if (!m) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
      return NextResponse.json({ ok: true, mensaje: m }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const r = await listar(carpeta, Math.max(0, Number(q.get('pagina')) || 0));
    return NextResponse.json({ ok: true, direccion: DIRECCION, ...r }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return fallo(e);
  }
}

export async function PATCH(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = (await peticion.json().catch(() => ({}))) as Record<string, unknown>;
  const uid = uidDe(c.uid);
  if (!uid) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  try {
    await marcar(carpetaDe(c.carpeta), uid, {
      leido: typeof c.leido === 'boolean' ? c.leido : undefined,
      destacado: typeof c.destacado === 'boolean' ? c.destacado : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fallo(e);
  }
}

export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const q = new URL(peticion.url).searchParams;
  const uid = uidDe(q.get('uid'));
  if (!uid) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  try {
    await borrar(carpetaDe(q.get('carpeta')), uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fallo(e);
  }
}

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = (await peticion.json().catch(() => ({}))) as Record<string, unknown>;
  const texto = String(c.texto ?? '').slice(0, 20000).trim();
  const responde = c.responde as { carpeta?: unknown; uid?: unknown } | undefined;
  const uidOriginal = uidDe(responde?.uid);
  const carpetaOriginal = carpetaDe(responde?.carpeta);

  let para = String(c.para ?? '').trim().toLowerCase();
  let asunto = String(c.asunto ?? '').trim().slice(0, 200);
  let citado = '';
  const cabeceras: Record<string, string> = {};

  try {
    if (uidOriginal) {
      const r = await datosRespuesta(carpetaOriginal, uidOriginal);
      if (!r) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
      para = para || r.para;
      asunto = asunto || r.asunto;
      if (r.messageId) cabeceras['In-Reply-To'] = r.messageId;
      if (r.referencias.length) cabeceras['References'] = r.referencias.slice(-10).join(' ');
      const cuando = r.fecha
        ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(r.fecha)
        : '';
      citado = `\n\nEl ${cuando}, ${r.nombre || r.para} escribió:\n${r.citado}`;
    }
  } catch (e) {
    return fallo(e);
  }

  const errores: Record<string, string> = {};
  if (!CORREO.test(para)) errores.para = 'Ese correo no parece correcto.';
  if (!asunto) errores.asunto = 'Ponle un asunto.';
  if (!texto) errores.texto = 'Escribe algo.';
  if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });

  /* Un correo personal, no una plantilla: texto tal cual, con la firma. Así
     se lee como lo que es, una respuesta de Sorela, y así lo ven los filtros. */
  const firma = '\n\nSorela Caro\nCreadora de la Técnica Divine\nsorelacarodivine.com';
  const cuerpo = `${texto}${firma}${citado}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1a17">${escapar(texto).replace(/\n/g, '<br>')}<br><br><span style="color:#6c645a">Sorela Caro<br>Creadora de la Técnica Divine<br><a href="https://sorelacarodivine.com" style="color:#8a6a32">sorelacarodivine.com</a></span>${
    citado
      ? `<br><br><blockquote style="margin:0;padding-left:12px;border-left:3px solid #e3ddd4;color:#6c645a">${escapar(citado.trim()).replace(/\n/g, '<br>')}</blockquote>`
      : ''
  }</div>`;

  const r = await mandarCorreo(
    { para, asunto, texto: cuerpo, html, responderA: DIRECCION, cabeceras },
    { tipo: 'manual' }
  );
  if (r.estado !== 'enviado') {
    return NextResponse.json({ ok: false, motivo: 'envio', detalle: r.detalle ?? 'No ha salido.' }, { status: 502 });
  }
  /* La copia en «Enviados» no debe tumbar un envío que ya ha salido. */
  let copia = true;
  try {
    await guardarEnviado({ para, asunto, texto: cuerpo, html, cabeceras }, uidOriginal ? { carpeta: carpetaOriginal, uid: uidOriginal } : undefined);
  } catch (e) {
    console.error('[buzon] enviado pero sin copia en Enviados', e);
    copia = false;
  }
  return NextResponse.json({ ok: true, copia });
}
