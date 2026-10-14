/**
 * Qué toca ahora con cada persona: si te necesita, si va sola en la lista de
 * espera, si espera un aviso o si ya estáis hablando.
 *
 * Esto existe porque «sin atender» se contaba con tres reglas distintas en
 * siete sitios —el inicio, Pendiente, Clientes, el resumen de la mañana, la
 * IA, el informe y el aviso interno— y ninguna miraba si la persona ya iba
 * sola con los correos de la lista de espera. Con la lista creciendo hacia la
 * masterclass, «9 sin atender» eran en realidad 0 personas esperando a
 * Sorela. Ahora hay UNA regla, aquí, y todos esos sitios la leen.
 *
 * No va en lib/origenes.ts: aquello responde a «de dónde vino»; esto, a «qué
 * toca ahora». Sin `server-only`, porque la leen el navegador, las rutas, el
 * cron y el informe. Lo que necesita de fuera de la ficha (bajas, miembros,
 * convocatorias abiertas) llega en un `ContextoAtencion` que monta UNA función
 * de servidor (lib/atencion-servidor.ts), para que no vuelva la divergencia
 * de calcularlo en cada sitio.
 *
 * Los tipos de abajo son el CONTRATO de varias piezas que se hacen a la vez
 * (motor, lecturas, IA e informe, diagrama, inicio, Clientes): si algo
 * cambia aquí, cambia para todas.
 */

import { revisarAccesos, tieneMembresia } from './accesos';
import { diaDe } from './metricas';
import { tipoDeOrigen } from './origenes';
// Solo tipos: plantillas-campana arrastra las plantillas de correo y no puede
// acabar en el navegador por culpa de este archivo.
import type { IdAutomatizacion } from './automatizaciones';
import type { Campana } from './plantillas-campana';
import type { Vista } from './plataforma';

/* ==========================================================================
   Estados, grupos y motivos
   ========================================================================== */

/** Los estados que guarda la ficha. Lo que mueve Sorela a mano. */
export const ESTADOS = ['Nuevo', 'Contactado', 'En conversación', 'Cerrado', 'Descartado'] as const;
export type Estado = (typeof ESTADOS)[number];

/**
 * Los siete sitios donde puede estar una persona, en el orden en que se
 * enseñan. «Te necesita» y «lista» no se excluyen en la vida real (quien está
 * en la lista y además escribe sigue recibiendo la serie), pero cada persona
 * sale en UN grupo: el de lo que toca hacer. La serie se dice con `enLista`.
 */
export const GRUPOS = ['te-necesita', 'avisar', 'lista', 'sin-correos', 'hablando', 'cerrado', 'descartado'] as const;
export type Grupo = (typeof GRUPOS)[number];

/** Por qué te necesita alguien. El orden es la prioridad: gana el primero que se cumple. */
export const MOTIVOS = ['marcada', 'reserva', 'mensaje', 'pregunta', 'formacion', 'cita', 'a-mano', 'correo-no-llego'] as const;
export type Motivo = (typeof MOTIVOS)[number];

/** Qué pasó con su correo de la lista, cuando el motivo es `correo-no-llego`. */
export type FalloCorreo = 'rebotado' | 'spam' | 'fallido' | 'antiguo';

/* ==========================================================================
   Lo que se lee de la ficha y lo que se escribe en ella
   ========================================================================== */

/**
 * El correo de la lista que se le mandó (campo `correoLista` de la ficha).
 * Lo escriben `mandarInformacion`, `alRegistrarse`, `enviarCampana` con la
 * plantilla `lista-espera` y el reenvío a mano, SIEMPRE con
 * `marcarCorreoLista` (lib/atencion-servidor.ts).
 *
 * `informacion` es la bienvenida antigua, la de antes del 13 de octubre por la
 * noche: no lleva el grupo de WhatsApp, así que cuenta como «no le llegó».
 */
export type PlantillaLista = 'lista-espera' | 'reserva' | 'informacion';
export type PorCorreoLista = 'bienvenida' | 'registro' | 'campana' | 'a-mano';
export type CorreoLista = {
  plantilla: PlantillaLista;
  estado: 'enviado' | 'fallido';
  por: PorCorreoLista;
  /** Timestamp en Firestore; ISO en el JSON de la API. */
  cuando: unknown;
  /** Lo que contó el servicio de correo después: `entregado`, `rebotado`, `spam`… */
  entrega?: string | null;
};

/** Un rebote o una queja de spam de CUALQUIER correo suyo (campo `correoMal`). */
export type CorreoMal = { entrega: 'rebotado' | 'spam'; cuando: unknown };

/**
 * Lo que la regla lee de una ficha de `contactos`. Vale el documento de
 * Firestore tal cual o el JSON de la API: las fechas pueden ser Timestamp,
 * Date, ISO o `{ seconds }`, y todo lo demás se trata como `unknown` porque
 * hay fichas de todas las épocas (7 de 10 no tienen ni `estado`).
 */
export type DatosAtencion = {
  correo?: unknown;
  ciudad?: unknown;
  estado?: unknown;
  /** Cuándo cambió `estado` por última vez (lo pone el PATCH de /api/contactos). */
  estadoCambiado?: unknown;
  /** Por dónde entró la primera vez. No cambia aunque vuelva a escribir. */
  origen?: unknown;
  /**
   * Lo que ha pedido y cuándo: `{ 'lista-comunidad': ts, 'contacto': ts }`.
   * Lo escriben /api/captar y /api/registro en cada envío. Las fichas
   * antiguas no lo tienen: entonces cuenta su origen, en su fecha de alta.
   */
  pidio?: Record<string, unknown> | null;
  /** La nota del primer formulario. En un alta a mano la escribió Sorela. */
  nota?: unknown;
  /** La nota del último envío que traía una, y desde qué formulario. No pisa `nota`. */
  ultimaNota?: unknown;
  ultimaNotaOrigen?: unknown;
  /** Las notas de seguimiento de Sorela. Cada una cuenta como «hiciste algo». */
  seguimiento?: { cuando?: unknown }[] | null;
  aMano?: unknown;
  pidioInformacion?: unknown;
  /** «Marcar para escribirle»: lo pone el PATCH y lo borra cualquier estado o nota. */
  pendiente?: unknown;
  pendienteDesde?: unknown;
  lista?: unknown;
  creado?: unknown;
  correoLista?: Partial<CorreoLista> | null;
  correoMal?: Partial<CorreoMal> | null;
};

/** Una convocatoria con fecha que contar: publicada, abierta y que no ha terminado. */
export type ConvocatoriaAbierta = { id: string; ciudad: string; inicio: string; fin: string };

