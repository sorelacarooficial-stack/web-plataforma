import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
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

/*
 * Aquí estaba proveedorGoogle(), para el botón de «Continuar con Google». El
 * botón se quitó: las cuentas las da de alta Sorela una a una, y entrar con
 * Google es una forma de darse de alta solo. Quitar además el proveedor en la
 * consola de Firebase —Authentication → Sign-in method— es lo que lo cierra
 * de verdad; esto solo era el resto que quedaba colgando en el código.
 */
