import Link from 'next/link';
import { CORREO_PRIVACIDAD, DESTINATARIOS_GENERAL, type PrimeraCapa } from '@/lib/privacidad';
import css from './InfoPrivacidad.module.css';

/**
 * La información básica de protección de datos, junto a cada formulario.
 *
 * Es la «primera capa» que pide la AEPD: quién trata los datos, para qué,
 * con qué base, a quién se comunican y qué derechos tienes, ANTES de enviar
 * nada. Va plegada para no comerse el formulario, pero el resumen de una
 * línea se ve siempre: quien quiera más, la abre; quien no, sabe que está.
 *
 * Los textos salen de `lib/privacidad.ts`, igual que la política completa:
 * los dos dicen lo mismo porque leen lo mismo.
 *
 * `destinatarios` cambia la línea de a quién llegan los datos (también puede
 * venir en la propia capa). Casi todos los formularios no los ceden a nadie;
 * la ficha del mapa los PUBLICA y la lista de espera invita a un grupo de
 * WhatsApp donde el número se ve: decir ahí «no se ceden a nadie» sería falso
 * justo donde más importa.
 */
export default function InfoPrivacidad({
  capa,
  claro,
  destinatarios,
}: {
  capa: PrimeraCapa;
  claro?: boolean;
  destinatarios?: string;
}) {
  return (
    <details className={css.caja} data-claro={claro ? '' : undefined}>
      <summary className={css.resumen}>
        <span className={css.icono} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          </svg>
        </span>
        Información básica sobre protección de datos
      </summary>
      <dl className={css.lista}>
        <div>
          <dt>Responsable</dt>
          <dd>Sorela Caro.</dd>
        </div>
        <div>
          <dt>Finalidad</dt>
          <dd>{capa.finalidad}</dd>
        </div>
        <div>
          <dt>Legitimación</dt>
          <dd>{capa.base}</dd>
        </div>
        <div>
          <dt>Destinatarios</dt>
          <dd>{destinatarios ?? capa.destinatarios ?? DESTINATARIOS_GENERAL}</dd>
        </div>
        <div>
          <dt>Derechos</dt>
          <dd>
            Acceder, rectificar, suprimir, oponerte, limitar y portar tus datos, y retirar tu
            consentimiento, escribiendo a <a href={`mailto:${CORREO_PRIVACIDAD}`}>{CORREO_PRIVACIDAD}</a>.
            También puedes reclamar ante la Agencia Española de Protección de Datos.
          </dd>
        </div>
        <div>
          <dt>Más información</dt>
          <dd>
            <Link href="/legal/privacidad" target="_blank">
              Política de privacidad completa
            </Link>
            .
          </dd>
        </div>
      </dl>
    </details>
  );
}
