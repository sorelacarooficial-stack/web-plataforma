import 'server-only';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion } from './firebase-servidor';

/**
 * El dossier confidencial de la técnica.
 *
 * Vive en una carpeta PRIVADA de Firebase Storage, no en el repositorio: antes
 * estaba en `docs/` y el repositorio era público, así que cualquiera podía
 * descargarlo de GitHub. Solo lo lee el servidor, y solo se entrega a quien
 * tiene el acuerdo de confidencialidad aprobado por Sorela.
 */
const RUTA = 'privado/dossier/dossier-tecnica-divine.pdf';

let enMemoria: { pdf: Buffer; cuando: number } | null = null;

export async function leerDossier(): Promise<Buffer | null> {
  // Una copia en memoria durante diez minutos: pesa 2 MB y no cambia nunca.
  if (enMemoria && Date.now() - enMemoria.cuando < 600_000) return enMemoria.pdf;
  try {
    const bucket = getStorage(aplicacion()).bucket(
      process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`
    );
    const [pdf] = await bucket.file(RUTA).download();
    enMemoria = { pdf, cuando: Date.now() };
    return pdf;
  } catch (e) {
    console.error('[dossier] no se ha podido leer de Storage', e);
    return null;
  }
}
