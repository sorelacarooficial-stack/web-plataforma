/**
 * Las convocatorias de formación: cada fecha que Sorela abre de un curso, con
 * sus plazas, quién se ha apuntado y quién le ha pagado.
 *
 * Es un módulo PURO, sin nada de servidor: lo leen la pantalla de Sorela, las
 * rutas de la API y la página pública /formaciones. Así las cuentas (plazas
 * ocupadas, lo cobrado, lo que falta) se hacen con la misma regla en los tres
 * sitios y no pueden decir cosas distintas.
 *
 * TRES COSAS QUE NO SE PUEDEN CONFUNDIR, y que esta pantalla separa a la vista:
 *
 *   1. La convocatoria: la formación presencial que se paga. Plazas y pagos.
 *      Vive aquí.
 *   2. El acceso al curso en el aula: las clases y el material de ese curso.
 *      Es un acceso de tipo «curso» en la ficha de la persona (lib/accesos.ts)
 *      y se da en Cuentas › Dar acceso, eligiendo a la inscrita.
 *   3. La membresía de la Comunidad Divine: se paga al mes y NO se da nunca
 *      desde una convocatoria. Ni aquí ni en el servidor hay forma de hacerlo.
 */

import { CURSO_DIVINE } from './accesos';

/* ==========================================================================
   Los cursos que se pueden convocar
   ========================================================================== */

export type CursoConvocable = {
  id: string;
  /** Cómo se llama, igual que en el aula y en Cuentas. */
  nombre: string;
  /**
   * El nombre EXACTO del acceso de tipo «curso» que se le da a una inscrita
   * desde Cuentas › Dar acceso. Tiene que coincidir con el de las clases y el
   * material (lib/accesos.ts, CURSO_DIVINE) o la alumna entraría al aula y no
   * vería nada.
   */
  accesoAula: string;
  /** Qué es la convocatoria de este curso, en dos palabras: lo que se paga. */
  modalidad: string;
  /**
   * El ancla del curso en los datos estructurados de /formaciones. La
   * convocatoria es una edición de la etapa presencial, así que cuelga del
   * curso «presencial» que ya declara esa página.
   */
  ancla: string;
};

/**
 * Hoy hay un solo curso en el sistema de accesos: la Formación Técnica Divine
 * (lo online en el aula y las dos jornadas presenciales). Se deja como lista
 * para que el día que haya otro baste con añadirlo aquí.
 *
 * No se escribe un nombre suelto: sale de CURSO_DIVINE, que es el que leen las
 * clases y el material. Si un día cambia allí, cambia aquí solo.
 */
export const CURSOS_CONVOCABLES: CursoConvocable[] = [
  {
    id: 'tecnica-divine',
    nombre: CURSO_DIVINE,
    accesoAula: CURSO_DIVINE,
    modalidad: 'Formación presencial',
    ancla: 'presencial',
  },
];

export const CURSO_POR_DEFECTO = CURSOS_CONVOCABLES[0];

/** El curso de una convocatoria; si el id no existe, el de por defecto. */
export const cursoDe = (id: string | undefined): CursoConvocable =>
  CURSOS_CONVOCABLES.find((c) => c.id === id) ?? CURSO_POR_DEFECTO;

/* ==========================================================================
   Dinero
   ========================================================================== */

/**
 * Las monedas en que se puede cobrar una plaza. Las formaciones son en España
 * y, las próximas, en Sudamérica: allí se cobra en dólares o en la moneda del
 * país, y sumar pesos colombianos como si fueran euros daría un «cobrado»
 * que no significa nada. Por eso cada convocatoria lleva la suya.
 */
export const MONEDAS = ['EUR', 'USD', 'COP', 'MXN', 'PEN', 'CLP'] as const;
export type Moneda = (typeof MONEDAS)[number];

export const NOMBRE_MONEDA: Record<Moneda, string> = {
  EUR: 'Euros (€)',
  USD: 'Dólares (US$)',
  COP: 'Pesos colombianos',
  MXN: 'Pesos mexicanos',
  PEN: 'Soles',
  CLP: 'Pesos chilenos',
};

const FORMATOS = new Map<string, Intl.NumberFormat>();

/**
 * Un importe en céntimos, escrito como se lee: «1.450 €», «1.450,50 €»,
 * «3.500.000 COP». Los decimales solo salen si los hay: «1.450,00 €» en cada
 * fila es ruido.
 *
 * Se guarda en céntimos y no en euros con decimales por lo mismo que las
 * facturas: 0,1 + 0,2 no da 0,3 en coma flotante, y una suma de pagos que
 * no cuadra por un céntimo hace dudar de todas las demás.
 */
