'use client';

import { useEffect, useState } from 'react';
import type { Publico } from '@/lib/empieza-aqui';
import type { ProximaClase } from '@/lib/comunidad-tipos';
import { irA } from '@/lib/navegar';
import AnadirCalendario, { eventoDeClase } from './AnadirCalendario';
import { ENLACE_GRUPO, useEmpiezaAqui } from './useEmpiezaAqui';
import css from './primerospasos.module.css';

/**
 * «Tus primeros pasos»: la lista de Inicio que se marca sola.
 *
 * Cinco pasos, cada uno con su botón. Ninguno se tacha a mano: se marca
 * cuando lo hace (lección vista, perfil completo, lectura empezada, ficha
 * publicada, presentación en el muro) o al tocar su botón cuando no hay
 * forma de saberlo (celular, grupo de WhatsApp, calendario). Con los cinco,
 * la tarjeta desaparece.
 *
 * Lo que ya sabe el panel (perfil, muro, lectura) llega por props; lo de
 * «Empieza aquí», de useEmpiezaAqui; la ficha y la clase en vivo, aquí.
 */

type Paso = { id: string; titulo: string; texto: string; hecho: boolean; boton: React.ReactNode };

export default function PrimerosPasos({
  publico: publicoInicial,
  perfilHecho,
  presentadaEnMuro,
  modulo01Empezado,
  muestra = false,
  elegir = false,
}: {
  publico: Publico;
  perfilHecho: boolean;
  presentadaEnMuro: boolean;
  modulo01Empezado: boolean;
  /** Sorela mirando «Ver como»: nada se guarda. */
  muestra?: boolean;
  /** Sorela: ver la versión de la academia o la de las homologadas. */
  elegir?: boolean;
}) {
  const [publico, setPublico] = useState<Publico>(publicoInicial);
  const ea = useEmpiezaAqui(muestra);
  const [fichaPublicada, setFichaPublicada] = useState(false);
  const [clase, setClase] = useState<ProximaClase>(null);

  useEffect(() => {
    if (publico !== 'homologadas') return;
    const json = (u: string) => fetch(u).then((r) => r.json()).catch(() => ({ ok: false }));
    if (!muestra) json('/api/ficha').then((j) => j.ok && setFichaPublicada(j.ficha?.estado === 'publicada'));
    json('/api/comunidad?solo=muro').then((j) => j.ok && setClase(j.proximaClase ?? null));
  }, [publico, muestra]);

  const abrirLeccion = (id: string) => irA('aula', { l: id });
  const bienvenida = () => window.dispatchEvent(new Event('divine:onboarding'));
  const boton = (texto: string, hacer: () => void, desactivado = false) => (
    <button type="button" className={css.boton} onClick={hacer} disabled={desactivado}>
      {texto}
    </button>
  );

  const comunes: Paso[] = [
    {
      id: 'video',
      titulo: 'Mira el video de bienvenida',
      texto: 'Menos de un minuto, con Sorela.',
      hecho: ea.vista('ea-00'),
      boton: boton('Ver el video', () => abrirLeccion('ea-00')),
    },
    {
      id: 'perfil',
      titulo: 'Completa tu perfil',
      texto: 'Tu foto y tu ciudad.',
      hecho: perfilHecho,
      boton: boton('Completar', bienvenida, muestra),
    },
  ];

  const pasos: Paso[] =
    publico === 'academia'
      ? [
          ...comunes,
          {
            id: 'celular',
            titulo: 'Guarda la plataforma en tu celular',
            texto: 'Para entrar con un toque, como una app.',
            hecho: ea.marca('celular'),
            boton: boton('Cómo se hace', () => abrirLeccion('ea-02')),
          },
          {
            id: 'modulo',
            titulo: 'Abre el Módulo 01',
            texto: 'Empieza a leer el Precurso.',
            hecho: modulo01Empezado,
            boton: boton('Abrir', () => irA('aula')),
          },
          {
            id: 'grupo',
            titulo: 'Entra al grupo y preséntate',
            texto: 'El grupo de WhatsApp de la Comunidad Divine.',
            hecho: ea.marca('grupo'),
            boton: boton('Entrar al grupo', () => {
              ea.marcar('grupo');
              window.open(ENLACE_GRUPO, '_blank', 'noopener');
            }),
          },
        ]
      : [
          ...comunes,
          {
            id: 'ficha',
            titulo: 'Activa tu ficha',
            texto: 'Para salir en Localiza tu terapeuta.',
            hecho: fichaPublicada,
            boton: boton('Activar', bienvenida, muestra),
          },
          {
            id: 'muro',
            titulo: 'Preséntate en el muro',
            texto: 'Quién eres, de dónde y qué quieres este mes.',
            hecho: presentadaEnMuro,
            boton: boton('Ir al muro', () => irA('comunidad')),
          },
          {
            id: 'calendario',
            titulo: 'Añade la clase en vivo a tu calendario',
            texto: clase ? 'Te llega el aviso con el enlace.' : 'Aún no hay fecha. Saldrá aquí en cuanto la haya.',
            hecho: ea.marca('calendario'),
            boton: clase ? <AnadirCalendario evento={eventoDeClase(clase)} alUsar={() => ea.marcar('calendario')} /> : null,
          },
        ];

  const hechos = pasos.filter((x) => x.hecho).length;
  // Con los cinco hechos, desaparece (en la vista previa de Sorela, no: tiene que poder verla).
  if (ea.estado === null || (hechos === pasos.length && !elegir)) return null;
  const siguiente = pasos.find((x) => !x.hecho)?.id;

  return (
    <section className={css.tarjeta} aria-labelledby="primeros-pasos-titulo">
      <header className={css.cabeza}>
        <div>
          <p className={css.rotulo}>{elegir ? 'Vista previa · solo la ves tú' : 'Para empezar'}</p>
          <h2 id="primeros-pasos-titulo" className={css.titulo}>
            Tus primeros <strong>pasos</strong>
          </h2>
          {elegir && (
            <div className={css.elegir} role="group" aria-label="Versión">
              {(['academia', 'homologadas'] as const).map((x) => (
                <button key={x} type="button" aria-pressed={publico === x} onClick={() => setPublico(x)}>
                  {x === 'academia' ? 'Academia' : 'Homologadas'}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className={css.cuenta}>
          <b>{hechos}</b> de {pasos.length}
        </p>
      </header>
      <div className={css.barra} aria-hidden="true">
        <span style={{ width: `${Math.round((hechos / pasos.length) * 100)}%` }} />
      </div>
      <ol className={css.lista}>
        {pasos.map((x, i) => (
          <li key={x.id} className={css.paso} data-hecho={x.hecho ? '' : undefined} data-siguiente={x.id === siguiente ? '' : undefined}>
            <span className={css.marca} aria-label={x.hecho ? 'Hecho' : `Paso ${i + 1}`}>
              {x.hecho ? '✓' : i + 1}
            </span>
            <span className={css.texto}>
              <strong>{x.titulo}</strong>
              <em>{x.texto}</em>
            </span>
            {!x.hecho && x.boton && <span className={css.accion}>{x.boton}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
