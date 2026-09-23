import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { tipoDeOrigen } from '@/lib/origenes';
import { PERFILES, normalizarTelefono, revisar as revisarComoLaWeb } from '@/lib/captacion';

/**
 * Los contactos, para verlos y trabajarlos desde la plataforma.
 *
 *   GET    → la lista, la más reciente primero
 *   POST   → apuntar a mano a alguien que no ha pasado por la web
 *   PATCH  → cambiar el estado, apuntar seguimiento o corregir sus datos
 *   DELETE → borrarlo
 *
 * Solo para Sorela. La comprobación se hace aquí con el rol de la cookie, que
 * va firmado: no se acepta un «soy admin» enviado desde el navegador.
 *
 * Los contactos no entran solo por los formularios de la web: Sorela conoce
 * gente en una exposición o por teléfono y necesita apuntarla igual. Esos
 * contactos viven en la misma colección y se leen con el mismo GET; lo único
 * que los distingue es que no han rellenado nada (ver `veces` en POST).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Por dónde puede pasar un contacto. El orden es el del embudo. */
export const ESTADOS = ['Nuevo', 'Contactado', 'En conversación', 'Cerrado', 'Descartado'] as const;
export type EstadoContacto = (typeof ESTADOS)[number];

async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (sesion.rol !== 'sorela') {
    return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  }
  return { sesion };
}

/* ==========================================================================
   Apuntar, corregir y borrar a mano
   ========================================================================== */

const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** Los campos que pueden devolver un error con su nombre, para pintarlo al lado. */
type Campo = 'nombre' | 'correo' | 'whatsapp' | 'ciudad' | 'perfil' | 'nota';
type Errores = Partial<Record<Campo, string>>;

/** Lo que se puede escribir de un contacto. Todo opcional: al editar se manda
 *  solo lo que cambia. */
type Datos = Partial<Record<Campo, string>>;

type Revision = { ok: true; datos: Datos } | { ok: false; errores: Errores };

/**
 * Si un identificador de documento se puede usar tal cual.
 *
 * Copiada de app/api/agenda/route.ts, donde está explicada entera: Firestore
 * lee la barra como separador de rutas, así que un id con barras no apunta a
 * lo que parece y, si le faltan tramos, lanza una excepción que saldría al
 * navegador como un 500 con su traza. Aquí solo entra Sorela, así que no es un
 * agujero; es que un id roto debe contestar «datos» y no una pantalla de
 * error. Se repite en vez de importarse porque sacarla a lib/ significaría
 * tocar ficheros que ahora mismo lleva otra mano. Queda anotado para unificarlas.
 */
function idValido(id: string): boolean {
  return id.length > 0 && id.length <= 200 && !id.includes('/') && id !== '.' && id !== '..';
}

/**
 * Si un correo tiene forma de correo.
 *
 * Se le pregunta al validador que usa la web en vez de escribir aquí otra
 * expresión regular. lib/captacion.ts no exporta la suya, y copiarla
 * significaría que el día que alguien la afine —para dejar pasar un dominio
 * raro, por ejemplo— la web y la plataforma empezarían a aceptar cosas
 * distintas sin que nadie se entere. El nombre y el consentimiento que se le
 * pasan son de relleno, solo para que no se queje de ellos: lo único que se
 * mira es lo que diga del correo.
 */
function correoValido(correo: string): boolean {
  const r = revisarComoLaWeb({ nombre: 'xx', correo, consentimiento: true });
  return r.ok || !r.errores.correo;
}

/**
 * El identificador del documento de un contacto.
 *
 * Con correo es el propio correo con las barras cambiadas por «_», EXACTAMENTE
 * la misma regla que app/api/captar. No es un capricho: es lo que hace que si
 * esta persona rellena después el formulario de la web se actualice su ficha
 * en vez de aparecer dos veces. Con cualquier otra regla, cada contacto
 * apuntado a mano se duplicaría el día que entrara por la web.
 *
 * Sin correo hace falta otro id, y aquí puede no haberlo: alguien apuntado en
 * una feria muchas veces solo da el móvil. Se usa «tel-» y los dígitos del
 * teléfono ya normalizado. Se ha elegido eso y no un id automático de
 * Firestore porque es determinista: apuntar dos veces el mismo móvil choca y
 * se avisa, en vez de dejar dos fichas de la misma persona que luego hay que
 * juntar a mano. Y no puede chocar nunca con un id de correo, porque un correo
 * siempre lleva «@» y esto nunca lo lleva.
 *
 * Sin correo y sin teléfono no se llama: el validador ya lo ha rechazado antes.
 */
