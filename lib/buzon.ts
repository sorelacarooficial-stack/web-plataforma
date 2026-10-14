import 'server-only';
import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';
import MailComposer from 'nodemailer/lib/mail-composer';

/**
 * El buzón hola@sorelacarodivine.com, leído desde la plataforma.
 *
 * El buzón vive en Arsys («Correo Básico»): aquí solo se lee por IMAP, igual
 * que lo leería el Mail del móvil, así que lo que se lee, se borra o se
 * contesta aquí se ve igual en el móvil y al revés.
 *
 * Las respuestas salen por Resend (el mismo camino que el resto de correos de
 * la web, con el dominio verificado y sin spam) y se guarda una copia en la
 * carpeta «Enviados» del buzón para que la conversación quede completa.
 *
 * La contraseña del buzón va SOLO en Vercel (BUZON_CLAVE): nunca en el código.
 */

export const DIRECCION = (process.env.BUZON_USUARIO || 'hola@sorelacarodivine.com').toLowerCase();

export const hayBuzon = () => Boolean(process.env.BUZON_CLAVE);

export type Carpeta = 'entrada' | 'enviados' | 'papelera' | 'spam';

const USO_ESPECIAL: Record<Exclude<Carpeta, 'entrada'>, string> = {
  enviados: '\\Sent',
  papelera: '\\Trash',
  spam: '\\Junk',
};
/* Por si el servidor no marca las carpetas especiales: los nombres de siempre. */
const NOMBRES: Record<Exclude<Carpeta, 'entrada'>, RegExp> = {
  enviados: /^(inbox[./])?(sent|enviados|elementos enviados|sent items|sent messages)$/i,
  papelera: /^(inbox[./])?(trash|papelera|deleted|deleted items|elementos eliminados)$/i,
  spam: /^(inbox[./])?(junk|spam|correo no deseado|bulk)$/i,
};

function cliente() {
  return new ImapFlow({
    host: process.env.BUZON_IMAP || 'imap.serviciodecorreo.es',
    port: Number(process.env.BUZON_IMAP_PUERTO || 993),
    secure: true,
    auth: { user: DIRECCION, pass: process.env.BUZON_CLAVE || '' },
    logger: false,
    socketTimeout: 30_000,
    connectionTimeout: 15_000,
  } as ConstructorParameters<typeof ImapFlow>[0]);
}

/** Abre la conexión, hace lo que haga falta y la cierra pase lo que pase. */
async function conBuzon<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const c = cliente();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.logout().catch(() => c.close());
  }
}

async function ruta(c: ImapFlow, carpeta: Carpeta): Promise<string | null> {
  if (carpeta === 'entrada') return 'INBOX';
  const lista = await c.list();
  const especial = lista.find((m) => m.specialUse === USO_ESPECIAL[carpeta]);
  if (especial) return especial.path;
  return lista.find((m) => NOMBRES[carpeta].test(m.path))?.path ?? null;
}

export type Persona = { nombre: string; correo: string };
export type Resumen = {
  uid: number;
  de: Persona;
  para: Persona[];
  asunto: string;
  fecha: string | null;
  leido: boolean;
  respondido: boolean;
  destacado: boolean;
  tamano: number;
};

const persona = (a?: { name?: string; address?: string }): Persona => ({
  nombre: (a?.name || '').trim(),
  correo: (a?.address || '').toLowerCase(),
});

const POR_PAGINA = 40;

