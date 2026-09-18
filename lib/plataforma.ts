/**
 * Datos de ejemplo de la plataforma privada.
 *
 * Todo es maqueta: nombres, cifras, facturas y citas son inventados y están
 * aquí para que Sorela pueda recorrer la plataforma entera y decidir qué
 * quiere. Nada de esto viene de una base de datos ni se guarda en ningún sitio.
 * Transcrito del prototipo `Plataforma Divine.dc.html`.
 */

export type Rol = 'alumna' | 'miembro' | 'sorela';

export const ROLES: { id: Rol; label: string }[] = [
  { id: 'alumna', label: 'Alumna' },
  { id: 'miembro', label: 'Miembro certificada' },
  { id: 'sorela', label: 'Sorela (admin)' },
];

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
  | 'contenido';

export function navDe(rol: Rol): { id: Vista; label: string }[] {
  if (rol === 'alumna')
    return [
      { id: 'inicio', label: 'Inicio' },
      { id: 'aula', label: 'Mi formación' },
      { id: 'comunidad', label: 'Comunidad' },
      { id: 'pagos', label: 'Mis pagos' },
    ];
  if (rol === 'sorela')
    return [
      { id: 'inicio', label: 'Panel' },
      { id: 'leads', label: 'Leads' },
      { id: 'formaciones', label: 'Formaciones' },
      { id: 'contenido', label: 'Subir contenido' },
      { id: 'facturacion', label: 'Facturación' },
      { id: 'comunidad', label: 'Comunidad' },
    ];
  return [
    { id: 'inicio', label: 'Inicio' },
    { id: 'comunidad', label: 'Comunidad' },
    { id: 'clases', label: 'Clases y material' },
    { id: 'clientas', label: 'Mis clientas' },
    { id: 'agenda', label: 'Mi agenda' },
    { id: 'perfil', label: 'Mi ficha pública' },
    { id: 'facturacion', label: 'Facturación' },
    { id: 'suscripcion', label: 'Mi acceso' },
  ];
}

export function tituloDe(vista: Vista, rol: Rol) {
  const admin = rol === 'sorela';
  const alumna = rol === 'alumna';
  const titulos: Record<Vista, string> = {
    inicio: admin ? 'Panel de Sorela' : 'Hola, Marta.',
    aula: admin ? 'Formaciones' : 'Técnica Divine · Formación Base',
    comunidad: 'Comunidad Divine',
    clases: 'Clases y material',
    clientas: 'Mis clientas',
    leads: 'Quién ha levantado la mano',
    formaciones: 'Formaciones y plazas',
    pagos: 'Tus pagos',
    contenido: 'Qué publicas en el aula',
    facturacion: admin ? 'Ingresos y facturas' : 'Facturación',
    perfil: 'Tu ficha en el buscador',
    agenda: admin ? 'Reservas' : 'Tu agenda',
    suscripcion: admin ? 'Cobros' : 'Comunidad de Terapeutas Divine',
  };
  return titulos[vista];
}

