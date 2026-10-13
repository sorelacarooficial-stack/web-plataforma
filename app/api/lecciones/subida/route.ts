import { NextResponse, after } from 'next/server';
import { baseDeDatos, COLECCIONES } from '@/lib/firebase-servidor';
import { exigirAdmin } from '@/lib/permisos';
import { FORMATOS_VIDEO, TOPE_VIDEO, TROZO_VIDEO, carpetaDeClase, extensionDeVideo } from '@/lib/aula';
import { almacen, barrerHuerfanas } from '@/lib/aula-almacen';

/**
 * Subir el vídeo de una clase, directamente del navegador al almacén.
 *
 *   POST   { nombre, tipo, tamano }  → { ok, id, sesion, trozo }
 *   GET    ?id=<id>                  → { ok, tamano }   (¿sigue arriba el vídeo?)
 *   DELETE ?id=<id>                  → { ok }   (cancelar: no deja nada)
 *
 * El vídeo NO pasa por aquí. Vercel corta cualquier petición de más de 4,5 MB
 * y una clase pesa cientos de megas, así que esta ruta solo abre una «sesión
 * de subida reanudable» de Google Cloud Storage para la carpeta privada de la
 * clase y le devuelve al navegador su dirección. El navegador sube el vídeo a
 * esa dirección por trozos, y si se corta pregunta por dónde iba y sigue.
 *
 * La sesión se abre con el Origin de la petición: así Google contesta a ese
 * origen con los permisos de CORS que el navegador necesita, sin tener que
 * abrir el almacén entero a nadie. Y con el tamaño exacto del archivo: si lo
 * que llega no mide eso, Google no lo da por terminado.
 *
 * La clase no existe hasta que el vídeo ha llegado entero: la crea el POST de
 * /api/lecciones, que antes comprueba en el almacén que está y que mide lo que
 * tiene que medir. Si se cancela o se abandona, no queda nada a medias: una
 * sesión sin terminar no crea ningún archivo, y lo que sí llegó entero pero no
 * se guardó lo recoge `barrerHuerfanas` pasada una semana (ver allí por qué).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9]{10,40}$/;

/**
 * El origen de la página que pide, para la sesión. Es el que manda el
 * navegador; si no viene (no debería pasar en un POST), el de la propia
 * dirección.
 */
function origenDe(peticion: Request): string {
  const o = peticion.headers.get('origin') ?? '';
  return /^https?:\/\/[^/\s]+$/.test(o) ? o : new URL(peticion.url).origin;
}

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;

  let cuerpo: { nombre?: unknown; tipo?: unknown; tamano?: unknown };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const nombre = String(cuerpo.nombre ?? '').slice(0, 300);
  const ext = extensionDeVideo(nombre, String(cuerpo.tipo ?? ''));
  const tamano = Number(cuerpo.tamano);
  if (!ext) {
    return NextResponse.json({ ok: false, texto: 'Ese archivo no es un vídeo que se pueda subir. Vale MP4, MOV o WebM.' }, { status: 400 });
  }
  if (!Number.isSafeInteger(tamano) || tamano <= 0) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  if (tamano > TOPE_VIDEO) {
    return NextResponse.json({ ok: false, texto: 'El vídeo pesa más de 4 GB. Expórtalo en 1080p y vuelve a probar.' }, { status: 400 });
  }

  // El identificador de la clase se reparte ya, para nombrar su carpeta; el
  // documento no se escribe hasta que el vídeo esté arriba.
  const id = baseDeDatos().collection(COLECCIONES.lecciones).doc().id;
  const ruta = `${carpetaDeClase(id)}video.${ext}`;

  try {
    const [sesion] = await almacen()
      .file(ruta)
      .createResumableUpload({
        origin: origenDe(peticion),
        metadata: {
          contentType: FORMATOS_VIDEO[ext],
          contentLength: tamano,
          // Privado: lo sirve un enlace firmado y nadie más debe guardarlo en caché.
          cacheControl: 'private, max-age=3600',
          metadata: { subidoPor: g.sesion.uid, nombreOriginal: nombre },
        },
      });

    // Restos de subidas anteriores, después de contestar: que no la haga esperar.
    after(() => barrerHuerfanas().catch((e) => console.error('[subida] barrido', e)));

    return NextResponse.json({ ok: true, id, sesion, trozo: TROZO_VIDEO }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[subida] no se ha podido abrir la sesión', e);
    return NextResponse.json({ ok: false, texto: 'No he podido preparar la subida. Prueba en un momento.' }, { status: 503 });
  }
}

/**
 * Cuánto mide el vídeo de una subida en el almacén (0 si no está).
 *
 * Lo pregunta la pantalla al retomar una subida que Google da por terminada:
 * Google la recuerda toda la semana aunque el archivo ya no exista, y sin
 * mirarlo la pantalla diría «subido entero» de un vídeo que no está.
 */
export async function GET(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;

  const id = new URL(peticion.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  try {
    const [archivos] = await almacen().getFiles({ prefix: `${carpetaDeClase(id)}video.` });
    const tamano = archivos[0] ? Number(archivos[0].metadata.size) || 0 : 0;
    return NextResponse.json({ ok: true, tamano }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[subida] no se ha podido mirar el vídeo', id, e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

/**
 * Cancelar una subida: borra lo que hubiera llegado a su carpeta.
 *
 * Solo si la clase NO existe todavía. Una clase ya guardada se borra con el
 * DELETE de /api/lecciones, que es el que avisa de lo que se pierde; esto es
 * para lo que nunca llegó a ser clase y no tiene que preguntar nada.
 */
export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;

  const id = new URL(peticion.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const doc = await baseDeDatos().collection(COLECCIONES.lecciones).doc(id).get();
  if (doc.exists) return NextResponse.json({ ok: false, motivo: 'ya-es-clase' }, { status: 409 });

  try {
    await almacen().deleteFiles({ prefix: carpetaDeClase(id) });
  } catch (e) {
    // Si no se puede ahora, lo recoge el barrido: no es motivo para que la
    // pantalla diga que no se ha podido cancelar.
    console.error('[subida] no se ha podido vaciar la carpeta al cancelar', id, e);
  }
  return NextResponse.json({ ok: true });
}
