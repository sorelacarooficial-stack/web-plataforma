import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from './firebase-servidor';
import { COLECCION_CAMPANAS } from './campanas';
import { coleccion as convocatorias, refrescarFormaciones } from './convocatorias';
import { CURSO_POR_DEFECTO } from './convocatorias-tipos';

/**
 * Cambios de datos que no se pueden hacer desde el código porque viven en
 * Firestore. Los lanza el cron de la mañana (`tareasDelDia`) ANTES de mandar
 * los correos, y cada uno se hace una sola vez.
 *
 * 4 nov 2026, tras la reunión con Sorela:
 *
 *  1. Las convocatorias presenciales de diciembre, abiertas pero SIN
 *     publicar en la web (son internas: la venta es en la masterclass):
 *     Caracas (ahora 18-20 dic) y Medellín 10-12 dic. Con `create` y un id fijo: si ya
 *     existen (o Sorela las creó a mano con ese id), no se tocan.
 *  2. La masterclass es por Google Meet, no por Zoom. Los correos programados
 *     de la serie ya estaban guardados con «Zoom»: se corrigen, y el botón
 *     «Entrar a la masterclass», que iba vacío a propósito, apunta a /directo.
 *     También dejan de decir que ese día «se abre la Comunidad Divine»: la
 *     comunidad es solo para terapeutas homologadas y no se vende en la clase.
 *
 * Solo se cambian los textos que coinciden tal cual; lo que Sorela haya
 * reescrito a mano se respeta (salvo la palabra «Zoom», que se cambia siempre).
 */

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';
const MARCA = { coleccion: 'ajustes', doc: 'puesta-a-punto' };

/**
 * 11 nov 2026: las presenciales de diciembre se cancelan. Solo queda la beca:
 * Medellín, 28, 29 y 30 de enero de 2027 (BECA en lib/clase.ts).
 */
export const CONVOCATORIA_BECA = { id: 'medellin-2027-01', ciudad: 'Medellín', inicio: '2027-01-28', fin: '2027-01-30' };

export const CONVOCATORIAS_DICIEMBRE = [
  { id: 'caracas-2026-12', ciudad: 'Caracas', inicio: '2026-12-18', fin: '2026-12-20' },
  { id: 'medellin-2026-12', ciudad: 'Medellín', inicio: '2026-12-10', fin: '2026-12-12' },
];

/** Cambios de texto en los correos programados: [lo que había, lo que va]. */
const CAMBIOS_TEXTO: [string, string][] = [
  [
    '**Si nunca has usado Zoom**, descárgalo hoy en el móvil o el ordenador. Así mañana entras con un toque.',
    '**Es por Google Meet.** En el ordenador se abre en el navegador, sin instalar nada. En el móvil, descarga hoy la app Google Meet: así mañana entras con un toque.',
  ],
  ['El botón de abajo te lleva directa a Zoom.', 'El botón de abajo te lleva directa a la clase, en Google Meet.'],
  [
    ' y al final te cuento por fin qué es la Comunidad Divine.',
    ' y al final te cuento cómo seguir formándote conmigo.',
  ],
  ['empieza la masterclass en directo en la que abro la Comunidad Divine.', 'empieza la masterclass en directo «Antes de tocar».'],
  ['masterclass en directo por Zoom** y abro la Comunidad Divine.', 'masterclass en directo por Google Meet**.'],
  ['Mañana a primera hora te mando el enlace para entrar.', 'Mañana a primera hora te mando el enlace para entrar (también lo tienes ya aquí: sorelacarodivine.com/directo).'],
];

function corregir(t: string): string {
  let r = t;
  for (const [a, b] of CAMBIOS_TEXTO) r = r.split(a).join(b);
  return r.replace(/\bZoom\b/g, 'Google Meet');
}

