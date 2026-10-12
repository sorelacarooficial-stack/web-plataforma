/**
 * Fotos que se suben desde el navegador: se reducen ANTES de salir.
 *
 * Vercel corta cualquier petición de más de 4,5 MB con un «Request Entity Too
 * Large» en texto plano, y una foto de móvil pesa 5–12 MB. Sin esto, subir una
 * foto de la cámara fallaba con «Unexpected token 'R'… is not valid JSON».
 *
 * Se dibuja en un lienzo a un lado máximo y se vuelve a codificar: el
 * navegador ya la gira según su EXIF al dibujarla, y de paso se pierden los
 * metadatos (GPS incluido). El servidor la vuelve a pasar por sharp igual.
 */

/** Por debajo del límite de Vercel con margen para el resto del formulario. */
const TOPE = 3.5 * 1024 * 1024;

async function decodificar(archivo: File): Promise<{ img: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const b = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
      return { img: b, ancho: b.width, alto: b.height, cerrar: () => b.close() };
    } catch {
      /* algunos navegadores no aceptan la opción: se prueba con <img> */
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const i = await new Promise<HTMLImageElement>((ok, mal) => {
      const x = new Image();
      x.onload = () => ok(x);
      x.onerror = () => mal(new Error('imagen'));
      x.src = url;
    });
    return { img: i, ancho: i.naturalWidth, alto: i.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

const aBlob = (c: HTMLCanvasElement, tipo: string, calidad: number) =>
  new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, calidad));

/**
 * Devuelve la foto lista para subir (webp, o jpeg en Safari, que no sabe
 * hacer webp). Si el navegador no puede leerla (HEIC en Chrome, por ejemplo) y
 * ya es pequeña, la deja tal cual; si es grande, avisa con un texto claro.
 */
export async function prepararImagen(archivo: File, ladoMax = 2000): Promise<File> {
  if (!/^image\//.test(archivo.type)) throw new Error('Eso no es una imagen.');
  let d: Awaited<ReturnType<typeof decodificar>>;
  try {
    d = await decodificar(archivo);
  } catch {
    if (archivo.size <= TOPE) return archivo;
    throw new Error('No puedo leer ese formato de foto. Prueba a elegirla desde la galería o a mandarla en JPG.');
  }
  try {
    let lado = ladoMax;
    for (let intento = 0; intento < 4; intento++) {
      const escala = Math.min(1, lado / Math.max(d.ancho, d.alto));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(d.ancho * escala));
      c.height = Math.max(1, Math.round(d.alto * escala));
      const ctx = c.getContext('2d');
      if (!ctx) break;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(d.img, 0, 0, c.width, c.height);
      let blob = await aBlob(c, 'image/webp', 0.86);
      if (!blob || blob.type !== 'image/webp') blob = await aBlob(c, 'image/jpeg', 0.86);
      if (blob && blob.size <= TOPE) {
        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
        return new File([blob], `${archivo.name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`, { type: blob.type });
      }
      lado = Math.round(lado * 0.75);
    }
  } finally {
    d.cerrar();
  }
  if (archivo.size <= TOPE) return archivo;
  throw new Error('La foto pesa demasiado. Prueba con otra.');
}

/**
 * La foto de perfil: recortada en cuadrado y reducida a `lado` px, como imagen
 * en texto (data URL) lista para POST /api/perfil/foto.
 *
 * Es lo mismo que hace el avatar de arriba (FotoPerfil), con dos diferencias:
 * gira la foto según su EXIF (un retrato del móvil no sale tumbado) y entiende
 * más formatos, porque usa el mismo `decodificar` que las demás subidas.
 */
export async function fotoCuadrada(archivo: File, lado = 256): Promise<string> {
  if (!/^image\//.test(archivo.type)) throw new Error('Eso no es una imagen.');
  let d: Awaited<ReturnType<typeof decodificar>>;
  try {
    d = await decodificar(archivo);
  } catch {
    throw new Error('No puedo leer ese formato de foto. Prueba a elegirla desde la galería o a mandarla en JPG.');
  }
  try {
    const corte = Math.min(d.ancho, d.alto);
    // Un poco por encima del centro: en un retrato la cara suele estar arriba.
    const x = (d.ancho - corte) / 2;
    const y = Math.max(0, (d.alto - corte) * 0.3);
    const c = document.createElement('canvas');
    c.width = lado;
    c.height = lado;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('No se ha podido preparar la foto.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(d.img, x, y, corte, corte, 0, 0, lado, lado);
    const webp = c.toDataURL('image/webp', 0.86);
    // Safari antiguo no sabe hacer webp y devuelve png: entonces, jpeg.
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.86);
  } finally {
    d.cerrar();
  }
}

/**
 * Lee la respuesta de la API aunque no sea JSON (un 413 de Vercel, una caída):
 * siempre devuelve un objeto con `ok`, y `texto` listo para enseñar.
 */
export async function leerRespuesta<T extends Record<string, unknown>>(r: Response): Promise<T & { ok: boolean; texto?: string }> {
  const crudo = await r.text();
  try {
    return JSON.parse(crudo);
  } catch {
    return {
      ok: false,
      texto: r.status === 413 ? 'La foto pesa demasiado. Prueba con otra.' : 'No se ha podido subir. Inténtalo otra vez.',
    } as T & { ok: boolean; texto?: string };
  }
}
