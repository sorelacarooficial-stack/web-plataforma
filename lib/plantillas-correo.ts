import { APERTURA_POR_PAISES, DIA_APERTURA, HORA_ESPANA } from './apertura';
import type { Contacto } from './captacion';

/**
 * Los dos correos automáticos. Están aquí y no dentro de la ruta para que se
 * puedan leer y corregir sin tocar código: son textos de Sorela, no lógica.
 *
 * Van en texto plano y en HTML a la vez. El texto plano no es un descuido de
 * los años noventa: hay clientes de correo que solo muestran esa versión, y un
 * correo que llega vacío parece una estafa.
 */

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';

const FECHA_CORTA = DIA_APERTURA.replace(/^\w+ /, '');

const nombreCorto = (n: string) => (n || '').trim().split(/\s+/)[0] || '';

/**
 * El que recibe quien deja su contacto en la web.
 *
 * OJO: en producción esto NO es lo que llega. Quien manda de verdad es el Apps
 * Script de la cuenta de Google de Sorela (`apps-script/Codigo.gs`), que además
 * adjunta el PDF y escribe distinto según de dónde venga cada persona. Esto es
 * la salida de emergencia por SMTP, para el día que no haya Apps Script.
 * Aun así dice lo mismo que aquél, porque un correo de reserva que contradiga
 * al de siempre es peor que no tener reserva.
 *
 * Aquí enlazaba a `/tecnica-divine.pdf`, que NO EXISTE: ese archivo no está en
 * `public/` ni lo ha estado nunca. El botón principal del correo llevaba a una
 * página de error. Ahora lleva a la comunidad, que es la página que de verdad
 * hay y la que interesa ahora mismo.
 */
export function correoBienvenida(c: Pick<Contacto, 'nombre' | 'correo'>) {
  const n = nombreCorto(c.nombre);
  const comunidad = `${WEB}/comunidad`;
  const cuando = `El ${DIA_APERTURA} a las ${HORA_ESPANA}, hora de España`;

  const texto = [
    `Hola ${n},`,
    '',
    'Gracias por dejarme tus datos. Te escribo yo en cuanto pueda.',
    '',
    `${cuando}, abro la Membresía Divine: una clase en vivo al mes con lo nuevo del método, tus casos mirados uno a uno y un canal privado donde preguntarme.`,
    `Las horas en cada país: ${APERTURA_POR_PAISES}.`,
    '',
    'Aquí puedes verlo y entrar en la lista de espera:',
    comunidad,
    '',
    'Si te queda alguna duda, respóndeme a este correo. Lo leo yo.',
    '',
    'Sorela Caro',
    'Creadora de la Técnica Divine',
    WEB,
    '',
    'Te escribo porque dejaste tus datos en mi web. Si no quieres recibir más',
    'correos míos, respóndeme a este mismo y te doy de baja.',
  ].join('\n');

  const html = envoltorio(
    `Hola ${escapar(n)},`,
    `
    <p style="margin:0 0 18px">Gracias por dejarme tus datos. Te escribo yo en cuanto pueda.</p>
    <p style="margin:0 0 18px">${escapar(cuando)}, abro la <strong>Membresía Divine</strong>: una clase en vivo al mes con lo nuevo del método, tus casos mirados uno a uno y un canal privado donde preguntarme.</p>
    <p style="margin:0 0 26px;font-size:14px;color:#6c645a">${escapar(APERTURA_POR_PAISES)}</p>
    <p style="margin:0 0 30px">
      <a href="${comunidad}" style="display:inline-block;padding:14px 26px;background:#1c1a17;color:#faf8f5;text-decoration:none;font-size:12px;letter-spacing:.14em;text-transform:uppercase;border-radius:999px">
        Entrar en la lista de espera
      </a>
    </p>
    <p style="margin:0 0 18px">Si te queda alguna duda, respóndeme a este correo. Lo leo yo.</p>
  `
  );

  return { asunto: `La Membresía Divine abre el ${FECHA_CORTA}, ${n}`, texto, html };
}

/** El aviso interno, para que Sorela pueda escribir el mismo día. */
export function correoAviso(c: Contacto & { origen?: string }) {
  const wa = (c.whatsapp || '').replace(/\D/g, '');
  const texto = [
    `${c.nombre}`,
    `${c.correo}`,
    `${c.whatsapp}`,
    c.perfil ? `${c.perfil}` : '',
    '',
    `De dónde viene: ${c.origen || 'web'}`,
    '',
    'Escribirle por WhatsApp:',
    `https://wa.me/${wa}`,
    '',
    'Ya le ha llegado el correo con la información.',
  ]
    .filter((l) => l !== '')
    .join('\n');

  return {
    asunto: `Contacto nuevo: ${c.nombre} (${c.origen || 'web'})`,
    texto,
    html: undefined,
  };
}

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Marco del correo. Tablas y estilos escritos en cada etiqueta porque los
 * clientes de correo no entienden hojas de estilo ni maquetación moderna: lo
 * que aquí parece antiguo es lo único que se ve igual en Gmail y en Outlook.
 */
function envoltorio(saludo: string, cuerpo: string) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f2eee9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2eee9;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#faf8f5;border-top:3px solid #8a6a32">
      <tr><td style="padding:38px 36px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#3a352e">
        <p style="margin:0 0 22px;font-size:22px;color:#1c1a17">${saludo}</p>
        ${cuerpo}
        <p style="margin:34px 0 0;padding-top:20px;border-top:1px solid #e3ddd4;font-size:13px;color:#6c645a">
          Sorela Caro · Creadora de la Técnica Divine<br>
          <a href="${WEB}" style="color:#8a6a32;text-decoration:none">sorelacarodivine.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
