import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from './firebase-servidor';
import { COLECCION_RESERVAS } from './reserva';
import { inscribirReservaPagada } from './reserva-convocatoria';
import { CONVOCATORIA_BECA } from './puesta-a-punto';

/**
 * Marcar una reserva como pagada. Lo usan los dos caminos que lo saben:
 *
 *   · /api/reserva/confirmar: el navegador vuelve de Stripe a «gracias».
 *     Sin clave de Stripe solo sabe que llegó a esa página (`verificado`
 *     false): queda «Pago por comprobar».
 *   · /api/stripe/webhook: Stripe avisa él mismo, con firma. Eso es la
 *     prueba de verdad (`verificado` true), y llega aunque la persona cierre
 *     la pestaña antes de volver.
 *
 * Si la reserva ya estaba comprobada no se toca. Si estaba «por comprobar» y
 * llega la prueba de Stripe, sube a comprobada.
 */

export const SESION_STRIPE = /^cs_[A-Za-z0-9_]{10,200}$/;

export type ResultadoPago = 'no-existe' | 'ya-estaba' | 'confirmada';

export async function aplicarPago(
  id: string,
  p: { verificado: boolean; sesion?: string; por: 'stripe' | 'stripe-webhook' | 'pagina-gracias' }
): Promise<ResultadoPago> {
  const db = baseDeDatos();
  const ref = db.collection(COLECCION_RESERVAS).doc(id);
  const d = await ref.get();
  if (!d.exists) return 'no-existe';
  const v = d.data()!;
  if (v.pagoVerificado === true) return 'ya-estaba';
  if (v.pagoConfirmado === true && !p.verificado) return 'ya-estaba';

  const sesion = p.sesion && SESION_STRIPE.test(p.sesion) ? p.sesion : null;
  await ref.update({
    pagoConfirmado: true,
    pagoVerificado: p.verificado,
    confirmadoPor: p.por,
    pagoConfirmadoEn: FieldValue.serverTimestamp(),
    ...(sesion ? { pago: sesion } : {}),
  });

  if (typeof v.contacto === 'string' && v.contacto) {
    await db
      .collection(COLECCIONES.contactos)
      .doc(v.contacto)
      .set(
        {
          reserva: { id, pagoConfirmado: true, pagoVerificado: p.verificado, ...(sesion ? { pago: sesion } : {}), confirmadaEn: FieldValue.serverTimestamp() },
          actualizado: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  // Presencial: entra en las fechas de su ciudad, para darle el acceso desde «Dar acceso».
  // Diciembre se canceló (11 nov): la única presencial es la beca de enero.
  // Si ya estaba inscrita (vino antes por «gracias»), no se duplica.
  const conv = v.formacion === 'beca' ? CONVOCATORIA_BECA.id : null;
  if (conv) {
    try {
      await inscribirReservaPagada(conv, {
        nombre: String(v.nombre ?? ''),
        correo: String(v.correo ?? ''),
        telefono: String(v.whatsapp ?? ''),
        contacto: String(v.contacto ?? ''),
        estado: p.verificado ? 'senal' : 'pendiente',
        pagado: p.verificado ? Number(v.reservaUSD) || 0 : 0,
        nota: p.verificado
          ? `Reserva pagada por Stripe (comprobado): ${v.titulo}${sesion ? ` · ${sesion}` : ''}.`
          : `Volvió de Stripe a la página de gracias: ${v.titulo}. Mira el pago en Stripe antes de dar el acceso.`,
      });
    } catch (e) {
      console.error('[reserva-pago] convocatoria', conv, e);
    }
  }
  return 'confirmada';
}
