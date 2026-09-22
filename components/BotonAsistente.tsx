'use client';

import { abrirAsistente } from '@/lib/abrir-asistente';

/**
 * Botón que abre el asistente con una pregunta ya escrita.
 *
 * Existe para que las páginas que lo usan sigan pintándose en el servidor: sin
 * esto, poner un onClick obligaría a marcar como componente de cliente la
 * sección entera que lo contiene, y con ella todo lo que cuelgue.
 */
export default function BotonAsistente({
  pregunta,
  children,
  className = 'btn btn-md',
}: {
  pregunta: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => abrirAsistente(pregunta)}>
      {children}
    </button>
  );
}
