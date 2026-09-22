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
export function correoEsAdmin(correo: string | undefined | null): boolean {
  if (!correo) return false;
  const lista = (process.env.ADMIN_CORREOS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(correo.toLowerCase());
}