function identificador(correo: string, whatsapp: string): string {
  if (correo) return correo.replace(/\//g, '_');
  return `tel-${whatsapp.replace(/\D/g, '')}`;
}

/**
 * Revisa lo que llega y devuelve lo que se puede guardar.
 *
 * `parcial` distingue los dos usos, igual que en la agenda: al crear hay que
 * mirarlo todo, y al corregir solo lo que viene en la petición. Sin esa
 * distinción, corregir una ciudad se quejaría de que falta el nombre.
 */
function revisar(entrada: Record<string, unknown>, parcial: boolean): Revision {
  const errores: Errores = {};
  const datos: Datos = {};
  const toca = (campo: string) => !parcial || entrada[campo] !== undefined;

  if (toca('nombre')) {
    const nombre = recortar(entrada.nombre, 80);
    if (nombre.length < 2) errores.nombre = 'Escribe su nombre.';
    else datos.nombre = nombre;
  }

  // El correo se guarda siempre en minúsculas, como en la web: si no, el mismo
  // correo escrito con mayúsculas daría otro id y otra ficha.
  const correo = recortar(entrada.correo, 160).toLowerCase();
  if (toca('correo') && correo) {
    if (!correoValido(correo)) errores.correo = 'Ese correo no parece correcto.';
    else datos.correo = correo;
  }

  const crudoTelefono = recortar(entrada.whatsapp, 32);
  if (toca('whatsapp')) {
    const whatsapp = normalizarTelefono(crudoTelefono);
    if (crudoTelefono && !whatsapp) {
      errores.whatsapp = 'Escribe el móvil, con prefijo si es de fuera de España.';
    } else if (whatsapp) {
      datos.whatsapp = whatsapp;
    } else if (parcial) {
      // Al corregir, dejarlo en blanco significa borrarlo de verdad. Al crear
      // no se escribe el campo vacío: no hace falta guardar un hueco.
      datos.whatsapp = '';
    }
  }

  /*
   * Hace falta al menos el nombre y una forma de llegar a la persona. El
   * correo no se puede exigir —en una feria mucha gente da solo el móvil— pero
   * las dos cosas en blanco dejarían una ficha a la que no se puede escribir,
   * que es una ficha para nada.
   *
   * Solo se comprueba al crear: al corregir, la persona ya tiene lo que tiene.
   * Y el aviso se pone en los dos campos porque no falla ninguno de los dos en
   * concreto, falla que no haya ninguno: así se lee esté mirando donde esté.
   */
  if (!parcial && !correo && !crudoTelefono && !errores.correo && !errores.whatsapp) {
    const falta = 'Necesito el correo o el WhatsApp: con los dos en blanco no hay forma de escribirle.';
    errores.correo = falta;
    errores.whatsapp = falta;
  }

  /*
   * El perfil llega de una lista cerrada, pero si viniera uno que no está se
   * guarda como «Otra cosa» en vez de rechazar el contacto entero. Es la misma
   * regla que en lib/captacion.ts, y por el mismo motivo: el dato de contacto
   * vale mucho más que la etiqueta.
   */
  if (toca('perfil')) {
    const perfil = recortar(entrada.perfil, 60);
    datos.perfil = perfil && !(PERFILES as readonly string[]).includes(perfil) ? 'Otra cosa' : perfil;
  }

  // Texto libre: se guarda tal cual, incluso vacío, para que borrar una ciudad
  // o una nota al corregir funcione de verdad y no se quede lo de antes.
  if (toca('ciudad')) datos.ciudad = recortar(entrada.ciudad, 80);
  if (toca('nota')) datos.nota = recortar(entrada.nota, 500);

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos };
}

export async function GET() {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  const lista = await baseDeDatos()
    .collection(COLECCIONES.contactos)
    // Por fecha de entrada, el último arriba: es el que hay que llamar.
    .orderBy('creado', 'desc')
    .limit(500)
    .get();

  const contactos = lista.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      nombre: v.nombre ?? '',
      correo: v.correo ?? '',
      whatsapp: v.whatsapp ?? '',
      perfil: v.perfil ?? '',
      ciudad: v.ciudad ?? '',
      nota: v.nota ?? '',
      origen: v.origen ?? 'web',
      estado: (v.estado as EstadoContacto) ?? 'Nuevo',
      // De dónde entró decide qué busca: una sesión, formarse o la comunidad.
      // Se resuelve aquí y no en el navegador para que la lista y el correo
      // digan lo mismo. Ver lib/origenes.ts.
      tipo: tipoDeOrigen(v.origen),
      // Lo que Sorela ha ido apuntando de esa persona, lo más nuevo primero.
      seguimiento: Array.isArray(v.seguimiento)
        ? v.seguimiento.map((n: { cuando?: string; texto?: string }) => ({
            cuando: n?.cuando ?? '',
            texto: n?.texto ?? '',
          }))
        : [],
      // Un Timestamp de Firestore no sobrevive a JSON.stringify de forma
      // legible, así que se manda como texto ISO y se formatea en pantalla.
      creado: v.creado?.toDate?.().toISOString() ?? null,
      veces: v.veces ?? 1,
    };
  });

  const nuevos = contactos.filter((c) => c.estado === 'Nuevo').length;

  return NextResponse.json({ ok: true, contactos, nuevos, total: contactos.length });
}

