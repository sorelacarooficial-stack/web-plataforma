/**
 * «Empieza aquí»: el curso corto de bienvenida de la plataforma.
 *
 * Los guiones están en docs/guiones-empieza-aqui.md. Aquí va lo que se pinta
 * de cada lección: su número, a quién le sale, tres líneas y UNA tarea.
 *
 * Una sola versión con partes (decidido el 16 nov 2026): los videos 00, 01,
 * 02 y 07 los ven todas; el resto, o la academia online o las homologadas
 * (con la Membresía). Sorela está fuera: no se estrena, solo lo mira.
 *
 * El video de cada lección va en `video` cuando Sorela lo grabe: una ruta de
 * /public (`/empieza-aqui/01.mp4`) o un enlace de YouTube. Vacío, la lección
 * se ve igual, con «Tu video llega pronto» en su sitio.
 *
 * Fuera hasta que exista: el video del Agente IA Divine.
 */

export type ParaQuien = 'todas' | 'academia' | 'homologadas';

/** Lo que hace el botón de la tarea. Los ids de vista son los de lib/plataforma.ts. */
export type AccionTarea =
  | { tipo: 'leccion'; id: string }
  | { tipo: 'perfil' }
  | { tipo: 'vista'; vista: 'aula' | 'agenda' | 'comunidad' | 'perfil' | 'inicio' }
  | { tipo: 'grupo' }
  | { tipo: 'celular' }
  | { tipo: 'ficha' }
  | { tipo: 'calendario' };

export type LeccionInicio = {
  id: string;
  numero: string;
  titulo: string;
  para: ParaQuien;
  /** Lo que dura el video, para la lista: «60 s». */
  duracion: string;
  /** Tres líneas como mucho. */
  lineas: string[];
  tarea: { texto: string; boton: string; accion: AccionTarea };
  /** Lo que va debajo, si lo hay (plantilla, pasos). */
  extra?: { titulo: string; texto: string };
  video: string;
};

const PLANTILLA = 'Soy [tu nombre], de [tu ciudad].\nTrabajo con [lo que haces].\nEste mes quiero [una meta].';

