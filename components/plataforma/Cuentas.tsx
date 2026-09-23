'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ETIQUETA_ROL, ROLES, type Rol } from '@/lib/roles';
import css from './plataforma.module.css';

/**
 * Quién tiene cuenta, y cómo se da de alta a alguien nuevo.
 *
 * Existe por un efecto secundario de cerrar el registro público: desde que
 * lib/sesion-servidor.ts solo deja entrar a las administradoras, Sorela no
 * tenía manera de dar acceso a una alumna que se matricula salvo entrar en la
 * consola de Firebase. Esta pantalla es esa manera.
 *
 * Dos cosas que conviene entender antes de tocar nada:
 *
 * 1. La contraseña NO la pone Sorela. El servidor crea la cuenta con una larga
 *    al azar que nadie ve y devuelve un enlace para que la persona ponga la
 *    suya. Ese enlace hay que mandárselo A MANO —por WhatsApp, por correo, por
 *    donde sea—, porque este servidor no envía correos. Si el enlace no se
 *    manda, el alta se queda a medias.
 *
 * 2. Ese enlace es tan bueno como una contraseña: quien lo tenga puede entrar
 *    en esa cuenta. Se dice en pantalla para que no acabe pegado en un grupo.
 *
 * No hay nada inventado: la lista es la que hay en Firestore, y de salida es
 * solo Sorela.
 */

type Cuenta = {
  uid: string;
  correo: string | null;
  nombre: string | null;
  rol: Rol | null;
  ultimoAcceso: string | null;
  /** Está en ADMIN_CORREOS: ni se borra ni se le cambia el rol. */
  protegida: boolean;
};

