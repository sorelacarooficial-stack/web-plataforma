import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { hayFirebase } from '@/lib/firebase-servidor';
import { aplicarPago } from '@/lib/reserva-pago';

/**
 * Stripe avisa aquí cuando alguien paga (webhook). Es la prueba de verdad de
 * un pago: llega firmada por Stripe y llega aunque la persona cierre la
 * pestaña antes de volver a «gracias».
 *
 * CÓMO SE ACTIVA (una vez, en Stripe y en Vercel):
 *   1. Stripe › Desarrolladores › Webhooks › Añadir destino:
 *      https://sorelacarodivine.com/api/stripe/webhook
 *      Eventos: checkout.session.completed y
 *      checkout.session.async_payment_succeeded.
 *   2. Stripe enseña un «secreto de firma» (whsec_…). Se pega en Vercel como
 *      STRIPE_WEBHOOK_SECRET y se vuelve a desplegar.
 * Sin esa variable, esto responde 503 y no hace nada.
 *
 * Solo cuenta lo que trae `client_reference_id` (el id de la reserva que
 * pone /api/reserva en el enlace de pago) y está pagado.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9]{20}$/;
const TOLERANCIA_S = 5 * 60;
const EVENTOS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

/** Cabecera Stripe-Signature: «t=…,v1=…[,v1=…]». HMAC-SHA256 de «t.cuerpo». */
function firmaValida(cuerpo: string, cabecera: string | null, secreto: string): boolean {
  if (!cabecera) return false;
  const partes = cabecera.split(',').map((p) => p.split('=') as [string, string]);
  const t = Number(partes.find(([k]) => k === 't')?.[1]);
  const firmas = partes.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || !firmas.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > TOLERANCIA_S) return false;
  const esperada = createHmac('sha256', secreto).update(`${t}.${cuerpo}`).digest();
  return firmas.some((f) => {
    const b = Buffer.from(f, 'hex');
    return b.length === esperada.length && timingSafeEqual(b, esperada);
  });
}

export async function POST(peticion: Request) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secreto) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });

  const cuerpo = await peticion.text();
  if (!firmaValida(cuerpo, peticion.headers.get('stripe-signature'), secreto)) {
    return NextResponse.json({ ok: false, motivo: 'firma' }, { status: 400 });
  }
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-firebase' }, { status: 503 });

  let evento: { type?: string; data?: { object?: { id?: string; payment_status?: string; client_reference_id?: string | null } } };
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const sesion = evento.data?.object;
  if (!EVENTOS.has(String(evento.type)) || !sesion) return NextResponse.json({ ok: true, ignorado: evento.type ?? 'sin-tipo' });
  if (sesion.payment_status !== 'paid') return NextResponse.json({ ok: true, ignorado: 'sin-pagar' });

  const id = String(sesion.client_reference_id ?? '');
  // Pagos que no vienen de /reserva (enlace suelto sin reserva): se ignoran, Stripe no tiene que reintentar.
  if (!ID.test(id)) return NextResponse.json({ ok: true, ignorado: 'sin-reserva' });

  try {
    const r = await aplicarPago(id, { verificado: true, sesion: sesion.id, por: 'stripe-webhook' });
    return NextResponse.json({ ok: true, resultado: r });
  } catch (e) {
    console.error('[stripe/webhook]', id, e);
    // 500: Stripe lo reintenta solo.
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
}