/**
 * Lo de fuera de la ficha. Lo monta UNA función de servidor
 * (`contextoAtencion`, lib/atencion-servidor.ts) con `contextoDesde`.
 */
export type ContextoAtencion = {
  /** Su correo está en `correos_bajas` (enlace de baja, registro sin novedades, rebote o spam). */
  deBaja: boolean;
  /** Ya tiene la Comunidad: no espera la apertura. */
  miembro: boolean;
  /** Convocatorias publicadas, abiertas y con fin ≥ hoy (Madrid), de la más próxima a la más lejana. */
  convocatorias: ConvocatoriaAbierta[];
  /** id → ciudad de TODAS las convocatorias, para el texto de una reserva. */
  ciudades: Record<string, string>;
};

/** Lo que hace falta para escribir el motivo con sus datos («Pidió plaza en Vigo»). */
export type DatoMotivo = {
  /** El formulario que lo disparó, sin tildes y en minúsculas. */
  origen?: string;
  /** `reserva`: la ciudad de la convocatoria; null si ya no existe. */
  ciudad?: string | null;
  /** `mensaje`: lo que escribió, y si es una pregunta o vino del formulario de contacto. */
  nota?: string;
  pregunta?: boolean;
  desdeContacto?: boolean;
  /** `formacion`: la convocatoria que contarle. */
  convocatoria?: ConvocatoriaAbierta;
  /** `correo-no-llego`: qué pasó. */
  fallo?: FalloCorreo;
};

export type Situacion = {
  grupo: Grupo;
  /** Solo en `te-necesita`. */
  motivo: Motivo | null;
  /** Los datos del motivo para escribirlo con palabras; null sin motivo. */
  dato: DatoMotivo | null;
  /**
   * Desde cuándo (ISO): en `te-necesita`, el cuándo de su motivo (lo que
   * cuenta «Esperando N días»); en la lista, cuándo entró; en `avisar`, cuándo
   * lo pidió; en `hablando`, tu última acción; en cerrado y descartado, el
   * cambio de estado; en `sin-correos`, el alta.
   */
  desde: string | null;
  /** El estado guardado, ya normalizado (vacío o raro = Nuevo). */
  estado: Estado;
  /** Recibe (o recibirá) la serie de la masterclass: en la lista, sin baja y sin membresía. */
  enLista: boolean;
  deBaja: boolean;
  /**
   * La nota que dejó en la web cuando NO es un mensaje para Sorela: casi
   * siempre la respuesta a «¿Qué necesitarías tener ahí dentro?» de la lista
   * («Le gustaría encontrar: …»). Se enseña en su fila, sin urgencia.
   */
  notaLista: string | null;
};

/* ==========================================================================
   Textos
   ========================================================================== */

/** El título de cada grupo, en plural, como columna o franja. */
export const TITULO_GRUPO: Record<Grupo, string> = {
  'te-necesita': 'Te necesitan',
  avisar: 'Esperan un aviso',
  lista: 'En la lista de espera',
  'sin-correos': 'Sin correos',
  hablando: 'Hablando',
  cerrado: 'Cerrado',
  descartado: 'Descartado',
};

/** La pastilla de una persona, en singular. Las clases van en situacion.module.css. */
export const PASTILLA_GRUPO: Record<Grupo, string> = {
  'te-necesita': 'Te necesita',
  avisar: 'Espera un aviso',
  lista: 'Lista de espera',
  'sin-correos': 'Sin correos',
  hablando: 'Hablando',
  cerrado: 'Cerrado',
  descartado: 'Descartado',
};

/**
 * Una frase por grupo, para la franja, la ficha y el glosario del informe.
 * La de la lista dice lo que más importa: que no hay que hacer nada.
 */
export const EXPLICA_GRUPO: Record<Grupo, string> = {
  'te-necesita': 'Te ha escrito o pedido algo concreto después de la última vez que hiciste algo con ella.',
  avisar: 'Pidió que la avises cuando haya terapeuta, o fecha, en su ciudad. No hay nada que hacer hasta entonces.',
  lista: 'Les llegan solos los correos de la masterclass. No tienes que hacer nada.',
  'sin-correos': 'Se dio de baja o no está en ninguna lista, y no espera nada de ti.',
  hablando: 'Ya les has escrito.',
  cerrado: 'Compraron o reservaron.',
  descartado: 'Ya no les llegan los correos.',
};

/**
 * Lo que se lee en el selector de estado de la ficha. Cambia el texto, no el
 * valor guardado: no se migra ninguna ficha.
 */
export const ESTADO_VISIBLE: Record<Estado, string> = {
  Nuevo: 'Sin hablar todavía',
  Contactado: 'Le has escrito',
  'En conversación': 'En conversación',
  Cerrado: 'Cerrado: compró o reservó',
  Descartado: 'Descartado: ya no le llegan los correos',
};

/** El motivo en pocas palabras, sin sus datos. Con datos: `textoMotivo`. */
export const MOTIVO_CORTO: Record<Motivo, string> = {
  marcada: 'La marcaste para escribirle',
  reserva: 'Pidió plaza',
  mensaje: 'Te escribió',
  pregunta: 'Dejó sus datos en el asistente de la web',
  formacion: 'Quiere formarse: ya hay fecha',
  cita: 'Quiere que la trates',
  'a-mano': 'La apuntaste tú: nadie más le escribirá',
  'correo-no-llego': 'No le llegó su correo',
};

/** Qué hacer, sin sus datos (para la ficha y Pendiente). Con datos: `textoMotivo`. */
export const QUE_HACER: Record<Motivo, string> = {
  marcada: 'Escríbele y pulsa «Ya le escribí».',
  reserva: 'Confírmale la plaza y el pago en Formaciones.',
  mensaje: 'Léelo y contéstale.',
  pregunta: 'No sabemos qué buscaba: escríbele y pregúntaselo.',
  formacion: 'Cuéntale la próxima fecha.',
  cita: 'Dale cita o recomiéndale una terapeuta.',
  'a-mano': 'Escríbele tú: no le llega ningún correo.',
  'correo-no-llego': 'Mándale el correo de la lista o escríbele por WhatsApp.',
};

