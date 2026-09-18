import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Jost } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--fuente-cormorant',
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--fuente-jost',
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
    'La Técnica Divine no te da otro protocolo. Te da el criterio para decidir qué necesita el cuerpo que hoy tienes en la camilla. Formación presencial en estética avanzada con Sorela Caro.',
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
      'Formación presencial en estética avanzada. Grupos de ocho, cuerpo real desde la primera hora.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sorela Caro · Técnica Divine',
    description:
      'Formación presencial en estética avanzada. Grupos de ocho, cuerpo real desde la primera hora.',
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
