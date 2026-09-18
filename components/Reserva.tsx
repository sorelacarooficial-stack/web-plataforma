'use client';

import { useState } from 'react';
import { DIAS_RESERVA, HORAS_RESERVA } from '@/lib/contenido';
import formCss from './Formularios.module.css';
import css from './Reserva.module.css';

/**
 * Agenda de ejemplo de una terapeuta. Los huecos son fijos: cuando cada
 * terapeuta tenga su agenda real en la plataforma, esto lee de ahí.
 */
export default function Reserva({ ciudad }: { ciudad: string }) {
  const [dia, setDia] = useState(3);
  const [hora, setHora] = useState('11:30');
  const [enviado, setEnviado] = useState(false);

  const resumen = `Día ${dia} de marzo · ${hora} · consulta de ${ciudad}`;

  return (
    <div className={css.rejilla}>
      <div className="columna" style={{ gap: 18 }}>
        <p className={css.rotulo}>Marzo 2027</p>
        <div className={css.dias}>
          {DIAS_RESERVA.map((d) => {
            const activo = dia === d.num;
            return (
              <button
                key={d.num}
                type="button"
                onClick={() => setDia(d.num)}
                aria-pressed={activo}
                className={`${css.dia} ${activo ? css.diaActivo : ''}`}
              >
                <span className={css.dow}>{d.dow}</span>
                <span className={css.num}>{d.num}</span>
              </button>
            );
          })}
        </div>

        <p className={css.rotulo}>Horas libres</p>
        <div className={css.horas}>
          {HORAS_RESERVA.map((h) => {
            const activo = hora === h;
            return (
              <button
                key={h}
                type="button"
                onClick={() => setHora(h)}
                aria-pressed={activo}
                className={`${css.hora} ${activo ? css.horaActiva : ''}`}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>

      {enviado ? (
        <div className="formulario">
          <div className={formCss.exito} role="status">
            <h3 className={formCss.exitoTitulo}>Solicitud enviada.</h3>
            <p className={formCss.exitoTexto}>
              {resumen}. Te confirma ella por correo, no un robot.
            </p>
            <button
              type="button"
              className={formCss.deshacer}
              style={{ marginTop: 4 }}
              onClick={() => setEnviado(false)}
            >
              Pedir otra hora
            </button>
          </div>
        </div>
      ) : (
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            setEnviado(true);
          }}
        >
          <p className={css.resumen}>{resumen}</p>
          <input required placeholder="Nombre y apellidos" aria-label="Nombre y apellidos" className="campo" />
          <input required type="tel" placeholder="Teléfono" aria-label="Teléfono" className="campo" />
          <input required type="email" placeholder="Correo" aria-label="Correo" className="campo" />
          <textarea
            rows={3}
            placeholder="Cuéntale en dos líneas qué te trae"
            aria-label="Cuéntale en dos líneas qué te trae"
            className="campo"
          />
          <button type="submit" className="btn btn-md" style={{ marginTop: 6, justifyContent: 'center' }}>
            Confirmar reserva
          </button>
        </form>
      )}
    </div>
  );
}
