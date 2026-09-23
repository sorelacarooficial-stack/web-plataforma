'use client';

import { useEffect, useRef, useState } from 'react';
import { ETIQUETA_TIPO, QUE_QUIERE, comoLlego, tipoDeOrigen, type Tipo } from '@/lib/origenes';
import css from './plataforma.module.css';

/**
 * La ficha de una persona: todo lo que se sabe de quien dejó su contacto en la
 * web, en un solo sitio y sin salir de la lista.
 *
 * Por qué un <dialog> con showModal() y no una capa montada a mano: el panel
 * de Sorela ya usa z-index 60 para el cajón de móvil y 55 para su velo, así
 * que una capa casera tendría que pujar por encima de esos números y volvería
 * a perder en cuanto alguien añadiera otra. showModal() saca la ficha de esa
 * pelea —va a la capa superior del navegador— y de paso trae hecho lo que más
 * se olvida: el foco atrapado dentro, el fondo inerte y el cierre con Escape.
 * Encima se le da forma de cajón pegado a la derecha, que es lo que pide leer
 * a una persona sin perder de vista dónde estabas.
 *
 * El precio es que la lista de detrás queda inerte mientras la ficha está
 * abierta: no se salta de una persona a otra sin cerrar. Aquí es el cambio
 * correcto, porque en la ficha se trabaja con UNA persona —se la llama, se le
 * escribe, se apunta lo hablado— y no se compara con la de al lado.
 *
 * Esta ficha no habla con el servidor: recibe la persona ya cargada y avisa
 * hacia arriba. Quien tiene la lista es quien sabe pintar el cambio antes de
 * tiempo y deshacerlo si el servidor lo rechaza.
 */

export type Persona = {
  id: string;
  nombre: string;
  correo: string;
  whatsapp: string;
  perfil: string;
  ciudad: string;
  nota: string;
  origen: string;
  estado: string;
  creado: string | null;
  veces: number;
  seguimiento?: { cuando: string; texto: string }[];
};

/* Mismos nombres y mismo orden que la lista y que la API. Si aquí se colara
   «En conversacion» sin tilde, el servidor lo rechazaría por no estar en su
   lista y el cambio se desharía sin que se entienda por qué. */
const ESTADOS = ['Nuevo', 'Contactado', 'En conversación', 'Cerrado', 'Descartado'] as const;

/* Los mismos distintivos que usa la lista, para que un «Contactado» se vea
   igual en los dos sitios. Cualquier estado viejo que no esté aquí cae en el
   neutro en vez de quedarse sin recuadro. */
const CLASE_ESTADO: Record<string, string> = {
  Nuevo: css.estadoTinta,
  Contactado: css.estadoOro,
  'En conversación': css.estadoOro,
  Cerrado: css.estadoNeutro,
  Descartado: css.estadoApagado,
};

/* El tipo también lleva su distintivo. Pintar «Sin clasificar» en oro, igual
   que a una posible clienta, diría que ahí hay algo decidido cuando es
   justo lo contrario: el neutro deja claro de un vistazo que falta
   preguntárselo. La terapeuta certificada va en tinta porque ya es de casa. */
const CLASE_TIPO: Record<Tipo, string> = {
  clienta: css.estadoOro,
  alumna: css.estadoOro,
  comunidad: css.estadoTinta,
  otro: css.estadoNeutro,
};

/**
 * «hace 3 h», «ayer», «12 oct». La fecha exacta no dice de un vistazo si
 * alguien lleva dos horas o dos semanas esperando respuesta, que es lo único
 * que importa al abrir la ficha.
 *
 * Está copiada de Contactos.tsx a propósito: allí es una función privada del
 * módulo, y sacarla a lib/ significaría tocar ficheros que ahora mismo lleva
 * otra mano. Queda anotado para unificarlas después.
 */
