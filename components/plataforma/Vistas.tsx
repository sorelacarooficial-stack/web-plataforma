'use client';

import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
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
  FILTROS_LEADS,
  INGRESOS_ADMIN,
  INSCRITAS,
  KPIS_ADMIN,
  KPIS_CRM,
  KPIS_FACT,
  KPIS_LEADS,
  LEADS,
  PAGOS_ALUMNA,
  POR_APROBAR,
  POR_CONFIRMAR,
  POSTS,
  PREPARACION,
  RANKING,
  RECIBOS,
  RESERVAS_AGREGADAS,
  SEMANA,
  TRATAMIENTOS_ACTIVOS,
  TRATAMIENTOS_PERFIL,
  metaCurso,
  progresoCurso,
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

function ListaFacturas({ facturas }: { facturas: Factura[] }) {
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
            14–16 de noviembre de 2026 · Madrid
          </p>
          <button type="button" className={css.btn} onClick={() => ir('aula')} style={{ marginTop: 4 }}>
            Entrar al aula
          </button>
        </section>

        <section className={css.tarjetaOro}>
          <p className={css.rotulo}>Incluido</p>
          <h2 className={css.h3}>Tu primer mes de comunidad</h2>
          <p className={css.parrafo}>
            Cuando termines la formación se activa tu acceso a la comunidad de terapeutas. El primer
            mes va incluido.
          </p>
        </section>
      </div>

      <section className={css.tarjeta}>
        <h2 className={css.rotuloSeccion}>Antes de venir</h2>
        {PREPARACION.map((p) => (
          <div key={p.nombre} className={css.fila}>
            <span className={css.filaNombre}>{p.nombre}</span>
            <span className={css.filaTipo}>{p.tipo}</span>
          </div>
        ))}
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
            Retención severa en piernas: por dónde empezar
          </h2>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 300, color: 'var(--on-inverse-2)' }}>
            Jueves 8 de octubre · 20:00 h
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <button type="button" className={css.btnClaro}>
            Apuntarme
          </button>
          <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--on-inverse-3)' }}>
            Si no puedes venir, la tendrás grabada aquí.
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
          <input placeholder="Buscar por tema" aria-label="Buscar clase por tema" className={css.campoRedondo} style={{ flex: '0 1 240px' }} />
        </div>
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
export function Comunidad({ rol, ir }: Props) {
  const [filtro, setFiltro] = useState('Todo');
  const [likes, setLikes] = useState<Record<string, boolean>>({});

  const esAdmin = rol === 'sorela';
  const esAlumna = rol === 'alumna';
  const esMiembro = !esAdmin && !esAlumna;
  const iniciales = esAdmin ? 'SC' : 'MI';

  const posts = POSTS.filter((p) => filtro === 'Todo' || p.etiqueta === filtro);

  return (
    <div className={css.feed}>
      <div className={css.feedCentro}>
        {!esAlumna && (
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

        {esAlumna && (
          <section className={css.aviso}>
            <span style={{ fontSize: 14.5, fontWeight: 300, lineHeight: 1.55, color: 'var(--muted-2)', maxWidth: 520 }}>
              Puedes leer todo lo que se publica. Para escribir en la comunidad necesitas terminar la
              formación.
            </span>
            <button type="button" className={css.btnLinea} onClick={() => ir('aula')}>
              Ir a mi formación
            </button>
          </section>
        )}

        <Chips opciones={FILTROS_FEED} activo={filtro} onElegir={setFiltro} />

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
              Nivel 3 · Terapeuta activa
            </p>
            <Barra pct={62} gruesa />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              Ocho aportaciones más y pasas a nivel 4: acceso a las sesiones de casos en privado.
            </p>
          </section>
        )}

        {esAdmin && (
          <section className={css.tarjetaOro}>
            <p className={css.rotulo}>Moderación</p>
            <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
              3 publicaciones sin responder
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              Dos miembros nuevos esta semana. Un caso lleva 18 horas abierto sin respuesta tuya.
            </p>
            <button type="button" className={`${css.btn} ${css.btnSm}`} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              Ver sin responder
            </button>
          </section>
        )}

        {esAlumna && (
          <section className={css.tarjetaOro}>
            <p className={css.rotulo}>Tu acceso</p>
            <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
              Estás de visita
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              Puedes leer la comunidad. Podrás publicar y tener nivel cuando termines la formación:
              el primer mes va incluido.
            </p>
          </section>
        )}

        <section className={css.tarjeta} style={{ gap: 12 }}>
          <p className={css.rotulo}>Más activas este mes</p>
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
            Retención severa en piernas
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 300, color: 'var(--on-inverse-2)' }}>
            Jueves 8 · 20:00 h
          </p>
          {esMiembro && (
            <button type="button" className={css.btnClaro} style={{ marginTop: 6, padding: '11px 22px', fontSize: 11 }}>
              Apuntarme
            </button>
          )}
          {esAdmin && (
            <button type="button" className={css.btnClaro} style={{ marginTop: 6, padding: '11px 22px', fontSize: 11 }}>
              Editar clase
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

/* ==========================================================================
   Clases y material (aula de la comunidad)
   ========================================================================== */
export function Clases() {
  const [sel, setSel] = useState(CURSOS_AULA[0].id);
  const curso = CURSOS_AULA.find((c) => c.id === sel) ?? CURSOS_AULA[0];
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
              <Barra pct={Math.round((c.hechas / c.total) * 100)} />
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

      <ListaFacturas facturas={lista} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 'clamp(14px,1.8vw,20px)' }}>
        <section className={css.tarjeta} style={{ alignItems: 'flex-start', gap: 12 }}>
          <p className={css.rotulo}>Tus datos fiscales</p>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 300, lineHeight: 1.65, color: 'var(--ink-3)' }}>
            Marta Ibáñez Ruiz · 12345678Z
            <br />
            Calle de Ponzano, 42 · 28003 Madrid
            <br />
            Serie F2026 · siguiente número 0043
          </p>
          <button type="button" className={css.btnLinea} style={{ marginTop: 4 }}>
            Editar datos fiscales
          </button>
        </section>

        <section className={css.tarjetaOro}>
          <p className={css.rotulo}>Trimestre en curso</p>
          <p className={css.h3} style={{ fontSize: 'clamp(22px,2.3vw,28px)' }}>
            3T 2026 · 7.240 € facturados
          </p>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 300, lineHeight: 1.6, color: 'var(--ink-3)', textWrap: 'pretty' }}>
            IVA repercutido 1.520 € · retención IRPF 0 €. Exporta el trimestre y se lo mandas a tu
            asesoría en un clic.
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
            <span className={`${css.avatar} ${css.avatarLg}`}>MI</span>
            <button type="button" className={css.btnLinea}>
              Cambiar foto
            </button>
          </div>

          <label className={css.etiquetaCampo}>
            Nombre
            <input defaultValue="Marta Ibáñez" className={css.campo} />
          </label>
          <label className={css.etiquetaCampo}>
            Ciudad
            <input defaultValue="Madrid" className={css.campo} />
          </label>
          <label className={css.etiquetaCampo}>
            Sobre mí
            <textarea
              rows={4}
              className={css.campo}
              style={{ resize: 'vertical' }}
              defaultValue="Llevo nueve años en cabina. Trabajo postparto, drenaje y reductivo, siempre con una valoración previa."
            />
          </label>
          <label className={css.etiquetaCampo}>
            Dirección
            <input defaultValue="Calle de Ponzano, 42 · Chamberí" className={css.campo} />
          </label>
          <label className={css.etiquetaCampo}>
            Teléfono
            <input defaultValue="600 12 34 56" className={css.campo} />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <button type="button" className={css.btn}>
              Guardar cambios
            </button>
            <Link href="/terapeutas/marta-ibanez" className={css.enlaceAccion} style={{ textDecoration: 'none' }}>
              Ver mi ficha pública
            </Link>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px,2vw,22px)' }}>
          <div className={css.tarjetaOro} style={{ gap: 8 }}>
            <p className={css.rotulo}>Estado</p>
            <p className={css.h3}>Visible en el buscador desde el 2 de febrero de 2026</p>
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
   Mi suscripción
   ========================================================================== */
