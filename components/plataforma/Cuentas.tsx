'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ETIQUETA_ROL, type Rol } from '@/lib/roles';
import { clave } from '@/lib/aula';
import { CURSO_DIVINE, cursosDe, tieneMembresia, type Acceso } from '@/lib/accesos';
import Invitaciones from './Invitaciones';
import css from './plataforma.module.css';

/**
 * Quién tiene cuenta y qué tiene contratado.
 *
 * Las cuentas nuevas entran SOLO por enlace de invitación (arriba, en
 * Invitaciones): Sorela crea el enlace, se lo manda, y la persona se hace la
 * cuenta con su contraseña y entra ya con lo que se le dio. Aquí había además
 * un formulario «Dar de alta una cuenta» que creaba la cuenta con una
 * contraseña al azar y un enlace para cambiarla; se quita porque hacía lo
 * mismo por un camino más largo y Sorela prefiere uno solo.
 *
 * Desde aquí se da o se quita la comunidad, se bloquea o se borra una cuenta.
 * No hay nada inventado: la lista es la que hay en Firestore.
 */
type Cuenta = {
  uid: string;
  correo: string | null;
  nombre: string | null;
  rol: Rol | null;
  /** Qué ha contratado: la comunidad, uno o varios cursos, o las dos cosas. */
  accesos: Acceso[];
  ultimoAcceso: string | null;
  /** Está en ADMIN_CORREOS: ni se borra ni se le cambia el rol. */
  protegida: boolean;
  /**
   * Puede entrar pero no tiene ficha en Firestore.
   *
   * Pasa si un alta falló a medias o si la cuenta se creó desde la consola de
   * Firebase. Antes estas cuentas no salían en la lista, que es lo peor que
   * les podía pasar: ocupaban el correo, impedían volver a dar de alta a esa
   * persona y no había forma de borrarlas desde aquí.
   */
  sinFicha: boolean;
  /** Se creó la cuenta ella desde la web, no se la diste tú. */
  seRegistro: boolean;
  /** A qué dijo que venía al registrarse. Null si la diste de alta tú. */
  pide: 'comunidad' | 'curso' | null;
  /** No puede entrar: la bloqueaste. Su cuenta y lo que tenga siguen ahí. */
  bloqueada?: boolean;
  /** Cómo llegó a tener cuenta. */
  llego?: 'registro' | 'invitacion' | 'tu' | null;
  creado?: string | null;
};