/** Qué pasó con su correo, para «No le llegó su correo (rebotó)». */
export const FALLO_CORREO: Record<FalloCorreo, string> = {
  rebotado: 'rebotó',
  spam: 'lo marcó como spam',
  fallido: 'no salió',
  antiguo: 'le llegó el antiguo, sin el grupo de WhatsApp',
};

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** «Vigo, 24–25 oct»: la convocatoria en el espacio de una línea. */
export function convocatoriaCorta(c: Pick<ConvocatoriaAbierta, 'ciudad' | 'inicio' | 'fin'>): string {
  const [, mi, di] = c.inicio.split('-').map(Number);
  const [, mf, df] = (c.fin || c.inicio).split('-').map(Number);
  if (!mi || !di) return c.ciudad;
  const dias =
    !mf || !df || (mi === mf && di === df)
      ? `${di} ${MESES_CORTOS[mi - 1]}`
      : mi === mf
        ? `${di}–${df} ${MESES_CORTOS[mf - 1]}`
        : `${di} ${MESES_CORTOS[mi - 1]}–${df} ${MESES_CORTOS[mf - 1]}`;
  return c.ciudad ? `${c.ciudad}, ${dias}` : dias;
}

const comillas = (t: string, max = 140) => `«${t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t}»`;

/**
 * El motivo con sus datos: el texto corto de la tarjeta, qué hacer (ficha y
 * Pendiente) y un detalle opcional (la nota entre comillas, qué pasó con el
 * correo). Sin motivo devuelve null.
 */
export function textoMotivo(s: Pick<Situacion, 'motivo' | 'dato'>): { corto: string; queHacer: string; detalle: string | null } | null {
  if (!s.motivo) return null;
  const d = s.dato ?? {};
  switch (s.motivo) {
    case 'reserva':
      return {
        corto: d.ciudad ? `Pidió plaza en ${d.ciudad}` : 'Pidió plaza en una formación',
        queHacer: QUE_HACER.reserva,
        detalle: null,
      };
    case 'mensaje':
      return {
        // «Te escribió» si vino del formulario de contacto; «Te preguntó» si es una pregunta en otro formulario.
        corto: d.desdeContacto || !d.pregunta ? 'Te escribió' : 'Te preguntó',
        queHacer: QUE_HACER.mensaje,
        detalle: d.nota ? comillas(d.nota) : null,
      };
    case 'formacion':
      return {
        corto: MOTIVO_CORTO.formacion,
        queHacer: d.convocatoria ? `Cuéntale la próxima: ${convocatoriaCorta(d.convocatoria)}.` : QUE_HACER.formacion,
        detalle: null,
      };
    case 'correo-no-llego':
      return {
        corto: MOTIVO_CORTO['correo-no-llego'],
        queHacer: QUE_HACER['correo-no-llego'],
        detalle: d.fallo ? FALLO_CORREO[d.fallo] : null,
      };
    default:
      return { corto: MOTIVO_CORTO[s.motivo], queHacer: QUE_HACER[s.motivo], detalle: null };
  }
}

/**
 * El motivo con el nombre delante, para el inicio, Pendiente y el resumen:
 * «Ana te escribió», «Lucía pidió plaza en Vigo», «A Flor no le llegó su
 * correo». Cada motivo pide su gramática; pegar el nombre delante del texto
 * corto daba «Flor no le llegó su correo».
 */
export function fraseConNombre(nombre: string, s: Pick<Situacion, 'motivo' | 'dato'>): string {
  const t = textoMotivo(s);
  if (!s.motivo || !t) return nombre;
  switch (s.motivo) {
    case 'marcada':
      return `Marcaste a ${nombre} para escribirle`;
    case 'a-mano':
      return `Apuntaste tú a ${nombre}: nadie más le escribirá`;
    case 'correo-no-llego':
      return `A ${nombre} no le llegó su correo`;
    case 'pregunta':
      return `${nombre} dejó sus datos en el asistente de la web`;
    default:
      return `${nombre} ${t.corto.charAt(0).toLowerCase()}${t.corto.slice(1)}`;
  }
}

/**
 * El botón de la tarjeta (todos mandan PATCH `{ id, estado: 'Contactado' }`).
 * En la lista, sin motivo, no hay botón: no hay nada que hacer.
 */
export function botonDe(s: Pick<Situacion, 'grupo' | 'motivo'>): 'Ya le contesté' | 'Ya le escribí' | 'Ya la avisé' | null {
  if (s.grupo === 'avisar') return 'Ya la avisé';
  if (s.grupo !== 'te-necesita') return null;
  return s.motivo === 'mensaje' || s.motivo === 'pregunta' ? 'Ya le contesté' : 'Ya le escribí';
}

/* ==========================================================================
   Fechas
   ========================================================================== */

/**
 * Una fecha de donde venga: Timestamp de Firestore (`toDate`), Date, ISO,
 * milisegundos o el `{ seconds }` / `{ _seconds }` en que se convierte un
 * Timestamp al pasar por JSON. Null si no vale.
 */
export function aFecha(x: unknown): Date | null {
  if (x == null || x === '') return null;
  let d: Date | null = null;
  if (x instanceof Date) d = x;
  else if (typeof x === 'string' || typeof x === 'number') d = new Date(x);
  else if (typeof x === 'object') {
    const o = x as { toDate?: () => Date; seconds?: unknown; _seconds?: unknown };
    if (typeof o.toDate === 'function') d = o.toDate();
    else if (typeof o.seconds === 'number') d = new Date(o.seconds * 1000);
    else if (typeof o._seconds === 'number') d = new Date(o._seconds * 1000);
  }
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const aISO = (d: Date | null) => (d ? d.toISOString() : null);
const masNueva = (fechas: (Date | null)[]) =>
  fechas.reduce<Date | null>((a, b) => (b && (!a || b.getTime() > a.getTime()) ? b : a), null);

/** El día de España, «2026-10-14». El mismo que usan el cron y las campañas. */
export const hoyMadrid = (ahora = new Date()) => diaDe(ahora);

const diaUTC = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const sumarDias = (dia: string, n: number) => new Date(diaUTC(dia) + n * 86_400_000).toISOString().slice(0, 10);
const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Días de calendario en Madrid entre `desde` y `ahora`. Con las horas
 * redondeadas, quien entró ayer a las 23:00 llevaba «0 días» a las 9:00, y una
 * cuenta atrás salía con un día de más.
 */
export function diasEsperando(desde: unknown, ahora: Date = new Date()): number {
  const d = aFecha(desde);
  if (!d) return 0;
  return Math.max(0, Math.round((diaUTC(diaDe(ahora)) - diaUTC(diaDe(d))) / 86_400_000));
}

/**
 * La hora del cron de cada mañana (vercel.json: `30 6 * * *`). Va en UTC, así
 * que en Madrid son las 8:30 hasta el sábado 24 de octubre y las 7:30 desde
 * el domingo 25, el día del cambio de hora.
 */
export const HORA_ENVIO_UTC = '06:30';

/** La hora de Madrid a la que llama el cron ese día: «08:30» o «07:30». Vacío si el día no vale. */
export function horaDeEnvio(dia: string): string {
  if (!DIA_VALIDO.test(dia)) return '';
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(`${dia}T${HORA_ENVIO_UTC}:00Z`)
  );
}

