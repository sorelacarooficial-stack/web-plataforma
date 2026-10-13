import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { exigirAdmin } from '@/lib/permisos';
import { ID, aConvocatoria, coleccion, refrescarFormaciones, revisarConvocatoria } from '@/lib/convocatorias';
import { anularEnlaces, codigosDe, convocatoriaConAccesos, lectorDeAccesos } from '@/lib/convocatorias-acceso';
import { hoyISO } from '@/lib/convocatorias-tipos';

/**
 * Las convocatorias de formación, del lado de Sorela.
 *
 *   GET                                  → todas, con sus inscritas y el estado de su acceso al curso
 *   POST   { curso, inicio, fin, … }     → crea una
 *   PATCH  { id, curso, inicio, … }      → la corrige entera
 *   PATCH  { id, publicada?, abierta? }  → solo los interruptores de la tarjeta
 *   DELETE ?id=…                         → la borra con sus inscritas
 *
 * Solo Sorela. Cualquier cambio rehace /formaciones en la siguiente visita:
 * es la única página pública que lee de aquí. Las inscritas tienen su propia
 * ruta (./inscritas) y el acceso al curso la suya (./acceso).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const origenDe = (peticion: Request) => new URL(peticion.url).origin;

async function cuerpoDe(peticion: Request): Promise<Record<string, unknown> | null> {
  try {
    const c = await peticion.json();
    return c && typeof c === 'object' ? (c as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  try {
    const l = await coleccion().get();
    const lector = await lectorDeAccesos(l.docs.map((d) => d.data()), origenDe(peticion));
    // Las que vienen primero arriba; el orden de «pasadas» lo decide la pantalla.
    const convocatorias = l.docs
      .map((d) => aConvocatoria(d.id, d.data(), lector))
      .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.ciudad.localeCompare(b.ciudad, 'es'));
    return NextResponse.json({ ok: true, convocatorias, hoy: hoyISO() });
  } catch (e) {
    // Un fallo de Firestore contesta con palabras, no con una traza.
    console.error('[convocatorias] no se han podido leer', e);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
}

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = await cuerpoDe(peticion);
  if (!c) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const r = revisarConvocatoria(c);
  if (!r.ok) return NextResponse.json({ ok: false, motivo: 'datos', errores: r.errores }, { status: 400 });

  const ref = coleccion().doc();
  await ref.set({
    ...r.datos,
    inscritas: {},
    ocupadas: 0,
    creadaPor: g.sesion.uid,
    creada: FieldValue.serverTimestamp(),
    actualizada: FieldValue.serverTimestamp(),
  });
  refrescarFormaciones();
  const d = await ref.get();
  return NextResponse.json({ ok: true, convocatoria: aConvocatoria(ref.id, d.data() ?? {}) });
}

export async function PATCH(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const c = await cuerpoDe(peticion);
  const id = typeof c?.id === 'string' ? c.id : '';
  if (!c || !ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const ref = coleccion().doc(id);

  /* Los dos interruptores de la tarjeta («Mostrar en la web» e «Inscripciones
     abiertas») se cambian solos, sin mandar el formulario entero: así un clic
     en la lista no puede pisar una corrección que se esté guardando a la vez
     desde el otro dispositivo. */
  const soloInterruptores = c.inicio === undefined;
  if (soloInterruptores) {
    const cambios: Record<string, unknown> = {};
    if (typeof c.publicada === 'boolean') cambios.publicada = c.publicada;
    if (typeof c.abierta === 'boolean') cambios.abierta = c.abierta;
    if (!Object.keys(cambios).length) return NextResponse.json({ ok: false, motivo: 'sin-cambios' }, { status: 400 });
    try {
      // update() y no set(merge): sobre una convocatoria recién borrada en otra pestaña, falla en vez de resucitarla vacía.
      await ref.update({ ...cambios, actualizada: FieldValue.serverTimestamp() });
    } catch {
      return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
    }
  } else {
    const r = revisarConvocatoria(c);
    if (!r.ok) return NextResponse.json({ ok: false, motivo: 'datos', errores: r.errores }, { status: 400 });
    /* Las plazas no pueden quedar por debajo de las que ya están ocupadas: la
       web diría «Completa» con gente de más y el resumen no cuadraría. Se mira
       dentro de la transacción, con las inscritas de ese momento. */
    const fallo = await coleccion().firestore.runTransaction(async (t) => {
      const d = await t.get(ref);
      if (!d.exists) return 'no-existe';
      const ocupadas = Object.keys(d.get('inscritas') ?? {}).length;
      if (r.datos.plazas !== null && r.datos.plazas < ocupadas) return `plazas:${ocupadas}`;
      t.update(ref, { ...r.datos, horario: r.datos.horario, ocupadas, actualizada: FieldValue.serverTimestamp() });
      return null;
    });
    if (fallo === 'no-existe') return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
    if (fallo?.startsWith('plazas:')) {
      const n = fallo.split(':')[1];
      return NextResponse.json(
        { ok: false, motivo: 'datos', errores: { plazas: `Ya hay ${n} inscritas: no puedes dejar menos plazas que eso.` } },
        { status: 400 }
      );
    }
  }
  refrescarFormaciones();
  const d = await ref.get();
  return NextResponse.json({ ok: true, convocatoria: await convocatoriaConAccesos(id, d.data() ?? {}, origenDe(peticion)) });
}

export async function DELETE(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  const id = new URL(peticion.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  const ref = coleccion().doc(id);
  const d = await ref.get();
  if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  await ref.delete();
  /* Los enlaces sin usar de sus inscritas se anulan: si no, seguirían abriendo
     el curso a quien los tenga. Los accesos ya dados se quedan (se quitan desde
     Cuentas, si hace falta: puede que esa persona haya pagado el curso). */
  await anularEnlaces(codigosDe(d.get('inscritas')));
  refrescarFormaciones();
  return NextResponse.json({ ok: true });
}