export async function listar(carpeta: Carpeta, pagina = 0) {
  return conBuzon(async (c) => {
    const path = await ruta(c, carpeta);
    if (!path) return { mensajes: [] as Resumen[], total: 0, sinLeer: 0, existe: false };
    const lock = await c.getMailboxLock(path);
    try {
      const total = c.mailbox ? c.mailbox.exists : 0;
      const hasta = total - pagina * POR_PAGINA;
      const desde = Math.max(1, hasta - POR_PAGINA + 1);
      const mensajes: Resumen[] = [];
      if (hasta >= 1) {
        for await (const m of c.fetch(`${desde}:${hasta}`, { uid: true, flags: true, envelope: true, internalDate: true, size: true })) {
          const f = m.flags ?? new Set<string>();
          mensajes.push({
            uid: m.uid,
            de: persona(m.envelope?.from?.[0]),
            para: (m.envelope?.to ?? []).map(persona),
            asunto: m.envelope?.subject || '(sin asunto)',
            fecha: (m.envelope?.date ?? m.internalDate)
              ? new Date((m.envelope?.date ?? m.internalDate) as Date).toISOString()
              : null,
            leido: f.has('\\Seen'),
            respondido: f.has('\\Answered'),
            destacado: f.has('\\Flagged'),
            tamano: m.size ?? 0,
          });
        }
      }
      mensajes.reverse();
      let sinLeer = 0;
      if (carpeta === 'entrada') {
        const st = await c.status('INBOX', { unseen: true }).catch(() => false);
        sinLeer = st && typeof st === 'object' ? (st.unseen ?? 0) : 0;
      }
      return { mensajes, total, sinLeer, existe: true, hayMas: desde > 1 };
    } finally {
      lock.release();
    }
  });
}

/**
 * Lo que está sin leer en la bandeja de entrada, para el inicio de Sorela:
 * cuántos son y los últimos (quién y de qué), sin abrirlos ni marcarlos.
 */
export async function sinLeer(max = 4) {
  return conBuzon(async (c) => {
    const lock = await c.getMailboxLock('INBOX');
    try {
      const uids = ((await c.search({ seen: false }, { uid: true })) || []) as number[];
      const ultimos: { uid: number; de: Persona; asunto: string; fecha: string | null }[] = [];
      const elegidos = uids.slice(-max);
      if (elegidos.length) {
        for await (const m of c.fetch(elegidos.join(','), { uid: true, envelope: true, internalDate: true }, { uid: true })) {
          const f = m.envelope?.date ?? m.internalDate;
          ultimos.push({
            uid: m.uid,
            de: persona(m.envelope?.from?.[0]),
            asunto: m.envelope?.subject || '(sin asunto)',
            fecha: f ? new Date(f as Date).toISOString() : null,
          });
        }
      }
      return { total: uids.length, ultimos: ultimos.reverse() };
    } finally {
      lock.release();
    }
  });
}

const direcciones = (a?: AddressObject | AddressObject[]): Persona[] =>
  (Array.isArray(a) ? a : a ? [a] : []).flatMap((x) => x.value.map((v) => persona(v)));

async function traer(c: ImapFlow, path: string, uid: number): Promise<ParsedMail | null> {
  const m = await c.fetchOne(String(uid), { source: true }, { uid: true });
  if (!m || !m.source) return null;
  return simpleParser(m.source);
}

export async function leer(carpeta: Carpeta, uid: number) {
  return conBuzon(async (c) => {
    const path = await ruta(c, carpeta);
    if (!path) return null;
    const lock = await c.getMailboxLock(path);
    try {
      const p = await traer(c, path, uid);
      if (!p) return null;
      await c.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => false);
      return {
        uid,
        de: direcciones(p.from)[0] ?? { nombre: '', correo: '' },
        para: direcciones(p.to),
        cc: direcciones(p.cc),
        responderA: direcciones(p.replyTo)[0] ?? null,
        asunto: p.subject || '(sin asunto)',
        fecha: p.date ? p.date.toISOString() : null,
        html: typeof p.html === 'string' ? p.html : null,
        texto: p.text ?? '',
        messageId: p.messageId ?? null,
        referencias: Array.isArray(p.references) ? p.references : p.references ? [p.references] : [],
        adjuntos: p.attachments
          .filter((a) => a.contentDisposition !== 'inline' || !a.cid)
          .map((a, i) => ({ indice: i, nombre: a.filename || `adjunto-${i + 1}`, tipo: a.contentType, tamano: a.size })),
      };
    } finally {
      lock.release();
    }
  });
}

export async function adjunto(carpeta: Carpeta, uid: number, indice: number) {
  return conBuzon(async (c) => {
    const path = await ruta(c, carpeta);
    if (!path) return null;
    const lock = await c.getMailboxLock(path);
    try {
      const p = await traer(c, path, uid);
      const lista = p?.attachments.filter((a) => a.contentDisposition !== 'inline' || !a.cid) ?? [];
      const a = lista[indice];
      return a ? { nombre: a.filename || `adjunto-${indice + 1}`, tipo: a.contentType, contenido: a.content } : null;
    } finally {
      lock.release();
    }
  });
}

