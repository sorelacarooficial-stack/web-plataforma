'use client';

import { useEffect, useState } from 'react';
import css from './Contador.module.css';

/**
 * Cuenta atrás hasta la apertura de la Comunidad Divine.
 *
 * El 17 de octubre de 2026 a las 16:00 en España son las 14:00 UTC: en esa
 * fecha España va en horario de verano (UTC+2), que no cambia hasta el último
 * domingo de octubre. Se escribe con el desfase explícito para que la hora sea
 * la misma se mire desde donde se mire — importa, porque hay público en
 * Sudamérica y «las 16:00» significa otra cosa allí.
 */
export const APERTURA = '2026-10-17T16:00:00+02:00';

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
    </div>
  );
}
