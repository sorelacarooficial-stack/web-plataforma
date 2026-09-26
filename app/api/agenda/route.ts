import { NextResponse } from 'next/server';
import { FieldValue, Timestamp, type Query } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * La agenda de cada persona: todo lo que tiene apuntado, en un solo sitio.
 *
 *   GET    → lo que viene por delante, de lo más cercano a lo más lejano
 *   POST   → apuntar algo nuevo
 *   PATCH  → cambiar un evento, o darlo por hecho o por cancelado
 *   DELETE → borrarlo
 *
 * Cada una ve la suya y solo la suya, Sorela incluida. Eso no se consigue
 * filtrando por un campo `de` sino guardando cada agenda en su sitio:
 * `usuarios/{uid}/agenda`. La diferencia importa. Con un campo hay que
 * acordarse de filtrar en las cuatro operaciones, y el día que a una se le
 * olvide, una terapeuta ve las clientas de otra. Colgándola de la persona, el
 * aislamiento no depende de acordarse: a la agenda de otra no se llega porque
 * no se puede escribir su ruta sin tener su identificador, que no sale de la
 * cookie de nadie más.
 *
 * De paso evita un índice compuesto —filtrar por dueña Y ordenar por fecha lo
 * habría pedido— que habría que crear a mano en la consola de Google, y hasta
 * entonces la agenda contestaría con un error que nadie sabría interpretar.
 *
 * El campo `cuando` se guarda como Timestamp de Firestore y NO como texto. Con
 * texto ISO el orden alfabético coincidiría con el cronológico solo mientras
 * todas las fechas llevaran el mismo formato y la misma zona; en cuanto una
 * entrara de otra manera, la lista se desordenaría sin avisar.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Qué clase de cita es. Lo que Sorela hace en una semana, en seis palabras. */
export const TIPOS_EVENTO = [
  'Sesión',
  'Formación',
  'Clase en vivo',
  'Llamada',
  'Reunión',
  'Personal',
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** En qué ha quedado. Lo apuntado nace pendiente. */
export const ESTADOS_EVENTO = ['Pendiente', 'Hecho', 'Cancelado'] as const;
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];

/** Los campos que pueden devolver un error de validación con su nombre. */
type Campo = 'titulo' | 'cuando' | 'duracionMin' | 'tipo' | 'estado';
type Errores = Partial<Record<Campo, string>>;

/** Una hora larga, pero la Formación Base dura una mañana entera. */
const DURACION_MAX = 12 * 60;
const DURACION_POR_DEFECTO = 60;

/**
 * Quién pregunta, y su agenda.
 *
 * Ya no se exige ser Sorela: la agenda la tiene cada persona. Lo que sí se
 * exige es tener sesión, y de esa sesión —de la cookie firmada, no de nada que
 * mande el navegador— sale el identificador con el que se construye la ruta.
 */
async function agendaDeQuienPregunta() {
  const sesion = await sesionActual();
  if (!sesion) {
    return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  }
  return {
    sesion,
    agenda: baseDeDatos()
      .collection(COLECCIONES.usuarios)
      .doc(sesion.uid)
      .collection(COLECCIONES.agenda),
  };
}

const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/**
 * Si un identificador de documento se puede usar tal cual.
 *
 * Firestore lee la barra como separador de rutas, así que el id no es un dato
 * inerte: con «a/b/c», doc() apuntaría a un documento colgado de OTRA colección
 * dentro de agenda, y con «a/b» no apunta a ningún documento y lanza una
 * excepción que, al no estar recogida, sale al navegador como un 500 con su
 * traza. Aquí solo entra Sorela, así que esto no es un agujero; es que un id
 * roto —un enlace viejo, un copiar y pegar a medias— debe contestar «datos» y
 * no una pantalla de error.
 */
function idValido(id: string): boolean {
  return id.length > 0 && id.length <= 200 && !id.includes('/') && id !== '.' && id !== '..';
}

/* ==========================================================================
   Dónde empieza «hoy»
   ========================================================================== */

const ZONA = 'Europe/Madrid';

/* hourCycle 'h23' y no hour12: false a propósito. Con hour12: false hay
   versiones de ICU que devuelven «24» para la medianoche, y entonces el
   cálculo del desfase se va un día entero. */
const RELOJ_MADRID = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Qué marca el reloj de Madrid en un instante dado, en números. */
function relojDeMadrid(instante: Date): Record<string, number> {
  const piezas: Record<string, number> = {};
  for (const parte of RELOJ_MADRID.formatToParts(instante)) {
    if (parte.type !== 'literal') piezas[parte.type] = Number(parte.value);
  }
  return piezas;
}

/**
 * Cuánto va adelantado el reloj de Madrid respecto al de UTC en ese instante.
 *
 * Se mide en vez de escribirse a mano porque España cambia de hora dos veces
 * al año: en invierno es una hora y en verano dos.
 */
