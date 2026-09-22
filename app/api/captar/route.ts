import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { revisar, type Contacto, type Fallo } from '@/lib/captacion';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { enviar, hayCorreo } from '@/lib/correo';
import { correoAviso, correoBienvenida } from '@/lib/plantillas-correo';

/**
 * Recibe el formulario de captación, guarda el contacto y manda los correos.
 *
 * REPARTO DE PAPELES, que no es caprichoso:
 *
 *   Firestore  →  guarda. Es la fuente de verdad.
 *   Apps Script → manda los dos correos (y de paso deja su fila en la hoja
 *                 de Google, que sirve de copia de seguridad legible).
 *
 * Firebase manda el correo solo en plan de pago: en el plan gratuito (Spark)
 * no hay Cloud Functions ni extensión de correo. Por eso el envío sale del
 * Apps Script, que usa la cuenta de Gmail de Sorela y no cuesta nada.
 *
 * El orden importa: PRIMERO se guarda, DESPUÉS se envía. Si el correo falla,
 * el contacto ya está a salvo y para la persona la cosa ha ido bien, porque
 * Sorela tiene su dato y puede escribirle. Al revés —enviar primero, guardar
 * después— un fallo al guardar dejaría a alguien con un correo de bienvenida
 * al que nadie va a volver a escribir.
 *
 * Si no hay dónde guardar, sí se contesta con error y el formulario enseña la
 * salida por WhatsApp. Un contacto perdido no se recupera.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ESPERA_MAX = 10_000;

/**
 * Freno por IP. Vive en memoria, así que en Vercel cada instancia lleva su
 * propia cuenta y el límite real es más flojo que el de aquí. No es seguridad:
 * es evitar que un script tonto llene la base de datos.
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

const falla = (motivo: Fallo, estado: number, extra: object = {}) =>
  NextResponse.json({ ok: false, motivo, ...extra }, { status: estado });

const hayAppsScript = () =>
  Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_SECRETO);

/**
 * Llama al Apps Script, que guarda su fila y manda los dos correos: el de
 * bienvenida con la información de la técnica y el aviso a Sorela.
 */
async function llamarAppsScript(datos: Contacto & { origen: string }): Promise<boolean> {
  if (!hayAppsScript()) return false;

  try {
    const r = await fetch(process.env.APPS_SCRIPT_URL as string, {
      method: 'POST',
      // Apps Script responde con una redirección a googleusercontent.com y hay
      // que seguirla para leer el resultado de verdad.
      redirect: 'follow',
      // text/plain a propósito: con application/json el navegador pediría
      // permiso previo y Apps Script no sabe contestarlo. Desde el servidor da
      // igual, pero así el mismo script vale si alguna vez se llama de otra
      // forma. Google entrega el cuerpo entero en e.postData.contents igual.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...datos, secreto: process.env.APPS_SCRIPT_SECRETO }),
      signal: AbortSignal.timeout(ESPERA_MAX),
    });

    const texto = await r.text();
    try {
      return Boolean(JSON.parse(texto).ok);
    } catch {
      // Apps Script devuelve una página HTML de error cuando el despliegue no
      // es público o la autorización ha caducado. Es el fallo más habitual al
      // montarlo, así que se deja en el registro tal cual viene.
      console.error('[captar] El Apps Script no devolvió JSON:', texto.slice(0, 300));
      return false;
    }
  } catch (e) {
    const porTiempo = e instanceof Error && e.name === 'TimeoutError';
    console.error(`[captar] ${porTiempo ? 'Google tardó demasiado' : 'Fallo al llamar a Google'}:`, e);
    return false;
  }
}

/**
 * Salida de emergencia para el correo: solo se usa si NO hay Apps Script
 * configurado y sí hay SMTP. Sirve para el día que las 100 diarias de Gmail se
 * queden cortas y se contrate un servicio de envíos de verdad.
 */
async function correoPorSmtp(datos: Contacto & { origen: string }): Promise<boolean> {
  if (!hayCorreo()) return false;

  const paraSorela = process.env.CORREO_AVISOS || process.env.CORREO_DE;
  const resultados = await Promise.allSettled([
    enviar({ para: datos.correo, ...correoBienvenida(datos) }),
    paraSorela
      ? enviar({ para: paraSorela, ...correoAviso(datos), responderA: datos.correo })
      : Promise.resolve(),
  ]);

  resultados.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[captar] No salió el correo ${i === 0 ? 'de bienvenida' : 'de aviso'}:`, r.reason);
    }
  });

  return resultados[0].status === 'fulfilled';
}

export async function POST(peticion: Request) {
  let cuerpo: Partial<Contacto>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return falla('datos', 400, { errores: {} });
  }

  // Señuelo: campo escondido que una persona no ve ni puede rellenar. Si trae
  // algo es un robot. Se le contesta que todo ha ido bien para que no pruebe
  // otra cosa, y no se guarda nada.
  if (cuerpo.empresa) return NextResponse.json({ ok: true });

  const revision = revisar(cuerpo);
  if (!revision.ok) return falla('datos', 400, { errores: revision.errores });
  const datos = revision.datos;

  const ip =
    peticion.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    peticion.headers.get('x-real-ip') ||
    'desconocida';
  if (vaDemasiadoRapido(ip)) return falla('ritmo', 429);

  /* ---------- 1. Guardar en Firestore ---------- */
  let enFirestore = false;

  if (hayFirebase()) {
    try {
      // El identificador del documento es el propio correo: si la misma
      // persona vuelve a rellenar el formulario —cosa habitual cuando alguien
      // escanea un QR dos veces—, se actualiza su ficha en vez de crear un
      // duplicado que luego hay que limpiar a mano.
      const id = datos.correo.replace(/\//g, '_');
      const ref = baseDeDatos().collection(COLECCIONES.contactos).doc(id);
      const previo = await ref.get();

      await ref.set(
        {
          ...datos,
          // La hora la pone el servidor de Google, no el navegador de quien
          // rellena: los relojes de los móviles vienen torcidos.
          actualizado: FieldValue.serverTimestamp(),
          ...(previo.exists ? {} : { creado: FieldValue.serverTimestamp() }),
          veces: FieldValue.increment(1),
        },
        { merge: true }
      );
      enFirestore = true;
    } catch (e) {
      console.error('[captar] Firestore ha fallado:', e);
    }
  }

  /* ---------- 2. Correos por Apps Script ---------- */
  // Se llama aunque Firestore haya fallado: además de mandar los correos deja
  // su fila en la hoja, así que sirve de red de seguridad para el dato.
  const porAppsScript = await llamarAppsScript(datos);

  const correoEnviado = porAppsScript || (!hayAppsScript() && (await correoPorSmtp(datos)));
  const guardado = enFirestore || porAppsScript;

  if (!guardado) {
    console.error(
      '[captar] No hay dónde guardar. Revisa las variables de Firebase y del Apps Script en Vercel.'
    );
    return falla(hayFirebase() || hayAppsScript() ? 'destino' : 'sin-destino', hayFirebase() || hayAppsScript() ? 502 : 503);
  }

  if (!correoEnviado) {
    console.warn('[captar] Contacto guardado pero sin correo de bienvenida.');
  }

  // correoEnviado viaja al navegador para que el mensaje de confirmación no
  // prometa un correo que no ha salido.
  return NextResponse.json({ ok: true, correoEnviado });
}
