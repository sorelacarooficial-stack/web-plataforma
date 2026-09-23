'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import css from './calendario.module.css';

/**
 * El mes de un vistazo.
 *
 * Una lista de días sirve para repasar lo que viene, pero no para ver la forma
 * de la semana: dónde hay hueco, qué martes está lleno, cuántos días seguidos
 * no hay nada. Eso solo se ve en una cuadrícula.
 *
 * Este componente no pide datos ni los guarda: recibe los eventos que ya tiene
 * la agenda y devuelve el día que se pulse. Así el calendario se puede probar,
 * cambiar de sitio o quitar sin tocar nada de lo que hay detrás.
 *
 * Sobre las fechas: todas se construyen a mediodía. Sumar días desde la
 * medianoche parece lo natural, pero el domingo en que cambia la hora la
 * medianoche puede no existir y la fecha salta al día siguiente. A mediodía no
 * hay ningún cambio de hora en España, así que la cuenta siempre cuadra.
 */

/** Lo mínimo que el calendario necesita saber de un evento. */
export type EventoEnCalendario = {
  id: string;
  cuando: string | null;
  estado: 'Pendiente' | 'Hecho' | 'Cancelado';
};

type Props = {
  eventos: EventoEnCalendario[];
  /** El día marcado, en formato `2026-09-25`. Null si no hay ninguno. */
  seleccion: string | null;
  onSeleccionar: (clave: string | null) => void;
  /** El mes que se está viendo, como el día 1 de ese mes. */
  mes: Date;
  onCambiarMes: (mes: Date) => void;
};

/* Una letra por día, empezando en lunes, que es como se lee una semana aquí.
   Se escriben a mano en vez de sacarlas de Intl: los cortos del castellano son
   «lun», «mar», «mié»… y en una columna de 40px no caben. La inicial de
   miércoles se pone X para no repetir la M del martes. */
const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const MES_LARGO = new Intl.DateTimeFormat('es-ES', { month: 'long' });
const MES_Y_ANIO = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
});
const DIA_LARGO = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** `2026-09-25` a partir de una fecha, en hora local. La clave de todo esto. */
export function claveDia(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** El día 1 del mes de esa fecha, a mediodía. */
export function inicioDeMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12);
}

/** Otro día, contando desde el mediodía para que el cambio de hora no lo mueva. */
function sumarDias(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
}

function sumarMeses(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
}

/** Lunes = 0. getDay() cuenta desde el domingo, y aquí la semana empieza el lunes. */
function diaDeSemana(d: Date): number {
  return (d.getDay() + 6) % 7;
}

const conMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * El primer día que se pinta: el lunes de la semana en la que cae el día 1.
 * Casi siempre es de finales del mes anterior, y eso es lo correcto —una
 * semana partida por la mitad se lee peor que un par de días apagados.
 */
export function primerDiaVisible(mes: Date): Date {
  const uno = inicioDeMes(mes);
  return sumarDias(uno, -diaDeSemana(uno));
}

/* Siempre seis filas, aunque el mes quepa en cinco. Si la cuadrícula cambiara
   de alto al pasar de mes, todo lo que hay debajo daría un salto. */
const SEMANAS = 6;
const CELDAS = SEMANAS * 7;

