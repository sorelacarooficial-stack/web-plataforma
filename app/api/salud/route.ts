import { NextResponse } from 'next/server';

/*
 * Aquí NO se importa firebase-admin arriba, a propósito, y es la única ruta
 * del proyecto donde eso se hace así.
 *
 * Un import de los de arriba se resuelve al cargar el módulo, antes de que
 * corra una sola línea del handler. Si la librería no cargara en el servidor,
 * el fallo ocurriría fuera de cualquier try y esta página devolvería el error
 * genérico del servidor —justo lo que está aquí para evitar—. Cargándola
 * dentro del try, ese fallo también se puede contar.
 */

/**
 * Si el servidor tiene Firebase bien montado o no.
 *
 * Existe por una razón concreta: cuando el acceso falla, quien lo intenta solo
 * ve «no he podido abrir la sesión», y ese mismo mensaje sale tanto si falta
 * una variable como si la clave está mal pegada. Desde fuera no hay forma de
 * distinguirlo, y se acaba probando a ciegas.
 *
 * Dos reglas que esta ruta no puede romper:
 *
 *   1. NUNCA falla. Una página de diagnóstico que devuelve error 500 no
 *      diagnostica nada: deja a quien la abre con menos información que
 *      antes. Todo va dentro de un try, y lo que salga mal se cuenta.
 *   2. NUNCA enseña un secreto. Solo síes y noes, y el identificador del
 *      proyecto, que ya es público porque viaja en el navegador.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ocho segundos. Si Firebase no contesta en ese rato, eso ya es la respuesta. */
const ESPERA_MS = 8000;

/**
 * Quita del texto de un error cualquier cosa que se parezca a un secreto.
 *
 * Los errores de Google a veces llevan dentro trozos de lo que se les mandó.
 * Antes de enseñar un mensaje por una página pública hay que limpiarlo, no
 * confiar en que no traiga nada.
 */
function limpiar(texto: string): string {
  return texto
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, '«clave»')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '«correo»')
    .replace(/[A-Za-z0-9_-]{30,}/g, '«texto largo»')
    .slice(0, 200);
}

/**
 * Si este Node puede cargar la librería de Firebase.
 *
 * firebase-admin 14 arrastra `jose` en su versión 6, que es un módulo moderno,
 * y lo carga a la manera antigua. Esa mezcla solo la aguanta Node a partir de
 * 20.19 o de 22.12: por debajo, la librería no carga y todo lo que toque el
 * acceso deja de funcionar, aunque las claves estén perfectas. Cuesta días
 * dar con ello si no se mira, así que se mira aquí.
 */
function nodeSirve(version: string): boolean {
  const [may, men] = version.replace(/^v/, '').split('.').map(Number);
  if (!Number.isFinite(may) || !Number.isFinite(men)) return false;
  if (may >= 23) return true;
  if (may === 22) return men >= 12;
  if (may === 20) return men >= 19;
  return false;
}

export async function GET() {
  try {
    const { aplicacion, diagnostico, hayFirebase } = await import('@/lib/firebase-servidor');
    const { getAuth } = await import('firebase-admin/auth');

    const d = diagnostico();

    let hablaConFirebase = false;
    let porQueNo: string | null = null;

    if (!hayFirebase()) {
      porQueNo = 'faltan variables de entorno en el servidor';
    } else if (!d.claveConForma) {
      // Si ya se ve que la clave está rota, no hace falta salir a internet
      // para confirmarlo: se ahorra la espera y se responde al momento.
      porQueNo = 'la clave privada está mal pegada';
    } else {
      try {
        // Lo que de verdad importa: no si las variables existen, sino si con
        // ellas se puede hablar con Firebase. Con tope de tiempo, porque una
        // llamada que se cuelga tumba la función entera y entonces esta
        // página devolvería un error en vez de un diagnóstico.
        await Promise.race([
          getAuth(aplicacion()).listUsers(1),
          new Promise((_, no) => setTimeout(() => no(new Error('TIEMPO_AGOTADO')), ESPERA_MS)),
        ]);
        hablaConFirebase = true;
      } catch (e) {
        const texto = String((e as Error)?.message || e);
        porQueNo = /TIEMPO_AGOTADO/.test(texto)
          ? 'Firebase no contesta desde este servidor'
          : /DECODER|PEM|private key|Invalid PEM/i.test(texto)
            ? 'la clave privada está mal pegada'
            : /invalid_grant|Invalid JWT|signature/i.test(texto)
              ? 'la clave no vale para esta cuenta de servicio'
              : /not found|404/i.test(texto)
                ? 'el proyecto no existe o Authentication no está activado'
                : limpiar(texto);
      }
    }

    return NextResponse.json(
      {
        listo: hablaConFirebase && d.hayAdministradoras,
        proyecto: d.proyecto,
        node: process.version,
        comprobaciones: {
          'version de Node suficiente': nodeSirve(process.version),
          'variable del proyecto': d.tieneProyecto,
          'correo de la cuenta de servicio': d.tieneCorreoDeServicio,
          'clave privada presente': d.tieneClave,
          'clave privada con forma de clave': d.claveConForma,
          'lista de administradoras': d.hayAdministradoras,
          'habla con Firebase': hablaConFirebase,
        },
        ...(porQueNo ? { porQueNo } : {}),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    // La red de seguridad. Si algo se rompe aquí arriba —un módulo que no
    // carga, una variable con forma imposible—, se dice qué se rompió en vez
    // de devolver la pantalla de error del servidor, que no explica nada.
    return NextResponse.json(
      {
        listo: false,
        node: process.version,
        porQueNo: nodeSirve(process.version)
          ? 'la comprobación se rompió antes de terminar'
          : `este servidor corre Node ${process.version} y la librería de Firebase necesita 20.19 o 22.12 en adelante`,
        seRompioCon: {
          tipo: (e as Error)?.name ?? 'desconocido',
          mensaje: limpiar(String((e as Error)?.message || e)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
