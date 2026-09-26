'use client';

import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ACCESOS,
  AGENDA_SORELA,
  BLOQUES_AULA,
  CLASES_ANTERIORES,
  CLIENTAS,
  CONVOCATORIAS,
  CURSOS_AULA,
  DESCARGABLES,
  DIAS_SEMANA,
  ESTADO_CURSO,
  FACTURAS,
  FACTURAS_ADMIN,
  FILTROS_CRM,
  FILTROS_FACT,
  FILTROS_FEED,
  INGRESOS_ADMIN,
  INSCRITAS,
  KPIS_ADMIN,
  KPIS_CRM,
  KPIS_FACT,
  PAGOS_ALUMNA,
  POR_APROBAR,
  POR_CONFIRMAR,
  POSTS,
  PREPARACION,
  PENDIENTE_BETA,
  RANKING,
  RESERVAS_AGREGADAS,
  SEMANA,
  TRATAMIENTOS_ACTIVOS,
  TRATAMIENTOS_PERFIL,
  metaCurso,
  progresoCurso,
  type CursoAula,
  type Factura,
  type Rol,
  type Vista,
} from '@/lib/plataforma';
import lumbar from '@/fotos/trabajo-lumbar.webp';
import valoracion from '@/fotos/valoracion-abdomen.webp';
import negocio from '@/fotos/aula-negocio.webp';
import pierna from '@/fotos/formacion-pierna.webp';
import css from './plataforma.module.css';

const FOTOS: Record<string, StaticImageData> = {
  'trabajo-lumbar': lumbar,
  'valoracion-abdomen': valoracion,
  'aula-negocio': negocio,
  'formacion-pierna': pierna,
};

type Props = { rol: Rol; ir: (v: Vista) => void };

/* Lo que el panel necesita de un contacto de Firestore. La lista completa,
   con sus filtros y su exportación, vive en `Contactos.tsx`. */
type ContactoBreve = {
  id: string;
  nombre: string;
  correo: string;
  whatsapp: string;
  origen: string;
  estado: string;
  creado: string | null;
};

/* La comunidad necesita además las iniciales de quien escribe, para el avatar
   del compositor. Antes ponía «MI» a todo el mundo. */
type PropsFeed = Props & {
  iniciales?: string;
  /** Si tiene contratada la comunidad. Decide si escribe o solo lee. */
  conComunidad?: boolean;
};

/* ==========================================================================
   Piezas compartidas
   ========================================================================== */
