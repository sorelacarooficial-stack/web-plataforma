import { APERTURA_POR_PAISES, DIA_APERTURA, HORA_ESPANA } from './apertura';
import type { Contacto } from './captacion';
import { MARCA, type ImagenCorreo } from './marca-correo';

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
 * Script de la cuenta de Google de Sorela (`apps-script/Codigo.gs`), que escribe
 * distinto según de dónde venga cada persona. Ninguno de los dos adjunta PDF. Esto es
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
    `${cuando}, abro la Comunidad Divine con una masterclass en directo por Zoom. Lo que hay dentro lo cuento ese día.`,
    `Las horas en cada país: ${APERTURA_POR_PAISES}.`,
    '',
    'Apúntate a la lista de espera y te mando el enlace:',
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
    <p style="margin:0 0 18px">${escapar(cuando)}, abro la <strong>Comunidad Divine</strong> con una masterclass en directo por Zoom. Lo que hay dentro lo cuento ese día.</p>
    <p style="margin:0 0 26px;font-size:14px;color:#6c645a">${escapar(APERTURA_POR_PAISES)}</p>
    <p style="margin:0 0 30px">
      <a href="${comunidad}" style="display:inline-block;padding:14px 26px;background:#1c1a17;color:#faf8f5;text-decoration:none;font-size:12px;letter-spacing:.14em;text-transform:uppercase;border-radius:999px">
        Entrar en la lista de espera
      </a>
    </p>
    <p style="margin:0 0 18px">Si te queda alguna duda, respóndeme a este correo. Lo leo yo.</p>
  `
  );

  return { asunto: `La Comunidad Divine abre el ${FECHA_CORTA}, ${n}`, texto, html };
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

export const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Marco del correo. Tablas y estilos escritos en cada etiqueta porque los
 * clientes de correo no entienden hojas de estilo ni maquetación moderna: lo
 * que aquí parece antiguo es lo único que se ve igual en Gmail y en Outlook.
 */
/** El botón de los correos: el mismo en todos. */
export function botonCorreo(enlace: string, texto: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px"><tr><td style="border-radius:999px;background:#17140f">
    <a href="${escapar(enlace)}" style="display:inline-block;padding:16px 30px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#f3e3c3;text-decoration:none;border-radius:999px">${escapar(texto)} &rarr;</a>
  </td></tr></table>`;
}

export type Marco = {
  /** El titular grande del correo. */
  titulo?: string;
  /** La línea pequeña dorada de encima del titular. */
  etiqueta?: string;
  /** La foto de cabecera; 'ninguna' para no poner. Por defecto, ninguna. */
  imagen?: ImagenCorreo;
  /** Lo que se lee en la bandeja de entrada junto al asunto. */
  previa?: string;
};

/**
 * El marco de TODOS los correos: cabecera oscura con el logotipo, foto,
 * titular elegante, el texto, la firma y un pie con la web y las redes.
 *
 * Tablas y estilos escritos en cada etiqueta porque los programas de correo
 * no entienden hojas de estilo ni maquetación moderna: lo que aquí parece
 * antiguo es lo único que se ve igual en Gmail, Apple Mail y Outlook. Ancho
 * de 600 px, que es el estándar, y en el móvil se ajusta solo.
 */
export function envoltorio(saludo: string, cuerpo: string, baja?: string, antes = '', marco: Marco = {}) {
  const foto = marco.imagen && marco.imagen !== 'ninguna' ? MARCA.imagenes[marco.imagen] : null;
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
  const sans = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&display=swap" rel="stylesheet">
<style>
  @media (max-width:620px){ .caja{padding:30px 24px !important} .titular{font-size:30px !important} .pie{padding:26px 24px !important} }
  a{color:#8a6a32}
</style></head>
<body style="margin:0;padding:0;background:#ece5d9;-webkit-text-size-adjust:100%">
${marco.previa ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapar(marco.previa)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece5d9;padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-radius:22px;overflow:hidden;background:#fffdf9;box-shadow:0 20px 50px -30px rgba(23,20,15,.45)">
      <tr><td align="center" style="background:#17140f;padding:26px 24px">
        <a href="${WEB}" style="text-decoration:none"><img src="${MARCA.logoClaro}" width="140" alt="Sorela Caro · Técnica Divine" style="display:block;width:140px;height:auto;border:0"></a>
      </td></tr>
      ${foto ? `<tr><td style="padding:0;line-height:0"><img src="${foto}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>` : ''}
      <tr><td class="caja" style="padding:42px 46px 34px;font-family:${sans};font-size:16px;line-height:1.72;color:#3a352e">
        ${marco.etiqueta ? `<p style="margin:0 0 10px;font-family:${sans};font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#8a6a32">${escapar(marco.etiqueta)}</p>` : ''}
        ${marco.titulo ? `<h1 class="titular" style="margin:0 0 18px;font-family:${serif};font-size:36px;font-weight:600;line-height:1.12;color:#17140f">${escapar(marco.titulo)}</h1>
        <div style="width:46px;height:2px;margin:0 0 26px;background:#d9b47c;line-height:2px;font-size:0">&nbsp;</div>` : ''}
        ${antes}<p style="margin:0 0 18px;font-family:${serif};font-size:${marco.titulo ? '21px' : '24px'};font-weight:600;color:#17140f">${saludo}</p>
        ${cuerpo}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:30px"><tr>
          <td style="padding-right:14px;vertical-align:middle"><div style="width:44px;height:44px;border-radius:50%;background:#17140f;text-align:center;line-height:44px;font-family:${serif};font-size:20px;color:#f3e3c3">S</div></td>
          <td style="vertical-align:middle;font-family:${sans};font-size:13px;line-height:1.45;color:#6c645a">
            <span style="font-family:${serif};font-size:19px;font-style:italic;color:#17140f">Sorela Caro</span><br>Creadora de la Técnica Divine
          </td>
        </tr></table>
      </td></tr>
      <tr><td class="pie" align="center" style="background:#17140f;padding:28px 46px;font-family:${sans};font-size:12px;line-height:1.6;color:rgba(247,242,234,.6)">
        <a href="${WEB}" style="color:#d9b47c;text-decoration:none;font-weight:600">sorelacarodivine.com</a>
        &nbsp;·&nbsp; <a href="${MARCA.instagram}" style="color:#d9b47c;text-decoration:none">Instagram</a>
        &nbsp;·&nbsp; <a href="${MARCA.whatsapp}" style="color:#d9b47c;text-decoration:none">WhatsApp</a>
        ${
          baja
            ? `<p style="margin:16px 0 0;font-size:11px;color:rgba(247,242,234,.45)">Te escribo porque dejaste tus datos en mi web o tienes cuenta en mi plataforma.<br><a href="${baja}" style="color:rgba(247,242,234,.6)">Darme de baja de estos correos</a></p>`
            : '<p style="margin:16px 0 0;font-size:11px;color:rgba(247,242,234,.45)">Técnica Divine · Sorela Caro</p>'
        }
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
