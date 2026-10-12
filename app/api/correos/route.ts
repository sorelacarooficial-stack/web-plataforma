import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { AUTOMATIZACIONES, ID_AUTOMATIZACIONES, type IdAutomatizacion } from '@/lib/automatizaciones';
import {
  COLECCION_CORREOS,
  automatizacionesActivas,
  correoDeSorela,
  mandarCorreo,
  viaDeEnvio,
} from '@/lib/correos';
import { datosResumen, listaDeEspera, tareasDelDia } from '@/lib/automatizar';
import { correoBienvenida } from '@/lib/plantillas-correo';
import {
  correoAccesoComunidad,
  correoAccesoFormacion,
  correoInvitacion,
  correoRegistro,
  correoResumen,
  type Plantilla,
} from '@/lib/plantillas-automaticas';

/**
 * La pantalla Correos (solo Sorela).
 *
 *   GET                 → cómo se envía, qué está encendido, próximos envíos e historial
 *   GET ?para=correo    → solo el historial de esa persona (para la ficha del CRM)
 *   GET ?ver=id         → la vista previa de un correo, en HTML
 *   PATCH { id, activa }→ encender o apagar una automatización
 *   POST  { accion: 'prueba', id } → mandarle a Sorela ese correo de muestra
 *   POST  { accion: 'ejecutar' }   → hacer ahora lo del cron de la mañana (avisos incluidos)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function exigirAdmin() {
  if (!hayFirebase()) return { error: NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 }) };
  const s = await sesionActual();
  if (!s) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (s.rol !== 'sorela') return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  return { sesion: s };
}

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';

/** Cada correo con datos de muestra, para verlo antes de encenderlo. */
async function muestra(id: IdAutomatizacion): Promise<Plantilla | null> {
  const ejemplo = 'tu-correo@ejemplo.com';
  switch (id) {
    case 'bienvenida': {
      const b = correoBienvenida({ nombre: 'María López', correo: ejemplo });
      return { asunto: b.asunto, texto: b.texto, html: b.html };
    }
    case 'acceso-formacion':
      return correoAccesoFormacion('María López');
    case 'acceso-comunidad':
      return correoAccesoComunidad('María López');
    case 'invitacion':
      return correoInvitacion({
        nombre: 'María López',
        enlace: `${WEB}/registro?invitacion=EJEMPLO`,
        que: ['Formación Técnica Divine'],
        caduca: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      });
    case 'registro':
      return correoRegistro('María López', 'comunidad');
    case 'acuerdo':
      // Lo escribe el Apps Script con el PDF del acuerdo: aquí no hay vista previa.
      return null;
    case 'resumen-sorela': {
      const d = await datosResumen().catch(() => ({ sinAtender: [], esperando: [] }));
      return correoResumen(
        d.sinAtender.length + d.esperando.length
          ? d
          : { sinAtender: [{ nombre: 'María López', dias: 3, como: 'Lista de espera de la comunidad (desde Instagram)' }], esperando: [] }
      );
    }
  }
}

const esId = (x: unknown): x is IdAutomatizacion => ID_AUTOMATIZACIONES.includes(x as IdAutomatizacion);

export async function GET(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const q = new URL(peticion.url).searchParams;

  const ver = q.get('ver');
  if (ver) {
    if (!esId(ver)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
    const m = await muestra(ver);
    if (!m) return NextResponse.json({ ok: false, motivo: 'sin-vista' }, { status: 404 });
    return NextResponse.json({ ok: true, asunto: m.asunto, html: m.html });
  }

  const col = baseDeDatos().collection(COLECCION_CORREOS);
  const aFila = (d: FirebaseFirestore.QueryDocumentSnapshot) => {
    const v = d.data();
    return {
      id: d.id,
      para: v.para ?? '',
      tipo: v.tipo ?? 'manual',
      asunto: v.asunto ?? '',
      estado: v.estado ?? 'enviado',
      via: v.via ?? null,
      detalle: v.detalle ?? null,
      cuando: v.cuando?.toDate?.().toISOString() ?? null,
    };
  };

  const para = q.get('para');
  if (para) {
    const r = await col.where('para', '==', para.toLowerCase().slice(0, 200)).limit(50).get();
    const historial = r.docs.map(aFila).sort((a, b) => (b.cuando ?? '').localeCompare(a.cuando ?? ''));
    return NextResponse.json({ ok: true, historial });
  }

  const [historial, activas, espera] = await Promise.all([
    col.orderBy('cuando', 'desc').limit(150).get(),
    automatizacionesActivas(),
    listaDeEspera().catch(() => []),
  ]);
  return NextResponse.json({
    ok: true,
    via: viaDeEnvio(),
    correoSorela: correoDeSorela(),
    activas,
    automatizaciones: AUTOMATIZACIONES,
    listaEspera: espera.length,
    historial: historial.docs.map(aFila),
  });
}

export async function PATCH(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = (await peticion.json().catch(() => ({}))) as { id?: unknown; activa?: unknown };
  if (!esId(c.id) || typeof c.activa !== 'boolean') {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  if (AUTOMATIZACIONES.find((a) => a.id === c.id && 'fijo' in a && a.fijo)) {
    return NextResponse.json({ ok: false, motivo: 'fijo' }, { status: 409 });
  }
  await baseDeDatos()
    .collection('ajustes')
    .doc('correos')
    .set({ activas: { [c.id]: c.activa }, cambiado: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true, id: c.id, activa: c.activa });
}

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = (await peticion.json().catch(() => ({}))) as { accion?: unknown; id?: unknown };

  if (c.accion === 'ejecutar') {
    const informe = await tareasDelDia();
    return NextResponse.json({ ok: true, ...informe });
  }

  if (c.accion === 'prueba') {
    if (!esId(c.id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
    const para = g.sesion.correo || correoDeSorela();
    if (!para) return NextResponse.json({ ok: false, motivo: 'sin-correo' }, { status: 400 });
    const m = await muestra(c.id);
    if (!m) return NextResponse.json({ ok: false, motivo: 'sin-vista' }, { status: 400 });
    const r = await mandarCorreo({ para, asunto: `[Prueba] ${m.asunto}`, texto: m.texto, html: m.html }, { tipo: 'prueba' });
    return NextResponse.json({ ok: r.estado === 'enviado', ...r, para });
  }

  return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
}
