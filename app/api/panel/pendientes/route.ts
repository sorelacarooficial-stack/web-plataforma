import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { revisarAccesos, tieneMembresia } from '@/lib/accesos';
import { aConvocatoria, coleccion as coleccionConvocatorias } from '@/lib/convocatorias';
import { hoyISO } from '@/lib/convocatorias-tipos';
import { COLECCION_CORREOS } from '@/lib/correos';
import { hayBuzon, sinLeer } from '@/lib/buzon';
import type { Vista } from '@/lib/plataforma';
import { situacion, textoMotivo, type DatosAtencion } from '@/lib/atencion';
import { contextoAtencion } from '@/lib/atencion-servidor';

/**
 * Lo que Sorela tiene pendiente, para su inicio.
 *
 *   GET → { responder: [...], hacer: [...] }
 *
 * Dos listas: lo que espera una respuesta suya (correos sin leer, contactos
 * sin atender, quien pide la Comunidad, dudas sin contestar) y lo que tiene
 * que hacer (dar accesos, cobrar, poner el enlace de Zoom, revisar correos que
 * han rebotado, lo de hoy en la agenda). Cada cosa dice adónde ir.
 *
 * Solo lee. Cada fuente va por su lado: si una falla (el buzón tarda, falta
 * un índice), las demás salen igual.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Pendiente = {
  id: string;
  titulo: string;
  detalle: string;
  ir: Vista;
  urgente?: boolean;
};

const DIA = 86400000;
const quien = (nombre: unknown, correo: unknown) =>
  String(nombre || '').trim() || String(correo || '').split('@')[0] || 'Alguien';
const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const fechaDe = (v: unknown): Date | null => (v as { toDate?: () => Date })?.toDate?.() ?? null;
/** «Ana, Marta, Lucía y 2 más». */
const nombres = (lista: string[], max = 3) =>
  lista.length <= max ? lista.join(', ') : `${lista.slice(0, max).join(', ')} y ${lista.length - max} más`;
const diaMadrid = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
const horaMadrid = (d: Date) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(d);
const diasConv = (inicio: string, fin: string) => {
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', o);
  const ultimo = f(fin, { day: 'numeric', month: 'short' });
  return inicio === fin ? ultimo : `${f(inicio, { day: 'numeric' })}–${ultimo}`;
};

/** Que el buzón no bloquee el inicio: si tarda más de esto, se deja fuera. */
function conTope<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error('tarda')), ms))]);
}

