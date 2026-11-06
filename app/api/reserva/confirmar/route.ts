import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { COLECCION_RESERVAS, HORAS_PARA_CONFIRMAR } from '@/lib/reserva';
import { inscribirReservaPagada } from '@/lib/reserva-convocatoria';

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
 * pero antes de dar el acceso conviene mirarlo en Stripe.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9]{20}$/;
const SESION = /^cs_[A-Za-z0-9_]{10,200}$/;
const CONVOCATORIA: Record<string, string> = { Caracas: 'caracas-2026-12', Medellín: 'medellin-2026-12' };

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
  if (v.pagoConfirmado === true) return NextResponse.json({ ok: true, confirmado: true, verificado: v.pagoVerificado === true });

  const creada = v.creada instanceof Timestamp ? v.creada.toMillis() : 0;
  if (!creada || Date.now() - creada > HORAS_PARA_CONFIRMAR * 3600e3) return NextResponse.json({ ok: false, motivo: 'caducada' }, { status: 410 });

  const verificado = await verificarConStripe(sesion, id);
  // Stripe dice claramente que NO: no se confirma.
  if (verificado === false) return NextResponse.json({ ok: false, motivo: 'sin-pago' }, { status: 402 });

  const confirmacion = {
    pagoConfirmado: true,
    pagoVerificado: verificado === true,
    confirmadoPor: verificado ? 'stripe' : 'pagina-gracias',
    pagoConfirmadoEn: FieldValue.serverTimestamp(),
    ...(SESION.test(sesion) ? { pago: sesion } : {}),
  };
  await ref.update(confirmacion);
  if (typeof v.contacto === 'string' && v.contacto) {
    await db
      .collection(COLECCIONES.contactos)
      .doc(v.contacto)
      .set(
        {
          reserva: { id, pagoConfirmado: true, pagoVerificado: verificado === true, ...(SESION.test(sesion) ? { pago: sesion } : {}), confirmadaEn: FieldValue.serverTimestamp() },
          actualizado: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  // Presencial: entra en las fechas de su ciudad, para darle el acceso desde «Dar acceso».
  const conv = typeof v.ciudad === 'string' ? CONVOCATORIA[v.ciudad] : null;
  if (conv) {
    try {
      await inscribirReservaPagada(conv, {
        nombre: String(v.nombre ?? ''),
        correo: String(v.correo ?? ''),
        telefono: String(v.whatsapp ?? ''),
        contacto: String(v.contacto ?? ''),
        estado: verificado ? 'senal' : 'pendiente',
        pagado: verificado ? Number(v.reservaUSD) || 0 : 0,
        nota: verificado
          ? `Reserva pagada por Stripe (comprobado): ${v.titulo}${SESION.test(sesion) ? ` · ${sesion}` : ''}.`
          : `Volvió de Stripe a la página de gracias: ${v.titulo}. Mira el pago en Stripe antes de dar el acceso.`,
      });
    } catch (e) {
      console.error('[reserva/confirmar] convocatoria', conv, e);
    }
  }
  return NextResponse.json({ ok: true, confirmado: true, verificado: verificado === true });
}
