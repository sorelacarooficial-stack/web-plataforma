import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from './firebase-servidor';
import { COLECCION_CORREOS, darDeBaja } from './correos';
import { idContacto, marcarCorreoMal, marcarEntregaLista } from './atencion-servidor';
import { ASUNTO_LISTA } from './plantillas-bienvenida';

/**
 * Qué pasó con cada correo DESPUÉS de salir: si llegó, si rebotó, si alguien
 * lo marcó como spam.
 *
 * «Enviado» en el historial solo quiere decir que Resend lo aceptó. Lo que
 * pasa luego lo cuenta Resend por dos caminos, y los dos acaban aquí:
 *
 *   · El aviso automático (webhook) que Resend manda a /api/correos/entregas
 *     cada vez que un correo cambia: entregado, retrasado, rebotado, spam…
 *     Llega firmado: se comprueba la firma antes de creer nada.
 *   · La consulta de los envíos recientes (GET /emails de Resend), para los
 *     correos que salieron antes de que existiera el aviso o por si alguno se
 *     perdió. La lanza la pantalla Correos.
 *
 * Un rebote o una queja de spam dan de baja ese correo: insistir con una
 * dirección que rebota o con quien te marca como spam es lo que más hunde la
 * reputación del dominio, y entonces los correos de TODAS van a spam.
 *
 * No hay seguimiento de aperturas (ver porResend en lib/correos.ts): si algún
 * día se enciende en Resend, «abierto» se apunta igual.
 */

export type Entrega = 'retrasado' | 'entregado' | 'rebotado' | 'spam';

/* Un estado solo se cambia por otro que diga más: un «retrasado» que llega
   tarde no puede tapar un «entregado», y una queja de spam pesa más que todo. */
const PESO: Record<Entrega, number> = { retrasado: 1, entregado: 2, rebotado: 3, spam: 4 };

/** Lo que cuenta Resend, a nuestro idioma. Lo que no interesa, null. */
export function deEvento(tipo: string): Entrega | 'abierto' | 'clic' | null {
  switch (tipo.replace(/^email\./, '')) {
    case 'delivered':
      return 'entregado';
    case 'delivery_delayed':
      return 'retrasado';
    case 'bounced':
    case 'failed':
      return 'rebotado';
    case 'complained':
      return 'spam';
    case 'opened':
      return 'abierto';
    case 'clicked':
      return 'clic';
    default:
      return null;
  }
}

export type Evento = {
  idEnvio?: string | null;
  para?: string | null;
  asunto?: string | null;
  que: Entrega | 'abierto' | 'clic';
  cuando?: Date;
  detalle?: string | null;
  /** Rebote de verdad o queja de spam: ese correo se da de baja. Un «failed» de Resend, no. */
  baja?: boolean;
};

/** Si un evento de Resend debe dar de baja el correo (rebote o queja). */
export const daDeBaja = (tipo: string) => /^(email\.)?(bounced|complained)$/.test(tipo);

const col = () => baseDeDatos().collection(COLECCION_CORREOS);

/**
 * La línea del historial de ese envío. Por su identificador de Resend; los
 * correos de antes de guardarlo, por destinataria y asunto (la más reciente
 * sin identificador). Sin índices compuestos: una sola condición de igualdad.
 */
async function buscar(e: Evento): Promise<FirebaseFirestore.DocumentReference | null> {
  if (e.idEnvio) {
    const r = await col().where('idEnvio', '==', e.idEnvio).limit(1).get();
    if (!r.empty) return r.docs[0].ref;
  }
  const para = e.para?.trim().toLowerCase();
  if (!para) return null;
  const r = await col().where('para', '==', para).limit(80).get();
  const candidatas = r.docs
    .filter((d) => d.get('estado') === 'enviado' && d.get('via') === 'resend')
    .filter((d) => !e.asunto || d.get('asunto') === e.asunto)
    .filter((d) => !e.idEnvio || !d.get('idEnvio'))
    .sort((a, b) => (b.get('cuando')?.toMillis?.() ?? 0) - (a.get('cuando')?.toMillis?.() ?? 0));
  return candidatas[0]?.ref ?? null;
}

/**
 * Apunta un evento en su línea del historial. Devuelve si encontró la línea.
 *
 * Si la línea cambia, lo apunta también en la ficha de la persona, que es lo
 * que lee Clientes sin abrir el historial (que se borra a los 30 días):
 *   · `correoLista.entrega`, si la línea es el correo de la lista de espera;
 *   · `correoMal`, si un correo suyo, el que sea, rebotó o lo marcó como spam.
 *     Así sale en «Te necesita: no le llegó su correo» aunque el rebote la
 *     haya dado de baja: hay que buscarla por otra vía.
 */
