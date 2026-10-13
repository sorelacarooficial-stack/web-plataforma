import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import {
  ALMACENAMIENTO,
  CORREO_PRIVACIDAD,
  ENCARGADOS,
  INSERTADOS,
  REVISADA,
  TERCEROS,
  TRATAMIENTOS,
} from '@/lib/privacidad';
import css from './legal.module.css';

/**
 * Textos legales.
 *
 * Privacidad, cookies y aviso legal están REDACTADOS a partir de lo que la
 * web hace de verdad —ver `lib/privacidad.ts`—, no copiados de una plantilla:
 * cada tratamiento es un formulario o una pantalla real, cada destinatario un
 * servicio que se usa y cada línea de la tabla de cookies algo que se ha visto
 * guardado en un navegador. Las condiciones de contratación no están, y a
 * propósito: dependen de precios, cancelaciones y devoluciones que solo puede
 * fijar Sorela, unas condiciones inventadas obligan a cumplir lo que nadie
 * decidió, y una página pública de «pendiente de redacción» no se deja a la
 * vista.
 *
 * LA IDENTIDAD DE SORELA —nombre, NIF y domicilio— NO ESTÁ EN ESTE ARCHIVO.
 * La ley obliga a publicarla en estas páginas (art. 10 LSSI, art. 13 RGPD),
 * pero el repositorio es público y no tiene por qué contenerla. Se lee de
 * Firestore, de `ajustes/fiscales`, que es donde ya están para las facturas,
 * y se refresca cada hora.
 *
 * EMBARGO hasta la apertura: estas páginas son públicas. Lo de dentro de la
 * plataforma se cuenta de forma neutra, sin decir qué incluye la Comunidad.
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
  /* Aquí estaban las «Condiciones de contratación», con un aviso de «texto
     pendiente de redacción». Se retiran: una página pública que dice que algo
     no está redactado da peor imagen que no tenerla. Vuelven cuando Sorela
     fije precios, reservas, cancelaciones y devoluciones. */
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

function Apartado({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className={css.apartado}>
      <h2 className="titulo-md">{titulo}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className={css.p}>{children}</p>;
}

function Lista({ items }: { items: ReactNode[] }) {
  return (
    <ul className={`${css.lista} ${css.p}`}>
      {items.map((n, i) => (
        <li key={i}>
          <span>{n}</span>
        </li>
      ))}
    </ul>
  );
}

/* Los enlaces DENTRO de un párrafo llevan su propia clase: `.enlace-fino`
   es un bloque de 44 px de alto pensado para enlaces sueltos, y metido en
   una frase la partía en dos y cruzaba la raya con la línea de abajo. */
const Correo = () => (
  <a className={css.enlaceTexto} href={`mailto:${CORREO_PRIVACIDAD}`}>
    {CORREO_PRIVACIDAD}
  </a>
);

/** Lo que se abre en otra pestaña lo dice, para no desorientar. */
const OtraPestana = () => <span className="sr-only"> (se abre en otra pestaña)</span>;

/** Iconos de línea fina para las teselas de «de un vistazo». */
const ICONOS = {
  persona: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  globo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5Z" />
    </>
  ),
  sobre: (
    <>
      <rect x="3.5" y="6" width="17" height="12.5" rx="2.5" />
      <path d="m4.5 7.5 7.5 6 7.5-6" />
    </>
  ),
  galleta: (
    <>
      <path d="M20 12.5A8 8 0 1 1 11.5 4a3 3 0 0 0 3.5 3.5 3 3 0 0 0 3.5 3.5c.5.5 1 1 1.5 1.5Z" />
      <circle cx="9" cy="10" r=".9" fill="currentColor" />
      <circle cx="14" cy="15" r=".9" fill="currentColor" />
      <circle cx="9.5" cy="15.5" r=".9" fill="currentColor" />
    </>
  ),
  grafica: (
    <>
      <path d="M4.5 19.5h15" />
      <path d="M7.5 16v-4M12 16V8M16.5 16v-6" />
    </>
  ),
  play: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="3" />
      <path d="M10.5 9.5v5l4-2.5z" fill="currentColor" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
} as const;

