import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from '@/lib/firebase-servidor';
import { exigirSesion, type Guarda } from '@/lib/permisos';
import { VERSION_RECORRIDO, esPasoRecorrido, leerRecorrido, recorridoPendiente } from '@/lib/recorrido-tipos';

/**
 * El recorrido de bienvenida (components/plataforma/Recorrido.tsx), guardado en
 * su ficha: `usuarios/{uid}.recorrido` (la forma, en lib/recorrido-tipos.ts).
 *
 *   GET                       → { ok, estado, paso, pasos, hecho, pendiente }
 *   POST { accion, paso? }
 *        'paso'   { paso }    → ha llegado a ese paso (y si no lo había empezado
 *                               nunca, queda «en curso»: si cierra a medias, la
 *                               próxima vez sigue por ahí)
 *        'hecho'              → lo ha terminado → { ok, primeraVez }. La primera
 *                               vez trae la insignia «Exploradora Divine» y sus
 *                               puntos, que NO se apuntan aquí: se derivan de
 *                               `terminado` en lib/logros.ts, como todo lo demás.
 *        'saltar' { paso? }   → «Saltar»: ya no se abre solo. Si ya lo había
 *                               terminado (lo estaba repitiendo), no cambia nada.
 *        'repetir'            → lo abre a mano desde «Ver el recorrido». Solo se
 *                               apunta la fecha: repetirlo no da nada otra vez.
 *
 * El uid sale SIEMPRE de la sesión: cada una toca solo el suyo. Sorela no tiene
 * recorrido (403): no compite y no es su plataforma la que se estrena.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVADO = { 'Cache-Control': 'private, no-store' };
const ACCIONES = ['paso', 'hecho', 'saltar', 'repetir'] as const;
type Accion = (typeof ACCIONES)[number];

const fallo = (motivo: string, status: number) => NextResponse.json({ ok: false, motivo }, { status });

/** Con sesión y sin ser Sorela. */
async function puerta(): Promise<Guarda> {
  const g = await exigirSesion();
  if (g.error) return g;
  if (g.sesion.rol === 'sorela') return { error: fallo('creadora', 403) };
  return g;
}

export async function GET() {
  const g = await puerta();
  if (g.error) return g.error;
  try {
    const ficha = await baseDeDatos().collection(COLECCIONES.usuarios).doc(g.sesion.uid).get();
    const r = leerRecorrido(ficha.get('recorrido'));
    return NextResponse.json({ ok: true, ...r, pendiente: recorridoPendiente(r) }, { headers: PRIVADO });
  } catch (e) {
    console.error('[recorrido] leer', e);
    return fallo('error', 500);
  }
}

export async function POST(peticion: Request) {
  const g = await puerta();
  if (g.error) return g.error;

  const crudo = await peticion.json().catch(() => null);
  const c = crudo && typeof crudo === 'object' && !Array.isArray(crudo) ? (crudo as Record<string, unknown>) : {};
  const accion = c.accion as Accion;
  if (!ACCIONES.includes(accion)) return fallo('datos', 400);
  // El paso, si viene, tiene que ser uno de los que existen; en 'paso' es obligatorio.
  const paso = c.paso ?? null;
  if (paso !== null && !esPasoRecorrido(paso)) return fallo('datos', 400);
  if (accion === 'paso' && paso === null) return fallo('datos', 400);

  const db = baseDeDatos();
  const ref = db.collection(COLECCIONES.usuarios).doc(g.sesion.uid);
  const ahora = FieldValue.serverTimestamp();

  try {
    /* En transacción: con dos pestañas abiertas, solo una es «la primera vez»
       que lo termina (y se queda con la fecha). */
    const r = await db.runTransaction(async (t) => {
      const ficha = await t.get(ref);
      // Toda cuenta con sesión tiene ficha (lib/sesion-servidor, asegurarRol). Sin ella no se inventa una.
      if (!ficha.exists) return null;
      const guardado = (ficha.get('recorrido') ?? {}) as Record<string, unknown>;
      const antes = leerRecorrido(guardado);
      // La versión que vio y, si es la primera vez que lo abre, cuándo empezó.
      const base = { version: VERSION_RECORRIDO, ...(guardado.empezado ? {} : { empezado: ahora }) };
      const primeraVez = accion === 'hecho' && !antes.hecho;

      let cambios: Record<string, unknown> = {};
      if (accion === 'paso') {
        cambios = { ...base, paso, pasos: FieldValue.arrayUnion(paso), ...(antes.estado === null ? { estado: 'en-curso' } : {}) };
      } else if (accion === 'hecho') {
        cambios = {
          ...base,
          estado: 'hecho',
          paso: 'final',
          pasos: FieldValue.arrayUnion('final'),
          veces: FieldValue.increment(1),
          // Solo la primera vez: es la fecha de la insignia, y no se mueve.
          ...(primeraVez ? { terminado: ahora } : {}),
        };
      } else if (accion === 'saltar') {
        if (!antes.hecho) cambios = { ...base, estado: 'saltado', saltado: ahora, ...(paso ? { paso } : {}) };
      } else {
        cambios = { version: VERSION_RECORRIDO, repetido: ahora };
      }
      // Con merge, el mapa se mezcla campo a campo: lo que no se nombra se queda.
      if (Object.keys(cambios).length) t.set(ref, { recorrido: cambios }, { merge: true });
      return { primeraVez, hecho: antes.hecho || accion === 'hecho' };
    });
    if (!r) return fallo('sin-ficha', 404);
    return NextResponse.json({ ok: true, ...r }, { headers: PRIVADO });
  } catch (e) {
    console.error('[recorrido] guardar', e);
    return fallo('error', 500);
  }
}