export async function apuntarEvento(e: Evento): Promise<boolean> {
  if (!hayFirebase()) return false;
  const ref = await buscar(e);
  if (!ref) return false;
  const cuando = e.cuando && !Number.isNaN(e.cuando.getTime()) ? Timestamp.fromDate(e.cuando) : FieldValue.serverTimestamp();

  const linea = await baseDeDatos().runTransaction(async (t) => {
    const d = await t.get(ref);
    if (!d.exists) return null;
    const cambios: Record<string, unknown> = {};
    if (e.idEnvio && !d.get('idEnvio')) cambios.idEnvio = e.idEnvio;
    if (e.que === 'abierto' || e.que === 'clic') {
      const campo = e.que === 'abierto' ? 'abierto' : 'clic';
      if (!d.get(campo)) cambios[campo] = cuando;
      // Si lo ha abierto, ha llegado.
      if (!d.get('entrega')) {
        cambios.entrega = 'entregado';
        cambios.entregaEn = cuando;
      }
    } else {
      const antes = d.get('entrega') as Entrega | undefined;
      if (!antes || PESO[e.que] > PESO[antes]) {
        cambios.entrega = e.que;
        cambios.entregaEn = cuando;
        if (e.detalle) cambios.entregaDetalle = e.detalle.slice(0, 300);
      }
    }
    if (Object.keys(cambios).length) t.update(ref, cambios);
    return {
      entrega: typeof cambios.entrega === 'string' ? (cambios.entrega as Entrega) : null,
      para: String(d.get('para') ?? ''),
      contactoId: typeof d.get('contactoId') === 'string' ? (d.get('contactoId') as string) : null,
      asunto: String(d.get('asunto') ?? ''),
    };
  });

  /* Solo cuando la línea ha cambiado: la consulta de los envíos recientes
     repasa los mismos 300 cada vez que se abre Correos, y volver a escribir lo
     mismo en cada ficha costaría una escritura por correo y por visita. Las
     líneas sin `contactoId` (campañas, registro antiguo) se buscan por correo,
     que es el id de la ficha; si no hay ficha, no se crea (`update`). */
  if (linea?.entrega) {
    const contactoId = linea.contactoId || (linea.para ? idContacto(linea.para) : null);
    if (linea.asunto.startsWith(ASUNTO_LISTA)) await marcarEntregaLista(contactoId, linea.entrega);
    if (linea.entrega === 'rebotado' || linea.entrega === 'spam') {
      await marcarCorreoMal(contactoId, { entrega: linea.entrega, cuando: e.cuando ?? null });
    }
  }

  if (e.baja && e.para) {
    await darDeBaja(e.para.trim().toLowerCase()).catch((x) => console.error('[entregas] no se ha podido dar de baja', x));
  }
  return true;
}

/* --------------------------------------------------------------- firma */

/**
 * Que el aviso viene de verdad de Resend (lo firma con Svix): HMAC-SHA256 de
 * «id.timestamp.cuerpo» con la parte en base64 del secreto «whsec_…», y que
 * no tiene más de 5 minutos (para que no se pueda reenviar uno viejo).
 */
export function firmaValida(cuerpo: string, cab: Headers, secreto: string, ahora = Date.now()): boolean {
  const id = cab.get('svix-id') ?? cab.get('webhook-id');
  const ts = cab.get('svix-timestamp') ?? cab.get('webhook-timestamp');
  const firmas = cab.get('svix-signature') ?? cab.get('webhook-signature');
  if (!id || !ts || !firmas || !secreto) return false;
  const segundos = Number(ts);
  if (!Number.isFinite(segundos) || Math.abs(ahora / 1000 - segundos) > 5 * 60) return false;
  let llave: Buffer;
  try {
    llave = Buffer.from(secreto.replace(/^whsec_/, ''), 'base64');
  } catch {
    return false;
  }
  const esperada = Buffer.from(createHmac('sha256', llave).update(`${id}.${ts}.${cuerpo}`).digest('base64'));
  return firmas.split(' ').some((f) => {
    const [version, valor] = f.split(',');
    if (version !== 'v1' || !valor) return false;
    const dada = Buffer.from(valor);
    return dada.length === esperada.length && timingSafeEqual(dada, esperada);
  });
}

/* ----------------------------------------------- consulta de los envíos */

type EnvioResend = { id: string; to?: string[] | string; subject?: string; created_at?: string; last_event?: string };

/**
 * Pregunta a Resend por los envíos recientes y apunta su último estado en el
 * historial. Sirve para lo que salió antes del aviso automático y como red por
 * si alguno se perdió. Hasta 300 envíos (3 páginas de 100).
 */
export async function comprobarEntregas(): Promise<{ revisados: number; apuntados: number; motivo?: string }> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { revisados: 0, apuntados: 0, motivo: 'sin-resend' };
  let revisados = 0;
  let apuntados = 0;
  let despues: string | null = null;
  for (let pagina = 0; pagina < 3; pagina++) {
    const url = new URL('https://api.resend.com/emails');
    url.searchParams.set('limit', '100');
    if (despues) url.searchParams.set('after', despues);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${clave}` }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return { revisados, apuntados, motivo: `resend-${r.status}` };
    const j = (await r.json()) as { data?: EnvioResend[]; has_more?: boolean };
    const lista = j.data ?? [];
    for (const x of lista) {
      revisados++;
      const que = deEvento(String(x.last_event ?? ''));
      if (!que) continue;
      const para = Array.isArray(x.to) ? x.to[0] : x.to;
      const ok = await apuntarEvento({
        idEnvio: x.id,
        para,
        asunto: x.subject,
        que,
        cuando: x.created_at ? new Date(x.created_at) : undefined,
        baja: daDeBaja(String(x.last_event ?? '')),
      }).catch(() => false);
      if (ok) apuntados++;
    }
    if (!j.has_more || !lista.length) break;
    despues = lista[lista.length - 1].id;
  }
  return { revisados, apuntados };
}
