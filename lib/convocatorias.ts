import 'server-only';
import { cache } from 'react';
import { revalidatePath } from 'next/cache';
import { baseDeDatos, hayFirebase } from './firebase-servidor';
import { normalizarTelefono } from './captacion';
import { ID_SORELA, IMAGEN_COMPARTIR, REF_NEGOCIO, absoluta, type Nodo } from './sitio';
import {
  CURSOS_CONVOCABLES,
  CURSO_POR_DEFECTO,
  ESTADOS_PAGO,
  HORA,
  MONEDAS,
  cursoDe,
  diasEntre,
  estadoPlazas,
  fechaValida,
  hoyISO,
  rangoFechas,
  type AccesoInscrita,
  type Convocatoria,
  type ConvocatoriaPublica,
  type EstadoPago,
  type Inscrita,
  type Jornada,
  type Moneda,
} from './convocatorias-tipos';

/**
 * Las convocatorias, del lado del servidor: leerlas de Firestore, revisar lo
 * que llega de la pantalla de Sorela y sacar lo poco que va a la web.
 *
 * Viven en la colección `convocatorias`, un documento por convocatoria, con
 * sus inscritas DENTRO, en un mapa por id (`inscritas.<id>`). Se ha elegido
 * así y no una subcolección por tres motivos:
 *
 *   · La pantalla lee todo de una vez, sin una consulta por convocatoria.
 *   · Cada inscrita se cambia con su propia ruta de campo, así que editar a
 *     Marta en el móvil y a Rocío en el ordenador a la vez no se pisa.
 *   · Las plazas ocupadas (`ocupadas`) se recalculan en la misma transacción
 *     que añade o quita a alguien, y la web solo necesita ese número.
 *
 * Las reglas de Firestore están cerradas a todo lo que venga de un navegador
 * (firestore.rules): esto solo se lee y se escribe desde aquí, con el SDK de
 * administración. Un grupo de formación son decenas de personas, muy lejos
 * del mega que admite un documento.
 */

export const COLECCION_CONVOCATORIAS = 'convocatorias';

export const coleccion = () => baseDeDatos().collection(COLECCION_CONVOCATORIAS);

/** Un id que se puede usar como documento o como ruta de campo sin sorpresas. */
export const ID = /^[A-Za-z0-9_-]{1,64}$/;

type Datos = FirebaseFirestore.DocumentData;

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const entero = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);

function iso(v: unknown): string | null {
  if (typeof v === 'string') return v;
  const d = (v as { toDate?: () => Date } | null)?.toDate?.();
  return d ? d.toISOString() : null;
}

/* ==========================================================================
   De Firestore a la pantalla
   ========================================================================== */

/** Cómo está guardado el acceso al curso que se le creó a una inscrita. */
export type AccesoGuardado =
  | { tipo: 'enlace'; codigo: string; creado: string; caduca: string }
  | { tipo: 'cuenta'; uid: string; en: string };

/** Lo guardado, sin fiarse de la forma. */
export function accesoGuardado(v: unknown): AccesoGuardado | null {
  const a = v as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return null;
  if (a.tipo === 'enlace' && typeof a.codigo === 'string') {
    return { tipo: 'enlace', codigo: a.codigo, creado: texto(a.creado, 40), caduca: texto(a.caduca, 40) };
  }
  if (a.tipo === 'cuenta' && typeof a.uid === 'string') return { tipo: 'cuenta', uid: a.uid, en: texto(a.en, 40) };
  return null;
}

/** Sin nada que mirar en las invitaciones: lo que se sabe solo con lo guardado. */
export function accesoSinMirar(a: AccesoGuardado | null): AccesoInscrita {
  if (!a) return { estado: 'sin-crear', enlace: null, caduca: null, desde: null };
  if (a.tipo === 'cuenta') return { estado: 'ya-tiene-cuenta', enlace: null, caduca: null, desde: a.en || null };
  return { estado: 'enlace-sin-usar', enlace: null, caduca: a.caduca || null, desde: a.creado || null };
}

function aInscrita(id: string, v: Datos, acceso: (a: AccesoGuardado | null) => AccesoInscrita): Inscrita {
  const estado = ESTADOS_PAGO.includes(v.estado) ? (v.estado as EstadoPago) : 'pendiente';
  return {
    id,
    nombre: texto(v.nombre, 80),
    correo: texto(v.correo, 160),
    telefono: texto(v.telefono, 32),
    pagado: Math.max(entero(v.pagado) ?? 0, 0),
    estado,
    nota: texto(v.nota, 500),
    contacto: typeof v.contacto === 'string' ? v.contacto : null,
    creada: texto(v.creada, 40),
    acceso: acceso(accesoGuardado(v.acceso)),
  };
}

