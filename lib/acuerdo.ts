/**
 * El acuerdo de confidencialidad que firma cada alumna antes de la formación.
 *
 * QUÉ ES ESTO Y QUÉ NO ES. Esto es la versión en texto del documento que
 * Sorela ya hacía firmar en papel, palabra por palabra: las cláusulas de abajo
 * están copiadas del PDF que ella usa, no reescritas ni «mejoradas». Si algún
 * día hay que cambiar una, se cambia aquí y se sube la versión de abajo; lo
 * firmado antes NO cambia, porque cada firma guarda el texto exacto que se le
 * enseñó. Un acuerdo cuyo contenido se puede reescribir hacia atrás no vale
 * para nada.
 *
 * POR QUÉ SE GUARDA EL TEXTO CON CADA FIRMA, Y NO SOLO UN «aceptó: sí». Lo que
 * da valor a una firma electrónica simple como esta no es la firma dibujada: es
 * poder demostrar QUÉ se firmó, CUÁNDO y DESDE DÓNDE. Por eso cada acuerdo
 * firmado se queda con su copia del texto, la hora del servidor —nunca la del
 * navegador, que la pone quien quiera— y los datos de la conexión.
 *
 * LO QUE ESTO NO ES: no es una firma electrónica cualificada. Para una alumna
 * aceptando un compromiso de confidencialidad es más que suficiente y es lo que
 * se usa en el sector. Para algo que tuviera que aguantar un juicio por una
 * cantidad grande, haría falta un prestador cualificado.
 */

/**
 * Versión del texto. Sube cuando cambie una cláusula.
 *
 * Va en cada firma guardada, así que mirando un acuerdo de hace un año se sabe
 * exactamente qué decía entonces aunque hoy diga otra cosa.
 */
export const VERSION_ACUERDO = '2026-10-05';

export const TITULO_ACUERDO = 'Acuerdo de confidencialidad y no divulgación de información';

/** Quién es quién, en los términos del propio documento. */
export const PARTES = {
  divulgante: 'la formadora',
  receptor: 'la alumna',
} as const;

export type Clausula = {
  /** «Primera», «Segunda»… Es como las nombra el documento. */
  orden: string;
  /** Un título corto para la pantalla. No sale en el PDF impreso. */
  titulo: string;
  /** El texto, tal cual. Varios párrafos cuando la cláusula los tiene. */
  parrafos: string[];
};

/**
 * Las cláusulas, copiadas del acuerdo en papel.
 *
 * La segunda tiene dos apartados numerados en el original y aquí van como dos
 * párrafos, en el mismo orden. No se junta en uno: el documento impreso los
 * numera y el que se firme tiene que poder leerse igual que el de papel.
 */
export const CLAUSULAS: Clausula[] = [
  {
    orden: 'Primera',
    titulo: 'Objeto',
    parrafos: [
      'El presente acuerdo se refiere a la información que el DIVULGANTE proporcione al RECEPTOR, ya sea de forma oral, gráfica o escrita durante la formación impartida de «Técnica Divine».',
    ],
  },
  {
    orden: 'Segunda',
    titulo: 'Uso de la información',
    parrafos: [
      '1. El RECEPTOR únicamente utilizará la información recibida para el fin mencionado en la estipulación anterior y para el desempeño de sus labores futuras en materia de estética, con los tratamientos y procedimientos citados.',
      '2. El RECEPTOR no podrá reproducir, modificar, hacer pública o divulgar a terceros la información objeto del presente acuerdo sin previa autorización escrita y expresa del DIVULGANTE.',
    ],
  },
  {
    orden: 'Tercera',
    titulo: 'Entrada en vigor',
    parrafos: [
      'Este acuerdo entrará en vigor en el momento de la firma del mismo por ambas partes.',
    ],
  },
];

export const CIERRE_ACUERDO =
  'Y en señal de expresa conformidad y aceptación de los términos recogidos en el presente acuerdo, lo firman las partes por duplicado ejemplar y a un solo efecto en el lugar y la fecha a continuación indicados.';

/** Lo que cada alumna rellena. */
export type DatosAcuerdo = {
  nombre: string;
  apellidos: string;
  /**
   * Su documento de identidad: DNI, cédula, pasaporte, el que tenga. Se
   * guarda tal cual lo escribe, en mayúsculas.
   */
  documento: string;
  correo: string;
  telefono: string;
  /** Dónde firma. Sale en la línea «En ____, a ____ de ____». */
  lugar: string;
  /** La firma dibujada, como imagen PNG en una cadena `data:`. */
  firma: string;
};

/**
 * Un acuerdo ya firmado, tal y como se guarda.
 *
 * `texto` y `version` son la copia congelada de lo que se le enseñó. `prueba`
 * es lo que convierte esto en algo que se puede defender: cuándo entró, desde
 * qué conexión y con qué navegador.
 */
