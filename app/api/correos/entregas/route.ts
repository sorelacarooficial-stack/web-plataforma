import { NextResponse } from 'next/server';
import { hayFirebase } from '@/lib/firebase-servidor';
import { apuntarEvento, daDeBaja, deEvento, firmaValida } from '@/lib/entregas';

/**
 * El aviso automático de Resend (webhook): qué ha pasado con cada correo
 * después de salir. Se configura en Resend › Webhooks apuntando aquí
 * (https://sorelacarodivine.com/api/correos/entregas), y su secreto de firma
 * («whsec_…») va en Vercel como RESEND_WEBHOOK_SECRET.
 *
 *   POST  (lo llama Resend, firmado)  → { ok }
 *
 * No hay sesión: lo que protege es la firma. Sin secreto configurado o con la
 * firma mal, 401 y no se toca nada. Con la firma bien se contesta 200 aunque el
 * evento no sirva o no se encuentre su correo: si no, Resend lo reintentaría
 * durante días por algo que no va a cambiar. Ver lib/entregas.ts.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Aviso = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    created_at?: string;
    bounce?: { message?: string; type?: string; subType?: string };
  };
};

export async function POST(peticion: Request) {
  const secreto = process.env.RESEND_WEBHOOK_SECRET ?? '';
  // El cuerpo tal cual llega: la firma se calcula sobre él, sin tocarlo.
  const cuerpo = await peticion.text();
  if (!secreto || !firmaValida(cuerpo, peticion.headers, secreto)) {
    return NextResponse.json({ ok: false, motivo: 'firma' }, { status: 401 });
  }
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });

  let aviso: Aviso;
  try {
    aviso = JSON.parse(cuerpo) as Aviso;
  } catch {
    return NextResponse.json({ ok: true, ignorado: 'cuerpo' });
  }
  const tipo = String(aviso.type ?? '');
  const que = deEvento(tipo);
  if (!que || !aviso.data) return NextResponse.json({ ok: true, ignorado: tipo || 'sin-tipo' });

  const d = aviso.data;
  const para = Array.isArray(d.to) ? d.to[0] : d.to;
  const rebote = d.bounce ? [d.bounce.type, d.bounce.subType, d.bounce.message].filter(Boolean).join(' · ') : null;
  try {
    const encontrado = await apuntarEvento({
      idEnvio: d.email_id,
      para,
      asunto: d.subject,
      que,
      cuando: new Date(aviso.created_at ?? d.created_at ?? Date.now()),
      detalle: rebote,
      baja: daDeBaja(tipo),
    });
    return NextResponse.json({ ok: true, encontrado });
  } catch (e) {
    // Un fallo nuestro (Firestore): 500 para que Resend lo reintente luego.
    console.error('[entregas] no se ha podido apuntar el aviso', e);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
}