function horarioDe(v: unknown, inicio: string, fin: string): Record<string, Jornada> {
  const salida: Record<string, Jornada> = {};
  if (!v || typeof v !== 'object') return salida;
  for (const dia of diasEntre(inicio, fin)) {
    const j = (v as Record<string, { desde?: unknown; hasta?: unknown }>)[dia];
    const desde = texto(j?.desde, 5);
    const hasta = texto(j?.hasta, 5);
    if (HORA.test(desde) && HORA.test(hasta)) salida[dia] = { desde, hasta };
  }
  return salida;
}

/**
 * Del documento a la convocatoria entera, con sus inscritas en el orden en
 * que se apuntaron. `acceso` dice en qué punto está el acceso al curso de cada
 * una; por defecto, lo que se sabe sin mirar las invitaciones.
 */
export function aConvocatoria(
  id: string,
  v: Datos,
  acceso: (a: AccesoGuardado | null) => AccesoInscrita = accesoSinMirar
): Convocatoria {
  const inicio = texto(v.inicio, 10);
  const fin = texto(v.fin, 10) || inicio;
  const mapa = v.inscritas && typeof v.inscritas === 'object' ? (v.inscritas as Record<string, Datos>) : {};
  const inscritas = Object.entries(mapa)
    .filter(([iid, x]) => ID.test(iid) && x && typeof x === 'object')
    .map(([iid, x]) => aInscrita(iid, x, acceso))
    .sort((a, b) => a.creada.localeCompare(b.creada) || a.nombre.localeCompare(b.nombre, 'es'));
  return {
    id,
    curso: cursoDe(v.curso).id,
    inicio,
    fin,
    horario: horarioDe(v.horario, inicio, fin),
    ciudad: texto(v.ciudad, 80),
    lugar: texto(v.lugar, 160),
    plazas: entero(v.plazas),
    precio: entero(v.precio),
    moneda: MONEDAS.includes(v.moneda) ? (v.moneda as Moneda) : 'EUR',
    abierta: v.abierta !== false,
    publicada: v.publicada === true,
    inscritas,
    creada: iso(v.creada),
    actualizada: iso(v.actualizada),
  };
}

/* ==========================================================================
   Revisar lo que llega de la pantalla
   ========================================================================== */

export type Errores = Record<string, string>;
type Revision<T> = { ok: true; datos: T } | { ok: false; errores: Errores };

/** Lo que se guarda de una convocatoria (sin sus inscritas, que van aparte). */
export type DatosConvocatoria = {
  curso: string;
  inicio: string;
  fin: string;
  horario: Record<string, Jornada>;
  ciudad: string;
  lugar: string;
  plazas: number | null;
  precio: number | null;
  moneda: Moneda;
  abierta: boolean;
  publicada: boolean;
};

/**
 * Un número entero dentro de un rango, o `null` si viene vacío. «Por definir»
 * es una respuesta válida para las plazas y el precio: Sorela puede abrir la
 * convocatoria antes de cerrarlos.
 */
function opcional(v: unknown, min: number, max: number): number | null | 'mal' {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number.NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : 'mal';
}

export function revisarConvocatoria(e: Record<string, unknown>): Revision<DatosConvocatoria> {
  const errores: Errores = {};
  const curso = CURSOS_CONVOCABLES.some((c) => c.id === e.curso) ? String(e.curso) : CURSO_POR_DEFECTO.id;

  const inicio = texto(e.inicio, 10);
  const fin = texto(e.fin, 10) || inicio;
  if (!fechaValida(inicio)) errores.inicio = 'Elige el primer día.';
  if (!fechaValida(fin)) errores.fin = 'Elige el último día.';
  else if (fechaValida(inicio) && fin < inicio) errores.fin = 'El último día no puede ir antes del primero.';
  else if (fechaValida(inicio) && diasEntre(inicio, fin).length >= 31 && diasEntre(inicio, fin).at(-1) !== fin) {
    errores.fin = 'Como mucho, un mes entre el primer día y el último.';
  }

  const ciudad = texto(e.ciudad, 80);
  if (ciudad.length < 2) errores.ciudad = 'Escribe la ciudad.';
  const lugar = texto(e.lugar, 160);

  const plazas = opcional(e.plazas, 1, 500);
  if (plazas === 'mal') errores.plazas = 'Entre 1 y 500 plazas, o déjalo en blanco si aún no lo sabes.';
  const precio = opcional(e.precio, 0, 10_000_000_000);
  if (precio === 'mal') errores.precio = 'Ese precio no lo entiendo. Escríbelo con números: 1.450 o 1.450,50.';
  const moneda = MONEDAS.includes(e.moneda as Moneda) ? (e.moneda as Moneda) : 'EUR';

  /* El horario es opcional y por día. Un día a medias (solo la hora de
     empezar) se avisa en vez de tirarlo sin decir nada. */
  const horario: Record<string, Jornada> = {};
  const crudo = e.horario && typeof e.horario === 'object' ? (e.horario as Record<string, { desde?: unknown; hasta?: unknown }>) : {};
  for (const dia of diasEntre(inicio, fin)) {
    const desde = texto(crudo[dia]?.desde, 5);
    const hasta = texto(crudo[dia]?.hasta, 5);
    if (!desde && !hasta) continue;
    if (!HORA.test(desde) || !HORA.test(hasta)) errores[`horario.${dia}`] = 'Pon la hora de empezar y la de acabar, o ninguna.';
    else if (hasta <= desde) errores[`horario.${dia}`] = 'La hora de acabar tiene que ir después de la de empezar.';
    else horario[dia] = { desde, hasta };
  }

  if (Object.keys(errores).length) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      curso,
      inicio,
      fin,
      horario,
      ciudad,
      lugar,
      plazas: plazas as number | null,
      precio: precio as number | null,
      moneda,
      abierta: e.abierta !== false,
      publicada: e.publicada === true,
    },
  };
}

