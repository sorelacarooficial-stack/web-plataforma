import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { esRol, correoEsAdmin, PLATAFORMA_ABIERTA, type Rol } from '@/lib/roles';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * Gestión de personas y roles. Solo para Sorela.
 *
 *   GET    → la lista de quién tiene cuenta y con qué rol
 *   POST   → dar de alta una cuenta nueva
 *   PATCH  → cambiar el rol de alguien
 *   DELETE → borrar una cuenta entera
 *
 * La comprobación de permiso se hace aquí con el rol de la cookie, que va
 * firmado. No se acepta un «soy admin» enviado desde el navegador, ni un
 * parámetro en la dirección: eso lo escribe cualquiera.
 *
 * Por qué existe el POST: al cerrar el registro público (ver PLATAFORMA_ABIERTA
 * en lib/roles.ts) Sorela se quedó sin manera de dar acceso a una alumna que se
 * matricula. La única alternativa era entrar en la consola de Firebase, crear
 * la cuenta a mano y acordarse de ponerle la custom claim del rol. Esto hace
 * las dos cosas de una vez y sin salir de la plataforma.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Los campos del alta que pueden devolver un error con su nombre. */
type Campo = 'correo' | 'nombre' | 'rol';
type Errores = Partial<Record<Campo, string>>;

/*
 * Forma de correo, a ojo y a propósito.
 *
 * No intenta decidir si la dirección existe —eso no lo sabe nadie hasta que
 * llega el correo— ni cumplir el RFC entero, que admite cosas que ningún
 * proveedor acepta. Solo descarta el dedazo evidente antes de gastar una
 * llamada a Firebase, que además contestaría con un código en inglés.
 */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (sesion.rol !== 'sorela') {
    // 403 y no 404: la persona está identificada, simplemente no le toca.
    return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  }
  return { sesion };
}

const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/**
 * Si un identificador se puede usar tal cual como documento de Firestore.
 *
 * Mismo motivo que en `app/api/agenda/route.ts`: Firestore lee la barra como
 * separador de rutas, así que un uid con barras no apunta al documento que
 * parece, y uno con un número par de tramos revienta con una excepción que
 * saldría al navegador como un 500 con su traza. Aquí solo entra Sorela, así
 * que no es un agujero; es que un uid roto debe contestar «datos».
 */
function idValido(id: string): boolean {
  return id.length > 0 && id.length <= 200 && !id.includes('/') && id !== '.' && id !== '..';
}

/**
 * La contraseña de estreno, que no va a ver nadie.
 *
 * Firebase exige una contraseña para crear la cuenta, pero NO la elige Sorela
 * a propósito. Una contraseña que ella inventa y dicta por WhatsApp acaba
 * siendo la misma para todas —«divine2026» para las doce alumnas del curso—,
 * queda escrita en una conversación que no se borra nunca y nadie la cambia
 * después. Así que se pone una larga al azar que no se enseña en ninguna
 * respuesta ni se guarda en ningún sitio, y a la persona se le manda el enlace
 * para que ponga la suya, que solo conoce ella.
 *
 * 36 bytes en base64url son 48 caracteres. Sobra de largo y no lleva ningún
 * carácter que se pueda perder por el camino.
 */
function claveAlAzar(): string {
  return randomBytes(36).toString('base64url');
}

/** El código de un error de firebase-admin, que viene como «auth/lo-que-sea». */
function codigoDe(e: unknown): string {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
}

