/**
 * La protección de datos de la web, en un solo sitio.
 *
 * De aquí tiran tres cosas que tienen que decir exactamente lo mismo: la
 * política de privacidad completa (`/legal/privacidad`), la de cookies
 * (`/legal/cookies`) y el recuadro corto que acompaña a cada formulario —la
 * «primera capa» del art. 11 de la LOPDGDD—. Con textos escritos por
 * separado, un día el formulario promete algo que la política no dice.
 *
 * TODO LO QUE HAY AQUÍ DESCRIBE LO QUE LA WEB HACE DE VERDAD. Se repasó
 * contra el código el 13/10/2026 (rama wip/plataforma-v2): cada tratamiento
 * corresponde a un formulario o una pantalla real, cada destinatario a un
 * servicio que se llama desde el código y cada línea de ALMACENAMIENTO a algo
 * que se ha visto guardado en un navegador de pruebas. Lo que llega con la
 * entrega «plataforma v2» va marcado [v2] en un comentario: está redactado
 * para que sea cierto cuando se publique junto con ella. Si se añade un
 * formulario, un servicio, una analítica o algo que se guarde en el
 * navegador, hay que añadirlo aquí; si no, la política deja de ser cierta.
 *
 * EMBARGO hasta la apertura (6/11/2026): esto es público. Lo de dentro de la
 * plataforma se describe de forma neutra («perfil y actividad visibles para
 * otras usuarias»), sin contar qué incluye la Comunidad Divine. El detalle se
 * da dentro, en el momento de recoger el dato.
 *
 * LA IDENTIDAD DE SORELA (nombre, NIF y domicilio) NO ESTÁ AQUÍ. El
 * repositorio es público. Se lee en el momento de Firestore (`ajustes/
 * fiscales`), que es donde ya están para las facturas.
 */

/** El correo para todo lo relacionado con los datos. */
export const CORREO_PRIVACIDAD = 'sorelacarooficial@gmail.com';

/**
 * Cuándo se revisó por última vez. Cambiarlo cada vez que se toque esto: el
 * acuerdo de confidencialidad guarda esta fecha como la versión de la política
 * que se le enseñó a quien firma.
 */
export const REVISADA = '13 de octubre de 2026';

export type Tratamiento = {
  /** Para qué formulario o parte de la web. */
  donde: string;
  datos: string;
  finalidad: string;
  base: string;
  /** La base en dos palabras para la cabecera de la tarjeta, cuando hay más de una. */
  baseResumen?: string;
  conservacion: string;
  /** De dónde salen los datos cuando no los da la propia persona (art. 14 RGPD). */
  origen?: string;
  /** Quién más los ve, si no es solo Sorela. */
  quienVe?: string;
};