function desfaseDeMadrid(instante: Date): number {
  const r = relojDeMadrid(instante);
  // Los milisegundos se tiran: el reloj formateado solo llega al segundo, y si
  // no se igualan las dos medidas el desfase sale con un resto absurdo.
  const enSegundos = Math.floor(instante.getTime() / 1000) * 1000;
  return Date.UTC(r.year, r.month - 1, r.day, r.hour, r.minute, r.second) - enSegundos;
}

/**
 * El instante en que empezó ese día en España, dándole el día en números.
 *
 * Hace falta porque el servidor de Vercel va en UTC y Sorela vive en España.
 * Si se cortara la lista por la medianoche de UTC, entre las 00:00 y las 02:00
 * de la madrugada española desaparecerían de la agenda los eventos de esa
 * misma madrugada: ya habrían quedado «antes de hoy».
 *
 * Los dos tanteos no son manía: el desfase de un instante cualquiera no tiene
 * por qué ser el de esa medianoche, y los dos domingos del año en que se cambia
 * la hora no lo es. El primer tanteo cae como mucho a una hora de la medianoche
 * buena, que es justo lo que salta España al cambiar la hora; por eso medir el
 * desfase ahí y restarlo otra vez da el instante exacto, y no hace falta un
 * tercer tanteo.
 *
 * Aquí había un Math.min entre los dos candidatos, pensado como red de
 * seguridad. No lo era: el domingo de marzo el primer tanteo se va una hora
 * antes y el mínimo se quedaba con él, así que ese día la agenda enseñaba
 * también la última hora de ayer. El segundo cálculo es correcto en los dos
 * cambios de hora y en cualquier día normal, y no tiene ese efecto.
 */
function inicioDelDia(anio: number, mes: number, dia: number): Date {
  const medianoche = Date.UTC(anio, mes - 1, dia);
  const tanteo = medianoche - desfaseDeMadrid(new Date(medianoche));
  return new Date(medianoche - desfaseDeMadrid(new Date(tanteo)));
}

/** El instante en que empezó el día de hoy en España. */
function inicioDeHoy(): Date {
  const r = relojDeMadrid(new Date());
  return inicioDelDia(r.year, r.month, r.day);
}

/**
 * Desde cuándo quiere mirar quien pregunta, escrito como `2026-08-31`.
 *
 * Lo usa el calendario: al pasar a un mes anterior necesita los eventos de ese
 * mes, que por defecto no vienen. Devuelve null si no es una fecha con forma de
 * fecha —así un parámetro roto no tumba la consulta, simplemente se ignora.
 */
function desdeCuando(crudo: string | null): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(crudo ?? '');
  if (!partes) return null;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  if (anio < 2000 || anio > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return inicioDelDia(anio, mes, dia);
}

/* ==========================================================================
   Validación
   ========================================================================== */

type Revision = { ok: true; datos: Record<string, unknown> } | { ok: false; errores: Errores };

/**
 * Revisa lo que llega y devuelve lo que se puede guardar.
 *
 * `parcial` distingue los dos usos: al crear hay que mirarlo todo, y al editar
 * solo lo que viene en la petición. Sin esa distinción, un PATCH que solo
 * quiere marcar algo como hecho se quejaría de que falta el título.
 */
function revisar(entrada: Record<string, unknown>, parcial: boolean): Revision {
  const errores: Errores = {};
  const datos: Record<string, unknown> = {};
  const toca = (campo: string) => !parcial || entrada[campo] !== undefined;

  if (toca('titulo')) {
    const titulo = recortar(entrada.titulo, 120);
    if (titulo.length < 2) errores.titulo = 'Ponle un título, aunque sea corto.';
    else datos.titulo = titulo;
  }

  if (toca('cuando')) {
    // Llega en ISO desde el navegador, que es quien sabe en qué hora vive
    // Sorela. Aquí solo se comprueba que sea una fecha de verdad.
    const fecha = new Date(recortar(entrada.cuando, 40));
    const anio = fecha.getUTCFullYear();
    if (Number.isNaN(fecha.getTime())) errores.cuando = 'Falta el día o la hora.';
    else if (anio < 2000 || anio > 2100) {
      // Un dedazo en el año —«20026» en vez de «2026»— da una fecha que para
      // JavaScript es perfectamente válida, pero que Firestore rechaza al
      // escribirla. Sin este corte, el error llegaría como un 500 sin explicar
      // en vez de como un fallo del formulario junto al campo.
      errores.cuando = 'Revisa el año de la fecha.';
    } else datos.cuando = Timestamp.fromDate(fecha);
  }

  if (toca('duracionMin')) {
    const crudo = entrada.duracionMin;
    // Un campo de formulario vacío llega como cadena vacía, no como ausente:
    // se trata igual que si no lo hubiera puesto, y vale la hora por defecto.
    const bruto = crudo === undefined || crudo === null || crudo === '' ? DURACION_POR_DEFECTO : Number(crudo);
    if (!Number.isFinite(bruto) || bruto <= 0) {
      errores.duracionMin = 'La duración son minutos: escribe un número.';
    } else {
      datos.duracionMin = Math.min(Math.round(bruto), DURACION_MAX);
    }
  }

  if (toca('tipo')) {
    const tipo = recortar(entrada.tipo, 40);
    if (!tipo) datos.tipo = TIPOS_EVENTO[0];
    else if (!(TIPOS_EVENTO as readonly string[]).includes(tipo)) errores.tipo = 'Ese tipo de evento no existe.';
    else datos.tipo = tipo;
  }

  if (toca('estado')) {
    const estado = recortar(entrada.estado, 20);
    if (!estado) datos.estado = ESTADOS_EVENTO[0];
    else if (!(ESTADOS_EVENTO as readonly string[]).includes(estado)) errores.estado = 'Ese estado no existe.';
    else datos.estado = estado;
  }

  // Texto libre: se recorta y se guarda tal cual, incluso vacío, para que
  // borrar un lugar o una nota al editar funcione de verdad.
  if (toca('conQuien')) datos.conQuien = recortar(entrada.conQuien, 80);
  if (toca('telefono')) datos.telefono = recortar(entrada.telefono, 32);
  if (toca('lugar')) datos.lugar = recortar(entrada.lugar, 120);
  if (toca('nota')) datos.nota = recortar(entrada.nota, 800);

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos };
}

