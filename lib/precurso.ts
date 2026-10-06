/**
 * El contenido de la landing del Precurso, para alumnas.
 *
 * Está aquí y no dentro de los componentes por el mismo motivo que el resto
 * del contenido del proyecto: son textos de Sorela, no lógica, y tienen que
 * poder corregirse sin tocar código ni entender React.
 *
 * DE DÓNDE SALE. Del dossier de 42 páginas del Precurso. Lo que hay aquí es
 * SOLO la parte que vende: quién es, qué es el método, cómo se imparte, qué se
 * lleva. El contenido formativo —anatomía, protocolo, presiones, maniobras—
 * NO está en este archivo y no puede estarlo: va detrás de la firma del
 * acuerdo de confidencialidad, que es justo lo que las alumnas se comprometen
 * a no divulgar. Publicarlo aquí sería regalar el producto y contradecir el
 * documento que se les hace firmar.
 *
 * Y HAY UNA SEGUNDA RAZÓN, QUE NO ES COMERCIAL. El dossier atribuye al
 * tratamiento efectos sobre la salud —defensas, sistema inmunitario, toxinas,
 * función renal, fibromialgia, migrañas, oncología— y promete pérdida de peso.
 * En un material formativo para profesionales que firman confidencialidad eso
 * es legítimo y además es lo que necesitan saber. En una web pública española
 * de estética es un reclamo sanitario, y está prohibido. Una revisión del
 * dossier marcó 57 pasajes así. Ninguno de ellos ha pasado a este archivo, y
 * ninguno debe pasar: si alguien añade uno, lo que se rompe no es el estilo.
 */

export type BloqueHorario = {
  /** La hora, tal y como se anuncia: «8:30 h». */
  hora: string;
  titulo: string;
  texto: string;
};

export type Jornada = {
  dia: string;
  titulo: string;
  resumen: string;
  bloques: BloqueHorario[];
};

/**
 * Las dos jornadas, con su horario.
 *
 * Las horas estaban en el dossier con dos grafías distintas en la misma página
 * —«8:30 H» y «8:30 h»— y con dos finales contradictorios para el primer
 * modelo del segundo día: «finalizando esta sección hacia las 15:00» en un
 * párrafo y «aproximadamente a las 16:00» dos párrafos después. Aquí se
 * escriben una sola vez, en minúscula y sin contradicción, que es lo que puede
 * leer alguien que viene a decidir si se apunta.
 */
export const JORNADAS: Jornada[] = [
  {
    dia: 'Día 1',
    titulo: 'Drenaje y desbloqueo',
    resumen:
      'La teoría y el primer trabajo sobre cuerpo real. Se empieza por abrir y desbloquear, que es lo que hace que todo lo demás funcione.',
    bloques: [
      {
        hora: '8:30 h',
        titulo: 'Inscripción',
        texto: 'Llegada y proceso de inscripción. Media hora para colocarse sin prisa.',
      },
      {
        hora: '9:00 h',
        titulo: 'Teoría del drenaje',
        texto:
          'La técnica de drenaje y desbloqueo. Al terminar se abre un turno de preguntas, que no es un trámite: es donde se resuelve lo que no se entiende con la mano puesta.',
      },
      {
        hora: '11:00 h',
        titulo: 'Preguntas y respuestas',
        texto: 'Lo que haya quedado suelto, antes de tocar a nadie.',
      },
      {
        hora: '14:00 h',
        titulo: 'Práctica con el primer modelo',
        texto:
          'Abdomen y piernas. Lo ideal es practicar entre alumnas: hay que sentir para saber transmitir.',
      },
      {
        hora: '16:00 h',
        titulo: 'Segundo modelo',
        texto:
          'Cada cuerpo responde distinto a la misma presión. Por eso son dos y no uno.',
      },
    ],
  },
  {
    dia: 'Día 2',
    titulo: 'Moldeadora y facial',
    resumen:
      'La técnica moldeadora por la mañana y el facial por la tarde. Se cierra con la entrega de diplomas.',
    bloques: [
      {
        hora: '8:30 h',
        titulo: 'Dudas de la jornada anterior',
        texto: 'Media hora para lo que se haya quedado dando vueltas por la noche.',
      },
      {
        hora: '9:00 h',
        titulo: 'Técnica moldeadora',
        texto:
          'Se repasa el protocolo entero en conjunto antes de entrar en la esencia del curso.',
      },
      {
        hora: '10:00 h',
        titulo: 'Teoría y práctica con modelo',
        texto: 'La Técnica Divine sobre cuerpo real, con corrección directa.',
      },
      {
        hora: '15:00 h',
        titulo: 'Segundo modelo',
        texto: 'Se cierra el trabajo corporal.',
      },
      {
        hora: '16:00 h',
        titulo: 'Divine Facial',
        texto:
          'El 90 % de la teoría ya se ha visto en las dos jornadas, así que se introduce brevemente y se aplica directamente sobre modelo facial.',
      },
      {
        hora: '19:30 h',
        titulo: 'Entrega de diplomas',
        texto: 'Diploma de terapeuta Divine.',
      },
    ],
  },
];

