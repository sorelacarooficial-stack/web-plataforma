import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { CITA_MIN, horaColombia, huecosDeCita, idDeHueco } from '@/lib/citas';

/**
 * Las reuniones con Sorela.
 *
 *   GET   → { libres: ISO[], mia: { cuando } | null, enlace }
 *   POST  { cuando }  → la pide: queda en su agenda y en la de Sorela.
 *
 * Cada hueco es un documento de `citas_sorela` con el id del hueco, creado
 * con `create`: si dos alumnas piden el mismo a la vez, la segunda recibe
 * «ocupado» y elige otro. Una alumna tiene como mucho una reunión por
 * delante; para cambiarla, se lo dice a Sorela.
 *
 * El enlace de la videollamada es uno fijo: ENLACE_REUNIONES en Vercel.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CITAS = 'citas_sorela';
const enlace = () => (process.env.ENLACE_REUNIONES || '').trim();

async function miCita(uid: string) {
  const c = (await baseDeDatos().collection(COLECCIONES.usuarios).doc(uid).get()).get('citaSorela') as { cuando?: unknown } | undefined;
  return typeof c?.cuando === 'string' ? { cuando: c.cuando } : null;
}

export async function GET() {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });

  const ahora = new Date();
  const [ocupadas, mia] = await Promise.all([
    baseDeDatos().collection(CITAS).where('cuando', '>=', Timestamp.fromDate(ahora)).get(),
    miCita(sesion.uid),
  ]);
  const cogidas = new Set(ocupadas.docs.map((d) => d.id));
  const libres = huecosDeCita(ahora).filter((h) => !cogidas.has(idDeHueco(h)));
  return NextResponse.json({ ok: true, libres, mia, enlace: enlace(), minutos: CITA_MIN }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol === 'sorela') return NextResponse.json({ ok: false, motivo: 'eres-sorela' }, { status: 400 });

  const cuerpo = (await peticion.json().catch(() => null)) as { cuando?: unknown } | null;
  const cuando = typeof cuerpo?.cuando === 'string' ? cuerpo.cuando : '';
  if (!huecosDeCita().includes(cuando)) return NextResponse.json({ ok: false, motivo: 'hueco' }, { status: 400 });

  const db = baseDeDatos();
  const refUsuario = db.collection(COLECCIONES.usuarios).doc(sesion.uid);
  const ficha = await refUsuario.get();
  const ya = ficha.get('citaSorela') as { cuando?: unknown } | undefined;
  if (typeof ya?.cuando === 'string' && new Date(ya.cuando).getTime() > Date.now()) {
    return NextResponse.json({ ok: false, motivo: 'ya-tienes', mia: { cuando: ya.cuando } }, { status: 409 });
  }

  const id = idDeHueco(cuando);
  const nombre = String(ficha.get('nombre') ?? '').trim() || sesion.correo || 'Alumna';
  const instante = Timestamp.fromDate(new Date(cuando));
  try {
    await db.collection(CITAS).doc(id).create({ cuando: instante, uid: sesion.uid, nombre, correo: sesion.correo ?? '', pedida: FieldValue.serverTimestamp() });
  } catch {
    return NextResponse.json({ ok: false, motivo: 'ocupado' }, { status: 409 });
  }

  const evento = {
    cuando: instante,
    duracionMin: CITA_MIN,
    tipo: 'Reunión',
    lugar: enlace() || 'Videollamada',
    telefono: '',
    estado: 'Pendiente',
    creado: FieldValue.serverTimestamp(),
    cita: id,
  };
  const sorelas = await db.collection(COLECCIONES.usuarios).where('rol', '==', 'sorela').limit(5).get();
  const lote = db.batch();
  lote.set(refUsuario, { citaSorela: { cuando, id, pedida: FieldValue.serverTimestamp() } }, { merge: true });
  lote.set(refUsuario.collection(COLECCIONES.agenda).doc(`cita-${id}`), {
    ...evento,
    titulo: 'Reunión con Sorela',
    conQuien: 'Sorela Caro',
    nota: `Videollamada de ${CITA_MIN} minutos. ${horaColombia(cuando)} hora de Colombia.`,
  });
  for (const s of sorelas.docs) {
    lote.set(s.ref.collection(COLECCIONES.agenda).doc(`cita-${id}`), {
      ...evento,
      titulo: `Reunión con ${nombre}`,
      conQuien: nombre,
      nota: `La ha pedido ella desde la plataforma (${sesion.correo ?? 'sin correo'}). ${horaColombia(cuando)} hora de Colombia.`,
    });
  }
  await lote.commit();
  return NextResponse.json({ ok: true, mia: { cuando }, enlace: enlace() });
}