export function importe(centimos: number, moneda: Moneda = 'EUR'): string {
  const decimales = centimos % 100 === 0 ? 0 : 2;
  const llave = `${moneda}-${decimales}`;
  let f = FORMATOS.get(llave);
  if (!f) {
    f = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
    FORMATOS.set(llave, f);
  }
  return f.format(centimos / 100);
}

/**
 * Lo que se escribe en una caja de importe, en céntimos. `null` si no se
 * entiende; 0 si está vacía.
 *
 * Acepta lo que escribe una persona en España: «1450», «1.450», «1.450,50»,
 * «1450,5» y también «1450.50». La regla del punto: si separa grupos de tres
 * cifras es de miles («1.450», «3.500.000»); si no, es la coma decimal de
 * quien escribe a la inglesa («1450.50»).
 */
export function aCentimos(texto: string): number | null {
  const t = texto.replace(/[\s€$]|EUR|USD|COP|MXN|PEN|CLP/gi, '');
  if (!t) return 0;
  let normal: string;
  if (t.includes(',')) normal = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, '');
  else normal = t;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  const n = Math.round(Number(normal) * 100);
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000_000 ? n : null;
}

/** Al revés: céntimos a lo que se pinta dentro de la caja para editar. */
export function aTextoImporte(centimos: number | null): string {
  if (centimos === null) return '';
  const entero = Math.floor(centimos / 100).toLocaleString('es-ES');
  return centimos % 100 === 0 ? entero : `${entero},${String(centimos % 100).padStart(2, '0')}`;
}

/* ==========================================================================
   Inscritas y pagos
   ========================================================================== */

export const ESTADOS_PAGO = ['pagado', 'senal', 'pendiente'] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const ETIQUETA_PAGO: Record<EstadoPago, string> = {
  pagado: 'Pagado',
  senal: 'Abono',
  pendiente: 'Pendiente',
};

/**
 * En qué punto está el acceso al curso que se le ha creado a una inscrita.
 * Es lo que se lee en su fila: «Enlace sin usar», «Ya tiene cuenta».
 */
export type EstadoAcceso =
  | 'sin-crear'
  | 'enlace-sin-usar'
  | 'enlace-caducado'
  | 'enlace-anulado'
  | 'ya-tiene-cuenta';

export const ETIQUETA_ACCESO_CURSO: Record<EstadoAcceso, string> = {
  'sin-crear': 'Sin acceso al curso',
  'enlace-sin-usar': 'Enlace sin usar',
  'enlace-caducado': 'Enlace caducado',
  'enlace-anulado': 'Enlace anulado',
  'ya-tiene-cuenta': 'Ya tiene cuenta',
};

export type AccesoInscrita = {
  estado: EstadoAcceso;
  /** El enlace de invitación, solo mientras sigue sin usar: para copiarlo otra vez. */
  enlace: string | null;
  /** Hasta cuándo vale el enlace, en ISO. */
  caduca: string | null;
  /** Cuándo se creó el enlace o se le dio el acceso a su cuenta, en ISO. */
  desde: string | null;
};

export type Inscrita = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  /** Lo que ha pagado hasta ahora, en céntimos. */
  pagado: number;
  estado: EstadoPago;
  nota: string;
  /** El contacto del CRM del que salió, si se eligió de ahí. Solo se lee. */
  contacto: string | null;
  creada: string;
  acceso: AccesoInscrita;
};

/** Qué estado le pega a un pago, por si Sorela no lo ha elegido a mano. */
export function estadoSugerido(pagado: number, precio: number | null): EstadoPago {
  if (pagado <= 0) return 'pendiente';
  if (precio !== null && precio > 0 && pagado >= precio) return 'pagado';
  return 'senal';
}

/* ==========================================================================
   La convocatoria
   ========================================================================== */

/** Hora de empezar y de acabar de una jornada, «08:00». */
export type Jornada = { desde: string; hasta: string };

