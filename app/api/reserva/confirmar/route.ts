import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { COLECCION_RESERVAS, HORAS_PARA_CONFIRMAR } from '@/lib/reserva';
import { aplicarPago, SESION_STRIPE as SESION } from '@/lib/reserva-pago';

/**
 * Paso 3: al volver de Stripe, /reserva/gracias confirma la reserva.
 *
 *   POST { id, s? } → { ok, confirmado, verificado }
 *
 * `id` es el de la reserva que guardó el navegador en el paso 1 (no se
 * adivina: 20 caracteres al azar). Se marca `pagoConfirmado: true` en la
 * reserva y en el contacto, y las presenciales entran en las fechas de su
 * ciudad para darles el acceso.
 *
 * Con STRIPE_SECRET_KEY en Vercel y el número del pago (`s`, si el enlace de
 * Stripe lleva `&s={CHECKOUT_SESSION_ID}`), se pregunta a Stripe si de verdad
 * está pagado y es de esta reserva: `verificado: true`. Sin eso, la
 * confirmación es «llegó a la página de gracias»: casi siempre es que pagó,
 * pero antes de dar el acceso conviene mirarlo en Stripe. En el CRM sale
 * como «Pago por comprobar» hasta que Stripe lo confirma (aquí o por el
 * webhook, /api/stripe/webhook).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9]{20}$/;

/** ¿Stripe dice que esa sesión está pagada y es de esta reserva? null = no se puede saber. */
async function verificarConStripe(sesion: string, reserva: string): Promise<boolean | null> {
  const clave = process.env.STRIPE_SECRET_KEY;
  if (!clave || !SESION.test(sesion)) return null;
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sesion}`, { headers: { Authorization: `Bearer ${clave}` }, cache: 'no-store' });
    if (!r.ok) return false;
    const j = (await r.json()) as { payment_status?: string; client_reference_id?: string | null };
    return j.payment_status === 'paid' && j.client_reference_id === reserva;
  } catch {
    return null;
  }
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  let c: Record<string, unknown>;
  try {
    c = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const id = String(c.id ?? '');
  const sesion = String(c.s ?? '').slice(0, 220);
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const db = baseDeDatos();
  const ref = db.collection(COLECCION_RESERVAS).doc(id);
  const d = await ref.get();
  if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  const v = d.data()!;
  if (v.pagoVerificado === true || (v.pagoConfirmado === true && !SESION.test(sesion))) return NextResponse.json({ ok: true, confirmado: true, verificado: v.pagoVerificado === true });

  const creada = v.creada instanceof Timestamp ? v.creada.toMillis() : 0;
  if (!creada || Date.now() - creada > HORAS_PARA_CONFIRMAR * 3600e3) return NextResponse.json({ ok: false, motivo: 'caducada' }, { status: 410 });

  const verificado = await verificarConStripe(sesion, id);
  // Stripe dice claramente que NO: no se confirma.
  if (verificado === false) return NextResponse.json({ ok: false, motivo: 'sin-pago' }, { status: 402 });

  await aplicarPago(id, { verificado: verificado === true, sesion, por: verificado ? 'stripe' : 'pagina-gracias' });
  return NextResponse.json({ ok: true, confirmado: true, verificado: verificado === true });
}
