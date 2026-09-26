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

/**
 * La clave privada, limpia de todo lo que le puede pasar por el camino.
 *
 * Copiar una clave de un JSON y pegarla en el panel de un servicio sale mal de
 * tres formas distintas, y las tres dan el mismo error ilegible de firma:
 *
 *   1. Se pegan también las comillas que la envuelven en el JSON.
 *   2. Los saltos de línea llegan escritos como la pareja de caracteres \n en
 *      vez de como saltos de verdad.
 *   3. Se cuela un salto o un espacio al principio o al final.
 *
 * Se deshacen las tres. Una clave que ya venía bien pasa por aquí sin cambiar.
 */
function clavePrivada(): string {
  let v = (process.env.FIREBASE_CLAVE_PRIVADA || '').trim();
  if (v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    v = v.slice(1, -1);
  }
  return v
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Qué tal está la configuración, sin decir nunca qué vale cada cosa.
 *
 * Existe porque cuando el acceso falla en el servidor, quien lo sufre solo ve
 * «no he podido abrir la sesión», y desde fuera no hay manera de saber si
 * falta una variable, si la clave está mal pegada o si es otra cosa. Esto lo
 * responde sin enseñar un solo carácter de ningún secreto.
 */
export function diagnostico() {
  const clave = clavePrivada();
  return {
    proyecto: process.env.FIREBASE_PROYECTO_ID || null,
    tieneProyecto: Boolean(process.env.FIREBASE_PROYECTO_ID),
    tieneCorreoDeServicio: Boolean(process.env.FIREBASE_CLIENTE_CORREO),
    tieneClave: clave.length > 0,
    // Una clave sana empieza y acaba por su marca y tiene varios saltos de
    // línea. Si falla esto, está mal pegada, y eso es casi siempre el motivo.
    claveConForma:
      clave.startsWith('-----BEGIN PRIVATE KEY-----') &&
      clave.trimEnd().endsWith('-----END PRIVATE KEY-----') &&
      clave.split('\n').length > 3,
    hayAdministradoras: (process.env.ADMIN_CORREOS || '').trim().length > 0,
  };
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
      clientEmail: (process.env.FIREBASE_CLIENTE_CORREO || '').trim(),
      privateKey: clavePrivada(),
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
  /**
   * La agenda de cada persona: citas, formaciones, reuniones y recados.
   *
   * OJO: no es una colección de la raíz, es una subcolección de cada usuario
   * —`usuarios/{uid}/agenda`—, y por eso cada una ve solo la suya sin depender
   * de acordarse de filtrar. Ver `app/api/agenda/route.ts`.
   */
  agenda: 'agenda',
  /** Lista de espera de la Comunidad Divine. */
  comunidad: 'lista_comunidad',
  /**
   * Una ficha por persona con cuenta, con su rol. Es una COPIA para que Sorela
   * pueda ver y cambiar roles desde una lista: los permisos se deciden siempre
   * con la claim del token, no con esto.
   */
  usuarios: 'usuarios',
  /**
   * Las clases del aula: título, a quién van y el identificador de su vídeo.
   * El vídeo NO está aquí —vive en YouTube—, solo su identificador. Ver
   * lib/aula.ts.
   */
  lecciones: 'lecciones',
  /**
   * Las facturas emitidas. Una factura que ya tiene número no se borra ni se
   * edita: si está mal, se rectifica con otra. Por eso `app/api/facturas` no
   * expone DELETE.
   */
  facturas: 'facturas',
  /**
   * Ajustes de la plataforma, un documento por tema. Ahora mismo dos:
   * 'fiscales' con los datos de Sorela como emisora, y 'contador' con la
   * numeración de las facturas, que se reparte con una transacción para que no
   * salgan dos con el mismo número.
   */
  ajustes: 'ajustes',
} as const;
