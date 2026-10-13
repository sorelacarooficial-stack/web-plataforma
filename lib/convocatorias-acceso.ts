import 'server-only';
import { randomBytes } from 'node:crypto';
import { after } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { aplicacion, baseDeDatos, COLECCIONES } from './firebase-servidor';
import { CURSO_DIVINE, revisarAccesos, tieneMembresia, type Acceso } from './accesos';
import { clave } from './aula';
import { alCambiarAccesos, alCrearInvitacion } from './automatizar';
import { ETIQUETA_QUE_DA, aInvitacion, caducaDentroDe, docInvitacion, estadoDe } from './invitaciones';
import { accesoGuardado, aConvocatoria, coleccion, type AccesoGuardado } from './convocatorias';
import { cursoDe, type AccesoInscrita, type Convocatoria } from './convocatorias-tipos';

/**
 * «Crear acceso al curso» desde una inscrita de una convocatoria.
 *
 * Una inscrita ha pagado (o va a pagar) la formación presencial. Lo que este
 * botón le abre es OTRA cosa: el curso en el aula, con sus clases y su
 * material. Y NUNCA la membresía de la Comunidad Divine, que se paga aparte
 * cada mes: aquí no hay ningún camino que la dé. El enlace se crea siempre
 * con `que: ['curso']` y a una cuenta solo se le añade un acceso de tipo
 * «curso»; lo que ya tuviera se queda como estaba.
 *
 * Dos caminos, según tenga cuenta o no:
 *
 *   · Ya tiene cuenta con ese correo → se le añade el curso a su cuenta, pero
 *     solo después de que Sorela lo confirme (la pantalla le enseña de quién
 *     es esa cuenta antes de tocarla).
 *   · No la tiene → un enlace de invitación de UN SOLO USO, el mismo sistema
 *     de Cuentas (lib/invitaciones.ts): caduca a los 30 días y, si la inscrita
 *     tiene correo, solo vale para ese correo y le llega también por correo.
 *
 * Lo que se ha hecho se guarda en la inscrita (`acceso`) para que su fila
 * diga «Enlace sin usar» o «Ya tiene cuenta» sin tener que buscarlo.
 */

/** El enlace entero, igual que lo construye app/api/invitaciones. */
export const enlaceInvitacion = (origen: string, codigo: string) => `${origen}/registro?invitacion=${codigo}`;

/**
 * Lee de una vez las invitaciones de todas las inscritas que tienen enlace,
 * para decir de cada una si sigue sin usar, se usó, caducó o se anuló.
 *
 * Una sola lectura agrupada (`getAll`) para toda la pantalla, y no una por
 * fila: con varias convocatorias llenas serían decenas de viajes a Firestore
 * para pintar una lista.
 */
export async function lectorDeAccesos(docs: FirebaseFirestore.DocumentData[], origen: string) {
  const codigos = new Set<string>();
  for (const v of docs) {
    for (const x of Object.values((v.inscritas ?? {}) as Record<string, FirebaseFirestore.DocumentData>)) {
      const a = accesoGuardado(x?.acceso);
      if (a?.tipo === 'enlace') codigos.add(a.codigo);
    }
  }
  const leidas = new Map<string, FirebaseFirestore.DocumentData | null>();
  const lista = [...codigos];
  for (let i = 0; i < lista.length; i += 200) {
    const tanda = lista.slice(i, i + 200);
    const snaps = await baseDeDatos().getAll(...tanda.map((c) => docInvitacion(c)));
    snaps.forEach((s, n) => leidas.set(tanda[n], s.exists ? (s.data() ?? {}) : null));
  }

  return (a: AccesoGuardado | null): AccesoInscrita => {
    if (!a) return { estado: 'sin-crear', enlace: null, caduca: null, desde: null };
    if (a.tipo === 'cuenta') return { estado: 'ya-tiene-cuenta', enlace: null, caduca: null, desde: a.en || null };
    const v = leidas.get(a.codigo);
    // Una invitación que ya no está se trata como anulada: no sirve para nada.
    if (!v) return { estado: 'enlace-anulado', enlace: null, caduca: a.caduca || null, desde: a.creado || null };
    const estado = estadoDe(v);
    const caduca = aInvitacion(a.codigo, v).caduca || a.caduca || null;
    if (estado === 'usada') return { estado: 'ya-tiene-cuenta', enlace: null, caduca, desde: a.creado || null };
    if (estado === 'caducada') return { estado: 'enlace-caducado', enlace: null, caduca, desde: a.creado || null };
    if (estado === 'anulada') return { estado: 'enlace-anulado', enlace: null, caduca, desde: a.creado || null };
    return { estado: 'enlace-sin-usar', enlace: enlaceInvitacion(origen, a.codigo), caduca, desde: a.creado || null };
  };
}