/* Sin cifras sueltas: un «0» o un «1» en Cormorant no se entendía sin leer
   el título y desalineaba la fila. Todas iguales: icono, título y texto. */
function Tesela({ icono, titulo, texto }: { icono: keyof typeof ICONOS; titulo: string; texto: string }) {
  return (
    <li className={css.tesela}>
      <span className={css.icono} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {ICONOS[icono]}
        </svg>
      </span>
      <p className={css.teselaTitulo}>{titulo}</p>
      <p className={css.teselaTexto}>{texto}</p>
    </li>
  );
}

/** Las teselas de «de un vistazo»: una lista con nombre, que sí se anuncia. */
function Vistazo({ children }: { children: ReactNode }) {
  return (
    <ul className={css.vistazo} aria-label="De un vistazo">
      {children}
    </ul>
  );
}

function Indice({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="En esta página">
      <ul className={css.indice}>
        {items.map(([id, t]) => (
          <li key={id}>
            <a href={`#${id}`}>{t}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Titular({ id }: { id: Identidad | null }) {
  return (
    <Lista
      items={[
        <>
          <strong>Titular:</strong> {id?.nombre || 'Sorela Caro'}, profesional autónoma.
        </>,
        ...(id?.nif ? [<><strong>NIF:</strong> {id.nif}</>] : []),
        ...(id?.direccion ? [<><strong>Domicilio:</strong> {id.direccion}</>] : []),
        <>
          <strong>Correo:</strong> <Correo />
        </>,
      ]}
    />
  );
}

/** Una base legal resumida en dos palabras, para la cabecera de cada tarjeta. */
function baseCorta(base: string, resumen?: string) {
  if (resumen) return resumen;
  if (/^Tu consentimiento|^El consentimiento/.test(base)) return 'Consentimiento';
  if (/fiscales|obligaciones/i.test(base) && !/contrato/i.test(base)) return 'Obligación legal';
  if (/^El interés legítimo/.test(base)) return 'Interés legítimo';
  return 'Contrato';
}

const Flecha = () => (
  <svg className={css.flecha} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* ---------- Los documentos ---------- */

function Privacidad({ id }: { id: Identidad | null }) {
  const ajenos = TRATAMIENTOS.filter((t) => t.origen);
  return (
    <>
      <P>
        Aquí te cuento qué datos personales se recogen en esta web y en su plataforma, para qué,
        con qué base legal, durante cuánto tiempo, quién más los trata y cómo ejercer tus derechos,
        conforme al Reglamento General de Protección de Datos (RGPD), la Ley Orgánica 3/2018 de
        Protección de Datos y garantía de los derechos digitales (LOPDGDD) y la Ley 34/2002 de
        servicios de la sociedad de la información (LSSI).
      </P>

      <Vistazo>
        <Tesela icono="persona" titulo="Responsable" texto="Sorela Caro, creadora de la Técnica Divine." />
        <Tesela icono="candado" titulo="No se venden" texto="Tus datos no se venden ni se ceden para publicidad." />
        <Tesela icono="galleta" titulo="Sin seguimiento" texto="Ni cookies de análisis, ni de terceros, ni de publicidad." />
        <Tesela icono="sobre" titulo="Un solo correo" texto="Para todos tus derechos, y gratis." />
      </Vistazo>

      <Indice
        items={[
          ['responsable', 'Responsable'],
          ['tratamientos', 'Qué datos y para qué'],
          ['origen', 'Datos que no me das tú'],
          ['menores', 'Menores y salud'],
          ['destinatarios', 'Quién más los trata'],
          ['transferencias', 'Fuera de la UE'],
          ['derechos', 'Tus derechos'],
          ['seguridad', 'Seguridad'],
          ['cambios', 'Cambios'],
        ]}
      />

      <Apartado id="responsable" titulo="Quién es la responsable">
        <Titular id={id} />
        <P>
          No hay delegado de protección de datos: por el tipo y el volumen de lo que se trata no es
          obligatorio. Para cualquier cosa sobre tus datos, escribe a <Correo />.
        </P>
      </Apartado>

      <Apartado id="tratamientos" titulo="Qué datos se tratan y para qué">
        <P>
          Cada bloque es un formulario o una parte de la web. Ábrelo para ver los datos, la
          finalidad, la base legal, cuánto se guardan y, si es el caso, quién más los ve.
        </P>
        <div className={css.tarjetas}>
          {TRATAMIENTOS.map((t, i) => (
            <details key={t.donde} className={css.tarjeta} open={i === 0}>
              <summary>
                <span className={css.numero} aria-hidden="true">
                  {i + 1}
                </span>
                {/* Un h3 dentro del summary (es válido): así quien navega por
                    títulos con el lector de pantalla encuentra cada bloque. */}
                <h3 className={css.tarjetaTitulo}>{t.donde}</h3>
                <span className={css.resumenBase}>{baseCorta(t.base, t.baseResumen)}</span>
                <Flecha />
              </summary>
              <dl className={css.dl}>
                {(
                  [
                    ['Datos', t.datos],
                    ['Para qué', t.finalidad],
                    ['Base legal', t.base],
                    ['Cuánto tiempo', t.conservacion],
                    ['De dónde salen', t.origen],
                    ['Quién los ve', t.quienVe],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className={css.fila}>
                      <dt className={css.dt}>{k}</dt>
                      <dd className={css.dd}>{v}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          ))}
        </div>
        <P>
          Cuando la base es tu consentimiento, darlo es voluntario. La casilla obligatoria de cada
          formulario es solo para lo que pides en él; las novedades por correo van siempre en una
          casilla aparte, sin marcar, y sin ellas todo funciona igual. Cuando la base es el contrato, los datos marcados como obligatorios hacen falta
          para darte el servicio. No se toman decisiones automatizadas con efectos sobre ti: la
          inteligencia artificial solo ayuda a Sorela a ordenar y redactar, y quien decide es ella.
        </P>
      </Apartado>

      <Apartado id="origen" titulo="Datos que no me das tú directamente">
        <P>
          En algunos casos tus datos no llegan de un formulario que rellenas tú (art. 14 RGPD). Estas
          son las fuentes, y en todos los casos tienes los mismos derechos:
        </P>
        <Lista
          items={ajenos.map((t) => (
            <>
              <strong>{t.donde}:</strong> {t.origen}
            </>
          ))}
        />
      </Apartado>

      <Apartado id="menores" titulo="Menores y datos de salud">
        <P>
          Los formularios de la web son para personas de 14 años o más, la edad a partir de la cual
          la ley española permite dar el consentimiento propio (art. 7 LOPDGDD). Si tienes menos, no
          envíes tus datos: tiene que hacerlo tu madre, tu padre o quien tenga tu tutela. La
          plataforma, el acuerdo de confidencialidad y las formaciones son solo para mayores de
          edad.
        </P>
        <P>
          No necesito datos de salud para nada de lo que hago aquí. Por favor, no los incluyas en los
          mensajes, en la agenda ni en las publicaciones.
        </P>
      </Apartado>

      <Apartado id="destinatarios" titulo="Quién más trata tus datos">
        <P>
          Tus datos no se venden ni se ceden para publicidad. Solo se comunican a las
          administraciones, jueces y tribunales cuando la ley obliga, y en dos casos que decides tú:
          si publicas tu ficha en «Localiza tu terapeuta», lo que pones en ella se ve en la web; y si
          entras en el grupo de WhatsApp, tu número lo ven las demás participantes.
        </P>
        <P>
          Para que la web funcione, estos proveedores los tratan <strong>por encargo</strong> de Sorela
          Caro, con un contrato que les obliga a usarlos solo para eso y a protegerlos (art. 28
          RGPD):
        </P>
        <table className={css.tabla}>
          <thead>
            <tr>
              <th scope="col">Proveedor</th>
              <th scope="col">Para qué</th>
              <th scope="col">Dónde</th>
            </tr>
          </thead>
          <tbody>
            {ENCARGADOS.map((e) => (
              <tr key={e.quien}>
                <td>{e.quien}</td>
                <td data-col="Para qué">{e.para}</td>
                <td data-col="Dónde">
                  <span className={`${css.pastilla} ${/^España/.test(e.donde) ? css.pastillaOro : ''}`}>
                    {e.donde.replace(/, entre otros.*$/, '').replace(/\.$/, '')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <P>
          La web y sus correos <strong>insertan</strong> además contenido de Google. Como lo decide
          Sorela, de la conexión responden los dos:
        </P>
        <Lista
          items={INSERTADOS.map((t) => (
            <>
              <strong>{t.quien}:</strong> {t.cuando}
            </>
          ))}
        />
        <P>
          Y estos servicios, que <strong>usas tú directamente</strong> desde la web, tratan tus datos
          como responsables propios, según sus condiciones:
        </P>
        <Lista
          items={TERCEROS.map((t) => (
            <>
              <strong>{t.quien}:</strong> {t.cuando}
            </>
          ))}
        />
      </Apartado>

      <Apartado id="transferencias" titulo="Datos fuera de la Unión Europea">
        <P>
          Algunos proveedores tratan datos fuera del Espacio Económico Europeo. Esta es la garantía
          que el RGPD exige en cada caso (arts. 44 a 49). Para Estados Unidos se usan dos a la vez: el
          Marco de Privacidad de Datos UE‑EE. UU. sigue en vigor, pero está recurrido ante el
          Tribunal de Justicia de la UE; si cayera, siguen valiendo las cláusulas contractuales tipo.
        </P>
        <table className={css.tabla}>
          <thead>
            <tr>
              <th scope="col">Proveedor</th>
              <th scope="col">País</th>
              <th scope="col">Garantía</th>
            </tr>
          </thead>
          <tbody>
            {ENCARGADOS.filter((e) => !/^España/.test(e.donde)).map((e) => (
              <tr key={e.quien}>
                <td>{e.quien}</td>
                <td data-col="País">{e.donde}</td>
                <td data-col="Garantía">{e.garantia}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <P>
          Puedes pedir una copia de estas garantías escribiendo a <Correo />.
        </P>
      </Apartado>

      <Apartado id="derechos" titulo="Tus derechos">
        <ul className={css.derechos}>
          {[
            ['Acceso', 'Saber qué datos tuyos hay.'],
            ['Rectificación', 'Corregir lo que esté mal.'],
            ['Supresión', 'Que se borren.'],
            ['Oposición', 'Que dejen de usarse.'],
            ['Limitación', 'Que se congelen mientras se revisa.'],
            ['Portabilidad', 'Recibirlos en un archivo.'],
            ['Retirar el permiso', 'Sin afectar a lo hecho antes.'],
            ['Sin decisiones automáticas', 'Que decida una persona.'],
          ].map(([t, d]) => (
            <li key={t}>
              <b>{t}</b>
              {d}
            </li>
          ))}
        </ul>
        <P>
          Para ejercer cualquiera, escribe a <Correo /> diciendo cuál. Es gratis y te contesto en un mes
          como máximo (ampliable dos meses más si la petición es compleja, y te lo diría). Solo te
          pediré que acredites quién eres si hay dudas razonables. Para dejar de recibir correos, basta
          con el enlace de baja que lleva cada uno o con responder al propio correo pidiéndolo.
        </P>
        <P>
          Si crees que no se han tratado bien tus datos, puedes reclamar ante la Agencia Española de
          Protección de Datos (C/ Jorge Juan 6, 28001 Madrid), en su sede electrónica{' '}
          <a className={css.enlaceTexto} href="https://sedeagpd.gob.es" target="_blank" rel="noopener">
            sedeagpd.gob.es
            <OtraPestana />
          </a>{' '}
          o en{' '}
          <a className={css.enlaceTexto} href="https://www.aepd.es" target="_blank" rel="noopener">
            www.aepd.es
            <OtraPestana />
          </a>
          .
        </P>
      </Apartado>

      <Apartado id="seguridad" titulo="Seguridad">
        <P>
          Los datos se guardan en una base de datos cerrada a la que solo accede el servidor de la
          web. Sorela Caro los consulta desde su panel, con su cuenta. Lo que forma parte de tu perfil
          y tu actividad en la plataforma lo ven además las demás usuarias con acceso, y tu ficha, si
          la publicas, cualquiera. Las comunicaciones con la web van cifradas, los documentos privados
          se abren con enlaces que caducan y, si hubiera una brecha de seguridad que te afecte, se
          comunicaría a la Agencia en 72 horas y a ti cuando la ley lo exige.
        </P>
      </Apartado>

      <Apartado id="cambios" titulo="Cambios en esta política">
        <P>
          Si cambia algo de lo que se hace con tus datos, esta página se actualiza y cambia la fecha
          de revisión de arriba. Si el cambio afecta a algo para lo que diste tu permiso, se te
          volverá a pedir antes de aplicarlo.
        </P>
      </Apartado>
    </>
  );
}

function Cookies() {
  return (
    <>
      <div className={css.destacado}>
        <span className={css.icono} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {ICONOS.escudo}
          </svg>
        </span>
        <div>
          <p className={css.destacadoTitulo}>Sin aviso de cookies, y no por descuido</p>
          <P>
            Esta web solo guarda en tu navegador lo imprescindible para funcionar o lo que tú eliges,
            que la ley exime de consentimiento (art. 22.2 LSSI). No hay cookies de análisis, de
            publicidad ni de seguimiento, y nada de terceros se carga sin que lo pidas. Por eso no
            te sale un aviso para aceptar o rechazar: no habría nada que aceptar.
          </P>
        </div>
      </div>

      <Vistazo>
        <Tesela icono="galleta" titulo="Una sola cookie" texto="La de tu sesión, solo si entras con tu cuenta." />
        <Tesela icono="grafica" titulo="Sin analítica" texto="Las visitas se cuentan en el servidor, sin guardar nada en tu navegador." />
        <Tesela icono="play" titulo="YouTube, al pulsar" texto="Hasta que le das al play, nada de Google." />
        <Tesela icono="globo" titulo="Sin publicidad" texto="Ni anuncios ni redes sociales incrustadas." />
      </Vistazo>

      <Apartado id="tabla" titulo="Lo que se guarda en tu navegador">
        <P>
          Para la ley cuenta igual una cookie que cualquier otra cosa guardada en tu dispositivo
          (almacenamiento local, de sesión o IndexedDB), así que aquí está todo:
        </P>
        <table className={css.tabla}>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Tipo y titular</th>
              <th scope="col">Para qué</th>
              <th scope="col">Duración</th>
              <th scope="col">Cuándo</th>
            </tr>
          </thead>
          <tbody>
            {ALMACENAMIENTO.map((a) => (
              <tr key={a.nombre}>
                <td>
                  <span className={a.nombre.startsWith('Datos') ? undefined : css.mono}>{a.nombre}</span>
                </td>
                <td data-col="Tipo y titular">
                  {a.tipo} · {a.titular}
                </td>
                <td data-col="Para qué">{a.finalidad}</td>
                <td data-col="Duración">{a.duracion}</td>
                <td data-col="Cuándo">{a.cuando}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Apartado>

      <Apartado id="estadisticas" titulo="Las estadísticas de visitas">
        <P>
          Para saber cuántas personas entran y qué páginas interesan, la web avisa a su propio
          servidor de cada página vista. No se guarda nada en tu navegador, no hay identificador que
          te siga de un día a otro ni de una web a otra, y no se comparte con nadie. El detalle está en
          la{' '}
          <a className={css.enlaceTexto} href="/legal/privacidad#tratamientos">
            política de privacidad
          </a>
          .
        </P>
      </Apartado>

      <Apartado id="videos" titulo="Vídeos">
        <P>
          Los vídeos de YouTube del blog y del aula aparecen primero como una portada propia. Solo
          cuando le das al play se carga el reproductor de YouTube (en su modo de privacidad
          mejorada), que se conecta con Google y puede guardar datos en tu navegador según la
          política de Google. Darle al play es tu elección para ese vídeo y solo para ese: los demás
          vídeos de YouTube siguen con su portada hasta que los pulses. Los vídeos que no son de
          YouTube se sirven desde la propia web, sin terceros.
        </P>
      </Apartado>

      <Apartado id="configurar" titulo="Cómo configurarlas o borrarlas">
        <P>
          Como no hay nada opcional que activar, no hay panel de configuración: cada cosa se activa
          solo cuando haces lo que la necesita (entrar, cambiar el modo, darle al play). Puedes
          borrarlo todo cuando quieras desde los ajustes de tu navegador; la sesión se cierra con
          «Salir». Si borras los datos de YouTube, volverá a pedirlos la próxima vez que reproduzcas
          un vídeo.
        </P>
        <div className={css.navegadores}>
          {[
            ['Chrome', 'https://support.google.com/chrome/answer/95647?hl=es'],
            ['Safari', 'https://support.apple.com/es-es/guide/safari/sfri11471/mac'],
            ['Firefox', 'https://support.mozilla.org/es/kb/Borrar%20cookies'],
            ['Edge', 'https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09'],
          ].map(([n, u]) => (
            <a key={n} className={css.pastilla} href={u} target="_blank" rel="noopener">
              {n} →
              <OtraPestana />
            </a>
          ))}
        </div>
        <P>
          Si algún día la web añade analítica de terceros, publicidad o contenido que guarde datos al
          cargarse, antes de hacerlo aparecerá un aviso con «Aceptar», «Rechazar» y «Configurar» al
          mismo nivel, y esta página se actualizará.
        </P>
      </Apartado>
    </>
  );
}

function AvisoLegal({ id }: { id: Identidad | null }) {
  return (
    <>
      <P>
        En cumplimiento del art. 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información y
        de Comercio Electrónico, estos son los datos de quien está detrás de esta web.
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
      <Apartado titulo="Datos personales y cookies">
        <P>
          Lo que se hace con tus datos está en la{' '}
          <a className={css.enlaceTexto} href="/legal/privacidad">
            política de privacidad
          </a>{' '}
          y lo que se guarda en tu navegador, en la{' '}
          <a className={css.enlaceTexto} href="/legal/cookies">
            política de cookies
          </a>
          .
        </P>
      </Apartado>
      <Apartado titulo="Ley aplicable">
        <P>Estas condiciones se rigen por la legislación española.</P>
      </Apartado>
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
        <div className={`wrap wrap-820 ${css.doc}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="antetitulo">Legal</p>
            <h1 className="titulo-lg">{titulo}</h1>
            <p className={css.p} style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>
              Última revisión: {REVISADA}.
            </p>
          </div>

          {doc === 'privacidad' && <Privacidad id={id} />}
          {doc === 'cookies' && <Cookies />}
          {doc === 'aviso-legal' && <AvisoLegal id={id} />}
        </div>
      </section>
    </main>
  );
}