export function Kpis({ datos }: { datos: { label: string; valor: string; nota: string }[] }) {
  return (
    <div className={css.rejillaKpis}>
      {datos.map((k) => (
        <div key={k.label} className={css.kpi}>
          <span className={css.kpiLabel}>{k.label}</span>
          <span className={css.kpiValor}>{k.valor}</span>
          <span className={css.kpiNota}>{k.nota}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Lo que se ve cuando una lista está vacía.
 *
 * La plataforma acaba de nacer: no hay clientas, ni facturas, ni citas, ni
 * publicaciones. Antes estas pantallas venían rellenas de nombres y cifras de
 * maqueta, y eso engaña: parece que hay un negocio en marcha dentro. Un hueco
 * que explica qué va a aparecer ahí es más honesto y más útil.
 */
function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <section className={css.punteada}>
      <p className={css.vacioTexto}>{children}</p>
    </section>
  );
}

function Chips({
  opciones,
  activo,
  onElegir,
}: {
  opciones: string[];
  activo: string;
  onElegir: (v: string) => void;
}) {
  return (
    <div className={css.chips}>
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onElegir(o)}
          aria-pressed={activo === o}
          className={`${css.chip} ${activo === o ? css.chipActivo : ''}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Barra({ pct, gruesa }: { pct: number; gruesa?: boolean }) {
  return (
    <span className={`${css.barra} ${gruesa ? css.barraGruesa : ''}`}>
      <span className={css.barraRelleno} style={{ width: `${pct}%` }} />
    </span>
  );
}

const CLASE_ESTADO: Record<string, string> = {
  Cobrada: css.estadoOro,
  Pendiente: css.estadoNeutro,
  Vencida: css.estadoTinta,
  'En plan': css.estadoOro,
  Nueva: css.estadoTinta,
  Activa: css.estadoNeutro,
  Fría: css.estadoApagado,
  Nuevo: css.estadoTinta,
  Contactado: css.estadoOro,
  Reservado: css.estadoNeutro,
  Pagado: css.estadoOro,
};

function ListaFacturas({ facturas, vacio }: { facturas: Factura[]; vacio: string }) {
  if (facturas.length === 0) return <Vacio>{vacio}</Vacio>;
  return (
    <section className={css.tarjeta}>
      {facturas.map((f) => (
        <div key={f.num} className={css.factura}>
          <span className={css.facturaNum}>{f.num}</span>
          <span className={css.facturaCliente}>
            <span style={{ fontSize: 15, fontWeight: 300, color: 'var(--ink)' }}>{f.cliente}</span>
            <span style={{ fontSize: 12, fontWeight: 300, color: 'var(--faint)' }}>{f.concepto}</span>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>{f.fecha}</span>
          <span className={css.facturaImporte}>{f.importe}</span>
          <span className={`${css.estado} ${CLASE_ESTADO[f.estado]}`}>{f.estado}</span>
          <button type="button" className={css.enlaceAccion}>
            PDF
          </button>
        </div>
      ))}
    </section>
  );
}

/* ==========================================================================
   Inicio · alumna
   ========================================================================== */
export function InicioAlumna({ ir }: Props) {
  return (
    <>
      <div className={css.rejilla}>
        <section className={css.tarjeta} style={{ alignItems: 'flex-start', gap: 18 }}>
          <p className={css.rotulo}>Tu formación</p>
          <h2 className={css.h2}>Técnica Divine · Formación Base</h2>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 300, color: 'var(--muted-2)' }}>
            Fecha y ciudad, por confirmar. Te avisamos en cuanto se cierre.
          </p>
          <button type="button" className={css.btn} onClick={() => ir('aula')} style={{ marginTop: 4 }}>
            Entrar al aula
          </button>
        </section>

        <section className={css.tarjetaOro}>
          <p className={css.rotulo}>Incluido</p>
          <h2 className={css.h3}>Tu entrada a la comunidad</h2>
          <p className={css.parrafo}>
            Cuando termines la formación entras en la comunidad de terapeutas, que ahora mismo está
            en beta. Mientras dure no se cobra nada.
          </p>
        </section>
      </div>

      <section className={css.tarjeta}>
        <h2 className={css.rotuloSeccion}>Antes de venir</h2>
        {PREPARACION.length === 0 ? (
          <p className={css.vacioTexto}>
            Aquí aparecerá lo que tienes que traer y leer antes del primer día. Todavía no hay nada
            subido.
          </p>
        ) : (
          PREPARACION.map((p) => (
            <div key={p.nombre} className={css.fila}>
              <span className={css.filaNombre}>{p.nombre}</span>
              <span className={css.filaTipo}>{p.tipo}</span>
            </div>
          ))
        )}
      </section>
    </>
  );
}

/* ==========================================================================
   Aula de la formación (alumna)
   ========================================================================== */
export function Aula() {
  return (
    <div className={css.columna}>
      {BLOQUES_AULA.length === 0 && (
        <Vacio>
          El material de tu formación se abre por partes: lo de antes de venir, lo que usarás
          durante y las grabaciones de después. Todavía no hay nada publicado.
        </Vacio>
      )}
      {BLOQUES_AULA.map((b) => (
        <section key={b.titulo} className={css.tarjeta}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 14, justifyContent: 'space-between' }}>
            <h2 className={css.h2}>{b.titulo}</h2>
            <span style={{ fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--oro)' }}>
              {b.estado}
            </span>
          </div>
          {b.items.map((i) => (
            <div key={i.nombre} className={css.fila}>
              <span className={css.filaNombre}>{i.nombre}</span>
              <span className={css.filaTipo}>{i.tipo}</span>
            </div>
          ))}
        </section>
      ))}

      <section className={css.punteada} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className={css.h3}>Tu certificado</h2>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 300, color: 'var(--muted-2)' }}>
            Disponible cuando completes la formación.
          </p>
        </div>
        <button type="button" className={css.btnLinea} disabled style={{ cursor: 'not-allowed', color: 'var(--muted)' }}>
          Descargar
        </button>
      </section>
    </div>
  );
}

/* ==========================================================================
   Inicio · miembro certificada
   ========================================================================== */
export function InicioMiembro({ ir }: Props) {
  return (
    <>
      <section className={css.tarjetaOscura} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'clamp(18px,2.4vw,32px)', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-inverse)' }}>
            Próxima clase en vivo
          </p>
          <h2 className={css.h2} style={{ color: 'var(--inverse-ink)', fontSize: 'clamp(24px,2.8vw,36px)' }}>
            Sin fecha todavía
          </h2>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 300, color: 'var(--on-inverse-2)' }}>
            La primera clase en vivo se anuncia aquí y en el canal privado.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--on-inverse-3)' }}>
            Cuando haya fecha, podrás apuntarte desde aquí. Si no puedes venir, la tendrás grabada.
          </span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 'clamp(16px,2vw,22px)' }}>
        {ACCESOS.map((a) => (
          <button key={a.titulo} type="button" onClick={() => ir(a.ir)} className={css.curso} style={{ padding: 'clamp(20px,2.4vw,28px)', gap: 10 }}>
            <span className={css.cursoEtiqueta}>{a.etiqueta}</span>
            <span className={css.cursoTitulo} style={{ fontSize: 'clamp(20px,2.1vw,26px)' }}>
              {a.titulo}
            </span>
            <span style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.55, color: 'var(--muted-2)' }}>
              {a.texto}
            </span>
          </button>
        ))}
      </div>

      <section className={css.tarjeta}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 className={css.rotuloSeccion}>Clases anteriores</h2>
          {CLASES_ANTERIORES.length > 0 && (
            <input placeholder="Buscar por tema" aria-label="Buscar clase por tema" className={css.campoRedondo} style={{ flex: '0 1 240px' }} />
          )}
        </div>
        {CLASES_ANTERIORES.length === 0 && (
          <p className={css.vacioTexto}>
            Todavía no se ha dado ninguna. Según se vayan dando, quedan grabadas aquí.
          </p>
        )}
        {CLASES_ANTERIORES.map((c) => (
          <div key={c.tema} className={css.fila} style={{ padding: '15px 0' }}>
            <span style={{ fontSize: 15.5, fontWeight: 300, color: 'var(--ink-4)', maxWidth: 520 }}>{c.tema}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>{c.fecha}</span>
              <button type="button" className={css.enlaceAccion}>
                Ver
              </button>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

/* ==========================================================================
   Comunidad
   ========================================================================== */
export function Comunidad({ rol, ir, iniciales = 'D', conComunidad = false }: PropsFeed) {
  const [filtro, setFiltro] = useState('Todo');
  const [likes, setLikes] = useState<Record<string, boolean>>({});

  /*
   * Quién puede escribir aquí ya no lo decide «ser alumna» o «ser miembro»
   * —eso ya no existe— sino tener contratada la comunidad, que es lo que se
   * paga cada mes. Quien no la tiene entra de visita y lee, que es justo lo
   * que decía esta pantalla antes con otras palabras.
   */
  const esAdmin = rol === 'sorela';
  const esMiembro = !esAdmin && conComunidad;
  const deVisita = !esAdmin && !conComunidad;

  const posts = POSTS.filter((p) => filtro === 'Todo' || p.etiqueta === filtro);

  return (
    <div className={css.feed}>
      <div className={css.feedCentro}>
        {!deVisita && (
          <section className={css.compositor}>
            <span className={css.avatar}>{iniciales}</span>
            <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                rows={2}
                placeholder="Comparte un caso, una duda o un resultado…"
                aria-label="Escribe una publicación"
                className={css.campoCaja}
                style={{ resize: 'vertical' }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--faint)' }}>
                  Solo lo ven las terapeutas certificadas.
                </span>
                <button type="button" className={`${css.btn} ${css.btnSm}`}>
                  Publicar
                </button>
              </div>
            </div>
          </section>
        )}

        {deVisita && (
          <section className={css.aviso}>
            <span style={{ fontSize: 14.5, fontWeight: 300, lineHeight: 1.55, color: 'var(--muted-2)', maxWidth: 520 }}>
              Puedes leer todo lo que se publica. Para escribir en la comunidad hace falta tenerla
              contratada.
            </span>
            <button type="button" className={css.btnLinea} onClick={() => ir('aula')}>
              Ir a mi formación
            </button>
          </section>
        )}

        {POSTS.length > 0 && <Chips opciones={FILTROS_FEED} activo={filtro} onElegir={setFiltro} />}

        {posts.length === 0 && (
          <Vacio>
            {POSTS.length === 0
              ? 'Todavía no ha publicado nadie. La primera que escriba abre la comunidad.'
              : 'Ninguna publicación con ese filtro.'}
          </Vacio>
        )}

        {posts.map((p) => {
          const meGusta = !!likes[p.id];
          return (
            <article key={p.id} className={`${css.post} ${p.destacado ? css.postDestacado : ''}`}>
              <div className={css.postCabeza}>
                <span className={`${css.avatar}`} style={{ width: 38, height: 38, fontSize: 14 }}>
                  {p.iniciales}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span className={css.postAutor}>{p.autor}</span>
                  <span className={css.postCuando}>{p.cuando}</span>
                </span>
                <span className={css.postEtiqueta}>{p.etiqueta}</span>
              </div>

              <h2 className={css.postTitulo}>{p.titulo}</h2>
              <p className={css.postTexto}>{p.texto}</p>

              <div className={css.postPie}>
                <button
                  type="button"
                  onClick={() => setLikes((l) => ({ ...l, [p.id]: !l[p.id] }))}
                  aria-pressed={meGusta}
                  className={`${css.postAccion} ${meGusta ? css.postActivo : ''}`}
                >
                  {p.likes + (meGusta ? 1 : 0)} me gusta
                </button>
                <button type="button" className={css.postAccion}>
                  {p.respuestas} respuestas
                </button>
                <span className={css.postUltima}>{p.ultima}</span>
              </div>
            </article>
          );
        })}
      </div>

      <aside className={css.feedLado}>
        {esMiembro && (
          <section className={css.tarjetaOro}>
            <p className={css.rotulo}>Tu nivel</p>
            <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
              Sin actividad todavía
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              El nivel sube con lo que aportas: casos, respuestas y resultados. Se empieza a contar
              con la primera publicación.
            </p>
          </section>
        )}

        {esAdmin && (
          <section className={css.tarjetaOro}>
            <p className={css.rotulo}>Moderación</p>
            <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
              Nada sin responder
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              Cuando alguien publique y se quede sin respuesta, te aparecerá aquí.
            </p>
          </section>
        )}

        {deVisita && (
          <section className={css.tarjetaOro}>
            <p className={css.rotulo}>Tu acceso</p>
            <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
              Estás de visita
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              Puedes leer la comunidad. Podrás publicar y tener nivel cuando termines la
              formación. Ahora está en beta, así que no hay cuota que pagar.
            </p>
          </section>
        )}

        <section className={css.tarjeta} style={{ gap: 12 }}>
          <p className={css.rotulo}>Más activas este mes</p>
          {RANKING.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: 'var(--muted)' }}>
              Se ordena por participación. Sin publicaciones todavía no hay nada que ordenar.
            </p>
          )}
          {RANKING.map((r) => (
            <div key={r.nombre} className={css.rankingFila}>
              <span className={css.rankingPos}>{r.pos}</span>
              <span className={css.rankingNombre}>{r.nombre}</span>
              <span className={css.rankingPuntos}>{r.puntos}</span>
            </div>
          ))}
        </section>

        <section className={css.tarjetaOscura} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start', padding: 'clamp(20px,2.4vw,26px)' }}>
          <p style={{ margin: 0, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-inverse)' }}>
            Próxima clase
          </p>
          <p style={{ margin: 0, fontFamily: 'var(--fuente-cormorant), serif', fontSize: 20, lineHeight: 1.15, color: 'var(--inverse-ink)' }}>
            Sin fecha todavía
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 300, color: 'var(--on-inverse-2)' }}>
            {esAdmin ? 'Convoca la primera cuando quieras.' : 'Se anuncia aquí en cuanto haya una.'}
          </p>
        </section>
      </aside>
    </div>
  );
}

/* ==========================================================================
   Clases y material (aula de la comunidad)
   ========================================================================== */
export function Clases() {
  // Ojo con el orden: `CURSOS_AULA[0].id` reventaba en cuanto la lista se
  // quedó vacía. Sin cursos publicados no hay nada que seleccionar.
  const [sel, setSel] = useState(CURSOS_AULA[0]?.id ?? '');
  const curso = CURSOS_AULA.find((c) => c.id === sel) ?? CURSOS_AULA[0];

  if (!curso) {
    return (
      <Vacio>
        Aquí van las clases grabadas y el material de la comunidad. Todavía no hay ningún curso
        publicado.
      </Vacio>
    );
  }

  const prog = progresoCurso(curso);

  return (
    <div className={css.columna}>
      <div className={css.cursos}>
        {CURSOS_AULA.map((c) => {
          const p = progresoCurso(c);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSel(c.id)}
              aria-pressed={sel === c.id}
              className={`${css.curso} ${sel === c.id ? css.cursoSeleccionado : ''}`}
            >
              <span className={css.cursoFoto}>
                <Image src={FOTOS[c.foto]} alt="" sizes="(max-width: 880px) 100vw, 280px" placeholder="blur" />
              </span>
              <span className={css.cursoCuerpo}>
                <span className={css.cursoEtiqueta}>{c.etiqueta}</span>
                <span className={css.cursoTitulo}>{c.titulo}</span>
                <span className={css.cursoMeta}>{metaCurso(c)}</span>
                <span style={{ marginTop: 4 }}>
                  <Barra pct={p.pct} />
                </span>
                <span className={css.cursoProgreso}>{p.texto}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section className={css.tarjeta}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 className={css.h2} style={{ fontSize: 'clamp(23px,2.5vw,32px)' }}>
            {curso.titulo}
          </h2>
          <span style={{ fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--oro)' }}>
            {prog.texto}
          </span>
        </div>

        {curso.lecciones.map((l, i) => {
          const vista = i < prog.hechas;
          const estado = vista ? 'Vista' : i === prog.hechas ? 'Siguiente' : 'Pendiente';
          return (
            <div key={l.nombre} className={css.leccion}>
              <span className={`${css.leccionNum} ${vista ? css.leccionVista : ''}`}>{i + 1}</span>
              <span className={css.leccionNombre}>{l.nombre}</span>
              <span className={css.leccionDuracion}>{l.duracion}</span>
              <span className={css.leccionEstado}>{estado}</span>
            </div>
          );
        })}
      </section>

      <section className={css.tarjeta}>
        <h2 className={css.rotuloSeccion}>Descargables del curso</h2>
        {DESCARGABLES.length === 0 && (
          <p className={css.vacioTexto}>Este curso todavía no tiene material para descargar.</p>
        )}
        {DESCARGABLES.map((d) => (
          <div key={d.nombre} className={css.fila} style={{ padding: '13px 0' }}>
            <span className={css.filaNombre}>{d.nombre}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 300, color: 'var(--faint)' }}>{d.tipo}</span>
              <button type="button" className={css.enlaceAccion}>
                Descargar
              </button>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ==========================================================================
   Mis clientas (CRM)
   ========================================================================== */
export function Clientas() {
  const [filtro, setFiltro] = useState('Todas');

  const lista = CLIENTAS.filter(
    (c) =>
      filtro === 'Todas' ||
      (filtro === 'En plan' && c.estado === 'En plan') ||
      (filtro === 'Nuevas' && c.estado === 'Nueva') ||
      (filtro === 'Sin volver' && c.estado === 'Fría')
  );

  return (
    <div className={css.columna}>
      <Kpis datos={KPIS_CRM} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className={css.chips}>
          <input placeholder="Buscar clienta" aria-label="Buscar clienta" className={css.campoRedondo} style={{ flex: '0 1 220px' }} />
          <Chips opciones={FILTROS_CRM} activo={filtro} onElegir={setFiltro} />
        </div>
        <button type="button" className={css.btn}>
          Nueva clienta
        </button>
      </div>

      {lista.length === 0 && (
        <Vacio>
          {CLIENTAS.length === 0
            ? 'Aquí llevas tu cartera: quién está en plan, cuántas sesiones lleva y cuándo vuelve. Da de alta a tu primera clienta para empezar.'
            : 'Ninguna clienta con ese filtro.'}
        </Vacio>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 'clamp(12px,1.6vw,18px)' }}>
        {lista.map((c) => (
          <article key={c.nombre} className={css.clienta}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={css.avatar}>{c.iniciales}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 15.5, color: 'var(--ink)' }}>{c.nombre}</span>
                <span style={{ fontSize: 12, fontWeight: 300, color: 'var(--faint)' }}>{c.telefono}</span>
              </span>
              <span className={`${css.estado} ${CLASE_ESTADO[c.estado]}`} style={{ marginLeft: 'auto' }}>
                {c.estado}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 13.5, fontWeight: 300, color: 'var(--ink-3)' }}>{c.plan}</span>
              <Barra pct={c.total === 0 ? 0 : Math.round((c.hechas / c.total) * 100)} />
              <span style={{ fontSize: 11.5, fontWeight: 300, color: 'var(--faint)' }}>
                {c.hechas} de {c.total} sesiones
              </span>
            </div>

            <div className={css.clientaPie}>
              <span>Última: {c.ultima}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--oro)' }}>{c.proxima}</span>
            </div>

            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, lineHeight: 1.5, color: 'var(--muted-2)', textWrap: 'pretty' }}>
              {c.nota}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Facturación (miembro)
   ========================================================================== */
export function Facturacion() {
  const [filtro, setFiltro] = useState('Todas');
  const lista = FACTURAS.filter((f) => filtro === 'Todas' || f.estado === filtro);

  return (
    <div className={css.columna}>
      <Kpis datos={KPIS_FACT} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <Chips opciones={FILTROS_FACT} activo={filtro} onElegir={setFiltro} />
        <div className={css.acciones}>
          <button type="button" className={css.btnLinea}>
            Exportar trimestre
          </button>
          <button type="button" className={css.btn}>
            Nueva factura
          </button>
        </div>
      </div>

      <ListaFacturas
        facturas={lista}
        vacio={
          FACTURAS.length === 0
            ? 'Todavía no has emitido ninguna factura. Cuando emitas la primera, aparece aquí con su número, su estado y su PDF.'
            : 'Ninguna factura con ese filtro.'
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 'clamp(14px,1.8vw,20px)' }}>
        <section className={css.tarjeta} style={{ alignItems: 'flex-start', gap: 12 }}>
          <p className={css.rotulo}>Tus datos fiscales</p>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 300, lineHeight: 1.65, color: 'var(--ink-3)' }}>
            Sin rellenar. Hacen falta para poder emitir: nombre fiscal, NIF, dirección y la serie de
            numeración con la que empiezas.
          </p>
          <button type="button" className={css.btnLinea} style={{ marginTop: 4 }}>
            Rellenar datos fiscales
          </button>
        </section>

        <section className={css.tarjetaOro}>
          <p className={css.rotulo}>Trimestre en curso</p>
          <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
            0 € facturados
          </p>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 300, lineHeight: 1.6, color: 'var(--ink-3)', textWrap: 'pretty' }}>
            Según emitas facturas se va sumando aquí, con su IVA, para que puedas exportar el
            trimestre y mandárselo a tu asesoría.
          </p>
        </section>
      </div>
    </div>
  );
}

/* ==========================================================================
   Mi agenda
   ========================================================================== */
const CLASE_CITA = { conf: css.citaConf, nueva: css.citaNueva, pend: '' };

export function Agenda({ ir }: Props) {
  return (
    <div className={css.columna} style={{ gap: 'clamp(18px,2.4vw,26px)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <span className={css.semanaEtiqueta}>Semana del 5 al 10 de octubre</span>
        <div className={css.leyenda}>
          <span className={css.leyendaItem}>
            <span className={css.leyendaColor} style={{ background: 'var(--ink)' }} />
            Nueva
          </span>
          <span className={css.leyendaItem}>
            <span className={css.leyendaColor} style={{ background: 'var(--oro-tint)', border: '1px solid var(--oro-line)' }} />
            Confirmada
          </span>
          <span className={css.leyendaItem}>
            <span className={css.leyendaColor} style={{ background: 'var(--surface)', border: '1px solid var(--line-5)' }} />
            Pendiente
          </span>
        </div>
      </div>

      <div className={css.semana}>
        {SEMANA.map((d) => (
          <div key={d.num} className={css.dia}>
            <div className={css.diaCabeza}>
              <span className={css.diaDow}>{d.dow}</span>
              <span className={css.diaNum}>{d.num}</span>
            </div>
            {d.citas.map((c) => (
              <article key={c.hora} className={`${css.cita} ${CLASE_CITA[c.tipo]}`}>
                <span className={css.citaHora}>{c.hora}</span>
                <span className={css.citaCliente}>{c.cliente}</span>
                <span className={css.citaMotivo}>{c.motivo}</span>
                <span className={css.citaEstado}>{c.estado}</span>
              </article>
            ))}
            {d.citas.length === 0 && <span className={css.libre}>Libre</span>}
          </div>
        ))}
      </div>

      <section className={css.tarjeta} style={{ gap: 16 }}>
        <h2 className={css.rotuloSeccion}>Reservas por confirmar</h2>
        {POR_CONFIRMAR.map((p) => (
          <div key={p.cliente} className={css.fila} style={{ padding: '16px 0' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <span style={{ fontSize: 15.5, fontWeight: 300, color: 'var(--ink)' }}>
                {p.cliente} · {p.cuando}
              </span>
              <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)' }}>{p.detalle}</span>
            </span>
            <span className={css.acciones}>
              <button type="button" className={`${css.btn} ${css.btnSm}`}>
                Confirmar
              </button>
              <button type="button" className={`${css.btnLinea} ${css.btnSm}`}>
                Reprogramar
              </button>
              <button type="button" className={`${css.btnLinea} ${css.btnSm}`} style={{ color: 'var(--muted)', borderColor: 'var(--line-3)' }}>
                Cancelar
              </button>
            </span>
          </div>
        ))}
      </section>

      <Horarios />

      <p className={css.apunte}>
        ¿Sin reservas todavía?{' '}
        <button type="button" onClick={() => ir('perfil')} className={css.enlaceAccion} style={{ letterSpacing: 0, textTransform: 'none', fontSize: 12.5 }}>
          Completa tu ficha
        </button>{' '}
        para que las clientas puedan encontrarte.
      </p>
    </div>
  );
}

function Horarios() {
  const [activos, setActivos] = useState(['Lun', 'Mar', 'Mié', 'Jue']);

  return (
    <section className={css.tarjeta} style={{ gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className={css.rotuloSeccion}>Tus horarios</h2>
        <p style={{ margin: 0, maxWidth: 560, fontSize: 14.5, fontWeight: 300, lineHeight: 1.6, color: 'var(--muted-2)', textWrap: 'pretty' }}>
          Marca los días y las horas en que aceptas reservas. Solo se te podrá reservar dentro de ese
          margen.
        </p>
      </div>
      <div className={css.chips}>
        {DIAS_SEMANA.map((d) => {
          const on = activos.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => setActivos((a) => (on ? a.filter((x) => x !== d) : [...a, d]))}
              className={`${css.chip} ${on ? css.chipActivo : ''}`}
              style={{ padding: '11px 18px', fontSize: 13 }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ==========================================================================
   Mi ficha pública
   ========================================================================== */
export function Perfil() {
  return (
    <>
      <p className={css.intro}>
        Esto es lo que ven las clientas cuando te encuentran. Cuanto más completa, más reservas.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 'clamp(16px,2vw,24px)', alignItems: 'start' }}>
        <section className={css.tarjeta}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 18, borderBottom: '1px solid var(--line-2)' }}>
            <span className={`${css.avatar} ${css.avatarLg}`} aria-hidden="true" />
            <button type="button" className={css.btnLinea}>
              Cambiar foto
            </button>
          </div>

          <label className={css.etiquetaCampo}>
            Nombre
            <input placeholder="Tu nombre y apellidos" className={css.campo} />
          </label>
          <label className={css.etiquetaCampo}>
            Ciudad
            <input placeholder="Dónde atiendes" className={css.campo} />
          </label>
          <label className={css.etiquetaCampo}>
            Sobre mí
            <textarea
              rows={4}
              className={css.campo}
              style={{ resize: 'vertical' }}
              placeholder="Cuántos años llevas, qué trabajas y cómo valoras antes de empezar."
            />
          </label>
          <label className={css.etiquetaCampo}>
            Dirección
            <input placeholder="Calle, número y barrio" className={css.campo} />
          </label>
          <label className={css.etiquetaCampo}>
            Teléfono
            <input placeholder="Teléfono de contacto" className={css.campo} />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <button type="button" className={css.btn}>
              Guardar cambios
            </button>
            <span className={css.apunte}>
              Tu ficha se publica cuando Sorela la aprueba.
            </span>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px,2vw,22px)' }}>
          <div className={css.tarjetaOro} style={{ gap: 8 }}>
            <p className={css.rotulo}>Estado</p>
            <p className={css.h3}>Sin publicar todavía</p>
          </div>

          <div className={css.tarjeta}>
            <p className={css.rotulo}>Tratamientos que trabajas</p>
            <div className={css.chips}>
              {TRATAMIENTOS_PERFIL.map((t) => {
                const on = TRATAMIENTOS_ACTIVOS.includes(t);
                return (
                  <span
                    key={t}
                    className={css.chip}
                    style={{
                      cursor: 'default',
                      background: on ? 'var(--oro-tint)' : 'var(--surface)',
                      color: on ? 'var(--ink)' : 'var(--faint)',
                      fontSize: 13,
                      padding: '9px 16px',
                    }}
                  >
                    {t}
                  </span>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/* ==========================================================================
   Mi acceso a la comunidad

   La membresía está en fase beta de lanzamiento: todavía no tiene precio
   público ni se cobra nada, así que esta vista no habla de cuota, ni de
   próximo cobro, ni de recibos. Cuando se abra y se fije precio, aquí vuelven
   el método de pago, el histórico y la baja.
   ========================================================================== */
export function Suscripcion() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'clamp(16px,2vw,24px)', alignItems: 'start' }}>
      <section className={css.tarjeta} style={{ alignItems: 'flex-start', gap: 16 }}>
        <p className={css.rotulo}>Tu acceso</p>
        <h2 className={css.h2}>Comunidad de Terapeutas Divine</h2>
        <span className={`${css.estado} ${css.estadoOro}`}>En beta</span>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 300, lineHeight: 1.6, color: 'var(--muted-2)', textWrap: 'pretty' }}>
          Estás dentro de la beta como certificada. Mientras dure no se cobra nada: la
          comunidad se está construyendo con las que estáis aquí desde el principio.
        </p>
        <p className={css.apunte}>
          Cuando se abra al público te escribiré yo antes de que haya ningún cargo. Nada se
          activa solo.
        </p>
      </section>

      <section className={css.tarjetaOro}>
        <p className={css.rotulo}>Condición de fundadora</p>
        <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
          La mantienes mientras sigas dentro
        </p>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 300, lineHeight: 1.6, color: 'var(--ink-3)', textWrap: 'pretty' }}>
          Entraste en la beta, así que conservas las condiciones de fundadora el día que la
          comunidad abra y tenga precio.
        </p>
      </section>

      <section className={css.tarjeta}>
        <h2 className={css.rotuloSeccion}>Qué falta para abrir</h2>
        {PENDIENTE_BETA.map((p) => (
          <div key={p.que} className={css.fila}>
            <span className={css.filaNombre}>{p.que}</span>
            <span className={`${css.estado} ${p.listo ? css.estadoOro : css.estadoNeutro}`}>
              {p.listo ? 'Listo' : 'En marcha'}
            </span>
          </div>
        ))}
        <p className={css.apunte} style={{ marginTop: 6 }}>
          Si echas algo en falta, dímelo por el canal: la beta está para eso.
        </p>
      </section>
    </div>
  );
}

/* ==========================================================================
   Mis pagos (alumna)
   ========================================================================== */
export function Pagos() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'clamp(16px,2vw,24px)', alignItems: 'start' }}>
      <section className={css.tarjeta}>
        <h2 className={css.rotuloSeccion}>Histórico de pagos</h2>
        {PAGOS_ALUMNA.map((p) => (
          <div key={p.concepto} className={css.fila} style={{ padding: '16px 0' }}>
            <span style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 300, color: 'var(--ink)' }}>{p.concepto}</span>
              <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--faint)' }}>{p.fecha}</span>
            </span>
            <span style={{ fontSize: 15, color: 'var(--ink)' }}>{p.importe}</span>
            <span className={`${css.estado} ${CLASE_ESTADO[p.estado] ?? css.estadoNeutro}`}>{p.estado}</span>
            <button type="button" className={css.enlaceAccion}>
              Recibo
            </button>
          </div>
        ))}
        <p className={css.apunte} style={{ marginTop: 6 }}>
          Si necesitas fraccionar el resto en tres meses, escríbele a Sorela antes del 1 de noviembre.
        </p>
      </section>

      <section className={css.tarjetaOro}>
        <p className={css.rotulo}>Tu plaza</p>
        <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
          Formación Base · Madrid, 14–16 de noviembre
        </p>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 300, lineHeight: 1.6, color: 'var(--ink-3)', textWrap: 'pretty' }}>
          Plaza confirmada con la reserva pagada. El resto se abona el primer día, en efectivo o
          tarjeta.
        </p>
      </section>
    </div>
  );
}

/* ==========================================================================
   Panel de Sorela
   ========================================================================== */
/**
 * Lo primero que ve Sorela al entrar.
 *
 * Antes eran tres cajas: terapeutas certificadas, plazas vendidas y reservas
 * por terapeuta, todas con cifras inventadas. No hay ninguna certificada ni
 * ninguna convocatoria abierta, así que esas tres cajas eran decoración.
 *
 * Lo que sí existe y se mueve todos los días es quién deja su contacto en la
 * web. Eso es lo que manda aquí: cuántos hay, cuántos siguen sin atender y
 * los últimos que han entrado, con un salto directo a la lista completa.
 */
export function PanelSorela({ ir }: { ir: (v: Vista) => void }) {
  const [lista, setLista] = useState<ContactoBreve[] | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch('/api/contactos')
      .then((r) => r.json())
      .then((c) => {
        if (!vivo) return;
        if (c.ok) setLista(c.contactos);
        else {
          setFallo(true);
          setLista([]);
        }
      })
      .catch(() => {
        if (!vivo) return;
        setFallo(true);
        setLista([]);
      });
    // Si Sorela cambia de pantalla mientras carga, no se toca un estado que
    // ya no está montado.
    return () => {
      vivo = false;
    };
  }, []);

  const l = lista ?? [];
  const ahora = Date.now();
  const semana = l.filter(
    (c) => c.creado && ahora - new Date(c.creado).getTime() < 7 * 86400000
  ).length;
  const sinAtender = l.filter((c) => c.estado === 'Nuevo').length;

  const kpis = [
    {
      label: 'Sin atender',
      valor: lista === null ? '·' : String(sinAtender),
      nota: 'contactos que nadie ha tocado',
    },
    {
      label: 'Esta semana',
      valor: lista === null ? '·' : String(semana),
      nota: 'han dejado sus datos en la web',
    },
    {
      label: 'En total',
      valor: lista === null ? '·' : String(l.length),
      nota: 'desde que la web capta',
    },
  ];

  return (
    <>
      <Kpis datos={kpis} />

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          No he podido leer los contactos. Comprueba la configuración de Firebase.
        </p>
      )}

      <section className={css.tarjeta} style={{ gap: 4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <h2 className={css.rotuloSeccion}>Últimos contactos</h2>
          {l.length > 0 && (
            <button type="button" className={css.enlaceAccion} onClick={() => ir('leads')}>
              Ver todos
            </button>
          )}
        </div>

        {lista === null ? (
          <p className={css.vacioTexto}>Cargando…</p>
        ) : l.length === 0 ? (
          <p className={css.vacioTexto}>
            Todavía no se ha apuntado nadie. En cuanto alguien deje su nombre y su correo en la
            web, aparece aquí.
          </p>
        ) : (
          l.slice(0, 5).map((c) => (
            <div key={c.id} className={css.fila} style={{ padding: '15px 0', gap: 14 }}>
              <span style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 15.5, color: 'var(--ink)' }}>{c.nombre}</span>
                <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                  {c.correo}
                  {c.whatsapp && ` · ${c.whatsapp}`}
                </span>
              </span>
              <span style={{ flex: '0 1 160px', fontSize: 12.5, fontWeight: 300, color: 'var(--faint)' }}>
                {c.origen}
              </span>
              <span className={`${css.estado} ${CLASE_ESTADO[c.estado] ?? ''}`}>{c.estado}</span>
            </div>
          ))
        )}
      </section>

      <section className={css.tarjeta} style={{ gap: 4 }}>
        <h2 className={css.rotuloSeccion}>Lo que falta para abrir</h2>
        {PENDIENTE_BETA.map((p) => (
          <div key={p.que} className={css.fila} style={{ padding: '13px 0' }}>
            <span style={{ fontSize: 14.5, fontWeight: 300, color: p.listo ? 'var(--muted)' : 'var(--ink-4)' }}>
              {p.que}
            </span>
            <span
              className={`${css.estado} ${p.listo ? css.estadoOro : css.estadoApagado}`}
            >
              {p.listo ? 'Hecho' : 'Pendiente'}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

/* ==========================================================================
   Formaciones (admin)
   ========================================================================== */
export function FormacionesAdmin() {
  return (
    <div className={css.columna}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <p className={css.intro} style={{ maxWidth: 560 }}>
          Cada convocatoria con sus plazas vendidas, lo cobrado y quién falta por pagar.
        </p>
        <button type="button" className={css.btn}>
          Nueva convocatoria
        </button>
      </div>

      {CONVOCATORIAS.length === 0 && (
        <Vacio>
          Todavía no hay ninguna convocatoria abierta. Cuando crees la primera, aquí verás sus
          plazas vendidas, lo cobrado y quién falta por pagar.
        </Vacio>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'clamp(14px,1.8vw,20px)' }}>
        {CONVOCATORIAS.map((c) => (
          <article key={c.curso} className={css.tarjeta} style={{ gap: 14 }}>
            <span className={css.cursoEtiqueta}>{c.ciudad}</span>
            <h2 className={css.h2}>{c.curso}</h2>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 300, color: 'var(--muted-2)' }}>{c.fechas}</p>
            <Barra pct={c.pct} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, color: 'var(--ink-3)' }}>
              {c.vendidas} de {c.total} plazas · {c.ingreso}
            </p>
            <p className={css.apunte}>{c.pendiente}</p>
            <div className={css.acciones} style={{ marginTop: 4 }}>
              <button type="button" className={`${css.btn} ${css.btnSm}`}>
                Ver inscritas
              </button>
              <button type="button" className={`${css.btnLinea} ${css.btnSm}`}>
                Editar
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className={css.tarjeta}>
        <h2 className={css.rotuloSeccion}>Tu calendario</h2>
        {AGENDA_SORELA.length === 0 && (
          <p className={css.vacioTexto}>
            Sin nada apuntado. Las formaciones y las clases en vivo que convoques aparecen aquí.
          </p>
        )}
        {AGENDA_SORELA.map((a) => (
          <div key={a.que + a.cuando} className={css.fila} style={{ gap: 14 }}>
            <span style={{ flex: '0 1 190px', fontSize: 12.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--oro)' }}>
              {a.cuando}
            </span>
            <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 15, fontWeight: 300, color: 'var(--ink)' }}>
              {a.que}
            </span>
            <span style={{ flex: '0 1 220px', fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
              {a.detalle}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ==========================================================================
   Subir contenido (admin)
   ========================================================================== */
/*
 * Aquí vivía `Contenido`: la maqueta de «arrastra tu vídeo aquí». Se retira
 * entera, y no por limpieza. Prometía algo que no va a pasar —el vídeo no se
 * sube a esta plataforma— y seguía enrutable: bastaba con importarla por error
 * para que volviera el recuadro de subir archivos encima del aula de verdad.
 *
 * La sustituye `SubirClases.tsx`, donde se pega el enlace del vídeo de YouTube
 * y se dice quién puede verlo.
 */


export function FacturacionAdmin() {
  return (
    <div className={css.columna}>
      <Kpis datos={INGRESOS_ADMIN} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <p className={css.intro} style={{ maxWidth: 520, fontSize: 14.5 }}>
          Facturas emitidas a alumnas por reservas y pagos finales. La comunidad todavía no cobra
          nada.
        </p>
        <div className={css.acciones}>
          <button type="button" className={css.btnLinea}>
            Exportar trimestre
          </button>
          <button type="button" className={css.btn}>
            Nueva factura
          </button>
        </div>
      </div>

      <ListaFacturas
        facturas={FACTURAS_ADMIN}
        vacio="Todavía no se ha emitido ninguna factura. Las reservas y los pagos de las formaciones aparecerán aquí."
      />
    </div>
  );
}
