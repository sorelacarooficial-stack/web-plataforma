/**
 * Vídeos alojados en Google Drive.
 *
 * POR QUÉ DRIVE Y POR QUÉ ESTO EXISTE. Los testimonios están grabados y viven
 * en una carpeta de Drive. Subirlos al repositorio exigiría bajarlos,
 * comprimirlos y volver a subirlos cada vez que cambie uno; incrustarlos desde
 * Drive los pone en la web hoy, sin mover un archivo. Lo carga el navegador de
 * quien visita la web directamente contra Drive.
 *
 * LO QUE HAY QUE SABER ANTES DE CONFIAR EN ESTO:
 *
 *   1. El archivo tiene que estar compartido como «cualquier persona con el
 *      enlace · lector». Si no, el marco sale en gris pidiendo permiso, y lo
 *      pide a quien está mirando la web, que evidentemente no lo tiene.
 *   2. Drive no es un CDN. Limita las descargas de un archivo muy visto y
 *      contesta «se ha superado la cuota». Para seis vídeos en una portada con
 *      tráfico normal no pasa; para un lanzamiento con mucha gente a la vez,
 *      sí puede pasar.
 *   3. El reproductor es el de Drive, con su barra y su botón de abrir aparte.
 *      No se puede quitar ni cambiar.
 *
 * Por eso esto es el camino rápido, no el definitivo. Cuando haya diez minutos,
 * lo bueno es subirlos al canal de YouTube como ocultos (`tipo: 'youtube'`) o
 * comprimirlos al repositorio (`npm run testimonios`, `tipo: 'archivo'`). Los
 * tres tipos conviven; cambiar uno es cambiar una línea en `lib/contenido.ts`.
 */

/**
 * Saca el identificador de lo que sea que se pegue: el enlace de «Compartir»,
 * el de la barra de direcciones, el de vista previa, o el identificador suelto.
 *
 * Se admiten todas las formas porque quien copia un enlace de Drive no sabe
 * cuál de ellas ha copiado, y fallar por eso sería absurdo.
 */
export function idDeDrive(crudo: string): string | null {
  const t = crudo.trim();
  if (!t) return null;

  const formas = [
    /drive\.google\.com\/file\/d\/([\w-]+)/, // .../file/d/ID/view
    /drive\.google\.com\/open\?id=([\w-]+)/, // .../open?id=ID
    /drive\.google\.com\/uc\?[^\s]*id=([\w-]+)/, // .../uc?export=...&id=ID
    /docs\.google\.com\/[^\s]*\/d\/([\w-]+)/, // por si se cuela un enlace de Docs
  ];
  for (const f of formas) {
    const m = t.match(f);
    if (m) return m[1];
  }

  // Un identificador suelto. Los de Drive son largos; el mínimo de 20 evita
  // confundir una palabra escrita a mano con un identificador.
  return /^[\w-]{20,}$/.test(t) ? t : null;
}

/**
 * El archivo en crudo, para meterlo en una etiqueta `<video>` de la web.
 *
 * POR QUÉ HACE FALTA ESTO Y NO VALE EL VISOR. El visor de Drive va dentro de
 * un marco de otra web, y desde fuera no se le puede decir nada: ni que empiece
 * solo, ni que vaya en silencio, ni que se repita. Para que los testimonios se
 * muevan callados en la portada y se abran con sonido al pararse encima de uno,
 * el vídeo tiene que ser un `<video>` de la propia página, y eso necesita la
 * dirección del archivo, no la del visor.
 *
 * Esta dirección funciona solo si el archivo está compartido con enlace
 * público, y Google la limita más que el visor. Es lo que hay mientras los
 * vídeos vivan en Drive; ver la nota de arriba.
 */
export function urlDirectaDeDrive(id: string): string {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`;
}

/**
 * La dirección del visor, que se usa solo como red de seguridad.
 *
 * Si el archivo en crudo no carga —Google ha cortado, el archivo ha dejado de
 * ser público, el navegador no entiende el códec—, al pulsar se monta este
 * marco en su lugar. Se pierde el silencio y el bucle, pero el vídeo se ve, que
 * es lo que importa.
 *
 * Es `/preview` y no `/view`: `view` es la página entera de Drive, con su
 * cabecera y su menú, y dentro de un marco de 250 px de ancho no se ve nada.
 */
export function urlDeDrive(id: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
}

/**
 * La imagen de antes de pulsar.
 *
 * Drive saca un fotograma de cada vídeo y lo sirve por aquí. `sz=w800` pide
 * uno de 800 px de ancho: de sobra para una tarjeta de 270 y lo bastante poco
 * para que no pese.
 *
 * Esto falla más a menudo que el reproductor —Drive corta las imágenes
 * enlazadas desde fuera antes que los vídeos—, así que la tarjeta tiene que
 * verse bien también sin ella. De eso se ocupa `Testimonios.tsx`, que deja una
 * carátula dibujada con las iniciales en lugar de un hueco roto.
 */
export function caratulaDeDrive(id: string): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`;
}
