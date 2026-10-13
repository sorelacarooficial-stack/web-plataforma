import 'server-only';
import { after } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from './firebase-servidor';
import { CURSO_DIVINE, revisarAccesos } from './accesos';
import { clave } from './aula';
import { alCambiarAccesos } from './automatizar';
import { aInvitacion, docInvitacion, estadoDe } from './invitaciones';
import { accesoGuardado, aConvocatoria, type AccesoGuardado } from './convocatorias';
import type { AccesoInscrita, Convocatoria } from './convocatorias-tipos';

/**
 * El acceso al curso de las inscritas de una convocatoria: leerlo y anularlo.
 *
 * Los enlaces se CREAN en un solo sitio, Cuentas › Enlaces de invitación
 * (app/api/invitaciones), eligiendo la convocatoria y la inscrita. Allí se
 * guarda en la inscrita (`acceso`) el enlace, y al usarlo pasa a apuntar a su
 * cuenta (lib/invitaciones.ts › canjear). Con eso su fila dice «Enlace sin
 * usar» o «Ya tiene cuenta» sin tener que buscarlo, y marcarla «Pagado» sabe
 * a qué cuenta abrirle el curso completo.
 *
 * Nunca da la membresía de la Comunidad Divine: se paga aparte.
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
  /* Una transacción por enlace, pero todas a la vez: con un grupo grande, una
     detrás de otra hacían esperar el borrado decenas de viajes a Firestore.
     Sigue siendo transacción (y no un batch a ciegas) para no marcar como
     anulado un enlace que alguien acabe de usar en ese mismo instante. */
  await Promise.all(
    codigos.map((codigo) =>
      db
        .runTransaction(async (t) => {
          const d = await t.get(docInvitacion(codigo));
          if (d.exists && estadoDe(d.data() ?? {}) === 'pendiente') t.update(d.ref, { anulada: true });
        })
        .catch((e) => console.error('[convocatorias] no se ha podido anular un enlace', e))
    )
  );
}

/** Los códigos de enlace de una lista de inscritas guardadas. */
export function codigosDe(inscritas: Record<string, FirebaseFirestore.DocumentData> | undefined): string[] {
  return Object.values(inscritas ?? {})
    .map((x) => accesoGuardado(x?.acceso))
    .filter((a): a is Extract<AccesoGuardado, { tipo: 'enlace' }> => a?.tipo === 'enlace')
    .map((a) => a.codigo);
}

/**
 * La inscrita ha pagado el resto («Pagado»): se le abre el curso completo.
 *
 *   · Ya entró con su enlace → a su cuenta se le quita el «solo precurso» y
 *     le llega el correo de que ya tiene todo.
 *   · Su enlace aún está sin usar → el enlace pasa a dar el curso completo.
 *
 * Solo abre: no quita nada si luego se cambia el pago a otro estado (eso se
 * hace a mano en su cuenta, para no cerrarle el curso por un dedazo).
 */
export async function abrirCursoCompleto(acceso: AccesoGuardado | null, convocatoria: string) {
  if (!acceso) return;
  const db = baseDeDatos();
  let uid = acceso.tipo === 'cuenta' ? acceso.uid : null;
  if (acceso.tipo === 'enlace') {
    uid = await db
      .runTransaction(async (t) => {
        const d = await t.get(docInvitacion(acceso.codigo));
        if (!d.exists) return null;
        // Un enlace ya usado (de antes de enlazar la cuenta en la inscrita): su cuenta.
        if (estadoDe(d.data() ?? {}) === 'usada') return (d.get('usada.uid') as string | undefined) ?? null;
        if (estadoDe(d.data() ?? {}) === 'pendiente' && d.get('nivel') === 'precurso') t.update(d.ref, { nivel: 'completo' });
        return null;
      })
      .catch((e) => {
        console.error('[convocatorias] no se ha podido completar el enlace', e);
        return null;
      });
  }
  if (!uid) return;
  const cuenta = uid;
  const ref = db.collection(COLECCIONES.usuarios).doc(cuenta);
  try {
    const r = await db.runTransaction(async (t) => {
      const f = await t.get(ref);
      if (!f.exists) return null;
      const antes = revisarAccesos(f.get('accesos'));
      const curso = antes.find((a) => a.tipo === 'curso' && clave(a.nombre) === clave(CURSO_DIVINE));
      if (!curso || curso.completo !== false) return null;
      const despues = antes.map((a) => {
        if (a !== curso) return a;
        const { completo: _c, ...resto } = a;
        return { ...resto, convocatoria: a.convocatoria ?? convocatoria };
      });
      t.update(ref, { accesos: despues, accesosCambiados: FieldValue.serverTimestamp() });
      return { antes, despues, correo: (f.get('correo') as string | undefined) ?? null, nombre: (f.get('nombre') as string | undefined) ?? null };
    });
    if (r) after(() => alCambiarAccesos({ uid: cuenta, correo: r.correo, nombre: r.nombre }, r.antes, r.despues));
  } catch (e) {
    console.error('[convocatorias] no se ha podido abrir el curso completo', e);
  }
}