export type Convocatoria = {
  id: string;
  curso: string;
  /** Primer y último día, «2026-10-24». */
  inicio: string;
  fin: string;
  /** Horario de cada día, por fecha. Opcional: puede no estar cerrado. */
  horario: Record<string, Jornada>;
  ciudad: string;
  /** Dónde exactamente. Solo lo ve Sorela: no sale en la web. */
  lugar: string;
  /** Plazas en total. `null` = por definir. */
  plazas: number | null;
  /** Precio por plaza, en céntimos. `null` = por definir. Nunca sale en la web. */
  precio: number | null;
  moneda: Moneda;
  /** Si se apunta gente. Con las inscripciones cerradas, la web lo dice. */
  abierta: boolean;
  /** «Mostrar en la web». */
  publicada: boolean;
  inscritas: Inscrita[];
  creada: string | null;
  actualizada: string | null;
};

export type Resumen = {
  ocupadas: number;
  /** Plazas libres; `null` si las plazas están por definir. */
  libres: number | null;
  porEstado: Record<EstadoPago, number>;
  cobrado: number;
  /** Lo que falta por cobrar; `null` si el precio está por definir. */
  porCobrar: number | null;
  /** Quién falta por pagar del todo y cuánto debe (si se sabe). */
  deben: { inscrita: Inscrita; debe: number | null }[];
};

/**
 * Las cuentas de una convocatoria.
 *
 * Una inscrita ocupa una plaza esté como esté su pago: si se ha apuntado, esa
 * plaza ya no se le puede ofrecer a otra. Lo que cambia con el pago es lo que
 * falta por cobrar.
 *
 * Lo que debe cada una es el precio menos lo pagado, salvo que esté marcada
 * como «Pagado»: si Sorela le hizo un precio especial, lo que manda es lo que
 * ella dice y no la resta. Sin precio no se puede saber cuánto falta, y se
 * dice así («Por definir») en vez de poner un cero que parecería «nada».
 */
export function resumen(c: Pick<Convocatoria, 'inscritas' | 'plazas' | 'precio'>): Resumen {
  const porEstado: Record<EstadoPago, number> = { pagado: 0, senal: 0, pendiente: 0 };
  let cobrado = 0;
  let porCobrar = 0;
  const deben: Resumen['deben'] = [];
  for (const i of c.inscritas) {
    porEstado[i.estado] += 1;
    cobrado += i.pagado;
    if (i.estado === 'pagado') continue;
    const debe = c.precio === null ? null : Math.max(c.precio - i.pagado, 0);
    if (debe !== null) porCobrar += debe;
    deben.push({ inscrita: i, debe });
  }
  // Primero quien no ha pagado nada; dentro de eso, quien más debe.
  deben.sort((a, b) => (a.inscrita.pagado === 0 ? 0 : 1) - (b.inscrita.pagado === 0 ? 0 : 1) || (b.debe ?? 0) - (a.debe ?? 0));
  const ocupadas = c.inscritas.length;
  return {
    ocupadas,
    libres: c.plazas === null ? null : Math.max(c.plazas - ocupadas, 0),
    porEstado,
    cobrado,
    porCobrar: c.precio === null ? null : porCobrar,
    deben,
  };
}

/* ==========================================================================
   Lo que se ve en la web
   ========================================================================== */

export type EstadoPlazas = 'quedan' | 'ultimas' | 'completa' | 'cerrada';

export const ETIQUETA_PLAZAS: Record<EstadoPlazas, string> = {
  quedan: 'Quedan plazas',
  ultimas: 'Últimas plazas',
  completa: 'Completa',
  cerrada: 'Inscripciones cerradas',
};

/**
 * Cómo se dice en la web cuántas plazas quedan, sin dar el número.
 *
 * «Últimas plazas» con un quinto o menos libre, y nunca por encima de cinco:
 * en un grupo de ocho, dos libres ya son las últimas; en uno de cuarenta, ocho
 * libres no lo son. Con las plazas por definir no hay límite que se pueda
 * acabar, así que quedan mientras las inscripciones estén abiertas.
 */
export function estadoPlazas(plazas: number | null, ocupadas: number, abierta: boolean): EstadoPlazas {
  if (!abierta) return 'cerrada';
  if (plazas === null) return 'quedan';
  const libres = plazas - ocupadas;
  if (libres <= 0) return 'completa';
  if (libres <= Math.min(5, Math.max(2, Math.ceil(plazas * 0.2)))) return 'ultimas';
  return 'quedan';
}

/**
 * Lo único de una convocatoria que sale de la plataforma. Ni precio, ni
 * nombres, ni el lugar exacto, ni el número de plazas: la ciudad, las fechas,
 * el horario y si quedan sitios.
 */
