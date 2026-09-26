/**
 * Lo que la plataforma necesita saber para pintarse: los roles, el menú de
 * cada uno y las listas de opciones de los formularios.
 *
 * Aquí NO hay datos de personas. Los contactos salen de Firestore
 * (`app/api/contactos`), y el resto de listas —clientas, facturas, citas,
 * publicaciones— están vacías a propósito: la plataforma acaba de nacer y
 * todavía no hay nada dentro. Cada pantalla lo dice con sus palabras en vez
 * de enseñar nombres y cifras que no existen.
 */

/*
 * El rol se importa de lib/roles.ts en vez de volver a escribirlo aquí.
 * Estaban los dos, con los mismos valores, y eso solo aguanta hasta que uno
 * cambia: al quitar «alumna» de roles.ts, esta copia habría seguido
 * admitiéndola y TypeScript no habría dicho nada.
 */
import { ROLES_LISTA, type Rol } from './roles';

export type { Rol };
export { ROLES_LISTA as ROLES };

export type Vista =
  | 'inicio'
  | 'aula'
  | 'comunidad'
  | 'clases'
  | 'clientas'
  | 'agenda'
  | 'perfil'
  | 'facturacion'
  | 'suscripcion'
  | 'pagos'
  | 'leads'
  | 'formaciones'
  | 'contenido'
  | 'cuentas';

/**
 * El menú de cada rol.
 *
 * Alumnas y miembros tienen un solo apartado mientras su espacio se termina.
 * Tenían ocho, pero los ocho llevaban a pantallas sin nada dentro: no hay
 * ninguna alumna matriculada todavía, ni la comunidad se ha abierto. Un menú
 * largo de puertas cerradas es peor que una puerta que dice cuándo abre.
 *
 * Cuando cada pieza esté hecha, se vuelve a añadir su línea aquí y su vista
 * —que sigue escrita en `Vistas.tsx`— vuelve a enrutarse en `Plataforma.tsx`.
 */
export function navDe(rol: Rol, conAcceso = false): { id: Vista; label: string }[] {
  if (rol === 'sorela')
    return [
      { id: 'inicio', label: 'Panel' },
      // El orden es el del día a día: primero a quién hay que llamar, después
      // qué hay en el calendario, y luego lo que se cobra.
      { id: 'leads', label: 'Clientes' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'facturacion', label: 'Facturación' },
      { id: 'formaciones', label: 'Formaciones' },
      { id: 'contenido', label: 'Subir contenido' },
      { id: 'comunidad', label: 'Comunidad' },
      // Al final del menú a propósito: dar de alta a alguien se hace de vez en
      // cuando, no todos los días como llamar a una clienta o cobrar.
      { id: 'cuentas', label: 'Cuentas' },
    ];
  /* Quien no ha contratado nada ve una sola puerta, y detrás la pantalla de
     «en preparación». En cuanto tiene algo —un curso, la comunidad— aparece su
     aula, que es a lo que viene. Un menú con un aula vacía sería peor que no
     tenerla: prometería algo que al abrirlo no está. */
  return conAcceso
    ? [
        { id: 'inicio', label: 'Inicio' },
        { id: 'aula', label: 'Mis clases' },
      ]
    : [{ id: 'inicio', label: 'Inicio' }];
}

/**
 * El título grande de cada pantalla.
 *
 * El de «inicio» va vacío para alumnas y miembros: su pantalla trae su propio
 * título, con el nombre de quien ha entrado. Antes aquí ponía «Hola, Marta.»
 * —un nombre inventado de la maqueta— y saludaba con él a cualquiera.
 */
export function tituloDe(vista: Vista, rol: Rol) {
  const admin = rol === 'sorela';
  const titulos: Record<Vista, string> = {
    inicio: admin ? 'Panel de Sorela' : '',
    aula: admin ? 'Formaciones' : 'Tus clases',
    comunidad: 'Comunidad Divine',
    clases: 'Clases y material',
    clientas: 'Mis clientas',
    leads: 'Tus clientes',
    formaciones: 'Formaciones y plazas',
    pagos: 'Tus pagos',
    contenido: 'Qué publicas en el aula',
    facturacion: admin ? 'Ingresos y facturas' : 'Facturación',
    perfil: 'Tu ficha en el buscador',
    agenda: 'Tu agenda',
    cuentas: 'Quién puede entrar',
    suscripcion: admin ? 'Cobros' : 'Comunidad de Terapeutas Divine',
  };
  return titulos[vista];
}