export const TRATAMIENTOS: Tratamiento[] = [
  /*
   * Dos permisos separados (art. 7.4 RGPD, art. 21 LSSI): la casilla
   * obligatoria es para lo que pides; la de novedades es opcional, va sin
   * marcar y se guarda aparte (`comercial` en el contacto, que respeta
   * lib/campanas.ts). Contestar una consulta no necesita consentimiento: es
   * atender tu petición (6.1.b).
   */
  {
    donde: 'Lista de espera, información y contacto',
    datos:
      'Nombre, correo electrónico y, si los das, WhatsApp, ciudad, a qué te dedicas y el mensaje que escribas. También por dónde llegaste a la web (un buscador, una red social o un enlace de campaña), en qué página dejaste tus datos, qué casillas marcaste, la fecha y la versión de esta política que tenías delante.',
    finalidad:
      'Atender lo que pides: contestar tu consulta, enviarte la información que solicitas o guardar tu sitio en la lista de espera y avisarte de la apertura de la Comunidad Divine y de su masterclass. Solo si marcas la casilla opcional de novedades, contarte también por correo las próximas formaciones de la Técnica Divine. Cada correo te dice cómo darte de baja: con su enlace o respondiendo al propio correo.',
    base:
      'Para contestarte o enviarte la información, tu propia petición (art. 6.1.b RGPD). Para la lista de espera y para las novedades, tu consentimiento, cada uno con su casilla, que puedes retirar cuando quieras (art. 6.1.a RGPD y art. 21 de la LSSI). Las novedades son opcionales: sin ellas el formulario funciona igual.',
    baseResumen: 'Petición y consentimiento',
    conservacion:
      'Hasta que pidas que se borren o retires tu consentimiento. Si te das de baja de los correos, se guarda solo tu dirección en la lista de bajas, sin plazo, para no volver a escribirte.',
  },
  {
    donde: 'Grupo de WhatsApp de la lista de espera',
    datos:
      'Si decides entrar en el grupo, tu nombre o alias de WhatsApp, tu número de teléfono, tu foto de perfil y lo que escribas en él.',
    finalidad: 'Compartir con quienes están en la lista de espera los avisos de la apertura y de la masterclass.',
    base: 'Tu consentimiento, que das al unirte. Entrar es opcional: la lista de espera funciona igual sin el grupo.',
    conservacion: 'Mientras sigas en el grupo. Puedes salir cuando quieras desde WhatsApp.',
    quienVe:
      'Tu número, tu nombre y lo que escribas los ven todas las participantes y las administradoras del grupo. WhatsApp (Meta) trata esos datos como responsable, según sus propias condiciones.',
  },
  {
    donde: 'Avisos de tu ciudad',
    datos: 'Nombre, correo electrónico y ciudad.',
    finalidad:
      'El aviso que pides, y solo ese: en el buscador de terapeutas, decirte cuándo hay una terapeuta certificada en Técnica Divine cerca de ti; en la página de formaciones, decirte cuándo hay una convocatoria en tu zona y tener en cuenta tu ciudad al organizar las próximas. No recibes la información general, ni publicidad, ni las campañas de correo.',
    base: 'Tu consentimiento, que puedes retirar cuando quieras.',
    conservacion: 'Hasta que pidas que se borren o retires tu consentimiento.',
  },
  {
    donde: 'Cuenta en la plataforma',
    datos:
      'Nombre, correo electrónico, contraseña (la guarda cifrada Google Firebase; Sorela no la ve), qué buscas al darte de alta, la invitación con la que entraste si la hay, a qué formaciones tienes acceso y la fecha de tu último acceso. Si Sorela te invita, ella apunta tu nombre y tu correo para crear la invitación.',
    finalidad:
      'Crear y mantener tu cuenta, darte acceso a tu espacio y a lo que contrates, y enviarte los correos necesarios del servicio (acceso, avisos de tu cuenta). Tu cuenta también queda anotada en la lista de contactos de Sorela, que puede escribirte por correo sobre formaciones de la Técnica Divine parecidas a lo que ya tienes. Puedes negarte a esos correos al darte de alta, marcando la casilla «No quiero novedades por correo», y en cualquier momento con el enlace de baja de cada uno o escribiendo a ' +
      CORREO_PRIVACIDAD +
      '.',
    base:
      'La relación contractual al darte de alta (art. 6.1.b RGPD). Para los correos sobre formaciones parecidas, el art. 21.2 de la LSSI y el interés legítimo de Sorela en informar a sus usuarias, con tu derecho a oponerte.',
    baseResumen: 'Contrato',
    conservacion:
      'Mientras tengas la cuenta. Al borrarla se eliminan tu acceso, tu perfil, tus fotos y tu progreso; lo que deba conservarse por ley (facturas, acuerdos firmados) se guarda bloqueado los plazos legales.',
    origen: 'Tú misma al registrarte o, si te invita Sorela, ella con los datos que le diste.',
  },
  /*
   * Perfiles, publicaciones, «me gusta» y el resumen de actividad [v2: foto y
   * desglose en el resumen; «me gusta» entre alumnas]. Contado sin decir qué
   * incluye la Comunidad Divine (embargo): basta con saber qué se guarda y
   * quién lo ve.
   */
  {
    donde: 'Perfil y actividad dentro de la plataforma',
    datos:
      'Tu foto de perfil, tu nombre, tu presentación, tu especialidad, tu ciudad y tu Instagram si los pones, las fotos que subas con su pie, tus publicaciones, respuestas y reacciones, y un resumen mensual de tu actividad dentro de la plataforma.',
    finalidad:
      'Que puedas presentarte y participar con otras usuarias dentro de la plataforma. El resumen de actividad solo cuenta tu participación: no se usa para tomar decisiones sobre ti ni tiene efectos jurídicos.',
    base: 'La relación contractual: es parte del servicio de la plataforma al que te das de alta.',
    conservacion:
      'Tu perfil y tus fotos, mientras tengas la cuenta. Si la borras, tus publicaciones y respuestas se mantienen sin fotos para no romper las conversaciones de otras personas, igual que los resúmenes de actividad de meses ya cerrados; si quieres que se borren también, pídelo y se hace.',
    quienVe: 'Las demás usuarias con acceso a la plataforma. No se publica en la web.',
  },
  {
    donde: 'Formación online',
    datos: 'Qué clases has visto y hasta dónde, tu avance en la formación y, al terminarla, tu certificado con tu nombre.',
    finalidad: 'Que puedas seguir donde lo dejaste, ver tu avance y obtener tu certificado, y que Sorela pueda acompañarte en la formación.',
    base: 'La relación contractual de la formación que has contratado.',
    conservacion: 'Mientras tengas la cuenta.',
  },
  /* [v2] Convocatorias de formación presencial con inscritas y pagos. No hay
     formulario público: los apunta Sorela. Por eso lleva `origen`. */
  {
    donde: 'Inscripción en una formación presencial',
    datos: 'Nombre, correo, teléfono, lo que has pagado y el estado del pago, y las notas de Sorela sobre tu inscripción.',
    finalidad: 'Gestionar tu plaza en la convocatoria, los pagos y el contacto contigo para organizarla.',
    base:
      'Las medidas precontractuales que pides y el contrato de la formación (art. 6.1.b RGPD); para los pagos, además, las obligaciones fiscales (art. 6.1.c).',
    conservacion:
      'Mientras se organiza e imparte la convocatoria, hasta que Sorela borra la inscripción o la convocatoria. Lo que tenga que constar en una factura se conserva con la facturación.',
    origen: 'Los apunta Sorela con lo que le das al reservar tu plaza (por WhatsApp, correo o en persona) o desde su lista de contactos.',
  },
  {
    donde: 'Agenda de la plataforma',
    datos:
      'Las citas que apuntas en tu agenda y lo que escribas en ellas, que puede incluir el nombre y el teléfono de tus propias clientas.',
    finalidad: 'Que tengas tu agenda dentro de la plataforma.',
    base:
      'La relación contractual. Sobre los datos de tus clientas decides tú: Sorela solo los guarda por ti para que uses la agenda, no los ve para nada más ni los usa.',
    conservacion: 'Hasta que borres la cita o tu cuenta.',
  },
  {
    donde: 'Lista de contactos de Sorela y ayuda para responder',
    datos:
      'Nombre, correo, teléfono, ciudad, a qué te dedicas, por dónde llegaste, en qué punto está la conversación contigo y las notas de Sorela.',
    finalidad:
      'Llevar el seguimiento de las personas que se interesan por la Técnica Divine y contestarles. Si Sorela te apunta ella (porque la conociste en persona o le escribiste por otra vía), solo te manda la información de la Técnica Divine y las novedades por correo si se lo has pedido, y queda anotado cuándo. Para ordenar a quién responder primero y preparar un borrador de mensaje, Sorela se ayuda de una inteligencia artificial (Claude, de Anthropic), que recibe tu nombre de pila, por dónde llegaste, qué buscas, tu ciudad, a qué te dedicas, lo que escribiste en el formulario, en qué punto está la conversación, los días que llevas esperando y las últimas notas de Sorela; nunca tu correo, tu teléfono ni tus apellidos. Ningún mensaje sale solo: Sorela lo lee, lo cambia y decide si lo envía.',
    base:
      'Tu consentimiento si dejaste tus datos en un formulario; si contactaste con Sorela por otra vía, su interés legítimo en atender a quien se dirige a ella (art. 6.1.f RGPD) y, para la información y las novedades por correo, que se lo hayas pedido.',
    baseResumen: 'Consentimiento o interés legítimo',
    conservacion: 'Hasta que pidas que se borren o retires tu consentimiento.',
    origen:
      'Los formularios de esta web, tu cuenta en la plataforma o tu contacto directo con Sorela (Instagram, WhatsApp, teléfono, una feria). En este último caso, los apunta ella.',
  },
  {
    donde: 'Correo electrónico',
    datos:
      'Lo que escribes al buzón de la web y las respuestas; de los correos que envía la web, a quién, cuándo, el asunto y si se entregó.',
    finalidad: 'Contestar a quien escribe, enviar los correos de la web y comprobar que llegan.',
    base: 'Atender tu petición (art. 6.1.b RGPD) y el interés legítimo en que los correos funcionen.',
    conservacion:
      'Los mensajes del buzón, mientras sean necesarios para atenderte. El registro de envíos se borra solo a los 30 días; se guarda aparte una marca técnica para no mandarte dos veces el mismo correo.',
  },
  {
    donde: 'Acuerdo de confidencialidad de las alumnas',
    datos:
      'Nombre y apellidos, número de documento de identidad o pasaporte, correo, teléfono, lugar de firma, la firma que dibujas y, para poder acreditar la firma, la fecha y hora, la dirección IP y el navegador desde el que firmas.',
    finalidad:
      'Formalizar y custodiar el acuerdo, poder acreditar que lo firmaste y enviarte una copia firmada junto con el dossier de la formación.',
    base:
      'La ejecución del propio acuerdo que firmas, y el interés legítimo de Sorela Caro en poder demostrar que se firmó y qué se firmó.',
    conservacion:
      'Mientras dure la obligación de confidencialidad y, después, durante los plazos de prescripción de las acciones legales (cinco años con carácter general).',
  },
  /*
   * La ficha del mapa. Es lo único de la plataforma que se PUBLICA: por eso va
   * con su propio permiso, separado del alta, y se retira con un botón.
   *
   * La política es pública: aquí no se dice qué da acceso al mapa (membresía,
   * certificación). Hasta la masterclass, eso no se cuenta fuera.
   */
  {
    donde: 'Ficha pública en Localiza tu terapeuta',
    datos:
      'Tu nombre, tu foto de perfil, el nombre de tu centro, tu frase y tu texto de presentación, tu especialidad, tus tratamientos, tu ciudad y tu país, y el WhatsApp, el Instagram y la web que pongas. La dirección y el código postal de tu cabina, solo si eliges mostrarlos. Para situarte en el mapa se calculan las coordenadas del centro de tu ciudad o, si muestras la dirección, las de tu cabina.',
    finalidad:
      'Publicar tu ficha en la web para que quien busca una terapeuta certificada en Técnica Divine cerca de su casa te encuentre y te escriba directamente.',
    base: 'Tu consentimiento, que das aparte, marcando su propia casilla, y puedes retirar cuando quieras quitando la ficha desde la plataforma.',
    conservacion:
      'En la web, mientras la tengas publicada: se quita en cuanto la retiras, cuando dejas de cumplir las condiciones para aparecer o si borras tu cuenta. Lo que escribiste se queda como borrador dentro de la plataforma, sin publicar, hasta que borres la ficha o tu cuenta. La constancia de tu permiso (fecha, texto aceptado y, si lo retiras, cuándo) se guarda aparte, también después de borrar la ficha, solo para poder acreditarlo. Las coordenadas calculadas se guardan sin tu nombre ni la dirección, para no repetir la consulta.',
    quienVe: 'Cualquiera que visite la web.',
  },
  /* [v2] Vídeos de clase subidos a Storage. Quien sale en ellos (una modelo)
     no es usuaria: su imagen la recoge Sorela al grabar. */
  {
    donde: 'Vídeos de las clases',
    datos: 'La imagen y la voz de quien aparece en los vídeos de las clases, por ejemplo como modelo.',
    finalidad: 'Enseñar la técnica a las alumnas dentro del aula de la plataforma.',
    base: 'El consentimiento de la persona que aparece, que Sorela le pide antes de grabar.',
    conservacion: 'Mientras el vídeo forme parte de la formación o hasta que la persona retire su consentimiento.',
    quienVe: 'Solo las alumnas con acceso a esa formación, con enlaces que caducan. No se publican en la web.',
  },
  {
    donde: 'Estadísticas de visitas de la web',
    datos:
      'La página que visitas, desde dónde llegas (otra web o un enlace de campaña), el tipo de dispositivo, el país y la ciudad aproximados que deduce el servidor a partir de tu IP, y qué parte de los vídeos de la web se ve. Para contar personas distintas en un día se calcula un resumen cifrado (seudonimizado) de tu IP, tu navegador y la fecha, con una clave secreta; la IP en sí no se guarda.',
    finalidad: 'Saber cuántas personas visitan la web, qué páginas y vídeos interesan y de dónde llega la gente, solo en cifras totales.',
    base:
      'El interés legítimo de Sorela en saber cómo se usa su web (art. 6.1.f RGPD). No se guarda nada en tu navegador para esto ni se comparte con nadie.',
    conservacion:
      'El resumen cifrado se borra a los dos días. Lo que queda son contadores (por ejemplo, «35 visitas desde Madrid el martes») que ya no se refieren a nadie.',
  },
  {
    donde: 'Seguridad y funcionamiento',
    datos: 'La dirección IP y el navegador de cada petición a la web.',
    finalidad: 'Servir la web, protegerla de abusos (por ejemplo, frenar a quien envía cientos de peticiones por minuto) y resolver fallos.',
    base: 'El interés legítimo en mantener la web segura y funcionando (art. 6.1.f y considerando 49 del RGPD).',
    conservacion: 'El freno de abusos solo la usa durante un minuto, en memoria. Los registros técnicos del alojamiento duran pocos días.',
  },
  {
    donde: 'Facturación',
    datos: 'Nombre o razón social, NIF y domicilio fiscal.',
    finalidad: 'Emitir y conservar las facturas de las formaciones.',
    base: 'El cumplimiento de las obligaciones fiscales y mercantiles (art. 6.1.c RGPD).',
    conservacion: 'Los plazos que marca la ley: seis años para la documentación mercantil (art. 30 del Código de Comercio).',
  },
];