export type Pilar = { titulo: string; texto: string };

/** Los tres pilares, tal y como los cuenta el dossier. */
export const PILARES: Pilar[] = [
  {
    titulo: 'Formación limitada',
    texto:
      'Rigurosa y con plazas contadas, impartida únicamente por su creadora. Cada terapeuta Divine trabaja con el mismo nivel de conocimiento y precisión.',
  },
  {
    titulo: 'Maniobras con criterio',
    texto:
      'Las manipulaciones son concretas, directas y con objetivos claros. No se parece a un masaje corporal: se mira antes de tocar.',
  },
  {
    titulo: 'Un método, no una receta',
    texto:
      'Cada persona responde distinto a la misma presión. La técnica se adapta a cada cuerpo en lugar de aplicar una secuencia cerrada.',
  },
];

export type QueLlevas = { titulo: string; texto: string };

export const QUE_LLEVAS: QueLlevas[] = [
  {
    titulo: 'Dossier de 42 páginas',
    texto:
      'El recorrido completo del sistema linfático con láminas ilustradas, el protocolo y las contraindicaciones. Se entrega al firmar el acuerdo.',
  },
  {
    titulo: 'Práctica con modelos reales',
    texto: 'Cuatro modelos a lo largo de los dos días, con corrección de la mano sobre el cuerpo.',
  },
  {
    titulo: 'Evaluación de comprensión',
    texto: 'Para comprobar que la teoría ha quedado, no para puntuar a nadie.',
  },
  {
    titulo: 'Diploma de terapeuta Divine',
    texto: 'Al terminar la segunda jornada.',
  },
];

/**
 * Las preguntas de la evaluación, sacadas de la teoría del dossier.
 *
 * Son datos anatómicos que están en el material: nadie se juega nada
 * respondiéndolas aquí y sirven para que quien dude de si el curso tiene
 * fondo vea que lo tiene. No hay ninguna que afirme un efecto del tratamiento:
 * son hechos del cuerpo, no promesas.
 */
export type Pregunta = {
  pregunta: string;
  opciones: string[];
  /** La posición de la correcta dentro de `opciones`. */
  correcta: number;
  explicacion: string;
};

export const PREGUNTAS: Pregunta[] = [
  {
    pregunta: '¿Cuánta linfa produce el cuerpo humano al día?',
    opciones: ['Medio litro', 'Alrededor de 3 litros', 'Unos 10 litros'],
    correcta: 1,
    explicacion:
      'Alrededor de 3 litros, que se van incorporando poco a poco a la sangre.',
  },
  {
    pregunta: '¿Qué células contiene la linfa?',
    opciones: ['Glóbulos rojos', 'Glóbulos blancos', 'Las dos'],
    correcta: 1,
    explicacion:
      'Solo glóbulos blancos (linfocitos). No transporta oxígeno ni contiene hemoglobina.',
  },
  {
    pregunta: 'En el drenaje linfático manual, ¿en qué orden se trabaja?',
    opciones: ['De distal a proximal', 'De proximal a distal', 'Es indiferente'],
    correcta: 1,
    explicacion:
      'De proximal a distal: primero se abren los ganglios y después se arrastra hacia ellos. Al revés, el líquido no tiene por dónde salir.',
  },
  {
    pregunta: '¿Cuánto dura la apertura de ganglios?',
    opciones: ['Dos minutos', 'Diez minutos, y lenta', 'No tiene tiempo fijo'],
    correcta: 1,
    explicacion: 'Diez minutos, y la maniobra tiene que ser lenta.',
  },
  {
    pregunta: '¿A partir de qué edad circula la linfa más despacio?',
    opciones: ['A partir de los 27', 'A partir de los 40', 'No cambia con la edad'],
    correcta: 0,
    explicacion: 'A partir de los 27 años.',
  },
];

/** El antes y el después que se enseña. */
export const COMPARATIVA = {
  antes: '/alumnas/antes.webp',
  despues: '/alumnas/despues.webp',
  /**
   * El pie obligatorio. No es una fórmula de cortesía: una fotografía de
   * resultado sin esta advertencia es publicidad que promete lo mismo a todo
   * el mundo, y eso no se sostiene.
   */
  aviso:
    'Fotografía real, sin retoque, publicada con permiso de la clienta. Los resultados varían según cada persona.',
} as const;