/** Una convocatoria leída con el estado real del acceso de cada inscrita. */
export async function convocatoriaConAccesos(id: string, v: FirebaseFirestore.DocumentData, origen: string): Promise<Convocatoria> {
  return aConvocatoria(id, v, await lectorDeAccesos([v], origen));
}

/**
 * Anula los enlaces que sigan sin usar. Se llama al borrar una inscrita o una
 * convocatoria entera: un enlace suelto de alguien que ya no está apuntada
 * seguiría abriendo el curso a quien lo tuviera. Los usados no se tocan: ese
 * acceso ya está dado y se quita, si hace falta, desde Cuentas.
 */
export async function anularEnlaces(codigos: string[]) {
  const db = baseDeDatos();
  for (const codigo of codigos) {
    try {
      await db.runTransaction(async (t) => {
        const d = await t.get(docInvitacion(codigo));
        if (d.exists && estadoDe(d.data() ?? {}) === 'pendiente') t.update(d.ref, { anulada: true });
      });
    } catch (e) {
      console.error('[convocatorias] no se ha podido anular un enlace', e);
    }
  }
}

/** Los códigos de enlace de una lista de inscritas guardadas. */
export function codigosDe(inscritas: Record<string, FirebaseFirestore.DocumentData> | undefined): string[] {
  return Object.values(inscritas ?? {})
    .map((x) => accesoGuardado(x?.acceso))
    .filter((a): a is Extract<AccesoGuardado, { tipo: 'enlace' }> => a?.tipo === 'enlace')
    .map((a) => a.codigo);
}

/** Lo que se le enseña a Sorela antes de tocar una cuenta que ya existe. */
export type CuentaEncontrada = {
  nombre: string | null;
  correo: string;
  yaTieneCurso: boolean;
  tieneMembresia: boolean;
  bloqueada: boolean;
};

export type ResultadoAcceso =
  | { ok: true; paso: 'hay-cuenta'; cuenta: CuentaEncontrada }
  | { ok: true; paso: 'cuenta'; yaLoTenia: boolean; bloqueada: boolean }
  | { ok: true; paso: 'enlace'; enlace: string; nuevo: boolean; correo: string | null }
  | { ok: false; motivo: 'no-existe' | 'curso-sin-enlace' };

const tieneElCurso = (accesos: Acceso[], nombre: string) =>
  accesos.some((a) => a.tipo === 'curso' && clave(a.nombre) === clave(nombre));

/**
 * Crea (o devuelve, si ya lo tiene) el acceso al curso de una inscrita.
 *
 * `darACuenta` es la confirmación de Sorela: sin ella, si hay una cuenta con
 * ese correo no se toca nada y se devuelve de quién es, para preguntar.
 */
