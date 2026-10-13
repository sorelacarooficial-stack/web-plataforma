import { nombreDePagina } from './informe-paginas';

/**
 * El informe de métricas: QUÉ dice, separado de CÓMO se pinta.
 *
 *   · lib/informe-datos.ts  lee Firestore y rellena `DatosInforme`.
 *   · Este archivo          saca de esos datos las cuentas (medias, mejor
 *                           día, a qué hora…) y escribe los textos: «Qué
 *                           significa», «Qué haría yo» y el resumen.
 *   · lib/informe-pdf.ts    lo pinta en un PDF.
 *
 * Los textos son REGLAS sobre los datos, no inteligencia artificial: cada
 * frase sale de una cifra que está en el informe y se puede comprobar. Si un
 * dato no existe, la frase no se escribe; nunca se rellena con algo
 * inventado. Están en lenguaje llano porque los lee Sorela, no una analista.
 *
 * Aquí no hay datos de ninguna persona concreta: todo llega ya sumado. Sin
 * nada de servidor dentro, para poder probarlo a solas.
 */

export type Par = [string, number];
export type Periodo = 7 | 30 | 90 | 'todo';

export type DiaWeb = { dia: string; vistas: number; visitas: number; personas: number; reproducciones: number; segundosVideo: number };
export type TotalesWeb = Omit<DiaWeb, 'dia'>;
export type VideoWeb = { nombre: string; ruta: string; reproducciones: number; c25: number; c50: number; c75: number; c100: number; segundos: number };
export type Semana = { semana: string; contactos: number; cuentas: number; acuerdos: number };

export type DatosInforme = {
  periodo: Periodo;
  /** Cuándo se sacó, en ISO. */
  generado: string;
  /** El día de hoy en España, `2026-10-13`. */
  hoy: string;
  /** Los días que cubre (para la web: en «desde el inicio», desde que hay medidor). */
  rango: { desde: string; hasta: string; dias: number };
  /** El periodo con el que se compara; en «desde el inicio» no hay. */
  anterior: { desde: string; hasta: string } | null;
  /** Si los números de la web son los del ordenador de pruebas. */
  prueba: boolean;
  desdeMedidor: string | null;
  web: {
    serie: DiaWeb[];
    totales: TotalesWeb;
    anteriores: TotalesWeb | null;
    rutas: Par[];
    entradas: Par[];
    origenes: Par[];
    paises: Par[];
    ciudades: Par[];
    dispositivos: Par[];
    /** Páginas vistas por hora del día, `{ '09': 12 }`. */
    horas: Record<string, number>;
  };
  /** Los vídeos de la web, desde que se miden (no van por periodo). */
  videos: VideoWeb[];
  contactos: {
    total: number;
    nuevos: number;
    nuevosAntes: number | null;
    /** Contactos nuevos por día, alineados con `web.serie`. */
    porDia: number[];
    porTipo: Par[];
    porOrigen: Par[];
    porFuente: Par[];
    /** Cómo está ahora toda la lista (no solo los nuevos). */
    porEstado: Par[];
    porAtender: number;
    /** Por atender desde hace más de 3 días. */
    porAtenderViejos: number;
    primero: string | null;
  };
  espera: { total: number; nuevas: number; apertura: string };
  cuentas: { total: number; nuevas: number; nuevasAntes: number | null; conCurso: number; conComunidad: number; sinAcceso: number };
  acuerdos: { total: number; nuevos: number; nuevosAntes: number | null; porAprobar: number; sinCorreo: number; descargas: number };
  aula: {
    totalClases: number;
    conAcceso: number;
    activas: number;
    terminadas: number;
    /** Media de clases terminadas sobre el total, de 0 a 100. */
    progresoMedio: number;
    tramos: { sinEmpezar: number; empezando: number; mitad: number; terminado: number };
    lecciones: { titulo: string; empezadas: number; completadas: number; minutosMedios: number }[];
  } | null;
  comunidad: {
    miembros: number;
    publicaciones: number;
    publicacionesAntes: number | null;
    respuestas: number;
    respuestasAntes: number | null;
    meGusta: number;
    participantes: number;
    participantesAntes: number | null;
    deSorela: number;
    sinRespuesta: number;
    porCategoria: Par[];
    totalPublicaciones: number;
  } | null;
  correos: {
    enviadosSiempre: number;
    enviados: number;
    fallidos: number;
    omitidos: number;
    enviadosAntes: number | null;
    porTipo: Par[];
    /** El historial se borra a los 30 días: en periodos más largos solo cuenta lo último. */
    parcial: boolean;
  } | null;
  historia: { semanas: Semana[]; porOrigen: Par[] } | null;
};

/* ------------------------------------------------------------ palabras */

export const PERIODOS: Record<string, { etiqueta: string; archivo: string; anterior: string }> = {
  '7': { etiqueta: 'Últimos 7 días', archivo: '7-dias', anterior: 'los 7 días anteriores' },
  '30': { etiqueta: 'Últimos 30 días', archivo: '30-dias', anterior: 'los 30 días anteriores' },
  '90': { etiqueta: 'Últimos 3 meses', archivo: '3-meses', anterior: 'los 3 meses anteriores' },
  todo: { etiqueta: 'Desde el inicio', archivo: 'desde-el-inicio', anterior: '' },
};
export const sobrePeriodo = (p: Periodo) => PERIODOS[String(p)];