/** «08:30» → «8:30», como se dice en voz alta. */
export const horaCorta = (hora: string) => hora.replace(/^0(\d)/, '$1');

/** «vie 16 oct». El día va en hora de España (es una fecha sin hora, «2026-10-16»). */
export function fechaCorta(dia: string): string {
  if (!DIA_VALIDO.test(dia)) return dia;
  const f = new Date(diaUTC(dia));
  return `${DIAS_CORTOS[f.getUTCDay()]} ${f.getUTCDate()} ${MESES_CORTOS[f.getUTCMonth()]}`;
}

/**
 * Cuándo sale algo del cron ese día, listo para pintar. Siempre «desde las»
 * y nunca «a las»: Vercel llama con 10 a 20 minutos de retraso (06:44 UTC los
 * días 13 y 14), y prometer una hora exacta que no se cumple es peor que no
 * decirla.
 */
export function cuandoSale(dia: string): { dia: string; hora: string; texto: string } {
  const hora = horaDeEnvio(dia);
  return { dia, hora, texto: hora ? `${fechaCorta(dia)}, desde las ${horaCorta(hora)}` : fechaCorta(dia) };
}

/** La pasada diaria: a qué hora sale hoy y, si va a cambiar pronto (cambio de hora), desde qué día. */
export type EnvioDiario = { utc: typeof HORA_ENVIO_UTC; hoy: string; cambia: { dia: string; hora: string } | null };

export function envioDiario(hoy: string, dias = 60): EnvioDiario {
  const ahora = horaDeEnvio(hoy);
  for (let i = 1; i <= dias && ahora; i++) {
    const dia = sumarDias(hoy, i);
    const hora = horaDeEnvio(dia);
    if (hora !== ahora) return { utc: HORA_ENVIO_UTC, hoy: ahora, cambia: { dia, hora } };
  }
  return { utc: HORA_ENVIO_UTC, hoy: ahora, cambia: null };
}

/* ==========================================================================
   La regla
   ========================================================================== */

const sinTildes = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** El estado guardado, o Nuevo si está vacío o es raro (7 de cada 10 fichas antiguas no lo tienen). */
export const estadoDe = (v: Pick<DatosAtencion, 'estado'>): Estado =>
  (ESTADOS as readonly string[]).includes(v.estado as string) ? (v.estado as Estado) : 'Nuevo';

/**
 * Si un contacto está en la lista de espera: la misma condición que usa
 * `listaDeEspera` (lib/automatizar.ts) para mandar la serie, SIN mirar bajas
 * (eso va en el contexto: un rebote da de baja, y aun así hay que saber que
 * era de la lista para avisar de que no le llegó).
 *
 * - Mira `lista` y el origen, NO la etiqueta que le ponga Sorela a mano
 *   (`tipoManual`): reclasificar a alguien no puede sacarla de la serie sin
 *   avisar.
 * - NO mira `comercial`. La casilla de novedades habla de las próximas
 *   formaciones, y la serie no anuncia ninguna. Decisión de Sorela: todas
 *   las de la lista reciben la serie de la masterclass, también quien la
 *   dejó sin marcar (Flor).
 * - NO mira Cerrado: las alumnas que entran con su enlace siguen en la serie;
 *   la Comunidad es para ellas.
 */
export const enListaDeEspera = (v: DatosAtencion): boolean =>
  Boolean(v.correo) &&
  (v.lista === true || tipoDeOrigen(typeof v.origen === 'string' ? v.origen : null) === 'comunidad') &&
  v.estado !== 'Descartado' &&
  // Apuntada a mano sin haber pedido la información: no se le escribe (art. 21 LSSI).
  !(v.aMano && !v.pidioInformacion);

/** Lo que la regla lee de una cuenta de `usuarios`. */
export type DatosUsuario = {
  uid?: string;
  correo?: unknown;
  nombre?: unknown;
  altaPor?: unknown;
  accesos?: unknown;
  quiereComunidad?: unknown;
  pide?: unknown;
  bloqueada?: unknown;
};

/** Una cuenta en la lista de espera: pidió la Comunidad (o pulsó «Quiero ser parte») y todavía no la tiene. */
export const usuarioEnLista = (u: DatosUsuario): boolean =>
  Boolean(u.correo) && Boolean(u.quiereComunidad || u.pide === 'comunidad') && !tieneMembresia(revisarAccesos(u.accesos));

/**
 * Lo que pidió y cuándo, sin tildes y en minúsculas. Las fichas antiguas, sin
 * `pidio`, cuentan con su origen en la fecha de alta: es lo único que se sabe.
 */
export function peticiones(v: Pick<DatosAtencion, 'pidio' | 'origen' | 'creado'>): [string, Date | null][] {
  const p = v.pidio && typeof v.pidio === 'object' ? Object.entries(v.pidio) : [];
  const lista = p.map(([o, t]) => [sinTildes(o), aFecha(t)] as [string, Date | null]).filter(([o]) => o);
  const o = sinTildes(v.origen);
  if (o && !lista.some(([x]) => x === o)) lista.push([o, aFecha(v.creado)]);
  return lista;
}

/** De todas las peticiones que cumplen algo, la más reciente: es la que dice si sigue viva. */
function ultimaQue(pet: [string, Date | null][], cumple: (o: string) => boolean): [string, Date | null] | null {
  let mejor: [string, Date | null] | null = null;
  for (const p of pet) {
    if (!cumple(p[0])) continue;
    if (!mejor || (p[1] && (!mejor[1] || p[1].getTime() > mejor[1].getTime()))) mejor = p;
  }
  return mejor;
}

/** Los formularios de formación que prometen «te escribo en cuanto abra la próxima fecha». */
const FORMACION = new Set(['formacion', 'formacion-base', 'formacion-avanzado', 'formacion-a-mano', 'formacion-asistente', 'formacion-precio']);
const PREFIJO_RESERVA = 'formacion-conv-';

/**
 * La nota que dejó ELLA en la web, y desde qué formulario. `ultimaNota` la
 * escribe /api/captar y siempre es suya. `nota` es la del primer formulario,
 * salvo en un alta a mano: ahí la escribió Sorela al apuntarla (POST
 * /api/contactos), así que no es un mensaje de nadie.
 */