/* ==========================================================================
   Los métodos
   ========================================================================== */

export async function GET(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await agendaDeQuienPregunta();
  if (guardia.error) return guardia.error;

  const parametros = new URL(peticion.url).searchParams;
  const todos = parametros.get('todos') === '1';

  /* Dónde empieza lo que se devuelve. Por defecto, hoy. El calendario puede
     pedir que empiece antes con `desde`, pero NUNCA después: adelantar el corte
     escondería lo de hoy y lo de la semana que viene, y los tres contadores de
     la pantalla —que se calculan sobre esta misma lista— dejarían de cuadrar
     solo por estar mirando el calendario de diciembre. */
  const hoy = inicioDeHoy();
  const pedido = desdeCuando(parametros.get('desde'));
  const corte = pedido && pedido.getTime() < hoy.getTime() ? pedido : hoy;

  let consulta: Query = guardia.agenda;
  if (!todos) {
    // El filtro y la ordenación caen sobre el MISMO campo, así que a Firestore
    // le basta con su índice automático: esto no pide crear ningún índice
    // compuesto a mano en la consola.
    consulta = consulta.where('cuando', '>=', Timestamp.fromDate(corte));
  }

  const lista = await consulta.orderBy('cuando', 'asc').limit(500).get();

  const eventos = lista.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      titulo: v.titulo ?? '',
      // Un Timestamp no sobrevive a JSON.stringify de forma legible: viaja
      // como texto ISO y el navegador lo pinta en la hora de quien mira.
      cuando: v.cuando?.toDate?.().toISOString() ?? null,
      duracionMin: typeof v.duracionMin === 'number' ? v.duracionMin : DURACION_POR_DEFECTO,
      tipo: (v.tipo as TipoEvento) ?? TIPOS_EVENTO[0],
      lugar: v.lugar ?? '',
      nota: v.nota ?? '',
      conQuien: v.conQuien ?? '',
      telefono: v.telefono ?? '',
      estado: (v.estado as EstadoEvento) ?? 'Pendiente',
      creado: v.creado?.toDate?.().toISOString() ?? null,
    };
  });

  return NextResponse.json({ ok: true, eventos, total: eventos.length });
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await agendaDeQuienPregunta();
  if (guardia.error) return guardia.error;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: {} }, { status: 400 });
  }

  const revision = revisar(cuerpo, false);
  if (!revision.ok) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: revision.errores }, { status: 400 });
  }

  const ref = await guardia.agenda
    .add({
      ...revision.datos,
      // La hora de creación la pone el servidor de Google. `cuando` no: esa es
      // la que ha elegido quien apunta, y viene de su navegador.
      creado: FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ ok: true, id: ref.id });
}

export async function PATCH(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await agendaDeQuienPregunta();
  if (guardia.error) return guardia.error;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: {} }, { status: 400 });
  }

  const id = recortar(cuerpo.id, 200);
  if (!idValido(id)) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: {} }, { status: 400 });
  }

  const revision = revisar(cuerpo, true);
  if (!revision.ok) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: revision.errores }, { status: 400 });
  }
  if (Object.keys(revision.datos).length === 0) {
    return NextResponse.json({ ok: false, motivo: 'sin-cambios' }, { status: 400 });
  }

  try {
    // update() y no set(..., { merge: true }): si el evento ya no existe
    // —porque se acaba de borrar en otra pestaña—, esto falla en vez de
    // resucitarlo como un documento a medias sin título ni fecha.
    await guardia.agenda.doc(id).update({ ...revision.datos, actualizado: FieldValue.serverTimestamp() });
  } catch {
    return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await agendaDeQuienPregunta();
  if (guardia.error) return guardia.error;

  const id = recortar(new URL(peticion.url).searchParams.get('id'), 200);
  if (!idValido(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  // Borrar algo que ya no está no es un error para Firestore, y aquí tampoco:
  // si se pulsa dos veces seguidas, el resultado es el mismo y no hay susto.
  await guardia.agenda.doc(id).delete();

  return NextResponse.json({ ok: true, id });
}
