import { APERTURA, APERTURA_POR_PAISES, DIA_APERTURA, GRUPO_WHATSAPP, HORAS_APERTURA, HORA_ESPANA } from './apertura';
import { comoLlego, ETIQUETA_TIPO, tipoDeOrigen, type Tipo } from './origenes';
import { botonCorreo, envoltorio, escapar } from './plantillas-correo';

/**
 * El correo que recibe quien deja sus datos en la web, y el aviso a Sorela.
 *
 * Son los mismos textos que escribía el Apps Script de Gmail
 * (`apps-script/Codigo.gs`, TEXTOS), traídos aquí para que, con Resend, salgan
 * desde el dominio con el mismo diseño que el resto de correos. Cuatro
 * versiones según lo que busca la persona: no se le habla igual a quien quiere
 * una sesión que a una terapeuta.
 *
 * Reglas: ni efectos sobre la salud, ni precios, ni cifras de dinero.
 */

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';
const WHATSAPP = 'https://wa.me/34686154556';

const pila = (n: string | null | undefined) => (n || '').trim().split(/\s+/)[0] || '';

const fuera = APERTURA_POR_PAISES.split('·')
  .map((t) => t.trim())
  .filter((t) => t && !t.includes('España'))
  .join(', ');
const CUANDO = `El ${DIA_APERTURA} a las ${HORA_ESPANA}, hora de España,`;
const cuando = `el ${DIA_APERTURA} a las ${HORA_ESPANA}, hora de España,`;

function cierreComunidad(t: Tipo) {
  if (t === 'comunidad')
    // Lo que hay dentro NO se cuenta: se presenta ese día en la masterclass.
    return `${CUANDO} abro la Comunidad Divine${fuera ? ` (${fuera})` : ''} con una masterclass en directo por Zoom: te hablo de mi técnica y del alto impacto de lo digital en las terapeutas, y al final te cuento qué hay dentro.`;
  if (t === 'alumna')
    return `Y por si te sirve para decidirte: la formación no termina en el certificado. ${CUANDO} abro la Comunidad Divine con una masterclass en directo. Si quieres formar parte, apúntate a la lista de espera y te mando el enlace.`;
  if (t === 'clienta')
    return `Y si además de clienta trabajas con las manos —eres terapeuta o esteticista—, dímelo: ${cuando} abro la Comunidad Divine con una masterclass en directo para terapeutas.`;
  return `Por si te viene al caso: ${cuando} abro la Comunidad Divine, para terapeutas que ya trabajan con las manos.`;
}

const TEXTOS: Record<Tipo, { asunto: string; saludo: string; parrafos: (string | 'CIERRE')[] }> = {
  clienta: {
    asunto: 'La información de la Técnica Divine',
    saludo: 'Gracias por pedirme la información. Te la cuento aquí.',
    parrafos: [
      'La Técnica Divine es un masaje manual: mis manos, aceite y, en algunas zonas, herramientas de aluminio. Sin máquinas y sin nada invasivo.',
      'Lo que manda es el orden. Se empieza con la apertura de cinco puntos; después se trabaja la zona por partes —en el abdomen, primero la de abajo, luego la de arriba, luego los laterales— y se termina juntándolo todo.',
      'Antes de empezar hablamos. Hay situaciones en las que esta técnica no se aplica, y eso lo miramos juntas antes de que te subas a la camilla.',
      'Si quieres una sesión o te queda alguna duda, respóndeme a este correo. Lo leo yo.',
      'CIERRE',
    ],
  },
  alumna: {
    asunto: 'La formación en Técnica Divine',
    saludo: 'Gracias por interesarte por la formación.',
    parrafos: [
      'La formación son dos etapas y van siempre en este orden: primero online y después presencial. Lo online te prepara; en lo presencial te corrijo la mano sobre cuerpo real.',
      'Las próximas fechas las estoy cerrando ahora mismo y te las mando en cuanto las tenga, sin que tengas que estar pendiente.',
      'CIERRE',
      'Cualquier duda mientras tanto, respóndeme a este correo.',
    ],
  },
  comunidad: {
    // Sin prometer correos («te escribiré con ideas…»): no gustaba, y lo que
    // se le pide a quien se apunta es una sola cosa, entrar en el grupo.
    asunto: 'Tu sitio en la Comunidad Divine',
    saludo: 'Gracias por apuntarte a la lista de espera.',
    parrafos: [
      'CIERRE',
      'El siguiente paso es entrar en el grupo de WhatsApp de la lista de espera. Ahí te espero hasta el día de la masterclass.',
    ],
  },
  otro: {
    asunto: 'He recibido tu mensaje',
    saludo: 'Gracias por escribirme.',
    parrafos: [
      'Te contesto yo en menos de 48 horas.',
      'Para no hacerte perder el tiempo: ¿buscas una sesión para ti, quieres formarte en la técnica, o es otra cosa? Con saber eso te mando lo que te sirve.',
      'CIERRE',
    ],
  },
};

