import { NextResponse, after } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { enlaceDelDossier, enviarAcuerdo } from '@/lib/enviar-acuerdo';
import { REVISADA } from '@/lib/privacidad';
import {
  CIERRE_ACUERDO,
  CLAUSULAS,
  TITULO_ACUERDO,
  VERSION_ACUERDO,
  referenciaNueva,
  revisarAcuerdo,
  type DatosAcuerdo,
} from '@/lib/acuerdo';

/**
 * Los acuerdos de confidencialidad firmados por las alumnas.
 *
 *   POST → firmar. ES PÚBLICO: lo usa el subdominio de alumnas, donde quien
 *          firma todavía no tiene cuenta. Es el único sitio de la plataforma
 *          que escribe sin sesión, y por eso lleva todos los cerrojos de
 *          abajo.
 *   GET  → la lista. Solo Sorela.
 *
 * LO QUE HACE QUE UNA FIRMA VALGA ALGO. No es el garabato: es poder demostrar
 * QUÉ se firmó, CUÁNDO y DESDE DÓNDE. Por eso cada documento guarda su propia
 * copia congelada del texto de las cláusulas, la hora del SERVIDOR y los datos
 * de la conexión. Si mañana se cambia una cláusula, lo firmado antes sigue
 * diciendo lo que decía: un acuerdo cuyo contenido se puede reescribir hacia
 * atrás no sirve para nada.
 *
 * LO QUE NO ES. No es una firma electrónica cualificada. Para una alumna
 * aceptando un compromiso de confidencialidad es más que suficiente y es lo
 * que se usa en el sector; para algo que tuviera que aguantar un pleito por
 * una cantidad grande haría falta un prestador cualificado.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* El correo sale después de responder y lleva dos PDF: necesita margen. */
export const maxDuration = 60;

const COLECCION = 'acuerdos';

/** Una firma dibujada ocupa decenas de kB. 400 kB es techo de sobra. */
const MAX_FIRMA = 400_000;

/* Mismo cerrojo que el registro: un puñado por IP y ventana. No para a quien
   se lo proponga de verdad, pero sí al guion que descubre la ruta y la aporrea. */
const VENTANA = 10 * 60 * 1000;
const MAX_POR_VENTANA = 6;
const HUELLAS = new Map<string, number[]>();

function vaDemasiadoRapido(ip: string): boolean {
  const ahora = Date.now();
  const previas = (HUELLAS.get(ip) ?? []).filter((t) => ahora - t < VENTANA);
  previas.push(ahora);
  HUELLAS.set(ip, previas);
  return previas.length > MAX_POR_VENTANA;
}

