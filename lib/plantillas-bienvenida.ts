import { APERTURA_POR_PAISES, DIA_APERTURA, HORA_ESPANA } from './apertura';
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
    return `${CUANDO} abro la Comunidad Divine${fuera ? ` (${fuera})` : ''} con una masterclass en directo por Zoom. Lo que hay dentro te lo cuento ese día. Estás en la lista: hasta entonces te escribo con ideas para tu cabina, y ese mismo día te mando el enlace para entrar.`;
  if (t === 'alumna')
    return `Y por si te sirve para decidirte: la formación no termina en el certificado. ${CUANDO} abro la Comunidad Divine, que es donde sigo enseñando después del curso. La presento ese día en una masterclass en directo.`;
  if (t === 'clienta')
    return `Y si además de clienta trabajas con las manos —eres terapeuta o esteticista—, dímelo: ${cuando} abro la Comunidad Divine, que es donde enseño el método a quien ya trabaja.`;
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
    asunto: 'La Comunidad Divine',
    saludo: 'Gracias por apuntarte a la lista. Voy al grano.',
    parrafos: [
      'CIERRE',
      'A ti te aviso antes que a nadie: tendrás el enlace en el correo antes de que se abra al resto.',
      'Hasta entonces te escribiré de vez en cuando con ideas para tu trabajo en cabina. Cualquier duda, respóndeme a este correo.',
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