export const LECCIONES_INICIO: LeccionInicio[] = [
  {
    id: 'ea-00',
    numero: '00',
    titulo: 'Bienvenida',
    para: 'todas',
    duracion: '22 s',
    lineas: ['Este es tu espacio para entrenar tus manos y tu mirada, paso a paso.', 'Los videos de este curso son cortos: uno por cada parte de la plataforma.'],
    tarea: { texto: 'Empieza por el video 01.', boton: 'Ir al video 01', accion: { tipo: 'leccion', id: 'ea-01' } },
    video: '/empieza-aqui/00.mp4',
  },
  {
    id: 'ea-01',
    numero: '01',
    titulo: 'Te doy la bienvenida',
    para: 'todas',
    duracion: '32 s',
    lineas: [
      'No se trata solo de poner las manos: se trata de saber qué observar, qué interpretar y cómo decidir antes de tocar.',
      'Eso es lo que vamos a entrenar aquí, juntas.',
    ],
    tarea: { texto: 'Completa tu perfil: tu foto y tu ciudad. Te toma un minuto.', boton: 'Completar mi perfil', accion: { tipo: 'perfil' } },
    video: '/empieza-aqui/01.mp4',
  },
  {
    id: 'ea-02',
    numero: '02',
    titulo: 'Tu plataforma en un minuto',
    para: 'todas',
    duracion: '60 s',
    lineas: [
      'Inicio: tu camino. Clases: tus videos y dosieres. Agenda: tus fechas. Perfil: tus datos.',
      'Para verlo con calma, toca «Ver el recorrido» arriba.',
    ],
    tarea: { texto: 'Guarda la plataforma en tu celular, para entrar con un toque.', boton: 'Ya la guardé', accion: { tipo: 'celular' } },
    extra: {
      titulo: 'Cómo guardarla',
      texto:
        'iPhone: abre la plataforma en Safari › botón compartir › «Agregar a inicio».\nAndroid: abre la plataforma en Chrome › los tres puntos › «Agregar a la pantalla principal».',
    },
    video: '',
  },
  {
    id: 'ea-03a',
    numero: '03',
    titulo: 'Cómo avanzas en tu formación',
    para: 'academia',
    duracion: '44 s',
    lineas: [
      'Cuatro módulos, en orden: Precurso, Desbloqueo, Tonificación y moldeo, y Facial y brazos.',
      'Primero lees el dosier; al terminarlo se abren sus videos; al verlos, se abre el módulo siguiente.',
    ],
    tarea: { texto: 'Abre el Módulo 01 y empieza a leer.', boton: 'Abrir el Módulo 01', accion: { tipo: 'vista', vista: 'aula' } },
    video: '/empieza-aqui/03a.mp4',
  },
  {
    id: 'ea-03b',
    numero: '03',
    titulo: 'Por dónde empezar',
    para: 'homologadas',
    duracion: '13 s',
    lineas: ['Tienes todas tus clases abiertas para repasar. No hace falta verlas de golpe.', 'Empieza por la zona que más trabajas en tu cabina.'],
    tarea: { texto: 'Abre hoy tu primera clase y mírala hasta el final.', boton: 'Ir a mis clases', accion: { tipo: 'vista', vista: 'aula' } },
    video: '/empieza-aqui/03b.mp4',
  },
  {
    id: 'ea-04a',
    numero: '04',
    titulo: 'Tus reuniones conmigo',
    para: 'academia',
    duracion: '60 s',
    lineas: [
      'Al terminar el Módulo 01 te sale un botón para pedir tu reunión con Sorela. Al final, las prácticas juntas.',
      'Cada hora sale en Colombia, Venezuela y España. La reunión queda en tu Agenda.',
    ],
    tarea: { texto: 'Entra en tu Agenda y mira cómo es.', boton: 'Abrir mi agenda', accion: { tipo: 'vista', vista: 'agenda' } },
    video: '',
  },
  {
    id: 'ea-04b',
    numero: '04',
    titulo: 'La clase en vivo',
    para: 'homologadas',
    duracion: '21 s',
    lineas: ['Nos vemos en vivo para resolver tus casos reales. La fecha sale en tu Inicio y en Comunidad.', 'Llega con tu pregunta lista.'],
    tarea: { texto: 'Añade la próxima clase a tu calendario.', boton: 'Añadir a mi calendario', accion: { tipo: 'calendario' } },
    video: '/empieza-aqui/04b.mp4',
  },
  {
    id: 'ea-05a',
    numero: '05',
    titulo: 'Tu grupo y cómo pedir ayuda',
    para: 'academia',
    duracion: '60 s',
    lineas: [
      'En el grupo de WhatsApp de la Comunidad Divine van los avisos y conoces a otras terapeutas.',
      'Si te trabas: mira otra vez el dosier o el video, luego pregunta en el grupo, y los casos, a tu reunión.',
    ],
    tarea: { texto: 'Entra al grupo y preséntate.', boton: 'Entrar al grupo', accion: { tipo: 'grupo' } },
    extra: { titulo: 'Para presentarte', texto: PLANTILLA },
    video: '',
  },
  {
    id: 'ea-05b',
    numero: '05',
    titulo: 'Tu comunidad y cómo pedir ayuda',
    para: 'homologadas',
    duracion: '22 s',
    lineas: [
      'En Comunidad está el muro: casos, dudas, resultados y recursos de las homologadas.',
      'Si te trabas: busca en el muro, publícalo como «Duda», y los casos largos, a la clase en vivo.',
    ],
    tarea: { texto: 'Preséntate en el muro.', boton: 'Ir al muro', accion: { tipo: 'vista', vista: 'comunidad' } },
    extra: { titulo: 'Para presentarte', texto: PLANTILLA },
    video: '/empieza-aqui/05b.mp4',
  },
  {
    id: 'ea-06',
    numero: '06',
    titulo: 'Que las clientas te encuentren',
    para: 'homologadas',
    duracion: '38 s',
    lineas: [
      'En la web, «Localiza tu terapeuta» enseña solo a las homologadas por Sorela.',
      'Foto tuya y real, tu ciudad y lo que haces, contado para quien te lee.',
    ],
    tarea: { texto: 'Activa tu ficha hoy. Si no está activa, nadie te puede encontrar.', boton: 'Activar mi ficha', accion: { tipo: 'ficha' } },
    video: '/empieza-aqui/06.mp4',
  },
  {
    id: 'ea-07',
    numero: '07',
    titulo: 'Tus próximos pasos',
    para: 'todas',
    duracion: '28 s',
    lineas: ['Tus primeros pasos están en tu Inicio y se marcan solos cuando los haces.', 'No tiene que ser perfecto. Tiene que empezar.'],
    tarea: { texto: 'Haz tus primeros pasos de esta semana.', boton: 'Ver mis primeros pasos', accion: { tipo: 'vista', vista: 'inicio' } },
    video: '/empieza-aqui/07.mp4',
  },
];

export type Publico = 'academia' | 'homologadas';

/** Las lecciones que le tocan, en orden. */
export function leccionesDe(publico: Publico): LeccionInicio[] {
  return LECCIONES_INICIO.filter((l) => l.para === 'todas' || l.para === publico);
}

export const esLeccionInicio = (id: unknown): id is string => typeof id === 'string' && LECCIONES_INICIO.some((l) => l.id === id);

/** Las marcas que no se pueden saber solas y se apuntan al tocar su botón. */
export const MARCAS = ['celular', 'grupo', 'calendario'] as const;
export type Marca = (typeof MARCAS)[number];
export const esMarca = (x: unknown): x is Marca => typeof x === 'string' && (MARCAS as readonly string[]).includes(x);

/** Lo que se guarda en `usuarios/{uid}.empiezaAqui`. */
export type EstadoInicio = { vistas: string[]; marcas: Marca[] };

export function leerEstadoInicio(crudo: unknown): EstadoInicio {
  const c = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const lista = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    vistas: lista(c.vistas).filter(esLeccionInicio),
    marcas: lista(c.marcas).filter(esMarca),
  };
}
