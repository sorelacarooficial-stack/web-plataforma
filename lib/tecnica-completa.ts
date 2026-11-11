/**
 * Los vídeos largos de la técnica completa, para estudiar sola las veces que
 * quiera (reunión del 11 nov). Salen tras el botón «Ver toda la técnica
 * completa» del aula, para todas las que tienen el curso.
 *
 * Viven en el Google Drive de Sorela (pesan varios GB y no caben en el
 * almacén de la plataforma tal cual). Se ven dentro del aula con el
 * reproductor de Drive. OJO: el archivo tiene que estar compartido como
 * «Cualquier persona con el enlace»; quien tenga el enlace puede verlo fuera
 * de la plataforma. Cuando se suban al almacén propio (Contenido › Clases,
 * módulo «Técnica completa»), se quitan de aquí.
 */
export type VideoCompleto = { id: string; titulo: string; texto: string };

export const TECNICA_COMPLETA: VideoCompleto[] = [
  {
    id: '1Vv4mdWQqYnCaaXsI2AERtSyLuq8HRD29',
    titulo: 'Tratamiento completo · Andrea',
    texto: 'La sesión entera, de principio a fin, sin cortes.',
  },
  {
    id: '1RVplURsJxF593vA-A5mzI93sifoXP8Wk',
    titulo: 'Tratamiento completo · Esther',
    texto: 'La sesión entera, de principio a fin, sin cortes.',
  },
];

export const urlVerDrive = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const urlIncrustarDrive = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
