import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';

/**
 * El dossier del precurso, para quien ha firmado el acuerdo.
 *
 *   GET /api/dossier?ref=DIV-K7P2-4M9X
 *
 * POR QUÉ NO ESTÁ EN `public/`. Porque entonces sería un archivo con una
 * dirección fija que cualquiera puede abrir, enviar por WhatsApp y volver a
 * enviar. Es el documento que la alumna se compromete por escrito a no
 * divulgar dos minutos antes de recibirlo: dejarlo en una carpeta pública
 * convertiría el acuerdo en un trámite sin objeto.
 *
 * POR QUÉ NO VA ADJUNTO AL CORREO. Un adjunto, una vez enviado, ya no se puede
 * retirar ni saber quién lo tiene. Con un enlace ligado a la referencia de la
 * firma queda registrado cuándo se descargó y cuántas veces, y si un día hay
 * que cortarlo, se corta.
 *
 * LO QUE ESTO NO ES: un cerrojo criptográfico. Quien tenga la referencia tiene
 * el documento, y quien lo descarga puede reenviar el archivo. Lo que da es
 * trazabilidad —quién, cuándo, desde dónde— y eso es exactamente lo que hace
 * falta para que el acuerdo firmado signifique algo.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLECCION = 'acuerdos';

/** El archivo vive fuera de `public/`. Ver `outputFileTracingIncludes`. */
const RUTA = path.join(process.cwd(), 'docs', 'dossier.pdf');

/** La forma de una referencia: DIV- y dos grupos de cuatro. */
const FORMA = /^DIV-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export async function GET(peticion: Request) {
  const ref = (new URL(peticion.url).searchParams.get('ref') ?? '').trim().toUpperCase();

  /* Se comprueba la forma ANTES de ir a la base de datos: así una ruta que
     alguien encuentre y aporree no se convierte en una lectura de Firestore
     por intento. */
  if (!FORMA.test(ref)) {
    return NextResponse.json({ ok: false, motivo: 'referencia' }, { status: 400 });
  }

  if (!hayFirebase()) {
    return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });
  }

  const base = baseDeDatos();
  const doc = await base.collection(COLECCION).doc(ref).get();

  if (!doc.exists) {
    return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  }

  if (doc.get('estado') === 'anulado') {
    return NextResponse.json({ ok: false, motivo: 'anulado' }, { status: 403 });
  }

  let pdf: Buffer;
  try {
    pdf = await readFile(RUTA);
  } catch (error) {
    console.error('[dossier] no se encuentra el archivo', error);
    return NextResponse.json({ ok: false, motivo: 'sin-archivo' }, { status: 500 });
  }

  /* La descarga se apunta, pero no se espera a que termine de apuntarse: si
     Firestore va lento, quien ha firmado no tiene por qué esperar su dossier
     por una línea de registro. */
  void doc.ref
    .update({
      descargas: FieldValue.increment(1),
      ultimaDescarga: new Date().toISOString(),
    })
    .catch((error) => console.error('[dossier] no se ha podido apuntar la descarga', error));

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Dossier-Tecnica-Divine.pdf"',
      /* Nada de caché intermedia: es un documento personal detrás de una
         referencia, no un recurso estático. */
      'Cache-Control': 'private, no-store',
    },
  });
}