/**
 * Quién trata los datos por encargo de Sorela (art. 28 RGPD), dónde, y con
 * qué garantía si es fuera del Espacio Económico Europeo (arts. 44–49).
 *
 * El Marco de Privacidad de Datos UE‑EE. UU. sigue en vigor (el Tribunal
 * General lo confirmó el 3/9/2025, asunto T‑553/23; hay un recurso de
 * casación pendiente, C‑703/25 P). Como puede caer, se nombran las DOS
 * garantías allí donde existen: si el Marco cae, siguen las cláusulas
 * contractuales tipo (Decisión 2021/914) del contrato de cada proveedor.
 */
export type Encargado = { quien: string; para: string; donde: string; garantia: string };

const DPF_Y_CCT =
  'Marco de Privacidad de Datos UE‑EE. UU. (Decisión 2023/1795) y, además, cláusulas contractuales tipo de la Comisión Europea (Decisión 2021/914) en su contrato de encargo.';

export const ENCARGADOS: Encargado[] = [
  {
    quien: 'Google (Firebase, Google Cloud, Gmail y Hojas de cálculo de Google)',
    para:
      'Guardar los datos de la web y de la plataforma, las fotos, los vídeos y los documentos; gestionar el acceso con contraseña; y, como vía de reserva, enviar correos y anotar los contactos de los formularios en una hoja de cálculo.',
    donde: 'Estados Unidos, entre otros países donde Google tiene servidores.',
    garantia: DPF_Y_CCT,
  },
  {
    quien: 'Resend',
    para:
      'Enviar los correos de la web (confirmaciones, avisos, el acuerdo firmado y el dossier, respuestas del buzón): recibe la dirección, el asunto, el contenido y los adjuntos.',
    donde: 'Estados Unidos.',
    garantia: DPF_Y_CCT,
  },
  {
    quien: 'Vercel',
    para: 'Alojar y ejecutar la web, sus tareas programadas y sus registros técnicos.',
    donde: 'Estados Unidos, entre otros países de su red.',
    garantia: DPF_Y_CCT,
  },
  {
    quien: 'Arsys',
    para: 'El buzón de correo de la web, donde llegan los mensajes que escribes.',
    donde: 'España.',
    garantia: 'No hay transferencia internacional.',
  },
  {
    quien: 'Anthropic (Claude)',
    para:
      'Ayudar a Sorela a ordenar y redactar sus respuestas a los contactos, con los datos que se indican arriba y nunca el correo, el teléfono ni los apellidos.',
    donde: 'Estados Unidos.',
    garantia: 'Cláusulas contractuales tipo de la Comisión Europea (Decisión 2021/914) incluidas en su contrato de encargo.',
  },
  {
    quien: 'OpenStreetMap Foundation (Nominatim)',
    para:
      'Situar las fichas en el mapa de terapeutas. Solo recibe la ciudad y el país y, si eliges mostrarla, la dirección y el código postal; nunca tu nombre ni tu contacto.',
    donde: 'Reino Unido.',
    garantia: 'Decisión de adecuación de la Comisión Europea para el Reino Unido.',
  },
];

