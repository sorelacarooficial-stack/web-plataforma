import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

/**
 * Las fuentes viven en el repositorio (app/fuentes) y no se descargan de
 * Google al compilar.
 *
 * Por qué: con next/font/google, cada compilación va a buscar los archivos a
 * fonts.gstatic.com. Si ese día Google no responde —o la red por la que sale
 * el servidor de compilación no llega—, la compilación entera falla por una
 * tipografía. Aquí ya pasó. Teniéndolas dentro, el resultado es idéntico
 * (next/font también las sirve desde el propio dominio) y la compilación deja
 * de depender de nadie.
 *
 * Son las variables, así que un solo archivo cubre de 300 a 600: pesan 101 KB
 * los tres juntos, menos que los siete estáticos que hacían falta antes. Solo
 * el subconjunto latino, que cubre todo el español —tildes, eñes, signos de
 * apertura y comillas angulares—; el cirílico y el vietnamita sobraban.
 *
 * Para actualizarlas: scripts/traer-fuentes.mjs.
 */
const cormorant = localFont({
  src: [
    { path: './fuentes/cormorant-garamond-normal-latin.woff2', weight: '300 600', style: 'normal' },
    { path: './fuentes/cormorant-garamond-italic-latin.woff2', weight: '300 600', style: 'italic' },
  ],
  display: 'swap',
  variable: '--fuente-cormorant',
  // Si la fuente tarda, el texto se ve con esta antes. Se declaran las métricas
  // para que al cambiar no dé el salto de maquetación.
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

const jost = localFont({
  src: [{ path: './fuentes/jost-normal-latin.woff2', weight: '300 500', style: 'normal' }],
  display: 'swap',
  variable: '--fuente-jost',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

/**
 * Dominio de producción, CON www.
 *
 * Vercel expone el suyo en VERCEL_PROJECT_PRODUCTION_URL, pero se fija aquí
 * para que las direcciones canónicas sean correctas también en local y en las
 * vistas previas. Va con www porque la versión sin www responde 308 hacia
 * esta: una canónica sin www estaría señalando una dirección que redirige.
 * La misma cadena está escrita en app/robots.ts y app/sitemap.ts; las tres
 * tienen que cambiar juntas el día que cambie el dominio.
 */
const SITIO = 'https://www.sorelacarodivine.com';

export const metadata: Metadata = {
  /**
   * Sin esto, Next no sabe convertir en absolutas las rutas de la imagen de
   * compartir ni de la canónica, y quien reciba el enlace ve una caja gris.
   */
  metadataBase: new URL(SITIO),
  title: {
    default: 'Sorela Caro · Técnica Divine',
    template: '%s · Técnica Divine',
  },
  description:
    'Drenaje linfático manual llevado más lejos. Te enseño mi método en dos etapas: primero online y después presencial, corrigiéndote las manos.',
  applicationName: 'Técnica Divine',
  authors: [{ name: 'Sorela Caro' }],
  creator: 'Sorela Caro',
  publisher: 'Sorela Caro',
  /**
   * Cada página se declara canónica de sí misma. El './' lo resuelve Next con
   * la ruta de cada una sobre metadataBase, así que sale siempre con www y sin
   * el 308 de por medio. Escribir aquí una dirección fija haría que las ocho
   * páginas dijeran ser la portada.
   */
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'Sorela Caro · Técnica Divine',
    url: './',
    /**
     * Aquí no hay title ni description, y es a propósito: al faltar, Next
     * rellena cada página con SU título y SU descripción. Antes había un
     * título fijo —«Antes de poner las manos, aprende a mirar»— y las ocho
     * páginas se compartían por WhatsApp con el mismo texto, daba igual si el
     * enlace era el de formaciones o el de contacto.
     */
    images: [
      {
        /*
         * 1200×630, que es la medida que piden WhatsApp, Instagram y el resto.
         *
         * Antes iba el logotipo cuadrado de 512, y con `summary_large_image`
         * —que espera una apaisada— salía recortado y con franjas. Esta lleva
         * la cara de Sorela a un lado y el logotipo al otro: por WhatsApp se
         * comparte más una persona que un logotipo suelto.
         */
        url: '/compartir.jpg',
        width: 1200,
        height: 630,
        alt: 'Sorela Caro, creadora de la Técnica Divine',
      },
    ],
  },
  twitter: {
    // El título, la descripción y la imagen los hereda de openGraph.
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Para que en los resultados pueda salir la foto grande y el texto
      // entero, en vez del recorte corto que Google usa por defecto.
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  /**
   * Los iconos NO se declaran en este objeto. Next los toma de app/icon.png y
   * app/apple-icon.png, y así escribe él solo el tamaño y el tipo de cada uno.
   *
   * Importa el orden: en cuanto se pone `icons` aquí, Next ignora esos dos
   * archivos por completo. Mientras hubo un `icons: { icon: '/icono.png' }`,
   * la pestaña seguía enseñando el logotipo entero con sus franjas negras
   * —ilegible a 16 píxeles— aunque el icono nuevo ya estuviera en su sitio.
   */
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF9F6' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
};

/**
 * Se ejecuta antes del primer pintado para que la página no aparezca en claro
 * y salte a oscuro. El prototipo lo hacía en componentDidMount y parpadeaba.
 */
const TEMA_INICIAL = `
(function(){
  try{
    var g = localStorage.getItem('divine-tema');
    var t = g === 'oscuro' || g === 'claro'
      ? g
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');
    document.documentElement.setAttribute('data-tema', t);
  }catch(e){
    document.documentElement.setAttribute('data-tema','claro');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${cormorant.variable} ${jost.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
