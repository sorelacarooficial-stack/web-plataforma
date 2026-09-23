import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { tipoDeOrigen } from '@/lib/origenes';

/**
 * Los contactos que entran por la web, para verlos desde la plataforma.
 *
 *   GET   → la lista, la más reciente primero
 *   PATCH → cambiar el estado de uno (nuevo, contactado, cerrado…)
 *
 * Solo para Sorela. La comprobación se hace aquí con el rol de la cookie, que
 * va firmado: no se acepta un «soy admin» enviado desde el navegador.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Por dónde puede pasar un contacto. El orden es el del embudo. */
export const ESTADOS = ['Nuevo', 'Contactado', 'En conversación', 'Cerrado', 'Descartado'] as const;
export type EstadoContacto = (typeof ESTADOS)[number];

async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (sesion.rol !== 'sorela') {
    return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  }
  return { sesion };
}

export async function GET() {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  const lista = await baseDeDatos()
    .collection(COLECCIONES.contactos)
    // Por fecha de entrada, el último arriba: es el que hay que llamar.
    .orderBy('creado', 'desc')
    .limit(500)
    .get();

  const contactos = lista.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      nombre: v.nombre ?? '',
      correo: v.correo ?? '',
      whatsapp: v.whatsapp ?? '',
      perfil: v.perfil ?? '',
      ciudad: v.ciudad ?? '',
      nota: v.nota ?? '',
      origen: v.origen ?? 'web',
      estado: (v.estado as EstadoContacto) ?? 'Nuevo',
      // De dónde entró decide qué busca: una sesión, formarse o la comunidad.
      // Se resuelve aquí y no en el navegador para que la lista y el correo
      // digan lo mismo. Ver lib/origenes.ts.
      tipo: tipoDeOrigen(v.origen),
      // Lo que Sorela ha ido apuntando de esa persona, lo más nuevo primero.
      seguimiento: Array.isArray(v.seguimiento)
        ? v.seguimiento.map((n: { cuando?: string; texto?: string }) => ({
            cuando: n?.cuando ?? '',
            texto: n?.texto ?? '',
          }))
        : [],
      // Un Timestamp de Firestore no sobrevive a JSON.stringify de forma
      // legible, así que se manda como texto ISO y se formatea en pantalla.
      creado: v.creado?.toDate?.().toISOString() ?? null,
      veces: v.veces ?? 1,
    };
  });

  const nuevos = contactos.filter((c) => c.estado === 'Nuevo').length;

  return NextResponse.json({ ok: true, contactos, nuevos, total: contactos.length });
}

export async function PATCH(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  let cuerpo: { id?: string; estado?: string; nota?: string };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const { id, estado, nota } = cuerpo;
  if (!id) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const ref = baseDeDatos().collection(COLECCIONES.contactos).doc(id);

  /*
   * Apuntar algo de una persona.
   *
   * Se añade al final del array con arrayUnion y NO se reescribe el array
   * entero: si Sorela tiene la ficha abierta en el móvil y en el ordenador,
   * mandar la lista completa desde cada uno haría que la última en guardar
   * borrase lo que hubiera escrito la otra.
   *
   * La hora la pone el servidor, pero dentro del elemento no se puede usar
   * serverTimestamp —Firestore no lo admite dentro de un array—, así que se
   * escribe la del servidor en texto ISO.
   */
  if (typeof nota === 'string' && nota.trim()) {
    await ref.set(
      {
        seguimiento: FieldValue.arrayUnion({
          cuando: new Date().toISOString(),
          texto: nota.trim().slice(0, 1000),
        }),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true, id });
  }

  if (!estado || !(ESTADOS as readonly string[]).includes(estado)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  await ref.set({ estado, estadoCambiado: FieldValue.serverTimestamp() }, { merge: true });

  return NextResponse.json({ ok: true, id, estado });
}
