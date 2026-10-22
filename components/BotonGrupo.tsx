import css from './BotonGrupo.module.css';

/**
 * «Entrar al grupo de WhatsApp», el paso que sigue a apuntarse.
 *
 * `enlace` es el personal que devuelve /api/captar: pasa por /grupo, que apunta
 * el clic en su ficha y la manda al grupo (lib/grupo-whatsapp.ts). Si no llega,
 * /grupo cuenta el clic sin nombre; nunca se pierde el botón.
 */
export default function BotonGrupo({ enlace }: { enlace?: string | null }) {
  return (
    <a href={enlace || '/grupo?o=web'} target="_blank" rel="noopener noreferrer" className={css.boton}>
      <span className={css.icono} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M12 2.2a9.7 9.7 0 0 0-8.3 14.8L2.3 21.8l4.9-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.5-.3Z" />
        </svg>
      </span>
      <span className={css.texto}>
        <b>Grupo de WhatsApp</b>
        <span>Técnica Divine · con Sorela</span>
      </span>
      <span className={css.flecha} aria-hidden="true">
        Entrar →
      </span>
    </a>
  );
}