export type DatosInscrita = {
  nombre: string;
  correo: string;
  telefono: string;
  pagado: number;
  estado: EstadoPago;
  nota: string;
  contacto: string | null;
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Una inscrita. Solo el nombre es obligatorio: en una feria o por teléfono se
 * apunta a alguien con lo que dé, y el correo o el móvil se completan luego.
 * Si se escriben, tienen que tener forma de correo y de móvil.
 *
 * `contacto` es el id de la ficha del CRM de la que salió, si se eligió de ahí.
 * Se guarda para saber de dónde vino; la ficha del CRM no se toca nunca.
 */
export function revisarInscrita(e: Record<string, unknown>): Revision<DatosInscrita> {
  const errores: Errores = {};
  const nombre = texto(e.nombre, 80);
  if (nombre.length < 2) errores.nombre = 'Escribe su nombre.';
  const correo = texto(e.correo, 160).toLowerCase();
  if (correo && !CORREO.test(correo)) errores.correo = 'Ese correo no parece correcto.';
  const crudo = texto(e.telefono, 32);
  const telefono = crudo ? normalizarTelefono(crudo) : '';
  if (telefono === null) errores.telefono = 'Escribe el móvil, con prefijo si es de fuera de España.';
  const pagado = opcional(e.pagado, 0, 10_000_000_000);
  if (pagado === 'mal') errores.pagado = 'Ese importe no lo entiendo. Escríbelo con números: 500 o 500,50.';
  const estado = ESTADOS_PAGO.includes(e.estado as EstadoPago) ? (e.estado as EstadoPago) : 'pendiente';
  const nota = texto(e.nota, 500);
  const contacto = typeof e.contacto === 'string' && e.contacto.length <= 200 && !e.contacto.includes('/') ? e.contacto : null;
  if (Object.keys(errores).length) return { ok: false, errores };
  return { ok: true, datos: { nombre, correo, telefono: telefono || '', pagado: (pagado as number | null) ?? 0, estado, nota, contacto } };
}

/* ==========================================================================
   La web
   ========================================================================== */

/**
 * Lo que dice /formaciones: las convocatorias marcadas para la web que todavía
 * no han empezado, la más cercana primero.
 *
 * Se piden SOLO los campos que hacen falta (`select`): las inscritas, sus
 * pagos y el precio no llegan ni a la memoria de la página pública, así que
 * no hay forma de que se cuelen en el HTML por un descuido.
 *
 * Igual que las fichas del mapa (lib/fichas-publicas.ts): sin credenciales
 * —al compilar en local— devuelve una lista vacía y la página sale como si no
 * hubiera fechas; si Firestore falla al compilar, también vacía. Pero si falla
 * en producción LANZA: con ISR, una regeneración que lanza deja servir la
 * última página buena, y una que devuelve vacío se guardaría como buena y
 * haría desaparecer las fechas por un fallo pasajero.
 */
export const proximasPublicas = cache(async (): Promise<ConvocatoriaPublica[]> => {
  if (!hayFirebase()) return [];
  try {
    const l = await coleccion()
      .where('publicada', '==', true)
      .select('curso', 'inicio', 'fin', 'horario', 'ciudad', 'plazas', 'ocupadas', 'abierta')
      .get();
    const hoy = hoyISO();
    return l.docs
      .map((d) => {
        const v = d.data();
        const inicio = texto(v.inicio, 10);
        const fin = texto(v.fin, 10) || inicio;
        const ciudad = texto(v.ciudad, 80);
        const curso = cursoDe(v.curso);
        if (!fechaValida(inicio) || !ciudad) return null;
        return {
          id: d.id,
          curso: curso.nombre,
          modalidad: curso.modalidad,
          ancla: curso.ancla,
          inicio,
          fin: fechaValida(fin) ? fin : inicio,
          horario: horarioDe(v.horario, inicio, fin),
          ciudad,
          plazas: estadoPlazas(entero(v.plazas), Math.max(entero(v.ocupadas) ?? 0, 0), v.abierta !== false),
        } satisfies ConvocatoriaPublica;
      })
      .filter((c): c is ConvocatoriaPublica => c !== null && c.inicio >= hoy)
      .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.ciudad.localeCompare(b.ciudad, 'es'));
  } catch (e) {
    console.error('[convocatorias] no se han podido leer las fechas públicas', e);
    if (process.env.NEXT_PHASE === 'phase-production-build') return [];
    throw e;
  }
});