export const num = (n: number) => Math.round(n).toLocaleString('es-ES');
export const decimal = (n: number, d = 1) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: d });
export const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);
export const minutos = (s: number) => (s >= 3600 ? `${decimal(s / 3600)} h` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

const UTC = { timeZone: 'UTC' } as const;
const F_LARGA = new Intl.DateTimeFormat('es-ES', { ...UTC, day: 'numeric', month: 'long', year: 'numeric' });
const F_DIA_MES = new Intl.DateTimeFormat('es-ES', { ...UTC, day: 'numeric', month: 'long' });
const F_SEMANA = new Intl.DateTimeFormat('es-ES', { ...UTC, weekday: 'long', day: 'numeric', month: 'long' });
const F_CORTA = new Intl.DateTimeFormat('es-ES', { ...UTC, day: 'numeric', month: 'short' });
const aFecha = (dia: string) => new Date(`${dia}T12:00:00Z`);
export const fechaLarga = (dia: string) => F_LARGA.format(aFecha(dia));
export const fechaDiaMes = (dia: string) => F_DIA_MES.format(aFecha(dia));
export const fechaConSemana = (dia: string) => F_SEMANA.format(aFecha(dia));
export const fechaCorta = (dia: string) => F_CORTA.format(aFecha(dia)).replace('.', '');

/** `del 14 de septiembre al 13 de octubre de 2026`, sin repetir el año si es el mismo. */
export function deHasta(desde: string, hasta: string) {
  if (desde === hasta) return `el ${fechaLarga(hasta)}`;
  const mismoAno = desde.slice(0, 4) === hasta.slice(0, 4);
  return `del ${mismoAno ? fechaDiaMes(desde) : fechaLarga(desde)} al ${fechaLarga(hasta)}`;
}

/* Lunes primero: es como se piensa la semana en España. */
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const diaSemana = (dia: string) => (aFecha(dia).getUTCDay() + 6) % 7;
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

const PAISES = new Intl.DisplayNames(['es'], { type: 'region' });
export function nombreDePais(cc: string) {
  if (!/^[A-Z]{2}$/.test(cc)) return cc === '—' ? 'Sin dato' : cc;
  try {
    return PAISES.of(cc) ?? cc;
  } catch {
    return cc;
  }
}
export { nombreDePagina };

/** Lo que dice cada tipo de correo, como lo llama la pantalla Correos. */
export const TIPOS_CORREO: Record<string, string> = {
  bienvenida: 'Información al dejar sus datos',
  'acceso-formacion': 'Acceso a la formación',
  'acceso-comunidad': 'Bienvenida a la Comunidad',
  invitacion: 'Enlaces de invitación',
  registro: 'Registro recibido',
  acuerdo: 'Acuerdo firmado',
  'resumen-sorela': 'Tu resumen de la mañana',
  campana: 'Campañas',
  manual: 'Enviados a mano',
  prueba: 'Pruebas',
  'aviso-interno': 'Avisos para ti',
};

/* ------------------------------------------------------------- cambios */

export type Cambio = { tipo: 'sube' | 'baja' | 'igual' | 'nuevo'; p: number } | null;

/** Cuánto ha cambiado respecto al periodo anterior. Sin periodo anterior, null. */
export function cambio(ahora: number, antes: number | null | undefined): Cambio {
  if (antes === null || antes === undefined) return null;
  if (!antes && !ahora) return { tipo: 'igual', p: 0 };
  if (!antes) return { tipo: 'nuevo', p: 0 };
  const p = Math.round(((ahora - antes) / antes) * 100);
  return { tipo: p > 0 ? 'sube' : p < 0 ? 'baja' : 'igual', p: Math.abs(p) };
}

/** «un 23 % más que en los 30 días anteriores», en una frase. */
function comparar(ahora: number, antes: number | null, periodo: Periodo, femenino = true) {
  const c = cambio(ahora, antes);
  const ant = sobrePeriodo(periodo).anterior;
  if (!c || !ant) return '';
  if (c.tipo === 'nuevo') return `; en ${ant} no hubo ${femenino ? 'ninguna' : 'ninguno'}`;
  if (c.tipo === 'igual' || c.p < 3) return `, prácticamente ${ahora === antes ? 'lo mismo' : 'igual'} que en ${ant}`;
  return `, **un ${c.p} % ${c.tipo === 'sube' ? 'más' : 'menos'}** que en ${ant} (${num(antes ?? 0)})`;
}

/* ------------------------------------------------------------- análisis */

export type Analisis = ReturnType<typeof analizar>;

/** Las cuentas que salen de los datos y que usan los textos y las gráficas. */
export function analizar(d: DatosInforme) {
  const w = d.web;
  const t = w.totales;
  const dias = Math.max(1, w.serie.length);
  const conVisitas = w.serie.filter((x) => x.visitas > 0);
  const mejor = conVisitas.reduce<DiaWeb | null>((m, x) => (!m || x.visitas > m.visitas ? x : m), null);

  /* La media de cada día de la semana: un martes con 0 visitas también cuenta. */
  const sumaSemana = Array(7).fill(0);
  const cuantosSemana = Array(7).fill(0);
  for (const x of w.serie) {
    const i = diaSemana(x.dia);
    sumaSemana[i] += x.visitas;
    cuantosSemana[i]++;
  }
  const semana = sumaSemana.map((s, i) => (cuantosSemana[i] ? s / cuantosSemana[i] : 0));
  const mejorSemana = semana.some((v) => v > 0) ? semana.indexOf(Math.max(...semana)) : -1;

  const horas = Array.from({ length: 24 }, (_, h) => Number(w.horas[String(h).padStart(2, '0')]) || 0);
  const pico = horas.some(Boolean) ? horas.indexOf(Math.max(...horas)) : -1;

  const totalOrigen = w.origenes.reduce((s, p) => s + p[1], 0);
  const deFuera = w.origenes.filter((p) => p[0] !== 'Directo');
  const totalDispositivos = w.dispositivos.reduce((s, p) => s + p[1], 0);
  const movil = porcentaje(w.dispositivos.find((p) => p[0] === 'Móvil')?.[1] ?? 0, totalDispositivos);
  const totalPaises = w.paises.reduce((s, p) => s + p[1], 0);
  const totalRutas = w.rutas.reduce((s, p) => s + p[1], 0);

  const videosVistos = d.videos.filter((v) => v.reproducciones > 0);
  const termina = (v: VideoWeb) => Math.min(100, porcentaje(v.c100, v.reproducciones));

  return {
    dias,
    mediaDia: t.visitas / dias,
    mejor,
    sinVisitas: w.serie.length - conVisitas.length,
    paginasPorVisita: t.visitas ? t.vistas / t.visitas : 0,
    semana,
    mejorSemana,
    horas,
    pico,
    totalOrigen,
    origenTop: w.origenes[0] ?? null,
    deFuera,
    directo: w.origenes.find((p) => p[0] === 'Directo')?.[1] ?? 0,
    movil,
    totalDispositivos,
    totalPaises,
    totalRutas,
    videosVistos,
    termina,
    /** De cada 100 personas que entran, cuántas dejan sus datos. */
    tasaContacto: t.personas ? (d.contactos.nuevos / t.personas) * 100 : null,
  };
}

/* ------------------------------------------------------------- textos */

export type IdSeccion =
  | 'visitas'
  | 'cuando'
  | 'llegan'
  | 'quien'
  | 'miran'
  | 'videos'
  | 'contactos'
  | 'espera'
  | 'cuentas'
  | 'aula'
  | 'comunidad'
  | 'correos'
  | 'historia';

/** Un consejo. La prioridad decide cuáles suben al resumen (más alta, antes). */
export type Consejo = { texto: string; prioridad: number };
export type Textos = { significa: string[]; haria: Consejo[] };

const SIN_DATOS_WEB =
  'Vuelve a sacar el informe dentro de unos días: los números se llenan solos a medida que entra gente en la web.';

export function textosDe(d: DatosInforme, a: Analisis): Record<IdSeccion, Textos> {
  const t = d.web.totales;
  const ant = d.web.anteriores;
  const p = d.periodo;
  const hayWeb = t.visitas > 0;

  /* ---------- Visitas ---------- */
  const visitas: Textos = { significa: [], haria: [] };
  visitas.significa.push(
    'Una **visita** es cada vez que alguien entra en la web. Una **persona** se cuenta una sola vez al día aunque entre varias veces: si las visitas crecen más que las personas, es que la gente vuelve.'
  );
  if (hayWeb) {
    visitas.significa.push(
      `En estos ${a.dias} días has tenido **${num(t.visitas)} visitas** de **${num(t.personas)} personas**${comparar(t.visitas, ant?.visitas ?? null, p)}. Son unas ${decimal(a.mediaDia)} visitas al día.`
    );
    const ppv = a.paginasPorVisita;
    visitas.significa.push(
      `En cada visita se miran de media **${decimal(ppv)} páginas**${ppv >= 2 ? ': la web invita a seguir mirando.' : ppv < 1.5 ? ': la mayoría mira una página y se va.' : '.'}`
    );
    if (a.mejor) {
      const destaca = a.mejor.visitas >= a.mediaDia * 2 && a.mejor.visitas >= 5;
      visitas.significa.push(
        `Tu mejor día fue el **${fechaConSemana(a.mejor.dia)}**, con ${num(a.mejor.visitas)} visitas${destaca ? ', más del doble de lo normal' : ''}.`
      );
      if (destaca)
        visitas.haria.push({
          texto: `El ${fechaDiaMes(a.mejor.dia)} entró más del doble de gente de lo normal. Si ese día publicaste algo o mandaste un correo, **eso funcionó: repítelo**.`,
          prioridad: 55,
        });
    }
    const c = cambio(t.visitas, ant?.visitas ?? null);
    if (c?.tipo === 'baja' && c.p >= 15)
      visitas.haria.push({
        texto: `Las visitas han bajado un ${c.p} %. Revisaría qué publicaste en Instagram en el periodo anterior y **volvería a hacer lo que más gente trajo**.`,
        prioridad: 70,
      });
    if (c?.tipo === 'sube' && c.p >= 15)
      visitas.haria.push({
        texto: `Las visitas han subido un ${c.p} %. Apuntaría qué hiciste distinto estos días (publicaciones, historias, correos) **para poder repetirlo**.`,
        prioridad: 45,
      });
    if (ppv > 0 && ppv < 1.5)
      visitas.haria.push({
        texto:
          'Como casi todos miran una sola página, pondría al final de cada página **un enlace claro a la siguiente** (por ejemplo, de «El método» a «Formaciones»).',
        prioridad: 40,
      });
  } else {
    visitas.significa.push(`En este periodo todavía no se ha registrado ninguna visita. ${SIN_DATOS_WEB}`);
  }

  /* ---------- Cuándo ---------- */
  const cuando: Textos = { significa: [], haria: [] };
  if (hayWeb && a.mejorSemana >= 0) {
    cuando.significa.push(
      `La gráfica de la semana es la **media de visitas de cada día**: así un mes con cinco lunes no engaña. Tu mejor día de la semana es el **${DIAS_SEMANA[a.mejorSemana].toLowerCase()}**, con ${decimal(a.semana[a.mejorSemana])} visitas de media.`
    );
    cuando.haria.push({
      texto: `Publicaría lo importante (fechas de formación, anuncios) **el ${DIAS_SEMANA[a.mejorSemana].toLowerCase()} o la víspera**: es cuando más gente entra.`,
      prioridad: 35,
    });
  }
  if (a.pico >= 0) {
    cuando.significa.push(
      `Por horas, donde más te miran es **sobre las ${a.pico}:00** (hora de España). Cuenta páginas vistas, no personas.`
    );
    cuando.haria.push({
      texto: `Programaría tus publicaciones **un poco antes de las ${a.pico}:00**, para que estén frescas cuando más gente mira.`,
      prioridad: 30,
    });
  }
  if (!cuando.significa.length) cuando.significa.push(`Todavía no hay visitas suficientes para saber qué días y a qué horas te miran. ${SIN_DATOS_WEB}`);

  /* ---------- De dónde llegan ---------- */
  const llegan: Textos = { significa: [], haria: [] };
  llegan.significa.push(
    '**Directo** es quien escribe tu dirección o abre un enlace que no dice de dónde viene: muchas veces es WhatsApp, un enlace guardado o un código QR.'
  );
  if (a.origenTop && a.totalOrigen) {
    const [top, n] = a.origenTop;
    llegan.significa.push(`Tu puerta principal es **${top}**: de ahí llegan ${porcentaje(n, a.totalOrigen)} de cada 100 visitas.`);
    const insta = d.web.origenes.find((x) => x[0] === 'Instagram')?.[1] ?? 0;
    const google = d.web.origenes.find((x) => x[0] === 'Google')?.[1] ?? 0;
    if (top === 'Instagram' || porcentaje(insta, a.totalOrigen) >= 25)
      llegan.haria.push({
        texto:
          'Instagram es tu gran escaparate. Me aseguraría de que **el enlace de la biografía lleve a la página que más te interesa ahora** (por ejemplo, Formaciones) y lo pondría también en las historias con el sticker de enlace.',
        prioridad: 50,
      });
    if (a.totalOrigen >= 30 && porcentaje(google, a.totalOrigen) < 10)
      llegan.haria.push({
        texto: `Google te trae poca gente (${porcentaje(google, a.totalOrigen)} %). **Escribir en el blog sobre las dudas que te hacen** ayuda a que te encuentren al buscar.`,
        prioridad: 38,
      });
    if (porcentaje(google, a.totalOrigen) >= 25)
      llegan.haria.push({
        texto: 'Google ya te trae mucha gente: seguiría **escribiendo en el blog** con regularidad, que es lo que lo alimenta.',
        prioridad: 25,
      });
    if (porcentaje(a.directo, a.totalOrigen) >= 40)
      llegan.haria.push({
        texto:
          'Mucha gente llega por enlaces directos: **el boca a boca funciona**. Al compartir, manda el enlace de la página concreta (Formaciones, Comunidad) y no solo el de la portada.',
        prioridad: 32,
      });
  } else llegan.significa.push(`Todavía no hay visitas con las que saber de dónde llegan. ${SIN_DATOS_WEB}`);
  const entrada = d.web.entradas[0];
  if (entrada) {
    const nombre = nombreDePagina(entrada[0]);
    llegan.significa.push(`La página por la que más gente entra es **${nombre}**.`);
    if (nombre !== 'Portada')
      llegan.haria.push({
        texto: `La puerta de entrada más usada es «${nombre}», no la portada: cuidaría que **esa página tenga un botón claro** para pedir información.`,
        prioridad: 36,
      });
  }

  /* ---------- Quién te ve ---------- */
  const quien: Textos = { significa: [], haria: [] };
  if (a.totalPaises) {
    const [cc, n] = d.web.paises[0];
    quien.significa.push(
      `${porcentaje(n, a.totalPaises)} de cada 100 visitas son de **${nombreDePais(cc)}**${d.web.paises.length > 1 ? `, y en total te han visto desde ${d.web.paises.length} ${plural(d.web.paises.length, 'país', 'países')}` : ''}.`
    );
    const fuera = d.web.paises.filter(([c, n]) => c !== 'ES' && c !== '—' && porcentaje(n, a.totalPaises) >= 8);
    if (fuera.length)
      quien.haria.push({
        texto: `Tienes público en **${fuera.map(([c]) => nombreDePais(c)).join(', ')}**. Al anunciar fechas o directos, pondría también la hora de allí.`,
        prioridad: 28,
      });
  }
  if (d.web.ciudades.length >= 2)
    quien.haria.push({
      texto: `Si organizas una formación presencial, **${d.web.ciudades[0][0]} y ${d.web.ciudades[1][0]}** son las ciudades desde donde más te miran: tenlas en cuenta al elegir sitio.`,
      prioridad: 26,
    });
  if (a.totalDispositivos) {
    quien.significa.push(`El **${a.movil} %** entra desde el móvil.`);
    if (a.movil >= 60)
      quien.haria.push({
        texto: 'Revisaría cada novedad (una página, un correo, una entrada del blog) **primero en el móvil**: es donde te ve la mayoría.',
        prioridad: 42,
      });
  }
  if (!quien.significa.length) quien.significa.push(`Todavía no hay visitas con las que saber quién te ve. ${SIN_DATOS_WEB}`);

  /* ---------- Qué miran ---------- */
  const miran: Textos = { significa: [], haria: [] };
  if (d.web.rutas.length) {
    const [ruta, n] = d.web.rutas[0];
    miran.significa.push(
      `La página más vista es **${nombreDePagina(ruta)}**, con ${porcentaje(n, a.totalRutas)} de cada 100 páginas vistas. Cuenta cada vez que se abre una página, aunque sea la misma persona.`
    );
    const puesto = d.web.rutas.findIndex(([r]) => nombreDePagina(r) === 'Formaciones');
    if (puesto > 2)
      miran.haria.push({
        texto: `«Formaciones» está en el puesto ${puesto + 1}. Si tu prioridad es llenar la próxima convocatoria, **la enlazaría desde la portada y desde Instagram**.`,
        prioridad: 40,
      });
    if (puesto === -1 && d.web.rutas.length >= 3)
      miran.haria.push({
        texto: 'Nadie ha abierto «Formaciones» en este periodo. Si quieres llenar plazas, **dale un enlace directo** desde la portada y desde tus redes.',
        prioridad: 44,
      });
  } else miran.significa.push(`Todavía no hay páginas vistas en este periodo. ${SIN_DATOS_WEB}`);

  /* ---------- Vídeos ---------- */
  const videos: Textos = { significa: [], haria: [] };
  videos.significa.push(
    'Los vídeos se cuentan desde que se empezaron a medir, no solo en este periodo, y **solo cuando se ven con sonido**: el vídeo mudo que se reproduce solo al pasar no es alguien mirándolo.'
  );
  const top = a.videosVistos[0];
  if (top) {
    videos.significa.push(
      `De cada 100 personas que empiezan «${top.nombre}», **${Math.min(100, porcentaje(top.c50, top.reproducciones))} llegan a la mitad** y ${a.termina(top)} lo terminan.`
    );
    const flojos = a.videosVistos.filter((v) => v.reproducciones >= 5 && a.termina(v) < 30);
    const buenos = a.videosVistos.filter((v) => v.reproducciones >= 5 && a.termina(v) >= 60);
    if (flojos[0])
      videos.haria.push({
        texto: `En «${flojos[0].nombre}» solo ${a.termina(flojos[0])} de cada 100 llegan al final. Los primeros segundos deciden: **empezaría por el resultado o la frase más potente**.`,
        prioridad: 34,
      });
    if (buenos[0])
      videos.haria.push({
        texto: `«${buenos[0].nombre}» engancha: ${a.termina(buenos[0])} de cada 100 lo ven entero. **Lo usaría en Instagram** o lo subiría más arriba en su página.`,
        prioridad: 33,
      });
  } else videos.significa.push('Todavía nadie ha visto un vídeo de la web con sonido.');

  /* ---------- Contactos ---------- */
  const c = d.contactos;
  const contactos: Textos = { significa: [], haria: [] };
  contactos.significa.push(
    'Un **contacto** es alguien que te ha dejado su nombre y su correo en un formulario de la web, en el asistente o en la exposición, o que apuntaste tú.'
  );
  if (p === 'todo') contactos.significa.push(`Desde el primero${c.primero ? ` (${fechaLarga(c.primero)})` : ''} te han dejado sus datos **${num(c.total)} personas**.`);
  else
    contactos.significa.push(
      `En este periodo han llegado **${num(c.nuevos)} ${plural(c.nuevos, 'contacto nuevo', 'contactos nuevos')}**${comparar(c.nuevos, c.nuevosAntes, p, false)}. En total tienes ${num(c.total)} en tu lista.`
    );
  if (c.porTipo[0] && c.porTipo[0][1] > 0) {
    const [tipo, n] = c.porTipo[0];
    const totalTipo = c.porTipo.reduce((s, x) => s + x[1], 0);
    contactos.significa.push(`Lo que más buscan: **${tipo.toLowerCase()}** (${porcentaje(n, totalTipo)} %). Sale de la página por la que llegaron, así que es una pista, no una certeza.`);
    if (tipo === 'Quiere formarse')
      contactos.haria.push({
        texto: 'Como la mayoría quiere formarse, tendría **las próximas fechas y el enlace de Formaciones** a mano para contestar rápido.',
        prioridad: 37,
      });
    if (tipo === 'Quiere tratarse')
      contactos.haria.push({
        texto: 'La mayoría quiere que la traten: les respondería con **el buscador de terapeutas o tu forma de pedir cita**, que es lo que buscan.',
        prioridad: 37,
      });
  }
  if (a.tasaContacto !== null && p !== 'todo' && t.personas >= 20) {
    contactos.significa.push(`De cada 100 personas que entraron en la web, **${decimal(a.tasaContacto)} dejaron sus datos**.`);
    if (a.tasaContacto < 1 && t.personas >= 100)
      contactos.haria.push({
        texto: 'Menos de 1 de cada 100 personas deja sus datos. Haría **más visible el botón «Quiero la información»** en las páginas más vistas.',
        prioridad: 48,
      });
  }
  if (c.porAtender)
    contactos.haria.push({
      texto: `Escribiría ya a las **${num(c.porAtender)} ${plural(c.porAtender, 'persona que espera', 'personas que esperan')} respuesta**${c.porAtenderViejos ? `, empezando por ${c.porAtenderViejos === 1 ? 'la que lleva' : `las ${c.porAtenderViejos} que llevan`} más de 3 días` : ''}: cuanto antes se contesta, más fácil es que sigan interesadas.`,
      prioridad: 90 + Math.min(9, c.porAtenderViejos),
    });
  const sinFuente = c.porFuente.find(([k]) => k.startsWith('Sin dato'))?.[1] ?? 0;
  const totalFuente = c.porFuente.reduce((s, x) => s + x[1], 0);
  if (totalFuente && porcentaje(sinFuente, totalFuente) >= 50)
    contactos.significa.push('Muchos contactos no tienen «desde dónde llegaron» porque son de antes del 12 de octubre, cuando se empezó a guardar. A partir de ahí se va llenando solo.');

  /* ---------- Lista de espera ---------- */
  const e = d.espera;
  const espera: Textos = { significa: [], haria: [] };
  espera.significa.push(
    'Son las personas que han pedido entrar en la **Comunidad Divine** y todavía no son miembros. Se cuentan sin repetir correos y sin quienes ya están dentro.'
  );
  const faltan = Math.ceil((Date.parse(e.apertura) - Date.parse(d.generado)) / 86_400_000);
  if (faltan > 0) {
    espera.significa.push(`Ahora hay **${num(e.total)} ${plural(e.total, 'persona', 'personas')}** esperando y quedan **${faltan} ${plural(faltan, 'día', 'días')}** para la apertura.`);
    espera.haria.push({
      texto: `Quedan ${faltan} días: mantendría vivo el contacto con la lista y **recordaría la masterclass en directo** unos días antes.`,
      prioridad: 60,
    });
    if (!e.nuevas && p !== 'todo')
      espera.haria.push({
        texto: 'Nadie se ha apuntado en este periodo: volvería a **hablar de la lista en Instagram** con el enlace directo a la página de la Comunidad.',
        prioridad: 52,
      });
  } else espera.significa.push(`Ahora hay **${num(e.total)} ${plural(e.total, 'persona', 'personas')}** que lo pidieron y aún no son miembros.`);

  /* ---------- Cuentas y acuerdos ---------- */
  const cu = d.cuentas;
  const ac = d.acuerdos;
  const cuentas: Textos = { significa: [], haria: [] };
  cuentas.significa.push(
    'Una **cuenta** es alguien que puede entrar en la plataforma. Tener cuenta no es tener acceso: el acceso a la formación (sus clases y su material) y la Comunidad Divine se dan por separado.'
  );
  cuentas.significa.push(
    `Hay **${num(cu.total)} ${plural(cu.total, 'cuenta', 'cuentas')}**: ${num(cu.conCurso)} con la formación, ${num(cu.conComunidad)} con la Comunidad y ${num(cu.sinAcceso)} sin acceso a nada todavía.${p !== 'todo' ? ` En este periodo se han abierto ${num(cu.nuevas)}.` : ''}`
  );
  cuentas.significa.push(
    `El **acuerdo de confidencialidad** se firma antes de recibir el dossier. ${p === 'todo' ? `Se han firmado ${num(ac.total)}` : `En este periodo se han firmado ${num(ac.nuevos)} (${num(ac.total)} en total)`}, y el dossier se ha descargado ${num(ac.descargas)} ${plural(ac.descargas, 'vez', 'veces')}.`
  );
  if (ac.porAprobar)
    cuentas.haria.push({
      texto: `Tienes **${ac.porAprobar} ${plural(ac.porAprobar, 'acuerdo firmado', 'acuerdos firmados')} esperando tu aprobación** para recibir el dossier: está en Personas › Acuerdos.`,
      prioridad: 85,
    });
  if (ac.sinCorreo)
    cuentas.haria.push({
      texto: `${ac.sinCorreo} ${plural(ac.sinCorreo, 'acuerdo no tiene', 'acuerdos no tienen')} el correo enviado: **reenvíalo desde Acuerdos**.`,
      prioridad: 80,
    });
  if (cu.sinAcceso)
    cuentas.haria.push({
      texto: `Hay ${cu.sinAcceso} ${plural(cu.sinAcceso, 'cuenta', 'cuentas')} sin acceso a nada: son personas registradas que esperan algo de ti. **Revisa en Cuentas** si les toca la formación.`,
      prioridad: 58,
    });

  /* ---------- Aula ---------- */
  const au = d.aula;
  const aula: Textos = { significa: [], haria: [] };
  aula.significa.push(
    'Una alumna **activa** es la que ha visto alguna clase en el periodo. Una clase cuenta como **terminada** cuando se llega casi al final del vídeo.'
  );
  if (au && au.conAcceso) {
    aula.significa.push(
      `De ${num(au.conAcceso)} ${plural(au.conAcceso, 'alumna con acceso', 'alumnas con acceso')}, **${num(au.activas)} ${plural(au.activas, 'ha estado', 'han estado')} activas** y se han terminado ${num(au.terminadas)} ${plural(au.terminadas, 'clase', 'clases')}. De media llevan hecho el **${au.progresoMedio} %** del curso.`
    );
    if (au.tramos.sinEmpezar)
      aula.haria.push({
        texto: `${au.tramos.sinEmpezar} ${plural(au.tramos.sinEmpezar, 'alumna no ha empezado', 'alumnas no han empezado')} todavía. Les mandaría **un mensaje corto animándolas a ver la primera clase**.`,
        prioridad: 62,
      });
    const caida = au.lecciones
      .filter((l) => l.empezadas >= 3)
      .map((l) => ({ ...l, pierde: l.empezadas - l.completadas }))
      .sort((x, y) => y.pierde / y.empezadas - x.pierde / x.empezadas)[0];
    if (caida && caida.pierde / caida.empezadas >= 0.4)
      aula.haria.push({
        texto: `En «${caida.titulo}» empiezan ${caida.empezadas} y la terminan ${caida.completadas}: es donde más se quedan. **La revisaría**: ¿es larga?, ¿se entiende bien?`,
        prioridad: 46,
      });
  } else aula.significa.push('Todavía no hay alumnas con acceso al aula.');

  /* ---------- Comunidad ---------- */
  const co = d.comunidad;
  const comunidad: Textos = { significa: [], haria: [] };
  comunidad.significa.push(
    'Es el espacio privado de las terapeutas: publican casos, dudas y resultados, y se responden entre ellas. Las alumnas del curso la ven de visita.'
  );
  if (co && co.totalPublicaciones) {
    comunidad.significa.push(
      `En este periodo: **${num(co.publicaciones)} ${plural(co.publicaciones, 'publicación', 'publicaciones')}** y **${num(co.respuestas)} ${plural(co.respuestas, 'respuesta', 'respuestas')}**, de ${num(co.participantes)} ${plural(co.participantes, 'terapeuta distinta', 'terapeutas distintas')}${comparar(co.publicaciones + co.respuestas, co.publicacionesAntes === null || co.respuestasAntes === null ? null : co.publicacionesAntes + co.respuestasAntes, p, true)}.`
    );
    if (co.sinRespuesta)
      comunidad.haria.push({
        texto: `Hay **${co.sinRespuesta} ${plural(co.sinRespuesta, 'publicación', 'publicaciones')} sin ninguna respuesta**. Contestaría primero las dudas: una duda resuelta rápido anima a preguntar.`,
        prioridad: 75,
      });
    if (co.miembros >= 5 && co.participantes / co.miembros < 0.3)
      comunidad.haria.push({
        texto: `Solo ${co.participantes} de ${co.miembros} miembros han participado. **Una pregunta abierta fijada arriba** (por ejemplo, «¿qué caso te ha costado más esta semana?») suele romper el hielo.`,
        prioridad: 47,
      });
  } else {
    const antes = Date.parse(d.espera.apertura) > Date.parse(d.generado);
    comunidad.significa.push(
      antes
        ? 'Todavía no hay publicaciones. Es lo normal: la Comunidad abre con la masterclass del día de la apertura.'
        : 'Todavía no hay publicaciones en la comunidad.'
    );
    if (!antes && co?.miembros)
      comunidad.haria.push({
        texto: '**Escribiría la primera publicación** dando la bienvenida e invitando a presentarse: nadie quiere ser la primera en hablar.',
        prioridad: 50,
      });
  }

  /* ---------- Correos ---------- */
  const cr = d.correos;
  const correos: Textos = { significa: [], haria: [] };
  correos.significa.push(
    'Aquí entran todos los correos que salen de la web: los automáticos (información, accesos, acuerdo, tu resumen de la mañana) y las campañas.'
  );
  if (cr) {
    correos.significa.push(
      `${cr.parcial ? 'El historial se borra solo a los 30 días, así que aquí solo cuentan **los últimos 30 días**' : 'En este periodo'}: **${num(cr.enviados)} ${plural(cr.enviados, 'enviado', 'enviados')}**${cr.fallidos ? ` y ${num(cr.fallidos)} que no salieron` : ''}${cr.parcial ? '' : comparar(cr.enviados, cr.enviadosAntes, p, false)}. Desde el principio han salido ${num(cr.enviadosSiempre)}.`
    );
    if (cr.omitidos)
      correos.significa.push(`Otros ${num(cr.omitidos)} no se mandaron a propósito: esa persona ya lo había recibido antes, y nadie recibe el mismo correo dos veces.`);
    if (cr.fallidos)
      correos.haria.push({
        texto: `${cr.fallidos} ${plural(cr.fallidos, 'correo no salió', 'correos no salieron')}. **Míralo en Mensajes › Correos**: suele ser una dirección mal escrita.`,
        prioridad: 78,
      });
  }

  /* ---------- Historia ---------- */
  const historia: Textos = { significa: [], haria: [] };
  if (d.historia) {
    const activas = d.historia.semanas.filter((s) => s.contactos + s.cuentas + s.acuerdos > 0);
    const mejor = activas.reduce<Semana | null>((m, s) => (!m || s.contactos > m.contactos ? s : m), null);
    historia.significa.push(
      'Contactos, cuentas y acuerdos están guardados desde el primer día, así que esta parte está completa aunque las visitas se midan desde más tarde.'
    );
    if (mejor && mejor.contactos)
      historia.significa.push(`La semana con más contactos fue la del **${fechaLarga(mejor.semana)}** (${mejor.contactos}).`);
  }

  return { visitas, cuando, llegan, quien, miran, videos, contactos, espera, cuentas, aula, comunidad, correos, historia };
}

/** Las frases de «lo más importante» del resumen: lo que pasó, en cinco líneas como mucho. */
export function destacados(d: DatosInforme, a: Analisis): string[] {
  const t = d.web.totales;
  const s: string[] = [];
  if (t.visitas) {
    s.push(`Han entrado **${num(t.personas)} personas** en la web${comparar(t.personas, d.web.anteriores?.personas ?? null, d.periodo)}.`);
    if (a.origenTop && a.totalOrigen) s.push(`Tu puerta principal es **${a.origenTop[0]}** (${porcentaje(a.origenTop[1], a.totalOrigen)} % de las visitas).`);
    if (a.totalDispositivos) s.push(`El **${a.movil} %** te mira desde el móvil.`);
  } else s.push('Todavía no hay visitas registradas en este periodo.');
  const c = d.contactos;
  s.push(
    d.periodo === 'todo'
      ? `Tienes **${num(c.total)} contactos** en tu lista; ${num(c.porAtender)} esperan respuesta.`
      : `**${num(c.nuevos)} ${c.nuevos === 1 ? 'persona nueva te ha' : 'personas nuevas te han'} dejado sus datos**${c.porAtender ? `; ${num(c.porAtender)} esperan respuesta` : ''}.`
  );
  if (d.espera.total) s.push(`**${num(d.espera.total)}** ${d.espera.total === 1 ? 'persona espera' : 'personas esperan'} la apertura de la Comunidad.`);
  return s.slice(0, 5);
}

/** Los tres consejos más urgentes de todo el informe, para el resumen. */
export function primeros(textos: Record<IdSeccion, Textos>, n = 3): Consejo[] {
  return Object.values(textos)
    .flatMap((x) => x.haria)
    .sort((x, y) => y.prioridad - x.prioridad)
    .slice(0, n);
}

/** El glosario del final: cada palabra que sale en el informe, en una frase. */
export const GLOSARIO: [string, string][] = [
  ['Persona', 'Alguien distinto que entra en la web. Se cuenta una vez al día aunque entre varias veces.'],
  ['Visita', 'Cada vez que alguien entra. Si vuelve por la tarde, son dos visitas de la misma persona.'],
  ['Página vista', 'Cada página que se abre. Una visita puede tener varias.'],
  ['Páginas por visita', 'Páginas vistas entre visitas. Más de 2 quiere decir que la gente sigue mirando.'],
  ['Directo', 'Quien llega sin que se sepa de dónde: escribe la dirección, abre un enlace de WhatsApp o un QR.'],
  ['Puerta de entrada', 'La primera página que ve alguien al llegar. No siempre es la portada.'],
  ['Reproducción', 'Alguien pone un vídeo de la web con sonido. Los vídeos mudos que pasan solos no cuentan.'],
  ['Lo termina', 'De cada 100 que empiezan un vídeo, cuántos llegan al final.'],
  ['Contacto', 'Alguien que te ha dejado su nombre y su correo, o que apuntaste tú.'],
  ['Por atender', 'Contacto al que nadie ha escrito todavía (estado «Nuevo» en Personas).'],
  ['Lista de espera', 'Quien ha pedido entrar en la Comunidad Divine y aún no es miembro.'],
  ['Cuenta', 'Quien puede entrar en la plataforma. Tener cuenta no es tener acceso.'],
  ['Acceso a la formación', 'Las clases y el material del curso. Se compra una vez y es para siempre.'],
  ['Comunidad Divine', 'La membresía de las terapeutas. Es distinta de la formación y se da aparte.'],
  ['Alumna activa', 'La que ha visto alguna clase en el periodo del informe.'],
  ['Periodo anterior', 'Los mismos días justo antes, para comparar: si miras 30 días, los 30 de antes.'],
];