const TITULARES: Record<Tipo, string> = {
  clienta: 'La Técnica Divine',
  alumna: 'La formación en Técnica Divine',
  comunidad: 'La Comunidad Divine',
  otro: 'Gracias por escribirme',
};

export function correoBienvenidaPorOrigen(nombre: string | null, origen: string | null) {
  const tipo = tipoDeOrigen(origen);
  const t = TEXTOS[tipo];
  const n = pila(nombre);
  const parrafos = [t.saludo, ...t.parrafos.map((p) => (p === 'CIERRE' ? cierreComunidad(tipo) : p))];
  const texto = [
    n ? `Hola ${n},` : 'Hola,',
    '',
    parrafos.join('\n\n'),
    '',
    `Si te resulta más cómodo, escríbeme por WhatsApp: ${WHATSAPP}`,
    '',
    'Sorela Caro',
    'Creadora de la Técnica Divine',
    WEB,
    '',
    'Te escribo porque dejaste tus datos en mi web. Si no quieres recibir más correos míos, respóndeme a este mismo y te doy de baja.',
  ].join('\n');
  if (tipo === 'comunidad') return correoListaEspera(n, t.asunto, t.saludo);
  const html = envoltorio(
    escapar(n ? `Hola ${n},` : 'Hola,'),
    `${parrafos.map((p) => `<p style="margin:0 0 18px">${escapar(p)}</p>`).join('\n')}
     ${botonCorreo(WHATSAPP, 'Escríbeme por WhatsApp')}`,
    undefined,
    '',
    { titulo: TITULARES[tipo], etiqueta: 'Técnica Divine', imagen: tipo === 'clienta' ? 'consulta' : 'equipo', previa: t.saludo }
  );
  return { asunto: `${t.asunto}${n ? `, ${n}` : ''}`, texto, html };
}

/**
 * La confirmación de la lista de espera, con su propio diseño: la fecha como
 * una entrada (día grande, hora en cada país), los tres pasos y un solo botón,
 * el del grupo de WhatsApp. Todo en tablas y estilos en línea, que es lo único
 * que Gmail, Apple Mail y Outlook pintan igual (nada de SVG ni de CSS moderno).
 */
