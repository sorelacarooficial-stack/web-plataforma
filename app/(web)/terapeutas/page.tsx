import type { Metadata } from 'next';
import ExploradorTerapeutas from '@/components/ExploradorTerapeutas';
import css from './terapeutas.module.css';

export const metadata: Metadata = {
  title: 'Localiza tu terapeuta',
  description:
    'El mapa de terapeutas certificadas en la Técnica Divine. Todavía en preparación: aquí irán las que se certifiquen con Sorela Caro.',
};

export default function Terapeutas() {
  return (
    <main className="pagina">
      <section className={css.portada}>
        <div className="wrap">
          <h1 className={css.titulo}>Localiza tu terapeuta</h1>
          {/* Mientras el mapa esté vacío, el texto no puede decir «mira quién
              tienes cerca»: no hay nadie. */}
          <p className="lede">
            Aquí irán las terapeutas que se certifiquen conmigo, con su ciudad y su forma de
            reservar. Todas empiezan valorándote antes de tocarte.
          </p>
        </div>
      </section>

      <ExploradorTerapeutas />
    </main>
  );
}
