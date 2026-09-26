import type { Acceso } from './accesos';

/**
 * Las clases del aula.
 *
 * Una clase es un vídeo con su título. Vive en YouTube —el vídeo, no la
 * clase— y aquí solo se guarda su identificador, el título y a quién va
 * dirigida. Esto no es tacañería: una base de datos no sirve vídeo, y aunque
 * pudiera, servirlo cuesta por giga y se corta en cuanto alguien lo ve desde
 * una conexión mala. YouTube hace esa parte mejor y gratis.
 *
 * LO QUE HAY QUE SABER DE ESTA DECISIÓN: un vídeo de YouTube no listado lo ve
 * cualquiera que tenga el enlace, y los enlaces se reenvían. Una alumna que
 * pague puede pasarlo a un grupo y ese curso queda abierto para siempre. Es
 * una decisión tomada a sabiendas. Si algún día hay que cerrarlo, lo único que
 * cambia es `urlDeVideo()` y el nombre del campo: todo lo demás sigue igual.
 */

/** Una clase, tal y como se guarda. */
export type Leccion = {
  id: string;
  titulo: string;
  /** Una o dos frases de qué se ve en ella. Puede ir vacía. */
  descripcion: string;
  /** El identificador del vídeo en YouTube, no la dirección entera. */
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
};

/* ==========================================================================
   El vídeo
   ========================================================================== */

/**
 * Saca el identificador de un enlace de YouTube, venga como venga.
 *
 * Sorela va a pegar lo que le dé el navegador, y YouTube reparte direcciones
 * de cinco formas distintas según desde dónde se copie: la barra, el botón de
 * compartir, el móvil, un directo o el propio código de incrustar. Pedirle que
 * las distinga sería pedirle que sepa algo que no tiene por qué saber. Se
 * aceptan todas, y también el identificador pelado por si lo tiene a mano.
 *
 * Devuelve null si no se reconoce, y entonces la pantalla se lo dice en vez de
 * guardar una clase con un vídeo que no existe.
 */
export function idDeYoutube(crudo: string): string | null {
  const texto = (crudo || '').trim();
  if (!texto) return null;

  // Un identificador de YouTube son once caracteres de este alfabeto. Si lo
  // que llega ya tiene esa forma exacta, se acepta tal cual.
  const SOLO_ID = /^[\w-]{11}$/;
  if (SOLO_ID.test(texto)) return texto;

  const patrones = [
    /[?&]v=([\w-]{11})/, //  youtube.com/watch?v=ID
    /youtu\.be\/([\w-]{11})/, //  youtu.be/ID
    /\/embed\/([\w-]{11})/, //  youtube.com/embed/ID  y el código de incrustar
    /\/live\/([\w-]{11})/, //  youtube.com/live/ID    (un directo)
    /\/shorts\/([\w-]{11})/, //  youtube.com/shorts/ID
  ];

  for (const patron of patrones) {
    const encontrado = patron.exec(texto);
    if (encontrado) return encontrado[1];
  }
  return null;
}

/**
 * La dirección con la que se incrusta el vídeo.
 *
 * Se usa youtube-nocookie.com y no youtube.com: el dominio normal deja cookies
 * de seguimiento en cuanto se carga el reproductor, aunque nadie le dé al
 * play. Esta web tiene página de cookies y no pide consentimiento para
 * publicidad, así que meter esas cookies sería contradecirla.
 *
 * Los parámetros: `rel=0` para que al terminar no proponga vídeos de otros
 * canales, y `modestbranding=1` para quitar el logotipo grande. Ninguno de los
 * dos protege nada; son para que la clase no acabe en un vídeo de gatos.
 */
export function urlDeVideo(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`;
}

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
  return accesos.some((a) => a.tipo === 'curso' && clave(a.nombre) === clave(para.nombre));
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
