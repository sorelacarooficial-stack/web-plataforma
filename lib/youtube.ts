/**
 * Lo de YouTube, en un sitio del que tiran los dos que lo usan.
 *
 * Vivía dentro de `lib/aula.ts`, que es el aula de las alumnas. Cuando la
 * portada empezó a enseñar testimonios en vídeo se necesitaba lo mismo allí, y
 * había dos salidas: que la web pública importara del aula —cosas que no
 * tienen nada que ver— o copiar la dirección de incrustar en el otro fichero.
 * Copiarla es lo que acaba con que un día una lleve `nocookie` y la otra no.
 *
 */

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
export function urlDeVideo(id: string, opciones: { arrancar?: boolean } = {}): string {
  const parametros = ['rel=0', 'modestbranding=1', 'playsinline=1'];
  /* `arrancar` solo lo usa la portada: allí el vídeo no está puesto hasta que
     alguien pulsa el botón, así que al montarlo ya se ha pedido verlo y hacerle
     dar al play otra vez sobra. En el aula NO se usa: allí la clase se abre al
     elegirla de una lista y arrancar sola sería ponerse a hablar sin permiso. */
  if (opciones.arrancar) parametros.push('autoplay=1');
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${parametros.join('&')}`;
}