function correoListaEspera(n: string, asunto: string, saludo: string) {
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
  const sans = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const fecha = new Date(APERTURA);
  const parte = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...o }).format(fecha);
  const dia = parte({ day: 'numeric' });
  const mes = parte({ month: 'long' }).toUpperCase();
  const semana = parte({ weekday: 'long' }).toUpperCase();

  const horas = HORAS_APERTURA.map(
    (h, i) => `<td width="25%" align="center" style="padding:12px 4px;${i ? 'border-left:1px solid rgba(243,227,195,.16);' : ''}">
        <span style="display:block;font-family:${serif};font-size:24px;font-weight:600;line-height:1.1;color:${i ? '#f3e3c3' : '#d9b47c'}">${escapar(h.hora)}</span>
        <span style="display:block;margin-top:4px;font-family:${sans};font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#bfb3a2">${escapar(h.lugar)}</span>
      </td>`
  ).join('');

  const entrada = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 30px;border-radius:18px;overflow:hidden;background:#17140f">
    <tr><td style="padding:26px 26px 6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="96" valign="middle" style="padding-right:18px;border-right:1px solid rgba(217,180,124,.35)">
          <span style="display:block;font-family:${serif};font-size:64px;font-weight:600;line-height:.9;color:#f3e3c3">${escapar(dia)}</span>
          <span style="display:block;margin-top:6px;font-family:${sans};font-size:11px;font-weight:700;letter-spacing:.2em;color:#d9b47c">${escapar(mes)}</span>
        </td>
        <td valign="middle" style="padding-left:20px">
          <span style="display:block;font-family:${sans};font-size:10.5px;font-weight:700;letter-spacing:.22em;color:#d9b47c">${escapar(semana)} · EN DIRECTO</span>
          <span style="display:block;margin-top:6px;font-family:${serif};font-size:25px;font-weight:600;line-height:1.15;color:#f3e3c3">Masterclass de apertura</span>
          <span style="display:block;margin-top:6px;font-family:${sans};font-size:13px;color:#bfb3a2">Por Zoom · desde el móvil o el ordenador</span>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 14px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(243,227,195,.16)"><tr>${horas}</tr></table></td></tr>
  </table>`;

  const paso = (num: string, titulo: string, texto: string, hecho = false) =>
    `<td width="33%" valign="top" style="padding:0 6px">
      <div style="width:34px;height:34px;border-radius:50%;text-align:center;line-height:34px;font-family:${sans};font-size:14px;font-weight:700;${hecho ? 'background:#d9b47c;color:#17140f' : 'background:#f5efe2;color:#6e5327;border:1px solid #d9c6a0'}">${hecho ? '&#10003;' : num}</div>
      <span style="display:block;margin-top:10px;font-family:${serif};font-size:18px;font-weight:600;line-height:1.2;color:#17140f">${titulo}</span>
      <span style="display:block;margin-top:4px;font-family:${sans};font-size:13px;line-height:1.5;color:#6c645a">${texto}</span>
    </td>`;
  const pasos = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px"><tr>
    ${paso('1', 'Tu sitio', 'Guardado en la lista de espera.', true)}
    ${paso('2', 'El grupo', 'Entra en el grupo de WhatsApp de la lista.')}
    ${paso('3', `El ${escapar(dia)} de ${escapar(parte({ month: 'long' }))}`, `Masterclass en directo a las ${escapar(HORA_ESPANA)} (España).`)}
  </tr></table>`;

  const html = envoltorio(
    escapar(n ? `Hola ${n},` : 'Hola,'),
    `<p style="margin:0 0 22px">${escapar(saludo)}</p>
     ${entrada}
     <p style="margin:0 0 22px">${escapar(cierreComunidad('comunidad'))}</p>
     ${pasos}
     <p style="margin:0 0 8px;font-family:${serif};font-size:21px;font-weight:600;color:#17140f">Ahora, entra en el grupo</p>
     <p style="margin:0 0 18px">Ahí te espero hasta el día de la masterclass.</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 28px"><tr><td align="center" style="border-radius:999px;background:#17140f">
       <a href="${escapar(GRUPO_WHATSAPP)}" style="display:block;padding:17px 18px;font-family:${sans};font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#f3e3c3;text-decoration:none;border-radius:999px;white-space:nowrap">Entrar al grupo de WhatsApp&nbsp;&rarr;</a>
     </td></tr></table>`,
    undefined,
    '',
    { titulo: 'Tu sitio está guardado', etiqueta: 'Comunidad Divine · Lista de espera', previa: 'Siguiente paso: entra en el grupo de WhatsApp.' }
  );
  const texto = [
    n ? `Hola ${n},` : 'Hola,',
    '',
    saludo,
    '',
    cierreComunidad('comunidad'),
    '',
    'Ahora, entra en el grupo de WhatsApp de la lista de espera. Ahí te espero hasta el día de la masterclass:',
    GRUPO_WHATSAPP,
    '',
    'Sorela Caro',
    'Creadora de la Técnica Divine',
    WEB,
    '',
    'Te escribo porque dejaste tus datos en mi web. Si no quieres recibir más correos míos, respóndeme a este mismo y te doy de baja.',
  ].join('\n');
  return { asunto: `${asunto}${n ? `, ${n}` : ''}`, texto, html };
}

