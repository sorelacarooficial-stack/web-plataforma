'use client';

import { useState } from 'react';

export default function BotonBaja({ c, f, correo }: { c: string; f: string; correo: string }) {
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'hecho' | 'fallo'>('listo');

  async function confirmar() {
    setEstado('enviando');
    try {
      const r = await fetch('/api/baja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c, f }),
      });
      setEstado((await r.json().catch(() => ({ ok: false }))).ok ? 'hecho' : 'fallo');
    } catch {
      setEstado('fallo');
    }
  }

  if (estado === 'hecho') {
    return (
      <p className="lede" role="status">
        Hecho: <strong>{correo}</strong> no recibirá más avisos. Si te escribo por algo que me pidas tú, eso sí te
        llegará.
      </p>
    );
  }
  return (
    <div className="columna" style={{ gap: 18 }}>
      <p className="lede">
        ¿Quieres dejar de recibir mis avisos en <strong>{correo}</strong>?
      </p>
      <div>
        <button type="button" className="btn btn-md" onClick={confirmar} disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Un momento…' : 'Sí, darme de baja'}
        </button>
      </div>
      {estado === 'fallo' && (
        <p role="alert" style={{ margin: 0, color: 'var(--arcilla)' }}>
          No he podido darte de baja. Respóndeme al correo y lo hago yo.
        </p>
      )}
    </div>
  );
}
