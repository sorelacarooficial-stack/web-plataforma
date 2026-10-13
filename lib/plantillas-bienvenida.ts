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
    return `${CUANDO} abro la Comunidad Divine${fuera ? ` (${fuera})` : ''} con la masterclass en directo «La nueva era de las manos», por Zoom.`;
  if (t === 'alumna')
    return `Y por si te sirve para decidirte: la formación no termina en el certificado. ${CUANDO} abro la Comunidad Divine con una masterclass en directo. Si quieres formar parte, apúntate a la lista de espera en mi web.`;
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
/* Iconos de trazo fino (PNG en Storage, `correo/iconos/`): Gmail y Outlook no pintan SVG. */
const ICONO = {
  sitio: 'https://firebasestorage.googleapis.com/v0/b/sorela-12c46.firebasestorage.app/o/correo%2Ficonos%2Fsitio.png?alt=media&token=e5dd8da5-be7b-4883-a9c4-7bc90809a899',
  grupo: 'https://firebasestorage.googleapis.com/v0/b/sorela-12c46.firebasestorage.app/o/correo%2Ficonos%2Fgrupo.png?alt=media&token=ff9df3d1-e3d5-4c39-9616-2e6ecacadaf4',
  directo: 'https://firebasestorage.googleapis.com/v0/b/sorela-12c46.firebasestorage.app/o/correo%2Ficonos%2Fdirecto.png?alt=media&token=65de5226-a7f6-4ed5-b5f8-84f21e1c26f4',
};

/** El nombre de la masterclass, con sus partículas doradas animadas (GIF en Storage: se mueve en Gmail, Apple Mail y el móvil; Outlook de escritorio enseña el primer fotograma). */
const TITULO_MASTERCLASS = 'La nueva era de las manos';
const IMAGEN_TITULO =
  'https://firebasestorage.googleapis.com/v0/b/sorela-12c46.firebasestorage.app/o/correo%2Fmasterclass-titulo.gif?alt=media&token=3c07b7c9-9651-4935-9a15-48e1e0a57c68';

