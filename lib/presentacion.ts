/**
 * El contenido de la presentación profesional.
 *
 * Es la página que Sorela manda a quien se plantea representarla o trabajar
 * con ella: su trayectoria, el método, los resultados y lo que hay montado
 * alrededor. Sale del documento «Presentación profesional · Técnica Divine» y
 * de la reescritura del apartado de efectos que ella misma envió.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * QUÉ SE HA DEJADO FUERA DEL DOCUMENTO ORIGINAL, Y POR QUÉ
 *
 * Esta página es pública. Una página pública en España es comunicación
 * comercial, y la de un servicio estético no puede atribuirse efectos sobre la
 * salud. Del documento original no se han traído:
 *
 *   · «eliminación de toxinas», «reforzar el sistema inmunitario»,
 *     «reactivación de los órganos internos», «pérdida de peso que le hará
 *     bajar tallas» y la palabra «milagrosa». Son exactamente las frases que
 *     la propia Sorela pidió sustituir por el texto de EFECTOS Y RESPUESTA
 *     FISIOLÓGICA que está más abajo, porque —en sus palabras— «son muy
 *     fuertes para un gremio médico». Tenía razón, y además son las que no se
 *     pueden publicar.
 *
 *   · Las capturas de Instagram de otras profesionales con su nombre de
 *     usuario visible, usadas en el documento para ilustrar «resultados de
 *     otras técnicas». Enseñar el trabajo de una profesional identificable
 *     para decir que no da resultados es publicidad denigratoria y usa su
 *     imagen sin permiso. Ella misma avisó de que no tiene autorización
 *     escrita de publicación.
 *
 *   · «Recuerda que existen mentes pobres, no personas» y «el conocimiento es
 *     poder y el poder es dinero». No por legales: por estratégicas. Esta
 *     página la va a leer alguien que decide si la representa, y esas dos
 *     frases dicen de ella algo que no es lo que quiere que lean.
 *
 * Nada de esto se ha sustituido por invención: lo que hay viene del documento
 * o del texto que ella envió.
 * ──────────────────────────────────────────────────────────────────────────
 */

/* ==========================================================================
   El vídeo de apertura
   ========================================================================== */

/**
 * El vídeo horizontal con el que abre la página.
 *
 * Cuando esté grabado, se deja el archivo en `public/presentacion/` y se pone
 * aquí su ruta. Mientras valga `null`, el hueco se enseña con su proporción
 * real y un cartel, en vez de desaparecer: así se ve dónde va a ir y la página
 * no cambia de forma el día que se suba.
 */
export const VIDEO: { src: string; cartel?: string } | null = {
  /* El vídeo que entregó Sorela, sin volver a comprimir: ya venía comprimido
     y otra pasada solo lo ensuciaría. Se ha reordenado por dentro para que
     empiece a verse en cuanto se pulsa, sin esperar a bajarse entero. */
  src: '/presentacion/tecnica-divine.mp4',
  /* La portada es el fotograma de bienvenida: «Hola, bienvenidos y
     bienvenidas», con Sorela y sus alumnas. */
  cartel: '/presentacion/cartel.webp',
};

/* ==========================================================================
   Quién
   ========================================================================== */

export const PERFIL = {
  nombre: 'Sorela Caro',
  oficio: 'Creadora de la Técnica Divine®',
  titular: 'Treinta años de manos.',
  entradilla:
    'Con más de 30 años de experiencia en estética avanzada, Sorela Caro es una figura de referencia internacional en el cuidado integral del cuerpo y el rostro. Su búsqueda constante de la excelencia la llevó a desarrollar la Técnica Divine, un método exclusivo de drenaje y modelado reconocido en España como «la técnica del futuro en estética», respaldado por médicos estéticos y cirujanos plásticos.',
};

export const CIFRAS: { dato: string; texto: string }[] = [
  { dato: '+30', texto: 'años en estética avanzada' },
  { dato: '2', texto: 'jornadas de formación presencial' },
  { dato: '5', texto: 'modelos reales por alumna' },
  { dato: '1', texto: 'método propio, registrado' },
];

/* ==========================================================================
   El método
   ========================================================================== */

export const METODO: { titulo: string; texto: string }[] = [
  {
    titulo: 'Una visión integral',
    texto:
      'La Técnica Divine combina técnicas especializadas de drenaje y modelado corporal en un protocolo diseñado para trabajar el cuerpo de forma global. Su aplicación se adapta a distintas zonas —abdomen, piernas y rostro, sobre todo— teniendo en cuenta las características y necesidades de cada cliente.',
  },
  {
    titulo: 'Linfodrenaje',
    texto:
      'El Linfodrenaje integra dos enfoques complementarios en una misma sesión: el trabajo de drenaje y las técnicas orientadas al modelado de la silueta. A través de maniobras específicas, el protocolo busca favorecer la sensación de ligereza y mejorar visualmente el contorno corporal.',
  },
  {
    titulo: 'Una experiencia diferencial',
    texto:
      'Divine va más allá de la aplicación de una técnica. Combina conocimiento, precisión, personalización y una experiencia de alto nivel, creando un entorno en el que cada cliente recibe una atención cuidada y adaptada a sus necesidades.',
  },
];

