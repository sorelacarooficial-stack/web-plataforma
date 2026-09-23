import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { aplicacion, diagnostico, hayFirebase } from '@/lib/firebase-servidor';

/**
 * Si el servidor tiene Firebase bien montado o no.
 *
 * Existe por una razón concreta: cuando el acceso falla, quien lo intenta solo
 * ve «no he podido abrir la sesión», y ese mismo mensaje sale tanto si falta
 * una variable como si la clave está mal pegada. Desde fuera no hay forma de
 * distinguirlo, y se acaba probando a ciegas.
 *
 * Aquí se responde con la verdad y sin enseñar nada: solo síes y noes, y el
 * identificador del proyecto, que ya es público porque viaja en el navegador.
 * Ningún valor de ninguna variable sale de aquí.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const d = diagnostico();

  // Lo que de verdad importa: no si las variables existen, sino si con ellas
  // se puede hablar con Firebase. Se pide algo mínimo —una página de un solo
  // usuario— porque si la firma no vale, falla ahí mismo.
  let hablaConFirebase = false;
  let porQueNo: string | null = null;

  if (hayFirebase()) {
    try {
      await getAuth(aplicacion()).listUsers(1);
      hablaConFirebase = true;
    } catch (e) {
      const codigo = (e as { errorInfo?: { code?: string }; code?: string })?.errorInfo?.code;
      const texto = String((e as Error)?.message || e);
      // Se traduce a una causa, no se devuelve el error tal cual: un error de
      // Google puede llevar dentro trozos de la petición.
      porQueNo = /DECODER|PEM|private key|Invalid PEM/i.test(texto)
        ? 'la clave privada está mal pegada'
        : /invalid_grant|Invalid JWT|signature/i.test(texto)
          ? 'la clave no vale para esta cuenta de servicio'
          : /not found|404/i.test(texto)
            ? 'el proyecto no existe o Authentication no está activado'
            : codigo || 'no he podido hablar con Firebase';
    }
  }

  const listo = hablaConFirebase && d.hayAdministradoras;

  return NextResponse.json(
    {
      listo,
      proyecto: d.proyecto,
      comprobaciones: {
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
}
