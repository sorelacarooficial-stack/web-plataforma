import sharp from 'sharp';
import { baseDeDatos } from './firebase-servidor';

/**
 * La firma de Sorela, la que va en el lado del DIVULGANTE de cada acuerdo.
 *
 * NO VIVE EN EL REPOSITORIO, y es lo importante. El código de la web es
 * público: una imagen dentro de `public/` o de cualquier carpeta del proyecto
 * la puede descargar cualquiera, y una firma que se puede descargar se puede
 * calcar. Vive en Firestore, en `ajustes/firma`, como los datos fiscales:
 * solo la lee el servidor y solo la cambia Sorela desde su plataforma.
 *
 * Se guarda LIMPIA: la foto que sube —de un papel, de un documento— se pasa a
 * tinta oscura sobre fondo transparente, se recorta al trazo y se reduce. Así
 * en el PDF se ve como una firma puesta sobre el papel y no como un recorte
 * de foto con el fondo amarillento.
 */

const DOC = { coleccion: 'ajustes', id: 'firma' } as const;

/** Lo que mide de ancho la firma guardada. Sobra para imprimirla a 6 cm. */
const ANCHO = 900;

/**
 * De una foto a una firma: tinta oscura sobre transparente.
 *
 * Lo claro (el papel, el fondo) se vuelve transparente y lo oscuro (el trazo)
 * se queda opaco, con una rampa entre medias para que el borde no salga
 * dentado. Se normaliza antes para que una foto con poca luz no se quede en
 * nada.
 */
export async function limpiarFirma(entrada: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(entrada)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .greyscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = info.width * info.height;
  const salida = Buffer.alloc(px * 4);
  const OSCURO = 105;
  const CLARO = 175;

  for (let i = 0; i < px; i++) {
    const v = data[i * info.channels];
    const alfa = v <= OSCURO ? 255 : v >= CLARO ? 0 : Math.round(((CLARO - v) / (CLARO - OSCURO)) * 255);
    salida[i * 4] = 20;
    salida[i * 4 + 1] = 18;
    salida[i * 4 + 2] = 16;
    salida[i * 4 + 3] = alfa;
  }

  return sharp(salida, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .resize({ width: ANCHO, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function guardarFirmaSorela(png: Buffer): Promise<void> {
  await baseDeDatos()
    .collection(DOC.coleccion)
    .doc(DOC.id)
    .set({ png: png.toString('base64'), actualizada: new Date().toISOString() });
}

export async function borrarFirmaSorela(): Promise<void> {
  await baseDeDatos().collection(DOC.coleccion).doc(DOC.id).delete();
}

/** La firma, o `null` si todavía no ha subido ninguna. Nunca lanza. */
export async function leerFirmaSorela(): Promise<Buffer | null> {
  try {
    const doc = await baseDeDatos().collection(DOC.coleccion).doc(DOC.id).get();
    const b64 = doc.exists ? String(doc.get('png') ?? '') : '';
    return b64 ? Buffer.from(b64, 'base64') : null;
  } catch (error) {
    console.error('[firma] no se ha podido leer la firma de Sorela', error);
    return null;
  }
}
