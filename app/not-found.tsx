import Link from 'next/link';
import Cabecera from '@/components/Cabecera';
import PieDePagina from '@/components/PieDePagina';

// El 404 global vive fuera del grupo (web), así que se trae su cromo a mano.
export default function NoEncontrada() {
  return (
    <>
      <Cabecera />
      <main className="pagina">
      <section style={{ padding: 'clamp(90px,14vw,190px) 0', textAlign: 'center' }}>
        <div
          className="wrap wrap-800"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}
        >
          <p className="antetitulo">Error 404</p>
          <h1 className="titulo-lg">Esta página no existe.</h1>
          <p className="texto max-480">
            O la he movido yo, o el enlace venía mal. Desde el inicio se llega a todo.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', marginTop: 6 }}>
            <Link href="/" className="btn">
              Volver al inicio
            </Link>
            <Link href="/contacto" className="btn-linea" style={{ padding: '17px 30px' }}>
              Escribirme
            </Link>
          </div>
        </div>
        </section>
      </main>
      <PieDePagina />
    </>
  );
}