/** «hace 3 h», «ayer», «12 oct». Una fecha completa no dice nada de un vistazo. */
function cuando(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

/*
 * Aquí había un ESTILO_ERROR: un objeto de estilos en línea que repetía campo
 * por campo lo que ya hace `.errorCampo` en plataforma.module.css, añadida
 * justo para esto. Dos definiciones del mismo aspecto aguantan hasta que
 * alguien cambia una.
 */

/**
 * El pequeño destello del sello de la comunidad.
 *
 * Va en SVG y no como emoji ni como carácter: un emoji lo pinta cada sistema
 * con su propio dibujo y su propio color, y aquí tiene que ser del oro de la
 * marca y del mismo tamaño en todas partes.
 */
function Destello() {
  return (
    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true" focusable="false">
      {/* Cuatro puntas que se estrechan hacia el centro: un brillo, no una
          estrella de cinco puntas, que se lee como «favorito». */}
      <path
        d="M6 0c.5 3.2 2.3 5 5.5 6-3.2 1-5 2.8-5.5 6-.5-3.2-2.3-5-5.5-6 3.2-1 5-2.8 5.5-6z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * El dibujo del vacío de la lista: dos personas cuando solo estás tú, y una
 * exclamación cuando la lista no se ha podido leer. Trazo fino y del color
 * del texto, para que lo pinte el círculo que lo envuelve (.vacioIcono).
 */
function IconoVacio({ tipo }: { tipo: 'personas' | 'fallo' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {tipo === 'personas' ? (
        <>
          <circle cx="9" cy="8.5" r="3.2" />
          <path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5" />
          <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.6 14.3c1.6.6 2.6 2.2 2.9 4.7" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.6v5.2" />
          <path d="M12 16.3v.1" strokeWidth="2.2" />
        </>
      )}
    </svg>
  );
}

export default function Cuentas() {
  const [lista, setLista] = useState<Cuenta[] | null>(null);
  const [yo, setYo] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  /* El menú «Gestionar» abierto (uid), la cuenta que se está a punto de
     borrar y el aviso de lo último que se ha hecho. */
  const [gestion, setGestion] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<Cuenta | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  /* Si la plataforma deja entrar a alguien más que a las administradoras.
     Se pregunta al servidor en vez de importar PLATAFORMA_ABIERTA aquí, que
     también compilaría: el que decide quién entra es lib/sesion-servidor.ts, y
     que la respuesta salga del mismo sitio que la decisión evita que un día la
     pantalla diga «ya puede entrar» mientras la puerta sigue cerrada. Arranca
     en false, que es lo prudente: si la carga falla, se avisa de más. */
  const [abierta, setAbierta] = useState(false);

  /** Si la lista viene recortada por el tope del servidor. */
  const [recortada, setRecortada] = useState(false);
  /** Si el servidor no ha podido leer las cuentas de acceso. */
  const [sinAuth, setSinAuth] = useState(false);

  /* Cada carga lleva su número de turno. Recargar dos veces seguidas —al crear
     una cuenta se recarga, y el botón de Reintentar también— deja dos
     peticiones en el aire, y no tienen por qué contestar en orden: si la
     primera llega la última, pinta una lista vieja y nada lo delata. */
  const turno = useRef(0);

  const cargar = useCallback(async () => {
    const mio = ++turno.current;
    setFallo(null);
    try {
      const r = await fetch('/api/usuarios');
      const c = await r.json().catch(() => ({ ok: false }));
      if (mio !== turno.current) return;
      if (!c.ok) {
        setFallo(
          c.motivo === 'sin-configurar'
            ? 'Falta la configuración de Firebase en el servidor.'
            : c.motivo === 'sin-permiso'
              ? 'Las cuentas solo las ve Sorela.'
              : 'No he podido cargar las cuentas.'
        );
        setLista([]);
        return;
      }
      setLista(c.usuarios);
      setYo(c.yo ?? null);
      setAbierta(Boolean(c.plataformaAbierta));
      setRecortada(Boolean(c.recortada));
      setSinAuth(Boolean(c.sinAuth));
    } catch {
      if (mio !== turno.current) return;
      setFallo('No hay conexión con el servidor.');
      setLista([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /**
   * Dar o quitar la comunidad a alguien que ya tiene cuenta.
   *
   * Se manda la lista entera de accesos y no «quítale la membresía»: el
   * servidor guarda lo que le llega, así que mandar el conjunto completo evita
   * que dos cambios a la vez desde dos sitios se pisen a medias y dejen a esa
   * persona con un acceso que nadie le dio.
   */
  async function cambiarMembresia(c: Cuenta, dar: boolean) {
    await guardarAccesos(
      c,
      dar
        ? [...c.accesos.filter((a) => a.tipo !== 'membresia'), { tipo: 'membresia' as const }]
        : c.accesos.filter((a) => a.tipo !== 'membresia')
    );
  }

  /**
   * Dar o quitar la formación. Sirve sobre todo para quien se registró sola:
   * paga, se hace la cuenta, y Sorela le abre las clases con un clic.
   */
  async function cambiarFormacion(c: Cuenta, dar: boolean) {
    const otros = c.accesos.filter((a) => !(a.tipo === 'curso' && clave(a.nombre) === clave(CURSO_DIVINE)));
    await guardarAccesos(c, dar ? [...otros, { tipo: 'curso' as const, nombre: CURSO_DIVINE }] : otros);
  }

  async function guardarAccesos(c: Cuenta, nuevos: Acceso[]) {
    /* Se guarda SOLO lo de esta persona, no la lista entera.
       Guardando la lista entera y restaurándola al fallar, un error aquí
       borraba de la pantalla los cambios que se hubieran guardado bien
       mientras tanto en otras filas: la persona volvía a ver una foto vieja y
       no había forma de saber cuál de los dos estados era el real. */
    const accesosAntes = c.accesos;

    setLista((l) => l?.map((x) => (x.uid === c.uid ? { ...x, accesos: nuevos } : x)) ?? l);
    try {
      const r = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: c.uid, accesos: nuevos }),
      });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      setFallo(null);
    } catch {
      setLista((l) => l?.map((x) => (x.uid === c.uid ? { ...x, accesos: accesosAntes } : x)) ?? l);
      setFallo('No se ha podido cambiar. Vuelve a intentarlo.');
    }
  }

  /**
   * Bajar a miembro una cuenta que tiene rol de administradora sin estar en la
   * lista del servidor.
   *
   * Aquí había un desplegable de rol en cada fila. Con dos roles, sus dos
   * opciones eran «Miembro» y «Sorela (admin)», pegadas la una a la otra: un
   * clic de más en la fila equivocada daba a esa persona todos los contactos,
   * la facturación y el botón de borrar cuentas, sin preguntar y sin decir lo
   * que significaba. Quién es administradora lo decide ADMIN_CORREOS en el
   * servidor, y ahora el servidor lo hace cumplir.
   *
   * Lo que queda es esto, que solo aparece en la anomalía —rol de admin sin
   * estar en la lista— y solo sabe bajar. Subir no se puede desde ninguna
   * pantalla, a propósito.
   */
  async function quitarAdmin(c: Cuenta) {
    const quien = c.nombre || c.correo || 'esta cuenta';
    if (
      !window.confirm(
        `¿Quitarle el acceso de administradora a ${quien}? Dejará de ver los contactos y la facturación, y tendrá que volver a entrar.`
      )
    ) {
      return;
    }

    const rolAntes = c.rol;
    setLista((l) => l?.map((x) => (x.uid === c.uid ? { ...x, rol: 'miembro' } : x)) ?? l);
    try {
      const r = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: c.uid, rol: 'miembro' }),
      });
      const respuesta = await r.json().catch(() => ({ ok: false }));
      if (!respuesta.ok) throw new Error(respuesta.motivo);
      setFallo(null);
    } catch (e) {
      // Se deshace solo esta fila, no la lista entera: restaurar la lista
      // borraría de la pantalla lo que se hubiera guardado bien mientras tanto.
      setLista((l) => l?.map((x) => (x.uid === c.uid ? { ...x, rol: rolAntes } : x)) ?? l);
      setFallo(
        (e as Error).message === 'admin-protegida'
          ? 'Ese correo está en la lista de administradoras del servidor: para quitarle el acceso hay que sacarlo de ahí.'
          : 'No se ha podido cambiar el rol. Vuelve a intentarlo.'
      );
    }
  }

  /** Quitarle todo lo que tiene (formación y comunidad) sin tocar su cuenta. */
  async function quitarTodo(c: Cuenta) {
    const quien = c.nombre || c.correo || 'esta persona';
    if (
      !window.confirm(
        `¿Quitar todo el acceso a ${quien}? Dejará de ver las clases y la comunidad, pero su cuenta sigue: podrá entrar y verá que no tiene nada abierto. Se puede volver a dar cuando quieras.`
      )
    )
      return;
    await guardarAccesos(c, []);
    setHecho(`${quien} ya no tiene acceso a nada.`);
  }

  /**
   * Bloquear o desbloquear la entrada. Bloqueada no puede entrar ni con su
   * contraseña, y si estaba dentro se la saca; no se borra nada.
   */
  async function bloquear(c: Cuenta, bloqueada: boolean) {
    const quien = c.nombre || c.correo || 'esta persona';
    if (
      bloqueada &&
      !window.confirm(
        `¿Bloquear la entrada a ${quien}? No podrá entrar en la plataforma (si está dentro, la saca ahora). No se borra nada: lo desbloqueas cuando quieras y todo sigue como estaba.`
      )
    )
      return;
    setLista((l) => l?.map((x) => (x.uid === c.uid ? { ...x, bloqueada } : x)) ?? l);
    try {
      const r = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: c.uid, bloqueada }),
      });
      const j = await r.json().catch(() => ({ ok: false }));
      if (!j.ok) throw new Error(j.motivo);
      setFallo(null);
      setHecho(bloqueada ? `${quien} ya no puede entrar.` : `${quien} puede volver a entrar.`);
    } catch (e) {
      setLista((l) => l?.map((x) => (x.uid === c.uid ? { ...x, bloqueada: !bloqueada } : x)) ?? l);
      setFallo(
        (e as Error).message === 'admin-protegida'
          ? 'A una administradora no se la puede bloquear.'
          : 'No se ha podido cambiar. Vuelve a intentarlo.'
      );
    }
  }

  async function borrar(cuenta: Cuenta) {
    const quien = cuenta.nombre || cuenta.correo || 'esta cuenta';
    setABorrar(null);

    /* Se guarda la fila y su sitio, no la lista entera: al fallar se vuelve a
       meter donde estaba, sin tocar lo demás. */
    const donde = lista?.findIndex((c) => c.uid === cuenta.uid) ?? -1;
    setLista((l) => l?.filter((c) => c.uid !== cuenta.uid) ?? l);
    try {
      const r = await fetch(`/api/usuarios?uid=${encodeURIComponent(cuenta.uid)}`, {
        method: 'DELETE',
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) throw new Error(c.motivo);
      setFallo(null);
      setHecho(`La cuenta de ${quien} está borrada.`);
    } catch (e) {
      const motivo = (e as Error).message;
      setLista((l) => {
        if (!l || l.some((c) => c.uid === cuenta.uid)) return l;
        const vuelta = [...l];
        vuelta.splice(donde < 0 ? vuelta.length : donde, 0, cuenta);
        return vuelta;
      });
      setFallo(
        motivo === 'admin-protegida'
          ? 'A una administradora no se la puede borrar.'
          : motivo === 'uno-mismo'
            ? 'No puedes borrar tu propia cuenta.'
            : motivo === 'ficha-suelta'
              ? 'La cuenta se ha borrado, pero su ficha sigue guardada. Vuelve a pulsar Borrar.'
              : 'No se ha podido borrar. Vuelve a intentarlo.'
      );
      // En el caso de la ficha suelta la cuenta YA no existe: si no se recarga,
      // la lista seguiría enseñándola como si nada hubiera pasado.
      if (motivo === 'ficha-suelta') await cargar();
    }
  }

  if (lista === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando las cuentas…</p>
      </div>
    );
  }

  /*
   * Si no hay nadie más que quien está mirando.
   *
   * Con `every` y no con la longitud, que daría el mensaje equivocado el día
   * que la única ficha de la lista fuera la de otra persona. Y colgado de que
   * la carga haya ido bien: al fallar se vacía la lista, y `every` sobre una
   * lista vacía devuelve true, así que la pantalla afirmaba «ahora mismo solo
   * está tu cuenta» sobre unos datos que no había llegado a leer.
   */
  const soloYo = !fallo && lista.every((c) => c.uid === yo);

  return (
    <div className={css.columna}>
      {/* El registro público está cerrado, y eso es lo que hace que esta
          pantalla importe: aquí se decide quién entra y quién no. Antes este
          aviso decía que la cuenta nueva «todavía no podrá entrar» y nombraba
          una variable del código; ya no es verdad ni hace falta. */}
      {/* La forma normal de dar acceso: un enlace de un solo uso. */}
      <Invitaciones />

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={css.btnLinea} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}


      {/* Si el servidor no ha podido leer las cuentas de acceso, la lista puede
          estar incompleta sin que se note: se dice, porque una cuenta que no
          sale es una cuenta que no se puede quitar. */}
      {sinAuth && !fallo && (
        <p className={css.apunte} role="note">
          No he podido leer las cuentas de acceso de Firebase: aquí sale lo guardado en la base de
          datos, y puede faltar alguna.
        </p>
      )}
      {recortada && !fallo && (
        <p className={css.apunte} role="note">
          Se muestran las 200 cuentas más recientes.
        </p>
      )}

      {hecho && (
        <p className={css.avisoBien} role="status">
          {hecho}{' '}
          <button type="button" className={css.btnLinea} onClick={() => setHecho(null)}>
            Vale
          </button>
        </p>
      )}

      <section className={css.tarjeta}>
        {/* Tres casos distintos, y antes eran uno: si la carga ha fallado no se
            sabe nada de la lista, así que no se afirma nada sobre ella. */}
        {fallo ? (
          <div className={css.vacio}>
            <span className={`${css.vacioIcono} ${css.vacioIconoFallo}`} aria-hidden="true">
              <IconoVacio tipo="fallo" />
            </span>
            <p className={css.vacioTitulo}>No he podido leer las cuentas</p>
            <p className={css.vacioFrase}>
              Así que no puedo decirte quién hay. Pulsa «Reintentar» aquí arriba.
            </p>
          </div>
        ) : soloYo ? (
          <div className={css.vacio}>
            <span className={css.vacioIcono} aria-hidden="true">
              <IconoVacio tipo="personas" />
            </span>
            <p className={css.vacioTitulo}>Ahora mismo solo estás tú</p>
            <p className={css.vacioFrase}>
              Cuando alguien use su enlace de invitación, aparecerá aquí con lo que tenga contratado
              y la última vez que entró.
            </p>
          </div>
        ) : (
          lista.map((c) => {
            const rolActual: Rol = c.rol ?? 'miembro';
            // El botón de borrar no se enseña para las administradoras ni para
            // la propia cuenta: el servidor lo rechaza en los dos casos, y un
            // botón que siempre falla solo sirve para asustar.
            const sePuedeBorrar = !c.protegida && c.uid !== yo;
            /* Rol de administradora sin estar en la lista del servidor. No se
               puede llegar a este estado desde la plataforma —ni el alta ni el
               cambio lo permiten—, así que si aparece viene de antes o de la
               consola de Firebase. Se enseña y se puede deshacer. */
            const adminSinLista = rolActual === 'sorela' && !c.protegida;
            return (
              <article key={c.uid} className={css.fila} style={{ padding: '16px 0', gap: 14 }}>
                <span
                  style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}
                >
                  <span className={css.filaNombre}>
                    {c.nombre || 'Sin nombre'}
                    {c.uid === yo && ' · tú'}
                    {c.bloqueada && <span className={css.bloqueada}>Bloqueada</span>}
                  </span>
                  <span className={css.cuentaCorreo}>{c.correo || 'sin correo'}</span>
                  {/* Cómo llegó a tener cuenta: la misma pregunta que en el CRM. */}
                  {c.llego && (
                    <span className={css.llego}>
                      {c.llego === 'registro'
                        ? 'Se creó la cuenta ella desde la web'
                        : c.llego === 'invitacion'
                          ? 'Entró con un enlace de invitación tuyo'
                          : 'La diste de alta tú'}
                      {c.creado && ` · ${new Date(c.creado).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </span>
                  )}
                  {/* Quien se ha registrado sola todavía no ha pagado —o no
                      lo has comprobado—, así que se dice en su línea y se dice
                      a qué viene. Es la diferencia entre «esta ya está dentro»
                      y «esta está esperando a que le abras». */}
                  {c.seRegistro && c.accesos.length === 0 && (
                    <span className={css.esperando}>
                      Se registró ella
                      {c.pide === 'comunidad'
                        ? ' · pide la Comunidad Divine'
                        : c.pide === 'curso'
                          ? ' · pide la formación'
                          : ''}
                      . Todavía no tiene acceso a nada.
                    </span>
                  )}
                  {c.sinFicha && (
                    <span className={css.cuentaSinFicha}>
                      Puede entrar, pero no tiene ficha: no sé qué ha contratado. Si no sabes de
                      dónde sale, bórrala.
                    </span>
                  )}
                  {/* De dónde viene: la comunidad y los cursos que haya hecho.
                      La comunidad lleva sello dorado y los cursos no, porque no
                      pesan lo mismo: la comunidad se paga cada mes y es la que
                      hay que mirar de un vistazo. */}
                  {(tieneMembresia(c.accesos) || cursosDe(c.accesos).length > 0) && (
                    <span className={css.sellos}>
                      {tieneMembresia(c.accesos) && (
                        <span className={css.selloComunidad}>
                          <Destello />
                          Comunidad Divine
                        </span>
                      )}
                      {cursosDe(c.accesos).map((a) => (
                        <span key={a.nombre} className={css.selloCurso}>
                          {a.nombre}
                        </span>
                      ))}
                    </span>
                  )}
                </span>

                <span style={{ flex: '0 1 180px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span className={css.cuentaCuando}>
                    {/* Sin fecha de acceso es que la cuenta está dada de alta y
                        no se ha estrenado. Es un dato, no un hueco. */}
                    {c.ultimoAcceso ? `Entró ${cuando(c.ultimoAcceso)}` : 'No ha entrado todavía'}
                  </span>
                </span>

                <span className={css.acciones}>
                  {/* Dar o quitar la comunidad es lo que más se va a tocar de
                      esta pantalla: se paga al mes y la gente entra y sale. Por
                      eso está aquí y no escondido en una ficha aparte. */}
                  {!c.protegida && (
                    <button
                      type="button"
                      className={tieneMembresia(c.accesos) ? css.btnLinea : css.btnComunidad}
                      onClick={() => cambiarMembresia(c, !tieneMembresia(c.accesos))}
                    >
                      {tieneMembresia(c.accesos) ? 'Quitar comunidad' : 'Dar comunidad'}
                    </button>
                  )}
                  {!c.protegida && (() => {
                    const conFormacion = cursosDe(c.accesos).some((a) => clave(a.nombre) === clave(CURSO_DIVINE));
                    return (
                      <button
                        type="button"
                        className={conFormacion ? css.btnLinea : css.btnComunidad}
                        onClick={() => cambiarFormacion(c, !conFormacion)}
                      >
                        {conFormacion ? 'Quitar formación' : 'Dar formación'}
                      </button>
                    );
                  })()}
                  {/* El rol se enseña, no se elige. Ver quitarAdmin(). */}
                  <span
                    className={`${css.estado} ${rolActual === 'sorela' ? css.estadoTinta : css.estadoNeutro}`}
                  >
                    {ETIQUETA_ROL[rolActual]}
                  </span>
                  {adminSinLista && (
                    <button type="button" className={css.enlaceAccion} onClick={() => quitarAdmin(c)}>
                      Quitar admin
                    </button>
                  )}
                  {/* Lo que corta el acceso, junto y de menos a más: quitar lo
                      contratado, bloquear la entrada, borrar la cuenta. */}
                  {sePuedeBorrar && (
                    <span className={css.gestionar}>
                      <button
                        type="button"
                        className={css.btnLinea}
                        aria-expanded={gestion === c.uid}
                        aria-label={`Gestionar el acceso de ${c.nombre || c.correo || 'esta persona'}`}
                        onClick={() => setGestion(gestion === c.uid ? null : c.uid)}
                      >
                        Gestionar acceso ▾
                      </button>
                      {gestion === c.uid && (
                        <span className={css.gestionarMenu} role="menu">
                          {c.accesos.length > 0 && (
                            <button type="button" role="menuitem" onClick={() => { setGestion(null); quitarTodo(c); }}>
                              <strong>Quitar todo el acceso</strong>
                              <small>Pierde la formación y la comunidad. Su cuenta sigue.</small>
                            </button>
                          )}
                          <button type="button" role="menuitem" onClick={() => { setGestion(null); bloquear(c, !c.bloqueada); }}>
                            <strong>{c.bloqueada ? 'Desbloquear la entrada' : 'Bloquear la entrada'}</strong>
                            <small>
                              {c.bloqueada
                                ? 'Puede volver a entrar con su contraseña.'
                                : 'No puede entrar. No se borra nada; se deshace cuando quieras.'}
                            </small>
                          </button>
                          <button type="button" role="menuitem" data-peligro="" onClick={() => { setGestion(null); setABorrar(c); }}>
                            <strong>Borrar la cuenta</strong>
                            <small>Para siempre: cuenta, accesos y progreso.</small>
                          </button>
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </article>
            );
          })
        )}
      </section>

      {/* Borrar pide una confirmación de verdad, que diga qué se pierde y qué no. */}
      {aBorrar &&
        createPortal(
        <div className={css.veloBorrar} role="presentation" onClick={() => setABorrar(null)}>
          <div
            className={css.dialogoBorrar}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="borrar-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="borrar-titulo">¿Borrar la cuenta de {aBorrar.nombre || aBorrar.correo}?</h3>
            <p>Se borra para siempre, y no se puede deshacer:</p>
            <ul>
              <li>su cuenta y su contraseña: no podrá volver a entrar;</li>
              <li>lo que tenga contratado (formación, comunidad);</li>
              <li>su progreso en las clases y su agenda;</li>
              <li>su perfil, sus fotos y su ficha del mapa.</li>
            </ul>
            <p>
              Se quedan su ficha en <strong>Clientes</strong> (con tus notas) y lo que haya escrito en la comunidad, sin
              las fotos. Si
              solo quieres que no entre por un tiempo, mejor <strong>bloquear la entrada</strong>.
            </p>
            <div className={css.dialogoBotones}>
              <button type="button" className={css.btnLinea} onClick={() => setABorrar(null)} autoFocus>
                Cancelar
              </button>
              <button type="button" className={css.btnPeligro} onClick={() => borrar(aBorrar)}>
                Sí, borrar para siempre
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}

    </div>
  );
}
