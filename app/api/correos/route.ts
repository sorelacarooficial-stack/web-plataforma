import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos } from '@/lib/firebase-servidor';
import { exigirAdmin } from '@/lib/permisos';
import { AUTOMATIZACIONES, ID_AUTOMATIZACIONES, type IdAutomatizacion } from '@/lib/automatizaciones';
import {
  COLECCION_CORREOS,
  DIAS_HISTORIAL,
  automatizacionesActivas,
  correoDeSorela,
  enviadosUltimos30,
  mandarCorreo,
  purgarHistorial,
  quitarDelHistorial,
  vaciarHistorial,
  viaDeEnvio,
} from '@/lib/correos';
import { datosResumen, listaDeEspera } from '@/lib/automatizar';
import { correoBienvenidaPorOrigen } from '@/lib/plantillas-bienvenida';
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
 *   DELETE ?id=…        → quitar una línea del historial
 *   DELETE ?todo=1      → vaciar el historial
 *
 * Lo de cada mañana (avisos programados y el resumen) ya no tiene botón aquí:
 * lo hace solo el cron (`app/api/cron/correos`), que además purga el
 * historial. Borrar del historial nunca hace que un correo vuelva a salir: la
 * marca de «ya enviado» se guarda aparte (ver `lib/correos.ts`).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';

/** Cada correo con datos de muestra, para verlo antes de encenderlo. */
type ModoCurso = 'precurso' | 'completo' | 'desbloqueo';
const esModo = (x: unknown): x is ModoCurso => x === 'precurso' || x === 'completo' || x === 'desbloqueo';

async function muestra(id: IdAutomatizacion, modo: ModoCurso = 'completo'): Promise<Plantilla | null> {
  const ejemplo = 'tu-correo@ejemplo.com';
  switch (id) {
    case 'bienvenida':
      return correoBienvenidaPorOrigen('María López', 'lista-comunidad');
    case 'acceso-formacion':
      // Tres versiones: con el abono, el curso entero, y cuando se abre todo al pagar.
      return correoAccesoFormacion('María López', null, modo);
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
      const d = await datosResumen().catch(() => ({ sinAtender: [], esperando: [], sinEnlace: [] }));
      return correoResumen(
        d.sinAtender.length + d.esperando.length + (d.sinEnlace?.length ?? 0)
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
    const modo = q.get('modo');
    const m = await muestra(ver, esModo(modo) ? modo : undefined);
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

  /* La purga de respaldo: por si el cron no ha corrido (en local no corre
     nunca, y en Vercel puede fallar un día). Va a la vez que la lista, y lo
     que tenga más de 30 días se quita también de la respuesta, por si la
     lista se ha leído antes de que la purga terminara. */
  const limite = new Date(Date.now() - DIAS_HISTORIAL * 86_400_000).toISOString();
  const [historial, activas, espera, enviados30] = await Promise.all([
    col.orderBy('cuando', 'desc').limit(150).get(),
    automatizacionesActivas(),
    listaDeEspera().catch(() => []),
    // La cifra de «Enviados» sale de aquí y no de las líneas que se ven: borrar una o vaciar no la baja.
    enviadosUltimos30().catch(() => null),
    purgarHistorial().catch((e) => console.error('[correos] la purga del historial ha fallado:', e)),
  ]);
  return NextResponse.json({
    ok: true,
    via: viaDeEnvio(),
    activas,
    automatizaciones: AUTOMATIZACIONES,
    listaEspera: espera.length,
    dias: DIAS_HISTORIAL,
    enviados30,
    historial: historial.docs.map(aFila).filter((f) => !f.cuando || f.cuando >= limite),
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
  const c = (await peticion.json().catch(() => ({}))) as { accion?: unknown; id?: unknown; modo?: unknown };

  if (c.accion === 'prueba') {
    if (!esId(c.id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
    const para = g.sesion.correo || correoDeSorela();
    if (!para) return NextResponse.json({ ok: false, motivo: 'sin-correo' }, { status: 400 });
    const m = await muestra(c.id, esModo(c.modo) ? c.modo : undefined);
    if (!m) return NextResponse.json({ ok: false, motivo: 'sin-vista' }, { status: 400 });
    const r = await mandarCorreo({ para, asunto: `[Prueba] ${m.asunto}`, texto: m.texto, html: m.html }, { tipo: 'prueba' });
    return NextResponse.json({ ok: r.estado === 'enviado', ...r, para });
  }

  return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
}

export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const q = new URL(peticion.url).searchParams;

  if (q.get('todo') === '1') {
    const borrados = await vaciarHistorial();
    return NextResponse.json({ ok: true, borrados });
  }

  // El id de una línea es su clave (p. ej. `acceso-formacion:uid`) o uno al azar: nunca lleva barras.
  const id = (q.get('id') ?? '').trim();
  if (!id || id.length > 300 || id.includes('/')) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  // La transacción de quitarDelHistorial la relee: si no existe (o otra petición se adelanta), borra 0.
  const borrados = await quitarDelHistorial([baseDeDatos().collection(COLECCION_CORREOS).doc(id)]);
  return NextResponse.json({ ok: true, borrados });
}