function cuando(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Una fecha ilegible en Firestore daría «hace NaN min», que parece un fallo
  // del panel cuando en realidad es un dato malo.
  if (Number.isNaN(d.getTime())) return '';
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

/** La fecha entera, al lado de la aproximada: «12 de octubre de 2026, 17:40». */
function fechaLarga(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * El número tal y como lo quiere wa.me: solo dígitos y con prefijo de país.
 *
 * Aquí casi todo el mundo escribe «686 15 45 56» sin el 34, y wa.me con nueve
 * dígitos abre una conversación con un número que no existe: el enlace parece
 * funcionar y el mensaje no llega a nadie. Si vienen nueve dígitos de un
 * número español se les antepone el 34; si la persona ya escribió su prefijo
 * se respeta el suyo, porque también se apunta gente de fuera.
 */
function numeroWhatsapp(bruto: string): string {
  const digitos = (bruto || '').replace(/\D/g, '');
  if (!digitos) return '';
  // «0034…» es la forma antigua de escribir «+34…»: los dos ceros sobran.
  const limpio = digitos.replace(/^00/, '');
  if (limpio.length === 9 && /^[6789]/.test(limpio)) return `34${limpio}`;
  return limpio;
}

/** El nombre de pila. Saludar por el nombre completo suena a carta del banco. */
function nombrePila(nombre: string): string {
  return (nombre || '').trim().split(/\s+/)[0] ?? '';
}

/* Qué pidió cada uno, en una frase que se pueda meter dentro del saludo. No
   es lo mismo escribir a quien quiere una sesión que a quien quiere aprender:
   un «hola, ¿en qué puedo ayudarte?» a quien ya explicó lo que quiere suena a
   formulario automático. */
const PIDIO: Record<Tipo, string> = {
  clienta: 'me has dejado tus datos en la web pidiendo información sobre las sesiones',
  alumna: 'me has dejado tus datos en la web pidiendo información sobre las formaciones',
  comunidad: 'me has dejado tus datos para entrar en la Comunidad Divine',
  otro: 'me has dejado tus datos en la web',
};

const ASUNTO: Record<Tipo, string> = {
  clienta: 'Tu consulta sobre las sesiones de Técnica Divine',
  alumna: 'Tu consulta sobre las formaciones de Técnica Divine',
  comunidad: 'Tu solicitud para la Comunidad Divine',
  otro: 'Tu mensaje desde la web de Técnica Divine',
};

/**
 * El primer mensaje, ya redactado. No se envía solo: abre WhatsApp con el
 * texto puesto para que Sorela lo lea, lo cambie y lo mande ella. Lo que hace
 * que sirva es que diga el nombre y lo que la persona pidió.
 */
function mensajeWhatsapp(nombre: string, tipo: Tipo): string {
  const pila = nombrePila(nombre);
  return `Hola${pila ? ` ${pila}` : ''}, soy Sorela, de Técnica Divine. Veo que ${PIDIO[tipo]}. ¿Te va bien que hablemos por aquí?`;
}

function mensajeCorreo(nombre: string, tipo: Tipo): string {
  const pila = nombrePila(nombre);
  return `Hola${pila ? ` ${pila}` : ''}:\n\nSoy Sorela, de Técnica Divine. Veo que ${PIDIO[tipo]}.\n\nCuéntame qué necesitas y te oriento sin compromiso.\n\nUn abrazo,\nSorela Caro`;
}

export default function FichaPersona({
  persona,
  onCerrar,
  onCambiarEstado,
  onApuntar,
}: {
  persona: Persona | null;
  onCerrar: () => void;
  onCambiarEstado: (id: string, estado: string) => void;
  onApuntar: (id: string, texto: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  /* Dónde empezó el gesto del ratón. Hace falta para no confundir «soltar el
     botón sobre el velo» con «pulsar el velo»: ver más abajo, en onPointerDown. */
  const empezoEnVelo = useRef(false);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [falloApunte, setFalloApunte] = useState<string | null>(null);
  const [copia, setCopia] = useState<{ campo: string; ok: boolean } | null>(null);

  /* Los hooks van todos antes del `return null`: si se colgaran de que haya
     persona, React vería una lista de hooks distinta en cada apertura. */
  const abierto = persona !== null;

  useEffect(() => {
    const dialogo = ref.current;
    if (!abierto || !dialogo) return;
    if (!dialogo.open) dialogo.showModal();
    // Al desaparecer la persona el <dialog> se desmonta; cerrarlo antes deja
    // limpia la capa superior del navegador en vez de fiarlo todo a que el
    // nodo desaparezca. La condición es `abierto` y no `persona` a propósito:
    // saltar de una persona a otra no debe cerrar y reabrir la ventana, que
    // devolvería el foco al principio a mitad de lectura.
    return () => {
      if (dialogo.open) dialogo.close();
    };
  }, [abierto]);

  /* La página de detrás no debe poder moverse mientras la ficha está abierta:
     en móvil, al arrastrar dentro de la ficha se desplazaría la lista y se
     perdería el sitio donde estabas. */
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  /* Al cambiar de persona se vacía lo que hubiera a medias. Una nota escrita
     para una y no guardada no puede acabar apuntada en la ficha de otra. */
  useEffect(() => {
    setTexto('');
    setFalloApunte(null);
    setCopia(null);
  }, [persona?.id]);

  /* El aviso de copiado se borra solo: es un «hecho», no un mensaje que haya
     que cerrar a mano. */
  useEffect(() => {
    if (!copia) return;
    const reloj = window.setTimeout(() => setCopia(null), 3000);
    return () => window.clearTimeout(reloj);
  }, [copia]);

  if (!persona) return null;

  const tipo = tipoDeOrigen(persona.origen);
  const estadoActual = persona.estado || 'Nuevo';
  /* Si en Firestore hay un estado que ya no está en la lista —uno antiguo, o
     escrito a mano—, el <select> se quedaría en blanco y el primer clic lo
     cambiaría sin querer. Se añade al final para que al menos se vea cuál es. */
  const opciones: readonly string[] = (ESTADOS as readonly string[]).includes(estadoActual)
    ? ESTADOS
    : [...ESTADOS, estadoActual];

  const telefono = numeroWhatsapp(persona.whatsapp);
  const textoWhatsapp = mensajeWhatsapp(persona.nombre, tipo);
  const enlaceWhatsapp = `https://wa.me/${telefono}?text=${encodeURIComponent(textoWhatsapp)}`;

  /* La dirección va dentro de un mailto con asunto y cuerpo detrás del «?».
     Nadie ha validado lo que se escribió en el formulario, así que un espacio
     colado al final o un «&» partirían el enlace justo por ahí: el cliente de
     correo abriría con la dirección a medias o con el cuerpo perdido. Se
     escapa solo eso —no la dirección entera con encodeURIComponent— porque
     convertir la «@» en «%40» hace que algún cliente de correo no la
     reconozca como dirección. */
  const direccion = (persona.correo || '').trim().replace(/[\s?&#]/g, (c) => encodeURIComponent(c));
  const enlaceCorreo = `mailto:${direccion}?subject=${encodeURIComponent(
    ASUNTO[tipo]
  )}&body=${encodeURIComponent(mensajeCorreo(persona.nombre, tipo))}`;

  /* El correo y el WhatsApp se pintan siempre, aunque falten: que no haya por
     dónde escribirle es justo lo que hay que ver. Los demás se omiten si
     están vacíos, porque un «Ciudad: no consta» repetido cinco veces solo
     hace ruido alrededor de lo que sí se sabe. */
  const otrosDatos = [
    { etiqueta: 'Ciudad', valor: persona.ciudad },
    { etiqueta: 'A qué se dedica', valor: persona.perfil },
    { etiqueta: 'Lo que escribió', valor: persona.nota },
  ].filter((d) => (d.valor || '').trim());

  /* Se ordena aquí en vez de fiarse de cómo venga: la lista de arriba puede
     añadir la nota nueva por delante o por detrás, y un seguimiento contado al
     revés se lee fatal. De lo más viejo a lo más nuevo, como una conversación.
     Las fechas son ISO, así que compararlas como texto las ordena en el tiempo.
     Se comparan con `<` y no con localeCompare por dos motivos: ese ignora los
     guiones y los dos puntos en algunas configuraciones regionales, y revienta
     con un TypeError si a una nota le falta la fecha. Y faltar puede faltar:
     estas notas vienen de Firestore por JSON, no de aquí dentro, así que una
     sola mal guardada tumbaría la ficha entera en vez de salir descolocada.
     Las que no traen fecha se van al final; las que no traen texto se caen,
     porque un hueco en blanco en el seguimiento no cuenta nada. */
  const notas = [...(persona.seguimiento ?? [])]
    .filter((n) => n && (n.texto || '').trim())
    .sort((a, b) => {
      const x = a.cuando || '';
      const y = b.cuando || '';
      if (!x || !y) return x ? -1 : y ? 1 : 0;
      return x < y ? -1 : x > y ? 1 : 0;
    });

  /**
   * Cerrar, pero no a traición.
   *
   * Una nota a medio escribir solo existe dentro de este campo: no se ha
   * mandado a ningún sitio y al cerrar la ficha se desmonta con ella. Es la
   * misma razón por la que, si falla el guardado, el texto se queda donde
   * está. Se pregunta igual que al borrar una cita en la agenda.
   */
  function intentarCerrar() {
    if (
      texto.trim() &&
      !window.confirm('Tienes una nota sin guardar. Si cierras la ficha se pierde. ¿Cierro?')
    ) {
      return;
    }
    onCerrar();
  }

  async function copiar(campo: string, valor: string) {
    try {
      // navigator.clipboard no existe fuera de un contexto seguro y el
      // navegador puede denegar el permiso. Sin el try, no poder copiar un
      // correo tumbaría la ficha entera.
      await navigator.clipboard.writeText(valor);
      setCopia({ campo, ok: true });
    } catch {
      setCopia({ campo, ok: false });
    }
  }

  async function apuntar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || !persona) return;
    setGuardando(true);
    setFalloApunte(null);
    try {
      await onApuntar(persona.id, limpio);
      setTexto('');
    } catch {
      // El texto se queda en el campo a propósito: es lo único que existe de
      // esa nota, y vaciarlo sería perder lo que acaba de escribir.
      setFalloApunte('No se ha podido guardar la nota. Vuelve a intentarlo.');
    } finally {
      setGuardando(false);
    }
  }

  /** El «Copiado» / «No se ha podido copiar» que va pegado a cada dato. */
  function avisoCopia(campo: string) {
    if (copia?.campo !== campo) return null;
    return (
      <span className={css.apunte} role="status">
        {copia.ok ? 'Copiado' : 'No he podido copiarlo: selecciónalo y cópialo a mano'}
      </span>
    );
  }

  return (
    <dialog
      ref={ref}
      className={css.fichaPanel}
      aria-label={`Ficha de ${persona.nombre || 'contacto sin nombre'}`}
      // Escape cierra por su cuenta sin pasar por React; hay que enterarse
      // para que la lista de fuera no se quede creyendo que sigue abierta.
      // No se escucha onClose: el único cierre nativo posible es este, y
      // escucharlo devolvería también el close() que hacemos al desmontar.
      // Siempre se corta el cierre nativo y se decide aquí: si hay una nota a
      // medias, intentarCerrar() pregunta, y al decir que no el preventDefault
      // es lo que deja la ficha abierta.
      onCancel={(e) => {
        e.preventDefault();
        intentarCerrar();
      }}
      // Dónde empieza el gesto. El <dialog> recibe el evento cuando cae fuera
      // de la caja, porque la caja es hija suya: comparar el objetivo con el
      // propio diálogo distingue «fuera» de «dentro» sin medir píxeles.
      onPointerDown={(e) => {
        empezoEnVelo.current = e.target === ref.current;
      }}
      // Clic en el velo. Se exige que el gesto empezara Y acabara fuera: esta
      // ficha invita a seleccionar texto —el mensaje de WhatsApp está puesto
      // para leerlo y cambiarlo—, y al arrastrar la selección un poco más allá
      // del borde el «click» cae sobre el velo. Sin esta comprobación,
      // seleccionar una frase cerraría la ficha.
      onClick={(e) => {
        if (e.target === ref.current && empezoEnVelo.current) intentarCerrar();
      }}
    >
      <div className={css.fichaCaja}>
        <button
          type="button"
          className={css.fichaCerrar}
          onClick={intentarCerrar}
          aria-label="Cerrar la ficha"
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

        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className={css.h2}>{persona.nombre || 'Sin nombre'}</h2>
          <div className={css.chips}>
            <span className={`${css.estado} ${CLASE_TIPO[tipo]}`}>{ETIQUETA_TIPO[tipo]}</span>
          </div>
          <p className={css.parrafo}>{QUE_QUIERE[tipo]}</p>
        </header>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 className={css.rotuloSeccion}>Cómo llegó</h3>
          <p className={css.parrafo}>{comoLlego(persona.origen)}</p>
          <p className={css.apunte}>
            {cuando(persona.creado) || 'Sin fecha de entrada'}
            {fechaLarga(persona.creado) && ` · ${fechaLarga(persona.creado)}`}
          </p>
          {persona.veces > 1 && (
            // No es un fallo, pero es el mismo aviso: algo que mirar antes de
            // seguir. Se reutiliza el recuadro en vez de inventar otro.
            <p className={css.avisoFallo}>
              Ha dejado sus datos {persona.veces} veces. O le interesa de verdad, o nadie le ha
              contestado todavía.
            </p>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 className={css.rotuloSeccion}>Escribirle</h3>
          {!telefono && !persona.correo ? (
            <p className={css.avisoFallo}>
              No dejó ni teléfono ni correo: por aquí no hay forma de llegar a ella.
            </p>
          ) : (
            <>
              <div className={css.acciones}>
                {telefono && (
                  <a
                    className={css.btn}
                    href={enlaceWhatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Escribir por WhatsApp
                  </a>
                )}
                {persona.correo && (
                  <a className={css.btnLinea} href={enlaceCorreo}>
                    Escribir por correo
                  </a>
                )}
              </div>
              {telefono && (
                <p className={css.apunte}>
                  WhatsApp se abre con este mensaje ya escrito, para que lo cambies antes de
                  enviarlo: «{textoWhatsapp}»
                </p>
              )}
              {!telefono && <p className={css.apunte}>No dejó teléfono: solo queda el correo.</p>}
            </>
          )}
        </section>

        <section>
          <h3 className={css.rotuloSeccion}>Sus datos</h3>

          <div className={css.fichaDato}>
            <span className={css.fichaEtiqueta}>Correo</span>
            <span className={css.fichaValor}>
              {persona.correo ? (
                <a className={css.fichaEnlace} href={`mailto:${direccion}`}>
                  {persona.correo}
                </a>
              ) : (
                <span className={css.apunte}>No consta</span>
              )}
            </span>
            {persona.correo && (
              <button
                type="button"
                className={css.enlaceAccion}
                onClick={() => copiar('correo', persona.correo)}
              >
                Copiar
              </button>
            )}
            {avisoCopia('correo')}
          </div>

          <div className={css.fichaDato}>
            <span className={css.fichaEtiqueta}>WhatsApp</span>
            <span className={css.fichaValor}>
              {/* Se enlaza solo si de lo que escribió salen dígitos. Si puso
                  «no tengo», el enlace llevaría a wa.me sin número: parecería
                  roto el panel cuando lo que falta es el teléfono. */}
              {!persona.whatsapp ? (
                <span className={css.apunte}>No consta</span>
              ) : telefono ? (
                <a
                  className={css.fichaEnlace}
                  href={`https://wa.me/${telefono}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {persona.whatsapp}
                </a>
              ) : (
                persona.whatsapp
              )}
            </span>
            {persona.whatsapp && (
              <button
                type="button"
                className={css.enlaceAccion}
                onClick={() => copiar('whatsapp', persona.whatsapp)}
              >
                Copiar
              </button>
            )}
            {avisoCopia('whatsapp')}
          </div>

          {otrosDatos.map((d) => (
            <div key={d.etiqueta} className={css.fichaDato}>
              <span className={css.fichaEtiqueta}>{d.etiqueta}</span>
              <span className={css.fichaValor}>{d.valor}</span>
            </div>
          ))}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 className={css.rotuloSeccion}>Estado</h3>
          <div className={css.chips}>
            <span className={`${css.estado} ${CLASE_ESTADO[estadoActual] ?? css.estadoNeutro}`}>
              {estadoActual}
            </span>
            <select
              aria-label={`Estado de ${persona.nombre || 'este contacto'}`}
              className={css.campoRedondo}
              value={estadoActual}
              onChange={(e) => onCambiarEstado(persona.id, e.target.value)}
            >
              {opciones.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>
          <p className={css.apunte}>
            De dónde viene no cambia nunca; esto sí: es por dónde va la conversación.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 className={css.rotuloSeccion}>Seguimiento</h3>

          {notas.length === 0 ? (
            <p className={css.vacioTexto}>
              Todavía no hay nada apuntado. Lo que escribas aquí —lo que hablasteis, lo que quedó
              pendiente, cuándo hay que volver a llamarla— se queda con ella.
            </p>
          ) : (
            notas.map((n, i) => (
              <article
                key={`${n.cuando}-${i}`}
                className={css.fila}
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '12px 0' }}
              >
                <span className={css.apunte}>
                  {cuando(n.cuando) || 'Sin fecha'}
                  {fechaLarga(n.cuando) && ` · ${fechaLarga(n.cuando)}`}
                </span>
                <span
                  style={{
                    fontSize: 14.5,
                    fontWeight: 300,
                    lineHeight: 1.55,
                    color: 'var(--ink-3)',
                  }}
                >
                  {n.texto}
                </span>
              </article>
            ))
          )}

          <form
            onSubmit={apuntar}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}
          >
            <textarea
              className={css.campoCaja}
              rows={3}
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              disabled={guardando}
              aria-label="Nueva nota de seguimiento"
              placeholder="Qué hablasteis, qué quedó pendiente…"
            />
            <button
              type="submit"
              className={css.btn}
              // Se bloquea mientras guarda para que dos clics seguidos no
              // apunten la misma nota dos veces.
              disabled={guardando || !texto.trim()}
            >
              {guardando ? 'Guardando…' : 'Apuntar'}
            </button>
          </form>

          {falloApunte && (
            <p className={css.avisoFallo} role="alert">
              {falloApunte}
            </p>
          )}
        </section>
      </div>
    </dialog>
  );
}
