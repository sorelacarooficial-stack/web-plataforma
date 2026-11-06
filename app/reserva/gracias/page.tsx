import type { Metadata, Viewport } from 'next';
import { FORMACIONES_PAGO } from '@/lib/reserva';
import { WHATSAPP_SORELA } from '@/lib/contenido';
import GraciasComunidad from '@/components/reserva/GraciasComunidad';
import css from '@/components/reserva/reserva.module.css';

/**
 * /reserva/gracias?f=<formación>&s=<pago de Stripe>: adonde manda Stripe
 * después de pagar. Da las gracias, confirma el pago de la reserva (los datos
 * ya se dejaron en /reserva, antes de pagar) y lleva al grupo de la Comunidad
 * Divine. No se indexa.
 */

export const metadata: Metadata = {
  title: 'Reserva hecha · Técnica Divine',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: '#17140f' };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Gracias({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const q = await searchParams;
  const formacion = FORMACIONES_PAGO.find((x) => x.id === uno(q.f));
  const membresia = formacion?.id === 'membresia';

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
          {formacion && <p style={{ margin: '16px auto 0', maxWidth: 420, fontSize: 17, fontWeight: 600, opacity: 0.92 }}>{formacion.nombre}</p>}
        </div>
      </header>

      <GraciasComunidad sesion={uno(q.s).slice(0, 220)} whatsapp={WHATSAPP_SORELA} />

      <footer className={css.pie}>
        <p>Nos vemos muy pronto. Sorela Caro · Técnica Divine</p>
      </footer>
    </main>
  );
}