/**
 * Servicios de terceros que NO son encargados: los usas tú, directamente, y
 * cada uno responde de lo que hace con tus datos según sus condiciones.
 */
export const TERCEROS: { quien: string; cuando: string }[] = [
  {
    quien: 'WhatsApp (Meta)',
    cuando:
      'Si entras en el grupo de la lista de espera o escribes a Sorela o a una terapeuta por WhatsApp desde la web.',
  },
  {
    quien: 'Zoom',
    cuando: 'Si te conectas a la masterclass en directo con el enlace que recibes por correo.',
  },
  {
    quien: 'Instagram, Google Maps y las webs de las terapeutas',
    cuando: 'Solo si abres esos enlaces desde la web.',
  },
];

/**
 * Lo que la web o sus correos INSERTAN de otros y que, por eso, decide Sorela:
 * quien incrusta un contenido ajeno responde junto con ese tercero de la
 * recogida y la transmisión de tus datos (TJUE, C‑40/17, Fashion ID). Después,
 * lo que el tercero haga con ellos es cosa suya.
 */
export const INSERTADOS: { quien: string; cuando: string }[] = [
  {
    quien: 'YouTube (Google)',
    cuando:
      'Los vídeos de YouTube del blog y del aula. Hasta que le das al play a uno no se carga nada de Google; al darle, ese vídeo se conecta con YouTube, que recibe tu IP y puede guardar datos en tu navegador. Sorela y Google son corresponsables de esa conexión; lo que Google haga después con tus datos lo decide Google, según su política.',
  },
  {
    quien: 'Google Fonts',
    cuando:
      'Los correos de la web piden a Google la tipografía de la marca. Si tu programa de correo carga las imágenes y las fuentes, Google recibe tu IP al abrir el correo. Si no las carga, el correo se lee igual con una letra del sistema.',
  },
];

