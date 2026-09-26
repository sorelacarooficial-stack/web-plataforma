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

/**
 * Solo hay dos clases de persona: Sorela y todas las demás.
 *
 * Antes eran tres —alumna, miembro y Sorela— y las dos primeras sobraban.
 * «Alumna» y «miembro» no son dos clases de persona: son dos cosas que se
 * pueden comprar, y la misma mujer puede tener las dos. Con un solo campo
 * había que elegir, y al marcarla de una manera perdía la otra.
 *
 * Qué ha contratado cada una vive ahora en `lib/accesos.ts`, que es una lista
 * y admite varias cosas a la vez. El rol solo contesta a «¿esto es Sorela?»,
 * que es lo único que decide permisos.
 */
export const ROLES = ['miembro', 'sorela'] as const;
export type Rol = (typeof ROLES)[number];

/** El que se da a quien entra por primera vez y no tiene nada asignado. */
export const ROL_POR_DEFECTO: Rol = 'miembro';

export const ETIQUETA_ROL: Record<Rol, string> = {
  miembro: 'Miembro',
  sorela: 'Sorela (admin)',
};

/** Los roles con su nombre, para pintar un desplegable. */
export const ROLES_LISTA: { id: Rol; label: string }[] = ROLES.map((id) => ({
  id,
  label: ETIQUETA_ROL[id],
}));

export function esRol(v: unknown): v is Rol {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

/**
 * El rol de una cuenta, incluidas las que se dieron de alta cuando existía
 * «alumna».
 *
 * Esas cuentas tienen «alumna» escrito en su claim firmada, y la claim no se
 * puede reescribir sola: haría falta que alguien pasara por todas. Mientras
 * tanto, si esto no las tradujera, la persona entraría y el servidor no
 * sabría qué es, así que la mandaría al rol por defecto por otro camino o la
 * dejaría fuera. Se traduce aquí, en un solo sitio, y se acabó.
 */
export function normalizarRol(v: unknown): Rol | null {
  if (v === 'alumna') return 'miembro';
  return esRol(v) ? v : null;
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