function correoListaEspera(n: string, asunto: string, saludo: string) {
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
  const sans = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const fecha = new Date(APERTURA);
  const parte = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...o }).format(fecha);
  const dia = parte({ day: 'numeric' });
  const mes = parte({ month: 'long' });
  const semana = parte({ weekday: 'long' });
  const linea = 'border-top:1px solid #ece3d3';

  /* La tarjeta: la fecha, el tema y las horas de cada país (el único sitio
     donde salen). Línea dorada fina arriba para marcar lo importante. */
  const horas = HORAS_APERTURA.map(
    (h, i) => `<td width="25%" align="center" style="padding:14px 2px 2px;${i ? 'border-left:1px solid rgba(243,227,195,.12);' : ''}">
        <span style="display:block;font-family:${sans};font-size:17px;font-weight:600;letter-spacing:-.01em;color:${i ? '#f3e3c3' : '#e3c48f'}">${escapar(h.hora)}</span>
        <span style="display:block;margin-top:3px;font-family:${sans};font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89c8b">${escapar(h.lugar)}</span>
      </td>`
  ).join('');
  const entrada = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 30px;border-radius:16px;overflow:hidden;background:#17140f">
    <tr><td style="padding:0;line-height:0"><img src="${IMAGEN_TITULO}" width="520" alt="${escapar(`Masterclass en directo: ${TITULO_MASTERCLASS}`)}" style="display:block;width:100%;max-width:520px;height:auto;border:0;margin:0 auto"></td></tr>
    <tr><td style="padding:22px 24px 0;border-top:1px solid rgba(217,180,124,.35)">
      <span style="display:block;font-family:${serif};font-size:28px;font-weight:600;line-height:1.1;color:#f3e3c3">${escapar(`${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${dia} de ${mes}`)}</span>
      <span style="display:block;margin-top:4px;font-family:${sans};font-size:10.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#d9b47c">En directo por Zoom</span>
    </td></tr>
    <tr><td style="padding:18px 16px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(243,227,195,.12)"><tr>${horas}</tr></table></td></tr>
  </table>`;

  /* Los pasos, en filas separadas por líneas finas, cada uno con su icono. */
  const paso = (icono: string, titulo: string, texto: string, estado: string, primero = false) =>
    `<tr><td style="padding:16px 0;${primero ? '' : linea}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="44" valign="top"><img src="${icono}" width="32" height="32" alt="" style="display:block;border:0"></td>
        <td valign="top">
          <span style="display:block;font-family:${sans};font-size:15px;font-weight:600;color:#17140f">${titulo}</span>
          <span style="display:block;margin-top:3px;font-family:${sans};font-size:13.5px;line-height:1.5;color:#6c645a">${texto}</span>
        </td>
        <td width="72" align="right" valign="top" style="padding-top:2px;font-family:${sans};font-size:11px;font-weight:600;letter-spacing:.06em;color:${estado === 'Hecho' ? '#4f7a55' : '#8a6a32'}">${estado}</td>
      </tr></table>
    </td></tr>`;
  const pasos = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px;border-top:1px solid #ece3d3;border-bottom:1px solid #ece3d3">
    ${paso(ICONO.sitio, 'Tu sitio está guardado', 'Estás en la lista de espera.', 'Hecho', true)}
    ${paso(ICONO.grupo, 'Entra en el grupo de WhatsApp', 'Ahí aviso de todo lo de la masterclass.', 'Ahora')}
    ${paso(ICONO.directo, `Conéctate el ${escapar(dia)} de ${escapar(mes)}`, 'Desde el móvil o el ordenador. El enlace te llega por correo ese día.', escapar(`${dia} ${mes.slice(0, 3)}`))}
  </table>`;

  const html = envoltorio(
    escapar(n ? `Hola ${n},` : 'Hola,'),
    `<p style="margin:0 0 20px">${escapar(saludo)}</p>
     ${entrada}
     ${pasos}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px"><tr><td align="center" style="border-radius:999px;background:#17140f">
       <a href="${escapar(GRUPO_WHATSAPP)}" style="display:block;padding:16px 18px;font-family:${sans};font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#f3e3c3;text-decoration:none;border-radius:999px;white-space:nowrap">Entrar al grupo de WhatsApp</a>
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
    `${TITULO_MASTERCLASS}. Masterclass en directo por Zoom: ${semana} ${dia} de ${mes}. ${APERTURA_POR_PAISES}.`,
    '',
    'Ahora, entra en el grupo de WhatsApp de la lista de espera. Ahí aviso de todo lo de la masterclass:',
    GRUPO_WHATSAPP,
    '',
    'El enlace para conectarte te llega por correo ese día.',
    '',
    'Sorela Caro',
    'Creadora de la Técnica Divine',
    WEB,
    '',
    'Te escribo porque dejaste tus datos en mi web. Si no quieres recibir más correos míos, respóndeme a este mismo y te doy de baja.',
  ].join('\n');
  return { asunto: `${asunto}${n ? `, ${n}` : ''}`, texto, html };
}

/**
 * La confirmación de «Reservar plaza» en una convocatoria de /formaciones.
 * Dice qué ha pasado de verdad (apuntada, ya lo estaba o completa) y el
 * siguiente paso: Sorela le escribe para confirmar la plaza y el pago.
 */
export function correoReservaPlaza(
  nombre: string | null,
  r: { estado: 'inscrita' | 'ya-estaba' | 'completa' | 'no-disponible'; ciudad: string; fechas: string; horario: string[] }
) {
  const n = pila(nombre);
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
  const sans = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const titulo =
    r.estado === 'completa' ? 'Esta fecha está completa' : r.estado === 'no-disponible' ? 'He recibido tu interés' : 'Tu plaza, solicitada';
  const principal =
    r.estado === 'inscrita'
      ? `He apuntado tu solicitud para la formación presencial en ${r.ciudad}. La plaza queda confirmada con el pago: te escribo yo en las próximas 48 horas con los detalles.`
      : r.estado === 'ya-estaba'
        ? `Ya tenías tu solicitud para la formación presencial en ${r.ciudad}. No hace falta que hagas nada más: te escribo yo con los detalles.`
        : r.estado === 'completa'
          ? `La formación presencial en ${r.ciudad} se ha llenado. Te he guardado tus datos: si se libera una plaza o abro otra fecha, eres de las primeras en saberlo.`
          : `Esa fecha ya no admite reservas. Te he guardado tus datos y te escribo yo.`;
  const entrada = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 26px;border-radius:18px;overflow:hidden;background:#17140f">
    <tr><td style="padding:24px 26px">
      <span style="display:block;font-family:${sans};font-size:10.5px;font-weight:700;letter-spacing:.22em;color:#d9b47c">FORMACIÓN PRESENCIAL</span>
      <span style="display:block;margin-top:6px;font-family:${serif};font-size:30px;font-weight:600;line-height:1.1;color:#f3e3c3">${escapar(r.ciudad)}</span>
      <span style="display:block;margin-top:6px;font-family:${sans};font-size:14px;color:#e2d8c8">${escapar(r.fechas)}</span>
      ${r.horario.map((h) => `<span style="display:block;margin-top:4px;font-family:${sans};font-size:13px;color:#bfb3a2">${escapar(h)}</span>`).join('')}
    </td></tr>
  </table>`;
  const html = envoltorio(
    escapar(n ? `Hola ${n},` : 'Hola,'),
    `${entrada}
     <p style="margin:0 0 18px">${escapar(principal)}</p>
     <p style="margin:0 0 18px">Recuerda que para la presencial hace falta tener hecha la formación online. Si tienes cualquier duda, respóndeme a este correo o escríbeme por WhatsApp.</p>
     ${botonCorreo(WHATSAPP, 'Escríbeme por WhatsApp')}`,
    undefined,
    '',
    { titulo, etiqueta: 'Técnica Divine', previa: principal.slice(0, 90) }
  );
  const texto = [
    n ? `Hola ${n},` : 'Hola,',
    '',
    `Formación presencial en ${r.ciudad}: ${r.fechas}.`,
    ...r.horario,
    '',
    principal,
    '',
    'Para la presencial hace falta tener hecha la formación online. Cualquier duda, respóndeme a este correo.',
    `WhatsApp: ${WHATSAPP}`,
    '',
    'Sorela Caro',
    'Creadora de la Técnica Divine',
    WEB,
  ].join('\n');
  return { asunto: `${titulo}${n ? `, ${n}` : ''} · ${r.ciudad}`, texto, html };
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
