import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { baseDeDatos } from './firebase-servidor';
import { enviar, hayCorreo } from './correo';
import { pdfDelAcuerdo, type AcuerdoGuardado } from './acuerdo-pdf';
import { leerFirmaSorela } from './firma-sorela';

/**
 * El correo que recibe quien acaba de firmar el acuerdo.
 *
 * Lleva DOS ADJUNTOS: su acuerdo firmado en PDF y el dossier del precurso. Y
 * además el enlace al dossier, por si el adjunto se queda por el camino.
 *
 * Sale primero por el Apps Script de Sorela, que es por donde salen todos los
 * correos de la web. Si el script no está o todavía es la versión anterior
 * —que no sabe qué hacer con un acuerdo y mandaría el correo genérico de
 * información—, sale por SMTP si está configurado.
 *
 * EL RESULTADO SE APUNTA EN EL PROPIO ACUERDO. Antes el envío se lanzaba sin
 * esperar y sin dejar rastro: si no salía, nadie se enteraba hasta que la
 * alumna preguntaba. Ahora la ficha dice si salió, por dónde y, si no, por
 * qué; y desde la plataforma se puede reenviar.
 */

const COLECCION = 'acuerdos';

/** Quince segundos: dos PDF en base64 tardan algo más en subir que un formulario. */
const ESPERA_MAX = 15_000;

export type ResultadoCorreo = {
  enviado: boolean;
  via: 'apps-script' | 'smtp' | 'ninguna';
  fecha: string;
  detalle: string;
};

function web(): string {
  const v = (process.env.NEXT_PUBLIC_WEB || '').trim().replace(/\/+$/, '');
  return v || 'https://www.sorelacarodivine.com';
}

export function enlaceDelDossier(referencia: string): string {
  return `${web()}/api/dossier?ref=${encodeURIComponent(referencia)}`;
}

/** Lee el acuerdo tal como se guardó. */
export async function acuerdoGuardado(referencia: string): Promise<AcuerdoGuardado | null> {
  const doc = await baseDeDatos().collection(COLECCION).doc(referencia).get();
  if (!doc.exists) return null;
  const x = doc.data() ?? {};
  return {
    referencia: String(x.referencia ?? doc.id),
    nombre: String(x.nombre ?? ''),
    apellidos: String(x.apellidos ?? ''),
    documento: String(x.documento ?? ''),
    correo: String(x.correo ?? ''),
    telefono: String(x.telefono ?? ''),
    lugar: String(x.lugar ?? ''),
    firma: String(x.firma ?? ''),
    firmadoEl: String(x.firmadoEl ?? ''),
    version: String(x.version ?? ''),
    titulo: String(x.titulo ?? ''),
    clausulas: Array.isArray(x.clausulas) ? x.clausulas : [],
    cierre: String(x.cierre ?? ''),
    prueba: x.prueba ?? {},
  };
}

const nombreArchivo = (a: AcuerdoGuardado) =>
  `Acuerdo-confidencialidad-${a.referencia}.pdf`;

async function porAppsScript(
  a: AcuerdoGuardado,
  acuerdo: Uint8Array,
  dossier: Buffer | null
): Promise<{ ok: boolean; detalle: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  const secreto = process.env.APPS_SCRIPT_SECRETO;
  if (!url || !secreto) return { ok: false, detalle: 'No hay Apps Script configurado.' };

  const adjuntos = [
    { nombre: nombreArchivo(a), tipo: 'application/pdf', base64: Buffer.from(acuerdo).toString('base64') },
  ];
  if (dossier) {
    adjuntos.push({ nombre: 'Dossier-Tecnica-Divine.pdf', tipo: 'application/pdf', base64: dossier.toString('base64') });
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: AbortSignal.timeout(ESPERA_MAX),
      body: JSON.stringify({
        secreto,
        origen: 'acuerdo',
        nombre: `${a.nombre} ${a.apellidos}`.trim(),
        correo: a.correo,
        telefono: a.telefono,
        referencia: a.referencia,
        enlaceDossier: enlaceDelDossier(a.referencia),
        mensaje: `Acuerdo de confidencialidad firmado. Referencia ${a.referencia}.`,
        adjuntos,
      }),
    });
    const respuesta = (await r.json()) as { ok?: boolean; tipo?: string; motivo?: string };

    /* La versión anterior del script responde «ok» igual, pero sin saber qué
       es un acuerdo: manda el correo genérico de información, sin el contrato.
       Se distingue porque la nueva devuelve `tipo: 'acuerdo'`. */
    if (respuesta?.ok && respuesta.tipo === 'acuerdo') return { ok: true, detalle: 'Enviado.' };
    if (respuesta?.ok) {
      return {
        ok: false,
        detalle:
          'El Apps Script es la versión antigua: hay que volver a desplegarlo para que mande el contrato.',
      };
    }
    return { ok: false, detalle: `El Apps Script ha respondido: ${respuesta?.motivo ?? 'error'}.` };
  } catch (error) {
    return { ok: false, detalle: `No se ha podido hablar con el Apps Script: ${String(error)}` };
  }
}

