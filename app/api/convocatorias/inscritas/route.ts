import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { exigirAdmin } from '@/lib/permisos';
import { aConvocatoria, coleccion, refrescarFormaciones, revisarInscrita } from '@/lib/convocatorias';

/**
 * Las inscritas de una convocatoria.
 *
 *   POST   { convocatoria, nombre, correo, telefono, pagado, estado, nota, contacto? } → apuntar
 *   PATCH  { convocatoria, id, …lo mismo }                                             → corregir
 *   DELETE ?convocatoria=&id=                                                          → quitar
 *
 * Todas devuelven la convocatoria entera ya cambiada: la pantalla la cambia
 * por la que tenía y así las cuentas (cobrado, pendiente, plazas) salen del
 * servidor, no de sumar en el navegador lo que creía tener.
 *
 * Cada inscrita es una entrada del mapa `inscritas` del documento (ver
 * lib/convocatorias.ts). Se escribe en una transacción que recuenta
 * `ocupadas` a la vez, que es lo que lee la web para decir si quedan plazas.
 *
 * `contacto` es solo un enlace al contacto de Clientes del que se copió: el
 * contacto NO se toca desde aquí.
 *
 * Solo Sorela.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,80}$/;

type Resultado = { status: number; cuerpo: Record<string, unknown> };

async function leerCuerpo(peticion: Request): Promise<Record<string, unknown> | null> {
  try {
    const c = await peticion.json();
    return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Hace el cambio dentro de una transacción y contesta con la convocatoria
 * como queda. `cambiar` recibe la convocatoria actual y devuelve lo que hay
 * que escribir en el mapa, o un error ya hecho.
 */
async function cambiarInscritas(
  idConvocatoria: string,
  cambiar: (
    c: ReturnType<typeof aConvocatoria>
  ) => { error: Resultado } | { escribir: Record<string, unknown>; ocupadas: number }
): Promise<NextResponse> {
  const ref = coleccion().doc(idConvocatoria);
  let resultado: Resultado | null = null;
  try {
    await ref.firestore.runTransaction(async (tx) => {
      resultado = null;
      const actual = await tx.get(ref);
      if (!actual.exists) {
        resultado = { status: 404, cuerpo: { ok: false, motivo: 'no-existe' } };
        return;
      }
      const r = cambiar(aConvocatoria(actual.id, actual.data()));
      if ('error' in r) {
        resultado = r.error;
        return;
      }
      tx.update(ref, { ...r.escribir, ocupadas: r.ocupadas, actualizada: FieldValue.serverTimestamp() });
    });
  } catch (e) {
    console.error('[convocatorias] no se han podido guardar las inscritas', e);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
  const fallo = resultado as Resultado | null;
  if (fallo) return NextResponse.json(fallo.cuerpo, { status: fallo.status });

  refrescarFormaciones();
  const guardada = await ref.get();
  return NextResponse.json({ ok: true, convocatoria: aConvocatoria(ref.id, guardada.data()) });
}

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const cuerpo = await leerCuerpo(peticion);
  const idConvocatoria = typeof cuerpo?.convocatoria === 'string' ? cuerpo.convocatoria : '';
  if (!cuerpo || !ID.test(idConvocatoria)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  // El id de la inscrita lo fabrica Firestore: veinte letras y números, que
  // se pueden usar tal cual como ruta del mapa (`inscritas.<id>`).
  const id = coleccion().doc().id;

  return cambiarInscritas(idConvocatoria, (c) => {
    const r = revisarInscrita(cuerpo, c.precio);
    if (!r.ok) return { error: { status: 400, cuerpo: { ok: false, motivo: 'datos', errores: r.errores } } };
    /*
     * Llena no se apunta a nadie más. Si Sorela quiere hacer un hueco, sube
     * las plazas: así lo que dice la web («Completa») y lo que hay aquí no se
     * contradicen.
     */
    if (c.inscritas.length >= c.plazas) {
      return {
        error: {
          status: 409,
          cuerpo: { ok: false, motivo: 'completa', errores: { general: `Está completa: las ${c.plazas} plazas están ocupadas. Si quieres hacerle sitio, sube antes las plazas de la convocatoria.` } },
        },
      };
    }
    return {
      escribir: { [`inscritas.${id}`]: { ...r.datos, creada: new Date().toISOString() } },
      ocupadas: c.inscritas.length + 1,
    };
  });
}

export async function PATCH(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const cuerpo = await leerCuerpo(peticion);
  const idConvocatoria = typeof cuerpo?.convocatoria === 'string' ? cuerpo.convocatoria : '';
  const id = typeof cuerpo?.id === 'string' ? cuerpo.id : '';
  if (!cuerpo || !ID.test(idConvocatoria) || !ID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  return cambiarInscritas(idConvocatoria, (c) => {
    const antes = c.inscritas.find((i) => i.id === id);
    // Si se acaba de borrar en otra pestaña, no se resucita a medias.
    if (!antes) return { error: { status: 404, cuerpo: { ok: false, motivo: 'no-existe' } } };
    const r = revisarInscrita(cuerpo, c.precio);
    if (!r.ok) return { error: { status: 400, cuerpo: { ok: false, motivo: 'datos', errores: r.errores } } };
    return {
      escribir: { [`inscritas.${id}`]: { ...r.datos, creada: antes.creada || new Date().toISOString() } },
      ocupadas: c.inscritas.length,
    };
  });
}

export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const q = new URL(peticion.url).searchParams;
  const idConvocatoria = q.get('convocatoria') ?? '';
  const id = q.get('id') ?? '';
  if (!ID.test(idConvocatoria) || !ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  return cambiarInscritas(idConvocatoria, (c) => {
    if (!c.inscritas.some((i) => i.id === id)) return { error: { status: 404, cuerpo: { ok: false, motivo: 'no-existe' } } };
    return {
      escribir: { [`inscritas.${id}`]: FieldValue.delete() },
      ocupadas: c.inscritas.length - 1,
    };
  });
}
