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

/** Dominio de producción. Vercel lo expone en VERCEL_PROJECT_PRODUCTION_URL,
 *  pero se fija aquí para que las URL canónicas sean correctas también en local. */
const SITIO = 'https://sorelacarodivine.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: {
    default: 'Sorela Caro · Técnica Divine',
    template: '%s · Técnica Divine',
  },
  description:
    'Juventud linfática y ganglionar en tus manos. Drenaje linfático manual llevado más lejos: formación de Sorela Caro en dos etapas, primero online y después presencial.',
  applicationName: 'Técnica Divine',
  authors: [{ name: 'Sorela Caro' }],
  creator: 'Sorela Caro',
  icons: { icon: '/icono.png', apple: '/icono.png' },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'Sorela Caro · Técnica Divine',
    url: SITIO,
    title: 'Antes de poner las manos, aprende a mirar.',
    description:
      'Formación en estética avanzada con Sorela Caro. Primero online, después presencial, con práctica sobre cuerpo real.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sorela Caro · Técnica Divine',
    description:
      'Formación en estética avanzada con Sorela Caro. Primero online, después presencial, con práctica sobre cuerpo real.',
  },
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
