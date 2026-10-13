import { NextResponse } from 'next/server';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { accesosDe, sesionActual } from '@/lib/sesion-servidor';
import { TOPE_VIDEO, carpetaDeClase, clave, esVideoPropio, puedeVerla, tieneElCurso, type Leccion } from '@/lib/aula';
import { almacen, borrarArchivosDeClase, firmarPortada } from '@/lib/aula-almacen';
import { revisarAccesos, type Acceso } from '@/lib/accesos';

/**
 * Las clases del aula.
 *
 *   GET    → las que le toca ver a quien pregunta
 *   POST   → guardar una cuyo vídeo ya está subido (solo Sorela; multipart)
 *   PATCH  → cambiarla, publicarla o esconderla (solo Sorela)
 *   DELETE → borrarla, con su vídeo y su portada (solo Sorela)
 *
 * El vídeo se sube antes y por otro camino (ver ./subida): aquí solo llega la
 * información de la clase y su portada, que pesan poco.
 *
 * LO MÁS IMPORTANTE DE ESTE FICHERO está en el GET: el filtro de quién ve qué
 * se hace AQUÍ, en el servidor, y no mandando todas las clases para que la
 * pantalla esconda las que no tocan. Pintar de menos no es proteger: quien
 * abriera la pestaña de red vería las clases de todos los cursos (y de las
 * antiguas, el identificador con el que el vídeo se abre en YouTube sin pasar
 * por aquí). Lo que no le toca a alguien no sale de este servidor; tampoco su
 * portada, que se firma solo para las clases que sí le tocan.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Un título largo cabe; una parrafada, no. */
const MAX_TITULO = 140;
const MAX_DESCRIPCION = 600;
const MAX_MODULO = 80;
/** Los identificadores que reparte Firestore: letras y números. */
const ID_NUEVA = /^[A-Za-z0-9]{10,40}$/;

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
    capitulos: Array.isArray(v.capitulos)
      ? (v.capitulos as { t?: unknown; titulo?: unknown }[])
          .map((c) => ({ t: Number(c?.t) || 0, titulo: String(c?.titulo ?? '').slice(0, 120) }))
          .filter((c) => c.titulo)
          .sort((a, z) => a.t - z.t)
      : [],
    duracion: typeof v.duracion === 'number' ? v.duracion : undefined,
    modulo: typeof v.modulo === 'string' && v.modulo ? v.modulo : undefined,
    // Las primeras clases llevan la portada como imagen en texto; las subidas
    // aquí, una ruta del almacén (`portadaRuta`) que se firma al mandarla.
    portada: typeof v.portada === 'string' ? v.portada : undefined,
    tamano: typeof v.tamano === 'number' ? v.tamano : undefined,
  };
}