async function porSmtp(a: AcuerdoGuardado, acuerdo: Uint8Array, dossier: Buffer | null) {
  const n = a.nombre.split(/\s+/)[0] || '';
  const enlace = enlaceDelDossier(a.referencia);
  const texto = [
    n ? `Hola, ${n}.` : 'Hola.',
    '',
    'Queda firmado tu acuerdo de confidencialidad de la Técnica Divine. Gracias.',
    '',
    `Tu referencia es ${a.referencia}. Te adjunto tu acuerdo firmado y tu dossier del precurso.`,
    `Si el dossier no te llega adjunto, lo tienes también aquí: ${enlace}`,
    '',
    'Es un documento confidencial: lo que has firmado dice que no se reproduce, ni se modifica, ni se comparte con nadie.',
    '',
    'Nos vemos en la formación.',
    'Sorela',
  ].join('\n');

  const adjuntos: { nombre: string; contenido: Buffer; tipo: string }[] = [
    { nombre: nombreArchivo(a), contenido: Buffer.from(acuerdo), tipo: 'application/pdf' },
  ];
  if (dossier) adjuntos.push({ nombre: 'Dossier-Tecnica-Divine.pdf', contenido: dossier, tipo: 'application/pdf' });

  await enviar({
    para: a.correo,
    asunto: `Tu acuerdo firmado y tu dossier${n ? `, ${n}` : ''}`,
    texto,
    adjuntos,
  });
}

/**
 * Manda el correo del acuerdo y apunta el resultado en la ficha.
 *
 * Nunca lanza: lo llaman tanto la firma —después de responder— como el botón
 * de reenviar de la plataforma, y en ninguno de los dos casos un fallo de
 * correo puede deshacer una firma que ya está guardada.
 */
export async function enviarAcuerdo(referencia: string): Promise<ResultadoCorreo> {
  const fecha = new Date().toISOString();
  let resultado: ResultadoCorreo;

  try {
    const a = await acuerdoGuardado(referencia);
    if (!a) return { enviado: false, via: 'ninguna', fecha, detalle: 'No existe ese acuerdo.' };

    const acuerdo = await pdfDelAcuerdo(a, { firmaSorela: await leerFirmaSorela() });
    let dossier: Buffer | null = null;
    try {
      dossier = await readFile(path.join(process.cwd(), 'docs', 'dossier.pdf'));
    } catch {
      dossier = null;
    }

    const apps = await porAppsScript(a, acuerdo, dossier);
    if (apps.ok) {
      resultado = { enviado: true, via: 'apps-script', fecha, detalle: apps.detalle };
    } else if (hayCorreo()) {
      try {
        await porSmtp(a, acuerdo, dossier);
        resultado = { enviado: true, via: 'smtp', fecha, detalle: `Enviado por SMTP. (${apps.detalle})` };
      } catch (error) {
        resultado = { enviado: false, via: 'ninguna', fecha, detalle: `${apps.detalle} SMTP: ${String(error)}` };
      }
    } else {
      resultado = { enviado: false, via: 'ninguna', fecha, detalle: apps.detalle };
    }
  } catch (error) {
    resultado = { enviado: false, via: 'ninguna', fecha, detalle: String(error) };
  }

  try {
    /* En `envioCorreo` y NO en `correo`: `correo` es la dirección de la
       alumna. Guardarlo ahí borraba el email de la persona a quien había que
       escribir, justo en el campo que hace falta para reenviárselo. */
    await baseDeDatos().collection(COLECCION).doc(referencia).update({ envioCorreo: resultado });
  } catch (error) {
    console.error('[acuerdos] no se ha podido apuntar el resultado del correo', error);
  }

  if (!resultado.enviado) console.error('[acuerdos] el correo no ha salido', referencia, resultado.detalle);
  return resultado;
}
