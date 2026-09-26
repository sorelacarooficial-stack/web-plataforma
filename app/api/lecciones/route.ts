import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual } from '@/lib/sesion-servidor';
import { clave, idDeYoutube, puedeVerla, type Leccion } from '@/lib/aula';
import { revisarAccesos, type Acceso } from '@/lib/accesos';

/**
 * Las clases del aula.
 *
 *   GET    → las que le toca ver a quien pregunta
 *   POST   → añadir una (solo Sorela)
 *   PATCH  → cambiarla, publicarla o esconderla (solo Sorela)
 *   DELETE → quitarla (solo Sorela)
 *
 * LO MÁS IMPORTANTE DE ESTE FICHERO está en el GET: el filtro de quién ve qué
 * se hace AQUÍ, en el servidor, y no mandando todas las clases para que la
 * pantalla esconda las que no tocan. Pintar de menos no es proteger: quien
 * abriera la pestaña de red vería el identificador del vídeo de todos los
 * cursos, y con ese identificador el vídeo se abre en YouTube sin pasar por
 * aquí. Lo que no le toca a alguien no sale de este servidor.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Un título largo cabe; una parrafada, no. */
const MAX_TITULO = 140;
const MAX_DESCRIPCION = 600;

const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** Mismo motivo que en las demás rutas: la barra es separador en Firestore. */
function idValido(id: string): boolean {
  return id.length > 0 && id.length <= 200 && !id.includes('/') && id !== '.' && id !== '..';
}

async function exigirSorela() {
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (sesion.rol !== 'sorela') {
    return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  }
  return { sesion };
}

/** A quién va dirigida una clase, revisado. Reutiliza el revisor de accesos. */
function revisarPara(crudo: unknown): Acceso | null {
  const [uno] = revisarAccesos([crudo]);
  return uno ?? null;
}

/** Una clase tal y como sale de Firestore. */
function aLeccion(id: string, v: Record<string, unknown>): Leccion {
  return {
    id,
    titulo: (v.titulo as string) ?? '',
    descripcion: (v.descripcion as string) ?? '',
    video: (v.video as string) ?? '',
    para: (revisarPara(v.para) ?? { tipo: 'membresia' }) as Acceso,
    orden: typeof v.orden === 'number' ? v.orden : 0,
    publicada: v.publicada !== false,
    creado: (v.creado as { toDate?: () => Date })?.toDate?.().toISOString() ?? null,
  };
}

export async function GET() {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });

  /* Se piden ordenadas por `orden` y no por fecha: una clase se puede añadir
     tarde y tener que ir la primera. El índice de un solo campo lo trae
     Firestore de serie, así que esto no pide crear nada a mano. */
  const lista = await baseDeDatos()
    .collection(COLECCIONES.lecciones)
    .orderBy('orden', 'asc')
    .limit(500)
    .get();

  const todas = lista.docs.map((d) => aLeccion(d.id, d.data()));
  const esSorela = sesion.rol === 'sorela';

  if (esSorela) {
    // Ella las ve todas, publicadas o no: es quien las prepara.
    return NextResponse.json({
      ok: true,
      lecciones: todas,
      esSorela: true,
      /* Y los cursos que ya existen, para que el desplegable los ofrezca en
         vez de obligarla a escribirlos otra vez. Es lo que evita que el mismo
         curso acabe escrito de dos maneras: si eso pasa, sus alumnas se
         quedan sin ver las clases y nada lo delata. */
      cursos: await cursosConocidos(),
    });
  }

  /* Y aquí el filtro de verdad. Dos condiciones, las dos necesarias:
     que esté publicada y que le toque por lo que tiene contratado. */
  const accesos = await accesosDe(sesion.uid);
  const suyas = todas.filter((l) => l.publicada && puedeVerla(l.para, accesos));

  return NextResponse.json({ ok: true, lecciones: suyas, esSorela: false });
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirSorela();
  if (guardia.error) return guardia.error;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: {} }, { status: 400 });
  }

  const titulo = recortar(cuerpo.titulo, MAX_TITULO);
  const descripcion = recortar(cuerpo.descripcion, MAX_DESCRIPCION);
  const para = revisarPara(cuerpo.para);
  /* El enlace llega como Sorela lo haya copiado y aquí se queda solo el
     identificador. Ver lib/aula.ts: YouTube reparte cinco formas distintas de
     la misma dirección y pedirle que las distinga sería pedirle que sepa algo
     que no tiene por qué saber. */
  const video = idDeYoutube(String(cuerpo.video ?? ''));

  const errores: Record<string, string> = {};
  if (titulo.length < 2) errores.titulo = 'Ponle un título a la clase.';
  if (!video) errores.video = 'Pega el enlace del vídeo de YouTube. No reconozco ese.';
  if (!para) errores.para = 'Di a quién va dirigida.';
  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
  }

  /* El orden, si no se dice, va al final de SU bloque. Se cuenta dentro del
     bloque y no en toda la colección para que añadir una clase a un curso no
     mueva de sitio las de otro. */
  const orden =
    typeof cuerpo.orden === 'number' && Number.isFinite(cuerpo.orden)
      ? cuerpo.orden
      : await siguienteOrden(para as Acceso);

  const ref = await baseDeDatos()
    .collection(COLECCIONES.lecciones)
    .add({
      titulo,
      descripcion,
      video,
      para,
      orden,
      // Nace escondida: así se puede montar un curso entero y abrirlo cuando
      // esté, en vez de que las alumnas vean aparecer las clases a medias.
      publicada: cuerpo.publicada === true,
      creado: FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ ok: true, id: ref.id, video });
}