export function seccionDe(vista: Vista, rol: Rol) {
  const admin = rol === 'sorela';
  const secciones: Record<Vista, string> = {
    inicio: admin ? 'Administración' : 'Tu espacio',
    aula: 'Aula del curso',
    comunidad: 'Lo que pasa esta semana',
    clases: 'Aula de la comunidad',
    clientas: 'Tu cartera',
    facturacion: admin ? 'Administración' : 'Tu negocio',
    perfil: 'Localiza tu terapeuta',
    leads: 'Captación',
    formaciones: 'Convocatorias',
    pagos: 'Tu formación',
    contenido: 'Aula · autoría',
    agenda: 'Reservas recibidas',
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

export const POSTS: Post[] = [
  {
    id: 'p1',
    autor: 'Sorela Caro',
    iniciales: 'SC',
    cuando: 'Fijado · hace 2 días',
    etiqueta: 'Anuncio',
    titulo: 'La clase de octubre va de retención severa en piernas',
    texto:
      'Traed un caso propio con fotos de la valoración. Resolvemos tres en directo y el resto quedan comentados por escrito en el hilo.',
    likes: 24,
    respuestas: 11,
    ultima: 'Nuria respondió hace 1 h',
    destacado: true,
  },
  {
    id: 'p2',
    autor: 'Nuria Sanchís',
    iniciales: 'NS',
    cuando: 'hace 5 h',
    etiqueta: 'Caso',
    titulo: 'Postquirúrgica de tres semanas con fibrosis en flanco',
    texto:
      'La valoración dice tejido reactivo y la clienta pide intensidad. Yo bajaría el ritmo dos sesiones antes de entrar a fondo. ¿Cómo lo veis?',
    likes: 9,
    respuestas: 6,
    ultima: 'Sorela respondió hace 20 min',
    destacado: false,
  },
  {
    id: 'p3',
    autor: 'Carla Redondo',
    iniciales: 'CR',
    cuando: 'ayer',
    etiqueta: 'Duda',
    titulo: 'Cómo explico el precio del plan sin sonar a venta',
    texto:
      'Uso el guion de primera visita y funciona, pero me atasco al pasar del criterio al presupuesto. ¿Alguien tiene una frase que le sirva?',
    likes: 14,
    respuestas: 8,
    ultima: 'Ainhoa respondió hace 3 h',
    destacado: false,
  },
  {
    id: 'p4',
    autor: 'Patricia Soler',
    iniciales: 'PS',
    cuando: 'hace 2 días',
    etiqueta: 'Resultado',
    titulo: 'Tercera clienta que llega por el buscador este mes',
    texto:
      'Completé la ficha con dirección y tratamientos y cambió la cosa. Las tres han entrado directas a la agenda, sin llamada previa.',
    likes: 31,
    respuestas: 12,
    ultima: 'Marta respondió hace 6 h',
    destacado: false,
  },
];

export const FILTROS_FEED = ['Todo', 'Caso', 'Duda', 'Anuncio'];

export const RANKING = [
  { pos: 1, nombre: 'Nuria Sanchís', puntos: '148 pts' },
  { pos: 2, nombre: 'Marta Ibáñez', puntos: '121 pts' },
  { pos: 3, nombre: 'Carla Redondo', puntos: '96 pts' },
  { pos: 4, nombre: 'Ainhoa Etxebarria', puntos: '74 pts' },
  { pos: 5, nombre: 'Patricia Soler', puntos: '58 pts' },
];

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

export const CURSOS_AULA: CursoAula[] = [
  {
    id: 'lectura',
    titulo: 'Lectura corporal',
    etiqueta: 'Fundamento',
    hechas: 4,
    foto: 'trabajo-lumbar',
    lecciones: [
      { nombre: 'Qué miras antes de tocar', duracion: '9 min' },
      { nombre: 'Postura y patrón de retención', duracion: '11 min' },
      { nombre: 'Tejido: cinco señales', duracion: '8 min' },
      { nombre: 'La ficha de valoración, campo a campo', duracion: '7 min' },
      { nombre: 'Interpretar sin diagnosticar', duracion: '6 min' },
      { nombre: 'Decidir la primera sesión', duracion: '7 min' },
    ],
  },
  {
    id: 'casos',
    titulo: 'Casos resueltos',
    etiqueta: 'Clases en vivo',
    hechas: 3,
    foto: 'valoracion-abdomen',
    lecciones: [
      { nombre: 'Tejido reactivo: cuándo no trabajar', duracion: '52 min' },
      { nombre: 'Postparto, primeros tres meses', duracion: '61 min' },
      { nombre: 'Retención con antecedente vascular', duracion: '48 min' },
      { nombre: 'Fibrosis postquirúrgica', duracion: '55 min' },
      { nombre: 'Abdomen tras diástasis', duracion: '57 min' },
      { nombre: 'Celulitis edematosa: qué prometer', duracion: '46 min' },
      { nombre: 'Piernas cansadas en verano', duracion: '39 min' },
      { nombre: 'Clienta que no mejora: revisar el criterio', duracion: '64 min' },
      { nombre: 'Menopausia y cambio de tejido', duracion: '51 min' },
      { nombre: 'Derivar: cuándo y a quién', duracion: '43 min' },
      { nombre: 'Planes de 12 semanas', duracion: '58 min' },
      { nombre: 'Casos de la comunidad, septiembre', duracion: '62 min' },
    ],
  },
  {
    id: 'negocio',
    titulo: 'Negocio y clientas',
    etiqueta: 'Formación de negocio',
    hechas: 0,
    foto: 'aula-negocio',
    lecciones: [
      { nombre: 'Cómo llega tu primera clienta', duracion: '10 min' },
      { nombre: 'Precio: del criterio al presupuesto', duracion: '12 min' },
      { nombre: 'Tu ficha del buscador, bien hecha', duracion: '8 min' },
      { nombre: 'IA para no vivir pegada al móvil', duracion: '14 min' },
      { nombre: 'Qué publicar cuando no tienes tiempo', duracion: '9 min' },
      { nombre: 'La clienta que no vuelve', duracion: '11 min' },
      { nombre: 'Planes cerrados en lugar de sesiones', duracion: '13 min' },
      { nombre: 'Tus números mínimos del mes', duracion: '10 min' },
    ],
  },
  {
    id: 'protocolos',
    titulo: 'Protocolos Divine',
    etiqueta: 'Consulta rápida',
    hechas: 9,
    foto: 'formacion-pierna',
    lecciones: [
      { nombre: 'Drenaje: secuencia base y variantes', duracion: 'PDF' },
      { nombre: 'Reductivo por zonas', duracion: 'PDF' },
      { nombre: 'Maderoterapia con criterio', duracion: 'PDF' },
      { nombre: 'Guion de primera visita', duracion: 'PDF' },
      { nombre: 'Ficha de valoración Divine', duracion: 'PDF' },
      { nombre: 'Postparto: pautas por fase', duracion: 'PDF' },
      { nombre: 'Postquirúrgico: qué no tocar', duracion: 'PDF' },
      { nombre: 'Consentimiento y contraindicaciones', duracion: 'PDF' },
      { nombre: 'Plantilla de plan de sesiones', duracion: 'PDF' },
    ],
  },
];

export function metaCurso(c: CursoAula) {
  const n = c.lecciones.length;
  if (c.id === 'casos') return `${n} grabaciones · 10 h 36`;
  if (c.id === 'protocolos') return `${n} fichas · PDF`;
  return `${n} lecciones · ${c.id === 'negocio' ? '1 h 27' : '48 min'}`;
}

export function progresoCurso(c: CursoAula) {
  const total = c.lecciones.length;
  const hechas = Math.min(c.hechas, total);
  return {
    hechas,
    total,
    pct: Math.round((hechas / total) * 100),
    texto:
      hechas === 0
        ? 'Sin empezar'
        : hechas === total
          ? 'Completado'
          : `${hechas} de ${total} completadas`,
  };
}

export const DESCARGABLES = [
  { nombre: 'Ficha de valoración Divine', tipo: 'PDF imprimible' },
  { nombre: 'Guion de primera visita', tipo: 'PDF · 2 páginas' },
  { nombre: 'Tabla de progresión por zonas', tipo: 'PDF' },
  { nombre: 'Plantilla de plan de sesiones', tipo: 'Hoja de cálculo' },
];

export const ESTADO_CURSO: Record<string, string> = {
  lectura: 'Publicado',
  casos: 'Publicado',
  negocio: 'Borrador',
  protocolos: 'Publicado',
};

/* ==========================================================================
   Alumna
   ========================================================================== */
export const PREPARACION = [
  { nombre: 'Qué traer a la formación', tipo: 'PDF · 2 páginas' },
  { nombre: 'Ficha de valoración en blanco', tipo: 'PDF imprimible' },
  { nombre: 'Cómo llegar y horarios', tipo: 'Ficha' },
];

export const BLOQUES_AULA = [
  {
    titulo: 'Antes de venir',
    estado: 'Disponible',
    items: [
      { nombre: 'Qué traer a la formación', tipo: 'PDF' },
      { nombre: 'Lectura previa: observar antes de tocar', tipo: 'PDF · 6 páginas' },
    ],
  },
  {
    titulo: 'Durante',
    estado: 'Se abre el 14 de noviembre',
    items: [
      { nombre: 'Fichas de valoración', tipo: 'PDF imprimible' },
      { nombre: 'Guion de primera visita', tipo: 'PDF' },
    ],
  },
  {
    titulo: 'Después',
    estado: 'Al terminar',
    items: [
      { nombre: 'Grabaciones de repaso', tipo: 'Vídeo' },
      { nombre: 'Protocolos de la formación', tipo: 'PDF' },
    ],
  },
];

export const PAGOS_ALUMNA = [
  {
    concepto: 'Reserva de plaza · Formación Base',
    fecha: '2 sept 2026',
    importe: '350,00 €',
    estado: 'Pagado',
  },
  {
    concepto: 'Resto de la formación',
    fecha: 'Se paga el 14 nov, primer día',
    importe: '1.100,00 €',
    estado: 'Pendiente',
  },
];

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
    texto: 'Cómo conseguir clientas y usar IA en tu consulta.',
    ir: 'clases',
  },
  {
    etiqueta: 'Buscador',
    titulo: 'Tu ficha pública',
    texto: 'Visible en Madrid desde febrero.',
    ir: 'perfil',
  },
];