export function seccionDe(vista: Vista, rol: Rol) {
  const admin = rol === 'sorela';
  const secciones: Record<Vista, string> = {
    inicio: admin ? 'Administración' : '',
    aula: 'Lo que has contratado',
    comunidad: 'Lo que pasa esta semana',
    clases: 'Aula de la comunidad',
    clientas: 'Tu cartera',
    facturacion: admin ? 'Administración' : 'Tu negocio',
    perfil: 'Localiza tu terapeuta',
    leads: 'Quién ha levantado la mano',
    formaciones: 'Convocatorias',
    pagos: 'Tu formación',
    contenido: 'Aula · autoría',
    agenda: 'Lo que tienes por delante',
    cuentas: 'Administración',
    suscripcion: 'Comunidad en beta',
  };
  return secciones[vista];
}

/* ==========================================================================
   Comunidad
   ========================================================================== */
export type Post = {
  id: string;
  autor: string;
  iniciales: string;
  cuando: string;
  etiqueta: string;
  titulo: string;
  texto: string;
  likes: number;
  respuestas: number;
  ultima: string;
  destacado: boolean;
};

/* Las publicaciones de la comunidad se escribirán desde dentro. Todavía no
   hay ninguna: la membresía no se ha abierto. */
export const POSTS: Post[] = [];

export const FILTROS_FEED = ['Todo', 'Caso', 'Duda', 'Anuncio'];

/* La clasificación sale de la participación real. Sin publicaciones, no hay. */
export const RANKING: { pos: number; nombre: string; puntos: string }[] = [];

/* ==========================================================================
   Aula
   ========================================================================== */
export type CursoAula = {
  id: string;
  titulo: string;
  etiqueta: string;
  hechas: number;
  foto: string;
  lecciones: { nombre: string; duracion: string }[];
};

/* Los cursos se crean desde «Subir contenido». Ninguno está grabado aún. */
export const CURSOS_AULA: CursoAula[] = [];

export function metaCurso(c: CursoAula) {
  const n = c.lecciones.length;
  return `${n} ${n === 1 ? 'lección' : 'lecciones'}`;
}

export function progresoCurso(c: CursoAula) {
  const total = c.lecciones.length;
  const hechas = Math.min(c.hechas, total);
  return {
    hechas,
    total,
    // Sin lecciones, la división daría NaN y la barra se pintaría rota.
    pct: total === 0 ? 0 : Math.round((hechas / total) * 100),
    texto:
      hechas === 0
        ? 'Sin empezar'
        : hechas === total
          ? 'Completado'
          : `${hechas} de ${total} completadas`,
  };
}

/* El material descargable se sube desde «Subir contenido». */
export const DESCARGABLES: { nombre: string; tipo: string }[] = [];

export const ESTADO_CURSO: Record<string, string> = {};

/* ==========================================================================
   Alumna
   ========================================================================== */
/* Lo que cada alumna ve de su formación sale de su matrícula. Sin cursos
   abiertos todavía, estas tres listas están vacías. */
export const PREPARACION: { nombre: string; tipo: string }[] = [];

export const BLOQUES_AULA: {
  titulo: string;
  estado: string;
  items: { nombre: string; tipo: string }[];
}[] = [];

export const PAGOS_ALUMNA: {
  concepto: string;
  fecha: string;
  importe: string;
  estado: string;
}[] = [];

/* ==========================================================================
   Miembro
   ========================================================================== */
export const ACCESOS: { etiqueta: string; titulo: string; texto: string; ir: Vista }[] = [
  {
    etiqueta: 'Material',
    titulo: 'Descargables',
    texto: 'Fichas de valoración, guiones y protocolos.',
    ir: 'clases',
  },
  {
    etiqueta: 'Telegram',
    titulo: 'Canal privado',
    texto: 'Preguntas del día a día, respondidas.',
    ir: 'clases',
  },
  {
    etiqueta: 'Negocio',
    titulo: 'Formación de negocio',
    texto: 'Cómo conseguir clientas y llevar tu consulta.',
    ir: 'clases',
  },
  {
    etiqueta: 'Buscador',
    titulo: 'Tu ficha pública',
    texto: 'Tus datos, tu zona y lo que trabajas.',
    ir: 'perfil',
  },
];

/* Las clases en vivo quedan grabadas aquí según se vayan dando. */
export const CLASES_ANTERIORES: { tema: string; fecha: string }[] = [];

/* ==========================================================================
   CRM
   ========================================================================== */
export type Clienta = {
  nombre: string;
  iniciales: string;
  telefono: string;
  plan: string;
  hechas: number;
  total: number;
  ultima: string;
  proxima: string;
  estado: 'En plan' | 'Nueva' | 'Activa' | 'Fría';
  nota: string;
};

/* Las clientas las da de alta cada terapeuta en su propia cuenta. */
export const CLIENTAS: Clienta[] = [];

export const FILTROS_CRM = ['Todas', 'En plan', 'Nuevas', 'Sin volver'];

