import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { INSTAGRAM, INSTAGRAM_USUARIO } from '@/lib/contenido';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import { CORREO_PRIVACIDAD, ENCARGADOS, REVISADA, TRATAMIENTOS } from '@/lib/privacidad';

/**
 * Textos legales.
 *
 * Privacidad, cookies y aviso legal están REDACTADOS a partir de lo que la
 * web hace de verdad —ver `lib/privacidad.ts`—, no copiados de una plantilla:
 * cada tratamiento es un formulario real y cada destinatario un servicio que
 * se usa. Las condiciones de contratación siguen pendientes, y a propósito:
 * dependen de precios, cancelaciones y devoluciones que solo puede fijar
 * Sorela, y unas condiciones inventadas obligan a cumplir lo que nadie decidió.
 *
 * LA IDENTIDAD DE SORELA —nombre, NIF y domicilio— NO ESTÁ EN ESTE ARCHIVO.
 * La ley obliga a publicarla en estas páginas, pero el repositorio es público
 * y no tiene por qué contenerla. Se lee de Firestore, de `ajustes/fiscales`,
 * que es donde ya están para las facturas, y se refresca cada hora.
 */

export const revalidate = 3600;

type Identidad = { nombre: string; nif: string; direccion: string };

async function identidad(): Promise<Identidad | null> {
  if (!hayFirebase()) return null;
  try {
    const d = await baseDeDatos().collection('ajustes').doc('fiscales').get();
    if (!d.exists) return null;
    return {
      nombre: String(d.get('nombre') ?? '').trim(),
      nif: String(d.get('nif') ?? '').trim(),
      direccion: String(d.get('direccion') ?? '').trim(),
    };
  } catch {
    return null;
  }
}

const TITULOS = {
  'aviso-legal': 'Aviso legal',
  privacidad: 'Política de privacidad',
  cookies: 'Política de cookies',
  condiciones: 'Condiciones de contratación',
} as const;

type Doc = keyof typeof TITULOS;

