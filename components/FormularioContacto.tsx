'use client';

import { useState } from 'react';
import css from './Formularios.module.css';

const MOTIVOS = [
  'Quiero formarme',
  'Lista de espera de la comunidad',
  'Soy clienta y busco terapeuta',
  'Colaboración',
];

export default function FormularioContacto() {
  const [enviado, setEnviado] = useState(false);

  return (
    <div className={css.contactoCaja}>
      {enviado ? (
        <div className={css.exito} role="status">
          <h2 className={css.exitoTitulo}>Recibido.</h2>
          <p className={css.exitoTexto}>
            Te contesto yo, y tardo menos de 48 horas. Si es urgente, por Instagram voy más rápido.
          </p>
          <button
            type="button"
            className={css.deshacer}
            style={{ marginTop: 4 }}
            onClick={() => setEnviado(false)}
          >
            Escribir otro mensaje
          </button>
        </div>
      ) : (
        <form
          className="columna"
          style={{ gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            setEnviado(true);
          }}
        >
          <input required placeholder="Nombre" aria-label="Nombre" className="campo" />
          <input required type="email" placeholder="Correo" aria-label="Correo" className="campo" />
          <select aria-label="Motivo" className="campo" defaultValue={MOTIVOS[0]}>
            {MOTIVOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <textarea
            required
            rows={5}
            placeholder="Cuéntame"
            aria-label="Cuéntame"
            className="campo"
          />
          <button type="submit" className="btn btn-md" style={{ marginTop: 6, justifyContent: 'center' }}>
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
