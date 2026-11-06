'use client';

import { createContext, useContext } from 'react';

/**
 * Lo que cambia en directo y tienen que ver igual la ventana que se comparte
 * por Google Meet y la del presentador: plazas llenas, votos, ciudades encendidas…
 * Deck.tsx lo guarda en localStorage y lo pasa entre ventanas con
 * BroadcastChannel.
 */
export type EstadoClase = {
  plazas: number;
  votos: [number, number, number];
  unos: number;
  ciudades: string[];
  otras: number;
  fichas: boolean[];
  /** Respuestas del chat a «¿la IA está cambiando el mundo?»: [sí, no]. */
  tec: [number, number];
  /** Cuántas han escrito «QUIERO» para reservar. */
  quiero: number;
  /** Cuándo empezó la cuenta de 10 min de preguntas y reservas (ms), o null. */
  preguntasDesde: number | null;
  /** Cuándo empezaron los 10 min de preguntas del puente (antes de la parte 2). */
  puenteDesde: number | null;
  /** Volumen de las canciones, de 0 a 1 (se mueve desde las dos ventanas). */
  volumen: number;
};

export const ESTADO_INICIAL: EstadoClase = {
  plazas: 0,
  votos: [0, 0, 0],
  unos: 0,
  ciudades: [],
  otras: 0,
  fichas: [false, false, false],
  tec: [0, 0],
  quiero: 0,
  preguntasDesde: null,
  puenteDesde: null,
  volumen: 1,
};

export type Cambiar = (f: (e: EstadoClase) => EstadoClase) => void;

export const ContextoClase = createContext<{ estado: EstadoClase; cambiar: Cambiar }>({
  estado: ESTADO_INICIAL,
  cambiar: () => {},
});

export const useClase = () => useContext(ContextoClase);
