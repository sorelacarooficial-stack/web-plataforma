import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { esRol, correoEsAdmin, normalizarRol, PLATAFORMA_ABIERTA, type Rol } from '@/lib/roles';
import { revisarAccesos } from '@/lib/accesos';
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

  const auth = getAuth(aplicacion());
  const TOPE = 200;

  /*
   * Las dos mitades, y las dos hacen falta.
   *
   * La lista sale de Firestore porque es donde están el nombre, los accesos y
   * la última vez que entró. Pero quien de verdad puede entrar es la cuenta de
   * Authentication, y las dos cosas se pueden desparejar: si el alta falla a
   * medias —o si alguien crea una cuenta desde la consola de Firebase— queda
   * una cuenta sin ficha, invisible aquí. Invisible es lo peor que puede ser:
   * ocupa el correo, impide volver a dar de alta a esa persona y no se puede
   * borrar desde la pantalla porque su identificador no sale por ningún lado.
   *
   * Así que se leen las dos y se juntan por uid. Lo que solo esté en
   * Authentication sale igualmente, marcado, para que se pueda ver y borrar.
   */
  const [lista, deAuth] = await Promise.all([
    baseDeDatos().collection(COLECCIONES.usuarios).orderBy('ultimoAcceso', 'desc').limit(TOPE).get(),
    auth.listUsers(TOPE).catch((e) => {
      console.error('[usuarios] No se han podido listar las cuentas de acceso:', e);
      return null;
    }),
  ]);

  const usuarios = lista.docs.map((d) => {
    const v = d.data();
    const correo = (v.correo as string | undefined) ?? null;
    return {
      uid: d.id,
      correo,
      nombre: (v.nombre as string | undefined) ?? null,
      /** Tiene ficha, así que la lista sabe de ella todo lo que hay que saber. */
      sinFicha: false,
      /* Traducido y no en crudo: las fichas anteriores al cambio guardan
         «alumna», que ya no es un rol. Sin pasarlo por aquí, la pantalla
         pintaría en la lista una palabra que el resto del código no reconoce. */
      rol: normalizarRol(v.rol),
      /* Lo que tiene contratado: la comunidad, los cursos, o las dos cosas.
         Va revisado y no en crudo porque de aquí sale lo que se pinta, y una
         ficha a medio escribir en Firestore no debe reventar la lista. */
      accesos: revisarAccesos(v.accesos),
      // La fecha se manda como texto ISO: un Timestamp de Firestore no
      // sobrevive a JSON.stringify de forma legible.
      ultimoAcceso: v.ultimoAcceso?.toDate?.().toISOString() ?? null,
      // Quién no se deja borrar ni degradar, decidido con la MISMA regla que
      // aplican PATCH y DELETE más abajo. Va en la respuesta para que la
      // pantalla no enseñe un botón que el servidor va a rechazar.
      protegida: correoEsAdmin(correo),
    };
  });

  /*
   * Las cuentas de acceso que no tienen ficha.
   *
   * De una de estas no se sabe casi nada —ni qué ha contratado ni cuándo entró,
   * porque eso se guarda en la ficha que no existe—, pero sí lo único que
   * importa aquí: que puede entrar y que hay que poder quitarla.
   */
  const conFicha = new Set(usuarios.map((u) => u.uid));
  const sueltas = (deAuth?.users ?? [])
    .filter((u) => !conFicha.has(u.uid))
    .map((u) => ({
      uid: u.uid,
      correo: u.email ?? null,
      nombre: u.displayName ?? null,
      sinFicha: true,
      // El rol de verdad vive en la claim, no en Firestore: aquí es lo único
      // que hay, así que se lee de ahí.
      rol: normalizarRol((u.customClaims as { role?: unknown } | undefined)?.role),
      accesos: [],
      ultimoAcceso: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : null,
      protegida: correoEsAdmin(u.email ?? null),
    }));

  return NextResponse.json({
    ok: true,
    usuarios: [...usuarios, ...sueltas],
    /* Si la lista viene recortada. La pantalla lo dice en vez de dejar creer
       que eso es todo lo que hay, que es lo que pasaba antes. */
    recortada: lista.size >= TOPE || (deAuth?.users.length ?? 0) >= TOPE,
    /* Si no se han podido leer las cuentas de acceso, la lista puede estar
       incompleta sin que se note. Se dice. */
    sinAuth: deAuth === null,
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
  /* Qué ha contratado, desde el propio formulario del alta. Va aquí y no en
     una segunda pantalla porque en el momento de dar de alta a alguien es
     cuando se sabe: se la da de alta PORQUE ha comprado algo. */
  const accesos = revisarAccesos(cuerpo.accesos);

  const errores: Errores = {};
  if (!CORREO.test(correo)) errores.correo = 'Escribe un correo con forma de correo.';
  if (nombre.length < 2) errores.nombre = 'Pon el nombre de la persona.';
  if (!esRol(rolPedido)) errores.rol = 'Ese rol no existe.';
  /*
   * El rol de administradora NO se reparte desde aquí.
   *
   * Con dos roles, el desplegable de la pantalla tenía «Miembro» y «Sorela
   * (admin)» pegados: un clic de más en la fila equivocada daba acceso a todos
   * los contactos, a la facturación y al botón de borrar cuentas, sin
   * confirmación y sin decir qué significaba. Quién es administradora lo decide
   * ADMIN_CORREOS, que es una variable del servidor y no se cambia de un clic,
   * y así lo documenta lib/roles.ts desde el principio. Esta comprobación es la
   * que hace que eso sea verdad y no una intención.
   */
  if (rolPedido === 'sorela' && !correoEsAdmin(correo)) {
    errores.rol = 'El acceso de administradora no se da desde aquí: se da añadiendo el correo a ADMIN_CORREOS en el servidor.';
  }
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

  /*
   * Los dos pasos que quedan van dentro de un try, y si falla alguno se
   * DESHACE la cuenta.
   *
   * Sin esto quedaba una cuenta zombi, y no de las inofensivas: la lista de
   * esta pantalla sale de Firestore, así que una cuenta de Firebase sin ficha
   * no aparece por ningún lado, y el borrado se pide por un uid que Sorela no
   * tiene forma de conocer. Queda ocupando el correo para siempre —al volver a
   * intentar el alta contesta «ya hay una cuenta con ese correo»— y solo se
   * puede quitar entrando en la consola de Firebase, que es justo de lo que
   * esta pantalla venía a librarla.
   *
   * Deshacerla es lo correcto y no una pérdida: el alta acaba de empezar,
   * nadie ha recibido nada todavía y volver a intentarlo cuesta un clic.
   */
  try {
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
         * primera vez, y parecería que el alta no ha funcionado. Puesto a null
         * sí aparece, y al final, que es donde tiene que estar quien no ha
         * entrado.
         */
        ultimoAcceso: null,
        accesos,
        creado: FieldValue.serverTimestamp(),
        altaPor: guardia.sesion.uid,
      });
  } catch (e) {
    console.error('[usuarios] Alta a medias, se deshace la cuenta:', e);
    // Si tampoco se puede deshacer, se dice: queda una cuenta suelta en
    // Firebase y hay que quitarla desde la consola. Callarlo la dejaría ahí
    // sin que nadie lo supiera.
    const deshecha = await auth
      .deleteUser(usuario.uid)
      .then(() => true)
      .catch(() => false);
    return NextResponse.json(
      { ok: false, motivo: deshecha ? 'fallo' : 'cuenta-suelta', correo },
      { status: 500 }
    );
  }

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
    accesos,
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

  let cuerpo: { uid?: string; rol?: string; accesos?: unknown };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const uid = recortar(cuerpo.uid, 200);
  // El identificador se revisa igual que en las demás rutas: una barra dentro
  // no apunta al documento que parece, y sin esto salía como un 500 con traza.
  if (!idValido(uid)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  /* Dos cosas distintas por la misma puerta: cambiar el rol o cambiar lo que
     tiene contratado. Se distinguen por lo que llega, y cada una comprueba lo
     suyo: mandar las dos a la vez también vale. */
  const cambiaRol = cuerpo.rol !== undefined;
  const cambiaAccesos = cuerpo.accesos !== undefined;
  if (!cambiaRol && !cambiaAccesos) {
    return NextResponse.json({ ok: false, motivo: 'sin-cambios' }, { status: 400 });
  }
  if (cambiaRol && !esRol(cuerpo.rol)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const rol = cuerpo.rol as Rol | undefined;
  const accesos = cambiaAccesos ? revisarAccesos(cuerpo.accesos) : null;

  const auth = getAuth(aplicacion());
  const usuario = await auth.getUser(uid).catch(() => null);
  if (!usuario) {
    return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  }

  // Sorela no puede quitarse a sí misma el rol de admin sin querer, ni
  // quitárselo a otra cuenta de la lista de administradoras: se quedaría la
  // plataforma sin nadie que pueda repartir roles.
  if (cambiaRol && correoEsAdmin(usuario.email) && rol !== 'sorela') {
    return NextResponse.json({ ok: false, motivo: 'admin-protegida' }, { status: 409 });
  }

  /* Subir a alguien a administradora tampoco se hace por aquí, por el mismo
     motivo que en el alta: eso lo decide ADMIN_CORREOS. Lo que sí se puede es
     BAJAR a miembro a una cuenta que tenga el rol de admin sin estar en la
     lista —una que venga de antes de esta regla—, y para eso está la rama de
     arriba, que solo protege a las que sí están. */
  if (cambiaRol && rol === 'sorela' && !correoEsAdmin(usuario.email)) {
    return NextResponse.json({ ok: false, motivo: 'admin-solo-por-entorno' }, { status: 409 });
  }

  const ficha: Record<string, unknown> = { correo: usuario.email ?? null };

  if (cambiaRol) {
    await auth.setCustomUserClaims(uid, { role: rol as Rol });
    // Invalida sus tokens para que el rol nuevo le llegue en el momento y no
    // dentro de una hora, cuando caduque el que tiene.
    await auth.revokeRefreshTokens(uid);
    ficha.rol = rol;
    ficha.rolCambiado = FieldValue.serverTimestamp();
  }

  if (accesos) {
    /* Los accesos NO van a la claim ni invalidan la sesión, y es a propósito:
       se leen de Firestore cada vez que hacen falta, así que quitarle la
       comunidad a alguien tiene efecto en cuanto recarga, sin echarla fuera
       ni obligarla a volver a entrar. */
    ficha.accesos = accesos;
    ficha.accesosCambiados = FieldValue.serverTimestamp();
  }

  /* Si la ficha no existía —una cuenta que se quedó suelta y ahora se está
     arreglando desde la pantalla—, se le pone ultimoAcceso en null al crearla.
     No es un detalle: el GET ordena por ese campo, y Firestore deja fuera de
     una consulta ordenada los documentos que no lo tienen, así que sin esta
     línea la ficha recién escrita volvería a no verse. */
  const ref = baseDeDatos().collection(COLECCIONES.usuarios).doc(uid);
  const existe = await ref.get().then((d) => d.exists).catch(() => true);
  if (!existe) ficha.ultimoAcceso = null;

  await ref.set(ficha, { merge: true });

  return NextResponse.json({ ok: true, uid, ...(cambiaRol ? { rol } : {}), ...(accesos ? { accesos } : {}) });
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
