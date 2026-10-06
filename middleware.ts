import { NextResponse, type NextRequest } from 'next/server';

/**
 * El subdominio de alumnas.
 *
 * `alumnas.sorelacarodivine.com` enseña la landing del Precurso sin que la
 * dirección cambie a `/alumnas`: quien entra ve el subdominio en la barra y se
 * queda ahí.
 *
 * SE HACE CON UNA REESCRITURA Y NO CON UNA REDIRECCIÓN, y la diferencia
 * importa: una redirección mandaría a la persona a la web principal y el
 * subdominio solo sería un atajo que desaparece al cargar. Reescribiendo, el
 * servidor sirve la página de `/alumnas` y la dirección sigue siendo la del
 * subdominio.
 *
 * LO QUE ESTO NO HACE, Y HAY QUE HACER FUERA: dar de alta el subdominio. Esto
 * reparte lo que llega; que llegue depende de dos cosas que viven fuera del
 * código —un registro DNS de tipo CNAME en el proveedor del dominio apuntando
 * a Vercel, y el dominio añadido en el proyecto de Vercel—. Sin esas dos, este
 * archivo no se ejecuta nunca porque no hay petición que repartir.
 *
 * La ruta `/alumnas` sigue existiendo por sí misma en el dominio principal.
 * No se esconde: tener una sola página accesible por dos caminos es normal, y
 * esconder uno de los dos solo sirve para que un día nadie sepa por qué una
 * dirección da 404.
 */

/** El prefijo del subdominio. Se compara en minúsculas y sin el puerto. */
const SUBDOMINIO = 'alumnas';

export function middleware(peticion: NextRequest) {
  const anfitrion = (peticion.headers.get('host') ?? '').toLowerCase().split(':')[0];

  if (!anfitrion.startsWith(`${SUBDOMINIO}.`)) return NextResponse.next();

  const url = peticion.nextUrl.clone();

  /* Ya está dentro: no se reescribe otra vez. Sin esto, `/alumnas` en el
     subdominio acabaría en `/alumnas/alumnas`. */
  if (url.pathname === `/${SUBDOMINIO}` || url.pathname.startsWith(`/${SUBDOMINIO}/`)) {
    return NextResponse.next();
  }

  url.pathname = `/${SUBDOMINIO}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

/**
 * Por dónde pasa esto.
 *
 * Se deja fuera lo que no es una página: las rutas de la API —que tienen que
 * responder igual desde el subdominio—, los archivos internos de Next, y todo
 * lo que tenga extensión, que son los recursos de `public/`. Hacer pasar una
 * imagen por aquí es trabajo por cada archivo de cada carga de cada página.
 */
export const config = {
  matcher: ['/((?!api|_next|.*\\.).*)'],
};