function notaDeLaWeb(v: DatosAtencion): { texto: string; origen: string } | null {
  const ultima = typeof v.ultimaNota === 'string' ? v.ultimaNota.trim() : '';
  if (ultima) return { texto: ultima, origen: sinTildes(v.ultimaNotaOrigen) };
  const nota = typeof v.nota === 'string' ? v.nota.trim() : '';
  if (nota && !v.aMano) return { texto: nota, origen: sinTildes(v.origen) };
  return null;
}

/**
 * Una nota es un mensaje para Sorela solo si viene del formulario de contacto
 * o lleva una pregunta. El campo de la lista pregunta «¿Qué necesitarías tener
 * ahí dentro?»: es una encuesta, y contarla como mensaje volvería a llenar
 * «Te necesitan» con cientos de altas antes del 6 de noviembre.
 */
const esMensaje = (n: { texto: string; origen: string }) => n.origen === 'contacto' || /[?¿]/.test(n.texto);

export type MotivoConFecha = { motivo: Motivo; cuando: Date | null; dato: DatoMotivo | null };

/**
 * Todos los motivos que se cumplen, en orden de prioridad, cada uno con su
 * cuándo. Sin mirar si Sorela ya hizo algo después: eso lo decide `situacion`.
 */
export function motivosDe(v: DatosAtencion, ctx: ContextoAtencion): MotivoConFecha[] {
  const estado = estadoDe(v);
  const pet = peticiones(v);
  const cuandoDe = (origen: string) => pet.find(([o]) => o === origen)?.[1] ?? null;
  const salida: MotivoConFecha[] = [];

  // 0. La marcó ella. Gana siempre, salvo que la haya descartado.
  if (v.pendiente === true && estado !== 'Descartado') {
    salida.push({ motivo: 'marcada', cuando: aFecha(v.pendienteDesde), dato: null });
  }

  // 1. Pidió plaza en una fecha concreta (con plaza o sin ella: hay que confirmar y cobrar).
  const reserva = ultimaQue(pet, (o) => o.startsWith(PREFIJO_RESERVA));
  if (reserva) {
    const id = reserva[0].slice(PREFIJO_RESERVA.length);
    // El id de la convocatoria distingue mayúsculas y el origen llega en minúsculas.
    const ciudad = ctx.ciudades[id] ?? Object.entries(ctx.ciudades).find(([k]) => k.toLowerCase() === id)?.[1] ?? null;
    salida.push({ motivo: 'reserva', cuando: reserva[1], dato: { origen: reserva[0], ciudad } });
  }

  // 2. Le escribió algo que espera respuesta.
  const nota = notaDeLaWeb(v);
  if (nota && esMensaje(nota)) {
    const cuando = cuandoDe(nota.origen) ?? masNueva(pet.map(([, t]) => t)) ?? aFecha(v.creado);
    salida.push({
      motivo: 'mensaje',
      cuando,
      dato: { origen: nota.origen, nota: nota.texto, pregunta: /[?¿]/.test(nota.texto), desdeContacto: nota.origen === 'contacto' },
    });
  }

  // 3. Fichas antiguas del asistente, de cuando todas se guardaban como «asistente»: no se sabe qué buscaba.
  const asistente = ultimaQue(pet, (o) => o === 'asistente');
  if (asistente) salida.push({ motivo: 'pregunta', cuando: asistente[1], dato: { origen: 'asistente' } });

  // 4. Quiere formarse y YA hay fecha que contarle. Sin fecha, espera un aviso (ver `situacion`).
  const proxima = ctx.convocatorias[0];
  const formacion = proxima ? ultimaQue(pet, (o) => FORMACION.has(o)) : null;
  const enSuCiudad = ctx.convocatorias.find((c) => sinTildes(c.ciudad) && sinTildes(c.ciudad) === sinTildes(v.ciudad));
  const avisoFormacion = enSuCiudad ? ultimaQue(pet, (o) => o.startsWith('avisar-ciudad-formacion')) : null;
  if (formacion || avisoFormacion) {
    // Si pidió las dos cosas, cuenta la más reciente, con la convocatoria que le toca a esa.
    const t = (p: [string, Date | null] | null) => p?.[1]?.getTime() ?? -1;
    const usaAviso = Boolean(avisoFormacion) && (!formacion || t(avisoFormacion) > t(formacion));
    const [origen, cuando] = (usaAviso ? avisoFormacion : formacion)!;
    salida.push({ motivo: 'formacion', cuando, dato: { origen, convocatoria: usaAviso ? enSuCiudad! : proxima } });
  }

  // 5. Quiere que la traten.
  const cita = ultimaQue(pet, (o) => o.startsWith('cita-'));
  if (cita) salida.push({ motivo: 'cita', cuando: cita[1], dato: { origen: cita[0] } });

  // 6. La apuntó Sorela sin que pidiera información: ningún correo automático le va a escribir.
  if (v.aMano && !v.pidioInformacion) salida.push({ motivo: 'a-mano', cuando: aFecha(v.creado), dato: null });

  // 7. Es de la lista y su correo no le llegó. Sin descontar bajas: un rebote da de baja.
  if (enListaDeEspera(v)) {
    const cl = v.correoLista ?? null;
    const fallos: { fallo: FalloCorreo; cuando: Date | null }[] = [];
    if (cl?.entrega === 'spam' || cl?.entrega === 'rebotado') fallos.push({ fallo: cl.entrega, cuando: aFecha(cl.cuando) });
    else if (cl?.estado === 'fallido') fallos.push({ fallo: 'fallido', cuando: aFecha(cl.cuando) });
    else if (cl?.plantilla === 'informacion') fallos.push({ fallo: 'antiguo', cuando: aFecha(cl.cuando) });
    const mal = v.correoMal ?? null;
    if (mal) fallos.push({ fallo: mal.entrega === 'spam' ? 'spam' : 'rebotado', cuando: aFecha(mal.cuando) });
    if (fallos.length) {
      const ultimo = fallos.reduce((a, b) => (b.cuando && (!a.cuando || b.cuando > a.cuando) ? b : a));
      salida.push({ motivo: 'correo-no-llego', cuando: ultimo.cuando, dato: { fallo: ultimo.fallo } });
    }
  }
  // Una ficha sin `correoLista` es «no consta», no «no le llegó»: así no salen falsas alarmas.

  return salida;
}