export async function crearAccesoCurso(o: {
  convocatoria: string;
  inscrita: string;
  darACuenta: boolean;
  origen: string;
  creadoPor: string;
}): Promise<ResultadoAcceso> {
  const db = baseDeDatos();
  const ref = coleccion().doc(o.convocatoria);
  const doc = await ref.get();
  const inscrita = doc.exists ? (doc.get(`inscritas.${o.inscrita}`) as FirebaseFirestore.DocumentData | undefined) : undefined;
  if (!doc.exists || !inscrita) return { ok: false, motivo: 'no-existe' };

  const curso = cursoDe(doc.get('curso'));
  const previo = accesoGuardado(inscrita.acceso);

  /* Lo que ya está hecho no se repite. Un enlace sin usar se devuelve tal cual
     en vez de crear otro: dos enlaces vivos para la misma persona son dos
     puertas abiertas, y el segundo podría acabar en manos de otra. */
  if (previo?.tipo === 'cuenta') return { ok: true, paso: 'cuenta', yaLoTenia: true, bloqueada: false };
  if (previo?.tipo === 'enlace') {
    const inv = await docInvitacion(previo.codigo).get();
    if (inv.exists && estadoDe(inv.data() ?? {}) === 'pendiente') {
      return { ok: true, paso: 'enlace', enlace: enlaceInvitacion(o.origen, previo.codigo), nuevo: false, correo: inv.get('correo') ?? null };
    }
    if (inv.exists && estadoDe(inv.data() ?? {}) === 'usada') {
      return { ok: true, paso: 'cuenta', yaLoTenia: true, bloqueada: false };
    }
  }

  const correo = typeof inscrita.correo === 'string' ? inscrita.correo.trim().toLowerCase() : '';
  const nombre = typeof inscrita.nombre === 'string' ? inscrita.nombre.trim() : null;

  /* ---------- ¿Ya tiene cuenta con ese correo? ---------- */
  const usuario = correo ? await getAuth(aplicacion()).getUserByEmail(correo).catch(() => null) : null;
  if (usuario) {
    const refUsuario = db.collection(COLECCIONES.usuarios).doc(usuario.uid);
    const ficha = await refUsuario.get();
    const antes = revisarAccesos(ficha.get('accesos'));
    const bloqueada = Boolean(ficha.get('bloqueada')) || usuario.disabled;
    if (!o.darACuenta) {
      return {
        ok: true,
        paso: 'hay-cuenta',
        cuenta: {
          nombre: (ficha.get('nombre') as string | undefined) ?? usuario.displayName ?? null,
          correo,
          yaTieneCurso: tieneElCurso(antes, curso.accesoAula),
          tieneMembresia: tieneMembresia(antes),
          bloqueada,
        },
      };
    }

    const r = await db.runTransaction(async (t) => {
      const [f, c] = await Promise.all([t.get(refUsuario), t.get(ref)]);
      if (!c.exists || !c.get(`inscritas.${o.inscrita}`)) return null;
      const previos = revisarAccesos(f.get('accesos'));
      const yaLoTenia = tieneElCurso(previos, curso.accesoAula);
      // Solo se AÑADE el curso. La membresía, si la tenía, sigue; si no, no aparece.
      const accesos = yaLoTenia
        ? previos
        : revisarAccesos([...previos, { tipo: 'curso', nombre: curso.accesoAula, desde: new Date().toISOString() }]);
      if (!yaLoTenia) {
        const cambios: Record<string, unknown> = {
          correo: usuario.email ?? correo,
          accesos,
          accesosCambiados: FieldValue.serverTimestamp(),
        };
        // Una cuenta sin ficha (de antes de las fichas) necesita este campo para salir en Cuentas.
        if (!f.exists) cambios.ultimoAcceso = null;
        t.set(refUsuario, cambios, { merge: true });
      }
      t.update(ref, {
        [`inscritas.${o.inscrita}.acceso`]: { tipo: 'cuenta', uid: usuario.uid, en: new Date().toISOString() },
        actualizada: FieldValue.serverTimestamp(),
      });
      return { yaLoTenia, previos, accesos };
    });
    if (!r) return { ok: false, motivo: 'no-existe' };
    /* Su correo de bienvenida al curso, el mismo que sale desde Cuentas. Solo
       si lo gana ahora (lib/automatizar no escribe por lo que ya tenía), y
       después de contestar: Sorela no espera a Gmail para ver la fila cambiada. */
    if (!r.yaLoTenia) {
      const nombreCuenta = (ficha.get('nombre') as string | undefined) ?? usuario.displayName ?? nombre;
      after(() => alCambiarAccesos({ uid: usuario.uid, correo: usuario.email ?? correo, nombre: nombreCuenta }, r.previos, r.accesos));
    }
    return { ok: true, paso: 'cuenta', yaLoTenia: r.yaLoTenia, bloqueada };
  }

  /* ---------- Sin cuenta: un enlace de un solo uso ---------- */

  /* Los enlaces de invitación saben dar un solo curso: CURSO_DIVINE (ver
     accesosDe en lib/invitaciones.ts). Si algún día se convoca otro curso,
     hay que enseñárselo a las invitaciones antes; mientras tanto se dice, en
     vez de crear un enlace que abriría un curso distinto del pagado. */
  if (clave(curso.accesoAula) !== clave(CURSO_DIVINE)) return { ok: false, motivo: 'curso-sin-enlace' };

  const codigo = randomBytes(24).toString('base64url');
  const caduca = caducaDentroDe();
  await docInvitacion(codigo).set({
    // SOLO el curso. Nunca 'membresia'.
    que: ['curso'],
    nombre,
    correo: correo || null,
    creadoPor: o.creadoPor,
    creado: FieldValue.serverTimestamp(),
    caduca,
    usada: null,
    anulada: false,
    // De dónde salió, por si hay que buscarlo desde Cuentas.
    convocatoria: o.convocatoria,
    inscrita: o.inscrita,
  });
  const guardado = await db.runTransaction(async (t) => {
    const c = await t.get(ref);
    if (!c.exists || !c.get(`inscritas.${o.inscrita}`)) return false;
    t.update(ref, {
      [`inscritas.${o.inscrita}.acceso`]: { tipo: 'enlace', codigo, creado: new Date().toISOString(), caduca: caduca.toDate().toISOString() },
      actualizada: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!guardado) {
    // La borraron mientras tanto: el enlace no puede quedarse vivo y suelto.
    await anularEnlaces([codigo]);
    return { ok: false, motivo: 'no-existe' };
  }
  const enlace = enlaceInvitacion(o.origen, codigo);
  /* Con correo, le llega también por correo, como desde Cuentas. Después de
     contestar: el enlace ya está en pantalla para copiarlo o mandarlo por
     WhatsApp, y eso no tiene por qué esperar al correo. */
  if (correo) {
    after(() =>
      alCrearInvitacion({ codigo, correo, nombre, que: [ETIQUETA_QUE_DA.curso], caduca: caduca.toDate().toISOString(), enlace })
    );
  }
  return { ok: true, paso: 'enlace', enlace, nuevo: true, correo: correo || null };
}
