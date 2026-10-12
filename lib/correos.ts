import 'server-only';
import { createHmac } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from './firebase-servidor';
import { enviar as enviarSmtp, hayCorreo as haySmtp } from './correo';
import { AUTOMATIZACIONES, type IdAutomatizacion } from './automatizaciones';

/**
 * El motor de los correos automáticos.
 *
 * TODO correo que sale de la web pasa por aquí, por tres razones:
 *
 *  1. Queda apuntado en la colección `correos`: a quién, qué, cuándo y si
 *     salió. Es lo que enseña el historial de la pantalla Correos y la ficha
 *     de cada contacto. Antes no se sabía si a alguien le había llegado algo.
 *  2. Nadie recibe el mismo correo dos veces. Cada envío automático lleva una
 *     `clave` (p. ej. `acceso-formacion:uid`) que es el id del documento: si
 *     ya está como enviado, no se repite, aunque el cron corra dos veces o se
 *     quite y se vuelva a dar el acceso.
 *  3. La vía de salida se elige en un solo sitio, y cambiarla es poner una
 *     variable en Vercel:
 *        RESEND_API_KEY   → Resend, desde el dominio (lo recomendable)
 *        SMTP_*           → cualquier SMTP (Gmail con contraseña de aplicación)
 *        APPS_SCRIPT_*    → el Gmail de Sorela a través de su Apps Script
 */

export const COLECCION_CORREOS = 'correos';

export type Via = 'resend' | 'smtp' | 'apps-script';
export type EstadoCorreo = 'enviado' | 'fallido' | 'omitido';

export type RegistroCorreo = {
  para: string;
  tipo: IdAutomatizacion | 'campana' | 'prueba' | 'manual' | 'aviso-interno';
  asunto: string;
  via: Via | null;
  estado: EstadoCorreo;
  detalle?: string;
  contactoId?: string;
  uid?: string;
  campanaId?: string;
};

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';

/** Si hay Resend: entonces TODO sale desde el dominio, también la bienvenida y el acuerdo. */
export const hayResend = () => Boolean(process.env.RESEND_API_KEY);

/** La vía por la que saldría un correo ahora mismo, o null si no hay ninguna. */
export function viaDeEnvio(): Via | null {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (haySmtp()) return 'smtp';
  if (process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_SECRETO) return 'apps-script';
  return null;
}

/** A quién le llegan los avisos y el resumen diario. */
export function correoDeSorela(): string | null {
  const c =
    process.env.CORREO_AVISOS ||
    (process.env.ADMIN_CORREOS || '').split(',').map((x) => x.trim()).find(Boolean) ||
    '';
  return c || null;
}

/** Deja constancia de un correo. Nunca falla: un historial roto no puede tumbar un envío. */
export async function apuntarCorreo(r: RegistroCorreo, clave?: string) {
  if (!hayFirebase()) return;
  try {
    const col = baseDeDatos().collection(COLECCION_CORREOS);
    const ref = clave ? col.doc(clave) : col.doc();
    await ref.set({
      ...r,
      para: r.para.toLowerCase(),
      cuando: FieldValue.serverTimestamp(),
      ...(clave ? { clave } : {}),
    });
  } catch (e) {
    console.error('[correos] No se pudo apuntar el envío:', e);
  }
}

/* ---------------------------------------------------------------- vías */