export type ConvocatoriaPublica = {
  id: string;
  curso: string;
  modalidad: string;
  ancla: string;
  inicio: string;
  fin: string;
  horario: Record<string, Jornada>;
  ciudad: string;
  plazas: EstadoPlazas;
};

/* ==========================================================================
   Fechas
   ========================================================================== */

export const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Si «2026-02-30» es una fecha que existe (el patrón solo mira la forma). */
export function fechaValida(f: string): boolean {
  if (!FECHA.test(f)) return false;
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

/**
 * El día de hoy en España, «2026-10-13».
 *
 * Con la fecha de UTC, entre medianoche y las dos de la mañana de aquí sería
 * todavía ayer, y una convocatoria que empieza hoy seguiría pareciendo futura.
 */
export function hoyISO(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Los días de una convocatoria, de `inicio` a `fin`. Como mucho 31. */
export function diasEntre(inicio: string, fin: string): string[] {
  if (!fechaValida(inicio) || !fechaValida(fin) || fin < inicio) return [];
  const dias: string[] = [];
  const d = new Date(`${inicio}T00:00:00Z`);
  while (dias.length < 31) {
    const f = d.toISOString().slice(0, 10);
    if (f > fin) break;
    dias.push(f);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}

/* Las fechas se leen siempre en UTC: «2026-10-24» es un día del calendario,
   no un instante, y leído en la hora de Bogotá se iría al 23. */
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { ...o, timeZone: 'UTC' });
const F_DIA = fmt({ day: 'numeric' });
const F_MES = fmt({ month: 'long' });
const F_MES_CORTO = fmt({ month: 'short' });
const F_SEMANA = fmt({ weekday: 'long' });
const F_SEMANA_CORTA = fmt({ weekday: 'short' });
const aFecha = (f: string) => new Date(`${f}T00:00:00Z`);

export const diaDe = (f: string) => F_DIA.format(aFecha(f));
export const mesDe = (f: string) => F_MES.format(aFecha(f));
export const mesCortoDe = (f: string) => F_MES_CORTO.format(aFecha(f)).replace('.', '');
export const semanaDe = (f: string) => F_SEMANA.format(aFecha(f));
export const semanaCortaDe = (f: string) => F_SEMANA_CORTA.format(aFecha(f)).replace('.', '');
export const anoDe = (f: string) => f.slice(0, 4);

/**
 * Las fechas de una convocatoria dichas como se dicen:
 *
 *   «24 de octubre de 2026»                     (un día)
 *   «24 y 25 de octubre de 2026»                (dos días seguidos)
 *   «24 al 27 de octubre de 2026»               (mismo mes)
 *   «30 de octubre al 2 de noviembre de 2026»   (cambia de mes)
 */
export function rangoFechas(inicio: string, fin: string, conAno = true): string {
  if (!fechaValida(inicio)) return '';
  const ano = conAno ? ` de ${anoDe(fin || inicio)}` : '';
  if (!fechaValida(fin) || fin === inicio) return `${diaDe(inicio)} de ${mesDe(inicio)}${conAno ? ` de ${anoDe(inicio)}` : ''}`;
  const mismoMes = inicio.slice(0, 7) === fin.slice(0, 7);
  const seguidos = diasEntre(inicio, fin).length === 2;
  if (mismoMes) return `${diaDe(inicio)} ${seguidos ? 'y' : 'al'} ${diaDe(fin)} de ${mesDe(fin)}${ano}`;
  const anoInicio = inicio.slice(0, 4) !== fin.slice(0, 4) && conAno ? ` de ${anoDe(inicio)}` : '';
  return `${diaDe(inicio)} de ${mesDe(inicio)}${anoInicio} ${seguidos ? 'y' : 'al'} ${diaDe(fin)} de ${mesDe(fin)}${ano}`;
}

/** «sábado 24 · 08:00–17:00», una línea por día con horario. */
export function lineasHorario(c: Pick<Convocatoria, 'inicio' | 'fin' | 'horario'>): string[] {
  return diasEntre(c.inicio, c.fin)
    .filter((d) => c.horario[d])
    .map((d) => `${semanaDe(d)} ${diaDe(d)} · ${c.horario[d].desde}–${c.horario[d].hasta}`);
}

/** Primera letra en mayúscula: «sábado» al principio de una línea. */
export const capital = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Iniciales para el avatar de una inscrita: «Marta Ruiz» → «MR». */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '·';
}