/**
 * Lo último que hizo Sorela con ella: su última nota de seguimiento o, si no
 * está en Nuevo, el último cambio de estado.
 *
 * Un estado puesto sin fecha (el registro con enlace pone Cerrado sin
 * `estadoCambiado`) se toma como puesto al crear la ficha: lo que pidió
 * entonces ya está atendido, y lo que pida después, no. Sin esto, una alumna
 * que ya pagó saldría en «Te necesitan» por el formulario de formación que
 * rellenó antes de entrar.
 */
export function ultimaAccion(v: DatosAtencion): Date | null {
  const notas = Array.isArray(v.seguimiento) ? v.seguimiento.map((n) => aFecha(n?.cuando)) : [];
  const cambio = estadoDe(v) !== 'Nuevo' ? (aFecha(v.estadoCambiado) ?? aFecha(v.creado)) : null;
  return masNueva([...notas, cambio]);
}

/**
 * Cuándo entró en la lista: su primera petición; si no consta, el alta. Es
 * la fecha que hay que pasar a `progresoSerie` (no `situacion.desde`, que en
 * «Te necesita» es la de su motivo).
 */
export function entradaEnLista(v: Pick<DatosAtencion, 'pidio' | 'origen' | 'creado'>): Date | null {
  const primera = peticiones(v)
    .map(([, t]) => t)
    .reduce<Date | null>((a, b) => (b && (!a || b.getTime() < a.getTime()) ? b : a), null);
  return primera ?? aFecha(v.creado);
}

/** Pidió un aviso de ciudad, o quiere formarse y no hay fecha que darle (o no la hay en su ciudad). */
const esperaAviso = (pet: [string, Date | null][]) =>
  ultimaQue(pet, (o) => o.startsWith('avisar-ciudad') || o === 'terapeutas' || FORMACION.has(o));

/**
 * Dónde está una persona y por qué. La regla, en este orden:
 *
 *  1. Estado: el guardado si es uno de `ESTADOS`; si no, Nuevo.
 *  2. Lo último que hizo Sorela con ella (`ultimaAccion`).
 *  3. Los motivos, cada uno con su cuándo. `marcada` gana siempre.
 *  4. Te necesita si algún motivo es POSTERIOR a lo último que hizo Sorela
 *     (sin acción, cualquiera vale), sea cual sea su columna: quien estaba
 *     Cerrada y pide plaza en otra fecha vuelve a necesitarte.
 *  5. Si no: Descartado, Cerrado, o Hablando (Contactado / En conversación).
 *  6. Nuevo con un motivo que ya atendió (una nota, un botón): Hablando.
 *  7. Sin motivo: espera un aviso; si no, en la lista de espera (sin baja ni
 *     membresía); si no, sin correos.
 */
export function situacion(v: DatosAtencion, ctx: ContextoAtencion): Situacion {
  const estado = estadoDe(v);
  const pet = peticiones(v);
  const enLista = enListaDeEspera(v) && !ctx.deBaja && !ctx.miembro;
  const nota = notaDeLaWeb(v);
  const base = { estado, enLista, deBaja: ctx.deBaja, notaLista: nota && !esMensaje(nota) ? nota.texto : null };
  const motivos = motivosDe(v, ctx);
  const accion = ultimaAccion(v);

  const marcada = motivos.find((m) => m.motivo === 'marcada');
  const vivo = marcada ?? motivos.find((m) => !accion || (m.cuando !== null && m.cuando.getTime() > accion.getTime()));
  if (vivo) return { ...base, grupo: 'te-necesita', motivo: vivo.motivo, dato: vivo.dato, desde: aISO(vivo.cuando) };

  const sinMotivo = { ...base, motivo: null, dato: null };
  if (estado === 'Descartado') return { ...sinMotivo, grupo: 'descartado', desde: aISO(aFecha(v.estadoCambiado)) };
  if (estado === 'Cerrado') return { ...sinMotivo, grupo: 'cerrado', desde: aISO(aFecha(v.estadoCambiado)) };
  if (estado !== 'Nuevo') return { ...sinMotivo, grupo: 'hablando', desde: aISO(accion) };
  // Hubo motivo y Sorela ya hizo algo después: estáis hablando, aunque no haya cambiado el estado.
  if (motivos.length) return { ...sinMotivo, grupo: 'hablando', desde: aISO(accion) };

  const aviso = esperaAviso(pet);
  if (aviso) return { ...sinMotivo, grupo: 'avisar', desde: aISO(aviso[1] ?? aFecha(v.creado)) };
  if (enLista) return { ...sinMotivo, grupo: 'lista', desde: aISO(entradaEnLista(v)) };
  return { ...sinMotivo, grupo: 'sin-correos', desde: aISO(aFecha(v.creado)) };
}

/** Todos los grupos a cero: la base de `cuentas` y de `personas`. */
export const gruposACero = (): Record<Grupo, number> =>
  Object.fromEntries(GRUPOS.map((g) => [g, 0])) as Record<Grupo, number>;

/** Cuántas hay en cada grupo. */
export function contarGrupos(lista: Iterable<Pick<Situacion, 'grupo'>>): Record<Grupo, number> {
  const c = gruposACero();
  for (const s of lista) c[s.grupo]++;
  return c;
}

/* ==========================================================================
   El contexto, a partir de lo que se lee de Firestore
   ========================================================================== */

/** Lo que se lee de una convocatoria para el contexto (el documento, con su id). */
export type DatosConvocatoria = { id: string; publicada?: unknown; abierta?: unknown; ciudad?: unknown; inicio?: unknown; fin?: unknown };

/**
 * El contexto de cada persona, listo para preguntar por correo:
 * `ctx(correo)` da su `ContextoAtencion`, y el resto de campos sirve a quien
 * necesita las cifras de conjunto (bajas, miembros, la lista de las cuentas)
 * sin volver a leerlas.
 */
export type Contextos = ((correo: unknown) => ContextoAtencion) & {
  readonly hoy: string;
  /** Correos de baja, en minúsculas. */
  readonly bajas: ReadonlySet<string>;
  /** Correos con la Comunidad, en minúsculas. */
  readonly miembros: ReadonlySet<string>;
  /** Las cuentas por correo (en minúsculas), con el uid en `uid`. */
  readonly usuarios: ReadonlyMap<string, DatosUsuario>;
  readonly convocatorias: ConvocatoriaAbierta[];
  readonly ciudades: Record<string, string>;
};

const correoLimpio = (c: unknown) => String(c ?? '').trim().toLowerCase();

/**
 * Monta el contexto con lo leído de `correos_bajas`, `usuarios` y
 * `convocatorias`. Es puro para que las pruebas lo usen con los datos reales
 * sin pasar por el servidor; en la plataforma lo llama `contextoAtencion`.
 */