/* ==========================================================================
   Las láminas de anatomía

   QUÉ SE PUEDE ENSEÑAR Y QUÉ NO. La anatomía del sistema linfático está en
   cualquier manual: enseñarla no regala nada. Lo que no está en ningún manual
   —el orden de trabajo, las presiones, los tiempos, las maniobras— se queda en
   el dossier, detrás del acuerdo de confidencialidad.

   Los textos DESCRIBEN ANATOMÍA. Ninguno atribuye a la técnica un efecto sobre
   la salud, porque esto es una página pública y una página pública de un
   servicio estético no puede hacerlo. Son las mismas frases del dossier,
   recortadas a lo que es estructura y función del sistema, sin el salto a lo
   que pasa cuando se trabaja encima.
   ========================================================================== */

export type Lamina = { src: string; alt: string; titulo: string; texto: string };

export const LAMINAS: Lamina[] = [
  {
    src: '/alumnas/anatomia-sistema.webp',
    alt: 'Lámina del sistema linfático en el cuerpo humano',
    titulo: 'El sistema linfático',
    texto:
      'Una red de vasos, ganglios y órganos repartida por todo el cuerpo, en paralelo al sistema circulatorio. Recorrerla de memoria es el primer requisito para trabajar sobre ella.',
  },
  {
    src: '/alumnas/anatomia-funcion.webp',
    alt: 'Lámina de la función principal del sistema linfático',
    titulo: 'Qué hace',
    texto:
      'Devuelve a la circulación sanguínea las proteínas plasmáticas y el líquido que no se reabsorbe en los tejidos. Esa carga es lo que se llama carga linfática.',
  },
  {
    src: '/alumnas/anatomia-capilar.webp',
    alt: 'Lámina de los capilares linfáticos y el líquido intersticial',
    titulo: 'Capilares linfáticos',
    texto:
      'Diminutos vasos de paredes delgadas, cerrados por un extremo, repartidos por casi todo el cuerpo salvo el sistema nervioso central y los tejidos no vasculares. Por ahí entra la linfa.',
  },
  {
    src: '/alumnas/anatomia-tejido.webp',
    alt: 'Lámina de la estructura de un vaso linfático',
    titulo: 'El vaso linfático',
    texto:
      'Tiene válvulas que obligan a la linfa a circular en un solo sentido. Conocer su trayecto y su dirección es lo que decide hacia dónde se trabaja.',
  },
  {
    src: '/alumnas/anatomia-ganglios.webp',
    alt: 'Lámina de los ganglios linfáticos superficiales y profundos',
    titulo: 'Dónde están los ganglios',
    texto:
      'Agrupados por regiones: cervicales, axilares, epitrocleares, inguinales, poplíteos, y los profundos del tronco. Cada región recoge de un territorio concreto.',
  },
  {
    src: '/alumnas/anatomia-ganglio.webp',
    alt: 'Lámina de la estructura interna de un ganglio linfático',
    titulo: 'El ganglio por dentro',
    texto:
      'Pequeñas estructuras con forma de judía intercaladas en el recorrido de los vasos. La linfa entra, los atraviesa y sale filtrada.',
  },
  {
    src: '/alumnas/anatomia-vias.webp',
    alt: 'Lámina de las vías de drenaje y los territorios linfáticos',
    titulo: 'Vías y territorios',
    texto:
      'El cuerpo está dividido en territorios, y cada uno drena hacia su grupo de ganglios. Las líneas que los separan son las que marcan por dónde se empieza.',
  },
  {
    src: '/alumnas/anatomia-torso.webp',
    alt: 'Lámina de los órganos linfáticos del tronco',
    titulo: 'Los órganos linfáticos',
    texto:
      'Bazo, timo, amígdalas y médula ósea, además de la propia red de ganglios. Jalonan el trayecto de los vasos.',
  },
  {
    src: '/alumnas/anatomia-quilo.webp',
    alt: 'Lámina de la absorción intestinal y los vasos quilíferos',
    titulo: 'Absorción intestinal',
    texto:
      'En el intestino, unos vasos linfáticos especiales recogen las grasas de la digestión. Es la vía por la que esas grasas llegan a la sangre.',
  },
];

/** Los resultados que se enseñan en la landing, ampliables. */
export const RESULTADOS = [
  '/alumnas/resultado-1.webp',
  '/alumnas/resultado-2.webp',
  '/alumnas/resultado-3.webp',
  '/alumnas/resultado-4.webp',
  '/alumnas/resultado-5.webp',
  '/alumnas/abdomen-2.webp',
];