export async function GET() {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });

  const db = baseDeDatos();
  const ahora = Date.now();
  const hoy = hoyISO();
  const responder: Pendiente[] = [];
  const hacer: Pendiente[] = [];

  const fuentes = await Promise.allSettled([
    /* 0 */ hayBuzon() ? conTope(sinLeer(3), 8000) : Promise.resolve(null),
    /* 1 */ db.collection(COLECCIONES.contactos).get(),
    /* 2 */ db.collection(COLECCIONES.usuarios).get(),
    /* 3 */ db.collection('comunidad_posts').where('creado', '>', Timestamp.fromMillis(ahora - 21 * DIA)).orderBy('creado', 'desc').limit(60).get(),
    /* 4 */ coleccionConvocatorias().get(),
    /* 5 */ db.collection(COLECCIONES.invitaciones).orderBy('creado', 'desc').limit(80).get(),
    /* 6 */ db.collection('campanas').where('estado', '==', 'programada').get(),
    /* 7 */ db.collection(COLECCION_CORREOS).where('cuando', '>', Timestamp.fromMillis(ahora - 7 * DIA)).orderBy('cuando', 'desc').limit(400).get(),
    /* 8 */ db
      .collection(COLECCIONES.usuarios)
      .doc(sesion.uid)
      .collection(COLECCIONES.agenda)
      .where('cuando', '>=', Timestamp.fromMillis(ahora))
      .where('cuando', '<=', Timestamp.fromMillis(ahora + DIA))
      .orderBy('cuando', 'asc')
      .limit(20)
      .get(),
  ]);
  const valor = <T,>(i: number) => {
    const f = fuentes[i];
    if (f.status === 'fulfilled') return f.value as T;
    console.error('[pendientes] fuente', i, f.reason);
    return null;
  };

  /* ------------------------------------------------- por responder */

  const buzon = valor<Awaited<ReturnType<typeof sinLeer>> | null>(0);
  if (buzon && buzon.total > 0) {
    const ultimo = buzon.ultimos[0];
    responder.push({
      id: 'buzon',
      titulo: plural(buzon.total, 'correo sin leer', 'correos sin leer'),
      detalle: ultimo ? `El último, de ${ultimo.de.nombre || ultimo.de.correo}: «${ultimo.asunto.slice(0, 70)}»` : 'En hola@sorelacarodivine.com',
      ir: 'buzon',
      urgente: true,
    });
  }

  /* Solo quien te necesita de verdad (lib/atencion.ts): te escribió, preguntó,
     pidió plaza, la formación o una cita. Las apuntadas a la masterclass no
     cuentan: van solas con los correos y el grupo. Antes entraba todo lo que
     estaba en «Nuevo» y salían 157 «sin atender» que no esperaban nada. */
  const contactos = valor<FirebaseFirestore.QuerySnapshot>(1);
  const ctx = contactos ? await contextoAtencion(db).catch(() => null) : null;
  if (contactos && ctx) {
    const sinAtender = contactos.docs
      .map((d) => d.data())
      .map((v) => ({ v, s: situacion(v as DatosAtencion, ctx(v.correo)) }))
      .filter(({ s }) => s.grupo === 'te-necesita')
      .map(({ v, s }) => ({
        nombre: quien(v.nombre, v.correo),
        porque: textoMotivo(s)?.corto ?? 'Te necesita',
        dias: Math.floor((ahora - (s.desde ? new Date(s.desde).getTime() : fechaDe(v.creado)?.getTime() ?? ahora)) / DIA),
      }))
      .sort((a, b) => b.dias - a.dias);
    if (sinAtender.length) {
      const viejo = sinAtender[0];
      responder.push({
        id: 'contactos',
        titulo: plural(sinAtender.length, 'persona te necesita', 'personas te necesitan'),
        detalle:
          viejo.dias >= 1
            ? `${primerNombre(viejo.nombre)}: ${viejo.porque.toLowerCase()} hace ${plural(viejo.dias, 'día', 'días')}`
            : nombres(sinAtender.map((x) => `${primerNombre(x.nombre)} (${x.porque.toLowerCase()})`)),
        ir: 'leads',
        urgente: viejo.dias >= 2,
      });
    }
  }

  const usuarios = valor<FirebaseFirestore.QuerySnapshot>(2);
  if (usuarios) {
    const fichas = usuarios.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string });
    const quieren = fichas.filter((v) => v.quiereComunidad && !v.bloqueada && !tieneMembresia(revisarAccesos(v.accesos)));
    if (quieren.length) {
      responder.push({
        id: 'quieren',
        titulo: plural(quieren.length, 'alumna quiere entrar en la Comunidad', 'alumnas quieren entrar en la Comunidad'),
        detalle: nombres(quieren.map((v) => primerNombre(quien(v.nombre, v.correo)))),
        ir: 'cuentas',
      });
    }
    const esperando = fichas.filter((v) => v.altaPor === 'registro' && !v.bloqueada && revisarAccesos(v.accesos).length === 0);
    if (esperando.length) {
      hacer.push({
        id: 'esperando',
        titulo: plural(esperando.length, 'cuenta esperando acceso', 'cuentas esperando acceso'),
        detalle: `Se registraron solas: ${nombres(esperando.map((v) => primerNombre(quien(v.nombre, v.correo))))}`,
        ir: 'cuentas',
      });
    }
  }

  const posts = valor<FirebaseFirestore.QuerySnapshot>(3);
  if (posts) {
    const sinRespuesta = posts.docs
      .map((d) => d.data())
      .filter((v) => v.autor !== sesion.uid && !(Number(v.respuestas) > 0));
    if (sinRespuesta.length) {
      const dudas = sinRespuesta.filter((v) => v.categoria === 'Duda').length;
      responder.push({
        id: 'comunidad',
        titulo: dudas
          ? plural(dudas, 'duda sin responder en la comunidad', 'dudas sin responder en la comunidad')
          : plural(sinRespuesta.length, 'publicación sin respuesta', 'publicaciones sin respuesta'),
        detalle: `«${String(sinRespuesta[0].titulo ?? '').slice(0, 70)}»`,
        ir: 'comunidad',
        urgente: dudas > 0,
      });
    }
  }

  /* ---------------------------------------------------- por hacer */

  const agenda = valor<FirebaseFirestore.QuerySnapshot>(8);
  if (agenda) {
    const deHoy = agenda.docs
      .map((d) => d.data())
      .filter((v) => (!v.estado || v.estado === 'Pendiente') && fechaDe(v.cuando) && diaMadrid(fechaDe(v.cuando)!) === diaMadrid(new Date(ahora)));
    if (deHoy.length) {
      hacer.push({
        id: 'agenda',
        titulo: `Hoy en tu agenda: ${plural(deHoy.length, 'cosa', 'cosas')}`,
        detalle: deHoy
          .slice(0, 2)
          .map((v) => `${horaMadrid(fechaDe(v.cuando)!)} ${String(v.titulo || 'Sin título').slice(0, 40)}`)
          .join(' · '),
        ir: 'agenda',
      });
    }
  }

  const convs = valor<FirebaseFirestore.QuerySnapshot>(4);
  if (convs) {
    const proximas = convs.docs
      .map((d) => ({ c: aConvocatoria(d.id, d.data()), crudo: d.data() }))
      .filter(({ c }) => c.fin >= hoy)
      .sort((a, b) => a.c.inicio.localeCompare(b.c.inicio));
    const sinAcceso: string[] = [];
    const sinPagar: string[] = [];
    for (const { c, crudo } of proximas) {
      const donde = `${c.ciudad} ${diasConv(c.inicio, c.fin)}`;
      const faltan = c.inscritas.filter((i) => {
        if (i.acceso.estado === 'sin-crear') return true;
        // Un enlace que ya caducó sin usarse es como no tenerlo.
        const a = (crudo.inscritas?.[i.id]?.acceso ?? null) as { tipo?: string; caduca?: string } | null;
        return a?.tipo === 'enlace' && a.caduca && new Date(a.caduca).getTime() < ahora;
      });
      if (faltan.length) sinAcceso.push(`${donde}: ${nombres(faltan.map((i) => primerNombre(i.nombre)))}`);
      const deben = c.inscritas.filter((i) => i.estado !== 'pagado');
      if (deben.length) sinPagar.push(`${donde}: ${nombres(deben.map((i) => `${primerNombre(i.nombre)} (${i.estado === 'senal' ? 'abono' : 'sin pagar'})`), 2)}`);
    }
    if (sinAcceso.length) {
      const n = sinAcceso.reduce((s, x) => s + (x.split(':')[1].split(',').length), 0);
      hacer.push({
        id: 'sin-acceso',
        titulo: n === 1 ? 'Una apuntada sin acceso al curso' : 'Apuntadas sin acceso al curso',
        detalle: sinAcceso.join(' · '),
        ir: 'cuentas',
        urgente: true,
      });
    }
    if (sinPagar.length) {
      hacer.push({
        id: 'sin-pagar',
        titulo: 'Pagos pendientes de la formación',
        detalle: sinPagar.join(' · '),
        ir: 'formaciones',
      });
    }
  }

  const invitaciones = valor<FirebaseFirestore.QuerySnapshot>(5);
  if (invitaciones) {
    const caducan = invitaciones.docs
      .map((d) => d.data())
      .filter((v) => {
        const fin = fechaDe(v.caduca)?.getTime() ?? 0;
        return !v.usada && !v.anulada && fin > ahora && fin - ahora < 5 * DIA;
      });
    if (caducan.length) {
      hacer.push({
        id: 'caducan',
        titulo: plural(caducan.length, 'enlace de acceso caduca pronto sin usar', 'enlaces de acceso caducan pronto sin usar'),
        detalle: `Recuérdaselo a ${nombres(caducan.map((v) => primerNombre(quien(v.nombre, v.correo))))}`,
        ir: 'cuentas',
      });
    }
  }

  const campanas = valor<FirebaseFirestore.QuerySnapshot>(6);
  if (campanas) {
    const tope = diaMadrid(new Date(ahora + 7 * DIA));
    const sinEnlace = campanas.docs
      .map((d) => d.data())
      .filter((v) => v.boton?.texto && !/^https?:\/\/\S+$/.test(String(v.boton.enlace ?? '')))
      .filter((v) => String(v.fecha ?? '') >= hoy && String(v.fecha ?? '') <= tope);
    if (sinEnlace.length) {
      hacer.push({
        id: 'campanas',
        titulo: plural(sinEnlace.length, 'correo programado sin enlace', 'correos programados sin enlace'),
        detalle: `«${String(sinEnlace[0].asunto ?? '').slice(0, 60)}» sale el ${String(sinEnlace[0].fecha)}: ponle el enlace del botón`,
        ir: 'correos',
        urgente: true,
      });
    }
  }

  const correos = valor<FirebaseFirestore.QuerySnapshot>(7);
  if (correos) {
    const mal = correos.docs
      .map((d) => d.data())
      .filter((v) => v.estado === 'fallido' || v.entrega === 'rebotado' || v.entrega === 'spam');
    if (mal.length) {
      hacer.push({
        id: 'correos',
        titulo: plural(mal.length, 'correo no ha llegado', 'correos no han llegado'),
        detalle: `Esta semana. ${nombres([...new Set(mal.map((v) => String(v.para ?? '')))].filter(Boolean), 2)}`,
        ir: 'correos',
      });
    }
  }

  return NextResponse.json(
    { ok: true, responder, hacer, buzon: hayBuzon() ? (buzon ? 'ok' : 'sin-respuesta') : 'sin-configurar' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
