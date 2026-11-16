'use client';

import { useState } from 'react';
import { descargarIcs, enlaceGoogle, enlaceOutlook, type EventoCalendario } from '@/lib/calendario-evento';
import css from './anadircalendario.module.css';

/**
 * «Añadir a mi calendario»: un botón que abre las tres opciones (Google,
 * Apple y Outlook). `alUsar` avisa cuando elige una, para marcar su paso
 * de «Empieza aquí».
 */
export default function AnadirCalendario({
  evento,
  alUsar,
  oscuro = false,
}: {
  evento: EventoCalendario;
  alUsar?: () => void;
  /** Sobre fondo oscuro (la tarjeta de la clase en vivo). */
  oscuro?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const usar = () => {
    alUsar?.();
    setAbierto(false);
  };
  return (
    <div className={css.caja} data-oscuro={oscuro ? '' : undefined}>
      <button type="button" className={css.boton} aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}>
        Añadir a mi calendario
      </button>
      {abierto && (
        <div className={css.opciones}>
          <a href={enlaceGoogle(evento)} target="_blank" rel="noreferrer" onClick={usar}>
            Google
          </a>
          <button
            type="button"
            onClick={() => {
              descargarIcs(evento);
              usar();
            }}
          >
            Apple
          </button>
          <a href={enlaceOutlook(evento)} target="_blank" rel="noreferrer" onClick={usar}>
            Outlook
          </a>
        </div>
      )}
    </div>
  );
}

/** La clase en vivo como evento de calendario. Dura una hora (a confirmar con Sorela). */
export function eventoDeClase(clase: { titulo: string; cuando: string; enlace: string }): EventoCalendario {
  const inicio = new Date(clase.cuando);
  return {
    uid: `clase-vivo-${inicio.toISOString().slice(0, 16).replace(/\D/g, '')}`,
    titulo: `${clase.titulo} · Comunidad Divine`,
    inicio,
    minutos: 60,
    descripcion: clase.enlace ? `Clase en vivo con Sorela Caro.\nEnlace: ${clase.enlace}` : 'Clase en vivo con Sorela Caro. El enlace está en tu plataforma.',
    lugar: clase.enlace || 'Plataforma Divine',
  };
}