/* ==========================================================================
   Efectos y respuesta fisiológica

   Texto enviado por Sorela el 6 de octubre de 2026, redactado por ella para
   sustituir al apartado anterior. Se publica tal cual, sin añadir ni quitar
   una afirmación.
   ========================================================================== */

export const PREAMBULO_EFECTOS = [
  'La Técnica Divine® es una metodología manual propia basada en el conocimiento anatómico y fisiológico del sistema linfático, los tejidos y el movimiento de los líquidos intersticiales.',
  'Su aplicación busca favorecer determinadas respuestas fisiológicas y tisulares, respetando la anatomía, las características individuales y la respuesta de cada persona.',
];

export type GrupoEfectos = { titulo: string; puntos: string[] };

export const EFECTOS: GrupoEfectos[] = [
  {
    titulo: 'Respuesta sobre los líquidos y el sistema linfático',
    puntos: [
      'Favorece el movimiento de los líquidos intersticiales.',
      'Favorece el drenaje fisiológico a través del sistema linfático.',
      'Puede contribuir a disminuir la sensación de hinchazón, congestión y pesadez.',
      'Favorece la movilidad de los tejidos superficiales.',
    ],
  },
  {
    titulo: 'Respuesta sobre los tejidos',
    puntos: [
      'Favorece la microcirculación local.',
      'Puede contribuir a mejorar temporalmente el aspecto y la textura de los tejidos.',
      'Favorece la movilidad y adaptabilidad de los tejidos superficiales.',
      'Puede contribuir a una percepción de mayor ligereza y bienestar corporal.',
    ],
  },
  {
    titulo: 'Respuesta neurosensorial',
    puntos: [
      'Favorece la relajación.',
      'Puede contribuir a disminuir la sensación subjetiva de tensión corporal.',
      'El contacto manual puede generar una respuesta de bienestar y relajación.',
    ],
  },
  {
    titulo: 'Aplicación estética',
    puntos: [
      'Trabajo orientado al edema y la retención de líquidos de origen estético.',
      'Trabajo sobre la apariencia del contorno corporal.',
      'Trabajo orientado a mejorar la percepción y apariencia de los tejidos superficiales.',
      'Aplicación en determinados procesos postoperatorios, siempre que exista indicación y autorización del profesional sanitario responsable.',
    ],
  },
];

export const NOTA_EFECTOS =
  'La Técnica Divine® es una metodología de aplicación estética y formativa. No sustituye la valoración, diagnóstico ni tratamiento médico. Las aplicaciones en procesos postoperatorios o situaciones clínicas requieren la correspondiente indicación y autorización sanitaria.';

/* ==========================================================================
   Cierre
   ========================================================================== */

export const CIERRE = {
  titulo: 'Una nueva forma de entender el trabajo manual',
  parrafos: [
    'Divine® no nace de la repetición de una técnica tradicional. Nace de años de experiencia, observación y evolución profesional, con el propósito de comprender mejor el comportamiento de los tejidos y desarrollar una metodología propia desde las manos.',
    'La Técnica Divine® continúa evolucionando. Su objetivo es transformar la experiencia profesional en conocimiento, formación y nuevas líneas de desarrollo e investigación.',
  ],
  lema: 'Anatomía. Fisiología. Experiencia. Innovación.',
  remate:
    'El futuro de la técnica manual comienza con una nueva forma de comprender el cuerpo.',
};

/* ==========================================================================
   Qué hay montado alrededor
   ========================================================================== */

export const ESTRUCTURA: { titulo: string; items: string[] }[] = [
  {
    titulo: 'La formación',
    items: [
      'Dos jornadas presenciales completas, teoría y práctica',
      'Prácticas sobre cinco modelos reales',
      'Dossier en PDF y en papel',
      'Vídeos tutoriales paso a paso',
      'Documentación y consentimientos para la consulta',
      'Acuerdo de confidencialidad firmado por cada alumna',
    ],
  },
  {
    titulo: 'Después de la formación',
    items: [
      'Acompañamiento a distancia ilimitado',
      'Comunidad privada de profesionales',
      'Masterclasses, módulos y actualizaciones',
      'Tutorías personalizadas',
      'Placa de centro certificado Divine',
      'Un año de inscripción en el buscador «Localiza tu terapeuta»',
      'Derivación y recomendación de pacientes',
    ],
  },
  {
    titulo: 'La marca',
    items: [
      'Técnica Divine® como método propio y registrado',
      'Web y plataforma propias con aula y comunidad',
      'Reportaje fotográfico y audiovisual de cada formación',
      'Presencia en prensa del sector',
      'Red de terapeutas certificadas con mapa público',
    ],
  },
];

/* ==========================================================================
   Las imágenes

   Todas salen del material de Sorela. Las de rostro son antes y después de una
   misma sesión; las de cuerpo, de procesos de varias sesiones.
   ========================================================================== */

