import { CURSO_DIVINE, type Acceso } from './accesos';

/**
 * El material del curso: los dossieres de cada día.
 *
 * No se sirven como PDF. Cada página está guardada como imagen en Firebase
 * Storage, en `material/<id>/001.webp`, sin enlace público; quien tiene acceso
 * recibe enlaces firmados que caducan a los 15 minutos y las ve en el lector
 * del aula, con su correo encima. Así no hay ningún archivo que descargar y
 * reenviar entero.
 *
 * Lo que hay aquí no es secreto —títulos y números de página—, así que puede
 * vivir en el código. Lo que sí lo es, las páginas, solo está en el almacén.
 *
 * Para añadir un dossier: pasar sus páginas a imágenes, subirlas a
 * `material/<id>/` con tres cifras (001.webp, 002.webp…) y añadirlo a la lista.
 */

export type Documento = {
  id: string;
  titulo: string;
  subtitulo: string;
  /** El apartado del aula al que acompaña. Debe coincidir con el `modulo` de sus clases. */
  modulo: string;
  paginas: number;
  /** Qué página se enseña en la tarjeta. */
  portada: number;
  /** Lo puede ver quien tenga CUALQUIERA de estos accesos. */
  para: Acceso[];
  /** Dónde empieza cada apartado, en páginas del archivo (la portada es la 1). */
  indice: { p: number; titulo: string }[];
};

const FORMACION: Acceso[] = [{ tipo: 'curso', nombre: CURSO_DIVINE }, { tipo: 'membresia' }];

export const DOCUMENTOS: Documento[] = [
  {
    id: 'dia-1-desbloqueo',
    titulo: 'Día 1 · Desbloqueo',
    subtitulo: 'Linfodrenaje de abdomen, piernas y glúteos',
    modulo: 'Día 1 · Desbloqueo',
    paginas: 38,
    portada: 1,
    para: FORMACION,
    indice: [
      { p: 3, titulo: 'Diferencias y beneficios' },
      { p: 5, titulo: 'Las fases del abdomen' },
      { p: 6, titulo: 'Protocolo paso a paso' },
      { p: 7, titulo: 'Activación de ganglios' },
      { p: 9, titulo: 'Ventosa y estimulación intestinal' },
      { p: 10, titulo: 'Abdomen bajo' },
      { p: 12, titulo: 'Abdomen alto' },
      { p: 13, titulo: 'Maderoterapia o aluminioterapia' },
      { p: 14, titulo: 'Laterales' },
      { p: 18, titulo: 'Piernas y glúteos' },
      { p: 22, titulo: 'Protocolo de piernas por fases' },
      { p: 30, titulo: 'Glúteos' },
      { p: 32, titulo: 'Prevención y contraindicaciones' },
      { p: 37, titulo: 'Política de privacidad' },
    ],
  },
  {
    id: 'dia-2-tonificacion-y-moldeo',
    titulo: 'Día 2 · Tonificación y moldeo',
    subtitulo: 'Body Sculpt: abdomen, piernas, glúteos y brazos',
    modulo: 'Día 2 · Tonificación y moldeo',
    paginas: 42,
    portada: 4,
    para: FORMACION,
    indice: [
      { p: 4, titulo: 'Introducción' },
      { p: 5, titulo: 'Body Sculpt Sorela Caro' },
      { p: 6, titulo: 'Celulitis' },
      { p: 8, titulo: 'Flacidez' },
      { p: 9, titulo: 'Cicatrices y estrías' },
      { p: 12, titulo: 'Zonas de aplicación' },
      { p: 14, titulo: 'Moldeo corporal' },
      { p: 16, titulo: 'Grasa abdominal' },
      { p: 18, titulo: 'Maniobras moldeadoras' },
      { p: 19, titulo: 'Abdomen: fórmula paso a paso' },
      { p: 23, titulo: 'Cierre y memoria' },
      { p: 24, titulo: 'Maniobras destacadas' },
      { p: 27, titulo: 'Piernas y glúteo' },
      { p: 33, titulo: 'Brazos' },
      { p: 37, titulo: 'Prevención y contraindicaciones' },
      { p: 41, titulo: 'Política de privacidad' },
    ],
  },
  {
    id: 'facial-divine',
    titulo: 'Facial Divine',
    subtitulo: 'Técnica Divine holística facial',
    modulo: 'Facial Divine',
    paginas: 24,
    portada: 1,
    para: FORMACION,
    indice: [
      { p: 3, titulo: 'La Técnica Divine facial' },
      { p: 4, titulo: 'Divine Facial Holístico' },
      { p: 5, titulo: 'Beneficios' },
      { p: 7, titulo: 'El sistema linfático' },
      { p: 11, titulo: 'Imperfecciones de la piel' },
      { p: 14, titulo: 'Beneficios del drenaje facial' },
      { p: 15, titulo: 'Resultados y duración' },
      { p: 16, titulo: 'Maniobras de drenaje' },
      { p: 18, titulo: 'Protocolo paso a paso' },
      { p: 22, titulo: 'Resultados' },
      { p: 23, titulo: 'Política de privacidad' },
    ],
  },
];

/** Dónde vive cada página en el almacén. */
export const rutaDePagina = (id: string, n: number) => `material/${id}/${String(n).padStart(3, '0')}.webp`;