export async function GET() {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  const lista = await baseDeDatos()
    .collection(COLECCIONES.usuarios)
    .orderBy('ultimoAcceso', 'desc')
    .limit(200)
    .get();

  const usuarios = lista.docs.map((d) => {
    const v = d.data();
    const correo = (v.correo as string | undefined) ?? null;
    return {
      uid: d.id,
      correo,
      nombre: (v.nombre as string | undefined) ?? null,
      rol: v.rol ?? null,
      // La fecha se manda como texto ISO: un Timestamp de Firestore no
      // sobrevive a JSON.stringify de forma legible.
      ultimoAcceso: v.ultimoAcceso?.toDate?.().toISOString() ?? null,
      // Quién no se deja borrar ni degradar, decidido con la MISMA regla que
      // aplican PATCH y DELETE más abajo. Va en la respuesta para que la
      // pantalla no enseñe un botón que el servidor va a rechazar.
      protegida: correoEsAdmin(correo),
    };
  });

  return NextResponse.json({
    ok: true,
    usuarios,
    // Quién está mirando: sin esto la pantalla no puede esconderle a Sorela el
    // botón de borrarse a sí misma.
    yo: guardia.sesion.uid,
    // Una cuenta nueva se crea bien pero no puede entrar mientras esto sea
    // false. Se dice en pantalla o parecerá que la cuenta está rota.
    plataformaAbierta: PLATAFORMA_ABIERTA,
  });
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: {} }, { status: 400 });
  }

  // El correo se guarda en minúsculas: es como lo compara correoEsAdmin() y
  // como lo busca la pantalla. Un «Sorela@…» escrito con mayúscula sería la
  // misma cuenta para Firebase y otra distinta para cualquier comparación
  // nuestra que se olvidara de bajarlo.
  const correo = recortar(cuerpo.correo, 200).toLowerCase();
  const nombre = recortar(cuerpo.nombre, 120);
  const rolPedido = recortar(cuerpo.rol, 20);

  const errores: Errores = {};
  if (!CORREO.test(correo)) errores.correo = 'Escribe un correo con forma de correo.';
  if (nombre.length < 2) errores.nombre = 'Pon el nombre de la persona.';
  if (!esRol(rolPedido)) errores.rol = 'Ese rol no existe.';
  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
  }

  /*
   * Si el correo está en ADMIN_CORREOS, el rol es «sorela» diga lo que diga el
   * formulario. No es un capricho: asegurarRol() se lo va a poner igualmente la
   * primera vez que entre (ver lib/sesion-servidor.ts). Guardar aquí «alumna»
   * solo conseguiría que la lista enseñara un rol que dura hasta el primer
   * acceso y luego cambia solo, sin que nadie entienda por qué.
   */
  const rol: Rol = correoEsAdmin(correo) ? 'sorela' : (rolPedido as Rol);

  const auth = getAuth(aplicacion());

  let usuario;
  try {
    usuario = await auth.createUser({
      email: correo,
      displayName: nombre,
      password: claveAlAzar(),
      // Se marca sin verificar: quien demuestra que el correo es suyo es la
      // propia persona al abrir el enlace y poner su contraseña.
      emailVerified: false,
    });
  } catch (e) {
    const codigo = codigoDe(e);
    // El código llega prefijado («auth/email-already-exists»), así que se mira
    // el final y no la igualdad: si algún día cambia el prefijo, esto aguanta.
    if (codigo.endsWith('email-already-exists')) {
      return NextResponse.json(
        {
          ok: false,
          motivo: 'ya-existe',
          errores: { correo: 'Ya hay una cuenta con ese correo. Búscala en la lista de arriba.' },
        },
        { status: 409 }
      );
    }
    if (codigo.endsWith('invalid-email')) {
      return NextResponse.json(
        { ok: false, motivo: 'datos', errores: { correo: 'Firebase no acepta ese correo.' } },
        { status: 400 }
      );
    }
    console.error('[usuarios] No se ha podido crear la cuenta:', e);
    return NextResponse.json({ ok: false, motivo: 'fallo' }, { status: 500 });
  }

  // El rol de verdad vive en la claim, que viaja firmada dentro del token. Lo
  // de Firestore de abajo es la copia que se enseña en la lista.
  await auth.setCustomUserClaims(usuario.uid, { role: rol });

  await baseDeDatos()
    .collection(COLECCIONES.usuarios)
    .doc(usuario.uid)
    .set({
      correo,
      nombre,
      rol,
      /*
       * ultimoAcceso en null y NO sin escribir, que es la trampa: el GET de
       * arriba ordena por ese campo, y Firestore deja FUERA de una consulta
       * ordenada los documentos que no lo tienen. Sin esta línea, la cuenta
       * recién creada no saldría en la lista hasta que la persona entrase por
       * primera vez, y parecería que el alta no ha funcionado. Puesto a null sí
       * aparece, y al final, que es donde tiene que estar quien no ha entrado.
       */
      ultimoAcceso: null,
      creado: FieldValue.serverTimestamp(),
      altaPor: guardia.sesion.uid,
    });

  /*
   * El enlace para poner la contraseña.
   *
   * Se devuelve en la respuesta para que Sorela lo copie y lo mande ella por
   * donde hable con esa persona. Este servidor no envía correos —de eso se
   * encarga un Apps Script aparte—, así que sin devolverlo el alta quedaría a
   * medias: cuenta creada y nadie sabiendo cómo entrar.
   *
   * Si falla, la cuenta ya está creada y no se deshace: es válida y el enlace
   * se puede volver a pedir. Se contesta ok con el enlace en null para que la
   * pantalla lo diga en vez de dejar creer que se ha mandado algo.
   */
  let enlace: string | null = null;
  try {
    enlace = await auth.generatePasswordResetLink(correo);
  } catch (e) {
    console.error('[usuarios] Cuenta creada, pero sin enlace de contraseña:', e);
  }

  return NextResponse.json({
    ok: true,
    uid: usuario.uid,
    correo,
    nombre,
    rol,
    enlace,
    // Para poder avisar de que el rol guardado no es el que pidió.
    rolForzado: rol !== rolPedido,
  });
}

