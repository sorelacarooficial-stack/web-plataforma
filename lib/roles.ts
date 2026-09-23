/**
 * Roles de la plataforma.
 *
 * Dónde vive el rol de verdad: en una «custom claim» de Firebase, que va
 * firmada dentro del token de la sesión. Es la única forma de que el servidor
 * pueda confiar en el rol sin ir a consultar la base de datos en cada
 * petición, y sobre todo la única que el navegador no puede falsear.
 *
 * Se guarda ADEMÁS una copia en Firestore, en usuarios/{uid}. Esa copia es
 * para que Sorela pueda ver y cambiar roles desde una lista; no se usa para
 * decidir permisos. Si algún día las dos discrepan, manda la claim.
 */

export const ROLES = ['alumna', 'miembro', 'sorela'] as const;
export type Rol = (typeof ROLES)[number];

/** El que se da a quien entra por primera vez y no tiene nada asignado. */
export const ROL_POR_DEFECTO: Rol = 'alumna';

export const ETIQUETA_ROL: Record<Rol, string> = {
  alumna: 'Alumna',
  miembro: 'Terapeuta certificada',
  sorela: 'Sorela (admin)',
};

export function esRol(v: unknown): v is Rol {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

export const esAdmin = (rol: Rol | null | undefined) => rol === 'sorela';

/**
 * Quién arranca siendo administradora.
 *
 * Sin esto habría un problema de huevo y gallina: para dar roles hace falta
 * ser admin, y al principio no hay ninguna. Los correos de esta lista reciben
 * el rol de admin la primera vez que entran. Se configura con la variable
 * ADMIN_CORREOS (separados por comas) y solo se lee en el servidor.
 */
/**
 * Si la plataforma está abierta a alguien más que a Sorela.
 *
 * Mientras esté en false, el servidor no abre sesión a nadie que no esté en
 * ADMIN_CORREOS, tenga o no cuenta en Firebase. Hace falta porque quitar el
 * registro de la pantalla no cierra nada: la clave del navegador es pública
 * por diseño, y con ella se puede crear una cuenta llamando a Firebase
 * directamente y colarse con ese token.
 *
 * Se podría cerrar solo desde la consola de Firebase —y hay que hacerlo
 * TAMBIÉN, son dos capas distintas—, pero una casilla de un panel no se ve en
 * un diff, no la cubre ninguna prueba y se desmarca sin querer al tocar otra
 * cosa. Esto vive en el repositorio y se revisa como el resto del código.
 *
 * El día que entre la primera alumna, esto pasa a true y el rol vuelve a
 * decidirse por cuenta, como estaba pensado.
 */
export const PLATAFORMA_ABIERTA = false;

export function correoEsAdmin(correo: string | undefined | null): boolean {
  if (!correo) return false;
  const lista = (process.env.ADMIN_CORREOS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(correo.toLowerCase());
}
