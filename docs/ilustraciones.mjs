/**
 * Qué imagen acompaña a cada parte del dossier.
 *
 * Vive aparte del contenido a propósito. El JSON del dossier es el texto
 * cotejado palabra por palabra contra el documento original y se toca lo menos
 * posible; dónde va cada foto es una decisión de maquetación que cambia cada
 * vez que se mueve una sección. Mezclando las dos cosas, retocar una imagen
 * obligaría a volver a tocar el archivo del texto.
 *
 * LAS IMÁGENES SON LAS DEL DOCUMENTO ORIGINAL. Se extrajeron del PDF que
 * entregó Sorela y se convirtieron a WebP; no hay ninguna de banco de imágenes
 * ni ninguna inventada. Las láminas de anatomía son las suyas.
 *
 * POR QUÉ HAY UNA SEGUNDA COPIA EN JPEG. La web usa los WebP de `public/`, y lo
 * suyo sería que el PDF usara esos mismos archivos. No se puede: Chromium, que
 * es quien imprime, no sabe meter un WebP dentro de un PDF y lo descomprime a
 * mapa de bits. El documento pasaba de 1,8 MB a 13 MB —imposible de enviar por
 * correo— por usar el formato equivocado para el medio equivocado. Las de
 * `docs/impresion/` son las mismas imágenes en JPEG, generadas desde las de
 * `public/alumnas/` con `docs/preparar-impresion.mjs`.
 *
 * `apertura` es la lámina grande con la que abre la parte. `dentro` son las que
 * se intercalan cuando el texto se hace largo, y van colocadas por posición:
 * `tras` es el número de bloque después del cual aparece la imagen.
 * `galeria` cierra la parte con una rejilla.
 */

/** De dónde cuelgan las rutas, vistas desde `docs/dossier.html`. */
const A = './impresion/';

export const ILUSTRACIONES = [
  // Parte I · La Técnica Divine
  {
    apertura: { src: A + 'rostro.jpg', pie: 'Técnica Divine Facial', alto: true },
    dentro: [{ tras: 8, src: A + 'camilla.jpg', pie: 'Sesión de Técnica Divine' }],
  },

  // Parte II · ¿Cómo se impartirá la formación?
  {
    apertura: { src: A + 'manos.jpg', pie: 'Trabajo manual sobre abdomen' },
    dentro: [{ tras: 6, src: A + 'abdomen-1.jpg', pie: 'Maniobra de drenaje abdominal' }],
  },

  // Parte III · El sistema linfático
  {
    apertura: { src: A + 'anatomia-sistema.jpg', pie: 'El sistema linfático en el cuerpo', lamina: true },
    dentro: [
      { tras: 10, src: A + 'anatomia-funcion.jpg', pie: 'Función principal del sistema linfático', lamina: true },
      { tras: 22, src: A + 'anatomia-capilar.jpg', pie: 'Capilares linfáticos y líquido intersticial', lamina: true },
    ],
  },

  // Parte IV · Los ganglios linfáticos
  {
    apertura: { src: A + 'anatomia-ganglios.jpg', pie: 'Ganglios superficiales y profundos', lamina: true },
    dentro: [{ tras: 8, src: A + 'anatomia-ganglio.jpg', pie: 'Estructura de un ganglio linfático', lamina: true }],
  },

  // Parte V · Vasos y capilares linfáticos
  {
    apertura: { src: A + 'anatomia-vias.jpg', pie: 'Vías de drenaje y territorios', lamina: true },
    dentro: [{ tras: 6, src: A + 'anatomia-capilar.jpg', pie: 'Válvulas y flujo de la linfa', lamina: true }],
  },

  // Parte VI · Los órganos linfáticos
  {
    apertura: { src: A + 'anatomia-torso.jpg', pie: 'Órganos linfáticos del tronco', lamina: true },
    dentro: [{ tras: 14, src: A + 'anatomia-quilo.jpg', pie: 'Absorción intestinal y vasos quilíferos', lamina: true }],
  },

  // Parte VII · El drenaje linfático manual
  {
    apertura: { src: A + 'abdomen-2.jpg', pie: 'Drenaje linfático manual' },
  },

  // Parte VIII · La Técnica Divine en el cuerpo
  {
    apertura: { src: A + 'manos.jpg', pie: 'Maniobras sobre el tejido superficial' },
  },

  // Parte IX · Resultados y masaje drenante
  {
    apertura: { src: A + 'resultado-1.jpg', pie: 'Antes y después' },
    galeria: {
      titulo: 'Resultados',
      pie: 'Imágenes cedidas por las clientas. Los resultados varían con cada persona.',
      fotos: [
        A + 'resultado-2.jpg',
        A + 'resultado-3.jpg',
        A + 'resultado-4.jpg',
        A + 'resultado-5.jpg',
      ],
    },
  },
];
