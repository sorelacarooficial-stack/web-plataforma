import 'server-only';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { CURSO_DIVINE, revisarAccesos } from './accesos';
import { baseDeDatos, COLECCIONES, hayFirebase } from './firebase-servidor';
import { diaDe } from './metricas';
import { enlaceBaja, estaDeBaja, mandarCorreo } from './correos';
import { listaDeEspera } from './automatizar';
import { correoBienvenidaPorOrigen } from './plantillas-bienvenida';
import { AUDIENCIAS, faltaEnlace, plantillaCampana, type Audiencia, type Campana, type EstadoCampana } from './plantillas-campana';
import { esSoloSuDia, serieLanzamiento } from './serie-lanzamiento';
import { idContacto, marcarCorreoLista } from './atencion-servidor';
import { soloAviso } from './enviar-informacion';

/**
 * Los avisos y correos programados.
 *
 * Una campaña es un correo para un grupo de personas en un día concreto. Las
 * escribe Sorela desde la pantalla Correos (o vienen de la serie del
 * lanzamiento, ya escrita) y el cron de cada mañana manda las que tocan.
 *
 * Reglas que evitan los sustos:
 *  - Cada persona recibe cada campaña UNA vez (clave por campaña y persona),
 *    aunque se pulse «Enviar» dos veces o el cron se repita.
 *  - Una programada solo sale su día o el siguiente. Una cuenta atrás que
 *    llega tarde dice algo falso («faltan 5 días» cuando faltan 2), así que si
 *    se pasa el plazo queda como caducada y no sale. Los correos 09 y 10 de
 *    la serie («Mañana a las 19:00», «Hoy a las 19:00») solo salen su día:
 *    uno de margen bastaba para que el sábado 7 llegara «Hoy a las 19:00».
 *  - Quien se dio de baja no recibe ninguna.
 */

export const COLECCION_CAMPANAS = 'campanas';
const MARGEN_DIAS = 1;

const col = () => baseDeDatos().collection(COLECCION_CAMPANAS);
const hash = (t: string) => createHash('sha256').update(t.toLowerCase()).digest('hex').slice(0, 24);

const clave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function aCampana(id: string, v: FirebaseFirestore.DocumentData): Campana {
  const r = v.resultado;
  return {
    id,
    etiqueta: String(v.etiqueta ?? ''),
    asunto: String(v.asunto ?? ''),
    cuerpo: String(v.cuerpo ?? ''),
    boton: v.boton && v.boton.texto ? { texto: String(v.boton.texto), enlace: String(v.boton.enlace ?? '') } : null,
    imagen: ['consulta', 'comunidad', 'ninguna'].includes(v.imagen) ? v.imagen : 'equipo',
    audiencia: (v.audiencia in AUDIENCIAS ? v.audiencia : 'espera') as Audiencia,
    fecha: String(v.fecha ?? ''),
    estado: (['borrador', 'programada', 'enviada', 'pausada', 'caducada'].includes(v.estado) ? v.estado : 'borrador') as EstadoCampana,
    serie: v.serie ?? null,
    plantilla: v.plantilla === 'lista-espera' ? 'lista-espera' : null,
    excluir: Array.isArray(v.excluir) ? v.excluir.map((x: unknown) => String(x).toLowerCase().trim()) : [],
    anadir: Array.isArray(v.anadir)
      ? v.anadir
          .filter((x: { correo?: unknown }) => typeof x?.correo === 'string' && x.correo.includes('@'))
          .map((x: { correo: string; nombre?: unknown }) => ({ correo: x.correo.toLowerCase().trim(), nombre: x.nombre ? String(x.nombre) : null }))
      : [],
    resultado: r
      ? { enviados: r.enviados ?? 0, fallidos: r.fallidos ?? 0, omitidos: r.omitidos ?? 0, cuando: r.cuando?.toDate?.().toISOString() ?? null }
      : null,
  };
}

/**
 * Copia la serie del lanzamiento a Firestore si todavía no está. Con `create`,
 * que falla si el documento existe: lo que Sorela haya cambiado no se pisa.
 */
export async function sembrarSerie() {
  if (!hayFirebase()) return;
  const ajustes = baseDeDatos().collection('ajustes').doc('correos');
  if ((await ajustes.get()).get('serieSembrada')) return;
  await Promise.all(
    serieLanzamiento().map((c) =>
      col()
        .doc(c.id)
        .create({ ...c, resultado: null, creado: FieldValue.serverTimestamp() })
        .catch(() => null)
    )
  );
  await ajustes.set({ serieSembrada: true }, { merge: true });
}

