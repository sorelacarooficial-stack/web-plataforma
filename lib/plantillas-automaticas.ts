import { APERTURA_POR_PAISES, DIA_APERTURA, HORA_ESPANA } from './apertura';
import { envoltorio, escapar } from './plantillas-correo';

/**
 * Los textos de los correos automáticos (ver lib/automatizaciones.ts).
 *
 * Escritos en primera persona, como escribe Sorela, y cortos: cada uno dice
 * una cosa y lleva un botón. Ninguno habla de precios. Todos van en texto
 * plano y en HTML, por la razón que explica lib/plantillas-correo.ts.
 *
 * Cambiar un texto es cambiarlo aquí; la pantalla Correos enseña la vista
 * previa de lo que hay escrito en este archivo.
 */

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';
const PLATAFORMA = `${WEB}/plataforma`;

export type Plantilla = { asunto: string; texto: string; html: string };

const pila = (n: string | null | undefined) => (n || '').trim().split(/\s+/)[0] || '';
const hola = (n: string | null | undefined) => (pila(n) ? `Hola ${pila(n)},` : 'Hola,');

function boton(enlace: string, texto: string) {
  return `<p style="margin:6px 0 30px">
      <a href="${enlace}" style="display:inline-block;padding:14px 26px;background:#1c1a17;color:#faf8f5;text-decoration:none;font-size:12px;letter-spacing:.14em;text-transform:uppercase;border-radius:999px">${escapar(texto)}</a>
    </p>`;
}

const p = (t: string, extra = '') => `<p style="margin:0 0 18px${extra}">${t}</p>`;

function plano(lineas: (string | false | null | undefined)[]) {
  return [...lineas.filter((l): l is string => typeof l === 'string'), '', 'Sorela Caro', 'Creadora de la Técnica Divine', WEB].join('\n');
}

/* ------------------------------------------------------------ accesos */

/**
 * Si la cuenta la acabas de crear tú, todavía no tiene contraseña: entonces el
 * botón lleva a crearla (`enlaceClave`) en vez de a la puerta de entrar.
 */
const primeraVez = (enlaceClave?: string | null) =>
  enlaceClave
    ? {
        linea: 'La primera vez, crea tu contraseña con este enlace (después entras siempre con tu correo y esa contraseña):',
        enlace: enlaceClave,
        boton: 'Crear mi contraseña',
      }
    : null;

export function correoAccesoFormacion(nombre: string | null, enlaceClave?: string | null): Plantilla {
  const pv = primeraVez(enlaceClave);
  return {
    asunto: 'Ya tienes acceso a la Formación Técnica Divine',
    texto: plano([
      hola(nombre),
      '',
      'Ya tienes abierta la Formación Técnica Divine en mi plataforma: las clases en vídeo, los dossiers de cada día y la comunidad para preguntarme.',
      '',
      pv ? pv.linea : 'Entra con tu correo y tu contraseña aquí:',
      pv ? pv.enlace : PLATAFORMA,
      '',
      'Te recomiendo ir en orden, clase a clase, y practicar cada protocolo antes de pasar al siguiente. Cualquier duda, me la dejas en la comunidad o me respondes a este correo.',
    ]),
    html: envoltorio(
      escapar(hola(nombre)),
      `${p('Ya tienes abierta la <strong>Formación Técnica Divine</strong> en mi plataforma: las clases en vídeo, los dossiers de cada día y la comunidad para preguntarme.')}
       ${pv ? p(escapar(pv.linea), ';font-size:14px;color:#6c645a') : ''}
       ${boton(pv ? pv.enlace : PLATAFORMA, pv ? pv.boton : 'Entrar a mis clases')}
       ${p('Te recomiendo ir en orden, clase a clase, y practicar cada protocolo antes de pasar al siguiente. Cualquier duda, me la dejas en la comunidad o me respondes a este correo.')}`
    ),
  };
}

export function correoAccesoComunidad(nombre: string | null, enlaceClave?: string | null): Plantilla {
  const pv = primeraVez(enlaceClave);
  return {
    asunto: 'Bienvenida a la Comunidad Divine',
    texto: plano([
      hola(nombre),
      '',
      'Ya formas parte de la Comunidad Divine. Dentro tienes el espacio para compartir tus casos, preguntarme y ver las clases en vivo.',
      '',
      pv ? pv.linea : 'Entra con tu correo y tu contraseña aquí:',
      pv ? pv.enlace : PLATAFORMA,
      '',
      'Lo primero: preséntate en la comunidad. Cuéntanos quién eres y desde dónde trabajas.',
    ]),
    html: envoltorio(
      escapar(hola(nombre)),
      `${p('Ya formas parte de la <strong>Comunidad Divine</strong>. Dentro tienes el espacio para compartir tus casos, preguntarme y ver las clases en vivo.')}
       ${pv ? p(escapar(pv.linea), ';font-size:14px;color:#6c645a') : ''}
       ${boton(pv ? pv.enlace : PLATAFORMA, pv ? pv.boton : 'Entrar a la comunidad')}
       ${p('Lo primero: preséntate en la comunidad. Cuéntanos quién eres y desde dónde trabajas.')}`
    ),
  };
}

/* --------------------------------------------------------- invitación */

export function correoInvitacion(o: { nombre: string | null; enlace: string; que: string[]; caduca: string }): Plantilla {
  const que = o.que.join(' y ');
  const hasta = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(o.caduca));
  return {
    asunto: `Tu acceso a ${que}`,
    texto: plano([
      hola(o.nombre),
      '',
      `Te he preparado el acceso a ${que}. Con este enlace te creas la cuenta y entras directamente:`,
      o.enlace,
      '',
      `El enlace es solo para ti, sirve una vez y caduca el ${hasta}.`,
    ]),
    html: envoltorio(
      escapar(hola(o.nombre)),
      `${p(`Te he preparado el acceso a <strong>${escapar(que)}</strong>. Con este enlace te creas la cuenta y entras directamente.`)}
       ${boton(o.enlace, 'Crear mi cuenta')}
       ${p(`El enlace es solo para ti, sirve una vez y caduca el ${escapar(hasta)}.`, ';font-size:14px;color:#6c645a')}`
    ),
  };
}

