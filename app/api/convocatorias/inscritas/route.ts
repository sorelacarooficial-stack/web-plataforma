import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { exigirAdmin } from '@/lib/permisos';
import { ID, accesoGuardado, coleccion, refrescarFormaciones, revisarInscrita } from '@/lib/convocatorias';
import { anularEnlaces, convocatoriaConAccesos } from '@/lib/convocatorias-acceso';

/**
 * Las inscritas de una convocatoria.
 *
 *   POST   { convocatoria, nombre, correo, telefono, pagado, estado, nota, contacto? } → apuntar
 *   PATCH  { convocatoria, id, …lo mismo }                                             → corregir
 *   DELETE ?convocatoria=&id=                                                          → quitar
 *
 * Todas contestan con la convocatoria entera ya cambiada (con el estado del
 * acceso al curso de cada inscrita): la pantalla cambia la suya por esta, y así
 * las cuentas —cobrado, pendiente, plazas— salen del servidor y no de sumar en
 * el navegador lo que creía tener.
 *
 * Cada inscrita es una entrada del mapa `inscritas` del documento
 * (lib/convocatorias.ts). Se escribe en una transacción que recuenta
 * `ocupadas` a la vez, que es lo único que la web lee para decir si quedan
 * plazas.
 *
 * `contacto` es solo un enlace a la ficha de Clientes de la que se copió: la
 * ficha NO se toca desde aquí. Y apuntar a alguien no le da nada en la
 * plataforma: el acceso al curso se crea aparte, con su botón (./acceso).
 *
 * Solo Sorela.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const origenDe = (peticion: Request) => new URL(peticion.url).origin;

type Fallo = { status: number; cuerpo: Record<string, unknown> };

async function cuerpoDe(peticion: Request): Promise<Record<string, unknown> | null> {
  try {
    const c = await peticion.json();
    return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** La convocatoria como queda, para contestar. */
async function contestar(peticion: Request, id: string, extra: Record<string, unknown> = {}) {
  refrescarFormaciones();
  const d = await coleccion().doc(id).get();
  if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  return NextResponse.json({ ok: true, ...extra, convocatoria: await convocatoriaConAccesos(id, d.data() ?? {}, origenDe(peticion)) });
}