export function generateStaticParams() {
  return Object.keys(TITULOS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const t = TITULOS[doc as Doc];
  if (!t) return { title: 'Documento no encontrado' };
  return { title: t, robots: { index: false, follow: true } };
}

/* ---------- Piezas de maquetación ---------- */

function Apartado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="titulo-md" style={{ margin: 0 }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

const parrafo = { margin: 0, fontWeight: 300, fontSize: '16.5px', lineHeight: 1.65, color: 'var(--ink-3)' } as const;

function P({ children }: { children: ReactNode }) {
  return <p style={parrafo}>{children}</p>;
}

function Lista({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((n, i) => (
        <li key={i} style={{ ...parrafo, display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <span style={{ flex: '0 0 auto', color: 'var(--arcilla)' }}>—</span>
          <span style={{ textWrap: 'pretty' }}>{n}</span>
        </li>
      ))}
    </ul>
  );
}

function Titular({ id }: { id: Identidad | null }) {
  return (
    <Lista
      items={[
        <>
          <strong style={{ fontWeight: 500 }}>Titular:</strong> {id?.nombre || 'Sorela Caro'}
        </>,
        ...(id?.nif ? [<><strong style={{ fontWeight: 500 }}>NIF:</strong> {id.nif}</>] : []),
        ...(id?.direccion ? [<><strong style={{ fontWeight: 500 }}>Domicilio:</strong> {id.direccion}</>] : []),
        <>
          <strong style={{ fontWeight: 500 }}>Correo:</strong>{' '}
          <a className="enlace-fino" href={`mailto:${CORREO_PRIVACIDAD}`}>
            {CORREO_PRIVACIDAD}
          </a>
        </>,
      ]}
    />
  );
}

/* ---------- Los documentos ---------- */

function Privacidad({ id }: { id: Identidad | null }) {
  return (
    <>
      <P>
        Aquí se explica qué datos personales se recogen en esta web y en su plataforma, para qué,
        con qué base legal, durante cuánto tiempo, a quién se comunican y cómo puedes ejercer tus
        derechos, conforme al Reglamento General de Protección de Datos (RGPD) y a la Ley Orgánica
        3/2018 de Protección de Datos y garantía de los derechos digitales.
      </P>

      <Apartado titulo="Quién es la responsable">
        <Titular id={id} />
      </Apartado>

      <Apartado titulo="Qué datos se tratan y para qué">
        {TRATAMIENTOS.map((t) => (
          <div
            key={t.donde}
            style={{ padding: '18px 20px', borderRadius: 16, border: '1px solid var(--line-2)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{t.donde}</h3>
            <Lista
              items={[
                <><strong style={{ fontWeight: 500 }}>Datos:</strong> {t.datos}</>,
                <><strong style={{ fontWeight: 500 }}>Finalidad:</strong> {t.finalidad}</>,
                <><strong style={{ fontWeight: 500 }}>Base legal:</strong> {t.base}</>,
                <><strong style={{ fontWeight: 500 }}>Conservación:</strong> {t.conservacion}</>,
              ]}
            />
          </div>
        ))}
        <P>
          No se toman decisiones automatizadas ni se elaboran perfiles con tus datos. Las formaciones
          y la plataforma están dirigidas a personas mayores de edad.
        </P>
      </Apartado>

      <Apartado titulo="A quién se comunican">
        <P>
          Tus datos no se venden ni se ceden a terceros, salvo obligación legal. Para que la web
          funcione, estos proveedores los tratan por encargo de Sorela Caro y siguiendo sus
          instrucciones:
        </P>
        <Lista items={ENCARGADOS.map((e) => <><strong style={{ fontWeight: 500 }}>{e.quien}:</strong> {e.para}</>)} />
        <P>
          Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo, en
          Estados Unidos. Lo hacen con las garantías que exige el RGPD: el Marco de Privacidad de
          Datos UE-EE. UU. o las cláusulas contractuales tipo aprobadas por la Comisión Europea.
        </P>
      </Apartado>

      <Apartado titulo="Tus derechos">
        <P>
          Puedes pedir en cualquier momento acceder a tus datos, rectificarlos, suprimirlos,
          oponerte a su tratamiento, limitarlo, recibirlos en un formato portable y retirar tu
          consentimiento, sin que eso afecte a lo hecho antes de retirarlo. Basta con escribir a{' '}
          <a className="enlace-fino" href={`mailto:${CORREO_PRIVACIDAD}`}>
            {CORREO_PRIVACIDAD}
          </a>{' '}
          indicando qué derecho quieres ejercer. Se te responde en el plazo de un mes.
        </P>
        <P>
          Si crees que no se han tratado bien tus datos, puedes reclamar ante la Agencia Española de
          Protección de Datos en{' '}
          <a className="enlace-fino" href="https://www.aepd.es" target="_blank" rel="noopener">
            www.aepd.es
          </a>
          .
        </P>
      </Apartado>

      <Apartado titulo="Seguridad">
        <P>
          Los datos se guardan en una base de datos cerrada a la que solo accede el servidor de la
          web, y solo Sorela Caro puede consultarlos desde su plataforma, con su cuenta. Las
          comunicaciones con la web van cifradas.
        </P>
      </Apartado>
    </>
  );
}

function Cookies() {
  return (
    <>
      <P>
        Esta web no usa cookies de análisis, de publicidad ni de seguimiento, y no comparte tu
        navegación con nadie. Por eso no te pide aceptar cookies al entrar: solo usa lo
        imprescindible para funcionar, que la ley exime de consentimiento.
      </P>
      <Apartado titulo="Lo que se guarda en tu navegador">
        <Lista
          items={[
            <>
              <strong style={{ fontWeight: 500 }}>divine_sesion</strong> (cookie propia): mantiene
              abierta tu sesión en la plataforma cuando entras con tu cuenta. Solo existe si entras, y
              se borra al salir o al caducar la sesión.
            </>,
            <>
              <strong style={{ fontWeight: 500 }}>divine-tema</strong> (almacenamiento local): recuerda
              si prefieres la web en modo claro u oscuro. No sale de tu navegador.
            </>,
          ]}
        />
      </Apartado>
      <Apartado titulo="Vídeos">
        <P>
          Los vídeos del aula se ven a través de YouTube en su modo de privacidad mejorada, que no
          guarda cookies hasta que reproduces el vídeo. Los demás vídeos de la web se sirven desde
          la propia web, sin terceros.
        </P>
      </Apartado>
      <Apartado titulo="Cómo borrarlas">
        <P>
          Puedes borrar las cookies y el almacenamiento local desde los ajustes de tu navegador
          cuando quieras. Si en el futuro se añade analítica o publicidad, esta página se
          actualizará y se te pedirá permiso antes.
        </P>
      </Apartado>
    </>
  );
}

function AvisoLegal({ id }: { id: Identidad | null }) {
  return (
    <>
      <P>
        En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la Información y de
        Comercio Electrónico, estos son los datos de quien está detrás de esta web.
      </P>
      <Apartado titulo="Titular">
        <Titular id={id} />
      </Apartado>
      <Apartado titulo="Propiedad intelectual">
        <P>
          La Técnica Divine®, su método, los textos, las fotografías, los vídeos y el material
          formativo de esta web y de su plataforma son de Sorela Caro o se usan con permiso. No
          pueden reproducirse, distribuirse ni transformarse sin su autorización escrita.
        </P>
      </Apartado>
      <Apartado titulo="Uso de la web">
        <P>
          La información de esta web sobre la Técnica Divine es de carácter estético y formativo y
          no sustituye la valoración, el diagnóstico ni el tratamiento médico. Los resultados que se
          muestran son reales y dependen de cada persona.
        </P>
      </Apartado>
      <Apartado titulo="Ley aplicable">
        <P>Estas condiciones se rigen por la legislación española.</P>
      </Apartado>
    </>
  );
}

function Pendiente() {
  return (
    <>
      <P>
        Este texto está pendiente de redacción. Depende de precios, reservas, cancelaciones y
        devoluciones que tiene que fijar Sorela, y no se publica una versión inventada: unas
        condiciones de relleno obligan a cumplir lo que nadie decidió.
      </P>
      <P>
        Mientras tanto, para cualquier cuestión sobre una reserva:{' '}
        <Link href="/contacto" className="enlace-fino">
          el formulario de contacto
        </Link>{' '}
        o{' '}
        <a href={INSTAGRAM} className="enlace-fino" target="_blank" rel="noopener">
          {INSTAGRAM_USUARIO}
        </a>
        .
      </P>
    </>
  );
}

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const titulo = TITULOS[doc as Doc];
  if (!titulo) notFound();

  const id = doc === 'privacidad' || doc === 'aviso-legal' ? await identidad() : null;

  return (
    <main className="pagina">
      <section className="seccion-sm">
        <div className="wrap wrap-820" style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="antetitulo">Legal</p>
            <h1 className="titulo-lg">{titulo}</h1>
            {doc !== 'condiciones' && (
              <p style={{ ...parrafo, fontSize: 13.5, color: 'var(--muted)' }}>Última revisión: {REVISADA}.</p>
            )}
          </div>

          {doc === 'privacidad' && <Privacidad id={id} />}
          {doc === 'cookies' && <Cookies />}
          {doc === 'aviso-legal' && <AvisoLegal id={id} />}
          {doc === 'condiciones' && <Pendiente />}
        </div>
      </section>
    </main>
  );
}
