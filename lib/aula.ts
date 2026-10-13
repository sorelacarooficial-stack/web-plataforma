import type { Acceso } from './accesos';

/**
 * Las clases del aula.
 *
 * Una clase es un vídeo con su título y a quién va dirigida. El vídeo vive en
 * el almacén propio de la plataforma (Firebase Storage), en una carpeta
 * privada: no tiene dirección pública y solo se ve con un enlace firmado que
 * caduca, que da el servidor a quien le toca (app/api/lecciones/video).
 *
 * Antes las clases eran vídeos «no listados» de YouTube, y eso tenía un
 * agujero que no se podía tapar: quien tuviera el enlace veía el curso sin
 * pasar por aquí, y los enlaces se reenvían. Las clases antiguas de YouTube
 * siguen funcionando igual —guardan el identificador del vídeo en `video`—;
 * las nuevas se suben aquí y guardan «propio:» y su ruta en el almacén.
 */

/** Una clase, tal y como se guarda. */
export type Leccion = {
  id: string;
  titulo: string;
  /** Una o dos frases de qué se ve en ella. Puede ir vacía. */
  descripcion: string;
  /**
   * De dónde sale el vídeo: «propio:<ruta en el almacén>» para los subidos
   * aquí, o el identificador de YouTube (no la dirección entera) para las
   * clases antiguas.
   */
  video: string;
  /** Quién la ve: la comunidad, o quien haya hecho un curso concreto. */
  para: Acceso;
  /** En qué orden se enseña dentro de su bloque. */
  orden: number;
  /**
   * Si está a la vista. Sirve para preparar un curso entero antes de abrirlo:
   * mientras es falso, la clase solo la ve Sorela.
   */
  publicada: boolean;
  creado: string | null;
  /** Los momentos clave del vídeo, para saltar a ellos. Segundos desde el inicio. */
  capitulos?: Capitulo[];
  /** Cuánto dura, en segundos. Para el progreso y las horas vistas. */
  duracion?: number;
  /** El apartado dentro del curso: «Día 1 · Desbloqueo», «Facial»… */
  modulo?: string;
  /**
   * La portada, lista para pintar: un enlace firmado al almacén (las nuevas,
   * sacada de un fotograma del vídeo al subirlo) o la imagen en texto que
   * llevaban las primeras clases. Si no hay, se usa la de YouTube o un fondo.
   */
  portada?: string;
  /** Lo que pesa el vídeo propio, en bytes. Solo lo ve Sorela. */
  tamano?: number;
};

export type Capitulo = { t: number; titulo: string };

/** Lo que lleva visto una persona de una clase. */
export type Progreso = { visto: number; completada: boolean; actualizado?: string | null };

/**
 * De dónde sale el vídeo. Los de YouTube guardan su identificador; los que
 * vivan en el almacén propio de la plataforma guardan «propio:» y su ruta, y
 * se sirven con un enlace firmado que caduca (ver app/api/lecciones/video).
 */
export const esVideoPropio = (video: string) => video.startsWith('propio:');

/* ==========================================================================
   Subir una clase
   Lo comparten la pantalla de subir (que comprueba antes de empezar) y la API
   (que vuelve a comprobarlo, porque lo que diga el navegador no vale).
   ========================================================================== */

/**
 * Los formatos que se aceptan, por extensión, y con qué tipo se guardan.
 *
 * El MOV se guarda como «video/mp4» y no como «video/quicktime», a propósito:
 * es el mismo contenedor por dentro (lo que graba un iPhone o exporta un Mac
 * en H.264), pero Chrome no reconoce el tipo de QuickTime y con él algunos
 * navegadores se niegan a empezar a reproducir. Con el de MP4 lo abren todos.
 * El M4V es el MP4 que exporta Apple con otro nombre.
 */
export const FORMATOS_VIDEO = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/mp4',
  webm: 'video/webm',
} as const;
export type ExtensionVideo = keyof typeof FORMATOS_VIDEO;

/** 4 GB: una clase larga grabada en 1080p cabe de sobra. */
export const TOPE_VIDEO = 4 * 1024 ** 3;

/**
 * El trozo en que se sube el vídeo: 8 MB. Google pide que cada trozo, menos el
 * último, sea múltiplo de 256 KB. Más grande va algo más rápido con buena
 * conexión, pero si se corta hay que repetir más; con 8 MB, en una conexión
 * mala se repiten unos segundos y no un minuto.
 */
export const TROZO_VIDEO = 8 * 1024 * 1024;

/** La extensión con la que se guarda, o null si no es un vídeo que se acepte. */
export function extensionDeVideo(nombre: string, tipo = ''): ExtensionVideo | null {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(nombre.trim())?.[1] ?? '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(FORMATOS_VIDEO, ext)) return ext as ExtensionVideo;
  // Sin extensión reconocible (pasa al compartir desde algunos móviles): por el tipo.
  if (tipo === 'video/mp4') return 'mp4';
  if (tipo === 'video/quicktime') return 'mov';
  if (tipo === 'video/webm') return 'webm';
  return null;
}

