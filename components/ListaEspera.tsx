'use client';

import { useState } from 'react';
import css from './Formularios.module.css';

/** Lista de espera de la Comunidad Divine. No cobra ni compromete a nada. */
export default function ListaEspera() {
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <div className={css.exito} role="status">
        <h2 className={css.exitoTitulo}>Estás dentro.</h2>
        <p className={css.exitoTexto}>
          Te escribiré yo cuando tenga fecha, y antes te preguntaré qué necesitas que tenga. Nada
          de correos cada semana.
        </p>
        <button
          type="button"
          className={css.deshacer}
          style={{ marginTop: 4 }}
          onClick={() => setEnviado(false)}
        >
          Apuntar otro correo
        </button>
      </div>
    );
  }

  return (
    <form
      className="columna"
      style={{ gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        setEnviado(true);
      }}
    >
      <h2 className={css.titulo}>Apúntate a la lista</h2>

      <input required placeholder="Nombre" aria-label="Nombre" className="campo" />
      <input
        type="email"
        required
        placeholder="Correo"
        aria-label="Correo"
        className="campo"
      />
      <input
        required
        placeholder="Ciudad donde trabajas"
        aria-label="Ciudad donde trabajas"
        className="campo"
      />
      <select aria-label="En qué punto estás" className="campo" defaultValue="Ya me formé con Sorela">
        <option>Ya me formé con Sorela</option>
        <option>Tengo plaza en una formación</option>
        <option>Todavía no me he formado</option>
      </select>
      <textarea
        rows={3}
        placeholder="¿Qué necesitarías tener ahí dentro?"
        aria-label="Qué necesitarías tener ahí dentro"
        className="campo"
      />

      <button type="submit" className="btn btn-md" style={{ marginTop: 6, justifyContent: 'center' }}>
        Apuntarme a la lista
      </button>
      <p className="nota">Apuntarte no te compromete a nada y no te cobra nada.</p>
    </form>
  );
}
