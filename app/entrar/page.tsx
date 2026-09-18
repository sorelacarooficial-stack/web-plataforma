import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acceso a la plataforma de alumnas y terapeutas Divine.',
  robots: { index: false, follow: false },
};

/**
 * Marcador de la plataforma privada. Existe como prototipo en
 * `diseno/Plataforma Divine.dc.html` pero todavía no está implementada.
 * Cuando lo esté, definir NEXT_PUBLIC_PLATAFORMA_URL con su dirección y los
 * enlaces de la cabecera y el pie apuntarán allí sin tocar esta página.
 */
export default function Entrar() {
  return (
    <main className="pagina">
      <section style={{ padding: 'clamp(90px,14vw,190px) 0', textAlign: 'center' }}>
        <div
          className="wrap wrap-800"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}
        >
          <span className="distintivo">En construcción</span>
          <h1 className="titulo-lg">La plataforma todavía no está abierta.</h1>
          <p className="texto max-520">
            El aula, la agenda y la ficha pública de cada terapeuta llegan después. Mientras
            tanto, la formación se reserva por aquí y las clientas reservan directamente con su
            terapeuta.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 20,
              justifyContent: 'center',
              marginTop: 6,
            }}
          >
            <Link href="/formaciones" className="btn">
              Ver formaciones
            </Link>
            <Link href="/terapeutas" className="btn-linea" style={{ padding: '17px 30px' }}>
              Buscar terapeuta
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
