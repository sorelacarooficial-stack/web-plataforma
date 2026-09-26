import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { ROL_POR_DEFECTO } from '@/lib/roles';

/**
 * Crearse una cuenta desde la web.
 *
 * REGISTRARSE NO ES TENER ACCESO, y esa es la idea entera de este fichero.
 *
 * Al registrarse, una persona consigue dos cosas: una cuenta con la contraseña
 * que ella elige —así no hay que mandarle a mano ningún enlace— y aparecer en
 * la lista de Cuentas de Sorela diciendo a qué viene. No consigue ninguna
 * clase, porque el contenido no cuelga de tener cuenta sino de `accesos`, que
 * solo escribe `app/api/usuarios` y solo toca Sorela. Aquí se guarda
 * `accesos: []` SIEMPRE, se lea lo que se lea del cuerpo.
 *
 * Mientras no se le dé nada, entra y ve la pantalla de «tu espacio está en
 * preparación». Eso es a propósito: puede pagar por Bizum, registrarse, y
 * Sorela le da lo suyo en cuanto lo vea, sin que la persona se quede fuera
 * esperando un enlace.
 *
 * POR QUÉ LA CUENTA SE CREA AQUÍ Y NO EN EL NAVEGADOR: la clave de Firebase
 * que lleva el navegador es pública por diseño, así que si el registro se
 * hiciera desde allí habría que abrir la creación de cuentas en la consola de
 * Google, y entonces cualquiera podría crearlas llamando a Firebase
 * directamente, saltándose esta ruta, su freno y sus comprobaciones. Creándola
 * con el SDK de administración, esa casilla de la consola se queda CERRADA y
 * la única puerta es esta. Si alguien la abre algún día, este comentario
 * explica por qué no hay que hacerlo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A qué viene. De aquí sale el origen del contacto, no lo que se le da. */
const QUIERE = {
  comunidad: {
    origen: 'comunidad-registro',
    etiqueta: 'la Comunidad Divine',
  },
  curso: {
    origen: 'formacion-registro',
    etiqueta: 'la formación',
  },
} as const;
type Quiere = keyof typeof QUIERE;

type Campo = 'nombre' | 'correo' | 'clave' | 'quiere' | 'consentimiento';
type Errores = Partial<Record<Campo, string>>;

/*
 * Forma de correo, a ojo y a propósito: la misma regla que usa el alta de
 * `app/api/usuarios`. No intenta decidir si la dirección existe —eso no lo
 * sabe nadie hasta que llega el correo—, solo descarta el dedazo evidente
 * antes de gastar una llamada a Firebase.
 */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Lo más corta que se acepta una contraseña.
 *
 * Firebase exige seis. Aquí se piden ocho y no más: obligar a mayúsculas,
 * números y signos hace que la gente escriba la misma de siempre con un «1»
 * al final y la apunte en un papel. La longitud es lo único que de verdad
 * cuesta de adivinar.
 */
const CLAVE_MIN = 8;

/**
 * Freno por IP, igual que en `app/api/captar`.
 *
 * Vive en memoria, así que en Vercel cada instancia lleva su cuenta y el
 * límite real es más flojo que este. No es seguridad: es que un script tonto
 * no pueda llenar Firebase de cuentas en un minuto.
 */
const HUELLAS = new Map<string, number[]>();
const VENTANA = 60_000;
const MAX_POR_VENTANA = 5;

function vaDemasiadoRapido(ip: string): boolean {
  const ahora = Date.now();
  const previas = (HUELLAS.get(ip) ?? []).filter((t) => ahora - t < VENTANA);
  previas.push(ahora);
  HUELLAS.set(ip, previas);

  if (HUELLAS.size > 500) {
    for (const [clave, marcas] of HUELLAS) {
      if (marcas.every((t) => ahora - t >= VENTANA)) HUELLAS.delete(clave);
    }
  }
  return previas.length > MAX_POR_VENTANA;
}

