import type { ReactNode } from 'react';
import css from './landing.module.css';

/**
 * Los dos botones de las landings.
 *
 * `BotonBrillo` es la llamada principal: la píldora con degradado en los
 * dorados de la marca. Hay una por pantalla como mucho, porque dos llamadas
 * principales en el mismo sitio son ninguna.
 *
 * `BotonContorno` es el secundario: solo el borde, para todo lo demás.
 *
 * Los dos son enlaces y no botones, porque lo que hacen es llevar a otro
 * sitio —un ancla, WhatsApp—, y eso es un enlace.
 */
export function BotonBrillo({
  href,
  children,
  externo,
}: {
  href: string;
  children: ReactNode;
  externo?: boolean;
}) {
  return (
    <a
      href={href}
      className={css.brillo}
      {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

export function BotonContorno({
  href,
  children,
  externo,
}: {
  href: string;
  children: ReactNode;
  externo?: boolean;
}) {
  return (
    <a
      href={href}
      className={css.contorno}
      {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
    </a>
  );
}
