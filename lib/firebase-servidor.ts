import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Firestore visto desde el servidor.
 *
 * Se usa el SDK de administración y no el del navegador a propósito. Si el
 * navegador escribiera directamente en Firestore, habría que abrir la
 * colección a escritura pública y cualquiera podría llenarla desde su casa.
 * Escribiendo desde aquí, las reglas de seguridad pueden quedarse cerradas a
 * cal y canto: el SDK de administración se las salta por definición.
 *
 * Las tres variables salen de Firebase → Configuración del proyecto →
 * Cuentas de servicio → Generar nueva clave privada. Se descarga un JSON y de
 * ahí se copian tres campos. Ese JSON es SECRETO: no se sube al repositorio.
 */

let cacheApp: App | null = null;

/** La aplicación de administración, para quien necesite Auth y no Firestore. */
export function aplicacion(): App {
  return app();
}

export function hayFirebase(): boolean {
  return Boolean(
    process.env.FIREBASE_PROYECTO_ID &&
      process.env.FIREBASE_CLIENTE_CORREO &&
      process.env.FIREBASE_CLAVE_PRIVADA
  );
}

function app(): App {
  if (cacheApp) return cacheApp;

  // En desarrollo, Next recarga los módulos a cada cambio y volver a llamar a
  // initializeApp con el mismo nombre revienta. Por eso se mira antes si ya
  // hay una aplicación levantada.
  const existente = getApps()[0];
  if (existente) {
    cacheApp = existente;
    return existente;
  }

  cacheApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROYECTO_ID,
      clientEmail: process.env.FIREBASE_CLIENTE_CORREO,
      // Al pegar la clave en Vercel, los saltos de línea se quedan escritos
      // como la pareja de caracteres \n en vez de como saltos de verdad, y
      // entonces la firma no valida y el error que da no lo dice. Esto lo
      // deshace, y aguanta igual si la clave viene con saltos reales.
      privateKey: (process.env.FIREBASE_CLAVE_PRIVADA || '').replace(/\\n/g, '\n'),
    }),
    projectId: process.env.FIREBASE_PROYECTO_ID,
  });

  return cacheApp;
}

export function baseDeDatos(): Firestore {
  const db = getFirestore(app());
  return db;
}

/** Colecciones de Firestore, en un solo sitio para no escribirlas a mano. */
export const COLECCIONES = {
  /** Cada persona que deja su contacto en la web. */
  contactos: 'contactos',
  /** Lista de espera de la Comunidad Divine. */
  comunidad: 'lista_comunidad',
  /**
   * Una ficha por persona con cuenta, con su rol. Es una COPIA para que Sorela
   * pueda ver y cambiar roles desde una lista: los permisos se deciden siempre
   * con la claim del token, no con esto.
   */
  usuarios: 'usuarios',
} as const;
