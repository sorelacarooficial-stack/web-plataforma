import type { Metadata } from 'next';
import ExploradorTerapeutas from '@/components/ExploradorTerapeutas';
import css from './terapeutas.module.css';

/**
 * Es la única página que pelea por la búsqueda de clienta final, no por la de
 * esteticista: quien escribe «drenaje linfático» buscando sesión, no curso.
 *
 * Sin ciudad en el título a propósito. El mapa está vacío (TERAPEUTAS = []),
 * así que un título del tipo «drenaje linfático en Badalona» prometería un
 * listado que hoy no existe, y eso hunde la página en cuanto la visitan.
 * Cuando haya terapeutas dadas de alta, la ciudad entra aquí.
 */
export const metadata: Metadata = {
  title: { absolute: 'Encuentra a tu terapeuta de drenaje linfático manual' },
  description:
    'El mapa de las terapeutas certificadas en la Técnica Divine. Todavía se está llenando: dime dónde estás y te aviso en cuanto haya una cerca de ti.',
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