export const KPIS_CRM = [
  { label: 'Clientas activas', valor: '0', nota: 'todavía no has dado de alta ninguna' },
  { label: 'En plan abierto', valor: '0', nota: 'sin planes en marcha' },
  { label: 'Sin volver (60 días)', valor: '0', nota: 'nada pendiente de seguimiento' },
  { label: 'Ticket medio', valor: '—', nota: 'se calcula al facturar' },
];

/* ==========================================================================
   Facturación
   ========================================================================== */
export type Factura = {
  num: string;
  cliente: string;
  concepto: string;
  fecha: string;
  importe: string;
  estado: 'Cobrada' | 'Pendiente' | 'Vencida';
};

export const FACTURAS: Factura[] = [];

export const FILTROS_FACT = ['Todas', 'Cobrada', 'Pendiente', 'Vencida'];

export const KPIS_FACT = [
  { label: 'Facturado este mes', valor: '0 €', nota: 'ninguna factura emitida' },
  { label: 'Cobrado', valor: '0 €', nota: 'nada cobrado todavía' },
  { label: 'Pendiente de cobro', valor: '0 €', nota: 'nada pendiente' },
  { label: 'Vencido', valor: '0 €', nota: 'nada vencido' },
];

/* ==========================================================================
   Agenda y ficha
   ========================================================================== */
export type Cita = {
  hora: string;
  cliente: string;
  motivo: string;
  estado: string;
  tipo: 'conf' | 'nueva' | 'pend';
};

/* La semana se pinta vacía hasta que haya citas de verdad. Los números de
   día salen del calendario, no de una lista escrita a mano. */
export const SEMANA: { dow: string; num: number; citas: Cita[] }[] = [];

export const POR_CONFIRMAR: { cliente: string; cuando: string; detalle: string }[] = [];

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const TRATAMIENTOS_PERFIL = [
  'Drenaje linfático',
  'Postparto',
  'Reductivo corporal',
  'Postquirúrgico',
  'Maderoterapia',
  'Masaje profundo',
];

/* Lo que cada terapeuta marca en su ficha. De salida, nada marcado. */
export const TRATAMIENTOS_ACTIVOS: string[] = [];

/** La membresía está en beta: no hay cuota, no hay recibos. Esto es lo que
 *  falta para poder abrirla al público y ponerle precio. */
export const PENDIENTE_BETA = [
  { que: 'Acceso con cuenta y roles', listo: true },
  { que: 'Los contactos de la web entran en la plataforma', listo: true },
  { que: 'Canal privado de casos', listo: false },
  { que: 'Clase en vivo al mes, con grabación', listo: false },
  { que: 'Fichas y protocolos descargables', listo: false },
  { que: 'Formación de negocio y clientas', listo: false },
  { que: 'Cobro de la cuota', listo: false },
];

/* ==========================================================================
   Sorela (admin)
   ========================================================================== */
export const KPIS_ADMIN = [
  { label: 'Terapeutas certificadas', valor: '0', nota: 'aún no hay ninguna promoción' },
  { label: 'Plazas vendidas este mes', valor: '0', nota: 'sin convocatorias abiertas' },
  { label: 'Facturado este mes', valor: '0 €', nota: 'ninguna factura emitida' },
  { label: 'Lista de la comunidad', valor: '0', nota: 'ver Contactos' },
];

/* Las fichas del mapa se aprueban una a una cuando haya certificadas. */
export const POR_APROBAR: { nombre: string; ciudad: string; nota: string }[] = [];

/* Convocatorias, inscritas y reservas: se llenan al abrir la primera. */
export const INSCRITAS: { curso: string; cuando: string; plazas: string }[] = [];

export const RESERVAS_AGREGADAS: { nombre: string; pct: number; total: string }[] = [];

/*
 * Aquí había una lista de «leads» inventados —Elena, Rocío, Nuria— con sus
 * ciudades, sus notas y sus estados. Los contactos de verdad se leen ahora de
 * Firestore: ver components/plataforma/Contactos.tsx.
 */

export const CONVOCATORIAS: {
  curso: string;
  ciudad: string;
  fechas: string;
  vendidas: number;
  total: number;
  pct: number;
  ingreso: string;
  pendiente: string;
}[] = [];

export const AGENDA_SORELA: { cuando: string; que: string; detalle: string }[] = [];

export const INGRESOS_ADMIN = [
  { label: 'Facturado este mes', valor: '0 €', nota: 'ninguna factura emitida' },
  { label: 'Cobrado', valor: '0 €', nota: 'nada cobrado todavía' },
  { label: 'Pendiente', valor: '0 €', nota: 'nada pendiente' },
  { label: 'Comunidad', valor: '0 €', nota: 'sin abrir' },
];

export const FACTURAS_ADMIN: Factura[] = [];