export async function PATCH(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  let cuerpo: { uid?: string; rol?: string };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const { uid, rol } = cuerpo;
  if (!uid || !esRol(rol)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const auth = getAuth(aplicacion());
  const usuario = await auth.getUser(uid).catch(() => null);
  if (!usuario) {
    return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  }

  // Sorela no puede quitarse a sí misma el rol de admin sin querer, ni
  // quitárselo a otra cuenta de la lista de administradoras: se quedaría la
  // plataforma sin nadie que pueda repartir roles.
  if (correoEsAdmin(usuario.email) && rol !== 'sorela') {
    return NextResponse.json({ ok: false, motivo: 'admin-protegida' }, { status: 409 });
  }

  await auth.setCustomUserClaims(uid, { role: rol as Rol });

  // Invalida sus tokens para que el rol nuevo le llegue en el momento y no
  // dentro de una hora, cuando caduque el que tiene.
  await auth.revokeRefreshTokens(uid);

  await baseDeDatos()
    .collection(COLECCIONES.usuarios)
    .doc(uid)
    .set({ rol, correo: usuario.email ?? null, rolCambiado: FieldValue.serverTimestamp() }, { merge: true });

  return NextResponse.json({ ok: true, uid, rol });
}

export async function DELETE(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  const uid = recortar(new URL(peticion.url).searchParams.get('uid'), 200);
  if (!idValido(uid)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  // Borrarse a sí misma la dejaría fuera de su propia plataforma para siempre,
  // y no hay ninguna pantalla desde la que volver a entrar. Se compara con el
  // uid de la sesión, que viene de la cookie firmada.
  if (uid === guardia.sesion.uid) {
    return NextResponse.json({ ok: false, motivo: 'uno-mismo' }, { status: 409 });
  }

  const auth = getAuth(aplicacion());
  const ref = baseDeDatos().collection(COLECCIONES.usuarios).doc(uid);

  /*
   * Se miran las dos mitades antes de tocar nada, y ninguna de las dos es
   * obligatoria: puede haber cuenta sin ficha —si falló la copia al entrar— y
   * ficha sin cuenta, que es justo la huérfana que apareció en producción. Si
   * al no encontrar la cuenta se contestara 404, esa huérfana no habría manera
   * de quitarla desde aquí nunca.
   */
  const [cuenta, ficha] = await Promise.all([
    auth.getUser(uid).catch(() => null),
    ref.get().catch(() => null),
  ]);

  if (!cuenta && !ficha?.exists) {
    return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  }

  // El correo sale de la cuenta, y de la ficha si la cuenta ya no está: da
  // igual por dónde se mire, a una administradora no se la borra.
  const correo = cuenta?.email ?? (ficha?.data()?.correo as string | undefined) ?? null;
  if (correoEsAdmin(correo)) {
    return NextResponse.json({ ok: false, motivo: 'admin-protegida' }, { status: 409 });
  }

  /*
   * Las dos cosas, y en este orden.
   *
   * Primero la cuenta de Authentication, que es lo único que de verdad impide
   * entrar: la ficha de Firestore es una copia para pintar la lista y borrarla
   * sola no cierra ninguna puerta. Después la ficha, y sin mirar si existía,
   * porque borrar lo que ya no está no es un error para Firestore y así se
   * limpia también la huérfana.
   */
  try {
    if (cuenta) await auth.deleteUser(uid);
  } catch (e) {
    console.error('[usuarios] No se ha podido borrar la cuenta:', e);
    return NextResponse.json({ ok: false, motivo: 'fallo' }, { status: 500 });
  }

  try {
    await ref.delete();
  } catch (e) {
    // Se avisa en vez de contestar que todo fue bien: la cuenta ya no existe
    // pero la ficha se ha quedado suelta, y esa es exactamente la avería que
    // hay que poder ver el día que pase.
    console.error('[usuarios] Cuenta borrada pero la ficha sigue en Firestore:', e);
    return NextResponse.json({ ok: false, motivo: 'ficha-suelta', uid }, { status: 500 });
  }

  return NextResponse.json({ ok: true, uid });
}
