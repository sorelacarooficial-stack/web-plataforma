/**
 * La plataforma privada (panel de alumna, miembro y admin) existe como
 * prototipo en `project/Plataforma Divine.dc.html`, pero no forma parte de
 * esta implementación. El botón "Entrar" apunta aquí: cuando la plataforma
 * esté montada, basta con definir NEXT_PUBLIC_PLATAFORMA_URL con su dirección
 * y el enlace pasa a llevar allí sin tocar componentes.
 */
export const PLATAFORMA_URL =
  process.env.NEXT_PUBLIC_PLATAFORMA_URL || '/entrar';