const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** El código de un error de firebase-admin, que viene como «auth/lo-que-sea». */
function codigoDe(e: unknown): string {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: {} }, { status: 400 });
  }

  /* El señuelo antirrobots: un campo que no se ve y que nadie rellena a mano.
     Si viene con algo, se contesta que sí y no se crea nada. Decirle a un bot
     que ha fallado solo le enseña a reintentar de otra manera. */
  if (recortar(cuerpo.empresa, 200)) {
    return NextResponse.json({ ok: true });
  }

  // El correo en minúsculas: es como lo compara todo lo demás y como se guarda
  // el identificador del contacto. Un «Ana@…» sería la misma cuenta para
  // Firebase y otra distinta para cualquier comparación nuestra.
  const correo = recortar(cuerpo.correo, 200).toLowerCase();
  const nombre = recortar(cuerpo.nombre, 120);
  const clave = String(cuerpo.clave ?? '');
  const quiereCrudo = recortar(cuerpo.quiere, 20);

  const errores: Errores = {};
  if (nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
  if (!CORREO.test(correo)) errores.correo = 'Escribe un correo con forma de correo.';
  if (clave.length < CLAVE_MIN) errores.clave = `La contraseña necesita al menos ${CLAVE_MIN} caracteres.`;
  if (!(quiereCrudo in QUIERE)) errores.quiere = 'Dime a qué vienes.';
  if (cuerpo.consentimiento !== true) {
    errores.consentimiento = 'Necesito que lo aceptes para poder guardar tus datos.';
  }
  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores }, { status: 400 });
  }
  const quiere = quiereCrudo as Quiere;

  /*
   * El freno va AQUÍ, después de revisar y no antes.
   *
   * Contando también lo que no pasa la revisión, alguien que se equivoca dos
   * veces con la contraseña y acierta a la tercera se comía el límite y se
   * quedaba fuera un minuto sin entender por qué. Y no protegía de nada: lo
   * que hay que frenar es crear cuentas, no equivocarse escribiendo. Una
   * petición con basura se para en el regex de arriba y no llega a tocar
   * Firebase, así que sale barata de todas formas.
   */
  const ip =
    peticion.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    peticion.headers.get('x-real-ip') ||
    'sin-ip';
  if (vaDemasiadoRapido(ip)) {
    return NextResponse.json({ ok: false, motivo: 'ritmo' }, { status: 429 });
  }

  const auth = getAuth(aplicacion());

  let usuario;
  try {
    usuario = await auth.createUser({
      email: correo,
      displayName: nombre,
      password: clave,
      // Sin verificar: quien demuestra que el correo es suyo es ella misma
      // cuando lo use para recuperar la contraseña.
      emailVerified: false,
    });
  } catch (e) {
    const codigo = codigoDe(e);
    if (codigo.endsWith('email-already-exists')) {
      /*
       * Esto NO es un agujero de privacidad aunque lo parezca: confirma que
       * ese correo tiene cuenta. Pero es que no hay alternativa —crear una
       * segunda cuenta con el mismo correo es imposible en Firebase—, y
       * callarlo dejaría a la persona pulsando «crear» contra una pared sin
       * entender nada. Lo que sí se evita es decir nada más de esa cuenta.
       */
      return NextResponse.json(
        {
          ok: false,
          motivo: 'ya-existe',
          errores: { correo: 'Ya tienes una cuenta con ese correo. Entra con ella.' },
        },
        { status: 409 }
      );
    }
    if (codigo.endsWith('invalid-password')) {
      return NextResponse.json(
        { ok: false, motivo: 'datos', errores: { clave: 'Esa contraseña no le vale a Firebase.' } },
        { status: 400 }
      );
    }
    if (codigo.endsWith('invalid-email')) {
      return NextResponse.json(
        { ok: false, motivo: 'datos', errores: { correo: 'Firebase no acepta ese correo.' } },
        { status: 400 }
      );
    }
    console.error('[registro] No se ha podido crear la cuenta:', e);
    return NextResponse.json({ ok: false, motivo: 'fallo' }, { status: 500 });
  }

  /*
   * La ficha. Si esto falla, se DESHACE la cuenta, por lo mismo que en el alta
   * de `app/api/usuarios`: sin ficha no hay `altaPor`, así que no podría
   * entrar; y como la lista de Cuentas mira además Authentication, aparecería
   * ahí marcada «sin ficha» sin que nadie entienda de dónde sale. Deshacerla
   * no pierde nada: no ha llegado a existir para su dueña, y volver a
   * intentarlo cuesta un clic.
   */
  try {
    await auth.setCustomUserClaims(usuario.uid, { role: ROL_POR_DEFECTO });

    await baseDeDatos()
      .collection(COLECCIONES.usuarios)
      .doc(usuario.uid)
      .set({
        correo,
        nombre,
        rol: ROL_POR_DEFECTO,
        /*
         * VACÍO, y no lo que venga en el cuerpo. Aquí está la diferencia entre
         * una cuenta y un acceso: si esta lista se pudiera pedir desde fuera,
         * cualquiera se daría la comunidad sola escribiéndola en la petición.
         * Lo que ha pedido se guarda aparte, en `pide`, que no abre nada.
         */
        accesos: [],
        pide: quiere,
        /*
         * `altaPor` es lo que mira lib/sesion-servidor para dejar entrar. Se
         * escribe «registro» y no un uid para que se distinga de un vistazo
         * quién se ha dado de alta sola y a quién dio de alta Sorela: son dos
         * conversaciones distintas, y una de ellas todavía no ha pagado.
         */
        altaPor: 'registro',
        ultimoAcceso: null,
        creado: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.error('[registro] Registro a medias, se deshace la cuenta:', e);
    const deshecha = await auth
      .deleteUser(usuario.uid)
      .then(() => true)
      .catch(() => false);
    return NextResponse.json(
      { ok: false, motivo: deshecha ? 'fallo' : 'cuenta-suelta' },
      { status: 500 }
    );
  }

  /*
   * Y además, en la lista de contactos.
   *
   * No es duplicar: son dos cosas distintas. La ficha de arriba dice «esta
   * persona puede entrar»; el contacto dice «esta persona ha levantado la
   * mano», y de él cuelgan el botón de WhatsApp, el estado del embudo y las
   * notas de lo que hablen. Alguien que se registra y todavía no ha pagado es
   * exactamente eso: alguien a quien hay que escribir.
   *
   * Se usa `merge` y no `create`: si ya había dejado su contacto en la web
   * antes de registrarse —que es lo normal—, se completa su ficha en vez de
   * duplicarla o de reventar. Y si esto falla no se deshace nada: la cuenta es
   * válida y perder el seguimiento es mucho menos grave que perder el acceso.
   */
  try {
    const ficha = baseDeDatos().collection(COLECCIONES.contactos).doc(correo.replace(/\//g, '_'));
    const yaEstaba = (await ficha.get()).exists;

    await ficha.set(
      {
        nombre,
        correo,
        origen: QUIERE[quiere].origen,
        /* Que se ha creado la cuenta ella misma. Lo usa la lista para
           distinguirla de quien solo ha dejado su contacto: una ya está
           dentro esperando, la otra todavía no ha dado ese paso. */
        registrada: true,
        /* El estado y la fecha de entrada solo se escriben si la ficha es
           NUEVA. Si ya estaba —lo normal: primero deja su contacto en la web y
           luego se registra—, volver a ponerle «Nuevo» borraría por dónde iba
           la conversación, y volver a poner la fecha de hoy le quitaría el día
           que de verdad apareció. */
        ...(yaEstaba ? {} : { estado: 'Nuevo', veces: 1, creado: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );
  } catch (e) {
    console.error('[registro] Cuenta creada, pero sin ficha en la lista de contactos:', e);
  }

  return NextResponse.json({ ok: true, correo, nombre, quiere });
}
