'use client';

import { useCallback, useEffect, useState } from 'react';
import { GRUPO_COMUNIDAD } from '@/lib/reserva';
import type { EstadoInicio, Marca } from '@/lib/empieza-aqui';

/** Avisa a Inicio y a Clases a la vez cuando algo se marca. */
const EVENTO = 'divine:empieza-aqui';

/**
 * Lo que lleva hecho de «Empieza aquí»: las lecciones vistas y las marcas
 * (celular, grupo, calendario). Lo lee de /api/empieza-aqui y lo apunta ahí.
 *
 * En «Ver como» (muestra) no se guarda nada: se marca solo en esta visita.
 */
export function useEmpiezaAqui(muestra = false) {
  const [estado, setEstado] = useState<EstadoInicio | null>(muestra ? { vistas: [], marcas: [] } : null);

  useEffect(() => {
    if (muestra) return;
    let vivo = true;
    const leer = () =>
      fetch('/api/empieza-aqui')
        .then((r) => r.json())
        .then((j) => vivo && setEstado(j.ok ? { vistas: j.vistas ?? [], marcas: j.marcas ?? [] } : { vistas: [], marcas: [] }))
        .catch(() => vivo && setEstado((e) => e ?? { vistas: [], marcas: [] }));
    leer();
    window.addEventListener(EVENTO, leer);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO, leer);
    };
  }, [muestra]);

  const apuntar = useCallback(
    (cuerpo: { vista: string } | { marca: Marca }) => {
      setEstado((e) => {
        const base = e ?? { vistas: [], marcas: [] };
        if ('vista' in cuerpo) return base.vistas.includes(cuerpo.vista) ? base : { ...base, vistas: [...base.vistas, cuerpo.vista] };
        return base.marcas.includes(cuerpo.marca) ? base : { ...base, marcas: [...base.marcas, cuerpo.marca] };
      });
      if (muestra) return;
      fetch('/api/empieza-aqui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
        .then(() => window.dispatchEvent(new Event(EVENTO)))
        .catch(() => {});
    },
    [muestra]
  );

  /* Si ya la abre desde la pantalla de inicio del celular, está guardada. */
  useEffect(() => {
    if (!estado || estado.marcas.includes('celular')) return;
    const enApp =
      window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (enApp) apuntar({ marca: 'celular' });
  }, [estado, apuntar]);

  return {
    estado,
    vista: (id: string) => Boolean(estado?.vistas.includes(id)),
    marca: (m: Marca) => Boolean(estado?.marcas.includes(m)),
    marcarVista: (id: string) => apuntar({ vista: id }),
    marcar: (m: Marca) => apuntar({ marca: m }),
  };
}

/** Abre el grupo de WhatsApp de la Comunidad Divine. */
export const ENLACE_GRUPO = GRUPO_COMUNIDAD;
