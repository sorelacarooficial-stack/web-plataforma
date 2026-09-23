import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from './firebase-servidor';
import { correoEsAdmin, esRol, PLATAFORMA_ABIERTA, ROL_POR_DEFECTO, type Rol } from './roles';

/** Se lanza cuando alguien con cuenta válida intenta entrar y no le toca. */
export class PlataformaCerrada extends Error {
  constructor() {
    super('La plataforma todavía no está abierta.');
    this.name = 'PlataformaCerrada';
  }
}

/**
 * La sesión, vista desde el servidor.
 *
 * Cómo funciona, porque no es evidente: el navegador se autentica con Firebase
 * y obtiene un token que caduca en una hora. Ese token no sirve para proteger
 * páginas renderizadas en el servidor, porque el servidor no lo ve: vive en la
 * memoria del navegador. Así que se cambia una vez por una COOKIE de sesión
 * firmada por Firebase, que el navegador manda sola en cada petición. Con ella
 * el servidor puede decidir quién entra antes de pintar una sola línea.
 *
 * La cookie es httpOnly: el JavaScript de la página no puede leerla, así que
 * un script inyectado no se la puede llevar.
 */

export const COOKIE_SESION = 'divine_sesion';

/** Cinco días. Firebase no permite más de catorce. */
const DURACION_MS = 5 * 24 * 60 * 60 * 1000;

export type Sesion = {
  uid: string;
  correo: string | null;
  nombre: string | null;
  foto: string | null;
  rol: Rol;
};

/**
 * Cambia el token del navegador por una cookie de sesión, y de paso asegura
 * que la persona tiene un rol asignado.
 */
export async function crearSesion(tokenId: string): Promise<Sesion> {
  const auth = getAuth(aplicacion());

  // checkRevoked: si Sorela expulsa a alguien desde la consola de Firebase,
  // su token deja de valer al instante en vez de seguir vivo hasta que caduque.
  const datos = await auth.verifyIdToken(tokenId, true);

  /*
   * La puerta, y va ANTES de asegurarRol a propósito.
   *
   * Sin esto, cualquiera con un token válido de Firebase entraba: el servidor
   * le asignaba el rol de alumna, le escribía su ficha en Firestore y le daba
   * la cookie. No llegaba a ver datos de nadie —las rutas comprueban el rol y
   * la plataforma le enseña «en preparación»—, pero se daba de alta solo, y
   * conseguir ese token no requiere pasar por esta web: la clave del navegador
   * es pública y con ella se crea una cuenta llamando a Firebase directamente.
   *
   * Mientras la plataforma esté cerrada, aquí solo entra quien esté en
   * ADMIN_CORREOS. Ver PLATAFORMA_ABIERTA en lib/roles.ts.
   */
  if (!PLATAFORMA_ABIERTA && !correoEsAdmin(datos.email ?? null)) {
    throw new PlataformaCerrada();
  }

  const rol = await asegurarRol(datos.uid, datos.email ?? null, datos.role);

  const cookie = await auth.createSessionCookie(tokenId, { expiresIn: DURACION_MS });
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // 'lax' y no 'strict': con 'strict' la cookie no viaja cuando se vuelve
    // desde el acceso con Google, y la persona aterriza otra vez en el login.
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_MS / 1000,
  });

  return {
    uid: datos.uid,
    correo: datos.email ?? null,
    nombre: (datos.name as string) ?? null,
    foto: (datos.picture as string) ?? null,
    rol,
  };
}

export async function cerrarSesion() {
  const almacen = await cookies();
  const cookie = almacen.get(COOKIE_SESION)?.value;
  almacen.delete(COOKIE_SESION);

  // Además de borrar la cookie aquí, se invalidan los tokens en Firebase: si
  // alguien ha copiado la cookie, deja de servirle.
  if (cookie && hayFirebase()) {
    try {
      const datos = await getAuth(aplicacion()).verifySessionCookie(cookie);
      await getAuth(aplicacion()).revokeRefreshTokens(datos.uid);
    } catch {
      // Cookie caducada o falsa: no hay nada que revocar.
    }
  }
}

/** Quién está dentro, o null. Es la función que protege las páginas. */
export async function sesionActual(): Promise<Sesion | null> {
  if (!hayFirebase()) return null;

  const almacen = await cookies();
  const cookie = almacen.get(COOKIE_SESION)?.value;
  if (!cookie) return null;

  try {
    const datos = await getAuth(aplicacion()).verifySessionCookie(cookie, true);
    return {
      uid: datos.uid,
      correo: datos.email ?? null,
      nombre: (datos.name as string) ?? null,
      foto: (datos.picture as string) ?? null,
      rol: esRol(datos.role) ? datos.role : ROL_POR_DEFECTO,
    };
  } catch {
    // Caducada, revocada o manipulada. Todas son «no hay sesión».
    return null;
  }
}

/**
 * Asigna rol a quien todavía no tiene, y devuelve el que le toca.
 *
 * El rol se guarda como «custom claim», que viaja firmada dentro del token: el
 * navegador no la puede tocar. Se guarda también una copia en Firestore para
 * que Sorela pueda ver la lista de personas y cambiar roles, pero los permisos
 * se deciden siempre con la claim.
 */
export async function asegurarRol(
  uid: string,
  correo: string | null,
  rolActual: unknown
): Promise<Rol> {
  const auth = getAuth(aplicacion());

  // Sorela siempre es admin, incluso si alguna vez se le cambió por error.
  // Sin esta regla habría un problema de huevo y gallina: para dar roles hay
  // que ser admin, y al principio no hay ninguna.
  const deberiaSerAdmin = correoEsAdmin(correo);
  const yaCorrecto = deberiaSerAdmin ? rolActual === 'sorela' : esRol(rolActual);

  const rol: Rol = deberiaSerAdmin ? 'sorela' : esRol(rolActual) ? rolActual : ROL_POR_DEFECTO;

  if (!yaCorrecto) {
    await auth.setCustomUserClaims(uid, { role: rol });
  }

  try {
    await baseDeDatos()
      .collection(COLECCIONES.usuarios)
      .doc(uid)
      .set(
        {
          correo,
          rol,
          ultimoAcceso: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (e) {
    // Que falle la copia no debe impedir entrar: la claim ya está puesta y es
    // la que manda.
    console.error('[sesion] No se pudo guardar la ficha de usuario:', e);
  }

  return rol;
}
