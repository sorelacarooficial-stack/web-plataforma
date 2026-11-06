import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { normalizarTelefono } from '@/lib/captacion';
import { REVISADA } from '@/lib/privacidad';
import { COLECCION_RESERVAS, OPCIONES, ciudadDe, formacionDe, urlPago } from '@/lib/reserva';

/**
 * Paso 1 de /reserva: la alumna deja sus datos ANTES de pagar.
 *
 *   POST { opcion, nombre, whatsapp, correo, consentimiento } → { ok, id, url }
 *
 * Se guarda la reserva en `reservas_web/{id}` con `pagoConfirmado: false` y
 * en su contacto del CRM, y se devuelve el enlace de Stripe de su plan con la
 * reserva dentro (`client_reference_id`). La confirmación llega al volver de
 * Stripe, desde /reserva/gracias (ver ./confirmar).
 *
 * Quien deja los datos y no paga queda igual en el CRM: es a quien hay que
 * escribir para ayudarla a terminar.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORREO = /^[^\s@]+@[^\s@,]+\.[a-z]{2,}$/i;
const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** Freno por IP en memoria: no es seguridad, es que un script no llene la base. */
const HUELLAS = new Map<string, number[]>();
function vaDemasiadoRapido(ip: string) {
  const ahora = Date.now();
  const previas = (HUELLAS.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  previas.push(ahora);
  HUELLAS.set(ip, previas);
  if (HUELLAS.size > 500) for (const [k, m] of HUELLAS) if (m.every((t) => ahora - t >= 60_000)) HUELLAS.delete(k);
  return previas.length > 6;
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const ip = peticion.headers.get('x-forwarded-for')?.split(',')[0].trim() || peticion.headers.get('x-real-ip') || 'desconocida';
  if (vaDemasiadoRapido(ip)) return NextResponse.json({ ok: false, motivo: 'ritmo' }, { status: 429 });

  let c: Record<string, unknown>;
  try {
    c = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  if (c.empresa) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const opcion = OPCIONES.find((o) => o.id === c.opcion);
  const nombre = recortar(c.nombre, 80);
  const correo = recortar(c.correo, 120).toLowerCase();
  const whatsapp = normalizarTelefono(recortar(c.whatsapp, 32));

  const errores: Record<string, string> = {};
  if (!opcion) errores.opcion = 'Elige tu formación.';
  if (nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
  if (!whatsapp) errores.whatsapp = 'Escribe tu WhatsApp con el prefijo del país.';
  if (!CORREO.test(correo)) errores.correo = 'Revisa el correo.';
  if (c.consentimiento !== true) errores.consentimiento = 'Para seguir, marca la casilla.';
  if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });

  const db = baseDeDatos();
  const ref = db.collection(COLECCION_RESERVAS).doc();
  const url = urlPago(opcion!, ref.id, correo);
  const contactoId = correo.replace(/\//g, '_');
  const reserva = {
    opcion: opcion!.id,
    formacion: formacionDe(opcion!),
    titulo: opcion!.titulo,
    ciudad: ciudadDe(opcion!),
    reservaUSD: opcion!.reserva || opcion!.precio || 0,
  };
  await ref.set({
    ...reserva,
    nombre,
    correo,
    whatsapp,
    contacto: contactoId,
    pagoConfirmado: false,
    // La prueba de lo que aceptó (art. 7.1 RGPD): qué versión de la política y en qué formulario.
    consentimiento: { version: REVISADA, formulario: 'reserva', en: FieldValue.serverTimestamp() },
    creada: FieldValue.serverTimestamp(),
  });

  const cref = db.collection(COLECCIONES.contactos).doc(contactoId);
  const previo = await cref.get();
  await cref.set(
    {
      correo,
      nombre: previo.data()?.nombre || nombre,
      whatsapp,
      ...(reserva.ciudad ? { ciudad: reserva.ciudad } : {}),
      reserva: { id: ref.id, ...reserva, pagoConfirmado: false, cuando: FieldValue.serverTimestamp() },
      actualizado: FieldValue.serverTimestamp(),
      ...(previo.exists ? {} : { origen: 'reserva-web', estado: 'Nuevo', veces: 1, creado: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );
  return NextResponse.json({ ok: true, id: ref.id, url });
}