async function porResend(c: Correo): Promise<void> {
  const de = process.env.CORREO_DE_RESEND || `Sorela Caro <hola@${new URL(WEB).hostname.replace(/^www\./, '')}>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: de,
      to: [c.para],
      subject: c.asunto,
      text: c.texto,
      html: c.html,
      /* Si el buzón hola@ está conectado a la plataforma, las respuestas van
         ahí, para leerlas y contestarlas en «Buzón». Si no, a su Gmail. */
      reply_to: c.responderA || (process.env.BUZON_CLAVE ? de.replace(/^.*<|>$/g, '') : correoDeSorela()) || undefined,
      /* Baja en un clic desde el propio Gmail (el botón «Anular suscripción»
         junto al remitente). Gmail y Yahoo lo EXIGEN desde 2024 a quien manda
         correos a listas; sin esto, esos correos van a spam. Apunta a la API,
         que acepta el POST que hacen ellos sin pasar por la página. */
      ...(c.baja || c.cabeceras
        ? {
            headers: {
              ...(c.cabeceras ?? {}),
              ...(c.baja
                ? {
                    'List-Unsubscribe': `<${bajaDirecta(c.para)}>, <mailto:${correoDeSorela() ?? ''}?subject=Baja>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                  }
                : {}),
            },
          }
        : {}),
      // Sin seguimiento de aperturas ni de clics: reescribir los enlaces y
      // meter píxeles espía es de lo que más penaliza a un remitente nuevo.
      ...(c.adjuntos?.length
        ? { attachments: c.adjuntos.map((a) => ({ filename: a.nombre, content: a.contenido.toString('base64'), content_type: a.tipo })) }
        : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function porAppsScript(c: Correo): Promise<void> {
  const r = await fetch(process.env.APPS_SCRIPT_URL as string, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      secreto: process.env.APPS_SCRIPT_SECRETO,
      accion: 'enviar',
      para: c.para,
      asunto: c.asunto,
      texto: c.texto,
      html: c.html,
      responderA: c.responderA || correoDeSorela() || '',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const t = await r.text();
  let j: { ok?: boolean; motivo?: string; tipo?: string };
  try {
    j = JSON.parse(t);
  } catch {
    throw new Error('El Apps Script no contestó bien (¿despliegue caducado?)');
  }
  if (!j.ok) {
    /* La versión vieja del script no conoce `accion` y contesta «datos»
       porque no ve un correo de contacto. Se dice con palabras. */
    if (j.motivo === 'datos') throw new Error('El Apps Script no está actualizado: pega el Codigo.gs nuevo');
    if (j.motivo === 'sin-cuota') throw new Error('Gmail no deja enviar más hoy (límite diario)');
    throw new Error(`Apps Script: ${j.motivo || 'fallo'}`);
  }
}

export type Correo = {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
  responderA?: string;
  /** Enlace de baja: va en los correos que no son respuesta a algo que pidió. */
  baja?: string;
  /** Cabeceras extra: In-Reply-To y References, para que una respuesta caiga en su hilo. */
  cabeceras?: Record<string, string>;
  /** PDF adjuntos (el acuerdo y el dossier). Solo por Resend o SMTP. */
  adjuntos?: { nombre: string; contenido: Buffer; tipo: string }[];
};

export type Opciones = {
  tipo: RegistroCorreo['tipo'];
  /** Si se da, el correo no sale dos veces con la misma clave. */
  clave?: string;
  contactoId?: string;
  uid?: string;
  campanaId?: string;
};

export type Resultado = { estado: EstadoCorreo; detalle?: string; via: Via | null };

/** Si ya salió un correo con esta clave. */
export async function yaEnviado(clave: string): Promise<boolean> {
  if (!hayFirebase()) return false;
  const d = await baseDeDatos().collection(COLECCION_CORREOS).doc(clave).get();
  return d.exists && d.get('estado') === 'enviado';
}

/** Manda un correo y lo apunta. No lanza: devuelve qué ha pasado. */
export async function mandarCorreo(c: Correo, o: Opciones): Promise<Resultado> {
  const via = viaDeEnvio();
  const base = { para: c.para, tipo: o.tipo, asunto: c.asunto, contactoId: o.contactoId, uid: o.uid, campanaId: o.campanaId };
  const limpio = <T extends object>(x: T) =>
    Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as T;

  if (o.clave && (await yaEnviado(o.clave))) {
    return { estado: 'omitido', detalle: 'Ya se le había enviado', via };
  }
  if (c.baja && (await estaDeBaja(c.para))) {
    await apuntarCorreo(limpio({ ...base, via, estado: 'omitido', detalle: 'Se dio de baja' }), o.clave);
    return { estado: 'omitido', detalle: 'Se dio de baja', via };
  }
  if (!via) {
    await apuntarCorreo(limpio({ ...base, via, estado: 'fallido', detalle: 'No hay ninguna vía de envío configurada' }), o.clave);
    return { estado: 'fallido', detalle: 'No hay ninguna vía de envío configurada', via };
  }

  try {
    if (via === 'resend') await porResend(c);
    else if (via === 'smtp') await enviarSmtp({ para: c.para, asunto: c.asunto, texto: c.texto, html: c.html, responderA: c.responderA, adjuntos: c.adjuntos });
    else await porAppsScript(c);
    await apuntarCorreo(limpio({ ...base, via, estado: 'enviado' }), o.clave);
    return { estado: 'enviado', via };
  } catch (e) {
    const detalle = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error(`[correos] No salió «${c.asunto}» a ${c.para}:`, e);
    await apuntarCorreo(limpio({ ...base, via, estado: 'fallido', detalle }), o.clave);
    return { estado: 'fallido', detalle, via };
  }
}

/* ------------------------------------------------------- interruptores */

/** Qué automatizaciones están encendidas. Lo que no se ha tocado, por defecto. */
export async function automatizacionesActivas(): Promise<Record<IdAutomatizacion, boolean>> {
  const porDefecto = Object.fromEntries(AUTOMATIZACIONES.map((a) => [a.id, a.porDefecto])) as Record<IdAutomatizacion, boolean>;
  if (!hayFirebase()) return porDefecto;
  try {
    const d = await baseDeDatos().collection('ajustes').doc('correos').get();
    const guardado = (d.get('activas') ?? {}) as Record<string, unknown>;
    for (const a of AUTOMATIZACIONES) {
      if (typeof guardado[a.id] === 'boolean') porDefecto[a.id] = guardado[a.id] as boolean;
    }
  } catch {
    /* sin ajustes: los de por defecto */
  }
  return porDefecto;
}

export async function estaActiva(id: IdAutomatizacion): Promise<boolean> {
  return (await automatizacionesActivas())[id];
}

/* -------------------------------------------------------------- bajas */

const COLECCION_BAJAS = 'correos_bajas';

function llaveBaja() {
  const llave = process.env.BAJA_SECRETO || process.env.FIREBASE_CLAVE_PRIVADA;
  // Sin llave no se firman bajas: mejor fallar que firmar con algo adivinable.
  if (!llave) throw new Error('Falta BAJA_SECRETO');
  return llave;
}

const idBaja = (correo: string) => createHmac('sha256', llaveBaja()).update(`id:${correo.toLowerCase()}`).digest('hex').slice(0, 40);

export function firmaBaja(correo: string) {
  return createHmac('sha256', llaveBaja()).update(`baja:${correo.toLowerCase()}`).digest('base64url').slice(0, 22);
}

/** El enlace de baja de una persona, firmado para que nadie dé de baja a otra. */
/** La misma baja, pero directa a la API: para el botón de baja del propio Gmail. */
export function bajaDirecta(correo: string) {
  const c = Buffer.from(correo.toLowerCase()).toString('base64url');
  return `${WEB}/api/baja?c=${c}&f=${firmaBaja(correo)}`;
}

export function enlaceBaja(correo: string) {
  const c = Buffer.from(correo.toLowerCase()).toString('base64url');
  return `${WEB}/baja?c=${c}&f=${firmaBaja(correo)}`;
}

export async function estaDeBaja(correo: string): Promise<boolean> {
  if (!hayFirebase()) return false;
  try {
    return (await baseDeDatos().collection(COLECCION_BAJAS).doc(idBaja(correo)).get()).exists;
  } catch {
    return false;
  }
}

export async function darDeBaja(correo: string) {
  await baseDeDatos()
    .collection(COLECCION_BAJAS)
    .doc(idBaja(correo))
    .set({ correo: correo.toLowerCase(), cuando: FieldValue.serverTimestamp() });
}