export const ROSTROS = [
  '/trayectoria/rostro-1.webp',
  '/trayectoria/rostro-2.webp',
  '/trayectoria/rostro-3.webp',
  '/trayectoria/rostro-4.webp',
  '/trayectoria/rostro-5.webp',
  '/trayectoria/rostro-6.webp',
];

/**
 * Los resultados de cuerpo.
 *
 * De las cinco del documento original quedan tres: las otras dos eran capturas
 * de pantalla de publicaciones de Instagram de otras profesionales, con su
 * nombre de usuario y la interfaz de la aplicación a la vista. Enseñar el
 * trabajo de otra como resultado propio no se arregla recortando la captura.
 * En su lugar van resultados del propio material de Divine.
 */
export const CUERPOS = [
  '/trayectoria/cuerpo-1.webp',
  '/trayectoria/cuerpo-4.webp',
  '/trayectoria/cuerpo-5.webp',
  '/trayectoria/cuerpo-b.webp',
  '/trayectoria/cuerpo-c.webp',
  '/trayectoria/cuerpo-6.webp',
];

/**
 * La prensa: la portada de Nueva Estética y las páginas del reportaje.
 *
 * Se recortan de la página del documento original donde aparecen en miniatura,
 * renderizada a 300 puntos por pulgada para que al ampliarlas se lea el texto.
 *
 * OJO con de dónde se saca esto. En una versión anterior aquí iban páginas
 * enteras del dossier confundidas con las de la revista: el dossier es el
 * documento confidencial que se entrega al firmar el acuerdo y no puede estar
 * en una página pública. Lo que va aquí son SOLO las de la revista.
 */
export const PRENSA = [
  '/trayectoria/revista-1.webp',
  '/trayectoria/revista-2.webp',
  '/trayectoria/revista-3.webp',
  '/trayectoria/revista-4.webp',
  '/trayectoria/revista-5.webp',
  '/trayectoria/revista-6.webp',
];

/**
 * El aviso de los antes y después.
 *
 * Va pegado a las fotos, no escondido en el pie de página. Desde 2021 la ley
 * española es explícita con los testimonios y los resultados en publicidad: lo
 * que se enseña tiene que ser real y no puede dar a entender que le va a pasar
 * lo mismo a todo el mundo.
 */
export const AVISO_IMAGENES =
  'Imágenes reales de clientas, cedidas con su autorización. Los resultados dependen de cada persona, de su punto de partida y del número de sesiones.';

/* ==========================================================================
   Lo que hace, en cinco líneas

   La lista grande de la página. Sale del propio documento: el método, la
   aplicación estética y lo que incluye la formación. Ninguna línea dice nada
   que no dijera ya el material de Sorela.
   ========================================================================== */

export const SERVICIOS: { nombre: string; texto: string }[] = [
  {
    nombre: 'Linfodrenaje',
    texto:
      'Drenaje y modelado en una misma sesión, con maniobras específicas orientadas a la sensación de ligereza y al contorno de la silueta.',
  },
  {
    nombre: 'Modelado corporal',
    texto:
      'Trabajo sobre la apariencia del contorno corporal en abdomen, flancos y piernas, adaptado a las características de cada persona.',
  },
  {
    nombre: 'Divine Facial',
    texto:
      'El protocolo facial de la técnica: trabajo manual sobre el rostro, con un cambio visible en una sola sesión, como enseñan las imágenes.',
  },
  {
    nombre: 'Formación presencial',
    texto:
      'Dos jornadas completas de teoría y práctica sobre cinco modelos reales, con dossier, vídeos paso a paso y diploma de terapeuta Divine.',
  },
  {
    nombre: 'Comunidad Divine',
    texto:
      'Acompañamiento ilimitado, masterclasses, tutorías y un mapa público de terapeutas certificadas que recibe y deriva clientas.',
  },
];

/**
 * Las fotos de la cinta que se desplaza con el scroll.
 *
 * SOLO ANTES Y DESPUÉS. La cinta es lo primero que se ve después de la
 * portada, y en una página que vende una formación lo primero tiene que ser
 * el resultado. Mezclar ahí láminas de anatomía o fotos de ambiente diluía lo
 * único que convence. Las láminas tienen su sitio: la sección de anatomía.
 */
export const CINTA = [
  '/trayectoria/rostro-1.webp',
  '/trayectoria/cuerpo-1.webp',
  '/trayectoria/rostro-4.webp',
  '/alumnas/resultado-2.webp',
  '/trayectoria/rostro-6.webp',
  '/alumnas/resultado-5.webp',
  '/trayectoria/rostro-2.webp',
  '/trayectoria/rostro-5.webp',
  '/alumnas/resultado-4.webp',
  '/trayectoria/rostro-3.webp',
  '/trayectoria/cuerpo-5.webp',
  '/alumnas/resultado-1.webp',
  '/trayectoria/cuerpo-4.webp',
  '/alumnas/resultado-3.webp',
];
