import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from './firebase-servidor';
import { CURSO_DIVINE, revisarAccesos, type Acceso } from './accesos';
import { ROL_POR_DEFECTO } from './roles';

/**
 * Los enlaces de invitación.
 *
 * Sorela cobra, crea un enlace en Cuentas eligiendo qué da —la formación, la
 * Comunidad Divine o las dos— y se lo manda. Quien lo abre se crea la cuenta
 * con su contraseña y entra ya con el acceso puesto, sin esperar a nadie.
 *
 * TRES COSAS QUE LO HACEN SEGURO:
 *
 * - Sirve UNA vez. Si se reenvía, al segundo le dice que ya está usado. Se
 *   marca dentro de una transacción, así que ni dos personas a la vez pueden
 *   colarse por el mismo.
 * - Caduca a los 30 días, y Sorela puede anularlo antes.
 * - Si al crearlo se pone el correo de la persona, solo vale para ese correo.
 *
 * Si quien lo abre ya tiene cuenta, no se crea otra: escribe su contraseña de
 * siempre y se le añade lo que trae el enlace a lo que ya tenía.
 */

export const QUE_DA = ['curso', 'membresia'] as const;
export type QueDa = (typeof QUE_DA)[number];

export const ETIQUETA_QUE_DA: Record<QueDa, string> = {
  curso: CURSO_DIVINE,
  membresia: 'Comunidad Divine',
};

export const DIAS_VIGENCIA = 30;

/** El código del enlace: 24 bytes al azar en base64url, 32 caracteres. */
export const CODIGO = /^[A-Za-z0-9_-]{32}$/;

export type EstadoInvitacion = 'pendiente' | 'usada' | 'caducada' | 'anulada';

export type Invitacion = {
  codigo: string;
  que: QueDa[];
  /** Para quién es, para reconocerla en la lista. Opcional. */
  nombre: string | null;
  /** Si está, solo vale para este correo. */
  correo: string | null;
  creado: string | null;
  caduca: string;
  estado: EstadoInvitacion;
  usadaPor: { correo: string; nombre: string | null; en: string | null } | null;
};

type Datos = FirebaseFirestore.DocumentData;

export function estadoDe(v: Datos): EstadoInvitacion {
  if (v.usada) return 'usada';
  if (v.anulada) return 'anulada';
  const caduca = v.caduca?.toDate?.() as Date | undefined;
  if (caduca && caduca.getTime() < Date.now()) return 'caducada';
  return 'pendiente';
}

export function aInvitacion(codigo: string, v: Datos): Invitacion {
  return {
    codigo,
    que: (Array.isArray(v.que) ? v.que : []).filter((q: unknown): q is QueDa => QUE_DA.includes(q as QueDa)),
    nombre: v.nombre ?? null,
    correo: v.correo ?? null,
    creado: v.creado?.toDate?.().toISOString() ?? null,
    caduca: v.caduca?.toDate?.().toISOString() ?? '',
    estado: estadoDe(v),
    usadaPor: v.usada
      ? {
          correo: v.usada.correo ?? '',
          nombre: v.usada.nombre ?? null,
          en: v.usada.en?.toDate?.().toISOString() ?? null,
        }
      : null,
  };
}

/** Lo que da un enlace, como accesos de la ficha. */
export function accesosDe(que: QueDa[]): Acceso[] {
  const hoy = new Date().toISOString();
  return que.map((q) =>
    q === 'membresia' ? { tipo: 'membresia' as const, desde: hoy } : { tipo: 'curso' as const, nombre: CURSO_DIVINE, desde: hoy }
  );
}

export const docInvitacion = (codigo: string) => baseDeDatos().collection(COLECCIONES.invitaciones).doc(codigo);

export function caducaDentroDe(dias = DIAS_VIGENCIA) {
  return Timestamp.fromMillis(Date.now() + dias * 24 * 60 * 60 * 1000);
}

/** Por qué no vale un enlace, en palabras de quien lo abre. */
export const MOTIVO_TEXTO: Record<string, string> = {
  'no-existe': 'Este enlace no existe. Revisa que lo hayas copiado entero.',
  usada: 'Este enlace ya se ha usado. Cada enlace sirve para una sola cuenta: pídele a Sorela uno nuevo.',
  caducada: 'Este enlace ha caducado. Pídele a Sorela uno nuevo.',
  anulada: 'Este enlace se ha anulado. Pídele a Sorela uno nuevo.',
  'otro-correo': 'Este enlace es para otro correo. Usa el correo con el que hablaste con Sorela.',
};

/** Comprueba un enlace sin gastarlo. */
export async function comprobar(codigo: string, correo?: string) {
  if (!CODIGO.test(codigo)) return { ok: false as const, motivo: 'no-existe' };
  const d = await docInvitacion(codigo).get();
  if (!d.exists) return { ok: false as const, motivo: 'no-existe' };
  const v = d.data() ?? {};
  const estado = estadoDe(v);
  if (estado !== 'pendiente') return { ok: false as const, motivo: estado };
  if (correo && v.correo && v.correo !== correo) return { ok: false as const, motivo: 'otro-correo' };
  return { ok: true as const, invitacion: aInvitacion(codigo, v) };
}

/**
 * Gasta el enlace y le da su acceso a `uid`.
 *
 * Todo en una transacción: se vuelve a comprobar que el enlace está libre, se
 * suman los accesos a los que ya tuviera y se marca usado. Si dos personas
 * pulsan a la vez, Firestore repite la segunda y esa ya lo encuentra gastado.
 *
 * `nueva` es la ficha de una cuenta recién creada; sin ella, la cuenta ya
 * existía y solo se le añaden los accesos.
 */
export async function canjear(
  codigo: string,
  persona: { uid: string; correo: string; nombre: string | null },
  nueva?: boolean
): Promise<{ ok: true; que: QueDa[] } | { ok: false; motivo: string }> {
  if (!CODIGO.test(codigo)) return { ok: false, motivo: 'no-existe' };
  const db = baseDeDatos();
  const refInv = docInvitacion(codigo);
  const refUsuario = db.collection(COLECCIONES.usuarios).doc(persona.uid);

  return db.runTransaction(async (t) => {
    const [inv, usuario] = await Promise.all([t.get(refInv), t.get(refUsuario)]);
    if (!inv.exists) return { ok: false as const, motivo: 'no-existe' };
    const v = inv.data() ?? {};
    const estado = estadoDe(v);
    if (estado !== 'pendiente') return { ok: false as const, motivo: estado };
    if (v.correo && v.correo !== persona.correo) return { ok: false as const, motivo: 'otro-correo' };

    const que = aInvitacion(codigo, v).que;
    const antes = usuario.exists ? revisarAccesos(usuario.data()?.accesos) : [];
    const accesos = revisarAccesos([...antes, ...accesosDe(que)]);

    if (usuario.exists && !nueva) {
      t.update(refUsuario, { accesos });
    } else {
      t.set(refUsuario, {
        correo: persona.correo,
        nombre: persona.nombre,
        rol: ROL_POR_DEFECTO,
        accesos,
        // Lo que mira lib/sesion-servidor para dejar entrar.
        altaPor: 'invitacion',
        invitacion: codigo,
        ultimoAcceso: null,
        creado: FieldValue.serverTimestamp(),
      });
    }
    t.update(refInv, {
      usada: { uid: persona.uid, correo: persona.correo, nombre: persona.nombre, en: FieldValue.serverTimestamp() },
    });
    return { ok: true as const, que };
  });
}