export function Suscripcion() {
  const [baja, setBaja] = useState(false);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'clamp(16px,2vw,24px)', alignItems: 'start' }}>
      <section className={css.tarjeta} style={{ alignItems: 'flex-start', gap: 16 }}>
        <p className={css.rotulo}>Tu suscripción</p>
        <h2 className={css.h2}>Comunidad de Terapeutas Divine</h2>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 300, color: 'var(--muted-2)' }}>
          49 € al mes · Próximo cobro: 2 de octubre de 2026
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginTop: 6 }}>
          <button type="button" className={css.btn}>
            Cambiar método de pago
          </button>
          <button
            type="button"
            onClick={() => setBaja(true)}
            style={{ padding: 0, background: 'none', border: 'none', borderBottom: '1px solid var(--line-5)', fontSize: 13.5, fontWeight: 300, color: 'var(--muted)', cursor: 'pointer' }}
          >
            Darme de baja
          </button>
        </div>
      </section>

      {baja && (
        <section className={css.tarjetaOscura} style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
          <h2 className={css.h2} style={{ color: 'var(--inverse-ink)' }}>
            ¿Seguro?
          </h2>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 300, lineHeight: 1.6, color: 'var(--on-inverse-2)', textWrap: 'pretty' }}>
            Mantienes el acceso hasta el 2 de octubre y tu ficha dejará de aparecer en el buscador
            ese día. Puedes volver cuando quieras.
          </p>
          <div className={css.acciones} style={{ marginTop: 6 }}>
            <button type="button" className={css.btnClaro} onClick={() => setBaja(false)}>
              Sigo dentro
            </button>
            <button
              type="button"
              className={css.btnLinea}
              style={{ color: 'var(--on-inverse-2)', borderColor: 'var(--line-inverse-2)' }}
            >
              Darme de baja
            </button>
          </div>
        </section>
      )}

      <section className={css.tarjeta}>
        <h2 className={css.rotuloSeccion}>Recibos</h2>
        {RECIBOS.map((m) => (
          <div key={m} className={css.fila} style={{ padding: '13px 0' }}>
            <span style={{ fontSize: 14.5, fontWeight: 300, color: 'var(--ink-4)' }}>{m}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 300, color: 'var(--muted-2)' }}>49,00 €</span>
              <button type="button" className={css.enlaceAccion}>
                PDF
              </button>
            </span>
          </div>
        ))}
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
export function PanelSorela() {
  return (
    <>
      <Kpis datos={KPIS_ADMIN} />

      <section className={css.tarjeta} style={{ gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <h2 className={css.rotuloSeccion}>Fichas por aprobar</h2>
          <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
            El buscador solo publica lo que tú apruebas
          </span>
        </div>
        {POR_APROBAR.map((p) => (
          <div key={p.nombre} className={css.fila} style={{ padding: '16px 0' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 15.5, fontWeight: 300, color: 'var(--ink)' }}>
                {p.nombre} · {p.ciudad}
              </span>
              <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)' }}>{p.nota}</span>
            </span>
            <span className={css.acciones}>
              <button type="button" className={`${css.btn} ${css.btnSm}`}>
                Aprobar
              </button>
              <button type="button" className={`${css.btnLinea} ${css.btnSm}`}>
                Ver ficha
              </button>
            </span>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'clamp(16px,2vw,22px)' }}>
        <section className={css.tarjeta}>
          <h2 className={css.rotuloSeccion}>Formaciones e inscritas</h2>
          {INSCRITAS.map((i) => (
            <div key={i.curso} className={css.fila}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 300, color: 'var(--ink)' }}>{i.curso}</span>
                <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>{i.cuando}</span>
              </span>
              <span style={{ fontFamily: 'var(--fuente-cormorant), serif', fontSize: 19, color: 'var(--oro)' }}>
                {i.plazas}
              </span>
            </div>
          ))}
        </section>

        <section className={css.tarjeta}>
          <h2 className={css.rotuloSeccion}>Reservas del mes por terapeuta</h2>
          {RESERVAS_AGREGADAS.map((r) => (
            <div key={r.nombre} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line-2)' }}>
              <span style={{ flex: '0 0 auto', width: 120, fontSize: 14.5, fontWeight: 300, color: 'var(--ink-4)' }}>
                {r.nombre}
              </span>
              <span style={{ flex: '1 1 auto', minWidth: 40 }}>
                <Barra pct={r.pct} gruesa />
              </span>
              <span style={{ flex: '0 0 auto', fontSize: 13.5, fontWeight: 300, color: 'var(--muted-2)' }}>
                {r.total}
              </span>
            </div>
          ))}
          <p className={css.apunte} style={{ marginTop: 6 }}>
            Solo el dato agregado. El detalle de cada clienta es de su terapeuta.
          </p>
        </section>
      </div>
    </>
  );
}

