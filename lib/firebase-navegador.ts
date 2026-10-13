import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, initializeAuth, type Auth } from 'firebase/auth';

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

/*
 * La sesión de la web NO es la de Firebase: es la cookie `divine_sesion`, que
 * crea el servidor (ver lib/sesion-servidor.ts). Del navegador solo hace falta
 * el usuario de Firebase un instante, para sacar el token con el que se pide
 * esa cookie. Por eso se guarda solo en memoria.
 *
 * Antes se pedía `browserLocalPersistence`, que deja al usuario de Firebase
 * (con su token de renovación) guardado en el navegador para siempre, también
 * después de «Salir», porque nadie llamaba a signOut: en un ordenador
 * compartido, la siguiente persona heredaba ese acceso. Y es almacenamiento
 * que la política de cookies tendría que justificar sin necesitarlo.
 *
 * `initializeAuth` solo se puede llamar una vez por app; si Next recarga el
 * módulo y ya estaba creada, se recupera con getAuth (que ya la tiene en
 * memoria).
 */
let cacheAuth: Auth | null = null;

export function auth(): Auth {
  if (cacheAuth) return cacheAuth;
  try {
    cacheAuth = initializeAuth(app(), { persistence: inMemoryPersistence });
  } catch {
    cacheAuth = getAuth(app());
  }
  return cacheAuth;
}

/*
 * Aquí estaba proveedorGoogle(), para el botón de «Continuar con Google». El
 * botón se quitó: las cuentas las da de alta Sorela una a una, y entrar con
 * Google es una forma de darse de alta solo. Quitar además el proveedor en la
 * consola de Firebase —Authentication → Sign-in method— es lo que lo cierra
 * de verdad; esto solo era el resto que quedaba colgando en el código.
 */
