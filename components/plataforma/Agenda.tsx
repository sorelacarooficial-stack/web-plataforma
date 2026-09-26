'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import css from './plataforma.module.css';
import CalendarioMes, { claveDia, inicioDeMes, primerDiaVisible } from './CalendarioMes';
/* Del calendario se usan aquí solo las tres clases que reparten el sitio entre
   él y la lista: la mitad del acuerdo la pone cada lado. */
import cal from './calendario.module.css';

/**
 * La agenda, la misma pantalla para todo el mundo.
 *
 * Aquí va lo que cada una tiene apuntado: sesiones con clientas, formaciones,
 * llamadas y reuniones. La usa Sorela y la usa cualquier terapeuta con acceso,
 * y es la misma pantalla a propósito: lo que necesita quien lleva una cabina es
 * exactamente lo que necesita Sorela, así que hacer dos habría sido mantener
 * dos.
 *
 * Que cada una vea solo la suya NO se decide aquí. Se decide en
 * `app/api/agenda`, que cuelga cada agenda de su persona —`usuarios/{uid}/
 * agenda`— y saca el identificador de la cookie firmada. Esta pantalla pide
 * «mi agenda» sin decir de quién, porque no tiene forma de pedir otra.
 *
 * No hay nada inventado. Si la lista sale vacía es que no hay nada apuntado,
 * y eso se dice con palabras en vez de enseñar una semana de mentira.
 *
 * Sobre la hora, que es donde esto se tuerce siempre: al servidor viaja
 * SIEMPRE un ISO (un instante exacto, sin ambigüedad) y en pantalla se pinta
 * con la hora del ordenador de quien mira. Así una cita creada a las 10:00 se
 * ve a las 10:00 en verano y en invierno, y el cambio de hora no la mueve.
 */

/* Los tipos se repiten aquí en vez de importarse de la ruta a propósito:
   importar de `app/api/agenda/route.ts` arrastraría firebase-admin al paquete
   del navegador. Si se añade un tipo allí, hay que añadirlo también aquí. */
const TIPOS = ['Sesión', 'Formación', 'Clase en vivo', 'Llamada', 'Reunión', 'Personal'] as const;
type Tipo = (typeof TIPOS)[number];

const ESTADOS = ['Pendiente', 'Hecho', 'Cancelado'] as const;
type Estado = (typeof ESTADOS)[number];

type Evento = {
  id: string;
  titulo: string;
  cuando: string | null;
  duracionMin: number;
  tipo: Tipo;
  lugar: string;
  nota: string;
  conQuien: string;
  telefono: string;
  estado: Estado;
  creado: string | null;
};

/* Se reutilizan los distintivos que ya tiene la plataforma: lo pendiente
   destaca porque es lo que hay que hacer, lo cancelado se apaga. */
const CLASE_ESTADO: Record<Estado, string> = {
  Pendiente: css.estadoTinta,
  Hecho: css.estadoNeutro,
  Cancelado: css.estadoApagado,
};

/* Los formateadores se crean una sola vez: montarlos dentro del render los
   volvería a construir en cada pintada, y no son baratos. */
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const DIA = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const DIA_CON_ANIO = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/* `claveDia` —el día natural en hora local, «2026-09-25»— vive en el calendario
   y se importa de allí: es la misma clave con la que se agrupan los días, con la
   que se marca uno en la cuadrícula y la que quiere un <input type="date">.
   Teniendo dos copias, bastaría con que cambiara una. */

/** Cuántos días hay de hoy a esa fecha: 0 hoy, 1 mañana, -1 ayer. */
function distanciaEnDias(d: Date): number {
  const hoy = new Date();
  const alli = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const aqui = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  // Se redondea porque los dos domingos del año en que cambia la hora, entre
  // dos medianoches seguidas hay 23 o 25 horas y la división no da un entero.
  return Math.round((alli - aqui) / 86400000);
}

