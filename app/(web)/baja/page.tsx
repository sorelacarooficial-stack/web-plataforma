import type { Metadata } from 'next';
import BotonBaja from '@/components/BotonBaja';

/**
 * Darse de baja de los correos de aviso (los recordatorios de la apertura).
 *
 * La baja se confirma con un botón y no al abrir el enlace: los antivirus de
 * los correos de empresa abren todos los enlaces que llegan para revisarlos, y
 * con baja al abrir se daría de baja gente que no ha pulsado nada.
 */
export const metadata: Metadata = {
  title: 'Darte de baja',
  robots: { index: false, follow: false },
};

export default async function Baja({ searchParams }: { searchParams: Promise<{ c?: string; f?: string }> }) {
  const { c = '', f = '' } = await searchParams;
  let correo = '';
  try {
    correo = Buffer.from(c, 'base64url').toString('utf8');
  } catch {
    correo = '';
  }
  return (
    <main className="pagina">
      <section style={{ padding: 'clamp(90px,12vw,160px) 0' }}>
        <div className="wrap columna" style={{ gap: 22, maxWidth: 560 }}>
          <h1 className="titulo-xl" style={{ fontSize: 'clamp(38px,5.4vw,72px)' }}>
            Darte de baja
          </h1>
          {correo.includes('@') && f ? (
            <BotonBaja c={c} f={f} correo={correo} />
          ) : (
            <p className="lede">
              Este enlace no está completo. Respóndeme al correo que te llegó y te doy de baja yo.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