export function contextoDesde(
  datos: { bajas: Iterable<unknown>; usuarios: Iterable<DatosUsuario>; convocatorias: Iterable<DatosConvocatoria> },
  hoy: string = hoyMadrid()
): Contextos {
  const bajas = new Set<string>();
  for (const b of datos.bajas) {
    const c = correoLimpio(b);
    if (c) bajas.add(c);
  }
  const miembros = new Set<string>();
  const usuarios = new Map<string, DatosUsuario>();
  for (const u of datos.usuarios) {
    const c = correoLimpio(u.correo);
    if (!c) continue;
    usuarios.set(c, u);
    if (tieneMembresia(revisarAccesos(u.accesos))) miembros.add(c);
  }
  const ciudades: Record<string, string> = {};
  const convocatorias: ConvocatoriaAbierta[] = [];
  for (const c of datos.convocatorias) {
    const ciudad = typeof c.ciudad === 'string' ? c.ciudad.trim() : '';
    const inicio = typeof c.inicio === 'string' ? c.inicio.slice(0, 10) : '';
    const fin = typeof c.fin === 'string' && DIA_VALIDO.test(c.fin.slice(0, 10)) ? c.fin.slice(0, 10) : inicio;
    if (c.id) ciudades[c.id] = ciudad;
    // Mismas reglas que la web: «Mostrar en la web» marcado, inscripciones abiertas (por defecto, sí) y sin terminar.
    if (c.publicada === true && c.abierta !== false && DIA_VALIDO.test(inicio) && fin >= hoy) {
      convocatorias.push({ id: c.id, ciudad, inicio, fin });
    }
  }
  convocatorias.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.ciudad.localeCompare(b.ciudad, 'es'));

  const de = (correo: unknown): ContextoAtencion => {
    const c = correoLimpio(correo);
    return { deBaja: bajas.has(c), miembro: miembros.has(c), convocatorias, ciudades };
  };
  return Object.assign(de, { hoy, bajas, miembros, usuarios, convocatorias, ciudades });
}

/* ==========================================================================
   La serie de la masterclass
   ========================================================================== */

/** Las campañas de la serie se llaman `lanzamiento-01-manos` … `lanzamiento-10-hoy`. */
export const PREFIJO_SERIE = 'lanzamiento-';
export const esDeLaSerie = (id: string) => id.startsWith(PREFIJO_SERIE);