/** «Hoy», «Mañana» o «Jueves 25 de septiembre». Una fecha suelta no sitúa. */
function etiquetaDia(d: Date): string {
  const dias = distanciaEnDias(d);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';

  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  // es-ES escribe los días de la semana en minúscula y mete una coma
  // («jueves, 25 de septiembre»). Como esto es un encabezado, se quita la coma
  // y se sube la primera letra.
  const texto = (mismoAnio ? DIA : DIA_CON_ANIO).format(d).replace(',', '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * La etiqueta de un día, metida dentro de una frase.
 *
 * «Hoy» y «Mañana» ya son complementos de tiempo y no llevan artículo; un día
 * con nombre, sí. Sin esto saldría «no tienes nada apuntado el hoy».
 */
function enFrase(etiqueta: string): string {
  const suelta = etiqueta === 'Hoy' || etiqueta === 'Mañana' || etiqueta === 'Ayer';
  return suelta ? etiqueta.toLowerCase() : `el ${etiqueta.toLowerCase()}`;
}

/** «10:00 – 11:00». La hora de fin sale de la duración, no se guarda aparte. */
function franja(inicio: Date, duracionMin: number): string {
  const fin = new Date(inicio.getTime() + duracionMin * 60000);
  return `${HORA.format(inicio)} – ${HORA.format(fin)}`;
}

/** Los minutos, dichos como los diría una persona. */
function duracionEnPalabras(min: number): string {
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/* El aspecto de un error de campo vive en `.errorCampo`, dentro de la hoja de
   estilos. Aquí había una copia en línea del mismo aspecto, y dos copias de lo
   mismo aguantan hasta que alguien cambia una. */

export default function Agenda({
  /**
   * Si quien mira es Sorela.
   *
   * Cambia una sola frase, la de la lista vacía, y por eso existe: las citas
   * que se piden desde la web caen en SU agenda, no en la de una terapeuta.
   * Prometerle a una terapeuta que la web le va a traer citas sería venderle
   * algo que esta plataforma no hace.
   *
   * No decide nada más. Los permisos los decide el servidor con la cookie, así
   * que cambiar esto desde el navegador solo cambia una frase.
   */
  esSorela = false,
}: {
  esSorela?: boolean;
}) {
  const [lista, setLista] = useState<Evento[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [verPasado, setVerPasado] = useState(false);

  /* El calendario: qué mes se está viendo y qué día está marcado. Viven aquí y
     no dentro del calendario porque los usan los dos: el mes decide hasta dónde
     hacia atrás se piden los eventos, y el día marcado decide qué enseña la
     lista de abajo y qué fecha lleva puesta el formulario. */
  const [mes, setMes] = useState(() => inicioDeMes(new Date()));
  const [seleccion, setSeleccion] = useState<string | null>(null);

  /* El formulario de crear. Cada campo por separado en vez de un objeto: son
     cuatro líneas más, pero se lee de un vistazo cuál se está tocando. */
  const [titulo, setTitulo] = useState('');
  const [dia, setDia] = useState(() => claveDia(new Date()));
  const [hora, setHora] = useState('10:00');
  const [duracion, setDuracion] = useState('60');
  const [tipo, setTipo] = useState<Tipo>('Sesión');
  const [conQuien, setConQuien] = useState('');
  const [telefono, setTelefono] = useState('');
  const [lugar, setLugar] = useState('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});
  const [guardando, setGuardando] = useState(false);

  /* Cada carga lleva número de turno. El chip de lo pasado cambia la petición
     que se hace, así que pulsándolo dos veces seguidas hay dos en el aire, y no
     tienen por qué contestar en orden: si la primera llega la última, pinta la
     lista del filtro que ya no está puesto y no hay nada que lo delate. Solo se
     hace caso a la respuesta del último turno pedido. */
  const turno = useRef(0);

  /**
   * Desde qué día hay que pedirle los eventos al servidor.
   *
   * Por defecto devuelve de hoy en adelante, y eso deja al calendario
   * mintiendo: los días ya pasados del mes saldrían siempre vacíos aunque
   * hubiera habido tres sesiones. Cuando el mes que se está viendo empieza
   * antes de hoy, se le pide que retroceda hasta ahí.
   *
   * Se guarda como texto «2026-08-31» y no como Date a propósito: un Date nuevo
   * en cada pintada cambiaría de identidad, y con él `cargar`, así que el efecto
   * que depende de ella volvería a pedir la agenda sin parar. El texto solo
   * cambia cuando cambia el mes de verdad.
   */
  const desde = useMemo(() => {
    const primero = primerDiaVisible(mes);
    return distanciaEnDias(primero) < 0 ? claveDia(primero) : null;
  }, [mes]);

  const cargar = useCallback(async () => {
    const mio = ++turno.current;
    setFallo(null);
    try {
      const consulta = verPasado ? '?todos=1' : desde ? `?desde=${desde}` : '';
      const r = await fetch(`/api/agenda${consulta}`);
      const c = await r.json().catch(() => ({ ok: false }));
      if (mio !== turno.current) return;
      if (!c.ok) {
        setFallo(
          c.motivo === 'sin-configurar'
            ? 'Falta la configuración de Firebase en el servidor.'
            : /* La sesión dura cinco días: quien deja la pestaña abierta más
                 tiempo se encuentra esto, y «no he podido cargar» le haría
                 recargar en vano. Se le dice lo único que arregla el problema. */
              c.motivo === 'sin-sesion'
              ? 'Se ha cerrado la sesión. Vuelve a entrar para ver tu agenda.'
              : 'No he podido cargar la agenda.'
        );
        setLista([]);
        return;
      }
      setLista(c.eventos);
    } catch {
      if (mio !== turno.current) return;
      setFallo('No hay conexión con el servidor.');
      setLista([]);
    }
  }, [verPasado, desde]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setErrores({});
    setFallo(null);

    /* El día y la hora vienen en dos campos y hay que juntarlos. Se hace SIN
       indicar zona —«2026-09-25T10:00»—, porque así JavaScript lo entiende
       como la hora del reloj de quien escribe, que es la que Sorela quiere
       decir. Esta es la trampa: con la fecha sola —«2026-09-25»— lo leería
       como UTC y la cita aparecería dos horas antes en verano. */
    const local = dia && hora ? new Date(`${dia}T${hora}`) : null;
    const cuando = local && !Number.isNaN(local.getTime()) ? local.toISOString() : '';

    try {
      const r = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          cuando,
          duracionMin: duracion,
          tipo,
          conQuien,
          telefono,
          lugar,
          nota,
        }),
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setErrores(c.errores ?? {});
        // Si el servidor no dice qué campo falla, es que el problema no está
        // en lo escrito: se avisa arriba, donde se ven los fallos generales.
        if (!c.errores || Object.keys(c.errores).length === 0) {
          setFallo('No he podido guardar el evento.');
        }
        return;
      }

      // Se vacía lo que cambia de un evento a otro, pero el día, la hora y el
      // tipo se quedan puestos: apuntar tres sesiones del mismo martes es lo
      // normal, y volver a escribir la fecha cada vez cansa.
      setTitulo('');
      setConQuien('');
      setTelefono('');
      setLugar('');
      setNota('');

      /* El calendario se va al día que se acaba de apuntar y lo marca. Apuntar
         algo de ayer —una sesión que se olvidó meter— se guarda bien, pero la
         lista empieza en hoy: sin esto el evento no saldría por ningún lado y
         parecería que no se ha guardado.

         Si el salto cambia el mes hacia atrás, `desde` cambia y el efecto
         lanzará su propia carga además de esta. Son dos peticiones en vez de
         una, pero cada carga lleva número de turno y solo se pinta la del
         último: no hay forma de que gane la equivocada. */
      if (local && !Number.isNaN(local.getTime())) {
        setSeleccion(claveDia(local));
        setMes(inicioDeMes(local));
      }
      await cargar();
    } catch {
      setFallo('No hay conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  async function marcar(id: string, estado: Estado) {
    const antes = lista;
    // Se pinta antes de que conteste el servidor: para repasar la mañana
    // entera marcando lo hecho, esperar a cada respuesta es insufrible.
    setLista((l) => l?.map((ev) => (ev.id === id ? { ...ev, estado } : ev)) ?? l);
    try {
      const r = await fetch('/api/agenda', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      // Si un intento anterior dejó el aviso puesto, este acierto lo retira:
      // si no, se queda en pantalla diciendo que algo falló cuando ya no falla.
      setFallo(null);
    } catch {
      // Se deshace y se avisa: dejar la pantalla diciendo «hecho» cuando no se
      // ha guardado es peor que no haber dejado pulsar.
      setLista(antes ?? null);
      setFallo('No se ha podido guardar el cambio. Vuelve a intentarlo.');
    }
  }

  async function borrar(evento: Evento) {
    // Se pregunta porque esto no tiene papelera: lo borrado no vuelve.
    if (!window.confirm(`¿Borrar «${evento.titulo}»? No se puede deshacer.`)) return;

    const antes = lista;
    setLista((l) => l?.filter((ev) => ev.id !== evento.id) ?? l);
    try {
      const r = await fetch(`/api/agenda?id=${encodeURIComponent(evento.id)}`, { method: 'DELETE' });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      setFallo(null);
    } catch {
      setLista(antes ?? null);
      setFallo('No se ha podido borrar. Vuelve a intentarlo.');
    }
  }

  /**
   * Los eventos repartidos por días.
   *
   * El servidor ya los manda ordenados de más cercano a más lejano, y un Map
   * conserva el orden en que se van metiendo las claves: por eso no hace falta
   * volver a ordenar nada aquí.
   */
  const dias = useMemo(() => {
    const grupos = new Map<string, { fecha: Date; eventos: Evento[] }>();
    for (const ev of lista ?? []) {
      if (!ev.cuando) continue;
      const fecha = new Date(ev.cuando);
      if (Number.isNaN(fecha.getTime())) continue;
      const clave = claveDia(fecha);
      const grupo = grupos.get(clave);
      if (grupo) grupo.eventos.push(ev);
      else grupos.set(clave, { fecha, eventos: [ev] });
    }
    return [...grupos.values()];
  }, [lista]);

  /**
   * Los días que se enseñan al lado del calendario.
   *
   * Si hay un día marcado, solo ese: es lo que se ha pedido al pulsarlo. Si no,
   * de hoy en adelante, que es para lo que sirve una agenda; lo de antes solo
   * si se pide expresamente.
   *
   * El filtro se hace aquí y no en el servidor porque el calendario necesita
   * los días pasados del mes para pintar sus puntos aunque la lista no los
   * enseñe. Una sola petición sirve a los dos.
   */
  const diasVisibles = useMemo(() => {
    if (seleccion) return dias.filter((d) => claveDia(d.fecha) === seleccion);
    if (verPasado) return dias;
    return dias.filter((d) => distanciaEnDias(d.fecha) >= 0);
  }, [dias, seleccion, verPasado]);

  /* La fecha marcada se lee con la hora puesta —«2026-09-25T12:00»— para que
     JavaScript la entienda en hora local. Con la fecha sola la leería como UTC
     y en España saldría el día anterior. */
  const diaMarcado = seleccion ? etiquetaDia(new Date(`${seleccion}T12:00`)) : null;

  /** Marcar un día en el calendario, o quitarle la marca. */
  function elegirDia(clave: string | null) {
    setSeleccion(clave);
    // El formulario de abajo se queda apuntando a ese mismo día: pulsar el 12 y
    // escribir ya guarda en el 12, sin volver a tocar la fecha.
    if (clave) setDia(clave);
  }

  const resumen = useMemo(() => {
    const ahora = Date.now();
    // flatMap en vez de filter: así el tipo de `t` ya es un número y no hay
    // que jurarle a TypeScript que `cuando` no es nulo más abajo.
    const conFecha = (lista ?? []).flatMap((ev) =>
      ev.cuando ? [{ ev, t: new Date(ev.cuando).getTime() }] : []
    );
    const hoy = conFecha.filter(
      (x) => distanciaEnDias(new Date(x.t)) === 0 && x.ev.estado !== 'Cancelado'
    );
    const porDelante = conFecha.filter((x) => x.t >= ahora && x.ev.estado === 'Pendiente');
    const semana = porDelante.filter((x) => x.t - ahora < 7 * 86400000);

    return [
      // Las tres notas dicen exactamente lo que cuenta cada número: «Hoy» sí
      // incluye lo ya hecho —es lo que tienes en el día, hayas pasado por ello
      // o no—, y las otras dos solo lo pendiente, sin lo hecho ni lo cancelado.
      { label: 'Hoy', valor: String(hoy.length), nota: 'todo lo del día, hecho o no' },
      { label: 'Próximos 7 días', valor: String(semana.length), nota: 'solo lo que sigue pendiente' },
      { label: 'Por delante', valor: String(porDelante.length), nota: 'todo lo pendiente de aquí en adelante' },
    ];
  }, [lista]);

  if (lista === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando la agenda…</p>
      </div>
    );
  }

  return (
    <div className={css.columna}>
      <div className={css.rejillaKpis}>
        {resumen.map((k) => (
          <article key={k.label} className={css.kpi}>
            <span className={css.kpiValor}>{k.valor}</span>
            <span className={css.kpiLabel}>{k.label}</span>
            <span className={css.kpiNota}>{k.nota}</span>
          </article>
        ))}
      </div>

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={css.btnLinea} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}

      <div className={cal.doble}>
        <div className={cal.lado}>
          <CalendarioMes
            eventos={lista}
            seleccion={seleccion}
            onSeleccionar={elegirDia}
            mes={mes}
            onCambiarMes={setMes}
          />
        </div>

        <div className={cal.listaLado}>
          <div className={css.chips}>
            {diaMarcado ? (
              <>
                {/* El día marcado se dice con palabras y no solo con el recuadro
                    del calendario: la lista de al lado está filtrada por él, y
                    conviene verlo sin tener que mirar arriba. */}
                <button
                  type="button"
                  onClick={() => elegirDia(null)}
                  className={`${css.chip} ${css.chipActivo}`}
                >
                  {diaMarcado} ✕
                </button>
                <span className={css.apunte}>Pulsa para volver a verlo todo.</span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setVerPasado((v) => !v)}
                aria-pressed={verPasado}
                className={`${css.chip} ${verPasado ? css.chipActivo : ''}`}
              >
                Ver también lo pasado
              </button>
            )}
          </div>

          {diasVisibles.length === 0 ? (
            <section className={css.tarjeta}>
              <p className={css.vacioTexto}>
                {diaMarcado
                  ? `No tienes nada apuntado ${enFrase(diaMarcado)}. Puedes apuntarlo aquí abajo: la fecha ya está puesta.`
                  : /* Por defecto la lista empieza en hoy, así que «no hay nada»
                       podría querer decir «no hay nada de hoy en adelante». Se
                       dice dónde mirar en vez de dejar creer que está vacía. */
                    `No tienes nada apuntado. ${
                      esSorela
                        ? 'Lo que crees aquí y las citas que te pidan desde la web aparecerán en esta lista.'
                        : 'Lo que apuntes aquí abajo aparecerá en esta lista.'
                    }${verPasado ? '' : ' Si buscas algo de antes, pulsa «Ver también lo pasado».'}`}
              </p>
            </section>
          ) : (
            diasVisibles.map((d) => (
              <section key={claveDia(d.fecha)} className={css.tarjeta}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <h2 className={css.h3}>{etiquetaDia(d.fecha)}</h2>
                  <span className={css.apunte}>
                    {d.eventos.length === 1 ? '1 cosa apuntada' : `${d.eventos.length} cosas apuntadas`}
                  </span>
                </div>

                {d.eventos.map((ev) => {
                  const inicio = new Date(ev.cuando as string);
                  const hecho = ev.estado === 'Hecho';
                  return (
                    <article key={ev.id} className={css.fila} style={{ padding: '16px 0', gap: 14 }}>
                      <span style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span className={css.citaHora}>{franja(inicio, ev.duracionMin)}</span>
                        <span
                          style={{
                            fontSize: 15.5,
                            color: 'var(--ink)',
                            // Tachado cuando ya está hecho: de un vistazo se ve
                            // qué queda por delante sin tener que leer la etiqueta.
                            textDecoration: hecho ? 'line-through' : 'none',
                          }}
                        >
                          {ev.titulo}
                        </span>
                        {(ev.conQuien || ev.lugar) && (
                          <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                            {[ev.conQuien, ev.lugar].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {ev.nota && (
                          <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--ink-3)' }}>«{ev.nota}»</span>
                        )}
                      </span>

                      <span style={{ flex: '0 1 150px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-3)' }}>{ev.tipo}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 300, color: 'var(--faint)' }}>
                          {duracionEnPalabras(ev.duracionMin)}
                          {ev.telefono && ` · ${ev.telefono}`}
                        </span>
                      </span>

                      <span className={`${css.estado} ${CLASE_ESTADO[ev.estado]}`}>{ev.estado}</span>

                      <span className={css.acciones}>
                        {ev.telefono && (
                          <a
                            className={`${css.btn} ${css.btnSm}`}
                            href={`https://wa.me/${ev.telefono.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            WhatsApp
                          </a>
                        )}
                        <button
                          type="button"
                          className={css.btnLinea}
                          onClick={() => marcar(ev.id, hecho ? 'Pendiente' : 'Hecho')}
                        >
                          {hecho ? 'Volver a pendiente' : 'Marcar hecho'}
                        </button>
                        <button type="button" className={css.enlaceAccion} onClick={() => borrar(ev)}>
                          Borrar
                        </button>
                      </span>
                    </article>
                  );
                })}
                  </section>
            ))
          )}
        </div>
      </div>

      <section className={css.punteada}>
        <form onSubmit={crear} className={css.columna} style={{ gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p className={css.rotuloSeccion}>Apuntar algo</p>
            <p className={css.apunte}>
              Una sesión, una formación, una llamada o lo que sea. Solo lo ves tú.
            </p>
          </div>

          <label className={css.etiquetaCampo}>
            Qué es
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              /* El ejemplo no lleva nombre propio a posta: un «Sesión con
                 María» de muestra, en un panel donde todavía no hay nadie, se
                 lee como una clienta que existe. */
              placeholder="Sesión, revisión de la formación, llamada…"
              className={css.campoCaja}
            />
            {errores.titulo && (
              <span className={css.errorCampo} role="alert">
                {errores.titulo}
              </span>
            )}
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
            <label className={css.etiquetaCampo}>
              Día
              <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className={css.campoCaja} />
            </label>
            <label className={css.etiquetaCampo}>
              Hora
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={css.campoCaja} />
            </label>
            <label className={css.etiquetaCampo}>
              Cuánto dura (min)
              <input
                type="number"
                min={5}
                step={5}
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
                className={css.campoCaja}
              />
              {errores.duracionMin && (
                <span className={css.errorCampo} role="alert">
                  {errores.duracionMin}
                </span>
              )}
            </label>
            <label className={css.etiquetaCampo}>
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} className={css.campoCaja}>
                {TIPOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          {/* El error de la fecha va aquí abajo y no dentro de un campo: se
              monta con dos —día y hora—, así que no es culpa de ninguno. */}
          {errores.cuando && (
            <span className={css.errorCampo} role="alert">
              {errores.cuando}
            </span>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            <label className={css.etiquetaCampo}>
              Con quién
              <input
                value={conQuien}
                onChange={(e) => setConQuien(e.target.value)}
                placeholder="Nombre de la persona"
                className={css.campoCaja}
              />
            </label>
            <label className={css.etiquetaCampo}>
              Teléfono
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+34 600 00 00 00"
                className={css.campoCaja}
              />
            </label>
            <label className={css.etiquetaCampo}>
              Dónde
              <input
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="Cabina, Zoom, casa de la clienta…"
                className={css.campoCaja}
              />
            </label>
          </div>

          <label className={css.etiquetaCampo}>
            Nota
            <textarea
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Lo que quieras recordar antes de entrar."
              className={css.campoCaja}
              style={{ resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <button type="submit" className={css.btn} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Apuntar en la agenda'}
            </button>
            <span className={css.apunte}>
              Si pones el teléfono, te sale el botón de WhatsApp en la ficha del evento.
            </span>
          </div>
        </form>
      </section>
    </div>
  );
}