export async function puestaAPunto(): Promise<{ id: string; enviados: number; fallidos: number; omitidos: number }[]> {
  if (!hayFirebase()) return [];
  const db = baseDeDatos();
  const marca = db.collection(MARCA.coleccion).doc(MARCA.doc);
  const hecho = (await marca.get()).data() ?? {};
  const informe: { id: string; enviados: number; fallidos: number; omitidos: number }[] = [];

  /* 1 · Convocatorias de diciembre. */
  if (!hecho.convocatoriasDiciembre && !hecho.diciembreCancelado) {
    let creadas = 0;
    for (const c of CONVOCATORIAS_DICIEMBRE) {
      const ok = await convocatorias()
        .doc(c.id)
        .create({
          curso: CURSO_POR_DEFECTO.id,
          inicio: c.inicio,
          fin: c.fin,
          horario: {},
          ciudad: c.ciudad,
          lugar: '',
          plazas: null,
          // Formación completa, 2.250 USD (en céntimos). Nunca sale en la web.
          precio: 225000,
          moneda: 'USD',
          abierta: true,
          // Internas: se usan dentro de la plataforma para apuntar y dar
          // accesos; la venta es en la masterclass, no en la web.
          publicada: false,
          inscritas: {},
          ocupadas: 0,
          creadaPor: 'puesta-a-punto',
          creada: FieldValue.serverTimestamp(),
          actualizada: FieldValue.serverTimestamp(),
        })
        .then(() => true)
        .catch(() => false);
      if (ok) creadas++;
    }
    refrescarFormaciones();
    await marca.set({ convocatoriasDiciembre: FieldValue.serverTimestamp() }, { merge: true });
    informe.push({ id: 'convocatorias-diciembre', enviados: creadas, fallidos: 0, omitidos: CONVOCATORIAS_DICIEMBRE.length - creadas });
  }

  /* 1b · Si se crearon publicadas (primera versión), se ocultan de la web. */
  if (!hecho.convocatoriasInternas) {
    let ocultas = 0;
    for (const c of CONVOCATORIAS_DICIEMBRE) {
      const ref = convocatorias().doc(c.id);
      const d = await ref.get();
      if (d.exists && d.get('publicada') === true) {
        await ref.update({ publicada: false, actualizada: FieldValue.serverTimestamp() });
        ocultas++;
      }
    }
    if (ocultas) refrescarFormaciones();
    await marca.set({ convocatoriasInternas: FieldValue.serverTimestamp() }, { merge: true });
    informe.push({ id: 'convocatorias-internas', enviados: ocultas, fallidos: 0, omitidos: 0 });
  }

  /* 1c · 6 nov: Caracas pasa del 4-6 al 18-20 de diciembre. La convocatoria ya
     estaba creada con las fechas viejas: se cambian solo si siguen siendo esas
     (si Sorela ya las cambió a mano, no se tocan). */
  if (!hecho.caracas18) {
    const ref = convocatorias().doc('caracas-2026-12');
    const d = await ref.get();
    let cambiada = 0;
    if (d.exists && d.get('inicio') === '2026-12-04' && d.get('fin') === '2026-12-06') {
      await ref.update({ inicio: '2026-12-18', fin: '2026-12-20', actualizada: FieldValue.serverTimestamp() });
      refrescarFormaciones();
      cambiada = 1;
    }
    await marca.set({ caracas18: FieldValue.serverTimestamp() }, { merge: true });
    informe.push({ id: 'caracas-18-20-dic', enviados: cambiada, fallidos: 0, omitidos: 1 - cambiada });
  }

  /* 1d · 11 nov: diciembre se cancela. Se crea la convocatoria de la beca
     (Medellín, 28-30 enero), se le pasan las inscritas de diciembre, los
     accesos y los enlaces sin usar que apuntaban a diciembre pasan a ella, y
     las de diciembre se borran. Antes de borrar se guarda una copia entera en
     ajustes/copia-convocatorias-diciembre, por si hiciera falta algo. */
  if (!hecho.diciembreCancelado) {
    const idsDic = CONVOCATORIAS_DICIEMBRE.map((c) => c.id);
    const refBeca = convocatorias().doc(CONVOCATORIA_BECA.id);
    const viejas = await Promise.all(idsDic.map((id) => convocatorias().doc(id).get()));
    const copia: Record<string, unknown> = {};
    const inscritas: Record<string, unknown> = {};
    for (const d of viejas) {
      if (!d.exists) continue;
      copia[d.id] = d.data();
      Object.assign(inscritas, (d.get('inscritas') ?? {}) as Record<string, unknown>);
    }
    await db.collection('ajustes').doc('copia-convocatorias-diciembre').set({ ...copia, guardada: FieldValue.serverTimestamp() }, { merge: true });

    const beca = await refBeca.get();
    if (!beca.exists) {
      await refBeca.set({
        curso: CURSO_POR_DEFECTO.id,
        inicio: CONVOCATORIA_BECA.inicio,
        fin: CONVOCATORIA_BECA.fin,
        horario: {},
        ciudad: CONVOCATORIA_BECA.ciudad,
        lugar: '',
        plazas: 10,
        // Beca: 1.950 USD (en céntimos). Nunca sale en la web.
        precio: 195000,
        moneda: 'USD',
        abierta: true,
        publicada: false,
        inscritas,
        ocupadas: Object.keys(inscritas).length,
        creadaPor: 'puesta-a-punto',
        creada: FieldValue.serverTimestamp(),
        actualizada: FieldValue.serverTimestamp(),
      });
    } else if (Object.keys(inscritas).length) {
      const ya = (beca.get('inscritas') ?? {}) as Record<string, unknown>;
      const juntas = { ...inscritas, ...ya };
      await refBeca.update({ inscritas: juntas, ocupadas: Object.keys(juntas).length, actualizada: FieldValue.serverTimestamp() });
    }

    // Los accesos de las cuentas que apuntaban a diciembre.
    let movidas = 0;
    const usuarios = await db.collection(COLECCIONES.usuarios).select('accesos').get();
    for (const u of usuarios.docs) {
      const accesos = u.get('accesos');
      if (!Array.isArray(accesos)) continue;
      let cambia = false;
      const nuevos = accesos.map((a: Record<string, unknown>) => {
        if (a && a.tipo === 'curso' && typeof a.convocatoria === 'string' && idsDic.includes(a.convocatoria)) {
          cambia = true;
          return { ...a, convocatoria: CONVOCATORIA_BECA.id };
        }
        return a;
      });
      if (cambia) {
        await u.ref.update({ accesos: nuevos });
        movidas++;
      }
    }

    // Los enlaces de invitación que llevaban diciembre.
    for (const id of idsDic) {
      const invs = await db.collection(COLECCIONES.invitaciones).where('convocatoria', '==', id).get();
      for (const i of invs.docs) await i.ref.update({ convocatoria: CONVOCATORIA_BECA.id });
    }

    for (const d of viejas) if (d.exists) await d.ref.delete();
    refrescarFormaciones();
    await marca.set({ diciembreCancelado: FieldValue.serverTimestamp() }, { merge: true });
    informe.push({ id: 'diciembre-cancelado', enviados: movidas, fallidos: 0, omitidos: 0 });
  }

  /* 2 · Correos programados: de Zoom a Google Meet. */
  if (!hecho.correosMeet) {
    const programadas = await db.collection(COLECCION_CAMPANAS).where('estado', 'in', ['programada', 'pausada', 'borrador']).get();
    let tocados = 0;
    for (const d of programadas.docs) {
      const v = d.data();
      const cambios: Record<string, unknown> = {};
      for (const campo of ['asunto', 'cuerpo'] as const) {
        const antes = String(v[campo] ?? '');
        const despues = corregir(antes);
        if (despues !== antes) cambios[campo] = despues;
      }
      if (v.boton && v.boton.texto) {
        const texto = corregir(String(v.boton.texto));
        const vacio = !String(v.boton.enlace ?? '').trim();
        const esEntrar = /entrar|masterclass|clase|directo/i.test(texto);
        const enlace = vacio && esEntrar ? `${WEB}/directo` : String(v.boton.enlace ?? '');
        if (texto !== v.boton.texto || enlace !== (v.boton.enlace ?? '')) cambios.boton = { texto, enlace };
      }
      if (Object.keys(cambios).length) {
        await d.ref.update(cambios);
        tocados++;
      }
    }
    await marca.set({ correosMeet: FieldValue.serverTimestamp() }, { merge: true });
    informe.push({ id: 'correos-google-meet', enviados: tocados, fallidos: 0, omitidos: 0 });
  }

  return informe;
}