/** Las clases con su portada lista para pintar. Firmar es local (no llama a nadie). */
async function conPortadas(docs: QueryDocumentSnapshot[]): Promise<Leccion[]> {
  return Promise.all(
    docs.map(async (d) => {
      const l = aLeccion(d.id, d.data());
      const ruta = d.get('portadaRuta');
      if (typeof ruta === 'string' && ruta) l.portada = (await firmarPortada(ruta)) ?? l.portada;
      return l;
    })
  );
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

  const esSorela = sesion.rol === 'sorela';

  if (esSorela) {
    // Ella las ve todas, publicadas o no: es quien las prepara.
    return NextResponse.json({
      ok: true,
      lecciones: await conPortadas(lista.docs),
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
  /* Con el curso pero solo el abono, sus clases salen igualmente, marcadas
     como bloqueadas y SIN vídeo: ve qué le espera y se desbloquean al
     completar la parte práctica. El vídeo no se le da de ninguna forma
     (ni aquí ni en /api/lecciones/video, que sigue mirando puedeVerla). */
  const bloqueadas = new Set<string>();
  const suyas = lista.docs.filter((d) => {
    const l = aLeccion(d.id, d.data());
    if (!l.publicada) return false;
    if (puedeVerla(l.para, accesos)) return true;
    if (l.para.tipo === 'curso' && tieneElCurso(l.para.nombre, accesos)) {
      bloqueadas.add(d.id);
      return true;
    }
    return false;
  });
  /* El tamaño del archivo es cosa de Sorela, y la ruta del vídeo en el
     almacén no le sirve a la alumna para nada (el enlace lo pide por id a
     /api/lecciones/video): se queda solo la marca de «vídeo propio», para no
     enseñar cómo está organizado el almacén por dentro. */
  const lecciones = (await conPortadas(suyas)).map((l) =>
    bloqueadas.has(l.id)
      ? { ...l, tamano: undefined, video: '', bloqueada: true }
      : { ...l, tamano: undefined, video: esVideoPropio(l.video) ? 'propio:' : l.video }
  );

  return NextResponse.json({ ok: true, lecciones, esSorela: false });
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirSorela();
  if (guardia.error) return guardia.error;

  let form: FormData;
  try {
    form = await peticion.formData();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: {} }, { status: 400 });
  }
  const campo = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v : '';
  };

  const id = campo('id');
  const titulo = recortar(campo('titulo'), MAX_TITULO);
  const descripcion = recortar(campo('descripcion'), MAX_DESCRIPCION);
  const modulo = recortar(campo('modulo'), MAX_MODULO);
  let para: Acceso | null = null;
  try {
    para = revisarPara(JSON.parse(campo('para') || 'null'));
  } catch {
    para = null;
  }
  const tamano = Number(campo('tamano'));
  const duracion = Math.round(Number(campo('duracion')));

  const errores: Record<string, string> = {};
  if (!ID_NUEVA.test(id)) errores.video = 'Falta el vídeo. Elígelo y espera a que termine de subir.';
  if (titulo.length < 2) errores.titulo = 'Ponle un título a la clase.';
  if (!para) errores.para = 'Di a quién va dirigida.';
  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
  }

  /* El vídeo tiene que estar ya en su carpeta, entero. Se busca por la
     carpeta y no por un nombre que mande el navegador: así nadie puede
     colgar de una clase un archivo que no es suyo. Y se compara el tamaño
     con el que se anunció al empezar: si no cuadra, la subida no terminó
     bien y la clase no se guarda con un vídeo cortado. */
  const bucket = almacen();
  const [archivos] = await bucket.getFiles({ prefix: `${carpetaDeClase(id)}video.` });
  const archivo = archivos[0];
  if (!archivo) {
    return NextResponse.json(
      { ok: false, motivo: 'sin-video', errores: { video: 'No encuentro el vídeo subido. Quítalo y vuelve a subirlo.' } },
      { status: 409 }
    );
  }
  const medida = Number(archivo.metadata.size);
  if (!(medida > 0) || medida > TOPE_VIDEO || (Number.isFinite(tamano) && tamano > 0 && medida !== tamano)) {
    return NextResponse.json(
      { ok: false, motivo: 'video-incompleto', errores: { video: 'El vídeo no ha llegado entero. Vuelve a subirlo.' } },
      { status: 409 }
    );
  }

  const ref = baseDeDatos().collection(COLECCIONES.lecciones).doc(id);
  if ((await ref.get()).exists) return NextResponse.json({ ok: true, id, yaEstaba: true });

  /* La portada: un fotograma del vídeo que ha sacado el navegador. Se vuelve
     a pasar por sharp para que lo que se guarda sea siempre una imagen de
     verdad y de un tamaño razonable, venga lo que venga. Si no llega o no se
     puede leer, la clase se guarda igual, con su fondo. */
  let portadaRuta: string | null = null;
  const portada = form.get('portada');
  if (portada instanceof File && /^image\//.test(portada.type) && portada.size <= 4 * 1024 * 1024) {
    try {
      const webp = await sharp(Buffer.from(await portada.arrayBuffer()))
        .resize({ width: 1280, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      portadaRuta = `${carpetaDeClase(id)}portada.webp`;
      await bucket.file(portadaRuta).save(webp, { contentType: 'image/webp', metadata: { cacheControl: 'private, max-age=43200' } });
    } catch (e) {
      console.error('[lecciones] no se ha podido guardar la portada', e);
      portadaRuta = null;
    }
  }

  const orden = await siguienteOrden(para as Acceso);
  try {
    // create() y no set(): si por lo que sea ya existe, falla en vez de pisarla.
    await ref.create({
      titulo,
      descripcion,
      video: `propio:${archivo.name}`,
      para,
      orden,
      ...(modulo ? { modulo } : {}),
      ...(Number.isFinite(duracion) && duracion > 0 ? { duracion } : {}),
      tamano: medida,
      ...(portadaRuta ? { portadaRuta } : {}),
      // Nace escondida salvo que se diga: así se puede montar un curso entero
      // y abrirlo cuando esté, en vez de que las alumnas lo vean a medias.
      publicada: campo('publicada') === 'true',
      creado: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[lecciones] no se ha podido guardar la clase', e);
    return NextResponse.json({ ok: false, motivo: 'no-guardada' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
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
  /* El vídeo no se cambia desde aquí: una clase es su vídeo. Para otro
     vídeo se sube una clase nueva y se borra esta, que es lo que además
     borra el archivo viejo del almacén en vez de dejarlo huérfano. */
  if (cuerpo.modulo !== undefined) {
    const modulo = recortar(cuerpo.modulo, MAX_MODULO);
    cambios.modulo = modulo || FieldValue.delete();
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

  const ref = baseDeDatos().collection(COLECCIONES.lecciones).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ ok: true, id });
  const video = String(doc.get('video') ?? '');

  /* Primero la clase y después sus archivos. Al revés, si fallara a medias
     quedaría una clase visible con el vídeo roto; así, lo peor que puede
     pasar es un archivo sin clase, que el barrido de subidas recoge solo.
     Las clases antiguas de YouTube no tienen nada aquí: su vídeo sigue en el
     canal y se quita desde allí (la pantalla lo dice antes de borrar). */
  await ref.delete();
  const restos = await borrarArchivosDeClase(id, video);

  return NextResponse.json({ ok: true, id, restos });
}
