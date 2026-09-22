import nodemailer from 'nodemailer';

/**
 * Envío de correo.
 *
 * Por qué no se hace con Firebase: en el plan gratuito de Firebase (Spark) no
 * se pueden enviar correos. Ni Cloud Functions ni la extensión «Trigger Email»
 * funcionan sin pasar a plan de pago. Firebase guarda el dato, y el correo
 * sale por SMTP desde aquí.
 *
 * Con la cuenta de Gmail de Sorela hacen falta dos cosas:
 *   1. Verificación en dos pasos activada en la cuenta de Google.
 *   2. Una «contraseña de aplicación» (myaccount.google.com → Seguridad →
 *      Contraseñas de aplicaciones). No es la contraseña normal de Gmail:
 *      son dieciséis letras que Google genera para esto.
 * Gmail deja unos 500 correos al día por esa vía, que sobra de largo.
 *
 * Si algún día se pasa a un servicio de envíos (Resend, Brevo), solo cambian
 * las variables de entorno: el código se queda igual.
 */

export function hayCorreo(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USUARIO && process.env.SMTP_CLAVE);
}

function transporte() {
  const puerto = Number(process.env.SMTP_PUERTO || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    // El 465 va cifrado desde el primer byte; el 587 empieza en claro y sube a
    // cifrado con STARTTLS. Poner esto al revés da un error de conexión que no
    // explica nada.
    secure: puerto === 465,
    auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_CLAVE },
  });
}

/** Quién firma los correos que salen de la web. */
const DE = () =>
  `${process.env.CORREO_NOMBRE || 'Sorela Caro'} <${
    process.env.CORREO_DE || process.env.SMTP_USUARIO
  }>`;

export type Envio = {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
  responderA?: string;
};

export async function enviar(e: Envio): Promise<void> {
  if (!hayCorreo()) throw new Error('Faltan las variables SMTP en el entorno.');
  await transporte().sendMail({
    from: DE(),
    to: e.para,
    subject: e.asunto,
    text: e.texto,
    html: e.html,
    replyTo: e.responderA || process.env.CORREO_DE || process.env.SMTP_USUARIO,
  });
}