/** Lo que devuelve el alta y hay que enseñar hasta que se dé por leído. */
type Alta = {
  correo: string;
  nombre: string;
  rol: Rol;
  enlace: string | null;
  rolForzado: boolean;
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

const ESTILO_ERROR = {
  fontSize: 12,
  fontWeight: 300,
  color: 'var(--arcilla)',
  textTransform: 'none' as const,
  letterSpacing: 0,
};

export default function Cuentas() {
  const [lista, setLista] = useState<Cuenta[] | null>(null);
  const [yo, setYo] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  /* Si la plataforma deja entrar a alguien más que a las administradoras.
     Se pregunta al servidor en vez de importar PLATAFORMA_ABIERTA aquí, que
     también compilaría: el que decide quién entra es lib/sesion-servidor.ts, y
     que la respuesta salga del mismo sitio que la decisión evita que un día la
     pantalla diga «ya puede entrar» mientras la puerta sigue cerrada. Arranca
     en false, que es lo prudente: si la carga falla, se avisa de más. */
  const [abierta, setAbierta] = useState(false);

  /* El formulario de alta. Cada campo por separado, como en la agenda: son
     dos líneas más, pero se lee de un vistazo cuál se está tocando. */
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('alumna');
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});
  const [guardando, setGuardando] = useState(false);

  // El alta recién hecha se queda en pantalla hasta que Sorela la cierra: si
  // desapareciera al recargar la lista, se llevaría por delante el enlace, que
  // no se puede volver a pedir desde aquí.
  const [alta, setAlta] = useState<Alta | null>(null);
  const [copiado, setCopiado] = useState<boolean | null>(null);

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const r = await fetch('/api/usuarios');
      const c = await r.json().catch(() => ({ ok: false }));
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
    } catch {
      setFallo('No hay conexión con el servidor.');
      setLista([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setErrores({});
    setFallo(null);

    try {
      const r = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, nombre, rol }),
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setErrores(c.errores ?? {});
        // Si el servidor no dice qué campo falla, el problema no está en lo
        // escrito: se avisa arriba, donde se ven los fallos generales.
        if (!c.errores || Object.keys(c.errores).length === 0) {
          setFallo('No he podido crear la cuenta.');
        }
        return;
      }

      setAlta({
        correo: c.correo,
        nombre: c.nombre,
        rol: c.rol,
        enlace: c.enlace ?? null,
        rolForzado: Boolean(c.rolForzado),
      });
      setCopiado(null);
      // El formulario se vacía entero: dar de alta a dos personas seguidas con
      // el mismo correo no existe, y dejar el anterior escrito invita a ello.
      setCorreo('');
      setNombre('');
      setRol('alumna');
      await cargar();
    } catch {
      setFallo('No hay conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarRol(uid: string, nuevo: Rol) {
    const antes = lista;
    // Se pinta antes de que conteste el servidor y se deshace si dice que no:
    // dejar la pantalla diciendo «terapeuta certificada» cuando no se ha
    // guardado es peor que no haber dejado pulsar.
    setLista((l) => l?.map((c) => (c.uid === uid ? { ...c, rol: nuevo } : c)) ?? l);
    try {
      const r = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, rol: nuevo }),
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) throw new Error(c.motivo);
      setFallo(null);
    } catch (e) {
      setLista(antes ?? null);
      setFallo(
        (e as Error).message === 'admin-protegida'
          ? 'A una administradora no se le puede quitar el rol de admin.'
          : 'No se ha podido cambiar el rol. Vuelve a intentarlo.'
      );
    }
  }

  async function borrar(cuenta: Cuenta) {
    const quien = cuenta.nombre || cuenta.correo || 'esta cuenta';
    // Se pregunta porque esto no tiene papelera y se lleva las dos mitades:
    // la cuenta de acceso y su ficha.
    if (
      !window.confirm(
        `¿Borrar la cuenta de ${quien}? Perderá el acceso y no se puede deshacer.`
      )
    ) {
      return;
    }

    const antes = lista;
    setLista((l) => l?.filter((c) => c.uid !== cuenta.uid) ?? l);
    try {
      const r = await fetch(`/api/usuarios?uid=${encodeURIComponent(cuenta.uid)}`, {
        method: 'DELETE',
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) throw new Error(c.motivo);
      setFallo(null);
    } catch (e) {
      const motivo = (e as Error).message;
      setLista(antes ?? null);
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

  async function copiarEnlace(enlace: string) {
    try {
      // navigator.clipboard no existe fuera de un contexto seguro y el
      // navegador puede denegar el permiso. Sin el try, no poder copiar el
      // enlace tumbaría la pantalla entera.
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  if (lista === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando las cuentas…</p>
      </div>
    );
  }

  // Si no hay nadie más que quien está mirando, no hay nada que listar: se
  // dice con palabras en vez de enseñar una fila sola sin explicar nada. Con
  // `every` y no con la longitud, que daría el mensaje equivocado el día que
  // la única ficha de la lista fuera la de otra persona.
  const soloYo = lista.every((c) => c.uid === yo);

  return (
    <div className={css.columna}>
      {/* Lo primero que hay que saber: una cuenta nueva se crea bien, pero
          todavía no puede entrar. Sin este aviso, el alta parecería rota. */}
      {!abierta && (
        <div className={css.aviso} role="note">
          <p className={css.parrafo} style={{ flex: '1 1 320px', margin: 0 }}>
            <strong>La plataforma está cerrada.</strong> Puedes dar de alta a quien quieras y
            mandarle su enlace, pero <strong>todavía no podrá entrar</strong>: mientras esté
            cerrada, el servidor solo deja pasar a las administradoras. No es que la cuenta esté
            rota. Se abre poniendo <code>PLATAFORMA_ABIERTA</code> en <code>lib/roles.ts</code>.
          </p>
        </div>
      )}

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={css.btnLinea} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}

      {/* El alta recién hecha, con su enlace. Va arriba del todo porque es lo
          que hay que hacer ahora mismo: copiarlo y mandarlo. */}
      {alta && (
        <section className={css.tarjeta}>
          <div className={css.columna} style={{ gap: 14 }}>
            <p className={css.avisoBien} role="status">
              Cuenta creada para <strong>{alta.nombre}</strong> ({alta.correo}) como{' '}
              {ETIQUETA_ROL[alta.rol]}.
              {alta.rolForzado &&
                ' Ese correo está en la lista de administradoras, así que se ha guardado con el rol de admin.'}
            </p>

            {alta.enlace ? (
              <>
                <p className={css.parrafo} style={{ margin: 0 }}>
                  Queda un paso, y no lo hace sola la plataforma:{' '}
                  <strong>mándale tú este enlace</strong> para que se ponga su contraseña. Desde
                  aquí no sale ningún correo. Mientras no lo abra, no puede entrar.
                </p>

                <code className={css.enlaceClave}>{alta.enlace}</code>

                <div className={css.barraAcciones}>
                  <span className={css.apunte}>
                    Trátalo como una contraseña: quien lo tenga entra en esa cuenta. No lo pegues
                    en un grupo.
                  </span>
                  <span className={css.acciones}>
                    <button
                      type="button"
                      className={css.btn}
                      onClick={() => alta.enlace && copiarEnlace(alta.enlace)}
                    >
                      Copiar el enlace
                    </button>
                    <button
                      type="button"
                      className={css.enlaceAccion}
                      onClick={() => {
                        setAlta(null);
                        setCopiado(null);
                      }}
                    >
                      Ya está mandado
                    </button>
                  </span>
                </div>

                {/* Se dice si funcionó o no: un botón de copiar que no copia y
                    no avisa hace que se mande un mensaje vacío. */}
                {copiado !== null && (
                  <p className={css.apunte} role="status" style={{ margin: 0 }}>
                    {copiado
                      ? 'Copiado. Pégalo donde hables con ella.'
                      : 'No he podido copiarlo. Selecciona el enlace de arriba y cópialo a mano.'}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className={css.parrafo} style={{ margin: 0 }}>
                  La cuenta está creada, pero no he podido generar el enlace de la contraseña.
                  Dile que entre y pulse <strong>«He olvidado mi contraseña»</strong> con este
                  correo, o borra la cuenta aquí abajo y vuelve a darla de alta.
                </p>
                <div className={css.barraAcciones}>
                  <span className={css.apunte}>
                    La cuenta ya existe: no hace falta volver a crearla.
                  </span>
                  <button type="button" className={css.enlaceAccion} onClick={() => setAlta(null)}>
                    Entendido
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <section className={css.tarjeta}>
        {soloYo ? (
          <p className={css.vacioTexto}>
            Ahora mismo solo está tu cuenta. Cuando des de alta a alguien aquí abajo, aparecerá en
            esta lista con su rol y con la última vez que entró.
          </p>
        ) : (
          lista.map((c) => {
            const rolActual: Rol = c.rol ?? 'alumna';
            // El botón de borrar no se enseña para las administradoras ni para
            // la propia cuenta: el servidor lo rechaza en los dos casos, y un
            // botón que siempre falla solo sirve para asustar.
            const sePuedeBorrar = !c.protegida && c.uid !== yo;
            return (
              <article key={c.uid} className={css.fila} style={{ padding: '16px 0', gap: 14 }}>
                <span
                  style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}
                >
                  <span className={css.filaNombre}>
                    {c.nombre || 'Sin nombre'}
                    {c.uid === yo && ' · tú'}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                    {c.correo || 'sin correo'}
                  </span>
                </span>

                <span style={{ flex: '0 1 180px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 300, color: 'var(--faint)' }}>
                    {/* Sin fecha de acceso es que la cuenta está dada de alta y
                        no se ha estrenado. Es un dato, no un hueco. */}
                    {c.ultimoAcceso ? `Entró ${cuando(c.ultimoAcceso)}` : 'No ha entrado todavía'}
                  </span>
                </span>

                <span className={css.acciones}>
                  {c.protegida ? (
                    // A una administradora no se le cambia el rol: en vez de un
                    // desplegable que rebota, se enseña lo que es.
                    <span className={`${css.estado} ${css.estadoTinta}`}>
                      {ETIQUETA_ROL[rolActual]}
                    </span>
                  ) : (
                    <select
                      aria-label={`Rol de ${c.nombre || c.correo || 'esta cuenta'}`}
                      className={css.campoRedondo}
                      style={{ fontSize: 13 }}
                      value={rolActual}
                      onChange={(e) => cambiarRol(c.uid, e.target.value as Rol)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ETIQUETA_ROL[r]}
                        </option>
                      ))}
                    </select>
                  )}
                  {sePuedeBorrar && (
                    <button type="button" className={css.enlaceAccion} onClick={() => borrar(c)}>
                      Borrar
                    </button>
                  )}
                </span>
              </article>
            );
          })
        )}
      </section>

      <section className={css.punteada}>
        <form onSubmit={crear} className={css.columna} style={{ gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p className={css.rotuloSeccion}>Dar de alta una cuenta</p>
            <p className={css.apunte}>
              Tú no eliges su contraseña: se crea una al azar que no ve nadie y te doy un enlace
              para que ella ponga la suya.
            </p>
          </div>

          <div className={css.formRejilla}>
            <label className={css.etiquetaCampo}>
              Correo
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="Con el que va a entrar"
                autoComplete="off"
                className={css.campoCaja}
              />
              {errores.correo && (
                <span style={ESTILO_ERROR} role="alert">
                  {errores.correo}
                </span>
              )}
            </label>

            <label className={css.etiquetaCampo}>
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Cómo se llama"
                autoComplete="off"
                className={css.campoCaja}
              />
              {errores.nombre && (
                <span style={ESTILO_ERROR} role="alert">
                  {errores.nombre}
                </span>
              )}
            </label>

            <label className={css.etiquetaCampo}>
              Rol
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as Rol)}
                className={css.campoCaja}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_ROL[r]}
                  </option>
                ))}
              </select>
              {errores.rol && (
                <span style={ESTILO_ERROR} role="alert">
                  {errores.rol}
                </span>
              )}
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <button type="submit" className={css.btn} disabled={guardando}>
              {guardando ? 'Creando…' : 'Crear la cuenta'}
            </button>
            <span className={css.apunte}>
              Al crearla te sale el enlace aquí arriba. Hay que mandárselo tú.
            </span>
          </div>
        </form>
      </section>
    </div>
  );
}
