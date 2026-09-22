import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';

/**
 * Firebase visto desde el navegador. Solo autenticación: a Firestore no se
 * escribe desde aquí (lo hace el servidor con el SDK de administración), así
 * que las reglas de la base pueden quedarse cerradas del todo.
 *
 * Estas claves son PÚBLICAS y van en el código del navegador a propósito: no
 * son un secreto, son identificadores del proyecto. Quien protege los datos
 * son las reglas de seguridad y la verificación del token en el servidor, no
 * el hecho de esconder la clave. Por eso llevan el prefijo NEXT_PUBLIC_.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Si falta la configuración, la web sigue en pie y el acceso avisa. */
export const hayAuth = Boolean(config.apiKey && config.authDomain && config.projectId);

let cacheApp: FirebaseApp | null = null;

function app(): FirebaseApp {
  if (cacheApp) return cacheApp;
  // getApps() evita el error de «app duplicada» cuando Next recarga módulos.
  cacheApp = getApps().length ? getApp() : initializeApp(config);
  return cacheApp;
}

let persistenciaPedida = false;

export function auth(): Auth {
  const a = getAuth(app());
  // La sesión sobrevive a cerrar la pestaña. Sin esto, cada vez que Sorela
  // vuelve a abrir el navegador tendría que entrar otra vez. Se pide una sola
  // vez y sin bloquear: si falla (modo incógnito, almacenamiento bloqueado),
  // la sesión dura lo que la pestaña, que es peor pero no rompe nada.
  if (!persistenciaPedida) {
    persistenciaPedida = true;
    setPersistence(a, browserLocalPersistence).catch((e) =>
      console.warn('[auth] No se pudo recordar la sesión:', e?.code ?? e)
    );
  }
  return a;
}

export function proveedorGoogle() {
  const p = new GoogleAuthProvider();
  // Obliga a elegir cuenta en vez de entrar con la última usada, que es la
  // causa número uno de «me ha entrado con el correo equivocado».
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}
