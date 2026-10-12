import { APERTURA_POR_PAISES, DIA_APERTURA, HORA_ESPANA } from './apertura';
import type { Campana } from './plantillas-campana';

/**
 * La serie del lanzamiento de la Comunidad Divine, ya escrita.
 *
 * Va a la lista de espera: un correo por semana hasta la última, y en la
 * última uno cada día, contando hacia atrás hasta la apertura. Cada uno trae
 * algo que sirva aunque nunca entren en la comunidad —postura, cabina,
 * clientas, redes, cómo hablar de su trabajo—, porque un correo que solo dice
 * «queda poco» se deja de abrir al tercero.
 *
 * Esto es solo el punto de partida: se copia a Firestore la primera vez que se
 * abre la pantalla Correos y desde ahí Sorela lo lee, lo cambia o lo pausa.
 * Cambiar este archivo después NO cambia lo que ya está guardado.
 *
 * Nada de promesas de salud ni de precios: hablan de oficio, no de resultados.
 */

const WEB = process.env.NEXT_PUBLIC_WEB || 'https://sorelacarodivine.com';
const COMUNIDAD = `${WEB}/comunidad`;

type Semilla = Omit<Campana, 'estado' | 'resultado' | 'audiencia' | 'serie'>;

const SEMILLAS: Semilla[] = [
  {
    id: 'lanzamiento-01-manos',
    fecha: '2026-10-16',
    etiqueta: 'Camino a la Comunidad Divine · 1',
    asunto: 'Tus manos son tu herramienta más cara, {nombre}',
    cuerpo: `Te escribo cada semana hasta que abra la Comunidad Divine, y la última semana, un correo cada día. Ninguno va a ser para venderte nada: quiero que cada uno te deje algo que puedas usar mañana en cabina.

Empiezo por lo que más se descuida en nuestro oficio: **tu propio cuerpo**. Una terapeuta con las muñecas cargadas trabaja peor a las cinco de la tarde que a las diez de la mañana, y la clienta lo nota aunque no sepa decir qué.

Tres cosas que hago yo y que te recomiendo:

- **La fuerza sale de las piernas, no de las muñecas.** Pies separados, rodillas un poco flexionadas, y el peso se desplaza con todo el cuerpo. Si al terminar te duelen los antebrazos, estás empujando con ellos.
- **La camilla a la altura de tus nudillos** con los brazos estirados hacia abajo. Demasiado alta te sube los hombros; demasiado baja te dobla la espalda.
- **Dos minutos entre clienta y clienta**: abrir y cerrar las manos, girar las muñecas, estirar los dedos hacia atrás. Parece poco. Es lo que te permite seguir haciendo esto dentro de diez años.

Esta semana, fíjate solo en una cosa: dónde te duele al acabar el día. Eso te dice qué parte de tu postura está trabajando de más.

Te escribo el viernes que viene.`,
    boton: { texto: 'Qué es la Comunidad Divine', enlace: COMUNIDAD },
  },
  {
    id: 'lanzamiento-02-volver',
    fecha: '2026-10-23',
    etiqueta: 'Camino a la Comunidad Divine · 2',
    asunto: 'Por qué una clienta vuelve (y por qué no)',
    cuerpo: `Casi nunca una clienta deja de venir por la técnica. Deja de venir porque no sabía qué esperar, porque nadie le escribió después, o porque no entendió por qué tenía que volver.

Lo que a mí me ha funcionado, y lo que más repito a mis alumnas:

- **La primera sesión empieza antes de tocar.** Diez minutos de conversación: qué busca, cómo es su día, qué ha probado. Apúntalo en su ficha. La segunda vez que venga, pregúntale por algo de lo que te contó.
- **Explica lo que vas a hacer, en una frase.** No hace falta un discurso. «Hoy vamos a trabajar despacio en piernas y abdomen; si algo te molesta, me lo dices.» La tranquilidad también es parte de la sesión.
- **Un mensaje a las 48 horas.** Corto y tuyo: «¿Cómo te has sentido estos días?». Es lo que más fideliza y lo que casi nadie hace.
- **Propón un plan, no una sesión suelta.** Si crees que necesita varias, díselo con claridad y explícale por qué. Quien entiende el plan, vuelve.
- **Fotos solo con su permiso por escrito**, siempre con la misma luz y la misma postura. Le sirven a ella para ver su proceso y a ti para aprender.

Prueba esta semana el mensaje de las 48 horas con todas. Y si quieres, respóndeme a este correo y cuéntame qué tal: lo leo yo.

El viernes que viene empieza la cuenta atrás.`,
    boton: null,
  },
  {
    id: 'lanzamiento-03-semana',
    fecha: '2026-10-30',
    etiqueta: 'Faltan 7 días',
    asunto: 'Falta una semana para la Comunidad Divine',
    cuerpo: `Dentro de siete días, el **${DIA_APERTURA} a las ${HORA_ESPANA}** (hora de España), abro la Comunidad Divine.

Las horas en cada país: ${APERTURA_POR_PAISES}.

Te cuento qué es, sin adornos:

- **Una clase en vivo al mes** conmigo, con lo nuevo del método.
- **Tus casos mirados uno a uno**: me traes una duda real de tu cabina y la trabajamos.
- **Un espacio privado** donde preguntarme y compartir con otras terapeutas que trabajan como tú.

La creé porque lo que más me piden después de una formación es no quedarse solas: alguien a quien preguntar el día que una clienta no responde como esperabas.

Desde hoy y hasta el día de la apertura te escribo **cada mañana** con una idea concreta para tu trabajo. Siete correos cortos. Si alguno no te sirve, bórralo sin culpa; si alguno te sirve, me encantaría que me lo dijeras.`,
    boton: { texto: 'Ver la Comunidad Divine', enlace: COMUNIDAD },
  },
  {
    id: 'lanzamiento-04-ritmo',
    fecha: '2026-10-31',
    etiqueta: 'Faltan 6 días',
    asunto: 'El ritmo lo es todo',
    cuerpo: `Si tuviera que quedarme con una sola cosa de todo lo que enseño, sería esta: **el ritmo**.

Dos terapeutas pueden hacer exactamente los mismos movimientos y la clienta va a sentir sesiones completamente distintas. La diferencia casi siempre está en la cadencia: una mantiene un ritmo constante y la otra acelera cuando se cansa o cuando va con prisa.

Lo que te propongo hoy:

- **Respira con el movimiento.** Cuando tu respiración se acelera, tus manos también. Si notas que vas deprisa, vuelve a la respiración antes que a la técnica.
- **La presión, igual de principio a fin de cada pasada.** Lo que incomoda no suele ser la presión alta, sino los cambios bruscos.
- **Grábate un minuto** (solo las manos, con permiso de quien esté en la camilla, o sobre ti misma) y cuenta el ritmo al verlo. Casi todas descubrimos que aceleramos sin darnos cuenta.

Mañana: tu cabina, y todo lo que dice de ti antes de que empieces.`,
    boton: null,
  },
  {
    id: 'lanzamiento-05-cabina',
    fecha: '2026-11-01',
    etiqueta: 'Faltan 5 días',
    asunto: 'Tu cabina habla antes que tú',
    cuerpo: `Una clienta decide si confía en ti en los primeros dos minutos, y en esos dos minutos todavía no la has tocado. Lo que habla es la cabina.

Revisa hoy esta lista, de pie en la puerta, como si fueras ella:

- **Temperatura.** Va a estar quieta y con poca ropa: lo que a ti te parece bien a ella le da frío. Una manta a mano cambia la sesión.
- **Luz.** Indirecta y cálida. Ninguna luz de techo directa a los ojos de quien está tumbada.
- **Olor.** Limpio, suave, y siempre el mismo. El olor es lo que más se recuerda de un sitio.
- **Sonido.** Música sin letra o silencio. Nada de notificaciones del móvil: el teléfono, fuera.
- **Lo que ve.** Toallas dobladas, nada amontonado, ningún bote abierto. El orden se lee como cuidado.

Y un ritual de bienvenida que sea siempre igual: un vaso de agua, dónde dejar sus cosas, cómo se tiene que tumbar. Cuando todo se repite, ella se relaja antes.

Mañana hablamos de algo que cuesta a casi todas: cómo hablar de tu trabajo sin pedir perdón.`,
    boton: null,
  },
  {
    id: 'lanzamiento-06-valor',
    fecha: '2026-11-02',
    etiqueta: 'Faltan 4 días',
    asunto: 'Cómo hablar de tu trabajo sin pedir perdón',
    cuerpo: `Muchas terapeutas excelentes trabajan por debajo de lo que valen por una sola razón: no saben cómo contar lo que hacen sin sentirse incómodas.

Tres ideas que me cambiaron la forma de hablar con mis clientas:

- **Explica el proceso, no prometas resultados.** «Trabajo con una técnica manual, lenta y profunda; cada sesión dura tanto y te recomiendo tantas» da más confianza que cualquier promesa. Y te protege.
- **Ten tu frase preparada.** Cuando te pregunten «¿y esto qué es?», contesta siempre lo mismo, en dos frases. Escríbela hoy y léela en voz alta hasta que te salga natural.
- **No regales descuentos para convencer.** Si quieres premiar a alguien, que sea a quien vuelve: un bono de varias sesiones, una sesión de seguimiento. El descuento a quien todavía duda le dice que tu trabajo vale menos.

Y algo más personal: no pidas perdón por cobrar. Has estudiado, practicas, cuidas tu cabina y tus manos. Eso tiene un valor, y quien lo entiende es justo la clienta que quieres.

Mañana: qué publicar en redes si no te gusta salir en cámara.`,
    boton: null,
  },
  {
    id: 'lanzamiento-07-redes',
    fecha: '2026-11-03',
    etiqueta: 'Faltan 3 días',
    asunto: 'Qué publicar si no te gusta salir en cámara',
    cuerpo: `No hace falta bailar ni hablar a cámara para que tus redes te traigan clientas. Hace falta que se vea **cómo trabajas** y **quién eres**.

Ideas que puedes grabar esta misma semana sin enseñar la cara:

- **Tus manos en movimiento**, diez segundos, con buena luz. El ritmo y el cuidado se ven.
- **La preparación de la cabina**: las toallas, la camilla, la luz. Es lo que tu clienta va a vivir.
- **Una pregunta que te hacen siempre**, contestada en un texto corto. Cada pregunta frecuente es una publicación.
- **Antes y después, solo con permiso por escrito** y con la misma luz y postura. Sin exagerar, sin filtros.
- **Un día normal tuyo**: el café antes de abrir, la agenda, lo que aprendes. La gente vuelve por la persona.

Un truco: publica menos pero con constancia. Dos veces por semana durante tres meses vale más que todos los días durante dos semanas.

Pasado mañana abrimos. Mañana te cuento lo que aprendí en Termatalia.`,
    boton: null,
  },
  {
    id: 'lanzamiento-08-termatalia',
    fecha: '2026-11-04',
    etiqueta: 'Faltan 2 días',
    asunto: 'Lo que aprendí en Termatalia',
    cuerpo: `En septiembre presenté la Técnica Divine en Termatalia, en Ourense: profesionales de dieciséis países y una charla con la Asociación Gallega de Esteticistas.

Me traje muchas cosas, pero una sobre todo: **casi todas las preguntas que me hicieron eran de terapeutas que trabajan solas.** Cómo saber si lo están haciendo bien. Qué hacer con una clienta que no avanza. Con quién comentar un caso raro.

Ese es el motivo por el que existe la Comunidad Divine. Aprender una técnica se hace en unos días; dominarla lleva años, y se hace mucho mejor acompañada: viendo cómo lo resuelven otras, preguntando sin miedo a parecer novata, volviendo a lo básico cuando hace falta.

Si quieres ver cómo fue, lo conté con fotos en el blog.

Pasado mañana a las ${HORA_ESPANA} (hora de España) abro las puertas. Mañana te escribo con todo lo que necesitas tener listo.`,
    boton: { texto: 'Leer: Técnica Divine en Termatalia', enlace: `${WEB}/blog/tecnica-divine-termatalia-2026` },
  },
  {
    id: 'lanzamiento-09-manana',
    fecha: '2026-11-05',
    etiqueta: 'Falta 1 día',
    asunto: 'Mañana a las {hora}: lo que necesitas tener listo',
    cuerpo: `Mañana, **${DIA_APERTURA} a las ${HORA_ESPANA}** (hora de España), abre la Comunidad Divine.

Las horas en cada país: ${APERTURA_POR_PAISES}.

Para que no se te escape:

- **Pon una alarma** cinco minutos antes, con la hora de tu país.
- **Ten a mano este correo**: mañana te escribo con el enlace para entrar.
- **Piensa en una duda real** de tu cabina. La primera clase en vivo será el mejor sitio para traerla.

Gracias por haber estado en la lista estas semanas. Cada respuesta que me habéis mandado la he leído, y muchas me han ayudado a preparar lo que viene.

Mañana nos vemos dentro.`,
    boton: null,
  },
  {
    id: 'lanzamiento-10-hoy',
    fecha: '2026-11-06',
    etiqueta: 'Hoy',
    asunto: 'Hoy abre la Comunidad Divine',
    cuerpo: `Hoy es el día. A las **${HORA_ESPANA}** (hora de España) abro la Comunidad Divine.

Las horas en cada país: ${APERTURA_POR_PAISES}.

Desde el botón de abajo tienes toda la información y cómo entrar. Si te surge cualquier duda, respóndeme a este correo: hoy estoy pendiente de todo.

Gracias por esperar conmigo.`,
    boton: { texto: 'Entrar a la Comunidad Divine', enlace: COMUNIDAD },
  },
];

export const SERIE_LANZAMIENTO = 'lanzamiento';

export function serieLanzamiento(): Omit<Campana, 'resultado'>[] {
  return SEMILLAS.map((s) => ({
    ...s,
    asunto: s.asunto.replace('{hora}', HORA_ESPANA),
    audiencia: 'espera',
    estado: 'programada',
    serie: SERIE_LANZAMIENTO,
  }));
}
