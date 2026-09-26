import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from './firebase-servidor';
import {
  correoEsAdmin,
  esRol,
  normalizarRol,
  PLATAFORMA_ABIERTA,
  ROL_POR_DEFECTO,
  type Rol,
} from './roles';
import { revisarAccesos, type Acceso } from './accesos';

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
 * Qué tiene contratado esta persona.
 *
 * Se lee de Firestore cada vez que hace falta y NO viaja dentro de la cookie,
 * aunque ahí cabría. El motivo es que los accesos cambian —alguien deja de
 * pagar la comunidad— y la cookie dura cinco días: metidos dentro, esa persona
 * seguiría viendo la comunidad casi una semana después de darse de baja, y no
 * habría forma de cortarlo sin echarla de la sesión.
 *
 * El rol sí va en la cookie, y eso está bien: el rol decide si se entra, se
 * cambia una vez en la vida y al cambiarlo se invalidan sus tokens a mano.
 */
export async function accesosDe(uid: string): Promise<Acceso[]> {
  if (!hayFirebase()) return [];
  try {
    const ficha = await baseDeDatos().collection(COLECCIONES.usuarios).doc(uid).get();
    return revisarAccesos(ficha.data()?.accesos);
  } catch (e) {
    console.error('[sesion] No se han podido leer los accesos:', e);
    return [];
  }
}

/**
 * Si a esta persona la dio de alta Sorela desde la plataforma.
 *
 * Se mira `altaPor`, que solo escribe el alta de `app/api/usuarios/route.ts`.
 * No vale con que exista la ficha: `asegurarRol` también la escribe, y si
 * bastara con eso, al segundo intento entraría cualquiera que hubiera
 * conseguido colarse una vez.
 *
 * Si Firestore no contesta, se devuelve false y la persona no entra. Es lo
 * prudente: ante la duda, la puerta se queda cerrada, y Sorela sigue pudiendo
 * entrar porque a ella la deja pasar la regla de antes.
 */
async function tieneAlta(uid: string): Promise<boolean> {
  try {
    const ficha = await baseDeDatos().collection(COLECCIONES.usuarios).doc(uid).get();
    return ficha.exists && Boolean(ficha.data()?.altaPor);
  } catch (e) {
    console.error('[sesion] No se ha podido comprobar el alta:', e);
    return false;
  }
}

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
   * Por eso la puerta NO puede ser «tiene cuenta en Firebase»: eso se lo hace
   * cualquiera. Tiene que ser «Sorela la ha dado de alta».
   *
   * Y esa diferencia se puede comprobar, porque al dar de alta desde la
   * plataforma se escribe `altaPor` en la ficha (ver app/api/usuarios/route.ts)
   * y quien llega por la puerta de atrás no tiene ninguna ficha: se escribiría
   * en `asegurarRol`, que es la línea siguiente y a la que no llega.
   *
   * Tres casos, en este orden:
   *   · Sorela (ADMIN_CORREOS): entra siempre, incluso antes de existir su
   *     ficha. Si no, no habría por dónde empezar.
   *   · Dada de alta desde la plataforma: entra.
   *   · Cualquier otro: no entra, tenga el token que tenga.
   *
   * PLATAFORMA_ABIERTA sigue existiendo para el día en que el registro se abra
   * de verdad; mientras sea false, manda el alta.
   */
  if (!PLATAFORMA_ABIERTA && !correoEsAdmin(datos.email ?? null) && !(await tieneAlta(datos.uid))) {
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
      // normalizarRol y no esRol: las cuentas dadas de alta cuando existía
      // «alumna» llevan eso escrito en su claim, que va firmada y no se puede
      // reescribir sin que alguien pase por todas. Se traduce al leerla.
      rol: normalizarRol(datos.role) ?? ROL_POR_DEFECTO,
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
  /* `esRol` y no `normalizarRol` en la comprobación de si ya está bien: una
     claim que pone «alumna» NO está bien, aunque se sepa traducir. Que dé
     false es lo que hace que se reescriba a «miembro» ahí abajo y la cuenta
     quede arreglada de verdad la primera vez que su dueña entre. */
  const yaCorrecto = deberiaSerAdmin ? rolActual === 'sorela' : esRol(rolActual);

  const rol: Rol = deberiaSerAdmin
    ? 'sorela'
    : (normalizarRol(rolActual) ?? ROL_POR_DEFECTO);

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