/* ----------------------------------------------------------- registro */

export function correoRegistro(nombre: string | null, pide: 'comunidad' | 'curso' | null): Plantilla {
  const frase =
    pide === 'comunidad'
      ? `La Comunidad Divine abre el ${DIA_APERTURA} a las ${HORA_ESPANA} (hora de España). Ese día te escribo para que entres.`
      : pide === 'curso'
        ? 'En cuanto confirme tu formación te abro las clases y te aviso por aquí.'
        : 'En cuanto tengas algo abierto te aviso por aquí.';
  return {
    asunto: 'He recibido tu registro',
    texto: plano([hola(nombre), '', 'Ya tienes tu cuenta creada en mi plataforma.', frase, '', 'Si tienes cualquier duda, respóndeme a este correo.']),
    html: envoltorio(
      escapar(hola(nombre)),
      `${p('Ya tienes tu cuenta creada en mi plataforma.')}
       ${p(escapar(frase))}
       ${p('Si tienes cualquier duda, respóndeme a este correo.')}`
    ),
  };
}

/* ----------------------------------------------------------- apertura */

export function correoAperturaSemana(nombre: string | null, baja: string): Plantilla {
  return {
    asunto: 'Falta una semana para la Comunidad Divine',
    texto: plano([
      hola(nombre),
      '',
      `Queda una semana: el ${DIA_APERTURA} a las ${HORA_ESPANA} (hora de España) abro la Comunidad Divine.`,
      `Las horas en cada país: ${APERTURA_POR_PAISES}.`,
      '',
      'Como estás en la lista de espera, ese día te escribo la primera para que entres antes que nadie.',
      '',
      `Si no quieres recibir más correos así: ${baja}`,
    ]),
    html: envoltorio(
      escapar(hola(nombre)),
      `${p(`Queda una semana: el <strong>${escapar(DIA_APERTURA)} a las ${escapar(HORA_ESPANA)}</strong> (hora de España) abro la Comunidad Divine.`)}
       ${p(escapar(APERTURA_POR_PAISES), ';font-size:14px;color:#6c645a')}
       ${p('Como estás en la lista de espera, ese día te escribo la primera para que entres antes que nadie.')}`,
      baja
    ),
  };
}

export function correoAperturaDia(nombre: string | null, baja: string): Plantilla {
  return {
    asunto: 'Hoy abre la Comunidad Divine',
    texto: plano([
      hola(nombre),
      '',
      `Hoy es el día: a las ${HORA_ESPANA} (hora de España) abro la Comunidad Divine.`,
      `Las horas en cada país: ${APERTURA_POR_PAISES}.`,
      '',
      'Aquí lo tienes todo:',
      `${WEB}/comunidad`,
      '',
      `Si no quieres recibir más correos así: ${baja}`,
    ]),
    html: envoltorio(
      escapar(hola(nombre)),
      `${p(`Hoy es el día: a las <strong>${escapar(HORA_ESPANA)}</strong> (hora de España) abro la Comunidad Divine.`)}
       ${p(escapar(APERTURA_POR_PAISES), ';font-size:14px;color:#6c645a')}
       ${boton(`${WEB}/comunidad`, 'Ver la Comunidad Divine')}`,
      baja
    ),
  };
}

/* ------------------------------------------------------------ resumen */

export type ResumenDatos = {
  sinAtender: { nombre: string; dias: number; como: string }[];
  esperando: { nombre: string; correo: string; pide: string }[];
};

export function correoResumen(d: ResumenDatos): Plantilla {
  const n = d.sinAtender.length + d.esperando.length;
  const lineasA = d.sinAtender.map((c) => `· ${c.nombre} — ${c.dias === 0 ? 'hoy' : c.dias === 1 ? 'desde ayer' : `${c.dias} días esperando`} — ${c.como}`);
  const lineasB = d.esperando.map((c) => `· ${c.nombre} (${c.correo}) — ${c.pide}`);
  const lista = (xs: string[]) =>
    `<ul style="margin:0 0 22px;padding-left:18px;font-size:15px">${xs.map((x) => `<li style="margin:0 0 6px">${escapar(x.replace(/^· /, ''))}</li>`).join('')}</ul>`;
  return {
    asunto: `Tienes ${n} ${n === 1 ? 'cosa pendiente' : 'cosas pendientes'} en la plataforma`,
    texto: [
      'Buenos días, Sorela.',
      '',
      d.sinAtender.length ? `Por atender en Clientes (${d.sinAtender.length}):` : false,
      ...lineasA,
      d.sinAtender.length ? '' : false,
      d.esperando.length ? `Cuentas esperando acceso (${d.esperando.length}):` : false,
      ...lineasB,
      '',
      PLATAFORMA,
    ]
      .filter((l): l is string => typeof l === 'string')
      .join('\n'),
    html: envoltorio(
      'Buenos días, Sorela.',
      `${d.sinAtender.length ? `<p style="margin:0 0 8px"><strong>Por atender en Clientes (${d.sinAtender.length})</strong></p>${lista(lineasA)}` : ''}
       ${d.esperando.length ? `<p style="margin:0 0 8px"><strong>Cuentas esperando acceso (${d.esperando.length})</strong></p>${lista(lineasB)}` : ''}
       ${boton(PLATAFORMA, 'Abrir la plataforma')}`
    ),
  };
}
