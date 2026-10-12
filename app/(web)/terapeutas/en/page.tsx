import { permanentRedirect } from 'next/navigation';

/**
 * /terapeutas/en, sin ciudad, no es una página: es el tramo común de las
 * páginas de ciudad (/terapeutas/en/sevilla). Quien recorta la dirección a
 * mano llega aquí; se le manda al mapa entero en vez de a un 404.
 */
export default function SinCiudad() {
  permanentRedirect('/terapeutas');
}