/**
 * Los nombres de curso que ya se han usado, sin repetir.
 *
 * Salen de dos sitios porque en los dos los escribe ella: de los accesos de
 * las personas dadas de alta y de las clases que ya existen. Si solo se
 * miraran las clases, el primer curso del que todavía no hay ninguna no
 * saldría en el desplegable y habría que escribirlo a mano justo cuando más
 * fácil es equivocarse.
 */
async function cursosConocidos(): Promise<string[]> {
  const nombres = new Map<string, string>();
  const anotar = (n: unknown) => {
    const nombre = String(n ?? '').trim();
    if (nombre && !nombres.has(clave(nombre))) nombres.set(clave(nombre), nombre);
  };

  try {
    const [usuarios, lecciones] = await Promise.all([
      baseDeDatos().collection(COLECCIONES.usuarios).limit(500).get(),
      baseDeDatos().collection(COLECCIONES.lecciones).limit(500).get(),
    ]);
    for (const d of usuarios.docs) {
      for (const a of revisarAccesos(d.data().accesos)) if (a.tipo === 'curso') anotar(a.nombre);
    }
    for (const d of lecciones.docs) {
      const para = d.data().para;
      if (para?.tipo === 'curso') anotar(para.nombre);
    }
  } catch (e) {
    // Sin la lista, el desplegable se queda con la opción de escribirlo a
    // mano. Es peor, pero no impide trabajar.
    console.error('[lecciones] No se han podido leer los cursos:', e);
  }

  return [...nombres.values()].sort((a, z) => a.localeCompare(z, 'es'));
}

/** Qué número de orden le toca a una clase nueva dentro de su bloque. */
async function siguienteOrden(para: Acceso): Promise<number> {
  try {
    const mismas = await baseDeDatos()
      .collection(COLECCIONES.lecciones)
      .where('para.tipo', '==', para.tipo)
      .get();

    const delBloque = mismas.docs.filter((d) => {
      if (para.tipo === 'membresia') return true;
      return (d.data().para?.nombre ?? '') === para.nombre;
    });

    return delBloque.length === 0
      ? 1
      : Math.max(...delBloque.map((d) => (typeof d.data().orden === 'number' ? d.data().orden : 0))) + 1;
  } catch (e) {
    // Que falle la cuenta no puede impedir guardar la clase: se pone al final
    // del todo con un número alto y Sorela lo coloca si le molesta.
    console.error('[lecciones] No se ha podido calcular el orden:', e);
    return Date.now() % 100000;
  }
}

export async function PATCH(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirSorela();
  if (guardia.error) return guardia.error;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const id = recortar(cuerpo.id, 200);
  if (!idValido(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  /* Solo se toca lo que venga. Sin esta distinción, publicar una clase —que
     manda únicamente `publicada`— le borraría el título y el vídeo. */
  const cambios: Record<string, unknown> = {};
  const errores: Record<string, string> = {};

  if (cuerpo.titulo !== undefined) {
    const titulo = recortar(cuerpo.titulo, MAX_TITULO);
    if (titulo.length < 2) errores.titulo = 'Ponle un título a la clase.';
    else cambios.titulo = titulo;
  }
  if (cuerpo.descripcion !== undefined) cambios.descripcion = recortar(cuerpo.descripcion, MAX_DESCRIPCION);
  if (cuerpo.video !== undefined) {
    const video = idDeYoutube(String(cuerpo.video));
    if (!video) errores.video = 'No reconozco ese enlace de YouTube.';
    else cambios.video = video;
  }
  if (cuerpo.para !== undefined) {
    const para = revisarPara(cuerpo.para);
    if (!para) errores.para = 'Di a quién va dirigida.';
    else cambios.para = para;
  }
  if (typeof cuerpo.publicada === 'boolean') cambios.publicada = cuerpo.publicada;
  if (typeof cuerpo.orden === 'number' && Number.isFinite(cuerpo.orden)) cambios.orden = cuerpo.orden;

  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
  }
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ ok: false, motivo: 'sin-cambios' }, { status: 400 });
  }

  try {
    // update() y no set(merge): si la clase ya no existe, esto falla en vez de
    // crear una a medias que nadie entiende de dónde ha salido.
    await baseDeDatos().collection(COLECCIONES.lecciones).doc(id).update(cambios);
  } catch {
    return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirSorela();
  if (guardia.error) return guardia.error;

  const id = recortar(new URL(peticion.url).searchParams.get('id'), 200);
  if (!idValido(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  /* Se borra la clase, NO el vídeo: ese sigue en YouTube y hay que quitarlo
     desde allí si se quiere que desaparezca. La pantalla lo dice antes de
     pulsar, para que nadie crea que borrando aquí se borra allí. */
  await baseDeDatos().collection(COLECCIONES.lecciones).doc(id).delete();

  return NextResponse.json({ ok: true, id });
}
