import 'server-only';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, baseDeDatos, COLECCIONES } from './firebase-servidor';
import { carpetaDeClase, esVideoPropio } from './aula';

/**
 * Las clases en el almacén: lo que comparten las rutas de /api/lecciones.
 *
 * Cada clase subida desde la plataforma tiene su carpeta privada,
 * `privado/clases/<id>/`, con `video.<ext>` y `portada.webp`. Una carpeta por
 * clase y no un montón de archivos sueltos para que borrar una clase sea
 * borrar su carpeta, sin tener que adivinar qué archivos eran suyos.
 */

export const almacen = () =>
  getStorage(aplicacion()).bucket(process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`);

export const CARPETA_CLASES = 'privado/clases/';

/** Lo que tarda en considerarse abandonada una subida que no llegó a guardarse. */
const ABANDONADA_MS = 24 * 60 * 60 * 1000;

/* La portada se firma por «ventanas» de seis horas, empezando siempre en la
   misma hora redonda. Una firma normal cambia a cada petición (lleva la hora
   exacta en que se firmó), y entonces el navegador no reconoce la imagen que
   ya tiene y la vuelve a bajar cada vez que se abre el aula. Con la ventana,
   la dirección es la misma durante horas y la portada sale de la caché. */
const VENTANA_MS = 6 * 60 * 60 * 1000;

/** Un enlace de lectura de la portada que dura entre seis y doce horas. */
export async function firmarPortada(ruta: string): Promise<string | undefined> {
  const inicio = Math.floor(Date.now() / VENTANA_MS) * VENTANA_MS;
  try {
    const [url] = await almacen()
      .file(ruta)
      .getSignedUrl({ version: 'v4', action: 'read', accessibleAt: new Date(inicio), expires: inicio + 2 * VENTANA_MS });
    return url;
  } catch (e) {
    // Sin portada la clase se ve igual, con su fondo: no se tumba la lista por esto.
    console.error('[lecciones] no se ha podido firmar la portada', e);
    return undefined;
  }
}

/**
 * Borra del almacén lo que es de una clase: su carpeta y, en las primeras
 * clases (que se subieron a mano a `clases/`), el vídeo suelto al que apunta.
 *
 * El vídeo suelto solo se borra si ninguna otra clase lo usa: alguna vez se ha
 * duplicado una clase para tenerla en dos cursos, y borrar una no puede dejar
 * a la otra sin vídeo.
 *
 * Devuelve cuántos archivos no se han podido borrar (0 si todo bien). Lo que
 * quede en la carpeta lo recoge después `barrerHuerfanas`.
 */
export async function borrarArchivosDeClase(id: string, video: string): Promise<number> {
  const bucket = almacen();
  let fallos = 0;
  try {
    await bucket.deleteFiles({ prefix: carpetaDeClase(id) });
  } catch (e) {
    console.error('[lecciones] no se ha podido vaciar la carpeta de la clase', id, e);
    fallos++;
  }

  if (esVideoPropio(video)) {
    const ruta = video.slice('propio:'.length);
    if (ruta && !ruta.startsWith(carpetaDeClase(id))) {
      /* La clase ya está borrada cuando se llega aquí: si algo falla, se
         cuenta como resto y no como error, para que la pantalla no vuelva a
         pintar una clase que ya no existe. */
      try {
        const otras = await baseDeDatos().collection(COLECCIONES.lecciones).where('video', '==', video).limit(1).get();
        if (otras.empty) await bucket.file(ruta).delete({ ignoreNotFound: true });
      } catch (e) {
        console.error('[lecciones] no se ha podido borrar el vídeo', ruta, e);
        fallos++;
      }
    }
  }
  return fallos;
}

/**
 * Recoge las carpetas de clases que se quedaron sin clase: un vídeo que llegó
 * a subirse entero pero cuya clase no se guardó (se cerró la pestaña justo al
 * terminar, se fue la conexión al guardar…).
 *
 * Se espera un día antes de borrar nada: en ese tiempo, volver a elegir el
 * mismo archivo retoma la subida y guarda la clase sin volver a subirlo. Lo
 * que no llega a subirse entero no deja nada en el almacén: Google solo crea
 * el archivo cuando recibe el último trozo.
 *
 * Se llama al empezar cada subida nueva, que es justo cuando puede haber
 * restos de la anterior, y no en cada visita: listar el almacén no es gratis.
 */
export async function barrerHuerfanas(): Promise<number> {
  const [archivos] = await almacen().getFiles({ prefix: CARPETA_CLASES });
  const porClase = new Map<string, number>();
  for (const a of archivos) {
    const id = a.name.slice(CARPETA_CLASES.length).split('/')[0];
    if (!id) continue;
    const creado = Date.parse(String(a.metadata.timeCreated ?? '')) || 0;
    porClase.set(id, Math.max(porClase.get(id) ?? 0, creado));
  }
  if (porClase.size === 0) return 0;

  const ids = [...porClase.keys()];
  const col = baseDeDatos().collection(COLECCIONES.lecciones);
  const docs = await baseDeDatos().getAll(...ids.map((id) => col.doc(id)));
  let borradas = 0;
  for (const d of docs) {
    const reciente = (porClase.get(d.id) ?? 0) > Date.now() - ABANDONADA_MS;
    if (d.exists || reciente) continue;
    await almacen()
      .deleteFiles({ prefix: carpetaDeClase(d.id) })
      .then(() => borradas++)
      .catch((e) => console.error('[lecciones] no se ha podido barrer', d.id, e));
  }
  if (borradas) console.log(`[lecciones] barridas ${borradas} subidas abandonadas`);
  return borradas;
}