const fallo = (f: Fallo) => NextResponse.json(f.cuerpo, { status: f.status });
const NO_EXISTE: Fallo = { status: 404, cuerpo: { ok: false, motivo: 'no-existe' } };

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = await cuerpoDe(peticion);
  const idConv = typeof c?.convocatoria === 'string' ? c.convocatoria : '';
  if (!c || !ID.test(idConv)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const r = revisarInscrita(c);
  if (!r.ok) return NextResponse.json({ ok: false, motivo: 'datos', errores: r.errores }, { status: 400 });

  const ref = coleccion().doc(idConv);
  // El id lo pone Firestore: veinte letras y números, que valen tal cual como ruta del mapa.
  const id = coleccion().doc().id;
  try {
    const problema = await ref.firestore.runTransaction(async (t): Promise<Fallo | null> => {
      const d = await t.get(ref);
      if (!d.exists) return NO_EXISTE;
      const ocupadas = Object.keys(d.get('inscritas') ?? {}).length;
      const plazas = d.get('plazas');
      /* Llena no entra nadie más: si Sorela quiere hacer un hueco, sube antes
         las plazas, y así la web («Completa») y esta lista no se contradicen.
         Con las plazas por definir no hay tope. */
      if (typeof plazas === 'number' && ocupadas >= plazas) {
        return {
          status: 409,
          cuerpo: { ok: false, motivo: 'completa', errores: { general: `Está completa: las ${plazas} plazas están ocupadas. Si quieres hacerle sitio, sube antes las plazas.` } },
        };
      }
      t.update(ref, {
        [`inscritas.${id}`]: { ...r.datos, creada: new Date().toISOString() },
        ocupadas: ocupadas + 1,
        actualizada: FieldValue.serverTimestamp(),
      });
      return null;
    });
    if (problema) return fallo(problema);
  } catch (e) {
    console.error('[convocatorias] no se ha podido apuntar a una inscrita', e);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
  return contestar(peticion, idConv, { inscrita: id });
}

export async function PATCH(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = await cuerpoDe(peticion);
  const idConv = typeof c?.convocatoria === 'string' ? c.convocatoria : '';
  const id = typeof c?.id === 'string' ? c.id : '';
  if (!c || !ID.test(idConv) || !ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const r = revisarInscrita(c);
  if (!r.ok) return NextResponse.json({ ok: false, motivo: 'datos', errores: r.errores }, { status: 400 });

  const ref = coleccion().doc(idConv);
  let anular: string | null = null;
  try {
    const problema = await ref.firestore.runTransaction(async (t): Promise<Fallo | null> => {
      anular = null;
      const d = await t.get(ref);
      const antes = d.exists ? (d.get(`inscritas.${id}`) as FirebaseFirestore.DocumentData | undefined) : undefined;
      // Si se acaba de quitar en otra pestaña, no se resucita a medias.
      if (!antes) return NO_EXISTE;

      /* Campo a campo y no la inscrita entera: así no se pisa su `acceso` (el
         enlace o la cuenta que ya se le dio) ni su fecha de alta. */
      const cambios: Record<string, unknown> = { actualizada: FieldValue.serverTimestamp() };
      for (const [k, v] of Object.entries(r.datos)) cambios[`inscritas.${id}.${k}`] = v;

      /* Si cambia el correo y tenía un enlace sin usar, ese enlace solo vale
         para el correo viejo: se anula y se quita, para que el botón «Crear
         acceso al curso» vuelva a salir y haga uno para el correo bueno. */
      const acceso = accesoGuardado(antes.acceso);
      const correoAntes = typeof antes.correo === 'string' ? antes.correo : '';
      if (acceso?.tipo === 'enlace' && correoAntes !== r.datos.correo) {
        anular = acceso.codigo;
        cambios[`inscritas.${id}.acceso`] = FieldValue.delete();
      }
      t.update(ref, cambios);
      return null;
    });
    if (problema) return fallo(problema);
  } catch (e) {
    console.error('[convocatorias] no se ha podido corregir una inscrita', e);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
  // TypeScript no ve que la transacción lo cambia: se lee de nuevo con su tipo.
  const codigo = anular as string | null;
  if (codigo) await anularEnlaces([codigo]);
  return contestar(peticion, idConv, codigo ? { aviso: 'enlace-anulado' } : {});
}

export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const q = new URL(peticion.url).searchParams;
  const idConv = q.get('convocatoria') ?? '';
  const id = q.get('id') ?? '';
  if (!ID.test(idConv) || !ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const ref = coleccion().doc(idConv);
  let anular: string | null = null;
  try {
    const problema = await ref.firestore.runTransaction(async (t): Promise<Fallo | null> => {
      anular = null;
      const d = await t.get(ref);
      const mapa = (d.exists ? d.get('inscritas') : null) as Record<string, FirebaseFirestore.DocumentData> | null;
      if (!mapa?.[id]) return NO_EXISTE;
      const acceso = accesoGuardado(mapa[id].acceso);
      if (acceso?.tipo === 'enlace') anular = acceso.codigo;
      t.update(ref, {
        [`inscritas.${id}`]: FieldValue.delete(),
        ocupadas: Object.keys(mapa).length - 1,
        actualizada: FieldValue.serverTimestamp(),
      });
      return null;
    });
    if (problema) return fallo(problema);
  } catch (e) {
    console.error('[convocatorias] no se ha podido quitar una inscrita', e);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
  /* Su enlace, si seguía sin usar, deja de valer: abriría el curso a quien lo
     tenga y ella ya no está apuntada. Si ya lo usó, el acceso se queda (puede
     haber pagado el curso); se quita desde Cuentas si hace falta. */
  const codigo = anular as string | null;
  if (codigo) await anularEnlaces([codigo]);
  return contestar(peticion, idConv);
}
