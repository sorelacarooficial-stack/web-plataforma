'use client';

import { useEffect, useState } from 'react';
/*
 * De lib/plataforma solo se trae lo que se usa.
 *
 * Aquí se importaban treinta y cuatro cosas —clientas, facturas, KPIs, la
 * semana, los tratamientos del perfil— porque este fichero tenía once pantallas
 * de maqueta. Al retirarlas, los nombres se quedaron: TypeScript no se queja de
 * un import sin usar, así que nada lo delataba. Importar una lista de mentira
 * es la mitad del camino para volver a pintarla, y ese camino ya se ha andado
 * una vez.
 *
 * También se fueron las cuatro fotos del aula y el mapa FOTOS que las repartía:
 * no las miraba nadie, pero Next seguía metiéndolas en el paquete.
 */
import {
  CONVOCATORIAS,
  FILTROS_FEED,
  PENDIENTE_BETA,
  POSTS,
  RANKING,
  type Factura,
  type Rol,
  type Vista,
} from '@/lib/plataforma';
import css from './plataforma.module.css';

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
        {/* Aquí había un cuadro de escribir con su botón de «Publicar». No
            guardaba nada: se escribía, se pulsaba y el texto se perdía sin
            decir nada. Se retira hasta que haya dónde guardarlo. */}
        {!deVisita && (
          <section className={css.aviso} role="note">
            <p className={css.parrafo} style={{ margin: 0, flex: '1 1 320px' }}>
              <strong>Todavía no se puede escribir aquí.</strong> La comunidad está a medio montar:
              cuando abra, esto será donde publiques tus casos y donde te contesten.
            </p>
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
      {/* Aquí había un botón de «Nueva convocatoria» que no guardaba nada:
          se pulsaba, no pasaba nada, y no lo decía. Un botón que miente es
          peor que un hueco, porque el hueco no se cree nadie. Vuelve cuando
          haya dónde guardar la convocatoria. */}
      <p className={css.intro} style={{ maxWidth: 560 }}>
        Cada convocatoria con sus plazas vendidas, lo cobrado y quién falta por pagar.
      </p>

      <div className={css.aviso} role="note">
        <p className={css.parrafo} style={{ margin: 0, flex: '1 1 320px' }}>
          <strong>Esta pantalla todavía no guarda nada.</strong> Está preparada para cuando cierres
          la primera fecha: entonces podrás crear la convocatoria aquí, con sus plazas y sus pagos.
          Mientras tanto, quien pida sitio te llega a <em>Clientes</em>.
        </p>
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

      {/* Aquí había un bloque «Tu calendario» que salía siempre vacío: leía una
          lista escrita a mano en lib/plataforma.ts, no la agenda de verdad. Con
          la semana llena de sesiones seguía diciendo «sin nada apuntado», y eso
          es peor que no estar. El calendario está en su apartado. */}
    </div>
  );
}

/*
 * Aquí vivían nueve pantallas más: InicioAlumna, Aula, InicioMiembro, Clases,
 * Clientas, Facturacion, Agenda, Perfil, Suscripcion, Pagos y
 * FacturacionAdmin. Eran la maqueta del prototipo y ninguna estaba enrutada:
 * nadie las veía.
 *
 * Se retiran enteras, y no por limpieza. Seguían siendo importables, y eso ya
 * ha pasado una vez: basta con que alguien enrute una por error para que
 * vuelva un decorado —clientas inventadas, facturas de mentira, un aula de
 * adorno— encima de las pantallas que sí funcionan. Lo que hace cada una está
 * hecho de verdad en su propio fichero: Contactos, AgendaSorela,
 * FacturacionSorela, Cuentas, Aula y SubirClases.
 */
