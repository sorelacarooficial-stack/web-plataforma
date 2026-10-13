import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { ID, aConvocatoria, coleccion, refrescarFormaciones } from './convocatorias';
import { lineasHorario, rangoFechas } from './convocatorias-tipos';

/**
 * «Reservar plaza» desde /formaciones, automatizado.
 *
 * El formulario de cada fecha manda `origen: formacion-conv-<id>`. Además de
 * guardar el contacto como siempre, la persona entra sola como inscrita en esa
 * convocatoria, con el pago «Pendiente» y la nota «Reserva desde la web»: a
 * Sorela solo le queda confirmar el pago (y, si quiere, darle el acceso al
 * curso desde la propia convocatoria).
 *
 * Reglas: solo convocatorias publicadas y abiertas; si ya estaba inscrita con
 * ese correo, no se duplica; si está completa, no entra (y el correo se lo dice).
 */

export const PREFIJO_RESERVA = 'formacion-conv-';

export type Reserva = {
  estado: 'inscrita' | 'ya-estaba' | 'completa' | 'no-disponible';
  ciudad: string;
  fechas: string;
  horario: string[];
};

export function convocatoriaDeOrigen(origen: string): string | null {
  if (!origen.startsWith(PREFIJO_RESERVA)) return null;
  const id = origen.slice(PREFIJO_RESERVA.length);
  return ID.test(id) ? id : null;
}

export async function reservarPlaza(
  idConv: string,
  p: { nombre: string; correo: string; telefono: string; contacto: string }
): Promise<Reserva | null> {
  const ref = coleccion().doc(idConv);
  const correo = p.correo.trim().toLowerCase();
  const nuevaId = coleccion().doc().id;
  let info: Reserva | null = null;
  await ref.firestore.runTransaction(async (t) => {
    info = null;
    const d = await t.get(ref);
    if (!d.exists) return;
    const v = d.data() ?? {};
    const c = aConvocatoria(d.id, v);
    const base = { ciudad: c.ciudad, fechas: rangoFechas(c.inicio, c.fin), horario: lineasHorario(c) };
    if (!c.publicada || !c.abierta) {
      info = { estado: 'no-disponible', ...base };
      return;
    }
    if (c.inscritas.some((i) => i.correo.trim().toLowerCase() === correo)) {
      info = { estado: 'ya-estaba', ...base };
      return;
    }
    const ocupadas = c.inscritas.length;
    if (typeof c.plazas === 'number' && ocupadas >= c.plazas) {
      info = { estado: 'completa', ...base };
      return;
    }
    t.update(ref, {
      [`inscritas.${nuevaId}`]: {
        nombre: p.nombre.slice(0, 80),
        correo: p.correo.slice(0, 160),
        telefono: p.telefono.slice(0, 32),
        pagado: 0,
        estado: 'pendiente',
        nota: 'Reserva desde la web',
        contacto: p.contacto,
        creada: new Date().toISOString(),
      },
      ocupadas: ocupadas + 1,
      actualizada: FieldValue.serverTimestamp(),
    });
    info = { estado: 'inscrita', ...base };
  });
  if (info) refrescarFormaciones();
  return info;
}
