import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { COLECCION_CAMPANAS, aCampana, cuantos, enviarCampana, listarCampanas, sembrarSerie } from '@/lib/campanas';
import { AUDIENCIAS, plantillaCampana, type Audiencia } from '@/lib/plantillas-campana';
import { correoDeSorela, enlaceBaja, mandarCorreo } from '@/lib/correos';
import { diaDe } from '@/lib/metricas';

/**
 * Avisos y correos programados (solo Sorela).
 *
 *   GET                                  → todas, y cuántas personas hay en cada grupo
 *   POST  { campana }                    → crear (borrador o programada)
 *   PATCH { id, ...campos }              → cambiar texto, grupo, fecha o estado
 *   DELETE ?id=                          → borrar una que no se ha enviado
 *   POST  { accion: 'enviar', id }       → mandarla ya
 *   POST  { accion: 'prueba', campana }  → mandarle a Sorela cómo quedaría
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

const texto = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const ID = /^[a-z0-9-]{3,60}$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Lo que llega del editor, revisado. Devuelve los errores por campo. */
function revisar(c: Record<string, unknown>, parcial = false) {
  const datos: Record<string, unknown> = {};
  const errores: Record<string, string> = {};
  const hay = (k: string) => !parcial || k in c;

  if (hay('asunto')) {
    datos.asunto = texto(c.asunto, 160).trim();
    if (!datos.asunto) errores.asunto = 'Ponle un asunto.';
  }
  if (hay('cuerpo')) {
    datos.cuerpo = texto(c.cuerpo, 12000).trim();
    if (!datos.cuerpo) errores.cuerpo = 'Escribe el texto del correo.';
  }
  if (hay('etiqueta')) datos.etiqueta = texto(c.etiqueta, 60).trim();
  if (hay('audiencia')) {
    if (!(String(c.audiencia) in AUDIENCIAS)) errores.audiencia = 'Elige a quién va.';
    else datos.audiencia = c.audiencia as Audiencia;
  }
  if (hay('fecha')) {
    datos.fecha = texto(c.fecha, 10);
    if (!DIA.test(datos.fecha as string)) errores.fecha = 'Elige el día.';
  }
  if (hay('boton')) {
    const b = (c.boton ?? null) as { texto?: unknown; enlace?: unknown } | null;
    const t = texto(b?.texto, 60).trim();
    const e = texto(b?.enlace, 400).trim();
    if (t && !/^https?:\/\/\S+$/.test(e)) errores.boton = 'El enlace del botón tiene que empezar por https://';
    datos.boton = t && e ? { texto: t, enlace: e } : null;
  }
  if (hay('estado')) {
    if (!['borrador', 'programada', 'pausada'].includes(String(c.estado))) errores.estado = 'Estado no válido.';
    else datos.estado = c.estado;
  }
  return { datos, errores };
}

export async function GET() {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  await sembrarSerie();
  const [campanas, grupos] = await Promise.all([listarCampanas(), cuantos()]);
  return NextResponse.json({ ok: true, campanas, grupos, hoy: diaDe() });
}

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = (await peticion.json().catch(() => ({}))) as Record<string, unknown>;

  if (c.accion === 'enviar') {
    const id = String(c.id ?? '');
    if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
    const r = await enviarCampana(id);
    return NextResponse.json({ ok: true, ...r });
  }

  if (c.accion === 'prueba') {
    const { datos, errores } = revisar((c.campana ?? {}) as Record<string, unknown>);
    delete errores.fecha;
    delete errores.audiencia;
    if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
    const para = g.sesion.correo || correoDeSorela();
    if (!para) return NextResponse.json({ ok: false, motivo: 'sin-correo' }, { status: 400 });
    const m = plantillaCampana(
      { etiqueta: String(datos.etiqueta ?? ''), asunto: String(datos.asunto), cuerpo: String(datos.cuerpo), boton: (datos.boton as never) ?? null },
      g.sesion.nombre,
      enlaceBaja(para)
    );
    const r = await mandarCorreo({ para, asunto: `[Prueba] ${m.asunto}`, texto: m.texto, html: m.html }, { tipo: 'prueba' });
    return NextResponse.json({ ok: r.estado === 'enviado', ...r, para });
  }

  const { datos, errores } = revisar((c.campana ?? {}) as Record<string, unknown>);
  if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
  const id = `aviso-${randomBytes(5).toString('hex')}`;
  await baseDeDatos()
    .collection(COLECCION_CAMPANAS)
    .doc(id)
    .set({ ...datos, serie: null, resultado: null, creado: FieldValue.serverTimestamp() });
  const d = await baseDeDatos().collection(COLECCION_CAMPANAS).doc(id).get();
  return NextResponse.json({ ok: true, campana: aCampana(id, d.data() ?? {}) });
}

export async function PATCH(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = (await peticion.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(c.id ?? '');
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const ref = baseDeDatos().collection(COLECCION_CAMPANAS).doc(id);
  const d = await ref.get();
  if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  if (d.get('estado') === 'enviada') return NextResponse.json({ ok: false, motivo: 'ya-enviada' }, { status: 409 });
  const { datos, errores } = revisar(c, true);
  if (Object.keys(errores).length) return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
  await ref.update({ ...datos, cambiado: FieldValue.serverTimestamp() });
  return NextResponse.json({ ok: true, campana: aCampana(id, (await ref.get()).data() ?? {}) });
}

export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const id = new URL(peticion.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const ref = baseDeDatos().collection(COLECCION_CAMPANAS).doc(id);
  const d = await ref.get();
  if (d.get('estado') === 'enviada') return NextResponse.json({ ok: false, motivo: 'ya-enviada' }, { status: 409 });
  await ref.delete();
  return NextResponse.json({ ok: true });
}
