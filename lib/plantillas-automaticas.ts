import { DIA_APERTURA, HORA_ESPANA } from './apertura';
import { botonCorreo, envoltorio, escapar } from './plantillas-correo';
import { FORMAS_DE_SUMAR, NIVELES, SUMAN_AL_MES, formatoPuntos, type FuenteMes } from './puntos-tipos';

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

const boton = botonCorreo;

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
       ${p('Te recomiendo ir en orden, clase a clase, y practicar cada protocolo antes de pasar al siguiente. Cualquier duda, me la dejas en la comunidad o me respondes a este correo.')}`,
      undefined,
      '',
      { titulo: 'Tu formación ya está abierta', etiqueta: 'Formación Técnica Divine', imagen: 'equipo', previa: 'Ya puedes entrar a tus clases.' }
    ),
  };
}

/* Los iconos de las cuatro formas de sumar del ranking, los mismos de la
   plataforma (IconosDivine) pasados a PNG: el SVG no lo pinta ni Gmail ni
   Outlook. Viven en Storage (`correo/puntos/`) como las demás imágenes de los
   correos (ver lib/marca-correo.ts). */
const ICONOS_PUNTOS = 'https://firebasestorage.googleapis.com/v0/b/sorela-12c46.firebasestorage.app/o/correo%2Fpuntos%2F';
const ICONO_CORREO: Record<FuenteMes, string> = {
  publicaciones: `${ICONOS_PUNTOS}publicaciones.png?alt=media&token=35c22d35-56ff-442c-a570-72eda3b6f9e8`,
  respuestas: `${ICONOS_PUNTOS}respuestas.png?alt=media&token=5faf7081-cb5e-46ec-8be9-8460f3d9beb4`,
  meGusta: `${ICONOS_PUNTOS}meGusta.png?alt=media&token=8d342410-4820-4ba9-83b9-fbe3360f3aba`,
  clases: `${ICONOS_PUNTOS}clases.png?alt=media&token=0f1e8d2d-286d-4457-8aca-9aae15af8b62`,
};

/**
 * Cómo se ganan los puntos, los niveles y los trofeos, en pocas líneas. Los
 * valores salen de lib/puntos-tipos.ts (FORMAS_DE_SUMAR, NIVELES): si cambian
 * los puntos, cambia el correo solo. SOLO para miembros: lo que incluye la
 * Comunidad no se cuenta fuera (ni a la lista de espera) hasta la apertura.
 */
function comoSeSuma() {
  const forma = (f: string) => FORMAS_DE_SUMAR.find((x) => x.fuente === f)!;
  const principales = SUMAN_AL_MES.map(forma);
  const otras = (['dias', 'perfil', 'logros'] as const).map(forma);
  const [primero, ultimo] = [NIVELES[0], NIVELES[NIVELES.length - 1]];
  const otrasTexto = new Intl.ListFormat('es', { type: 'conjunction' }).format(
    otras.map((x) => `${x.texto.charAt(0).toLowerCase()}${x.texto.slice(1)} (+${formatoPuntos(x.puntos)})`)
  );
  const cierre = `También suman ${otrasTexto}. Con los puntos subes de nivel (son ${NIVELES.length}, de «${primero.nombre}» a «${ultimo.nombre}») y ganas trofeos de bronce, plata y oro. Cada mes, las más activas salen en «Más activas este mes».`;
  const sans = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const filas = principales
    .map(
      (x) => `<tr>
        <td width="44" style="padding:5px 12px 5px 0;vertical-align:middle"><img src="${ICONO_CORREO[x.fuente as FuenteMes]}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0"></td>
        <td style="padding:5px 0;vertical-align:middle;font-family:${sans};font-size:15px;line-height:1.4;color:#3a352e">${escapar(x.texto)}</td>
        <td align="right" style="padding:5px 0 5px 12px;vertical-align:middle;font-family:${sans};font-size:15px;font-weight:700;color:#7e2f40;white-space:nowrap">+${formatoPuntos(x.puntos)}</td>
      </tr>`
    )
    .join('');
  return {
    texto: ['Dentro, lo que haces suma puntos:', ...principales.map((x) => `· ${x.texto}: +${formatoPuntos(x.puntos)}`), cierre],
    html: `${p('Dentro, lo que haces suma puntos:', ';margin-bottom:8px')}
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border-top:1px solid #eadfd0;border-bottom:1px solid #eadfd0;padding:6px 0">${filas}</table>
       ${p(escapar(cierre), ';font-size:15px')}`,
  };
}

export function correoAccesoComunidad(nombre: string | null, enlaceClave?: string | null): Plantilla {
  const pv = primeraVez(enlaceClave);
  const puntos = comoSeSuma();
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
      ...puntos.texto,
      '',
      'Lo primero: preséntate en la comunidad. Cuéntanos quién eres y desde dónde trabajas.',
    ]),
    html: envoltorio(
      escapar(hola(nombre)),
      `${p('Ya formas parte de la <strong>Comunidad Divine</strong>. Dentro tienes el espacio para compartir tus casos, preguntarme y ver las clases en vivo.')}
       ${pv ? p(escapar(pv.linea), ';font-size:14px;color:#6c645a') : ''}
       ${boton(pv ? pv.enlace : PLATAFORMA, pv ? pv.boton : 'Entrar a la comunidad')}
       ${puntos.html}
       ${p('Lo primero: preséntate en la comunidad. Cuéntanos quién eres y desde dónde trabajas.')}`,
      undefined,
      '',
      { titulo: 'Bienvenida a la Comunidad Divine', etiqueta: 'Comunidad Divine', imagen: 'consulta', previa: 'Ya formas parte de la comunidad.' }
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
       ${p(`El enlace es solo para ti, sirve una vez y caduca el ${escapar(hasta)}.`, ';font-size:14px;color:#6c645a')}`,
      undefined,
      '',
      { titulo: 'Tu acceso está listo', etiqueta: 'Invitación personal', imagen: 'equipo', previa: 'Crea tu cuenta con este enlace.' }
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
       ${p('Si tienes cualquier duda, respóndeme a este correo.')}`,
      undefined,
      '',
      { titulo: 'Tu cuenta está creada', etiqueta: 'Plataforma Técnica Divine', imagen: 'consulta', previa: 'Ya tienes tu cuenta en mi plataforma.' }
    ),
  };
}

/* ------------------------------------------------------------ resumen */

export type ResumenDatos = {
  sinAtender: { nombre: string; dias: number; como: string }[];
  esperando: { nombre: string; correo: string; pide: string }[];
  /** Programados de los próximos días con el botón sin enlace: no saldrán. */
  sinEnlace?: { asunto: string; fecha: string }[];
};

export function correoResumen(d: ResumenDatos): Plantilla {
  const sinEnlace = d.sinEnlace ?? [];
  const n = d.sinAtender.length + d.esperando.length + sinEnlace.length;
  const lineasA = d.sinAtender.map((c) => `· ${c.nombre} — ${c.dias === 0 ? 'hoy' : c.dias === 1 ? 'desde ayer' : `${c.dias} días esperando`} — ${c.como}`);
  const lineasB = d.esperando.map((c) => `· ${c.nombre} (${c.correo}) — ${c.pide}`);
  const fechaCorta = (f: string) =>
    new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${f}T12:00:00Z`));
  const lineasC = sinEnlace.map((c) => `· «${c.asunto}» — sale el ${fechaCorta(c.fecha)}`);
  const lista = (xs: string[]) =>
    `<ul style="margin:0 0 22px;padding-left:18px;font-size:15px">${xs.map((x) => `<li style="margin:0 0 6px">${escapar(x.replace(/^· /, ''))}</li>`).join('')}</ul>`;
  return {
    asunto: `Tienes ${n} ${n === 1 ? 'cosa pendiente' : 'cosas pendientes'} en la plataforma`,
    texto: [
      'Buenos días, Sorela.',
      '',
      sinEnlace.length ? `Correos que NO saldrán porque al botón le falta el enlace (pégalo en Avisos y correos):` : false,
      ...lineasC,
      sinEnlace.length ? '' : false,
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
      `${sinEnlace.length ? `<p style="margin:0 0 8px;color:#a24a2e"><strong>No saldrán: al botón le falta el enlace</strong></p><p style="margin:0 0 8px;font-size:14px">Pégalo en Avisos y correos → Editar.</p>${lista(lineasC)}` : ''}
       ${d.sinAtender.length ? `<p style="margin:0 0 8px"><strong>Por atender en Clientes (${d.sinAtender.length})</strong></p>${lista(lineasA)}` : ''}
       ${d.esperando.length ? `<p style="margin:0 0 8px"><strong>Cuentas esperando acceso (${d.esperando.length})</strong></p>${lista(lineasB)}` : ''}
       ${boton(PLATAFORMA, 'Abrir la plataforma')}`,
      undefined,
      '',
      { titulo: 'Tu resumen de hoy', etiqueta: 'Plataforma', previa: 'Lo que tienes pendiente.' }
    ),
  };
}