/** La carpeta privada de cada clase subida aquí: vídeo y portada. */
export const carpetaDeClase = (id: string) => `privado/clases/${id}/`;

/** «850 MB», «1,2 GB». */
export function peso(bytes: number): string {
  if (!(bytes > 0)) return '0 MB';
  const mb = bytes / 1024 ** 2;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1000) return `${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
}

/** «08:42» o «1:02:05». */
export function minutos(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${String(m).padStart(2, '0')}:${r}`;
}

/* Lo de YouTube —sacar el identificador de un enlace y montar la dirección de
   incrustar— se fue a `lib/youtube.ts` cuando la portada empezó a enseñar
   testimonios en vídeo y necesitó lo mismo. Se vuelve a exportar desde aquí
   para que quien ya lo importaba del aula no tenga que enterarse. */
export { idDeYoutube, urlDeVideo } from './youtube';

/* ==========================================================================
   Quién ve qué
   ========================================================================== */

/**
 * El nombre de un curso, listo para comparar.
 *
 * Hace falta porque el nombre lo escribe Sorela a mano en dos sitios: en el
 * acceso de la persona y en la clase. «Formación Base» y «formacion base» son
 * el mismo curso para cualquiera menos para un `===`, y esa alumna se quedaría
 * sin ver sus clases sin que nada lo delatara. Se quitan las tildes, las
 * mayúsculas y los espacios de más.
 */
export function clave(nombre: string | undefined): string {
  return (nombre || '')
    .normalize('NFD')
    // Los signos que la descomposición deja sueltos: tildes, diéresis. La eñe
    // se convierte así en n, y eso es lo que se quiere al comparar.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Si una clase dirigida a `para` la tiene que ver quien tiene `accesos`. */
export function puedeVerla(para: Acceso, accesos: Acceso[]): boolean {
  if (para.tipo === 'membresia') return accesos.some((a) => a.tipo === 'membresia');
  /* Con solo el abono (completo: false) el curso está, pero sus clases no:
     se abren cuando paga el resto, después de la presencial. */
  return accesos.some((a) => a.tipo === 'curso' && a.completo !== false && clave(a.nombre) === clave(para.nombre));
}

/** Si tiene ese curso, aunque sea solo con el abono (precurso). */
export function tieneElCurso(nombre: string | undefined, accesos: Acceso[]): boolean {
  return accesos.some((a) => a.tipo === 'curso' && clave(a.nombre) === clave(nombre));
}

/** Cómo se llama el bloque al que pertenece una clase. */
export function nombreDelBloque(para: Acceso): string {
  return para.tipo === 'membresia' ? 'Comunidad Divine' : para.nombre?.trim() || 'Sin curso';
}

/**
 * De dos formas de escribir el mismo curso, la escrita con cuidado.
 *
 * «Formación Base» y «formacion base» son el mismo bloque, pero solo una se
 * puede enseñar. Antes se cogía la de la clase más antigua, y eso hacía que el
 * título dependiera del orden en que se subieron: bastaba con que la primera
 * fuera la escrita con prisa para que el aula entera se titulara «formacion
 * base».
 *
 * Se puntúa cada una por mayúsculas y tildes, que es lo que distingue un
 * nombre escrito con cuidado de uno tecleado deprisa, y gana la más alta. A
 * igualdad, la primera, que al menos es estable.
 */
function mejorEscrito(a: string, b: string): string {
  const cuidado = (n: string) => (n.match(/[A-ZÁÉÍÓÚÜÑ]/g)?.length ?? 0) + (n.match(/[áéíóúüñ]/g)?.length ?? 0);
  return cuidado(b) > cuidado(a) ? b : a;
}

/**
 * Las clases repartidas en bloques, cada bloque en su orden.
 *
 * Se agrupa por la clave y no por el nombre tal cual para que dos formas de
 * escribir el mismo curso no salgan como dos bloques distintos.
 */
export function porBloques(lecciones: Leccion[]): { nombre: string; lecciones: Leccion[] }[] {
  const bloques = new Map<string, { nombre: string; lecciones: Leccion[] }>();

  for (const l of lecciones) {
    const k = l.para.tipo === 'membresia' ? 'membresia' : `curso:${clave(l.para.nombre)}`;
    const bloque = bloques.get(k);
    if (bloque) {
      bloque.lecciones.push(l);
      bloque.nombre = mejorEscrito(bloque.nombre, nombreDelBloque(l.para));
    } else {
      bloques.set(k, { nombre: nombreDelBloque(l.para), lecciones: [l] });
    }
  }

  for (const b of bloques.values()) {
    b.lecciones.sort((a, z) => a.orden - z.orden);
  }

  /* La comunidad primero: es lo que se renueva cada mes, así que es donde hay
     algo nuevo que ver. Los cursos van después, por orden alfabético, que es
     estable —no cambia al añadir clases— y por tanto no mueve las cosas de
     sitio entre una visita y otra. */
  return [...bloques.entries()]
    .sort(([a], [z]) => (a === 'membresia' ? -1 : z === 'membresia' ? 1 : a.localeCompare(z, 'es')))
    .map(([, b]) => b);
}