export type AcuerdoFirmado = DatosAcuerdo & {
  /** La referencia corta que se le enseña y que ella puede citar. */
  referencia: string;
  /** Hora del SERVIDOR, en ISO. Nunca la del navegador. */
  firmadoEl: string;
  version: string;
  titulo: string;
  clausulas: Clausula[];
  cierre: string;
  prueba: {
    ip: string;
    navegador: string;
  };
};

/**
 * La referencia que se le enseña al terminar: «DIV-K7P2-4M9X».
 *
 * No es un número correlativo a propósito. Un correlativo dice cuántas van
 * firmadas, y eso es un dato del negocio que no tiene por qué saber quien
 * acaba de firmar.
 */
export function referenciaNueva(aleatorio: () => number = Math.random): string {
  /* Sin vocales ni los caracteres que se confunden al dictarlos por teléfono:
     ni O ni 0, ni I ni 1, ni L. */
  const LETRAS = '23456789BCDFGHJKMNPQRSTVWXYZ';
  const trozo = () =>
    Array.from({ length: 4 }, () => LETRAS[Math.floor(aleatorio() * LETRAS.length)]).join('');
  return `DIV-${trozo()}-${trozo()}`;
}

/** «5 de octubre de 2026», que es como se escribe en un documento. */
export function fechaLarga(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(d);
}

/** Nombre y apellidos en una línea, sin dobles espacios. */
export function nombreCompleto(d: Pick<DatosAcuerdo, 'nombre' | 'apellidos'>): string {
  return `${d.nombre} ${d.apellidos}`.replace(/\s+/g, ' ').trim();
}

/* ==========================================================================
   Comprobaciones
   ========================================================================== */

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Un documento de identidad, de cualquier país.
 *
 * Antes se comprobaba la letra del DNI español. Sorela forma en todo el mundo,
 * y una cédula colombiana, un pasaporte mexicano o un ID estadounidense no
 * tienen letra que comprobar: la regla dejaba fuera a media alumnado. Ahora se
 * pide solo lo que tiene cualquier documento: entre 4 y 30 caracteres, con al
 * menos un número.
 */
export function documentoValido(crudo: string): boolean {
  const d = (crudo || '').trim();
  return d.length >= 4 && d.length <= 30 && /\d/.test(d);
}

/**
 * Un teléfono con prefijo internacional: «+57 300 123 4567».
 *
 * Entre 8 y 15 cifras contando el prefijo, que es el rango de los números de
 * todo el mundo. Sin el «+» delante no se sabe de qué país es, y entonces no
 * sirve para escribirle por WhatsApp.
 */
export function telefonoValido(crudo: string): boolean {
  const t = (crudo || '').trim();
  const cifras = t.replace(/\D/g, '').length;
  return t.startsWith('+') && cifras >= 8 && cifras <= 15;
}

export type ErroresAcuerdo = Partial<Record<keyof DatosAcuerdo | 'clausulas' | 'privacidad', string>>;

/**
 * Revisa lo que llega, y lo hace en un sitio del que tiran las dos puntas: la
 * pantalla para avisar mientras se escribe y el servidor para no fiarse. Con
 * dos copias de estas reglas, un día una deja pasar lo que la otra rechaza.
 */
export function revisarAcuerdo(d: Partial<DatosAcuerdo>, clausulasAceptadas: number): ErroresAcuerdo {
  const e: ErroresAcuerdo = {};
  const texto = (v?: string) => (v ?? '').trim();

  if (texto(d.nombre).length < 2) e.nombre = 'Escribe tu nombre.';
  if (texto(d.apellidos).length < 2) e.apellidos = 'Escribe tus apellidos.';
  if (!documentoValido(texto(d.documento))) e.documento = 'Escribe el número de tu documento de identidad o pasaporte.';
  if (!CORREO.test(texto(d.correo))) e.correo = 'Escribe un correo con forma de correo.';
  if (!telefonoValido(texto(d.telefono))) e.telefono = 'Revisa el teléfono y el prefijo de tu país.';
  if (texto(d.lugar).length < 2) e.lugar = 'Escribe la ciudad donde firmas.';

  /* La firma tiene que ser un PNG dibujado. Se mira que sea una imagen y que
     tenga cuerpo: un lienzo en blanco sale en unos pocos cientos de bytes, y
     eso no es una firma. */
  const firma = texto(d.firma);
  if (!firma.startsWith('data:image/png;base64,')) e.firma = 'Falta tu firma.';
  else if (firma.length < 2000) e.firma = 'La firma ha quedado casi en blanco. Vuelve a firmar.';

  if (clausulasAceptadas < CLAUSULAS.length) {
    e.clausulas = 'Tienes que aceptar las tres cláusulas.';
  }

  return e;
}
