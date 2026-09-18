import type { Metadata } from 'next';
import FormularioContacto from '@/components/FormularioContacto';
import { INSTAGRAM, INSTAGRAM_USUARIO } from '@/lib/contenido';

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Dudas de una formación, de la lista de espera o algo que quieras proponerme. Contesta Sorela, y tarda menos de 48 horas.',
};

export default function Contacto() {
  return (
    <main className="pagina">
      <section style={{ padding: 'clamp(70px,10vw,140px) 0 clamp(60px,9vw,120px)' }}>
        <div className="wrap rejilla" style={{ alignItems: 'start' }}>
          <div className="columna" style={{ gap: 22 }}>
            <h1 className="titulo-xl" style={{ fontSize: 'clamp(40px,6vw,76px)' }}>
              Escríbeme.
            </h1>
            <p className="lede max-440" style={{ lineHeight: 1.62 }}>
              Dudas de una formación, de la lista de espera o algo que quieras proponerme.
              Contesto yo, y tardo menos de 48 horas.
            </p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 300, color: 'var(--muted-2)' }}>
              En Instagram voy más rápido:{' '}
              <a href={INSTAGRAM} className="enlace-fino" target="_blank" rel="noopener">
                {INSTAGRAM_USUARIO}
              </a>
            </p>
          </div>

          <FormularioContacto />
        </div>
      </section>
    </main>
  );
}
