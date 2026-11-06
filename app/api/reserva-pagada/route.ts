import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { normalizarTelefono } from '@/lib/captacion';
import { CIUDADES_PAGO, FORMACIONES_PAGO } from '@/lib/reserva';

/**
 * Los datos que deja cada alumna en /reserva/gracias después de pagar.
 *
 *   POST { nombre, whatsapp, correo, formacion, ciudad?, pago? } → { ok }
 *
 * Se guarda en `reservas_pagadas` (una por envío) y en su contacto del CRM.
 * Ojo: esto NO prueba que haya pagado; `pago` es el número de Stripe que trae
 * el enlace, para cruzarlo en Stripe antes de dar la plaza por cerrada.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORREO = /^[^\s@]+@[^\s@,]+\.[a-z]{2,}$/i;
const PAGO = /^cs_[A-Za-z0-9_]{10,200}$/;
const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** Freno por IP en memoria: no es seguridad, es que un script no llene la base. */
const HUELLAS = new Map<string, number[]>();
function vaDemasiadoRapido(ip: string) {
  const ahora = Date.now();
  const previas = (HUELLAS.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  previas.push(ahora);
  HUELLAS.set(ip, previas);
  if (HUELLAS.size > 500) for (const [k, m] of HUELLAS) if (m.every((t) => ahora - t >= 60_000)) HUELLAS.delete(k);
  return previas.length > 5;
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
  // Señuelo para robots: se les dice que sí y no se guarda nada.
  if (c.empresa) return NextResponse.json({ ok: true });

  const nombre = recortar(c.nombre, 80);
  const correo = recortar(c.correo, 120).toLowerCase();
  const whatsapp = normalizarTelefono(recortar(c.whatsapp, 32));
  const formacion = FORMACIONES_PAGO.find((f) => f.id === c.formacion);
  const ciudad = CIUDADES_PAGO.find((x) => x === c.ciudad) ?? null;
  const pago = PAGO.test(recortar(c.pago, 220)) ? recortar(c.pago, 220) : null;

  const errores: Record<string, string> = {};
  if (nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
  if (!whatsapp) errores.whatsapp = 'Escribe tu WhatsApp con el prefijo del país.';
  if (!CORREO.test(correo)) errores.correo = 'Revisa el correo.';
  if (!formacion) errores.formacion = 'Elige qué has pagado.';
  if (formacion?.presencial && !ciudad) errores.ciudad = 'Elige tu ciudad.';
  if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });

  const db = baseDeDatos();
  const datos = {
    nombre,
    correo,
    whatsapp,
    formacion: formacion!.id,
    formacionNombre: formacion!.nombre,
    ciudad: formacion!.presencial ? ciudad : null,
    pago,
    revisado: false,
    creado: FieldValue.serverTimestamp(),
  };
  await db.collection('reservas_pagadas').add(datos);

  const ref = db.collection(COLECCIONES.contactos).doc(correo.replace(/\//g, '_'));
  const previo = await ref.get();
  await ref.set(
    {
      correo,
      nombre: previo.data()?.nombre || nombre,
      whatsapp,
      reservaPagada: { formacion: datos.formacion, ciudad: datos.ciudad, pago, cuando: FieldValue.serverTimestamp() },
      actualizado: FieldValue.serverTimestamp(),
      ...(previo.exists ? {} : { origen: 'reserva-pagada', estado: 'Nuevo', veces: 1, creado: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );
  return NextResponse.json({ ok: true });
}
