import Link from 'next/link';

/**
 * Lo que se ve si la plataforma no tiene Firebase configurado.
 *
 * Existe para no dejar a nadie dando vueltas: sin las variables de entorno el
 * acceso no puede funcionar, y mandar a la pantalla de login produciría un
 * bucle —entras, no hay sesión, vuelves al login— que parece un fallo de la
 * web cuando en realidad falta una clave en Vercel.
 */
export default function SinConfigurar() {
  return (
    <main
      className="pagina"
      style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24 }}
    >
      <div className="columna" style={{ gap: 18, maxWidth: 520, textAlign: 'center' }}>
        <p className="antetitulo" style={{ color: 'var(--oro)' }}>
          Plataforma
        </p>
        <h1 className="titulo-lg">El acceso todavía no está conectado.</h1>
        <p className="texto">
          Falta la configuración de Firebase en el servidor. En cuanto esté, esta página pedirá
          tus datos y entrarás con tu cuenta.
        </p>
        <p className="nota">
          Si eres quien lo administra: hay que rellenar las variables de Firebase en Vercel. Están
          documentadas en <code>.env.example</code>.
        </p>
        <Link href="/" className="btn btn-md" style={{ justifyContent: 'center' }}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
