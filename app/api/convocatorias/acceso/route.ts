import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/permisos';
import { ID, coleccion } from '@/lib/convocatorias';
import { convocatoriaConAccesos, crearAccesoCurso } from '@/lib/convocatorias-acceso';

/**
 * «Crear acceso al curso» de una inscrita.
 *
 *   POST { convocatoria, inscrita, darACuenta? }
 *
 * Contesta con lo que ha pasado (`resultado`) y la convocatoria como queda:
 *
 *   · `hay-cuenta` → ya existe una cuenta con su correo y NO se ha tocado. La
 *     pantalla le enseña a Sorela de quién es y le pregunta; si dice que sí,
 *     vuelve a llamar con `darACuenta: true`.
 *   · `cuenta`     → se le ha añadido el curso a esa cuenta (o ya lo tenía).
 *   · `enlace`     → un enlace de un solo uso, solo del curso, para copiarlo o
 *     mandarlo por WhatsApp. Si ya tenía uno sin usar, es ese mismo.
 *
 * NUNCA da la membresía de la Comunidad Divine: lib/convocatorias-acceso.ts
 * solo sabe añadir un acceso de tipo «curso» y crear enlaces con `que: ['curso']`.
 *
 * Solo Sorela.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion: Request) {
  const g = await exigirAdmin();
  if (g.error) return g.error;
  let c: Record<string, unknown>;
  try {
    c = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }
  const convocatoria = typeof c?.convocatoria === 'string' ? c.convocatoria : '';
  const inscrita = typeof c?.inscrita === 'string' ? c.inscrita : '';
  if (!ID.test(convocatoria) || !ID.test(inscrita)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const origen = new URL(peticion.url).origin;
  let resultado;
  try {
    resultado = await crearAccesoCurso({ convocatoria, inscrita, darACuenta: c.darACuenta === true, origen, creadoPor: g.sesion.uid });
  } catch (e) {
    console.error('[convocatorias] no se ha podido crear el acceso al curso', e);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
  if (!resultado.ok) {
    return NextResponse.json({ ok: false, motivo: resultado.motivo }, { status: resultado.motivo === 'no-existe' ? 404 : 409 });
  }

  const d = await coleccion().doc(convocatoria).get();
  return NextResponse.json({
    ok: true,
    resultado,
    convocatoria: d.exists ? await convocatoriaConAccesos(convocatoria, d.data() ?? {}, origen) : null,
  });
}
