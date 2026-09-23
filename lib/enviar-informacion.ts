import type { Contacto } from './captacion';
import { enviar, hayCorreo } from './correo';
import { correoAviso, correoBienvenida } from './plantillas-correo';

/**
 * Mandar la información de la Técnica Divine a una persona.
 *
 * Esto vivía dentro de `app/api/captar/route.ts` y solo lo usaba el formulario
 * de la web. Ahora lo usan dos sitios —el formulario y el alta a mano de la
 * plataforma— y por eso está aquí: el correo que recibe quien deja sus datos
 * en la portada y el que recibe quien Sorela apunta en una feria tienen que
 * ser el mismo, palabra por palabra y con el mismo PDF. Con el código copiado,
 * el día que se cambie uno se queda el otro sin cambiar y nadie se entera.
 *
 * Quien manda de verdad es un Apps Script en la cuenta de Google de Sorela:
 * este servidor no envía correos. El script hace tres cosas de una vez: guarda
 * la fila en la hoja de respaldo, manda el correo de bienvenida con el PDF y
 * le avisa a ella. El SMTP de abajo es la salida para el día en que las cien
 * diarias de Gmail se queden cortas.
 */

/** Diez segundos. Apps Script tarda, pero no tanto. */
const ESPERA_MAX = 10_000;

/**
 * Las dos cosas por separado, y no una sola, porque son dos preguntas
 * distintas: si SALIÓ EL CORREO decide qué se le dice a quien mira la
 * pantalla, y si QUEDÓ GUARDADA decide si el contacto se ha perdido.
 * Juntándolas, un correo que falla con Firestore caído daría el contacto por
 * perdido aunque su fila estuviera escrita en la hoja.
 */
export type Envio = { correo: boolean; guardado: boolean };

const NADA: Envio = { correo: false, guardado: false };

export const hayAppsScript = () =>
  Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_SECRETO);

async function llamarAppsScript(datos: Contacto & { origen: string }): Promise<Envio> {
  if (!hayAppsScript()) return NADA;

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
      const c = JSON.parse(texto);
      return { correo: Boolean(c.ok), guardado: Boolean(c.guardado ?? c.ok) };
    } catch {
      // Apps Script devuelve una página HTML de error cuando el despliegue no
      // es público o la autorización ha caducado. Es el fallo más habitual al
      // montarlo, así que se deja en el registro tal cual viene.
      console.error('[correo] El Apps Script no devolvió JSON:', texto.slice(0, 300));
      return NADA;
    }
  } catch (e) {
    const porTiempo = e instanceof Error && e.name === 'TimeoutError';
    console.error(`[correo] ${porTiempo ? 'Google tardó demasiado' : 'Fallo al llamar a Google'}:`, e);
    return NADA;
  }
}

/**
 * Salida de emergencia: solo se usa si NO hay Apps Script configurado y sí hay
 * SMTP. Para el día que las cien diarias de Gmail se queden cortas y se
 * contrate un servicio de envíos de verdad.
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
      console.error(`[correo] No salió el correo ${i === 0 ? 'de bienvenida' : 'de aviso'}:`, r.reason);
    }
  });

  return resultados[0].status === 'fulfilled';
}

/**
 * Manda la información y dice qué ha pasado.
 *
 * Sin correo no hay a dónde mandarla: se devuelve que no salió, que es la
 * verdad, en vez de dar por bueno un envío que no ha ocurrido.
 */
export async function mandarInformacion(datos: Contacto & { origen: string }): Promise<Envio> {
  if (!datos.correo) return NADA;

  const google = await llamarAppsScript(datos);
  // El SMTP solo entra si no hay Apps Script: si lo hay y ha fallado, mandar
  // por las dos vías acabaría con la misma persona recibiendo el correo dos
  // veces el día que el script conteste tarde pero sí haya enviado.
  const correo = google.correo || (!hayAppsScript() && (await correoPorSmtp(datos)));
  return { correo, guardado: google.guardado };
}
