import 'server-only';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES, hayFirebase } from './firebase-servidor';
import { COLECCION_CONVOCATORIAS } from './convocatorias';
import {
  contextoDesde,
  hoyMadrid,
  type Contextos,
  type CorreoLista,
  type CorreoMal,
  type DatosUsuario,
  type PlantillaLista,
  type PorCorreoLista,
} from './atencion';

/**
 * La parte de servidor de lib/atencion.ts: leer lo que la regla necesita de
 * fuera de la ficha y escribir en la ficha lo que la regla lee.
 *
 * El contexto se monta AQUÍ y en ningún otro sitio. Antes cada pantalla
 * calculaba a su manera quién estaba de baja, quién era ya miembro y si había
 * fecha de formación, y así es como acabó habiendo tres «sin atender»
 * distintos. Los siete sitios que enseñan la situación de alguien (inicio,
 * Pendiente, Clientes, resumen de la mañana, IA, informe y Automatizaciones)
 * llaman a `contextoAtencion`.
 */

/* Las bajas viven en `correos_bajas` (lib/correos.ts no exporta el nombre y
   ese archivo no se toca en este cambio). Cada documento guarda `correo`. */
const COLECCION_BAJAS = 'correos_bajas';

/**
 * El contexto de todas a la vez, con tres lecturas: bajas, cuentas y
 * convocatorias. Se pregunta por correo —`ctx(correo)`— y trae además las
 * cifras de conjunto (`ctx.bajas`, `ctx.miembros`, `ctx.usuarios`,
 * `ctx.convocatorias`) para no volver a leerlas.
 *
 * Con `select` solo baja lo que se usa: una convocatoria lleva dentro a todas
 * sus inscritas, y una cuenta, su perfil entero.
 */
export async function contextoAtencion(db?: Firestore, ahora: Date = new Date()): Promise<Contextos> {
  const hoy = hoyMadrid(ahora);
  if (!db && !hayFirebase()) return contextoDesde({ bajas: [], usuarios: [], convocatorias: [] }, hoy);
  const base = db ?? baseDeDatos();
  const [bajas, usuarios, convocatorias] = await Promise.all([
    base.collection(COLECCION_BAJAS).select('correo').get(),
    base.collection(COLECCIONES.usuarios).select('correo', 'nombre', 'altaPor', 'accesos', 'quiereComunidad', 'pide', 'bloqueada').get(),
    base.collection(COLECCION_CONVOCATORIAS).select('publicada', 'abierta', 'ciudad', 'inicio', 'fin').get(),
  ]);
  return contextoDesde(
    {
      bajas: bajas.docs.map((d) => d.get('correo')),
      usuarios: usuarios.docs.map((d) => ({ ...(d.data() as DatosUsuario), uid: d.id })),
      convocatorias: convocatorias.docs.map((d) => ({ ...d.data(), id: d.id })),
    },
    hoy
  );
}

