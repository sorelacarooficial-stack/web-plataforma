import 'server-only';
import { baseDeDatos, COLECCIONES } from './firebase-servidor';
import { CURSO_DIVINE, revisarAccesos, type Acceso } from './accesos';
import { clave } from './aula';
import { leerLectura } from './material';
import { calcularRecorrido, esTecnicaCompleta, llevaRecorrido, type Recorrido } from './avance';

/**
 * El recorrido de una alumna, leído de Firestore. `null` si no le toca (las
 * alumnas de antes, las homologadas y Sorela lo ven todo abierto).
 *
 * Es lo que usa el servidor para cerrar de verdad: /api/material no firma las
 * páginas de un módulo cerrado y /api/lecciones/video no da el enlace de un
 * vídeo que aún no toca. Lo que pinta el navegador es solo el dibujo.
 */
export async function recorridoDe(uid: string, accesosYa?: Acceso[]): Promise<Recorrido | null> {
  const db = baseDeDatos();
  const ref = db.collection(COLECCIONES.usuarios).doc(uid);
  const ficha = await ref.get();
  const accesos = accesosYa ?? revisarAccesos(ficha.get('accesos'));
  if (!llevaRecorrido(accesos)) return null;

  const [progreso, lecciones] = await Promise.all([
    ref.collection('progreso').get(),
    db.collection(COLECCIONES.lecciones).orderBy('orden', 'asc').limit(500).get(),
  ]);
  const hechas = new Set(progreso.docs.filter((d) => d.get('completada') === true).map((d) => d.id));
  const clases = lecciones.docs
    .filter((d) => {
      const para = d.get('para') as Acceso | undefined;
      return d.get('publicada') !== false && para?.tipo === 'curso' && clave(para.nombre) === clave(CURSO_DIVINE) && !esTecnicaCompleta(d.get('modulo'));
    })
    .map((d) => ({ id: d.id, modulo: d.get('modulo') as string | undefined, completada: hechas.has(d.id) }));

  const c = ficha.get('citaSorela') as { cuando?: unknown } | undefined;
  const curso = accesos.find((a) => a.tipo === 'curso' && clave(a.nombre) === clave(CURSO_DIVINE));
  return calcularRecorrido({
    lectura: leerLectura(ficha.get('lectura')),
    clases,
    cita: typeof c?.cuando === 'string' ? { cuando: c.cuando } : null,
    conVideos: curso?.completo !== false,
  });
}