/** El aviso interno: alguien ha dejado sus datos. Para que Sorela escriba el mismo día. */
export function correoAvisoContacto(
  d: { nombre: string; correo: string; whatsapp?: string; ciudad?: string; perfil?: string; nota?: string },
  origen: string,
  llegoSuCorreo: boolean
) {
  const tipo = tipoDeOrigen(origen);
  const tel = (d.whatsapp || '').replace(/\D/g, '');
  const lineas = [
    `${d.nombre || '(sin nombre)'} — ${ETIQUETA_TIPO[tipo]}`,
    '',
    `Correo: ${d.correo}`,
    tel ? `WhatsApp: ${d.whatsapp} · https://wa.me/${tel}` : 'WhatsApp: no lo ha dejado',
    d.ciudad ? `Ciudad: ${d.ciudad}` : '',
    d.perfil ? `Se dedica a: ${d.perfil}` : '',
    d.nota ? `\nHa escrito:\n${d.nota}` : '',
    '',
    `De dónde viene: ${comoLlego(origen)}`,
    '',
    llegoSuCorreo ? 'Ya le ha llegado su correo con la información.' : 'OJO: no ha salido su correo. Escríbele tú.',
    '',
    `Su ficha: ${WEB}/plataforma`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
  return { asunto: `Contacto nuevo: ${d.nombre} (${ETIQUETA_TIPO[tipo]})`, texto: lineas.join('\n') };
}

/** El correo del acuerdo de confidencialidad firmado (los PDF van adjuntos). */
export function correoAcuerdo(nombre: string, referencia: string, enlaceDossier: string, conAdjuntos: boolean) {
  const n = pila(nombre);
  const saludo = n ? `Hola, ${n}.` : 'Hola.';
  const aviso =
    'Es un documento confidencial. Lo que has firmado dice que no se reproduce, ni se modifica, ni se comparte con nadie. Te pido que lo cumplas: es el trabajo de treinta años.';
  const texto = [
    saludo,
    '',
    'Queda firmado tu acuerdo de confidencialidad de la Técnica Divine. Gracias.',
    '',
    `Tu referencia es ${referencia}. Guárdala: es lo que tienes que citar si alguna vez hay que localizar tu acuerdo.`,
    '',
    conAdjuntos ? 'Te adjunto tu acuerdo firmado y tu dossier del precurso.\n' : '',
    `Si el dossier no te llega adjunto, lo tienes también aquí: ${enlaceDossier}`,
    '',
    aviso,
    '',
    'Nos vemos en la formación.',
    'Sorela',
  ].join('\n');
  const html = envoltorio(
    escapar(saludo),
    `<p style="margin:0 0 18px">Queda firmado tu acuerdo de confidencialidad de la Técnica Divine. Gracias.</p>
     ${conAdjuntos ? '<p style="margin:0 0 18px">Te adjunto tu <strong>acuerdo firmado</strong> y tu <strong>dossier del precurso</strong>, los dos en PDF.</p>' : ''}
     <p style="margin:22px 0;padding:14px 16px;background:#f5efe2;border:1px solid #d9c6a0;border-radius:10px">
       <span style="display:block;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#6e5327">Tu referencia</span>
       <strong style="font-size:21px;letter-spacing:.06em">${escapar(referencia)}</strong>
     </p>
     ${botonCorreo(enlaceDossier, 'Abrir mi dossier')}
     <p style="margin:0 0 18px;font-size:14px;color:#6c645a">${escapar(aviso)}</p>
     <p style="margin:0 0 18px">Nos vemos en la formación.</p>`,
    undefined,
    '',
    { titulo: 'Tu dossier de la formación', etiqueta: 'Acuerdo aprobado', previa: 'Tu dossier, adjunto y confidencial.' }
  );
  return { asunto: `Tu acuerdo firmado y tu dossier${n ? `, ${n}` : ''}`, texto, html };
}

/** Acaba de firmar: su acuerdo en PDF y el aviso de que Sorela lo revisa. */
export function correoAcuerdoRecibido(nombre: string, referencia: string) {
  const n = pila(nombre);
  const saludo = n ? `Hola, ${n}.` : 'Hola.';
  const texto = [
    saludo,
    '',
    'He recibido tu acuerdo de confidencialidad firmado. Gracias.',
    '',
    `Tu referencia es ${referencia}. Te adjunto el acuerdo en PDF para que lo guardes.`,
    '',
    'Lo reviso yo y, en cuanto lo apruebe, te llega por aquí tu dossier de la formación.',
    '',
    'Un abrazo,',
    'Sorela',
  ].join('\n');
  const html = envoltorio(
    escapar(saludo),
    `<p style="margin:0 0 18px">He recibido tu acuerdo de confidencialidad firmado. Gracias.</p>
     <p style="margin:22px 0;padding:14px 16px;background:#f5efe2;border:1px solid #d9c6a0;border-radius:10px">
       <span style="display:block;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#6e5327">Tu referencia</span>
       <strong style="font-size:21px;letter-spacing:.06em">${escapar(referencia)}</strong>
     </p>
     <p style="margin:0 0 18px">Te adjunto el acuerdo en PDF para que lo guardes. Lo reviso yo y, en cuanto lo apruebe, te llega por aquí <strong>tu dossier de la formación</strong>.</p>`,
    undefined,
    '',
    { titulo: 'Acuerdo recibido', etiqueta: 'Formación Técnica Divine', previa: 'Lo reviso y te envío tu dossier.' }
  );
  return { asunto: `He recibido tu acuerdo${n ? `, ${n}` : ''}`, texto, html };
}