export default function CalendarioMes({
  eventos,
  seleccion,
  onSeleccionar,
  mes,
  onCambiarMes,
}: Props) {
  /* Hoy se calcula una vez al montar y no en cada pintada: si se recalculara,
     un panel abierto toda la noche seguiría diciendo que «hoy» es ayer sin que
     nada lo actualice, y además cambiaría el resultado del memo sin avisar. */
  const [hoy] = useState(() => new Date());
  const claveHoy = claveDia(hoy);

  /* El día que puede recibir el foco con el tabulador. En una cuadrícula de 42
     botones, tabular por todos es insufrible: solo uno entra en el orden de
     tabulación y dentro se anda con las flechas. */
  const [foco, setFoco] = useState<string | null>(null);
  const celdas = useRef(new Map<string, HTMLButtonElement>());
  /* Solo se mueve el foco cuando lo ha pedido el teclado. Sin esto, el primer
     pintado le robaría el foco a lo que estuviera arriba de la página. */
  const moverFoco = useRef(false);

  /** Cuántos eventos hay cada día, contados por cómo quedaron. */
  const porDia = useMemo(() => {
    const mapa = new Map<
      string,
      { pendientes: number; hechos: number; cancelados: number; total: number }
    >();
    for (const ev of eventos) {
      if (!ev.cuando) continue;
      const fecha = new Date(ev.cuando);
      if (Number.isNaN(fecha.getTime())) continue;
      const clave = claveDia(fecha);
      const cuenta = mapa.get(clave) ?? {
        pendientes: 0,
        hechos: 0,
        cancelados: 0,
        total: 0,
      };
      if (ev.estado === 'Hecho') cuenta.hechos++;
      else if (ev.estado === 'Cancelado') cuenta.cancelados++;
      else cuenta.pendientes++;
      cuenta.total++;
      mapa.set(clave, cuenta);
    }
    return mapa;
  }, [eventos]);

  const dias = useMemo(() => {
    const desde = primerDiaVisible(mes);
    return Array.from({ length: CELDAS }, (_, i) => sumarDias(desde, i));
  }, [mes]);

  /* El único botón tabulable: el día marcado si está a la vista, si no hoy, y
     si el mes no es el de hoy, el día 1. Nunca queda la cuadrícula sin puerta
     de entrada. */
  const mesDelDia = (clave: string) => clave.slice(0, 7) === claveDia(mes).slice(0, 7);
  const tabulable =
    (foco && dias.some((d) => claveDia(d) === foco) && foco) ||
    (seleccion && mesDelDia(seleccion) && seleccion) ||
    (mesDelDia(claveHoy) && claveHoy) ||
    claveDia(inicioDeMes(mes));

  useEffect(() => {
    if (!moverFoco.current || !foco) return;
    moverFoco.current = false;
    celdas.current.get(foco)?.focus();
  }, [foco, mes]);

  /** Mueve el foco n días. Si se sale del mes que se está viendo, pasa página. */
  function irA(desde: Date, n: number) {
    const destino = sumarDias(desde, n);
    moverFoco.current = true;
    setFoco(claveDia(destino));
    const mesDestino = inicioDeMes(destino);
    if (mesDestino.getTime() !== inicioDeMes(mes).getTime()) onCambiarMes(mesDestino);
  }

  function teclas(e: React.KeyboardEvent, dia: Date) {
    const saltos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in saltos) {
      e.preventDefault();
      irA(dia, saltos[e.key]);
      return;
    }
    // Inicio y Fin: a los extremos de la semana, que es lo que espera quien
    // usa el teclado en cualquier otra cuadrícula.
    if (e.key === 'Home') {
      e.preventDefault();
      irA(dia, -diaDeSemana(dia));
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      irA(dia, 6 - diaDeSemana(dia));
      return;
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const nuevo = sumarMeses(mes, e.key === 'PageUp' ? -1 : 1);
      onCambiarMes(nuevo);
      moverFoco.current = true;
      // Se conserva el día del mes cuando existe: del 31 de marzo al 31 de
      // abril no se puede ir, así que se cae al último día que sí hay.
      const ultimo = new Date(nuevo.getFullYear(), nuevo.getMonth() + 1, 0).getDate();
      setFoco(
        claveDia(
          new Date(nuevo.getFullYear(), nuevo.getMonth(), Math.min(dia.getDate(), ultimo), 12),
        ),
      );
    }
  }

  const estaEnEsteMes = claveDia(inicioDeMes(hoy)).slice(0, 7) === claveDia(mes).slice(0, 7);

  return (
    <section className={css.marco} aria-label="Calendario del mes">
      <header className={css.cabecera}>
        <div className={css.titulo}>
          <h2 className={css.mes}>{conMayuscula(MES_LARGO.format(mes))}</h2>
          <span className={css.anio}>{mes.getFullYear()}</span>
        </div>

        <div className={css.mandos}>
          <button
            type="button"
            className={css.flecha}
            onClick={() => onCambiarMes(sumarMeses(mes, -1))}
            aria-label={`Ir a ${MES_Y_ANIO.format(sumarMeses(mes, -1))}`}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className={css.hoyBoton}
            onClick={() => {
              onCambiarMes(inicioDeMes(hoy));
              onSeleccionar(claveHoy);
            }}
            /* Cuando ya se está en el mes de hoy y hoy está marcado, el botón
               no haría nada: se apaga en vez de mentir con un botón vivo. */
            disabled={estaEnEsteMes && seleccion === claveHoy}
          >
            Hoy
          </button>
          <button
            type="button"
            className={css.flecha}
            onClick={() => onCambiarMes(sumarMeses(mes, 1))}
            aria-label={`Ir a ${MES_Y_ANIO.format(sumarMeses(mes, 1))}`}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </header>

      <div className={css.semana} aria-hidden="true">
        {INICIALES.map((letra, i) => (
          <span key={NOMBRES_DIA[i]} className={css.inicial}>
            {letra}
          </span>
        ))}
      </div>

      {/* La clave por mes reinicia la animación de entrada al pasar página: sin
          ella React reaprovecha los nodos y el cambio pasa desapercibido. */}
      <div
        className={css.rejilla}
        role="grid"
        aria-label={MES_Y_ANIO.format(mes)}
        key={claveDia(mes)}
      >
        {dias.map((d) => {
          const clave = claveDia(d);
          const cuenta = porDia.get(clave);
          const esDeOtroMes = d.getMonth() !== mes.getMonth();
          const esHoy = clave === claveHoy;
          const marcado = clave === seleccion;
          const finde = diaDeSemana(d) >= 5;

          // Tres puntos como mucho. Más no caben y, sobre todo, más no se
          // cuentan de un vistazo: a partir de ahí lo que informa es el número.
          const puntos = cuenta
            ? [
                ...Array(Math.min(cuenta.pendientes, 3)).fill('pendiente'),
                ...Array(
                  Math.max(0, Math.min(cuenta.hechos, 3 - Math.min(cuenta.pendientes, 3))),
                ).fill('hecho'),
              ].slice(0, 3)
            : [];

          const cuantas = cuenta
            ? cuenta.total === 1
              ? '1 cosa apuntada'
              : `${cuenta.total} cosas apuntadas`
            : 'nada apuntado';

          return (
            <button
              key={clave}
              type="button"
              ref={(el) => {
                if (el) celdas.current.set(clave, el);
                else celdas.current.delete(clave);
              }}
              role="gridcell"
              aria-selected={marcado}
              aria-current={esHoy ? 'date' : undefined}
              aria-label={`${conMayuscula(DIA_LARGO.format(d))}, ${cuantas}`}
              tabIndex={clave === tabulable ? 0 : -1}
              onKeyDown={(e) => teclas(e, d)}
              onClick={() => {
                setFoco(clave);
                // Volver a pulsar el día marcado lo desmarca: es la manera de
                // volver a ver la lista entera sin buscar otro botón.
                onSeleccionar(marcado ? null : clave);
                if (esDeOtroMes) onCambiarMes(inicioDeMes(d));
              }}
              className={[
                css.celda,
                esDeOtroMes ? css.fuera : '',
                finde ? css.finde : '',
                esHoy ? css.hoy : '',
                marcado ? css.marcado : '',
                cuenta ? css.conCosas : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={css.disco}>
                <span className={css.numero}>{d.getDate()}</span>
              </span>
              <span className={css.puntos} aria-hidden="true">
                {puntos.map((clase, i) => (
                  <span key={i} className={clase === 'hecho' ? css.puntoHecho : css.punto} />
                ))}
                {cuenta && cuenta.total > 3 && <span className={css.mas}>+{cuenta.total - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <p className={css.leyenda}>
        <span className={css.punto} aria-hidden="true" /> pendiente
        <span className={css.puntoHecho} style={{ marginLeft: 14 }} aria-hidden="true" /> hecho
        <span className={css.leyendaNota}>Pulsa un día para ver o apuntar lo de ese día.</span>
      </p>
    </section>
  );
}
