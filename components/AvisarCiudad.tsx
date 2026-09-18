'use client';

import { useState } from 'react';
import css from './Formularios.module.css';

/**
 * Aviso de convocatoria cerca. Como el resto de formularios del sitio, todavía
 * no envía a ningún sitio: confirma en pantalla. Al conectar backend, sustituir
 * el cuerpo de onSubmit por la llamada correspondiente y mantener el estado.
 */
export default function AvisarCiudad() {
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <p className={css.confirmacion} role="status">
        Apuntado. Te escribo en cuanto abra fecha por tu zona.{' '}
        <button type="button" className={css.deshacer} onClick={() => setEnviado(false)}>
          Apuntar otra ciudad
        </button>
      </p>
    );
  }

  return (
    <form
      className={css.enLinea}
      onSubmit={(e) => {
        e.preventDefault();
        setEnviado(true);
      }}
    >
      <input
        type="email"
        required
        placeholder="tu@correo.com"
        aria-label="Tu correo"
        className="campo-pastilla"
        style={{ flex: '1 1 180px' }}
      />
      <input
        required
        placeholder="Tu ciudad"
        aria-label="Tu ciudad"
        className="campo-pastilla"
        style={{ flex: '1 1 120px' }}
      />
      <button type="submit" className="btn-linea" style={{ padding: '15px 28px', fontSize: '12.5px', letterSpacing: '0.16em' }}>
        Avísame
      </button>
    </form>
  );
}
