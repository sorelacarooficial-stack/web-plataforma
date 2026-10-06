/**
 * El correo que recibe quien acaba de firmar el acuerdo.
 *
 * Lleva su referencia y el enlace a su dossier. NO lleva el dossier adjunto:
 * un adjunto, una vez enviado, no se puede retirar ni se sabe quién acaba
 * teniéndolo, y es justo el documento que ella se acaba de comprometer por
 * escrito a no divulgar. El enlace va atado a la referencia de su firma, así
 * que queda registrado cuándo se descarga.
 *
 * Lo manda el mismo Apps Script que manda todo lo demás —este servidor no
 * envía correos—, con `origen: 'acuerdo'`, que allí tiene su propio texto.
 *
 * SI FALLA, NO PASA NADA GRAVE, y por eso no se espera a que termine: la firma
 * ya está guardada y Sorela la ve en su plataforma. El correo es una cortesía
 * útil, no el acto jurídico. Hacer que el formulario se quedara colgado diez
 * segundos esperando a Google sería cambiar algo que importa por algo que no.
 */

/** Cinco segundos. Si Apps Script tarda más, que termine por su cuenta. */
const ESPERA_MAX = 5_000;

export type DatosDossier = {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  referencia: string;
};

/** La dirección pública de la web, para construir el enlace del dossier. */
function web(): string {
  const v = (process.env.NEXT_PUBLIC_WEB || '').trim().replace(/\/+$/, '');
  return v || 'https://www.sorelacarodivine.com';
}

export function enlaceDelDossier(referencia: string): string {
  return `${web()}/api/dossier?ref=${encodeURIComponent(referencia)}`;
}

export async function enviarDossier(datos: DatosDossier): Promise<boolean> {
  const url = process.env.APPS_SCRIPT_URL;
  const secreto = process.env.APPS_SCRIPT_SECRETO;
  if (!url || !secreto) return false;

  const corte = AbortSignal.timeout(ESPERA_MAX);

  try {
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      /* text/plain a propósito: es lo que Apps Script sabe recibir sin pedir
         permiso previo. Ver `lib/enviar-informacion.ts`. */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: corte,
      body: JSON.stringify({
        secreto,
        origen: 'acuerdo',
        nombre: `${datos.nombre} ${datos.apellidos}`.trim(),
        correo: datos.correo,
        telefono: datos.telefono,
        referencia: datos.referencia,
        enlaceDossier: enlaceDelDossier(datos.referencia),
        mensaje: `Acuerdo de confidencialidad firmado. Referencia ${datos.referencia}.`,
      }),
    });

    const respuesta = (await r.json()) as { ok?: boolean };
    return Boolean(respuesta?.ok);
  } catch (error) {
    console.error('[acuerdos] no ha salido el correo del dossier', error);
    return false;
  }
}