export const CLASES_ANTERIORES = [
  { tema: 'Tejido reactivo: cuándo no trabajar', fecha: '4 sept 2026' },
  { tema: 'Primera visita en diez minutos', fecha: '7 ago 2026' },
  { tema: 'Postparto: los tres primeros meses', fecha: '3 jul 2026' },
  { tema: 'Cómo explicar tu criterio y sostener el precio', fecha: '5 jun 2026' },
];

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

export const CLIENTAS: Clienta[] = [
  {
    nombre: 'Ana Belmonte',
    iniciales: 'AB',
    telefono: '600 11 22 33',
    plan: 'Drenaje · plan de 8 sesiones',
    hechas: 5,
    total: 8,
    ultima: '1 oct',
    proxima: 'Lun 5, 10:00',
    estado: 'En plan',
    nota: 'Tolera bien la intensidad. Revisar tobillo derecho en la próxima.',
  },
  {
    nombre: 'Elena Prats',
    iniciales: 'EP',
    telefono: '655 44 12 90',
    plan: 'Postparto · plan de 8 sesiones',
    hechas: 2,
    total: 8,
    ultima: '29 sept',
    proxima: 'Mar 6, 11:30',
    estado: 'En plan',
    nota: 'Cesárea en junio. Trabajo perimetral, sin presión en la cicatriz.',
  },
  {
    nombre: 'Rocío Vidal',
    iniciales: 'RV',
    telefono: '644 55 66 77',
    plan: 'Primera visita pendiente',
    hechas: 0,
    total: 1,
    ultima: '—',
    proxima: 'Lun 5, 17:30',
    estado: 'Nueva',
    nota: 'Llega por el buscador. Quiere valorar retención en piernas.',
  },
  {
    nombre: 'Carmen Ruiz',
    iniciales: 'CR',
    telefono: '610 98 76 54',
    plan: 'Drenaje · mantenimiento mensual',
    hechas: 11,
    total: 12,
    ultima: '25 sept',
    proxima: 'Mié 7, 13:00',
    estado: 'Activa',
    nota: 'Dos años con nosotras. Cierra el plan en octubre y renueva.',
  },
  {
    nombre: 'Sofía Márquez',
    iniciales: 'SM',
    telefono: '699 33 21 45',
    plan: 'Reductivo · valoración hecha',
    hechas: 1,
    total: 6,
    ultima: '12 ago',
    proxima: 'Sin cita',
    estado: 'Fría',
    nota: 'No vuelve desde agosto. Escribirle con la propuesta de plan cerrada.',
  },
  {
    nombre: 'Irene Company',
    iniciales: 'IC',
    telefono: '622 87 65 43',
    plan: 'Maderoterapia · 4 sesiones',
    hechas: 3,
    total: 4,
    ultima: '2 oct',
    proxima: 'Vie 9, 18:30',
    estado: 'Activa',
    nota: 'Pregunta por el plan de postparto de su hermana.',
  },
];

