import type { Metadata, Viewport } from 'next';
import { GRUPOS, OPCIONES, grupoDe } from '@/lib/reserva';
import { WHATSAPP_SORELA } from '@/lib/contenido';
import css from '@/components/reserva/reserva.module.css';

/**
 * /reserva/gracias?o=<id>: adonde manda Stripe después de pagar. Da las
 * gracias, dice qué ha reservado y la mete en el grupo de su formación.
 * No se indexa.
 */

export const metadata: Metadata = {
  title: 'Reserva hecha · Técnica Divine',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: '#17140f' };

const NOMBRE_GRUPO = {
  caracas: 'el grupo de Caracas',
  medellin: 'el grupo de Medellín',
  online: 'el grupo de Divine® Online',
  membresia: 'la comunidad de la Membresía',
} as const;

export default async function Gracias({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const { o } = await searchParams;
  const opcion = OPCIONES.find((x) => x.id === (Array.isArray(o) ? o[0] : o));
  const grupo = opcion ? grupoDe(opcion) : null;
  const enlace = grupo ? GRUPOS[grupo] : '';
  const wa = (t: string) => `https://wa.me/${WHATSAPP_SORELA.replace(/\D/g, '')}?text=${encodeURIComponent(t)}`;
  const que = opcion ? `${opcion.titulo} (${opcion.detalle})` : 'mi plaza';
  const entrar = enlace || wa(`Hola, acabo de pagar: ${que}. ¿Me añadís al grupo?`);
  const membresia = grupo === 'membresia';

  return (
    <main className={css.pagina}>
      <header className={css.hero} style={{ backgroundImage: 'url(/clase/grupo.webp)', paddingBottom: 56 }}>
        <div className={css.heroVelo} />
        <div className={css.heroDentro}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clase/logo-oro.webp" alt="Sorela Caro · Técnica Divine" className={css.logo} />
          <p className={css.ceja}>Pago recibido</p>
          <h1 className={css.titulo}>
            {membresia ? (
              <>
                Bienvenida a la <strong>Membresía</strong>
              </>
            ) : (
              <>
                Gracias, tu plaza <strong>es tuya</strong>
              </>
            )}
          </h1>
          {opcion && (
            <p style={{ margin: '16px auto 0', maxWidth: 420, fontSize: 16, lineHeight: 1.5, opacity: 0.9 }}>
              <b>{opcion.titulo}</b>
              <br />
              {opcion.detalle}
            </p>
          )}
        </div>
      </header>

      <section className={css.bloque} style={{ maxWidth: 520, margin: '0 auto', paddingTop: 30 }}>
        <p className={css.paso}>1 · Entra ahora en {grupo ? NOMBRE_GRUPO[grupo] : 'el grupo'}</p>
        <p className={css.suave} style={{ marginTop: 6 }}>
          Ahí te mandamos todo: fechas, lugar, material y avisos. Es el paso más importante.
        </p>
        <a className={css.boton} href={entrar} target="_blank" rel="noopener noreferrer" style={{ fontSize: 18, padding: '18px 16px' }}>
          Entrar al grupo
          {!enlace && <small>por WhatsApp</small>}
        </a>

        <p className={css.paso} style={{ marginTop: 34 }}>
          2 · Guarda tu recibo
        </p>
        <p className={css.suave} style={{ marginTop: 6 }}>
          Te llega al correo. Si no lo ves, mira en «spam» o «promociones».
        </p>

        <p className={css.paso} style={{ marginTop: 34 }}>
          3 · Te escribimos
        </p>
        <p className={css.suave} style={{ marginTop: 6 }}>
          Nuestro equipo te escribe por WhatsApp con los siguientes pasos. Si tienes cualquier duda, escríbenos tú.
        </p>
        <a className={`${css.boton} ${css.botonWa}`} href={wa(`Hola, acabo de pagar: ${que}. Tengo una duda.`)} target="_blank" rel="noopener noreferrer">
          Escribir al equipo
        </a>
      </section>

      <footer className={css.pie}>
        <p>Nos vemos muy pronto. Sorela Caro · Técnica Divine</p>
      </footer>
    </main>
  );
}