export async function marcar(carpeta: Carpeta, uid: number, cambios: { leido?: boolean; destacado?: boolean }) {
  return conBuzon(async (c) => {
    const path = await ruta(c, carpeta);
    if (!path) return false;
    const lock = await c.getMailboxLock(path);
    try {
      for (const [flag, valor] of [
        ['\\Seen', cambios.leido],
        ['\\Flagged', cambios.destacado],
      ] as const) {
        if (valor === true) await c.messageFlagsAdd(String(uid), [flag], { uid: true });
        if (valor === false) await c.messageFlagsRemove(String(uid), [flag], { uid: true });
      }
      return true;
    } finally {
      lock.release();
    }
  });
}

/** A la papelera; si ya está en la papelera, se borra del todo. */
export async function borrar(carpeta: Carpeta, uid: number) {
  return conBuzon(async (c) => {
    const path = await ruta(c, carpeta);
    if (!path) return false;
    const papelera = await ruta(c, 'papelera');
    const lock = await c.getMailboxLock(path);
    try {
      if (carpeta === 'papelera' || !papelera) return c.messageDelete(String(uid), { uid: true });
      return Boolean(await c.messageMove(String(uid), papelera, { uid: true }));
    } finally {
      lock.release();
    }
  });
}

/** Lo que hace falta para contestar a un correo: a quién, asunto y el hilo. */
export async function datosRespuesta(carpeta: Carpeta, uid: number) {
  return conBuzon(async (c) => {
    const path = await ruta(c, carpeta);
    if (!path) return null;
    const lock = await c.getMailboxLock(path);
    try {
      const p = await traer(c, path, uid);
      if (!p) return null;
      const de = direcciones(p.replyTo)[0] ?? direcciones(p.from)[0];
      const refs = Array.isArray(p.references) ? p.references : p.references ? [p.references] : [];
      return {
        para: de?.correo ?? '',
        nombre: de?.nombre ?? '',
        asunto: /^re:/i.test(p.subject ?? '') ? (p.subject as string) : `Re: ${p.subject ?? ''}`.trim(),
        messageId: p.messageId ?? null,
        referencias: [...refs, ...(p.messageId ? [p.messageId] : [])],
        citado: (p.text ?? '').split('\n').map((l) => `> ${l}`).join('\n'),
        fecha: p.date ?? null,
      };
    } finally {
      lock.release();
    }
  });
}

/** Deja una copia de lo enviado en «Enviados» y marca el original como contestado. */
export async function guardarEnviado(
  correo: { para: string; asunto: string; texto: string; html: string; cabeceras?: Record<string, string> },
  original?: { carpeta: Carpeta; uid: number }
) {
  const raw = await new MailComposer({
    from: `Sorela Caro <${DIRECCION}>`,
    to: correo.para,
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html,
    headers: correo.cabeceras,
    date: new Date(),
  })
    .compile()
    .build();
  return conBuzon(async (c) => {
    const enviados = await ruta(c, 'enviados');
    if (enviados) await c.append(enviados, raw, ['\\Seen']);
    if (original) {
      const path = await ruta(c, original.carpeta);
      if (path) {
        const lock = await c.getMailboxLock(path);
        try {
          await c.messageFlagsAdd(String(original.uid), ['\\Answered'], { uid: true });
        } finally {
          lock.release();
        }
      }
    }
    return true;
  });
}

/** Un fallo de IMAP, contado con palabras. */
export function motivoBuzon(e: unknown): string {
  const t = e instanceof Error ? `${e.message} ${(e as { responseText?: string }).responseText ?? ''}` : String(e);
  if (/auth|login|credential|password|LOGIN/i.test(t)) return 'La contraseña del buzón no es correcta (revisa BUZON_CLAVE en Vercel).';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout/i.test(t)) return 'No se ha podido conectar con el servidor de correo de Arsys.';
  return 'No se ha podido leer el buzón.';
}