export const FILTROS_CRM = ['Todas', 'En plan', 'Nuevas', 'Sin volver'];

export const KPIS_CRM = [
  { label: 'Clientas activas', valor: '38', nota: '6 llegaron por el buscador' },
  { label: 'En plan abierto', valor: '12', nota: '64 sesiones comprometidas' },
  { label: 'Sin volver (60 días)', valor: '4', nota: 'pendientes de seguimiento' },
  { label: 'Ticket medio', valor: '78 €', nota: 'por sesión facturada' },
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

export const FACTURAS: Factura[] = [
  { num: 'F2026-0042', cliente: 'Carmen Ruiz', concepto: 'Drenaje · sesión suelta', fecha: '2 oct 2026', importe: '65,00 €', estado: 'Cobrada' },
  { num: 'F2026-0041', cliente: 'Elena Prats', concepto: 'Plan postparto · 2º pago', fecha: '29 sept 2026', importe: '280,00 €', estado: 'Cobrada' },
  { num: 'F2026-0040', cliente: 'Irene Company', concepto: 'Maderoterapia · 4 sesiones', fecha: '26 sept 2026', importe: '240,00 €', estado: 'Pendiente' },
  { num: 'F2026-0039', cliente: 'Ana Belmonte', concepto: 'Plan drenaje · 1er pago', fecha: '21 sept 2026', importe: '340,00 €', estado: 'Cobrada' },
  { num: 'F2026-0038', cliente: 'Sofía Márquez', concepto: 'Valoración Divine', fecha: '12 ago 2026', importe: '45,00 €', estado: 'Vencida' },
];

export const FILTROS_FACT = ['Todas', 'Cobrada', 'Pendiente', 'Vencida'];

export const KPIS_FACT = [
  { label: 'Facturado este mes', valor: '2.480 €', nota: '32 facturas emitidas' },
  { label: 'Cobrado', valor: '2.180 €', nota: '88 % del emitido' },
  { label: 'Pendiente de cobro', valor: '300 €', nota: '2 facturas' },
  { label: 'Vencido', valor: '45 €', nota: '1 factura de agosto' },
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

export const SEMANA: { dow: string; num: number; citas: Cita[] }[] = [
  {
    dow: 'Lun',
    num: 5,
    citas: [
      { hora: '10:00', cliente: 'Ana Belmonte', motivo: 'Drenaje · 2ª sesión', estado: 'Confirmada', tipo: 'conf' },
      { hora: '17:30', cliente: 'Rocío Vidal', motivo: 'Primera visita', estado: 'Nueva', tipo: 'nueva' },
    ],
  },
  {
    dow: 'Mar',
    num: 6,
    citas: [
      { hora: '11:30', cliente: 'Elena Prats', motivo: 'Postparto · plan 8 sesiones', estado: 'Confirmada', tipo: 'conf' },
    ],
  },
  {
    dow: 'Mié',
    num: 7,
    citas: [
      { hora: '09:30', cliente: 'Sofía Márquez', motivo: 'Reductivo · valoración', estado: 'Pendiente', tipo: 'pend' },
      { hora: '13:00', cliente: 'Carmen Ruiz', motivo: 'Drenaje · 5ª sesión', estado: 'Confirmada', tipo: 'conf' },
    ],
  },
  { dow: 'Jue', num: 8, citas: [] },
  {
    dow: 'Vie',
    num: 9,
    citas: [
      { hora: '16:00', cliente: 'Lucía Nadal', motivo: 'Postquirúrgico', estado: 'Nueva', tipo: 'nueva' },
      { hora: '18:30', cliente: 'Irene Company', motivo: 'Maderoterapia', estado: 'Confirmada', tipo: 'conf' },
    ],
  },
  {
    dow: 'Sáb',
    num: 10,
    citas: [
      { hora: '10:30', cliente: 'Paula Gil', motivo: 'Primera visita', estado: 'Pendiente', tipo: 'pend' },
    ],
  },
];

export const POR_CONFIRMAR = [
  {
    cliente: 'Rocío Vidal',
    cuando: 'lunes 5, 17:30',
    detalle: 'Primera visita · 600 44 55 66 · «Quiero valorar retención en piernas»',
  },
  {
    cliente: 'Lucía Nadal',
    cuando: 'viernes 9, 16:00',
    detalle: 'Postquirúrgico · 655 22 11 00 · «Operada hace tres semanas»',
  },
];

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const TRATAMIENTOS_PERFIL = [
  'Drenaje linfático',
  'Postparto',
  'Reductivo corporal',
  'Postquirúrgico',
  'Maderoterapia',
  'Masaje profundo',
];

export const TRATAMIENTOS_ACTIVOS = ['Drenaje linfático', 'Postparto', 'Reductivo corporal'];

/** La membresía está en beta: no hay cuota, no hay recibos. Esto es lo que
 *  falta para poder abrirla al público y ponerle precio. */
export const PENDIENTE_BETA = [
  { que: 'Clase en vivo al mes, con grabación', listo: true },
  { que: 'Canal privado de casos', listo: true },
  { que: 'Fichas y protocolos descargables', listo: true },
  { que: 'Ficha pública en el mapa de terapeutas', listo: true },
  { que: 'Formación de negocio y clientas', listo: false },
  { que: 'Precio y condiciones de alta', listo: false },
];

/* ==========================================================================
   Sorela (admin)
   ========================================================================== */
export const KPIS_ADMIN = [
  { label: 'Terapeutas certificadas', valor: '87', nota: 'desde el primer grupo' },
  { label: 'Plazas vendidas este mes', valor: '7', nota: '1 reserva sin pagar' },
  { label: 'Facturado este mes', valor: '5.240 €', nota: 'reservas y pagos finales' },
  { label: 'Lista de la comunidad', valor: '128', nota: 'esperando apertura' },
];

export const POR_APROBAR = [
  { nombre: 'Patricia Soler', ciudad: 'Palma', nota: 'Certificada en 2026 · ficha completa' },
  { nombre: 'Lucía Ferrer', ciudad: 'Barcelona', nota: 'Certificada en 2026 · falta dirección' },
  { nombre: 'Noelia Bravo', ciudad: 'Zaragoza', nota: 'Certificada en 2026 · sin foto' },
];

export const INSCRITAS = [
  { curso: 'Formación Base · Madrid', cuando: '14–16 nov 2026', plazas: '5/8' },
  { curso: 'Nivel Avanzado · Valencia', cuando: '30 ene–1 feb 2027', plazas: '1/8' },
  { curso: 'Lectura corporal · Sevilla', cuando: '7–8 mar 2027', plazas: '2/12' },
];

export const RESERVAS_AGREGADAS = [
  { nombre: 'Marta Ibáñez', pct: 86, total: '31' },
  { nombre: 'Nuria Sanchís', pct: 64, total: '23' },
  { nombre: 'Carla Redondo', pct: 47, total: '17' },
  { nombre: 'Ainhoa Etxebarria', pct: 33, total: '12' },
];

export type Lead = {
  nombre: string;
  ciudad: string;
  origen: string;
  interes: string;
  cuando: string;
  estado: 'Nuevo' | 'Contactado' | 'Reservado';
  nota: string;
};

export const LEADS: Lead[] = [
  { nombre: 'Rocío Bermejo', ciudad: 'Toledo', origen: 'Asistente de la web', interes: 'Formación Base · Madrid', cuando: 'hoy, 09:14', estado: 'Nuevo', nota: 'Pregunta si con seis años de cabina le vale.' },
  { nombre: 'Verónica Iglesias', ciudad: 'Madrid', origen: 'Formulario', interes: 'Formación Base · Madrid', cuando: 'ayer', estado: 'Contactado', nota: 'Quiere fraccionar el pago en tres meses.' },
  { nombre: 'Sandra Requena', ciudad: 'Alicante', origen: 'Lista de la comunidad', interes: 'Comunidad', cuando: 'hace 2 días', estado: 'Nuevo', nota: 'Todavía no se ha formado. Avisar de la de Sevilla.' },
  { nombre: 'Beatriz Olmo', ciudad: 'Valencia', origen: 'Instagram', interes: 'Nivel Avanzado · Valencia', cuando: 'hace 3 días', estado: 'Reservado', nota: 'Reserva de 400 € pagada el día 15.' },
  { nombre: 'Miriam Castaño', ciudad: 'Sevilla', origen: 'Asistente de la web', interes: 'Lectura corporal · Sevilla', cuando: 'hace 4 días', estado: 'Contactado', nota: 'Pidió el temario por correo.' },
  { nombre: 'Laura Peiró', ciudad: 'Castellón', origen: 'Mapa de terapeutas', interes: 'Comunidad', cuando: 'hace 6 días', estado: 'Nuevo', nota: 'Certificada en 2025, quiere volver a la comunidad.' },
];

export const FILTROS_LEADS = ['Todos', 'Nuevo', 'Contactado', 'Reservado'];

export const KPIS_LEADS = [
  { label: 'Leads este mes', valor: '34', nota: '18 por el asistente de la web' },
  { label: 'Contactados', valor: '21', nota: 'quedan 13 sin respuesta tuya' },
  { label: 'Convertidos en plaza', valor: '7', nota: '21 % del total' },
  { label: 'Lista de la comunidad', valor: '128', nota: 'esperando apertura' },
];

export const CONVOCATORIAS = [
  { curso: 'Formación Base', ciudad: 'Madrid', fechas: '14–16 de noviembre de 2026', vendidas: 5, total: 8, pct: 63, ingreso: '7.250 € facturados', pendiente: '1 reserva sin pagar' },
  { curso: 'Nivel Avanzado', ciudad: 'Valencia', fechas: '30 de enero – 1 de febrero de 2027', vendidas: 1, total: 8, pct: 13, ingreso: '1.650 € facturados', pendiente: 'Al día' },
  { curso: 'Lectura corporal', ciudad: 'Sevilla', fechas: '7–8 de marzo de 2027', vendidas: 2, total: 12, pct: 17, ingreso: '1.780 € facturados', pendiente: 'Al día' },
];

export const AGENDA_SORELA = [
  { cuando: 'Jue 8 oct · 20:00', que: 'Clase en vivo de la comunidad', detalle: 'Retención severa en piernas' },
  { cuando: 'Mar 13 oct · 17:00', que: 'Llamadas de valoración', detalle: '4 leads de Madrid y Toledo' },
  { cuando: '14–16 nov · 10:00', que: 'Formación Base · Madrid', detalle: '5 inscritas de 8' },
  { cuando: '30 nov · 12:00', que: 'Cierre de facturación', detalle: '4T 2026' },
];

export const INGRESOS_ADMIN = [
  { label: 'Facturado este mes', valor: '5.240 €', nota: 'reservas y pagos finales' },
  { label: 'Cobrado', valor: '4.890 €', nota: '93 % del emitido' },
  { label: 'Pendiente', valor: '350 €', nota: '1 reserva sin pagar' },
  { label: 'Comunidad', valor: '0 €', nota: 'sin abrir · 128 en lista' },
];

export const FACTURAS_ADMIN: Factura[] = [
  { num: 'A2026-0118', cliente: 'Beatriz Olmo', concepto: 'Reserva · Nivel Avanzado', fecha: '15 sept 2026', importe: '400,00 €', estado: 'Cobrada' },
  { num: 'A2026-0117', cliente: 'Marta Ibáñez', concepto: 'Formación Base · pago final', fecha: '12 sept 2026', importe: '1.100,00 €', estado: 'Cobrada' },
  { num: 'A2026-0116', cliente: 'Noelia Bravo', concepto: 'Reserva · Formación Base', fecha: '8 sept 2026', importe: '350,00 €', estado: 'Pendiente' },
  { num: 'A2026-0115', cliente: 'Miriam Castaño', concepto: 'Reserva · Lectura corporal', fecha: '3 sept 2026', importe: '250,00 €', estado: 'Cobrada' },
];