/**
 * Lo que se guarda en el navegador: cookies y almacenamiento local, sesión
 * o IndexedDB. Todo cuenta igual para la ley (art. 22.2 LSSI; CEPD,
 * Directrices 2/2023). Visto en Chromium el 13/10/2026.
 *
 * Por qué NO hay aviso de cookies: todo lo de esta lista es técnico o una
 * preferencia que elige la propia persona, que la ley exime de consentimiento.
 * Para que fuera así de verdad se quitaron las dos cosas que no lo eran: el
 * `sessionStorage` del medidor de visitas (components/Medidor.tsx) y los
 * reproductores de YouTube que se cargaban solos (components/VideoYoutube).
 * Si se añade algo que no sea técnico, hace falta el aviso ANTES de publicarlo.
 */
export type Almacen = {
  nombre: string;
  tipo: string;
  titular: string;
  finalidad: string;
  duracion: string;
  /** A quién se le guarda. */
  cuando: string;
};

export const ALMACENAMIENTO: Almacen[] = [
  {
    nombre: 'divine_sesion',
    tipo: 'Cookie',
    titular: 'Propia',
    finalidad: 'Mantener abierta tu sesión en la plataforma. Técnica.',
    duracion: '5 días, o hasta que sales.',
    cuando: 'Si entras con tu cuenta.',
  },
  {
    nombre: 'divine-tema',
    tipo: 'Almacenamiento local',
    titular: 'Propia',
    finalidad: 'Recordar si elegiste el modo claro u oscuro. Preferencia que eliges tú.',
    duracion: 'Hasta que lo borres.',
    cuando: 'Si cambias el modo.',
  },
  {
    nombre: 'firebase-heartbeat-database',
    tipo: 'IndexedDB',
    titular: 'Google Firebase (por encargo de Sorela)',
    finalidad:
      'La crea la librería de acceso de Google Firebase al entrar o registrarte. Guarda las fechas y la versión de la librería usada y las envía a Google con cada petición de acceso, para sus estadísticas de uso de la librería. No contiene tu nombre ni tu correo. Forma parte de la librería con la que se inicia sesión y solo aparece cuando entras o te registras.',
    duracion: 'Hasta que la borres.',
    cuando: 'Si entras o te registras.',
  },
  {
    nombre: 'divine-avisos-desde, divine-avisos-vistos, divine-subida-clase',
    tipo: 'Almacenamiento local',
    titular: 'Propia',
    finalidad: 'Herramientas del panel de administración: qué avisos se han visto y retomar la subida de un vídeo. Técnica.',
    duracion: 'Los avisos, hasta que se borren; la subida, 6 días como máximo.',
    cuando: 'Solo en el navegador de la administradora.',
  },
  {
    nombre: 'Datos de YouTube',
    tipo: 'Cookies, almacenamiento local e IndexedDB',
    titular: 'Google (YouTube)',
    finalidad: 'Reproducir el vídeo y lo que YouTube indique en su política.',
    duracion: 'La que fije YouTube.',
    cuando: 'Solo si le das al play a un vídeo de YouTube, y solo ese vídeo.',
  },
];