/** El id de la ficha de una persona: su correo, como lo guardan /api/captar y /api/registro. */
export const idContacto = (correo: string) => correo.trim().toLowerCase().replace(/\//g, '_');

/* Firestore dice «no existe» con el código 5 (NOT_FOUND). Escribir con
   `update()` y tragarse ese error es lo que evita crear fichas fantasma: un
   `set(merge)` sobre un contacto que no existe crea un documento sin
   `creado`, que no sale en Clientes porque la lista se ordena por esa fecha
   (lo advierte app/api/contactos/route.ts). */
const noExiste = (e: unknown) => (e as { code?: unknown })?.code === 5 || /NOT_FOUND/i.test(String((e as Error)?.message ?? ''));

const contactos = () => baseDeDatos().collection(COLECCIONES.contactos);

/**
 * Apunta en la ficha qué correo de la lista se le mandó y si salió. Lo usan
 * `mandarInformacion`, `alRegistrarse`, `enviarCampana` (plantilla
 * `lista-espera`) y el reenvío a mano.
 *
 * - Un `omitido` no pisa lo anterior: «omitido» es que ya lo tenía (su clave
 *   ya estaba) o que está de baja, y no dice nada nuevo de lo que le llegó.
 * - Un fallo, o un correo de otra plantilla (la reserva de plaza), no pisa un
 *   correo de la lista que YA salió: lo tiene, y decir «no le llegó» sería
 *   una falsa alarma. Por eso va en una transacción (una lectura más).
 * - Nunca lanza: un apunte que falla no puede tumbar el envío. Devuelve si
 *   escribió.
 */
export async function marcarCorreoLista(
  contactoId: string | null | undefined,
  m: { plantilla: PlantillaLista; estado: 'enviado' | 'fallido' | 'omitido'; por: PorCorreoLista }
): Promise<boolean> {
  if (!contactoId || m.estado === 'omitido' || !hayFirebase()) return false;
  const ref = contactos().doc(contactoId);
  try {
    return await baseDeDatos().runTransaction(async (t) => {
      const d = await t.get(ref);
      if (!d.exists) return false;
      const previo = d.get('correoLista') as Partial<CorreoLista> | undefined;
      const yaLaTiene = previo?.plantilla === 'lista-espera' && previo?.estado === 'enviado';
      const esLaBuena = m.plantilla === 'lista-espera' && m.estado === 'enviado';
      if (yaLaTiene && !esLaBuena) return false;
      // Se escribe entero: un correo nuevo empieza sin dato de entrega.
      t.update(ref, { correoLista: { plantilla: m.plantilla, estado: m.estado, por: m.por, cuando: FieldValue.serverTimestamp() } });
      return true;
    });
  } catch (e) {
    if (!noExiste(e)) console.error('[atencion] no se ha podido apuntar el correo de la lista:', e);
    return false;
  }
}

/* Un estado de entrega solo se cambia por otro que diga más, igual que en
   lib/entregas.ts: un «retrasado» que llega tarde no tapa un «entregado». */
const PESO_ENTREGA: Record<string, number> = { retrasado: 1, entregado: 2, rebotado: 3, spam: 4 };

/**
 * Lo que contó el servicio de correo del correo de la lista
 * (`correoLista.entrega`). Solo si la ficha ya tiene `correoLista`: sin él no
 * se sabe de qué correo habla. Lo llama `apuntarEvento` (lib/entregas.ts)
 * cuando la línea es de la lista.
 */
export async function marcarEntregaLista(contactoId: string | null | undefined, entrega: string): Promise<boolean> {
  if (!contactoId || !PESO_ENTREGA[entrega] || !hayFirebase()) return false;
  const ref = contactos().doc(contactoId);
  try {
    return await baseDeDatos().runTransaction(async (t) => {
      const d = await t.get(ref);
      const previo = d.exists ? (d.get('correoLista') as Partial<CorreoLista> | undefined) : undefined;
      if (!previo || typeof previo !== 'object') return false;
      if ((PESO_ENTREGA[String(previo.entrega ?? '')] ?? 0) >= PESO_ENTREGA[entrega]) return false;
      t.update(ref, { 'correoLista.entrega': entrega });
      return true;
    });
  } catch (e) {
    if (!noExiste(e)) console.error('[atencion] no se ha podido apuntar la entrega del correo de la lista:', e);
    return false;
  }
}

/**
 * Un correo suyo, cualquiera, rebotó o lo marcó como spam (`correoMal`). Con
 * eso sale en «Te necesita: no le llegó su correo» aunque el rebote la haya
 * dado de baja: hay que escribirle por otra vía. `update()`, nunca `set`.
 */
export async function marcarCorreoMal(
  contactoId: string | null | undefined,
  m: { entrega: CorreoMal['entrega']; cuando?: Date | null }
): Promise<boolean> {
  if (!contactoId || !hayFirebase()) return false;
  const cuando = m.cuando && !Number.isNaN(m.cuando.getTime()) ? Timestamp.fromDate(m.cuando) : FieldValue.serverTimestamp();
  try {
    await contactos().doc(contactoId).update({ correoMal: { entrega: m.entrega, cuando } });
    return true;
  } catch (e) {
    if (!noExiste(e)) console.error('[atencion] no se ha podido apuntar el correo que no llegó:', e);
    return false;
  }
}

/**
 * Los correos del equipo, de la variable `CORREOS_PRUEBA` de Vercel
 * (separados por comas). Se leen cada vez: es una cadena corta y así un
 * cambio en Vercel vale sin tocar nada.
 */
const correosPrueba = () =>
  new Set(
    (process.env.CORREOS_PRUEBA ?? '')
      .split(/[\s,;]+/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)
  );

/**
 * Una cuenta de prueba del equipo: se ve en Clientes, con su pastilla
 * «Prueba», pero no cuenta en ninguna cifra (ni en «Te necesitan», ni en la
 * lista, ni en los accesos). Es de prueba si la cuenta la crearon los ensayos
 * (`altaPor: 'prueba'`, o `pruebas/…` en los de pruebas/*.mjs) o si su correo
 * está en `CORREOS_PRUEBA`, que es lo que cubre las cuentas reales del equipo
 * y las que ya se borraron.
 */
export function esPrueba(correo: unknown, usuario?: Pick<DatosUsuario, 'altaPor'> | null): boolean {
  const alta = typeof usuario?.altaPor === 'string' ? usuario.altaPor : '';
  if (alta === 'prueba' || alta.startsWith('pruebas/')) return true;
  const c = String(correo ?? '').trim().toLowerCase();
  return Boolean(c) && correosPrueba().has(c);
}