const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export async function POST(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  /* El señuelo. Un campo que no se ve y que una persona no puede rellenar: si
     viene con algo, es un robot. Se le contesta que sí y no se guarda nada,
     porque un «no» le dice qué cambiar para colarse a la siguiente. */
  if (recortar(cuerpo.empresa, 50)) {
    return NextResponse.json({ ok: true, referencia: referenciaNueva() });
  }

  /*
   * La firma NO se recorta: o cabe, o se rechaza.
   *
   * Recortarla como se recorta un nombre demasiado largo parecía defensivo y
   * era lo contrario: una imagen cortada por la mitad sigue siendo una cadena
   * válida, se guardaba sin protestar, y lo que quedaba archivado era un
   * documento con una firma rota que nadie descubriría hasta necesitarla.
   */
  const firma = String(cuerpo.firma ?? '').trim();
  if (firma.length > MAX_FIRMA) {
    return NextResponse.json(
      { ok: false, errores: { firma: 'La firma ha salido demasiado grande. Bórrala y hazla otra vez.' } },
      { status: 413 }
    );
  }

  const datos: DatosAcuerdo = {
    nombre: recortar(cuerpo.nombre, 90),
    apellidos: recortar(cuerpo.apellidos, 120),
    documento: recortar(cuerpo.documento, 30).toUpperCase().replace(/[\s-]/g, ''),
    correo: recortar(cuerpo.correo, 200).toLowerCase(),
    telefono: recortar(cuerpo.telefono, 30),
    lugar: recortar(cuerpo.lugar, 80),
    firma,
  };

  const aceptadas = Array.isArray(cuerpo.clausulas) ? cuerpo.clausulas.length : 0;
  const errores = revisarAcuerdo(datos, aceptadas);
  /* La información de protección de datos se tiene que haber dado ANTES de
     recoger nada. Si no llega marcada, no se guarda. */
  if (cuerpo.privacidad !== true) errores.privacidad = 'Falta confirmar la información de protección de datos.';
  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ ok: false, errores }, { status: 400 });
  }

  const ip =
    peticion.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    peticion.headers.get('x-real-ip') ||
    'desconocida';

  /* El freno va DESPUÉS de validar, a propósito: así quien se equivoca al
     escribir su documento y lo reintenta tres veces no se queda fuera por rápido. */
  if (vaDemasiadoRapido(ip)) {
    return NextResponse.json({ ok: false, motivo: 'demasiado-rapido' }, { status: 429 });
  }

  const base = baseDeDatos();
  const referencia = referenciaNueva();

  /*
   * La hora la pone el servidor, nunca el navegador.
   *
   * `serverTimestamp` la escribe Firestore, así que no depende ni del reloj de
   * quien firma ni del de este proceso. Y se guarda además en ISO para poder
   * leerla sin convertir nada.
   */
  const ahora = new Date().toISOString();

  /*
   * La escritura va envuelta, y no por costumbre.
   *
   * Si Firestore rechaza la credencial —la clave privada mal pegada en el
   * panel del servidor es el caso típico— esto lanza, y una excepción que sale
   * de aquí la convierte la plataforma en su propia página de error en HTML.
   * El navegador entonces no encuentra JSON donde esperaba, y quien firma veía
   * «revisa tu conexión» por un problema que no tenía nada que ver con su
   * conexión. Fallando aquí, el motivo llega escrito y se puede arreglar.
   */
  try {
    await base
      .collection(COLECCION)
      .doc(referencia)
      .set({
        ...datos,
        referencia,
        firmadoEl: ahora,
        creadoEn: FieldValue.serverTimestamp(),
        /* La copia congelada: qué se le enseñó exactamente. */
        version: VERSION_ACUERDO,
        titulo: TITULO_ACUERDO,
        clausulas: CLAUSULAS,
        cierre: CIERRE_ACUERDO,
        prueba: {
          ip,
          navegador: recortar(peticion.headers.get('user-agent'), 300),
        },
        /* Para el embudo: quien firma todavía no es alumna, es alguien que va a
           serlo. Sorela le da el acceso al curso desde su pantalla. */
        estado: 'firmado',
        /* La prueba de que se le informó antes de firmar: cuándo y de qué
           versión de la política. */
        privacidad: { informada: true, fecha: ahora, politica: REVISADA },
      });
  } catch (error) {
    console.error('[acuerdos] no se ha podido guardar', error);
    return NextResponse.json({ ok: false, motivo: 'base-rechaza' }, { status: 502 });
  }

  /*
   * El correo sale DESPUÉS de responder, con `after`.
   *
   * Antes se lanzaba con un `void` y la respuesta salía a la vez. En un
   * servidor normal eso funciona; en Vercel no: la función se congela en
   * cuanto responde, y lo que quedaba a medias —el correo entero— no llegaba
   * a salir nunca. `after` le dice a la plataforma que espere a que termine.
   *
   * Y sigue sin bloquear a quien firma: la firma ya está guardada, que es lo
   * que importa, y no tiene por qué esperar a que Google acepte dos PDF.
   */
  after(() => enviarAcuerdo(referencia));

  return NextResponse.json({
    ok: true,
    referencia,
    firmadoEl: ahora,
    dossier: enlaceDelDossier(referencia),
  });
}

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) {
    return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  }
  if (sesion.rol !== 'sorela') {
    return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  }
  if (!hayFirebase()) {
    return NextResponse.json({ ok: true, acuerdos: [] });
  }

  const base = baseDeDatos();
  const docs = await base.collection(COLECCION).orderBy('firmadoEl', 'desc').limit(300).get();

  const acuerdos = docs.docs.map((d) => {
    const x = d.data();
    return {
      referencia: String(x.referencia ?? d.id),
      nombre: String(x.nombre ?? ''),
      apellidos: String(x.apellidos ?? ''),
      documento: String(x.documento ?? ''),
      correo: String(x.correo ?? ''),
      telefono: String(x.telefono ?? ''),
      lugar: String(x.lugar ?? ''),
      firmadoEl: String(x.firmadoEl ?? ''),
      version: String(x.version ?? ''),
      estado: String(x.estado ?? 'firmado'),
      descargas: Number(x.descargas ?? 0),
      correoEnviado: Boolean(x.envioCorreo?.enviado),
      correoDetalle: String(x.envioCorreo?.detalle ?? 'Pendiente'),
      correoFecha: String(x.envioCorreo?.fecha ?? ''),
    };
  });

  return NextResponse.json({ ok: true, acuerdos });
}
