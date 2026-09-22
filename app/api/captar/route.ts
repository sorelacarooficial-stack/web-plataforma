import { NextResponse } from 'next/server';
import { revisar, type Contacto, type Fallo } from '@/lib/captacion';

/**
 * Recibe el formulario de captación y se lo pasa al Apps Script de Google,
 * que es quien escribe la fila en la hoja y manda los correos.
 *
 * Por qué pasa por aquí y el formulario no llama a Google directamente:
 *
 *  1. La dirección del Apps Script quedaría a la vista en el navegador. Con
 *     ella cualquiera puede meter filas en la hoja de Sorela desde su casa.
 *  2. Aquí se valida y se corta el abuso antes de gastar cuota de Google, que
 *     es limitada y se agota para todo el día.
 *  3. Un navegador no puede llamar a script.google.com sin pelearse con CORS.
 *     Servidor contra servidor no existe ese problema.
 *
 * Las dos variables de entorno se ponen en Vercel → Settings → Environment
 * Variables. Si falta alguna, la ruta lo dice con 503 y el formulario enseña
 * la salida por WhatsApp: preferimos que la persona nos escriba ella a
 * decirle «gracias» y perder el contacto.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DESTINO = process.env.APPS_SCRIPT_URL;
const SECRETO = process.env.APPS_SCRIPT_SECRETO;

/** Google puede tardar en despertar el script. Más de 10 s ya es un abandono. */
const ESPERA_MAX = 10_000;

/**
 * Freno por IP. Vive en memoria, así que en Vercel cada instancia lleva su
 * propia cuenta y el límite real es más flojo que el de aquí. No pasa nada:
 * esto no es seguridad, es evitar que un script tonto llene la hoja. El
 * secreto compartido es lo que de verdad protege el Apps Script.
 */
const HUELLAS = new Map<string, number[]>();
const VENTANA = 60_000;
const MAX_POR_VENTANA = 5;

function vaDemasiadoRapido(ip: string): boolean {
  const ahora = Date.now();
  const previas = (HUELLAS.get(ip) ?? []).filter((t) => ahora - t < VENTANA);
  previas.push(ahora);
  HUELLAS.set(ip, previas);

  // Barrido perezoso: sin esto el Map crece sin fin en una instancia longeva.
  if (HUELLAS.size > 500) {
    for (const [clave, marcas] of HUELLAS) {
      if (marcas.every((t) => ahora - t >= VENTANA)) HUELLAS.delete(clave);
    }
  }
  return previas.length > MAX_POR_VENTANA;
}

const falla = (motivo: Fallo, estado: number, extra: object = {}) =>
  NextResponse.json({ ok: false, motivo, ...extra }, { status: estado });

export async function POST(peticion: Request) {
  let cuerpo: Partial<Contacto>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return falla('datos', 400, { errores: {} });
  }

  // Señuelo: es un campo escondido que una persona no ve ni puede rellenar.
  // Si viene con algo es un robot. Se le contesta que todo ha ido bien para
  // que no pruebe otra cosa, y no se guarda nada.
  if (cuerpo.empresa) return NextResponse.json({ ok: true });

  const revision = revisar(cuerpo);
  if (!revision.ok) return falla('datos', 400, { errores: revision.errores });

  const ip =
    peticion.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    peticion.headers.get('x-real-ip') ||
    'desconocida';
  if (vaDemasiadoRapido(ip)) return falla('ritmo', 429);

  if (!DESTINO || !SECRETO) {
    console.error('[captar] Falta APPS_SCRIPT_URL o APPS_SCRIPT_SECRETO en el entorno.');
    return falla('sin-destino', 503);
  }

  const corte = AbortSignal.timeout(ESPERA_MAX);
  try {
    const respuesta = await fetch(DESTINO, {
      method: 'POST',
      // Apps Script responde con una redirección 302 a googleusercontent.com
      // y hay que seguirla para leer el resultado de verdad.
      redirect: 'follow',
      // text/plain a propósito: con application/json el navegador pediría
      // permiso previo y Apps Script no sabe contestarlo. Desde el servidor da
      // igual, pero así el mismo script vale si alguna vez se llama de otra
      // forma. Google entrega el cuerpo entero en e.postData.contents igual.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...revision.datos, secreto: SECRETO }),
      signal: corte,
    });

    const texto = await respuesta.text();
    let resultado: { ok?: boolean; motivo?: string } = {};
    try {
      resultado = JSON.parse(texto);
    } catch {
      // Apps Script devuelve una página HTML de error cuando el despliegue no
      // es público o la autorización ha caducado. Es el fallo más habitual al
      // montarlo, así que se deja escrito en el registro tal cual viene.
      console.error('[captar] El Apps Script no ha devuelto JSON:', texto.slice(0, 300));
      return falla('destino', 502);
    }

    if (!respuesta.ok || !resultado.ok) {
      console.error('[captar] El Apps Script ha rechazado el envío:', resultado.motivo ?? texto);
      return falla('destino', 502);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const porTiempo = e instanceof Error && e.name === 'TimeoutError';
    console.error(`[captar] ${porTiempo ? 'Google ha tardado demasiado' : 'Fallo al llamar'}:`, e);
    return falla('destino', 502);
  }
}