/**
 * La primera capa: lo que va junto a cada formulario.
 *
 * `finalidad` y `base` cambian según el formulario; el resto es igual en
 * todos. Es lo mínimo que hay que tener delante ANTES de enviar los datos
 * (art. 11 LOPDGDD), y remite a la política completa para lo demás.
 * `destinatarios` sustituye a la línea por defecto cuando el formulario manda
 * los datos a alguien más (la ficha se publica; el grupo de WhatsApp es de
 * Meta).
 */
export type PrimeraCapa = { finalidad: string; base: string; destinatarios?: string };

/** Quién recibe los datos en casi todos los formularios. */
export const DESTINATARIOS_GENERAL =
  'No se ceden a nadie salvo obligación legal. Google, Resend y Vercel los guardan y envían por encargo de Sorela; algunos están en EE. UU., con las garantías del RGPD.';

/** Lo que se dice de la casilla opcional, igual en todos los formularios que la tienen. */
const NOVEDADES =
  'Si marcas la casilla opcional de novedades, también las próximas formaciones por correo, con baja en cada uno.';

/** La ventana de «Apuntarme» (portada, formaciones, asistente) y la lista de espera. */
export const CAPA_INFORMACION: PrimeraCapa = {
  finalidad: `Guardar tu sitio en la lista de espera y avisarte de la apertura, o darte la información que pides. ${NOVEDADES}`,
  base: 'Tu petición y tu consentimiento; las novedades, solo con su casilla. Puedes retirarlo cuando quieras.',
  destinatarios: `${DESTINATARIOS_GENERAL} Si entras en el grupo de WhatsApp, tu número y tu nombre los verán las demás participantes y WhatsApp (Meta).`,
};

