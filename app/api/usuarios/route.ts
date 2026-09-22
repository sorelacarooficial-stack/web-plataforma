import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { aplicacion, baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { esRol, correoEsAdmin, type Rol } from '@/lib/roles';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * Gestión de personas y roles. Solo para Sorela.
 *
 *   GET   → la lista de quién tiene cuenta y con qué rol
 *   PATCH → cambiar el rol de alguien
 *
 * La comprobación de permiso se hace aquí con el rol de la cookie, que va
 * firmado. No se acepta un «soy admin» enviado desde el navegador, ni un
 * parámetro en la dirección: eso lo escribe cualquiera.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (sesion.rol !== 'sorela') {
    // 403 y no 404: la persona está identificada, simplemente no le toca.
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
    .collection(COLECCIONES.usuarios)
    .orderBy('ultimoAcceso', 'desc')
    .limit(200)
    .get();

  const usuarios = lista.docs.map((d) => {
    const v = d.data();
    return {
      uid: d.id,
      correo: v.correo ?? null,
      rol: v.rol ?? null,
      // La fecha se manda como texto ISO: un Timestamp de Firestore no
      // sobrevive a JSON.stringify de forma legible.
      ultimoAcceso: v.ultimoAcceso?.toDate?.().toISOString() ?? null,
    };
  });

  return NextResponse.json({ ok: true, usuarios });
}

export async function PATCH(peticion: Request) {
  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
  }
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  let cuerpo: { uid?: string; rol?: string };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const { uid, rol } = cuerpo;
  if (!uid || !esRol(rol)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const auth = getAuth(aplicacion());
  const usuario = await auth.getUser(uid).catch(() => null);
  if (!usuario) {
    return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  }

  // Sorela no puede quitarse a sí misma el rol de admin sin querer, ni
  // quitárselo a otra cuenta de la lista de administradoras: se quedaría la
  // plataforma sin nadie que pueda repartir roles.
  if (correoEsAdmin(usuario.email) && rol !== 'sorela') {
    return NextResponse.json({ ok: false, motivo: 'admin-protegida' }, { status: 409 });
  }

  await auth.setCustomUserClaims(uid, { role: rol as Rol });

  // Invalida sus tokens para que el rol nuevo le llegue en el momento y no
  // dentro de una hora, cuando caduque el que tiene.
  await auth.revokeRefreshTokens(uid);

  await baseDeDatos()
    .collection(COLECCIONES.usuarios)
    .doc(uid)
    .set({ rol, correo: usuario.email ?? null, rolCambiado: FieldValue.serverTimestamp() }, { merge: true });

  return NextResponse.json({ ok: true, uid, rol });
}