/** El curso de /formaciones al que cuelgan las convocatorias, como lo describe la página. */
export type CursoDeLaPagina = { nombre: string; descripcion: string; requisitos?: string };

/**
 * Los datos estructurados de las convocatorias publicadas.
 *
 * Cada convocatoria es a la vez un EducationEvent (lo que Google entiende como
 * evento con fecha y lugar) y un CourseInstance (una edición de un curso). Y el
 * curso del que cuelgan se declara AQUÍ entero, con `hasCourseInstance`, y no
 * en components/DatosEstructurados: un mismo `@id` descrito en dos bloques
 * distintos Google no siempre lo junta, y se quedaría con uno de los dos.
 * La página, cuando hay convocatorias, le quita ese curso a su bloque.
 *
 * Lo que NO va, a propósito: `offers` (no hay precio público), el número de
 * plazas y el lugar exacto. Un dato estructurado tiene que decir lo mismo que
 * se ve, y en la página solo se ve la ciudad, las fechas y si quedan sitios.
 */
export function nodosConvocatorias(lista: ConvocatoriaPublica[], cursos: Record<string, CursoDeLaPagina>): Nodo[] {
  if (lista.length === 0) return [];
  const pagina = absoluta('/formaciones');
  const sorela: Nodo = { '@type': 'Person', '@id': ID_SORELA, name: 'Sorela Caro' };
  const nodos: Nodo[] = [];
  const porCurso = new Map<string, Nodo[]>();

  for (const c of lista) {
    const curso = cursos[c.ancla];
    const nombre = `${curso?.nombre ?? c.curso} en ${c.ciudad}`;
    const instancia: Nodo = {
      '@type': ['EducationEvent', 'CourseInstance'],
      '@id': `${pagina}#convocatoria-${c.id}`,
      name: nombre,
      description: `${curso?.descripcion ?? c.modalidad} En ${c.ciudad}, ${rangoFechas(c.inicio, c.fin)}.`,
      startDate: c.inicio,
      endDate: c.fin,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      courseMode: 'onsite',
      inLanguage: 'es',
      url: `${pagina}#proximas-fechas`,
      image: [absoluta(IMAGEN_COMPARTIR.url)],
      location: {
        '@type': 'Place',
        name: c.ciudad,
        address: { '@type': 'PostalAddress', addressLocality: c.ciudad },
      },
      organizer: REF_NEGOCIO,
      performer: sorela,
      instructor: sorela,
    };
    nodos.push(instancia);
    porCurso.set(c.ancla, [...(porCurso.get(c.ancla) ?? []), { '@id': instancia['@id'] }]);
  }

  for (const [ancla, instancias] of porCurso) {
    const curso = cursos[ancla];
    if (!curso) continue;
    nodos.unshift({
      '@type': 'Course',
      '@id': `${pagina}#curso-${ancla}`,
      url: pagina,
      name: curso.nombre,
      description: curso.descripcion,
      inLanguage: 'es',
      provider: REF_NEGOCIO,
      author: sorela,
      ...(curso.requisitos ? { coursePrerequisites: curso.requisitos } : {}),
      hasCourseInstance: instancias,
    });
  }
  return nodos;
}

/**
 * Avisa a la web de que /formaciones ha cambiado. Se llama tras cualquier
 * cambio, también en las inscritas: apuntar a alguien puede convertir «Quedan
 * plazas» en «Últimas plazas». Rehacer la página en la siguiente visita es
 * barato; enseñar «Quedan plazas» de un grupo lleno, no.
 */
export function refrescarFormaciones() {
  try {
    revalidatePath('/formaciones');
    // La portada también enseña las próximas fechas.
    revalidatePath('/');
  } catch (e) {
    console.error('[convocatorias] no se ha podido refrescar /formaciones', e);
  }
}