/** El formulario de contacto. Contestar no necesita permiso: es lo que pides. */
export const CAPA_CONTACTO: PrimeraCapa = {
  finalidad: `Contestar tu mensaje. ${NOVEDADES}`,
  base: 'Tu petición (art. 6.1.b RGPD); las novedades, tu consentimiento con su casilla, que puedes retirar cuando quieras.',
};

export const CAPA_CITA: PrimeraCapa = {
  finalidad: 'Avisarte cuando haya una terapeuta certificada cerca de ti, y nada más: ni información general ni publicidad.',
  base: 'Tu consentimiento, que puedes retirar cuando quieras.',
};

export const CAPA_AVISO_CONVOCATORIA: PrimeraCapa = {
  finalidad:
    'Avisarte cuando haya una convocatoria de formación en tu zona y tener en cuenta tu ciudad al organizar las próximas. Nada más: ni información general ni publicidad.',
  base: 'Tu consentimiento, que puedes retirar cuando quieras.',
};

export const CAPA_CUENTA: PrimeraCapa = {
  finalidad:
    'Crear tu cuenta y darte acceso a lo que contrates. También contarte por correo formaciones parecidas, salvo que marques «No quiero novedades por correo» (o te des de baja luego en cualquier correo).',
  base: 'La relación contractual al darte de alta; para esos correos, el interés legítimo que permite la ley de comercio electrónico con quien ya es usuaria (art. 21.2 LSSI).',
};

