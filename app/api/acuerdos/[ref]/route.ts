import { NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { aplicacion, baseDeDatos } from '@/lib/firebase-servidor';
import { exigirAdmin } from '@/lib/permisos';
import { COLECCION_CORREOS, quitarDelHistorial } from '@/lib/correos';

/**
 * Borrar un acuerdo firmado. Solo Sorela.
 *
 *   DELETE /api/acuerdos/DIV-K7P2-4M9X
 *
 * Existe para los duplicados y las firmas de prueba: quien firma dos veces, o
 * las pruebas del formulario, se quedaban en la lista para siempre y
 * descuadraban las cifras.
 *
 * QUÉ SE BORRA, porque es todo lo que deja una firma:
 *   · El documento del acuerdo. Ahí está TODO: los datos, la firma dibujada,
 *     la copia congelada de las cláusulas, la prueba (IP y navegador), el
 *     estado, el resultado del correo y las descargas del dossier (que son
 *     contadores del propio documento). El PDF no se guarda: se genera desde
 *     este documento cada vez que se abre, así que sin él ya no se puede sacar.
 *   · La carpeta `privado/acuerdos/<referencia>/` de Storage. Hoy la firma no
 *     guarda nada ahí, pero es donde iría una copia del PDF si un día se
 *     guardara; se limpia igual para que borrar un acuerdo no deje restos.
 *   · Sus líneas en el historial de correos («Lo que ha salido» y la ficha
 *     del contacto).
 *
 * El enlace del dossier deja de funcionar en el acto: /api/dossier ya no
 * encuentra la referencia. Lo que NO se puede borrar desde aquí es el correo
 * que ya le llegó a la alumna, con su PDF adjunto: eso está en su buzón.
 *
 * El orden importa: primero Storage y el historial, y el documento al final.
 * Si algo falla por el camino, el acuerdo sigue en la lista y se puede volver
 * a intentar; al revés quedarían restos sin nada que los señale.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMA = /^DIV-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const almacen = () =>
  getStorage(aplicacion()).bucket(process.env.FIREBASE_ALMACEN || `${process.env.FIREBASE_PROYECTO_ID}.firebasestorage.app`);

export async function DELETE(_peticion: Request, { params }: { params: Promise<{ ref: string }> }) {
  const g = await exigirAdmin();
  if (g.error) return g.error;

  const ref = (await params).ref.toUpperCase();
  if (!FORMA.test(ref)) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });

  const db = baseDeDatos();
  const doc = db.collection('acuerdos').doc(ref);
  const d = await doc.get();
  if (!d.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
  const correo = String(d.get('correo') ?? '').toLowerCase();

  // 1. Los archivos, si los hay.
  let archivos = 0;
  try {
    const carpeta = `privado/acuerdos/${ref}/`;
    const [lista] = await almacen().getFiles({ prefix: carpeta });
    archivos = lista.length;
    if (archivos) await almacen().deleteFiles({ prefix: carpeta });
  } catch (e) {
    console.error('[acuerdos] no se han podido borrar sus archivos', ref, e);
    return NextResponse.json({ ok: false, motivo: 'storage' }, { status: 502 });
  }

  /* 2. Sus correos en el historial. Los nuevos llevan la referencia; los de
     antes, solo el destinatario y el tipo. Esos se borran únicamente si no
     queda otro acuerdo con el mismo correo: con dos firmas de la misma
     persona, no se sabe de cuál es cada uno y se dejan (se irán a los 30 días). */
  let correos = 0;
  try {
    if (correo) {
      const [lineas, otros] = await Promise.all([
        db.collection(COLECCION_CORREOS).where('para', '==', correo).get(),
        db.collection('acuerdos').where('correo', '==', correo).get(),
      ]);
      const compartido = otros.docs.some((x) => x.id !== ref);
      const suyas = lineas.docs.filter((x) => {
        const v = x.data();
        if (v.tipo !== 'acuerdo') return false;
        if (v.acuerdo) return v.acuerdo === ref;
        return String(v.asunto ?? '').includes(ref) || !compartido;
      });
      correos = await quitarDelHistorial(suyas);
    }
  } catch (e) {
    console.error('[acuerdos] no se ha podido limpiar su historial de correos', ref, e);
    return NextResponse.json({ ok: false, motivo: 'historial' }, { status: 502 });
  }

  // 3. El acuerdo. Con lo que cuelgue de él, por si algún día lleva subcolecciones.
  await db.recursiveDelete(doc);
  console.info(`[acuerdos] ${ref} borrado por ${g.sesion.uid} (${archivos} archivos, ${correos} correos del historial)`);

  return NextResponse.json({ ok: true, referencia: ref, archivos, correos });
}
