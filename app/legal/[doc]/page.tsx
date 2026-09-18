import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INSTAGRAM, INSTAGRAM_USUARIO } from '@/lib/contenido';

/**
 * Textos legales.
 *
 * NO se redactan aquí de oficio: un aviso legal, una política de privacidad o
 * unas condiciones de contratación inventadas son peores que no tenerlas,
 * porque dan apariencia de cumplimiento sin cumplir nada. Estas páginas
 * existen para que los enlaces del pie no se rompan y para dejar por escrito
 * qué hay que redactar en cada una. Sustituir `cuerpo` por el texto real que
 * facilite Sorela o su asesoría.
 */
const DOCS = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    necesita: [
      'Identidad del titular: nombre o razón social, NIF, domicilio y correo de contacto.',
      'Datos de inscripción registral, si procede.',
      'Condiciones de uso del sitio y propiedad intelectual de los contenidos y las fotografías.',
      'Ley aplicable y fuero.',
    ],
  },
  privacidad: {
    titulo: 'Política de privacidad',
    necesita: [
      'Responsable del tratamiento y datos de contacto.',
      'Qué datos se recogen en cada formulario (contacto, lista de espera, reserva de cita) y con qué finalidad y base legítima.',
      'Plazo de conservación y destinatarios o encargados (alojamiento, herramienta de correo, pasarela de pago).',
      'Cómo ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad.',
      'Derecho a reclamar ante la Agencia Española de Protección de Datos.',
    ],
  },
  cookies: {
    titulo: 'Política de cookies',
    necesita: [
      'Relación de cookies propias y de terceros que se instalen realmente, con finalidad y duración.',
      'Cómo aceptarlas, rechazarlas o revocar el consentimiento.',
      'Si se añade analítica o píxeles de publicidad, hará falta además un banner de consentimiento previo.',
    ],
  },
  condiciones: {
    titulo: 'Condiciones de contratación',
    necesita: [
      'Proceso de reserva de plaza y pago del resto del importe.',
      'Precio, impuestos aplicables y formas de pago admitidas.',
      'Política de cancelación y devolución de la reserva, por formación.',
      'Derecho de desistimiento y sus excepciones en servicios con fecha determinada.',
      'Atención de reclamaciones y resolución de conflictos.',
    ],
  },
} as const;

type Doc = keyof typeof DOCS;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const d = DOCS[doc as Doc];
  if (!d) return { title: 'Documento no encontrado' };
  return { title: d.titulo, robots: { index: false, follow: true } };
}

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc as Doc];
  if (!d) notFound();

  return (
    <main className="pagina">
      <section className="seccion-sm">
        <div className="wrap wrap-820" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <p className="antetitulo">Legal</p>
          <h1 className="titulo-lg">{d.titulo}</h1>

          <p className="texto">
            Este texto está pendiente de redacción. No se publica una versión de relleno a
            propósito: un documento legal aproximado da apariencia de cumplimiento sin cumplir
            nada, y en materia de protección de datos eso tiene consecuencias.
          </p>

          <div>
            <p className="antetitulo" style={{ marginBottom: 16 }}>
              Qué tiene que recoger
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {d.necesita.map((n) => (
                <li
                  key={n}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'baseline',
                    fontWeight: 300,
                    fontSize: '16.5px',
                    lineHeight: 1.55,
                    color: 'var(--ink-3)',
                  }}
                >
                  <span style={{ flex: '0 0 auto', color: 'var(--arcilla)' }}>—</span>
                  <span style={{ textWrap: 'pretty' }}>{n}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="texto-fijo">
            Mientras tanto, para cualquier cuestión sobre tus datos o sobre una reserva:{' '}
            <Link href="/contacto" className="enlace-fino">
              el formulario de contacto
            </Link>{' '}
            o{' '}
            <a href={INSTAGRAM} className="enlace-fino" target="_blank" rel="noopener">
              {INSTAGRAM_USUARIO}
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
