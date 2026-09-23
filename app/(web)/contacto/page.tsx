import type { Metadata } from 'next';
import FormularioContacto from '@/components/FormularioContacto';
import { INSTAGRAM, INSTAGRAM_USUARIO } from '@/lib/contenido';

/**
 * «Contacto» a secas no lo busca nadie y no dice de quién. El título lleva el
 * nombre —que es por lo que llegan a esta página— y las 48 horas, que es la
 * promesa concreta que hace la página y la razón para escribir en vez de
 * seguir mirando.
 *
 * La descripción pasa a primera persona para que case con el texto de la
 * página, que también lo está («Contesto yo»).
 */
export const metadata: Metadata = {
  title: { absolute: 'Contacto con Sorela Caro: te contesto yo en 48 horas' },
  description:
    'Dudas de una formación, de la lista de espera o algo que quieras proponerme: escríbeme por aquí. Contesto yo, y tardo menos de 48 horas. En Instagram, antes.',
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