/* ==========================================================================
   Leads
   ========================================================================== */
export function Leads() {
  const [filtro, setFiltro] = useState('Todos');
  const lista = LEADS.filter((l) => filtro === 'Todos' || l.estado === filtro);

  return (
    <div className={css.columna}>
      <Kpis datos={KPIS_LEADS} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className={css.chips}>
          <input placeholder="Buscar lead" aria-label="Buscar lead" className={css.campoRedondo} style={{ flex: '0 1 200px' }} />
          <Chips opciones={FILTROS_LEADS} activo={filtro} onElegir={setFiltro} />
        </div>
        <button type="button" className={css.btn}>
          Exportar leads
        </button>
      </div>

      <section className={css.tarjeta}>
        {lista.map((l) => (
          <article key={l.nombre} className={css.fila} style={{ padding: '16px 0', gap: 14 }}>
            <span style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 15.5, color: 'var(--ink)' }}>
                {l.nombre} · {l.ciudad}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>{l.nota}</span>
            </span>
            <span style={{ flex: '0 1 190px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-3)' }}>{l.interes}</span>
              <span style={{ fontSize: 11.5, fontWeight: 300, color: 'var(--faint)' }}>
                {l.origen} · {l.cuando}
              </span>
            </span>
            <span className={`${css.estado} ${CLASE_ESTADO[l.estado]}`}>{l.estado}</span>
            <span className={css.acciones}>
              <button type="button" className={`${css.btn} ${css.btnSm}`}>
                Contactada
              </button>
              <button type="button" className={`${css.btnLinea} ${css.btnSm}`}>
                Convertir en plaza
              </button>
            </span>
          </article>
        ))}
      </section>
    </div>
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
export function Contenido() {
  const [sel, setSel] = useState(CURSOS_AULA[0].id);
  const [publicadas, setPublicadas] = useState<Record<string, boolean>>({});
  const curso = CURSOS_AULA.find((c) => c.id === sel) ?? CURSOS_AULA[0];

  return (
    <div className={css.columna}>
      <p className={css.intro}>
        Todo lo que publiques aquí es lo que ven las terapeutas en Clases y material. Puedes dejarlo
        en borrador hasta que esté listo.
      </p>

      <section className={css.punteada} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'clamp(18px,2.4vw,30px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className={css.h2}>Subir una clase</h2>
          <label className={css.soltar}>
            <span className={css.soltarIcono}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4.5 19.5h15" />
              </svg>
            </span>
            <span style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.5, color: 'var(--ink-3)' }}>
              Arrastra el vídeo o el PDF
              <br />
              <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>
                MP4 hasta 4 GB · PDF hasta 50 MB
              </span>
            </span>
            <input type="file" style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <input placeholder="Título de la clase" aria-label="Título de la clase" className={css.campoCaja} />
          <select
            aria-label="Curso destino"
            className={css.campoCaja}
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            {CURSOS_AULA.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            placeholder="Qué se aprende en esta clase"
            aria-label="Qué se aprende en esta clase"
            className={css.campoCaja}
            style={{ resize: 'vertical' }}
          />
          <div className={css.acciones} style={{ marginTop: 4 }}>
            <button type="button" className={css.btn}>
              Publicar
            </button>
            <button type="button" className={css.btnLinea}>
              Guardar borrador
            </button>
          </div>
        </div>
      </section>

      <div className={css.chips}>
        {CURSOS_AULA.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSel(c.id)}
            aria-pressed={sel === c.id}
            className={`${css.chip} ${sel === c.id ? css.chipActivo : ''}`}
          >
            {c.titulo} · {ESTADO_CURSO[c.id]}
          </button>
        ))}
        <button type="button" className={css.chip} style={{ color: 'var(--oro)', borderStyle: 'dashed', borderColor: 'var(--oro-line)', background: 'transparent' }}>
          + Nuevo curso
        </button>
      </div>

      <section className={css.tarjeta}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 className={css.h2}>{curso.titulo}</h2>
          <span style={{ fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {curso.lecciones.length} lecciones · {ESTADO_CURSO[curso.id].toLowerCase()}
          </span>
        </div>

        {curso.lecciones.map((l, i) => {
          const clave = `${curso.id}:${i}`;
          const borradorPorDefecto =
            ESTADO_CURSO[curso.id] === 'Borrador' || i >= curso.lecciones.length - 1;
          const publicada = publicadas[clave] ?? !borradorPorDefecto;
          return (
            <div key={l.nombre} className={css.fila} style={{ gap: 14 }}>
              <span className={css.tirador} aria-hidden="true">
                ⠿
              </span>
              <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: 15, fontWeight: 300, color: 'var(--ink)' }}>
                {l.nombre}
              </span>
              <span style={{ flex: '0 0 auto', fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                {l.duracion}
              </span>
              <span className={`${css.estado} ${publicada ? css.estadoOro : css.estadoNeutro}`}>
                {publicada ? 'Publicada' : 'Borrador'}
              </span>
              <span className={css.acciones}>
                <button
                  type="button"
                  className={`${css.btnLinea} ${css.btnSm}`}
                  onClick={() => setPublicadas((p) => ({ ...p, [clave]: !publicada }))}
                >
                  {publicada ? 'Despublicar' : 'Publicar'}
                </button>
                <button type="button" className={`${css.btnLinea} ${css.btnSm}`} style={{ color: 'var(--muted)', borderColor: 'var(--line-3)' }}>
                  Editar
                </button>
              </span>
            </div>
          );
        })}
      </section>

      <section className={css.tarjetaOscura} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'clamp(18px,2.4vw,30px)', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <p style={{ margin: 0, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-inverse)' }}>
            Clase en vivo
          </p>
          <h2 className={css.h2} style={{ color: 'var(--inverse-ink)' }}>
            Programa la clase del mes
          </h2>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 300, lineHeight: 1.6, color: 'var(--on-inverse-2)', textWrap: 'pretty' }}>
            Pones tema, día y hora. A las miembros les llega el aviso y, al terminar, la grabación
            entra sola en el curso que elijas.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="Tema de la clase"
            aria-label="Tema de la clase"
            className={css.campoCaja}
            style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'var(--line-inverse-2)', color: 'var(--inverse-ink)' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <input
              type="date"
              aria-label="Día de la clase"
              className={css.campoCaja}
              style={{ flex: '1 1 140px', background: 'rgba(255,255,255,0.08)', borderColor: 'var(--line-inverse-2)', color: 'var(--inverse-ink)' }}
            />
            <input
              type="time"
              aria-label="Hora de la clase"
              className={css.campoCaja}
              style={{ flex: '1 1 110px', background: 'rgba(255,255,255,0.08)', borderColor: 'var(--line-inverse-2)', color: 'var(--inverse-ink)' }}
            />
          </div>
          <button type="button" className={css.btnClaro} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
            Programar y avisar
          </button>
        </div>
      </section>
    </div>
  );
}

/* ==========================================================================
   Ingresos y facturas (admin)
   ========================================================================== */
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

      <ListaFacturas facturas={FACTURAS_ADMIN} />
    </div>
  );
}
