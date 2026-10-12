/**
 * Las imágenes de los correos. Tienen que estar en una dirección pública:
 * el correo se abre en Gmail o en Outlook, no en la web, y solo carga lo que
 * está en internet. Viven en Storage (`correo/`), en JPG y PNG, que es lo que
 * entienden todos los programas de correo (el WebP no lo ve Outlook).
 *
 * Solo fotos de Sorela trabajando o en consulta: nada de cuerpos. Las fotos
 * con mucha piel hacen que los filtros de spam desconfíen.
 */
const B = 'https://firebasestorage.googleapis.com/v0/b/sorela-12c46.firebasestorage.app/o/correo%2F';

export const MARCA = {
  logoClaro: `${B}logo-claro.png?alt=media&token=384ee6e1-3118-4abe-9f69-9b1b20c7bfe4`,
  logo: `${B}logo.png?alt=media&token=77b7b98d-3f08-4da1-9698-30c1c23a0a1e`,
  imagenes: {
    equipo: `${B}sorela-corrigiendo.jpg?alt=media&token=7a580123-d7fb-4df1-8181-1b9f62130398`,
    consulta: `${B}sorela-alumna.jpg?alt=media&token=6bbb3e92-1fbd-4202-a002-6c02a8830b45`,
  },
  instagram: 'https://instagram.com/sorelacaro_',
  whatsapp: 'https://wa.me/34686154556',
};

export type ImagenCorreo = keyof typeof MARCA.imagenes | 'ninguna';

export const IMAGENES_CORREO: Record<ImagenCorreo, string> = {
  equipo: 'Sorela enseñando a una alumna',
  consulta: 'Sorela en consulta',
  ninguna: 'Sin imagen',
};
