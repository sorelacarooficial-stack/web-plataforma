'use client';

import { useEffect, useState } from 'react';
import { APERTURA, HORAS_APERTURA } from '@/lib/apertura';
import css from './Contador.module.css';

/**
 * Cuenta atrás hasta la apertura de la Comunidad Divine, con la hora que le
 * toca a cada país.
 *
 * La fecha ya no vive aquí: está en `lib/apertura.ts`. Vivía en este archivo y
 * además escrita a mano en otros siete sitios, y moverla era buscar «17 de
 * octubre» por el repositorio y confiar en no dejarse ninguno.
 *
 * Las horas de los cuatro países sí se pintan siempre, tenga o no sentido la
 * cuenta atrás. No es decoración: media lista está en Sudamérica, y «a las
 * siete de la tarde» sin decir de dónde hace que alguien se pierda el directo
 * por cuatro horas. Van calculadas del mismo instante, así que no pueden
 * desajustarse entre ellas.
 */

const UNIDADES = [
  { clave: 'dias', singular: 'día', plural: 'días' },
  { clave: 'horas', singular: 'hora', plural: 'horas' },
  { clave: 'minutos', singular: 'minuto', plural: 'minutos' },
  { clave: 'segundos', singular: 'segundo', plural: 'segundos' },
] as const;

type Restante = { dias: number; horas: number; minutos: number; segundos: number };

function calcular(hasta: number): Restante | null {
  const falta = hasta - Date.now();
  if (falta <= 0) return null;
  const s = Math.floor(falta / 1000);
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
  };
}

export default function Contador({ compacto = false }: { compacto?: boolean }) {
  // Arranca en null y no con el valor calculado: el servidor y el navegador
  // darían números distintos, React se quejaría de que no coinciden y el
  // primer pintado parpadearía. Se rellena ya montado, en el navegador.
  const [restante, setRestante] = useState<Restante | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const hasta = new Date(APERTURA).getTime();
    setRestante(calcular(hasta));
    setMontado(true);
    const t = setInterval(() => setRestante(calcular(hasta)), 1000);
    return () => clearInterval(t);
  }, []);

  if (montado && !restante) {
    return (
      <p className={css.abierta} role="status">
        La comunidad ya está abierta.
      </p>
    );
  }

  return (
    <div className={`${css.contador} ${compacto ? css.compacto : ''}`}>
      <ul className={css.bloques} aria-hidden="true">
        {UNIDADES.map((u) => {
          const v = restante?.[u.clave];
          return (
            <li key={u.clave} className={css.bloque}>
              <span className={css.cifra}>
                {/* Mientras no se ha montado se pintan dos guiones y no un cero:
                    un cero da la impresión de que ya ha llegado la hora. */}
                {v === undefined ? '––' : String(v).padStart(2, '0')}
              </span>
              <span className={css.unidad}>{u.plural}</span>
            </li>
          );
        })}
      </ul>

      {/* La versión que oye un lector de pantalla: los bloques sueltos no se
          entienden leídos en voz alta, y no hace falta que cante cada segundo. */}
      <p className={css.paraLeer} role="status">
        {restante
          ? `Faltan ${restante.dias} ${restante.dias === 1 ? 'día' : 'días'} y ${
              restante.horas
            } ${restante.horas === 1 ? 'hora' : 'horas'} para la apertura.`
          : 'Calculando cuánto falta para la apertura.'}
      </p>

      <Husos />
    </div>
  );
}

/**
 * La hora del directo en cada país.
 *
 * Va fuera del `if` de arriba a propósito: cuando la comunidad ya esté
 * abierta, el contador desaparece pero esto sigue teniendo sentido si algún
 * día se reutiliza para otra fecha. De momento se pinta siempre que se pinte
 * el contador.
 */
function Husos() {
  return (
    <ul className={css.husos}>
      {HORAS_APERTURA.map(({ lugar, hora }, i) => (
        <li key={lugar} className={`${css.huso} ${i === 0 ? css.husoPrincipal : ''}`}>
          <span className={css.husoHora}>{hora}</span>
          <span className={css.husoLugar}>{lugar}</span>
        </li>
      ))}
    </ul>
  );
}
