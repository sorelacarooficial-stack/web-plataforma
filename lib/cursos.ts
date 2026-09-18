export type Curso = {
  slug: string;
  nombre: string;
  ciudad: string;
  fechas: string;
  duracion: string;
  horario: string;
  plazas: number;
  total: number;
  precio: string;
  reserva: string;
  diasCancelacion: number;
  frase: string;
  promesa: string;
  capacidades: string[];
  incluye: string[];
};

export const CURSOS: Curso[] = [
  {
    slug: 'formacion-base',
    nombre: 'Técnica Divine · Formación Base',
    ciudad: 'Madrid',
    fechas: '14–16 de noviembre de 2026',
    duracion: '24 h en 3 días',
    horario: '10:00 – 19:00',
    plazas: 3,
    total: 8,
    precio: '1.450',
    reserva: '350',
    diasCancelacion: 15,
    frase:
      'La puerta de entrada al método: sales valorando un cuerpo y decidiendo la primera sesión.',
    promesa:
      'Al salir valoras un cuerpo en los primeros minutos y decides el trabajo de la sesión con una razón que puedes explicar.',
    capacidades: [
      'Valorar postura, tejido y retención antes de tocar, con una ficha ordenada.',
      'Interpretar lo que ves y decidir qué no conviene trabajar ese día.',
      'Construir la sesión completa para ese cuerpo, en orden y con intensidad justificada.',
      'Contarle a tu clienta qué has visto y por qué trabajas así.',
    ],
    incluye: [
      '24 horas presenciales en grupo de ocho',
      'Material de trabajo y fichas de valoración',
      'Certificado de terapeuta Divine',
      'Acceso al aula online con los apoyos del curso',
      'Sitio reservado en la lista de la comunidad',
    ],
  },
  {
    slug: 'nivel-avanzado',
    nombre: 'Técnica Divine · Nivel Avanzado',
    ciudad: 'Valencia',
    fechas: '30 de enero – 1 de febrero de 2027',
    duracion: '24 h en 3 días',
    horario: '10:00 – 19:00',
    plazas: 7,
    total: 8,
    precio: '1.650',
    reserva: '400',
    diasCancelacion: 15,
    frase:
      'Para las que ya trabajan con el método y se topan con los casos que no encajan en nada.',
    promesa:
      'Al salir trabajas casos complejos —postquirúrgico, retención severa, tejido reactivo— sin salirte de criterio.',
    capacidades: [
      'Adaptar el trabajo a tejido reactivo y a postoperatorios recientes.',
      'Encadenar sesiones en un plan de varias semanas y ajustarlo con datos.',
      'Detectar cuándo derivar y a quién.',
      'Documentar la evolución para sostener el precio de tu servicio.',
    ],
    incluye: [
      '24 horas presenciales en grupo de ocho',
      'Material de trabajo y fichas de seguimiento',
      'Certificado de nivel avanzado',
      'Acceso al aula online con los apoyos del curso',
      'Sitio reservado en la lista de la comunidad',
    ],
  },
  {
    slug: 'lectura-corporal',
    nombre: 'Lectura corporal · Intensivo',
    ciudad: 'Sevilla',
    fechas: '7–8 de marzo de 2027',
    duracion: '16 h en 2 días',
    horario: '10:00 – 19:00',
    plazas: 10,
    total: 12,
    precio: '890',
    reserva: '250',
    diasCancelacion: 10,
    frase:
      'Dos días para cambiar solo una cosa: tu primera visita. Se aplica el lunes siguiente.',
    promesa:
      'Al salir tienes una primera visita entera: qué miras, qué preguntas, qué anotas y qué propones.',
    capacidades: [
      'Dirigir una primera visita de diez minutos que ordena todo el tratamiento.',
      'Rellenar una ficha de valoración que después te sirve para decidir.',
      'Traducir lo que observas a un plan que la clienta entiende.',
      'Cerrar la visita con una propuesta concreta, sin improvisar el precio.',
    ],
    incluye: [
      '16 horas presenciales',
      'Fichas de valoración impresas',
      'Certificado de asistencia',
      'Acceso al aula online con los apoyos del curso',
      'Sitio reservado en la lista de la comunidad',
    ],
  },
];

export const getCurso = (slug: string) => CURSOS.find((c) => c.slug === slug);

export const meta = (c: Curso) => `${c.ciudad} · ${c.fechas} · ${c.duracion}`;

export const metaLarga = (c: Curso) =>
  `${c.ciudad} · ${c.fechas} · ${c.horario} · grupo de ${c.total}`;

/** El prototipo solo enseña el contador cuando la urgencia es real. */
export const mostrarPlazas = (c: Curso) => c.plazas <= 4;

export const plazasTexto = (c: Curso) =>
  `Quedan ${c.plazas} de ${c.total} plazas`;

export const comoEs = (c: Curso) =>
  `Sois ${c.total} como máximo. Trabajas sobre cuerpo real con Sorela corrigiendo al lado de la camilla, no mirando un vídeo para replicarlo en casa.`;

export const reservaTexto = (c: Curso) =>
  `Reservas tu plaza con ${c.reserva} € y pagas el resto el primer día.`;

export const cancelacionTexto = (c: Curso) =>
  `Si no puedes venir, avisando con ${c.diasCancelacion} días te devolvemos la reserva.`;