/** El asunto sin el hueco del nombre: «Tus manos son tu herramienta más cara, {nombre}» → sin la coma final. */
export const asuntoLimpio = (asunto: string) =>
  asunto
    .replace(/[,\s]*\{nombre\}[,\s]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Lo que hace falta de una campaña para contar la serie. `soloSuDia` no se
 * guarda en Firestore: lo pone quien llama, leyéndolo por `id` de
 * lib/serie-lanzamiento.ts (los correos 09 y 10, «Mañana» y «Hoy a las 19:00»,
 * no pueden salir al día siguiente).
 */
export type CampanaSerie = Pick<Campana, 'id' | 'fecha' | 'estado' | 'asunto' | 'boton'> &
  Partial<Pick<Campana, 'excluir' | 'anadir' | 'resultado'>> & { soloSuDia?: boolean };

/** La serie de un vistazo: lo que necesitan el inicio, Automatizaciones y Clientes. */
export type ResumenSerie = {
  total: number;
  enviadas: number;
  siguiente: { id: string; n: number; fecha: string; hora: string; asunto: string; personas: number } | null;
  /** Programadas que no saldrán hasta que se pegue el enlace del botón (el de Zoom). */
  faltaEnlace: string[];
  /** Las que solo pueden salir su día. */
  soloSuDia: string[];
};

/* La misma regla que lib/plantillas-campana.ts (`faltaEnlace`), que no se
   importa porque arrastra las plantillas de correo. Mira `texto` como
   `datosResumen`: así vale también con el documento de Firestore en crudo. */
const faltaElEnlace = (c: Pick<Campana, 'boton'>) => !!c.boton?.texto && !/^https?:\/\/\S+$/.test(String(c.boton.enlace ?? ''));

/** El último día en que puede salir: su día o el siguiente (lib/campanas.ts), o solo su día. */
const ultimoDia = (c: Pick<CampanaSerie, 'fecha' | 'soloSuDia'>) => (c.soloSuDia ? c.fecha : sumarDias(c.fecha, 1));

/**
 * Cómo va la serie hoy. `lista` son los correos de la lista de espera que la
 * recibirían (sin bajas ni cuentas de prueba): con ellos, el siguiente dice a
 * cuántas personas va, quitando y añadiendo lo que tenga esa campaña a mano.
 */
export function resumenSerie(campanas: readonly CampanaSerie[], hoy: string, lista: readonly string[]): ResumenSerie {
  const serie = campanas.filter((c) => esDeLaSerie(c.id)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  const vivas = serie.filter((c) => c.estado === 'programada' && DIA_VALIDO.test(c.fecha) && ultimoDia(c) >= hoy);
  const sig = vivas[0] ?? null;
  let siguiente: ResumenSerie['siguiente'] = null;
  if (sig) {
    const fuera = new Set((sig.excluir ?? []).map(correoLimpio));
    const a = new Set(lista.map(correoLimpio).filter((c) => c && !fuera.has(c)));
    for (const p of sig.anadir ?? []) {
      const c = correoLimpio(p.correo);
      if (c && !fuera.has(c)) a.add(c);
    }
    siguiente = { id: sig.id, n: serie.indexOf(sig) + 1, fecha: sig.fecha, hora: horaDeEnvio(sig.fecha), asunto: asuntoLimpio(sig.asunto), personas: a.size };
  }
  return {
    total: serie.length,
    enviadas: serie.filter((c) => c.estado === 'enviada').length,
    siguiente,
    faltaEnlace: vivas.filter(faltaElEnlace).map((c) => c.id),
    soloSuDia: serie.filter((c) => c.soloSuDia).map((c) => c.id),
  };
}

/** «Ha recibido N · quedan M». */
export type ProgresoSerie = { recibidos: number; quedan: number };

/**
 * Cuántos correos de la serie ha recibido una persona y cuántos le quedan,
 * contando desde que entró. «Correo N de 10» era falso para quien entra
 * tarde: quien se apunta el 20 de octubre nunca recibirá el del 16.
 *
 * Es la cuenta aproximada, de la lista (sin leer su historial): una campaña
 * enviada cuenta si salió después de que ella entrara. La ficha da la exacta
 * con su historial. De baja, no le queda ninguno.
 */
export function progresoSerie(
  serie: readonly Pick<CampanaSerie, 'id' | 'fecha' | 'estado' | 'resultado'>[],
  entrada: unknown,
  deBaja: boolean
): ProgresoSerie {
  const desde = aFecha(entrada);
  const diaEntrada = desde ? diaDe(desde) : '';
  let recibidos = 0;
  let quedan = 0;
  for (const c of serie) {
    if (!esDeLaSerie(c.id)) continue;
    // Si no se sabe cuándo salió, se toma la hora del cron de su día.
    const salio = aFecha(c.resultado?.cuando) ?? aFecha(`${c.fecha}T${HORA_ENVIO_UTC}:00Z`);
    const yaSalio = c.estado === 'enviada' || (c.estado === 'programada' && (c.resultado?.enviados ?? 0) > 0);
    if (yaSalio && (!desde || !salio || desde.getTime() <= salio.getTime())) recibidos++;
    else if (c.estado === 'programada' && c.fecha >= diaEntrada) quedan++;
  }
  return { recibidos, quedan: deBaja ? 0 : quedan };
}

/**
 * El progreso con palabras, en minúscula para ir detrás de otra cosa
 * («También en la lista · ha recibido 3 de 10»). «N de 10» solo cuando le
 * llegan todos; a quien entró tarde, «ha recibido 1 · quedan 7».
 */
export function textoProgreso(p: ProgresoSerie, total: number): string {
  if (p.quedan === 0 && total > 0 && p.recibidos >= total) return `recibió los ${total} correos`;
  if (p.quedan === 0) return p.recibidos ? `recibió ${p.recibidos} de ${total}` : 'no le queda ningún correo';
  if (p.recibidos + p.quedan === total) return `ha recibido ${p.recibidos} de ${total}`;
  return `ha recibido ${p.recibidos} · quedan ${p.quedan}`;
}

/* ==========================================================================
   El contrato de GET /api/automatizaciones (§3.5 del diseño)
   ========================================================================== */

export type IdFlujo = 'alta-web' | 'lista-espera' | 'registro' | 'formacion' | 'membresia' | 'acuerdo' | 'resumen' | 'bajas';

/**
 * Un paso de un carril. Flecha continua = pasa solo; `clase: 'tu'` (borde de
 * puntos) = lo hace Sorela. El estado se dice siempre con palabras en
 * pantalla, nunca solo con color.
 */
export type Paso = {
  id: string;
  clase: 'disparador' | 'correo' | 'decision' | 'espera' | 'tu' | 'hito' | 'lista' | 'serie';
  titulo: string;
  detalle?: string;
  /** Cuándo pasa, con el texto ya escrito («vie 16 oct, desde las 8:30»): ver `cuandoSale`. */
  cuando?: { dia: string; hora: string; texto: string };
  estado?: 'activo' | 'apagado' | 'programado' | 'enviado' | 'pausado' | 'caducado' | 'falta-enlace' | 'proximo';
  cifras?: {
    personas?: number;
    enviados?: number;
    fallidos?: number;
    omitidos?: number;
    /** null = el servicio de correo no ha confirmado ninguno todavía. */
    entregados?: number | null;
    rebotados?: number;
    texto?: string;
  };
  /** Las ramas de un paso `decision`, cada una con su rótulo («Si pide plaza en una formación»). */
  ramas?: { si: string; pasos: Paso[] }[];
  /** Los correos de un paso `serie`, uno por campaña. */
  correos?: Paso[];
  /** Adónde lleva al pulsarlo (con `irA`, lib/navegar.ts). */
  ir?: { vista: Vista; extra?: Record<string, string> };
  /** «Ver correo»: la automatización cuya vista previa se enseña. */
  previa?: IdAutomatizacion;
  /** Cómo se llega al siguiente: solo (flecha continua) o lo haces tú (de puntos). */
  seguido?: 'solo' | 'tu';
};

export type Flujo = {
  id: IdFlujo;
  titulo: string;
  resumen: string;
  /** El interruptor de su cabecera (PATCH /api/correos `{ id, activa }`); `fijo` = siempre activo. */
  interruptor: { id: IdAutomatizacion; activa: boolean; fijo: boolean } | null;
  pasos: Paso[];
};

/** Las cuatro cifras del inicio. */
export type KpisNegocio = {
  /**
   * `primera` es quien más lleva esperando, con su nombre de pila. `frase` es
   * el motivo ya escrito con el nombre («A Flor no le llegó su correo»,
   * «Lucía pidió plaza en Vigo»): con `motivo` solo no se puede escribir,
   * porque falta el dato (la ciudad, qué pasó con el correo).
   */
  teNecesitan: { n: number; primera: { nombre: string; motivo: Motivo; dias: number; frase?: string } | null };
  lista: { n: number; estaSemana: number; sinCorreoNuevo: number; conNota: number };
  formacion: { convocatoria: ConvocatoriaAbierta | null; inscritas: number; pagadas: number; abono: number; pendientes: number };
  comunidad: { diasParaAbrir: number; miembros: number };
};

export type RespuestaAutomatizaciones = {
  ok: true;
  ahora: string;
  hoy: string;
  kpis: KpisNegocio;
  /** Hoy: `{ 'te-necesita': 0, avisar: 1, lista: 8, 'sin-correos': 0, hablando: 0, cerrado: 1, descartado: 0 }`. */
  personas: Record<Grupo, number>;
  serie: ResumenSerie;
  envioDiario: EnvioDiario;
  /** `conDato` de `total` líneas tienen dato de entrega; `motivo` es el que da `comprobarEntregas` (p. ej. `resend-401`). */
  entregas: { conDato: number; total: number; motivo: string | null };
  /** Vacío con `?solo=lista-espera` salvo el carril de la lista. */
  flujos: Flujo[];
};

/* ==========================================================================
   Lo que añade GET /api/contactos a cada contacto (§4.1 del diseño)
   ========================================================================== */

/** Los campos que se suman a cada contacto de la lista de Clientes. */
export type AtencionContacto = {
  situacion: Situacion;
  /** Solo si recibe la serie (`situacion.enLista`). */
  serie: ProgresoSerie | null;
  /** Cuenta de prueba del equipo: se ve, con su pastilla, pero no cuenta en ninguna cifra. */
  prueba: boolean;
  pendiente: boolean;
  ultimaNota: string | null;
  notaLista: string | null;
};

/** Lo que va arriba de la respuesta, junto a `contactos`. */
export type AtencionResumen = { serie: ResumenSerie; cuentas: Record<Grupo, number> };