/** El botón «Quiero ser parte» de dentro de la plataforma. */
export const CAPA_QUIERO: PrimeraCapa = {
  finalidad: 'Apuntar que te interesa, para que Sorela te escriba sobre ello. Usa los datos de tu cuenta.',
  base: 'Tu petición al pulsar el botón (art. 6.1.b RGPD).',
};

export const CAPA_ACUERDO: PrimeraCapa = {
  finalidad:
    'Formalizar y custodiar tu acuerdo, poder acreditar la firma y enviarte tu copia y el dossier.',
  base: 'La ejecución del acuerdo que firmas y el interés legítimo en poder acreditarlo.',
};

export const CAPA_FICHA: PrimeraCapa = {
  finalidad:
    'Publicar tu ficha en «Localiza tu terapeuta» para que quien busca una terapeuta cerca te encuentre y te escriba directamente.',
  base: 'Tu consentimiento, que das aparte con su propia casilla y retiras cuando quieras quitando la ficha.',
};

/**
 * Los destinatarios de la ficha. No es «no se ceden a nadie»: se PUBLICAN, a la
 * vista de cualquiera, y eso hay que decirlo con esas palabras.
 */
export const DESTINATARIOS_FICHA =
  'Se publican en la web, a la vista de cualquiera, en «Localiza tu terapeuta». Para situarte en el mapa se consulta OpenStreetMap (Nominatim) solo con la ciudad, el país y, si la muestras, la dirección. Google y Vercel los guardan por encargo de Sorela.';
