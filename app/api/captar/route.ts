import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { revisar, type Contacto, type Fallo } from '@/lib/captacion';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { enviar, hayCorreo } from '@/lib/correo';
import { correoAviso, correoBienvenida } from '@/lib/plantillas-correo';

/**
 * Recibe el formulario de captación, guarda el contacto en Firestore y manda
 * los dos correos.
 *
 * El orden importa y es deliberado: PRIMERO se guarda, DESPUÉS se envía. Si el
 * correo falla, el contacto ya está a salvo y la persona ve que ha ido bien,
 * porque para ella ha ido bien: Sorela tiene su dato y puede escribirle. Al
 * revés —enviar primero y guardar después— un fallo al guardar dejaría a una
 * persona con un correo de bienvenida a la que nadie va a volver a escribir.
 *
 * Si lo que falla es Firestore, entonces sí se contesta con error, y el
 * formulario enseña la salida por WhatsApp. Un contacto perdido no se
 * recupera.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ESPERA_MAX = 10_000;

/**
 * Freno por IP. Vive en memoria, así que en Vercel cada instancia lleva su
 * propia cuenta y el límite real es más flojo que el de aquí. No es una medida
 * de seguridad: es evitar que un script tonto llene la base de datos.
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

/** Plan B mientras Firebase no esté configurado: el Apps Script de Google. */
async function guardarEnAppsScript(datos: Contacto & { origen: string }) {
  const destino = process.env.APPS_SCRIPT_URL;
  const secreto = process.env.APPS_SCRIPT_SECRETO;
  if (!destino || !secreto) return false;

  const r = await fetch(destino, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...datos, secreto }),
    signal: AbortSignal.timeout(ESPERA_MAX),
  });
  const texto = await r.text();
  try {
    return Boolean(JSON.parse(texto).ok);
  } catch {
    console.error('[captar] El Apps Script no devolvió JSON:', texto.slice(0, 300));
    return false;
  }
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

  /* ---------- 1. Guardar. Sin esto, no hay «gracias». ---------- */
  let guardado = false;

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
      guardado = true;
    } catch (e) {
      console.error('[captar] Firestore ha fallado:', e);
    }
  }

  if (!guardado) {
    try {
      guardado = await guardarEnAppsScript(datos);
      if (guardado) console.warn('[captar] Guardado en Apps Script: Firebase no estaba disponible.');
    } catch (e) {
      console.error('[captar] El plan B de Apps Script también ha fallado:', e);
    }
  }

  if (!guardado) {
    console.error('[captar] No hay dónde guardar. Revisa las variables de Firebase en Vercel.');
    return falla(hayFirebase() ? 'destino' : 'sin-destino', hayFirebase() ? 502 : 503);
  }

  /* ---------- 2. Avisar. Si falla, el contacto ya está a salvo. ---------- */
  let correoEnviado = false;

  if (hayCorreo()) {
    const bienvenida = correoBienvenida(datos);
    const aviso = correoAviso(datos);
    const paraSorela = process.env.CORREO_AVISOS || process.env.CORREO_DE;

    const resultados = await Promise.allSettled([
      enviar({ para: datos.correo, ...bienvenida }),
      paraSorela
        ? enviar({ para: paraSorela, ...aviso, responderA: datos.correo })
        : Promise.resolve(),
    ]);

    correoEnviado = resultados[0].status === 'fulfilled';
    resultados.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[captar] No salió el correo ${i === 0 ? 'de bienvenida' : 'de aviso'}:`, r.reason);
      }
    });
  } else {
    console.warn('[captar] Contacto guardado pero sin correo: faltan las variables SMTP.');
  }

  // correoEnviado viaja al navegador para que el mensaje de confirmación no
  // prometa un correo que no ha salido.
  return NextResponse.json({ ok: true, correoEnviado });
}