export async function PATCH(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  /*
   * Tres peticiones distintas entran por aquí y se distinguen por qué campo
   * traen: `nota` apunta seguimiento, `datos` corrige la ficha y `estado`
   * mueve el embudo.
   *
   * OJO con `nota`, que es la trampa de este fichero: en la RAÍZ del cuerpo
   * significa «añade esta nota de seguimiento», mientras que dentro de `datos`
   * es el campo del contacto —lo que la persona escribió en el formulario—.
   * Son dos cosas distintas con el mismo nombre. Por eso lo que se corrige va
   * envuelto en `datos` y no suelto: suelto, corregir el texto de alguien
   * habría quedado apuntado como una nota de seguimiento, que es justo lo
   * contrario de lo que se pedía.
   */
  let cuerpo: { id?: string; estado?: string; nota?: string; datos?: Record<string, unknown> };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const { estado, nota, datos } = cuerpo;
  // Antes bastaba con que el id no estuviera vacío. Un id con barras —de un
  // enlace viejo o de un copiar y pegar a medias— llegaba hasta doc() y salía
  // como un 500 con su traza; ahora contesta «datos», que es lo que es.
  const id = recortar(cuerpo.id, 200);
  if (!idValido(id)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const ref = baseDeDatos().collection(COLECCIONES.contactos).doc(id);

  /*
   * Apuntar algo de una persona.
   *
   * Se añade al final del array con arrayUnion y NO se reescribe el array
   * entero: si Sorela tiene la ficha abierta en el móvil y en el ordenador,
   * mandar la lista completa desde cada uno haría que la última en guardar
   * borrase lo que hubiera escrito la otra.
   *
   * La hora la pone el servidor, pero dentro del elemento no se puede usar
   * serverTimestamp —Firestore no lo admite dentro de un array—, así que se
   * escribe la del servidor en texto ISO.
   */
  if (typeof nota === 'string' && nota.trim()) {
    await ref.set(
      {
        seguimiento: FieldValue.arrayUnion({
          cuando: new Date().toISOString(),
          texto: nota.trim().slice(0, 1000),
        }),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true, id });
  }

  /*
   * Corregir la ficha: un nombre mal escrito, la ciudad que faltaba, el móvil
   * con un dígito de menos.
   *
   * El correo NO se puede corregir y no es un olvido: el correo ES el
   * identificador del documento (ver `identificador`). Cambiarlo obligaría a
   * crear otro documento y borrar este, y por el camino se quedarían atrás el
   * seguimiento, las veces que ha entrado y la fecha en que llegó. Si un
   * correo está mal, lo honrado es borrar el contacto y volver a apuntarlo, y
   * eso se ve venir. El origen tampoco se toca: es de dónde entró, un hecho
   * que ya pasó, no una etiqueta que se ajusta (lo explica lib/origenes.ts).
   */
  if (datos && typeof datos === 'object') {
    const revision = revisar(datos, true);
    if (!revision.ok) {
      return NextResponse.json({ ok: false, motivo: 'datos', errores: revision.errores }, { status: 400 });
    }
    // El correo se descarta aquí y no en `revisar`, que también sirve al POST.
    delete revision.datos.correo;

    if (Object.keys(revision.datos).length === 0) {
      return NextResponse.json({ ok: false, motivo: 'sin-cambios' }, { status: 400 });
    }

    try {
      // update() y no set(..., { merge: true }): si el contacto ya no existe
      // —porque se acaba de borrar en otra pestaña—, esto falla en vez de
      // resucitarlo como una ficha a medias sin fecha de entrada, que además
      // el GET no enseñaría por ordenar justo por ese campo.
      await ref.update({ ...revision.datos, actualizado: FieldValue.serverTimestamp() });
    } catch {
      return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id });
  }

  if (!estado || !(ESTADOS as readonly string[]).includes(estado)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  await ref.set({ estado, estadoCambiado: FieldValue.serverTimestamp() }, { merge: true });

  return NextResponse.json({ ok: true, id, estado });
}

/**
 * Apuntar a mano a alguien que no ha pasado por la web.
 *
 * Es el caso de la exposición y el de la llamada: Sorela conoce a alguien,
 * apunta su nombre y su móvil en una servilleta y eso se pierde. Aquí entra en
 * la misma lista que el resto y se le puede hacer el mismo seguimiento.
 */
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

  const revision = revisar(cuerpo, false);
  if (!revision.ok) {
    return NextResponse.json({ ok: false, motivo: 'datos', errores: revision.errores }, { status: 400 });
  }
  const datos = revision.datos;

  /*
   * El origen se acepta tal como llega, recortado, igual que en app/api/captar:
   * es texto libre y de él cuelga la clasificación de lib/origenes.ts. No se
   * valida contra una lista cerrada porque aquí solo entra Sorela —lo acaba de
   * comprobar exigirAdmin— y tener la lista de orígenes repetida en la ruta y
   * en la pantalla se desincronizaría a la primera. Quien lo manda es el
   * selector de «qué busca» del formulario.
   */
  const origen = recortar(cuerpo.origen, 40) || 'a-mano';

  const id = identificador(datos.correo ?? '', datos.whatsapp ?? '');
  const ref = baseDeDatos().collection(COLECCIONES.contactos).doc(id);

  try {
    /*
     * create() y no set(): si ya hay alguien con ese correo, esto falla en vez
     * de pisarlo. Y falla de forma atómica, que es la gracia: mirar antes con
     * get() y escribir después dejaría un hueco entre las dos cosas en el que
     * dos guardados a la vez pasarían los dos.
     *
     * Por qué importa tanto no pisar: el documento guarda el seguimiento, el
     * estado y la fecha en que entró. Machacarlo porque alguien vuelva a
     * escribir el nombre de una clienta que ya existe borraría todo lo que
     * Sorela tiene apuntado de sus conversaciones con ella, que es lo más
     * caro que hay en esta base de datos.
     */
    await ref.create({
      ...datos,
      origen,
      // Nace sin atender, como los que llegan por la web.
      estado: 'Nuevo',
      /*
       * Cuántas veces ha dejado sus datos en la web: ninguna, la has apuntado
       * tú. app/api/captar hace increment(1) cada vez que alguien rellena un
       * formulario, así que este 0 se mantiene solo hasta el día en que esta
       * persona entre además por la web.
       *
       * Es ADEMÁS lo que distingue en la lista a quien entró a mano, porque el
       * GET ya manda este número y no manda `aMano`. Cuidado: el GET lo lee
       * con `??` y no con `||`, así que el 0 llega entero; cambiar ese `??`
       * por un `||` convertiría todos los ceros en unos y se perdería la marca
       * sin que salte nada.
       */
      veces: 0,
      /*
       * Quién abrió la ficha. Esto no cambia nunca, ni aunque luego la persona
       * rellene el formulario: la ficha la creó Sorela. Es la verdad para
       * quien mire la base de datos, y lo que debería devolver el GET el día
       * que se toque.
       */
      aMano: true,
      /*
       * Sin esto el contacto se guardaría y no aparecería por ninguna parte:
       * el GET ordena por `creado`, y Firestore deja fuera de una consulta
       * ordenada los documentos a los que les falta el campo por el que se
       * ordena. Parecería que no se ha guardado.
       */
      creado: FieldValue.serverTimestamp(),
    });
  } catch {
    /*
     * Se mira si el choque es por duplicado en vez de fiarse del código de
     * error de Firestore: así vale igual si el fallo viene de otro sitio, y no
     * hay que acertar con un número de gRPC que puede cambiar de versión.
     */
    const yaEstaba = await ref.get().catch(() => null);
    if (yaEstaba?.exists) {
      const quien = yaEstaba.data()?.nombre || 'alguien';
      return NextResponse.json(
        {
          ok: false,
          motivo: 'ya-existe',
          id,
          // Va con nombre de campo para que salga junto al que ha chocado.
          errores: datos.correo
            ? { correo: `Ese correo ya es de ${quien}. Abre su ficha y corrígela ahí: si lo guardo otra vez, pierdes lo que tengas apuntado de ella.` }
            : { whatsapp: `Ese móvil ya es de ${quien}. Abre su ficha y corrígela ahí: si lo guardo otra vez, pierdes lo que tengas apuntado de ella.` },
        },
        { status: 409 }
      );
    }
    console.error('[contactos] No se ha podido guardar el contacto a mano:', id);
    return NextResponse.json({ ok: false, motivo: 'guardar' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id });
}

/** Borrar un contacto. Se lleva con él el seguimiento: no hay papelera. */
export async function DELETE(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  const id = recortar(new URL(peticion.url).searchParams.get('id'), 200);
  if (!idValido(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  // Borrar algo que ya no está no es un error para Firestore, y aquí tampoco:
  // si se pulsa dos veces seguidas, el resultado es el mismo y no hay susto.
  await baseDeDatos().collection(COLECCIONES.contactos).doc(id).delete();

  return NextResponse.json({ ok: true, id });
}