export async function listarCampanas(): Promise<Campana[]> {
  const r = await col().get();
  return r.docs.map((d) => aCampana(d.id, d.data())).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/* ---------------------------------------------------------- a quién */

type Persona = { correo: string; nombre: string | null };

export async function destinatarios(a: Audiencia): Promise<Persona[]> {
  if (!hayFirebase()) return [];
  if (a === 'espera') return listaDeEspera();

  const db = baseDeDatos();
  const salida = new Map<string, Persona>();
  const meter = (correo: unknown, nombre: unknown) => {
    const c = String(correo || '').toLowerCase().trim();
    if (c.includes('@') && !salida.has(c)) salida.set(c, { correo: c, nombre: nombre ? String(nombre) : null });
  };

  if (a === 'alumnas' || a === 'comunidad' || a === 'todos') {
    const us = await db.collection(COLECCIONES.usuarios).get();
    for (const u of us.docs) {
      const v = u.data();
      if (v.bloqueada) continue;
      const acc = revisarAccesos(v.accesos);
      const alumna = acc.some((x) => x.tipo === 'curso' && clave(x.nombre ?? '') === clave(CURSO_DIVINE));
      const miembro = acc.some((x) => x.tipo === 'membresia');
      if (a === 'todos' || (a === 'alumnas' && alumna) || (a === 'comunidad' && miembro)) meter(v.correo, v.nombre);
    }
  }
  if (a === 'contactos' || a === 'todos') {
    const cs = await db.collection(COLECCIONES.contactos).get();
    for (const c of cs.docs) {
      const v = c.data();
      /* Quien dejó su correo en «avísame cuando haya terapeuta (o
         convocatoria) en mi ciudad», en la web o en el asistente, pidió UN
         aviso, no publicidad: escribirle una campaña sería una comunicación
         comercial sin consentimiento (art. 21 LSSI). */
      if (soloAviso(String(v.origen ?? ''))) continue;
      /* Apuntada a mano por Sorela sin marcar que pidió la información. */
      if (v.aMano && !v.pidioInformacion) continue;
      /* Dejó sin marcar la casilla de novedades. Los contactos anteriores a
         esa casilla no llevan el campo: aceptaron un texto que ya incluía las
         formaciones, así que solo se excluye el `false` explícito. */
      if (v.comercial === false) continue;
      if (v.estado !== 'Descartado') meter(v.correo, v.nombre);
    }
  }
  return [...salida.values()];
}

/** Cuántas personas recibirían cada audiencia ahora mismo (quitando bajas). */
export async function cuantos(): Promise<Record<Audiencia, number>> {
  const ids = Object.keys(AUDIENCIAS) as Audiencia[];
  const listas = await Promise.all(ids.map((a) => destinatarios(a).catch(() => [])));
  const salida = {} as Record<Audiencia, number>;
  for (let i = 0; i < ids.length; i++) {
    const vivos = await Promise.all(listas[i].map((p) => estaDeBaja(p.correo)));
    salida[ids[i]] = vivos.filter((b) => !b).length;
  }
  return salida;
}

/* ------------------------------------------------------------ envío */

export type InformeCampana = { id: string; enviados: number; fallidos: number; omitidos: number; motivo?: 'falta-enlace' };

/** Manda una campaña a su audiencia. Se puede repetir: solo escribe a quien le falte. */
export async function enviarCampana(id: string): Promise<InformeCampana> {
  const ref = col().doc(id);
  const d = await ref.get();
  const r: InformeCampana = { id, enviados: 0, fallidos: 0, omitidos: 0 };
  if (!d.exists) return r;
  const c = aCampana(id, d.data() ?? {});
  // No sale nada con un botón vacío: se queda programada hasta que tenga enlace.
  if (faltaEnlace(c)) return { ...r, motivo: 'falta-enlace' };

  /* La audiencia, con los ajustes a mano de esta campaña: quien ya tiene lo
     que dice el correo se quita, y alguien concreto se puede añadir. */
  const fuera = new Set(c.excluir ?? []);
  const base = (await destinatarios(c.audiencia)).filter((p) => !fuera.has(p.correo));
  const lista = [...base, ...(c.anadir ?? []).filter((p) => !fuera.has(p.correo) && !base.some((b) => b.correo === p.correo))];
  for (const p of lista) {
    const baja = enlaceBaja(p.correo);
    const contenido =
      c.plantilla === 'lista-espera'
        ? correoBienvenidaPorOrigen(p.nombre, 'lista-comunidad')
        : plantillaCampana(c, p.nombre, baja);
    const x = await mandarCorreo(
      { para: p.correo, ...contenido, baja },
      { tipo: 'campana', clave: `campana:${id}:${hash(p.correo)}`, campanaId: id }
    );
    if (x.estado === 'enviado') r.enviados++;
    else if (x.estado === 'fallido') r.fallidos++;
    else r.omitidos++;
    /* El correo de la lista queda apuntado en su ficha (`correoLista`): es lo
       que dice en Clientes si le llegó el del grupo de WhatsApp sin leer el
       historial, que se borra a los 30 días. Quien no tiene ficha (una cuenta
       sin contacto) se salta solo. */
    if (c.plantilla === 'lista-espera') {
      await marcarCorreoLista(idContacto(p.correo), { plantilla: 'lista-espera', estado: x.estado, por: 'campana' });
    }
  }

  const previo = c.resultado;
  await ref.update({
    // Si alguna no salió, se queda programada para reintentar dentro del plazo.
    estado: r.fallidos > 0 && c.estado === 'programada' ? 'programada' : 'enviada',
    resultado: {
      enviados: (previo?.enviados ?? 0) + r.enviados,
      fallidos: r.fallidos,
      omitidos: r.omitidos,
      cuando: FieldValue.serverTimestamp(),
    },
  });
  return r;
}

const sumarDias = (dia: string, n: number) => {
  const [a, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return f.toISOString().slice(0, 10);
};

/** Las programadas que tocan hoy: salen. Las que se pasaron de plazo: caducan. */
export async function campanasDelDia(ahora = new Date()): Promise<InformeCampana[]> {
  if (!hayFirebase()) return [];
  await sembrarSerie();
  const hoy = diaDe(ahora);
  const informes: InformeCampana[] = [];
  const programadas = await col().where('estado', '==', 'programada').get();
  for (const doc of programadas.docs) {
    const fecha = String(doc.get('fecha') ?? '');
    if (!fecha || fecha > hoy) continue;
    // El 09 y el 10 de la serie, sin margen: al día siguiente ya no dicen la verdad.
    if (sumarDias(fecha, esSoloSuDia(doc.id) ? 0 : MARGEN_DIAS) < hoy) {
      await doc.ref.update({ estado: 'caducada' });
      continue;
    }
    informes.push(await enviarCampana(doc.id));
  }
  return informes;
}
