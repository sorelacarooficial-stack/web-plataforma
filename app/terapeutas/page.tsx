import type { Metadata } from 'next';
import ExploradorTerapeutas from '@/components/ExploradorTerapeutas';
import css from './terapeutas.module.css';

export const metadata: Metadata = {
  title: 'Localiza tu terapeuta',
  description:
    'Mapa de las terapeutas certificadas en la Técnica Divine: Madrid, Barcelona, Valencia, Sevilla, Bilbao y Palma. Ninguna aparece por pagar.',
};

export default function Terapeutas() {
  return (
    <main className="pagina">
      <section className={css.portada}>
        <div className="wrap">
          <h1 className={css.titulo}>Localiza tu terapeuta</h1>
          <p className="lede">
            Todas se formaron y certificaron conmigo, y todas empiezan valorándote antes de
            tocarte. Mira quién tienes cerca.
          </p>
        </div>
      </section>

      <ExploradorTerapeutas />
    </main>
  );
}
