import { NextResponse } from 'next/server';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { COLECCION_DIAS, COLECCION_VIDEOS, diaDe } from '@/lib/metricas';
import { FieldPath } from 'firebase-admin/firestore';
import { ETIQUETA_TIPO, TIPOS, origenCorto, tipoDeOrigen, type Tipo } from '@/lib/origenes';

/**
 * Las métricas para el panel de Sorela.
 *
 *   GET ?dias=7|30|90  → visitas, procedencia, dispositivos, vídeos y aula
 *
 * Suma los contadores de cada día del periodo y los del periodo anterior,
 * para poder decir «más que la semana pasada». Además cuenta cómo van las
 * alumnas en el aula, que eso no sale de la web sino de su progreso.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Mapa = Record<string, number>;
type Dia = { dia: string; vistas: number; visitas: number; personas: number; reproducciones: number; segundosVideo: number };

function sumar(destino: Mapa, origen: unknown) {
  if (!origen || typeof origen !== 'object') return;
  for (const [k, v] of Object.entries(origen as Mapa)) destino[k] = (destino[k] ?? 0) + (Number(v) || 0);
}
const ordenar = (m: Mapa, n = 12) =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

function diasHacia(atras: number, cuantos: number): string[] {
  const hoy = new Date();
  return Array.from({ length: cuantos }, (_, i) => diaDe(new Date(hoy.getTime() - (atras + cuantos - 1 - i) * 86400000)));
}

export async function GET(peticion: Request) {
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });

  const crudo = new URL(peticion.url).searchParams.get('dias');
  const todo = crudo === 'todo';
  const pedido = Number(crudo);
  const db = baseDeDatos();
  const col = db.collection(COLECCION_DIAS);

  /* «Desde el inicio»: desde el primer día que el medidor guardó algo. El id
     de cada documento es la fecha, así que el primero en orden es el primero. */
  let desdeMedidor: string | null = null;
  try {
    const primero = await col.orderBy(FieldPath.documentId()).limit(1).get();
    desdeMedidor = primero.docs[0]?.id ?? null;
  } catch {
    desdeMedidor = null;
  }
  const hoy = diaDe();
  const n = todo
    ? Math.min(730, Math.max(1, desdeMedidor ? Math.round((Date.parse(hoy) - Date.parse(desdeMedidor)) / 86400000) + 1 : 1))
    : [7, 30, 90].includes(pedido)
      ? pedido
      : 30;

  const actuales = diasHacia(0, n);
  // Antes del inicio no hay nada con qué comparar.
  const previos = todo ? [] : diasHacia(n, n);
  const docs = await db.getAll(...[...previos, ...actuales].map((d) => col.doc(d)));
  const porDia = new Map(docs.filter((d) => d.exists).map((d) => [d.id, d.data() ?? {}]));

  const serie: Dia[] = actuales.map((dia) => {
    const v = porDia.get(dia) ?? {};
    return {
      dia,
      vistas: Number(v.vistas) || 0,
      visitas: Number(v.visitas) || 0,
      personas: Number(v.personas) || 0,
      reproducciones: Number(v.reproducciones) || 0,
      segundosVideo: Number(v.segundosVideo) || 0,
    };
  });
  const total = (dias: string[]) => {
    const t = { vistas: 0, visitas: 0, personas: 0, reproducciones: 0, segundosVideo: 0 };
    for (const d of dias) {
      const v = porDia.get(d) ?? {};
      for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += Number(v[k]) || 0;
    }
    return t;
  };

  const mapas: Record<string, Mapa> = { rutas: {}, entradas: {}, origenes: {}, paises: {}, ciudades: {}, dispositivos: {}, horas: {} };
  for (const d of actuales) {
    const v = porDia.get(d);
    if (!v) continue;
    for (const k of Object.keys(mapas)) sumar(mapas[k], v[k]);
  }

  /* Vídeos de la web: totales de siempre, los más vistos primero. */
  const vids = await db.collection(COLECCION_VIDEOS).orderBy('reproducciones', 'desc').limit(40).get().catch(() => null);
  const videos = (vids?.docs ?? []).map((d) => {
    const v = d.data();
    const c = (v.cuartiles ?? {}) as Mapa;
    return {
      id: d.id,
      nombre: String(v.nombre ?? d.id),
      ruta: String(v.ruta ?? ''),
      reproducciones: Number(v.reproducciones) || 0,
      c25: Number(c['25']) || 0,
      c50: Number(c['50']) || 0,
      c75: Number(c['75']) || 0,
      c100: Number(c['100']) || 0,
      segundos: Number(v.segundos) || 0,
      duracion: Number(v.duracion) || 0,
    };
  });

  /* El aula: quién va por dónde. Sale del progreso de cada alumna. */
  let aula: unknown = null;
  try {
    const [lecciones, progreso, usuarios] = await Promise.all([
      db.collection(COLECCIONES.lecciones).get(),
      db.collectionGroup('progreso').get(),
      db.collection(COLECCIONES.usuarios).get(),
    ]);
    const publicadas = lecciones.docs.filter((d) => d.data().publicada !== false);
    const titulos = new Map(publicadas.map((d) => [d.id, String(d.data().titulo ?? d.id)]));
    const duraciones = new Map(publicadas.map((d) => [d.id, Number(d.data().duracion) || 0]));
    const gente = new Map(usuarios.docs.map((d) => [d.id, d.data()]));

    const porLeccion = new Map<string, { empezadas: number; completadas: number; segundos: number }>();
    const porAlumna = new Map<string, { completadas: number; segundos: number; ultima: string | null }>();
    for (const p of progreso.docs) {
      const uid = p.ref.parent.parent?.id;
      if (!uid || !titulos.has(p.id)) continue;
      const u = gente.get(uid);
      if (!u || u.rol === 'sorela') continue; // lo que mira Sorela no es progreso de nadie
      const v = p.data();
      const l = porLeccion.get(p.id) ?? { empezadas: 0, completadas: 0, segundos: 0 };
      l.empezadas++;
      if (v.completada) l.completadas++;
      l.segundos += Math.min(Number(v.visto) || 0, duraciones.get(p.id) || Infinity);
      porLeccion.set(p.id, l);
      const a = porAlumna.get(uid) ?? { completadas: 0, segundos: 0, ultima: null };
      if (v.completada) a.completadas++;
      a.segundos += Number(v.visto) || 0;
      const fecha = v.actualizado?.toDate?.().toISOString() ?? null;
      if (fecha && (!a.ultima || fecha > a.ultima)) a.ultima = fecha;
      porAlumna.set(uid, a);
    }
    const conAcceso = usuarios.docs.filter((d) => {
      const v = d.data();
      return v.rol !== 'sorela' && Array.isArray(v.accesos) && v.accesos.length > 0;
    });
    aula = {
      totalClases: publicadas.length,
      lecciones: publicadas.map((d) => {
        const l = porLeccion.get(d.id) ?? { empezadas: 0, completadas: 0, segundos: 0 };
        return { id: d.id, titulo: titulos.get(d.id), empezadas: l.empezadas, completadas: l.completadas, minutosMedios: l.empezadas ? Math.round(l.segundos / l.empezadas / 60) : 0 };
      }),
      alumnas: conAcceso
        .map((d) => {
          const v = d.data();
          const a = porAlumna.get(d.id) ?? { completadas: 0, segundos: 0, ultima: null };
          return {
            uid: d.id,
            nombre: String(v.nombre || v.correo || 'Sin nombre'),
            correo: String(v.correo || ''),
            completadas: a.completadas,
            minutos: Math.round(a.segundos / 60),
            ultima: a.ultima,
          };
        })
        .sort((x, y) => (y.ultima ?? '').localeCompare(x.ultima ?? '')),
    };
  } catch (e) {
    console.error('[metricas] aula', e);
  }

  return NextResponse.json(
    {
      ok: true,
      dias: n,
      todo,
      desdeMedidor,
      historia: todo ? await historia(db).catch((e) => (console.error('[metricas] historia', e), null)) : null,
      serie,
      totales: total(actuales),
      anteriores: total(previos),
      rutas: ordenar(mapas.rutas),
      entradas: ordenar(mapas.entradas),
      origenes: ordenar(mapas.origenes),
      paises: ordenar(mapas.paises, 20),
      ciudades: ordenar(mapas.ciudades, 12),
      dispositivos: ordenar(mapas.dispositivos, 3),
      horas: mapas.horas,
      videos,
      aula,
      // Para que el panel avise si está enseñando datos de pruebas.
      prueba: COLECCION_DIAS.endsWith('_prueba'),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}


/**
 * La historia de la web con lo que SÍ estaba guardado desde el principio:
 * contactos, cuentas, acuerdos y correos. Las visitas no: esas solo existen
 * desde que se instaló el medidor.
 */
async function historia(db: FirebaseFirestore.Firestore) {
  const [contactos, usuarios, acuerdos, correos] = await Promise.all([
    db.collection(COLECCIONES.contactos).get(),
    db.collection(COLECCIONES.usuarios).get(),
    db.collection('acuerdos').get(),
    db.collection('correos').where('estado', '==', 'enviado').count().get().catch(() => null),
  ]);

  const fecha = (v: FirebaseFirestore.DocumentData, campo = 'creado'): string | null => {
    const x = v[campo];
    const d = x?.toDate?.() ?? (typeof x === 'string' && x ? new Date(x) : null);
    return d && !Number.isNaN(d.getTime()) ? diaDe(d) : null;
  };
  /* La semana empieza en lunes: la clave es el lunes de cada semana. */
  const lunes = (dia: string) => {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };

  const semanas = new Map<string, { contactos: number; cuentas: number; acuerdos: number }>();
  const anotar = (dia: string | null, k: 'contactos' | 'cuentas' | 'acuerdos') => {
    if (!dia) return;
    const s = lunes(dia);
    const v = semanas.get(s) ?? { contactos: 0, cuentas: 0, acuerdos: 0 };
    v[k]++;
    semanas.set(s, v);
  };

  const porOrigen: Mapa = {};
  const porFuente: Mapa = {};
  const porTipo: Mapa = {};
  let primero: string | null = null;
  for (const d of contactos.docs) {
    const v = d.data();
    const f = fecha(v);
    anotar(f, 'contactos');
    if (f && (!primero || f < primero)) primero = f;
    const o = origenCorto(v.origen);
    porOrigen[o] = (porOrigen[o] ?? 0) + 1;
    const fu = typeof v.fuente === 'string' ? v.fuente : 'Sin dato (antes del 12 oct)';
    porFuente[fu] = (porFuente[fu] ?? 0) + 1;
    const t = ETIQUETA_TIPO[TIPOS.includes(v.tipoManual) ? (v.tipoManual as Tipo) : tipoDeOrigen(v.origen)];
    porTipo[t] = (porTipo[t] ?? 0) + 1;
  }
  const cuentas = usuarios.docs.filter((d) => d.get('rol') !== 'sorela');
  for (const d of cuentas) anotar(fecha(d.data()), 'cuentas');
  const firmados = acuerdos.docs.filter((d) => !d.get('borrado'));
  for (const d of firmados) anotar(fecha(d.data(), 'firmadoEl'), 'acuerdos');

  // Todas las semanas desde la primera, también las vacías: un hueco es un dato.
  const claves = [...semanas.keys()].sort();
  const serieSemanas: { semana: string; contactos: number; cuentas: number; acuerdos: number }[] = [];
  if (claves.length) {
    const fin = lunes(diaDe());
    for (let s = claves[0]; s <= fin; ) {
      serieSemanas.push({ semana: s, ...(semanas.get(s) ?? { contactos: 0, cuentas: 0, acuerdos: 0 }) });
      const d = new Date(`${s}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7);
      s = d.toISOString().slice(0, 10);
      if (serieSemanas.length > 120) break;
    }
  }

  return {
    primerContacto: primero,
    contactos: contactos.size,
    cuentas: cuentas.length,
    conAcceso: cuentas.filter((d) => Array.isArray(d.get('accesos')) && d.get('accesos').length > 0).length,
    acuerdos: firmados.length,
    correos: correos?.data().count ?? 0,
    semanas: serieSemanas,
    porOrigen: ordenar(porOrigen),
    porFuente: ordenar(porFuente),
    porTipo: ordenar(porTipo),
  };
}
