import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { enviarAcuerdo } from '@/lib/enviar-acuerdo';

/**
 * Sorela aprueba un acuerdo firmado: queda «aprobado» y a la alumna le llega
 * su dossier. Hasta aquí, firmar no daba acceso a nada.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_peticion: Request, { params }: { params: Promise<{ ref: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });

  const ref = (await params).ref.toUpperCase();
  if (!/^DIV-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const doc = baseDeDatos().collection('acuerdos').doc(ref);
  const d = await doc.get();
  if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  if (d.get('estado') === 'anulado') return NextResponse.json({ ok: false, motivo: 'anulado' }, { status: 409 });

  await doc.update({ estado: 'aprobado', aprobadoEl: FieldValue.serverTimestamp(), aprobadoPor: sesion.uid });
  const resultado = await enviarAcuerdo(ref, 'aprobado');
  return NextResponse.json({ ok: resultado.enviado, ...resultado });
}
