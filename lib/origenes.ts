/**
 * De dónde viene cada persona y, por tanto, qué quiere.
 *
 * Esta es la pieza que convierte una lista de contactos en un embudo. Alguien
 * que pulsa «quiero la información» en la portada quiere que le traten; quien
 * lo deja en la página de formaciones quiere aprender; quien se apunta a la
 * lista de la comunidad ya es terapeuta. Son tres conversaciones distintas y
 * mezclarlas en una sola lista obliga a adivinar cuál toca en cada caso.
 *
 * El dato que lo permite ya viajaba —cada formulario manda su `origen`—, pero
 * nadie lo leía. Aquí se le da significado, en un solo sitio, para que la
 * plataforma y el correo digan lo mismo.
 *
 * Importante: el origen NO es una etiqueta definitiva. Es de dónde entró. Una
 * posible clienta puede acabar matriculándose. Por eso el tipo se guarda como
 * lo que es —una pista de entrada— y el estado del embudo se lleva aparte.
 */

export const TIPOS = ['clienta', 'alumna', 'comunidad', 'otro'] as const;
export type Tipo = (typeof TIPOS)[number];

export const ETIQUETA_TIPO: Record<Tipo, string> = {
  clienta: 'Posible clienta',
  alumna: 'Posible alumna',
  comunidad: 'Terapeuta certificada',
  otro: 'Sin clasificar',
};

/** Una frase que explica qué busca cada uno. Sale en la ficha de la persona. */
export const QUE_QUIERE: Record<Tipo, string> = {
  clienta: 'Quiere que le traten. Busca una sesión, no aprender la técnica.',
  alumna: 'Quiere formarse en la Técnica Divine.',
  comunidad: 'Ya es terapeuta y quiere entrar en la comunidad.',
  otro: 'No se sabe qué busca: hay que preguntárselo.',
};

/**
 * Cómo llegó, con palabras. El origen en crudo («cita-madrid») no se le
 * enseña a nadie: se traduce.
 */
export const COMO_LLEGO: Record<string, string> = {
  web: 'Botón «Quiero la información» de la portada',
  informacion: 'Botón «Quiero la información» de la portada',
  expo: 'Código QR de la exposición',
  formacion: 'Página de formaciones',
  'formacion-base': 'Formación Base',
  'formacion-avanzado': 'Nivel Avanzado',
  comunidad: 'Página de la Comunidad Divine',
  'lista-comunidad': 'Lista de espera de la comunidad',
  metodo: 'Página del método',
  sobre: 'Página «Sobre Sorela»',
  contacto: 'Formulario de contacto',
  asistente: 'Conversación con el asistente de la web',
  'avisar-ciudad': 'Pidió aviso cuando haya fecha en su ciudad',
  terapeutas: 'Buscador de terapeutas',
  // Los que nacen de una conversación con el asistente. Se distinguen del
  // resto porque ahí ya ha preguntado algo concreto, y eso vale al llamarla:
  // se sabe por dónde empezar.
  /* Los que nacen de «Añadir cliente». Sin estas cuatro líneas, «cita-a-mano»
     caía en la regla de abajo que separa la ciudad del origen y la ficha decía
     «Pidió cita en A mano», que no ha pasado: a esta persona la apuntó Sorela. */
  'a-mano': 'La apuntaste tú',
  'cita-a-mano': 'La apuntaste tú: quiere que la trates',
  'formacion-a-mano': 'La apuntaste tú: quiere formarse',
  'comunidad-a-mano': 'La apuntaste tú: ya es terapeuta',
  'cita-asistente': 'Preguntó al asistente por una cita',
  'formacion-asistente': 'Preguntó al asistente por las fechas de formación',
  'formacion-precio': 'Preguntó al asistente por el precio de la formación',
  'comunidad-asistente': 'Preguntó al asistente por la comunidad',
};

/**
 * De qué tipo es alguien, según por dónde entró.
 *
 * El orden de las comprobaciones importa: se va de lo más específico a lo más
 * general, porque «formacion-base» también empieza por «formacion».
 */
export function tipoDeOrigen(origen: string | undefined | null): Tipo {
  const o = (origen || '').toLowerCase().trim();
  if (!o) return 'otro';

  // Ya es terapeuta: la comunidad solo se abre a quien se ha certificado.
  if (o === 'comunidad' || o.startsWith('lista-comunidad') || o.startsWith('comunidad-')) {
    return 'comunidad';
  }

  // Quiere aprender.
  if (o.startsWith('formacion') || o.startsWith('curso') || o === 'metodo') {
    return 'alumna';
  }

  // Quiere que le traten: pidió cita, o vino por el buscador de terapeutas.
  if (o.startsWith('cita-') || o === 'terapeutas' || o.startsWith('avisar-ciudad')) {
    return 'clienta';
  }

  // La portada y el QR venden la técnica a quien la va a recibir. Quien llega
  // ahí y deja su contacto quiere, por defecto, que le traten.
  if (o === 'web' || o === 'informacion' || o === 'expo' || o.startsWith('qr')) {
    return 'clienta';
  }

  // El contacto general y el asistente pueden ser cualquier cosa: se dejan sin
  // clasificar a propósito, para que Sorela lo decida al hablar con ellos. Es
  // mejor un hueco que una etiqueta inventada.
  return 'otro';
}

/** Cómo llegó, en una frase. Si el origen no está en la tabla, se devuelve tal cual. */
export function comoLlego(origen: string | undefined | null): string {
  const o = (origen || '').toLowerCase().trim();
  if (!o) return 'No consta';
  if (COMO_LLEGO[o]) return COMO_LLEGO[o];
  // Las citas llevan la ciudad pegada: «cita-valencia» → «Pidió cita en Valencia».
  if (o.startsWith('cita-')) {
    const ciudad = o.slice(5).replace(/-/g, ' ');
    return `Pidió cita en ${ciudad.charAt(0).toUpperCase()}${ciudad.slice(1)}`;
  }
  return o;
}
