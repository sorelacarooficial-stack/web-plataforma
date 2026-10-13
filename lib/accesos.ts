/**
 * Qué tiene contratado cada persona.
 *
 * Esto sustituye a la idea de que alguien «es alumna» o «es miembro». No lo
 * era: eran dos compras distintas metidas en un mismo campo, y con un solo
 * campo no se pueden tener las dos. Quien hizo el curso Y paga la comunidad
 * tenía que elegir, y al marcarla de una manera perdía la otra.
 *
 * Ahora hay UNA clase de persona —miembro— y una lista de lo que ha
 * contratado. Eso resuelve solo tres cosas que antes no se podían hacer:
 *
 *   · Sorela tiene varios cursos, y cada persona ve el suyo.
 *   · Si alguien deja de pagar la comunidad se le quita ese acceso SIN tocar
 *     su curso: el curso lo compró, es suyo para siempre.
 *   · Una misma persona acumula cursos con los años.
 *
 * Los accesos NO deciden si se puede entrar en la plataforma —eso lo decide el
 * rol de la claim firmada, en lib/roles.ts— sino qué ve dentro una vez
 * entrada. Son dos preguntas distintas y conviene que sigan separadas.
 */

/** La comunidad se paga al mes; un curso se compra una vez. */
export const TIPOS_ACCESO = ['membresia', 'curso'] as const;
export type TipoAcceso = (typeof TIPOS_ACCESO)[number];

export type Acceso = {
  tipo: TipoAcceso;
  /**
   * Cómo se llama el curso, tal y como lo escriba Sorela: «Formación Base»,
   * «Presencial de Bogotá». Se guarda el texto y no un identificador de una
   * lista de convocatorias porque esa lista todavía no existe: hoy no hay
   * ninguna fecha cerrada. Cuando la haya, este campo pasa a enlazarla.
   *
   * La membresía no lo usa: solo hay una.
   */
  nombre?: string;
  /** Desde cuándo lo tiene, en ISO. Sirve para ordenar y para la ficha. */
  desde?: string;
  /**
   * Solo cursos. La convocatoria (fechas presenciales) que ha comprado: con
   * ella, sus días salen en su agenda.
   */
  convocatoria?: string;
  /**
   * Solo cursos. `false` = ha dejado el abono: ve el precurso, los dosieres
   * de cada día y sus fechas; las clases en vídeo le salen BLOQUEADAS («Se
   * desbloquea una vez completada la parte práctica»). Se abren cuando paga el
   * resto, después de la presencial. Sin el campo cuenta como completo: así
   * siguen igual los accesos que ya estaban dados antes de existir esto.
   */
  completo?: boolean;
};

/** Si un acceso de curso abre ya las clases en vídeo (el material lo abre siempre, también con el abono). */
export const esCompleto = (a: Acceso) => a.tipo !== 'curso' || a.completo !== false;

/**
 * El curso que se vende hoy. Las clases y el material van dirigidos a este
 * nombre, así que una alumna tiene que tenerlo escrito igual (sin importar
 * tildes ni mayúsculas) para verlos.
 */
export const CURSO_DIVINE = 'Formación Técnica Divine';

export const ETIQUETA_ACCESO: Record<TipoAcceso, string> = {
  membresia: 'Comunidad Divine',
  curso: 'Formación',
};

/** Cómo se lee un acceso de un vistazo. La membresía no lleva nombre: es una. */
export function nombreDeAcceso(a: Acceso): string {
  if (a.tipo === 'membresia') return ETIQUETA_ACCESO.membresia;
  return a.nombre?.trim() || 'Formación sin nombre';
}

export const tieneMembresia = (accesos: Acceso[] | undefined) =>
  (accesos ?? []).some((a) => a.tipo === 'membresia');

export const cursosDe = (accesos: Acceso[] | undefined) =>
  (accesos ?? []).filter((a) => a.tipo === 'curso');

/**
 * Limpia lo que llega de fuera y devuelve una lista de accesos utilizable.
 *
 * Se recorta, se tira lo que no tiene forma de acceso y se quitan los cursos
 * repetidos por nombre: dar dos veces de alta el mismo curso es un dedazo, no
 * una intención, y en la ficha saldría dos veces la misma etiqueta.
 *
 * La membresía se queda en una sola aunque lleguen varias, por lo mismo.
 */
export function revisarAccesos(crudo: unknown): Acceso[] {
  if (!Array.isArray(crudo)) return [];

  const salida: Acceso[] = [];
  const cursosVistos = new Set<string>();
  let yaHayMembresia = false;

  for (const item of crudo.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const tipo = (item as { tipo?: unknown }).tipo;
    if (tipo !== 'membresia' && tipo !== 'curso') continue;

    if (tipo === 'membresia') {
      if (yaHayMembresia) continue;
      yaHayMembresia = true;
      salida.push({ tipo: 'membresia', desde: fecha((item as { desde?: unknown }).desde) });
      continue;
    }

    const nombre = String((item as { nombre?: unknown }).nombre ?? '')
      .trim()
      .slice(0, 80);
    // Un curso sin nombre no se puede distinguir de otro ni enseñar en una
    // ficha: se descarta en vez de guardar una etiqueta vacía.
    if (!nombre) continue;
    const crudoConv = (item as { convocatoria?: unknown }).convocatoria;
    const convocatoria = typeof crudoConv === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(crudoConv) ? crudoConv : undefined;
    const completo = (item as { completo?: unknown }).completo === false ? false : undefined;
    const clave = nombre.toLowerCase();
    if (cursosVistos.has(clave)) {
      /* El mismo curso dos veces (p. ej. el abono y luego el pago completo):
         se queda uno, con lo mejor de los dos. Completo gana a solo precurso,
         y la convocatoria que haya se conserva. */
      const ya = salida.find((a) => a.tipo === 'curso' && a.nombre?.toLowerCase() === clave)!;
      if (completo === undefined) delete ya.completo;
      if (!ya.convocatoria && convocatoria) ya.convocatoria = convocatoria;
      continue;
    }
    cursosVistos.add(clave);
    const acceso: Acceso = { tipo: 'curso', nombre, desde: fecha((item as { desde?: unknown }).desde) };
    if (convocatoria) acceso.convocatoria = convocatoria;
    if (completo === false) acceso.completo = false;
    salida.push(acceso);
  }

  return salida;
}

/** Una fecha en ISO, o la de hoy si lo que llega no lo es. */
function fecha(v: unknown): string {
  const t = typeof v === 'string' ? new Date(v) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toISOString() : new Date().toISOString();
}
