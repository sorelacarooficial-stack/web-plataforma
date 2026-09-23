/**
 * ============================================================================
 *  TÉCNICA DIVINE · el script que manda los correos
 * ============================================================================
 *
 *  Esto NO se ejecuta en la web. Vive dentro de Google (Apps Script) y usa la
 *  cuenta de Gmail de Sorela. Existe por una razón concreta: Firebase, en su
 *  plan gratuito, no manda correos. Esto sí, y no cuesta nada.
 *
 *  Cada vez que alguien rellena un formulario en la web, el servidor guarda a
 *  esa persona en Firestore y además llama aquí. Y aquí pasan tres cosas:
 *
 *     1. Se le manda a la persona un correo con el PDF de la técnica.
 *     2. Se avisa a Sorela de que ha entrado alguien.
 *     3. Se deja una fila en una hoja de cálculo, como respaldo.
 *
 *  ---------------------------------------------------------------------------
 *  CÓMO SE MONTA (una sola vez)
 *  ---------------------------------------------------------------------------
 *
 *  1. Sube el PDF de la Técnica Divine a Google Drive, con la cuenta de Sorela.
 *     Ábrelo y mira la dirección del navegador: entre «/d/» y «/view» hay un
 *     churro de letras y números. Ése es el PDF_ID.
 *
 *  2. Crea una hoja de cálculo en blanco (sheets.new) y llámala «Captación
 *     Divine». En su dirección, entre «/d/» y «/edit», está el HOJA_ID.
 *
 *  3. Entra en script.google.com → Nuevo proyecto. Llámalo «Captación Divine».
 *     Borra lo que venga escrito y pega este archivo entero.
 *
 *  4. Rueda dentada de la izquierda (Configuración del proyecto) → abajo del
 *     todo, «Propiedades de la secuencia de comandos» → «Añadir propiedad».
 *     Hay que crear éstas, escritas EXACTAMENTE así:
 *
 *        SECRETO      La clave que también se pone en Vercel, en la variable
 *                     APPS_SCRIPT_SECRETO. Tienen que ser idénticas. Invéntate
 *                     treinta caracteres al azar: no es una contraseña que
 *                     tengas que recordar.
 *        HOJA_ID      El identificador de la hoja del punto 2.
 *        PDF_ID       El identificador del PDF del punto 1.
 *        AVISO_A      El correo de Sorela, donde le llegan los avisos.
 *        RESPONDER_A  (opcional) A dónde contesta la gente cuando responde al
 *                     correo. Si no se pone, se usa el de AVISO_A.
 *
 *  5. Guarda. Arriba, selecciona la función «probar» y pulsa «Ejecutar».
 *     Google pedirá permisos la primera vez: hay que decir que sí a todo.
 *     Cuando salga la pantalla gris de «Google no ha verificado esta
 *     aplicación», pulsa «Configuración avanzada» y luego «Ir a Captación
 *     Divine (no seguro)». Es tu propio script: ese aviso sale siempre.
 *
 *  6. Botón azul «Implementar» → «Nueva implementación» → rueda dentada →
 *     «Aplicación web».
 *        · Ejecutar como:        Yo
 *        · Quién puede acceder:  CUALQUIER PERSONA   ← importante
 *     Pulsa «Implementar» y copia la dirección larga que acaba en /exec.
 *     Ésa es la que va en Vercel, en la variable APPS_SCRIPT_URL.
 *
 *  7. Para comprobar que está vivo, pega esa misma dirección en el navegador.
 *     Tiene que contestar algo parecido a {"ok":true,"listo":true}.
 *
 *  ---------------------------------------------------------------------------
 *  SI MÁS ADELANTE SE CAMBIA ALGO DE ESTE ARCHIVO
 *  ---------------------------------------------------------------------------
 *  No basta con guardar. Hay que ir a Implementar → Gestionar implementaciones
 *  → el lápiz → Versión: «Nueva versión» → Implementar. Si no, sigue corriendo
 *  la versión vieja y parece que el cambio no ha servido de nada.
 *
 *  ---------------------------------------------------------------------------
 *  CUÁNTOS CORREOS SE PUEDEN MANDAR AL DÍA
 *  ---------------------------------------------------------------------------
 *  Cuenta de Gmail normal: unos 100 al día. Cada contacto gasta dos (uno a la
 *  persona y otro a Sorela). Si se agota, la fila se sigue guardando y la web
 *  deja de prometer un correo que no va a llegar: dice «te escribo yo».
 *
 *  ---------------------------------------------------------------------------
 *  LÍMITE LEGAL, QUE NO SE PUEDE ROMPER
 *  ---------------------------------------------------------------------------
 *  Esto es estética, no sanidad. En los correos NO se puede prometer nada
 *  sobre la salud: ni defensas, ni toxinas, ni circulación, ni celulitis, ni
 *  dolor, ni adelgazar. Sí se puede contar qué es la técnica, cómo se trabaja,
 *  en qué orden, qué se aprende, cuánto dura y para quién es.
 */

/* ==========================================================================
   AJUSTES QUE NO SON SECRETOS
   ========================================================================== */

/** Con qué nombre llega el correo a quien lo recibe. */
var REMITENTE = 'Sorela Caro · Técnica Divine';

/** La web, para los enlaces de dentro de los correos. */
var WEB = 'https://sorelacarodivine.com';

/** Nombre de la pestaña dentro de la hoja de cálculo. */
var PESTANA = 'Contactos';

/** Nombre con el que llega el PDF adjunto al buzón de la persona. */
var NOMBRE_PDF = 'Tecnica-Divine.pdf';

/** Las columnas de la hoja, en este orden. */
var COLUMNAS = [
  'Fecha',
  'Nombre',
  'Correo',
  'WhatsApp',
  'Ciudad',
  'A qué se dedica',
  'Nota',
  'De dónde viene',
  'Qué busca',
  'Correo enviado',
];

/* ==========================================================================
   LA PUERTA DE ENTRADA
   ========================================================================== */

/**
 * Google llama a esta función cada vez que la web manda un contacto.
 *
 * Pase lo que pase, tiene que contestar un JSON. Si contesta otra cosa —una
 * página de error de Google, por ejemplo—, la web lo da por fallido y le
 * enseña a la persona «te escribo yo» en vez de «te he mandado un correo».
 */
function doPost(e) {
  try {
    /* ---------- 1. Leer lo que llega ---------- */
    // Viene como texto plano a propósito (lo explica app/api/captar/route.ts),
    // así que hay que interpretarlo aquí. Si no es un JSON válido, no se
    // revienta: se contesta que los datos no valen.
    var datos = leerCuerpo(e);
    if (!datos) return responder({ ok: false, motivo: 'datos' });

    /* ---------- 2. Comprobar la clave ---------- */
    // Esto es LO ÚNICO que impide que cualquiera que descubra la dirección del
    // script mande correos desde la cuenta de Sorela. La dirección /exec es
    // pública —tiene que serlo para que Vercel pueda llamarla—, así que la
    // única puerta es esta clave.
    //
    // Se compara con === (tres iguales) y no con == (dos): con dos iguales,
    // JavaScript hace conversiones por su cuenta y cosas que no son la clave
    // podrían colarse. Y si la propiedad SECRETO está vacía o no existe, NO se
    // deja pasar a nadie: un script mal configurado tiene que quedarse mudo,
    // no abierto de par en par.
    var secretoGuardado = propiedad('SECRETO');
    if (!secretoGuardado || String(datos.secreto) !== secretoGuardado) {
      return responder({ ok: false, motivo: 'no-autorizado' });
    }

    /* ---------- 3. Validar ---------- */
    // Lo único imprescindible es un correo con forma de correo: sin él no hay
    // nada que mandar ni a quién. El nombre puede faltar (hay formularios que
    // no lo piden) y el correo sale igual, sin saludo personal.
    var correo = String(datos.correo || '').trim().toLowerCase();
    if (!pareceCorreo(correo)) return responder({ ok: false, motivo: 'datos' });

    var nombre = String(datos.nombre || '').trim();
    var origen = String(datos.origen || '').trim();
    var tipo = queBusca(origen);

    /* ---------- 4. Decidir si toca mandar correo ---------- */
    // Dos motivos para no mandarlo, y en los dos la persona ya está guardada:
    //   · Ya se le mandó hoy (alguien que rellena el formulario tres veces).
    //   · Se ha agotado la cuota diaria de Gmail.
    var repetido = yaSeLeEscribioHoy(correo);
    var sinCuota = MailApp.getRemainingDailyQuota() < 5;

    /* ---------- 5. Guardar la fila ---------- */
    // Primero la fila, después el correo, y la fila se escribe con el estado
    // «pendiente» que luego se corrige. Así, si el envío falla de una forma
    // que no habíamos previsto, el contacto ya está escrito en la hoja.
    // Si la hoja falla, no pasa nada: seguimos adelante y el correo sale
    // igual. El correo es lo urgente; la hoja es el respaldo.
    var fila = 0;
    try {
      fila = guardarFila(datos, correo, nombre, origen, tipo);
    } catch (falloHoja) {
      console.error('No se pudo escribir en la hoja: ' + falloHoja);
    }

    /* ---------- 6. Mandar el correo a la persona ---------- */
    var estado;
    var correoEnviado = false;

    if (repetido) {
      estado = 'repetido (ya se le escribió hoy)';
    } else if (sinCuota) {
      estado = 'no: sin cuota de Gmail';
      avisarSinCuota();
    } else {
      try {
        correoEnviado = escribirALaPersona(nombre, correo, tipo);
        if (correoEnviado) apuntarQueSeLeEscribio(correo);
        estado = correoEnviado ? 'sí' : 'no';
      } catch (falloEnvio) {
        estado = 'no: ' + falloEnvio;
        console.error('No salió el correo de bienvenida: ' + falloEnvio);
      }
    }

    /* ---------- 7. Avisar a Sorela ---------- */
    // Va en su propio try: si esto falla, la persona ya tiene su correo y eso
    // es lo que no se puede perder.
    try {
      avisarASorela(datos, nombre, correo, origen, tipo, correoEnviado, repetido);
    } catch (falloAviso) {
      console.error('No salió el aviso a Sorela: ' + falloAviso);
    }

    /* ---------- 8. Dejar constancia en la hoja ---------- */
    if (fila) {
      try {
        hoja().getRange(fila, COLUMNAS.length).setValue(estado);
      } catch (falloEstado) {
        console.error('No se pudo anotar el estado en la hoja: ' + falloEstado);
      }
    }

    // Si era repetido se contesta ok igualmente: para la persona todo ha ido
    // bien, y de hecho su correo de esta mañana sigue en su buzón.
    return responder({ ok: true, correoEnviado: correoEnviado || repetido });
  } catch (fallo) {
    // Red de seguridad final. Aquí no se debería llegar nunca, pero si se
    // llega, la web recibe un JSON y no una página de error de Google.
    console.error(fallo);
    return responder({ ok: false, motivo: 'error' });
  }
}

/**
 * Para comprobar desde el navegador que el despliegue está vivo, sin mandar
 * nada. Se pega la dirección /exec en la barra del navegador y contesta.
 */
function doGet() {
  var faltan = [];
  if (!propiedad('SECRETO')) faltan.push('SECRETO');
  if (!propiedad('HOJA_ID')) faltan.push('HOJA_ID');
  if (!propiedad('PDF_ID')) faltan.push('PDF_ID');
  if (!propiedad('AVISO_A')) faltan.push('AVISO_A');

  return responder({
    ok: true,
    listo: faltan.length === 0,
    faltan: faltan,
    correosQueQuedanHoy: MailApp.getRemainingDailyQuota(),
  });
}

/* ==========================================================================
   QUÉ BUSCA CADA PERSONA
   ========================================================================== */

/**
 * De dónde viene alguien dice qué quiere, y a cada uno se le escribe distinto:
 * quien quiere que la traten y quien quiere aprender la técnica no necesitan
 * el mismo correo.
 *
 * Esto es una copia de la función `tipoDeOrigen` de lib/origenes.ts. Está
 * repetida porque este archivo vive en Google y aquél en la web, y no se
 * pueden compartir. Si se cambia allí, hay que cambiarlo aquí.
 *
 * El orden de las comprobaciones importa: se va de lo más concreto a lo más
 * general, porque «formacion-base» también empieza por «formacion».
 */
function queBusca(origen) {
  var o = String(origen || '').toLowerCase().trim();
  if (!o) return 'otro';

  // Ya es terapeuta: la comunidad solo se abre a quien se ha certificado.
  if (o === 'comunidad' || empiezaPor(o, 'lista-comunidad') || empiezaPor(o, 'comunidad-')) {
    return 'comunidad';
  }

  // Quiere aprender.
  if (empiezaPor(o, 'formacion') || empiezaPor(o, 'curso') || o === 'metodo') {
    return 'alumna';
  }

  // Quiere que le traten: pidió cita, o vino por el buscador de terapeutas.
  if (empiezaPor(o, 'cita-') || o === 'terapeutas' || empiezaPor(o, 'avisar-ciudad')) {
    return 'clienta';
  }

  // La portada y el QR de la exposición le hablan a quien va a recibir la
  // técnica, no a quien la va a aprender.
  if (o === 'web' || o === 'informacion' || o === 'expo' || empiezaPor(o, 'qr')) {
    return 'clienta';
  }

  // El contacto general y el asistente pueden ser cualquier cosa: se dejan sin
  // clasificar a propósito. Es mejor un hueco que una etiqueta inventada.
  return 'otro';
}

/** Lo mismo pero con palabras, para que Sorela lo lea de un vistazo. */
var ETIQUETA = {
  clienta: 'Posible clienta (quiere que la traten)',
  alumna: 'Posible alumna (quiere aprender)',
  comunidad: 'Terapeuta certificada (comunidad)',
  otro: 'Sin clasificar: hay que preguntarle',
};

/**
 * Cómo llegó, en una frase. Copiado de COMO_LLEGO en lib/origenes.ts; si el
 * origen no está en la tabla se devuelve tal cual, que es mejor que inventar.
 */
function comoLlego(origen) {
  var o = String(origen || '').toLowerCase().trim();
  if (!o) return 'No consta';

  var tabla = {
    web: 'Botón «Quiero la información» de la portada',
    informacion: 'Botón «Quiero la información» de la portada',
    expo: 'Código QR de la exposición',
    formacion: 'Página de formaciones',
    'formacion-base': 'Formación Base',
    'formacion-avanzado': 'Nivel Avanzado',
    comunidad: 'Página de la Comunidad Divine',
    'lista-comunidad': 'Lista de espera de la comunidad',
    metodo: 'Página del método',
    sobre: 'Página «Sobre Sorela»',
    contacto: 'Formulario de contacto',
    asistente: 'Conversación con el asistente de la web',
    'avisar-ciudad': 'Pidió aviso cuando haya fecha en su ciudad',
    terapeutas: 'Buscador de terapeutas',
  };
  if (tabla[o]) return tabla[o];

  // Las citas llevan la ciudad pegada: «cita-valencia» → «Pidió cita en Valencia».
  if (empiezaPor(o, 'cita-')) {
    var ciudad = o.slice(5).replace(/-/g, ' ');
    return 'Pidió cita en ' + ciudad.charAt(0).toUpperCase() + ciudad.slice(1);
  }
  return o;
}

/* ==========================================================================
   EL CORREO A LA PERSONA
   ========================================================================== */

/**
 * Manda el correo de bienvenida con el PDF adjunto.
 * Devuelve true si ha salido.
 */
function escribirALaPersona(nombre, correo, tipo) {
  var n = nombreCorto(nombre);
  var adjunto = buscarPdf();

  // Se manda SIEMPRE las dos versiones, HTML y texto plano. El texto plano no
  // es un resto de los años noventa: hay clientes de correo que solo enseñan
  // esa versión, y un correo que llega en blanco parece una estafa.
  var texto = textoPlano(tipo, n, Boolean(adjunto));
  var html = plantilla(tipo, n, Boolean(adjunto));

  var mensaje = {
    to: correo,
    subject: asunto(tipo, n),
    body: texto,
    htmlBody: html,
    name: REMITENTE,
    // Cuando la persona le dé a «Responder», el correo va al buzón de Sorela.
    replyTo: propiedad('RESPONDER_A') || propiedad('AVISO_A') || '',
  };

  if (adjunto) {
    mensaje.attachments = [adjunto];
  } else {
    // Un correo sin adjunto es infinitamente mejor que ningún correo, pero
    // conviene que quede escrito en el registro para poder arreglarlo.
    console.warn('Va sin PDF: revisa la propiedad PDF_ID y que el archivo siga en Drive.');
  }

  // replyTo vacío hace que Gmail se queje, así que se quita si no hay.
  if (!mensaje.replyTo) delete mensaje.replyTo;

  MailApp.sendEmail(mensaje);
  return true;
}

/** El asunto, que cambia según lo que busque la persona. */
function asunto(tipo, n) {
  var cola = n ? ', ' + n : '';
  if (tipo === 'alumna') return 'La formación en Técnica Divine' + cola;
  if (tipo === 'comunidad') return 'La Comunidad Divine' + cola;
  if (tipo === 'otro') return 'He recibido tu mensaje' + cola;
  return 'La información de la Técnica Divine' + cola;
}

/**
 * EL TEXTO DE ESTOS CORREOS ES PROVISIONAL.
 *
 * El bueno lo escribe Sorela y vive en el archivo `correo.html` (ver más
 * abajo, en `plantilla`). Lo de aquí es lo mínimo para que, mientras tanto,
 * nadie reciba un correo vacío, y es también lo que ven los clientes de correo
 * que no pintan HTML.
 *
 * Cuidado al tocarlo: aquí no se puede prometer nada sobre la salud. Se cuenta
 * qué es, cómo se trabaja y para quién es. Nada más.
 */
function textoPlano(tipo, n, hayPdf) {
  var saludo = n ? 'Hola ' + n + ',' : 'Hola,';

  // Si el PDF no ha podido adjuntarse, no se puede decir «te lo adjunto»: se
  // manda a la web, que es donde también está.
  var donde = hayPdf
    ? 'Te lo dejo adjunto en este correo, para que lo leas con calma.'
    : 'Lo tienes aquí: ' + WEB;

  var cuerpo;
  if (tipo === 'alumna') {
    cuerpo =
      'Soy Sorela. Te mando la información de la formación en Técnica Divine: cómo está organizada, qué se aprende en cada etapa y cuánto dura.\n\n' +
      donde +
      '\n\nLa formación tiene dos etapas y hay que hacer las dos, en este orden: primero la online, con la anatomía y el protocolo, y después la presencial. Las manos no se corrigen por videollamada.';
  } else if (tipo === 'comunidad') {
    cuerpo =
      'Soy Sorela. Te mando la información de la Comunidad Divine: qué hay dentro y cómo funciona.\n\n' +
      donde +
      '\n\nCuando abra te aviso a ti antes que a nadie.';
  } else if (tipo === 'otro') {
    cuerpo =
      'Soy Sorela. He recibido tu mensaje y te contesto yo en cuanto pueda.\n\n' +
      'Mientras tanto te mando la información de la Técnica Divine: qué es y cómo se trabaja.\n\n' +
      donde;
  } else {
    cuerpo =
      'Soy Sorela. Te mando la información de la Técnica Divine: qué es, cómo se trabaja y para quién.\n\n' +
      donde;
  }

  return (
    saludo +
    '\n\n' +
    cuerpo +
    '\n\nSi te queda alguna duda, respóndeme a este correo. Lo leo yo.\n\n' +
    'Sorela Caro\n' +
    'Técnica Divine\n' +
    WEB
  );
}

/**
 * Monta la versión en HTML del correo.
 *
 * DE DÓNDE SALE EL DISEÑO Y EL TEXTO BUENO: de un archivo aparte llamado
 * `correo.html`, que se pega en este mismo proyecto de Apps Script (botón «+»
 * al lado de «Archivos» → HTML → se le pone de nombre `correo`, sin el .html,
 * que Google lo añade solo).
 *
 * Ese archivo puede usar estos marcadores, que aquí se sustituyen:
 *
 *     {{NOMBRE}}   el nombre de pila de la persona («Marta»); si no lo ha
 *                  dejado, se queda en blanco
 *     {{SALUDO}}   «Hola Marta,» o «Hola,» si no hay nombre
 *     {{WEB}}      la dirección de la web
 *     {{ANIO}}     el año actual, para el pie
 *     {{PDF}}      la frase que toque sobre el PDF (adjunto o enlace), porque
 *                  hay días en que el adjunto no puede salir
 *
 * Y puede llevar un trozo distinto para cada tipo de persona, marcado así:
 *
 *     <!-- INICIO clienta -->  ...lo que ve una posible clienta...  <!-- FIN clienta -->
 *     <!-- INICIO alumna -->   ...lo que ve una posible alumna...   <!-- FIN alumna -->
 *     <!-- INICIO comunidad --> ...                                 <!-- FIN comunidad -->
 *     <!-- INICIO otro -->      ...                                 <!-- FIN otro -->
 *
 * De esos cuatro trozos se deja solo el que toca y se borran los otros tres.
 * Todo lo que esté fuera de las marcas (cabecera, firma, pie) sale siempre.
 *
 * Mientras ese archivo no exista, se monta un HTML sencillo con el texto
 * plano de arriba, para que el correo salga igual.
 */
function plantilla(tipo, n, hayPdf) {
  var saludo = n ? 'Hola ' + n + ',' : 'Hola,';
  var fraseDelPdf = hayPdf
    ? 'Te lo dejo adjunto en este correo, para que lo leas con calma.'
    : 'Lo tienes en <a href="' + WEB + '">la web</a>.';

  var html = null;
  try {
    html = HtmlService.createHtmlOutputFromFile('correo').getContent();
  } catch (noHayArchivo) {
    // Todavía no se ha pegado correo.html en el proyecto. No es un error.
    html = null;
  }

  if (html) {
    html = soloSuBloque(html, tipo);
    html = html
      .replace(/\{\{NOMBRE\}\}/g, escapar(n))
      .replace(/\{\{SALUDO\}\}/g, escapar(saludo))
      .replace(/\{\{WEB\}\}/g, WEB)
      .replace(/\{\{ANIO\}\}/g, String(new Date().getFullYear()))
      .replace(/\{\{PDF\}\}/g, fraseDelPdf);
    return html;
  }

  // Provisional: el mismo texto de siempre, con un marco mínimo. Estilos
  // escritos dentro de cada etiqueta porque los clientes de correo no
  // entienden hojas de estilo: lo que parece anticuado es lo único que se ve
  // igual en Gmail y en Outlook.
  var parrafos = textoPlano(tipo, n, hayPdf)
    .split('\n\n')
    .map(function (p) {
      return '<p style="margin:0 0 18px">' + escapar(p).replace(/\n/g, '<br>') + '</p>';
    })
    .join('');

  return (
    '<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f2eee9">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2eee9;padding:32px 16px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#faf8f5;border-top:3px solid #8a6a32">' +
    '<tr><td style="padding:38px 36px;font-family:Georgia,\'Times New Roman\',serif;font-size:16px;line-height:1.65;color:#3a352e">' +
    parrafos +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

/** Deja solo el trozo del tipo que toca y borra los otros tres. */
function soloSuBloque(html, tipo) {
  var tipos = ['clienta', 'alumna', 'comunidad', 'otro'];
  for (var i = 0; i < tipos.length; i++) {
    var t = tipos[i];
    var marcas = new RegExp('<!--\\s*(INICIO|FIN)\\s+' + t + '\\s*-->', 'g');
    if (t === tipo) {
      // El que toca: se quitan solo las marcas y se queda el contenido.
      html = html.replace(marcas, '');
    } else {
      // Los demás: fuera marcas y contenido.
      var bloque = new RegExp(
        '<!--\\s*INICIO\\s+' + t + '\\s*-->[\\s\\S]*?<!--\\s*FIN\\s+' + t + '\\s*-->',
        'g'
      );
      html = html.replace(bloque, '');
    }
  }
  return html;
}

/**
 * Coge el PDF de Drive. Si no hay PDF_ID, si el archivo se ha borrado o si se
 * le ha cambiado el permiso, devuelve null y el correo sale sin adjunto.
 * Quedarse sin mandar el correo por esto sería mucho peor.
 */
function buscarPdf() {
  var id = propiedad('PDF_ID');
  if (!id) return null;
  try {
    var blob = DriveApp.getFileById(id).getBlob();
    blob.setName(NOMBRE_PDF);
    return blob;
  } catch (fallo) {
    console.error('No se pudo abrir el PDF (' + id + '): ' + fallo);
    return null;
  }
}

/* ==========================================================================
   EL AVISO A SORELA
   ========================================================================== */

/**
 * Corto y útil: quién ha entrado, qué busca y cómo escribirle hoy mismo.
 * Si no está puesta la propiedad AVISO_A, no se avisa y no pasa nada: la
 * persona ya tiene su correo y la fila ya está en la hoja.
 */
function avisarASorela(datos, nombre, correo, origen, tipo, correoEnviado, repetido) {
  var destino = propiedad('AVISO_A');
  if (!destino) return;

  var telefono = String(datos.whatsapp || '').trim();
  var soloDigitos = telefono.replace(/\D/g, '');

  var lineas = [
    nombre || '(sin nombre)',
    ETIQUETA[tipo],
    '',
    'Correo: ' + correo,
  ];

  if (telefono) {
    lineas.push('WhatsApp: ' + telefono);
    lineas.push('Escribirle: https://wa.me/' + soloDigitos);
  } else {
    lineas.push('WhatsApp: no lo ha dejado');
  }

  if (datos.ciudad) lineas.push('Ciudad: ' + datos.ciudad);
  if (datos.perfil) lineas.push('Se dedica a: ' + datos.perfil);
  if (datos.nota) lineas.push('', 'Ha escrito:', String(datos.nota));

  lineas.push('', 'De dónde viene: ' + comoLlego(origen));

  if (repetido) {
    lineas.push('', 'Ya había entrado hoy: no se le ha vuelto a escribir.');
  } else if (correoEnviado) {
    lineas.push('', 'Ya le ha llegado su correo con la información.');
  } else {
    lineas.push('', 'OJO: no ha salido su correo. Escríbele tú.');
  }

  MailApp.sendEmail({
    to: destino,
    subject: 'Contacto nuevo: ' + (nombre || correo) + ' · ' + ETIQUETA[tipo],
    body: lineas.join('\n'),
    name: 'Web Divine',
    // Así Sorela puede contestarle directamente desde el propio aviso.
    replyTo: correo,
  });
}

/** Cuando se agota la cuota de Gmail, Sorela tiene que enterarse. */
function avisarSinCuota() {
  var destino = propiedad('AVISO_A');
  if (!destino) return;
  try {
    MailApp.sendEmail({
      to: destino,
      subject: 'Se ha agotado el correo de hoy',
      body:
        'Google no deja mandar más correos automáticos hasta mañana.\n\n' +
        'Quien entre a partir de ahora se guarda igual en la hoja y en la web, pero\n' +
        'no recibe el correo con la información: hay que escribirle a mano.\n\n' +
        'Se arregla solo dentro de unas horas.',
      name: 'Web Divine',
    });
  } catch (fallo) {
    // Si ni para esto queda cuota, poco más se puede hacer.
    console.error('Tampoco salió el aviso de cuota: ' + fallo);
  }
}

/* ==========================================================================
   LA HOJA DE CÁLCULO
   ========================================================================== */

/** Devuelve la pestaña donde se escribe, con su cabecera puesta. */
function hoja() {
  var id = propiedad('HOJA_ID');
  if (!id) throw new Error('Falta la propiedad HOJA_ID.');

  var libro = SpreadsheetApp.openById(id);
  var pestana = libro.getSheetByName(PESTANA) || libro.insertSheet(PESTANA);

  if (pestana.getLastRow() === 0) {
    pestana.appendRow(COLUMNAS);
    pestana.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
    pestana.setFrozenRows(1);
    pestana.setColumnWidth(1, 150);
    pestana.setColumnWidth(3, 230);
  }
  return pestana;
}

/** Escribe la fila y devuelve en qué número de fila ha quedado. */
function guardarFila(datos, correo, nombre, origen, tipo) {
  var pestana = hoja();

  // Si entran dos personas en el mismo segundo, las dos podrían pedir «la
  // última fila» a la vez y una pisaría a la otra. El cerrojo hace que pasen
  // de una en una. Se espera como mucho diez segundos.
  var cerrojo = LockService.getScriptLock();
  try {
    cerrojo.waitLock(10000);
  } catch (sinCerrojo) {
    // Si no se consigue, se escribe igual: perder el respaldo por un cerrojo
    // sería peor que el riesgo de que dos filas se solapen alguna vez.
    console.warn('No se pudo coger el cerrojo: ' + sinCerrojo);
  }

  try {
    pestana.appendRow([
      new Date(),
      nombre,
      correo,
      // El apóstrofo obliga a la hoja a tratarlo como texto. Sin él, Google se
      // come el signo + del prefijo y el número queda inservible.
      datos.whatsapp ? "'" + datos.whatsapp : '',
      datos.ciudad || '',
      datos.perfil || '',
      datos.nota || '',
      comoLlego(origen),
      ETIQUETA[tipo],
      'pendiente',
    ]);
    return pestana.getLastRow();
  } finally {
    try {
      cerrojo.releaseLock();
    } catch (daIgual) {}
  }
}

/* ==========================================================================
   NO ESCRIBIRLE DOS VECES A LA MISMA PERSONA
   ========================================================================== */

/**
 * Hay quien rellena el formulario tres veces seguidas —porque no ve la
 * confirmación, o porque escanea el QR otra vez— y recibir tres correos
 * idénticos queda fatal.
 *
 * Se deja una marca con su correo y el día de hoy. Si la marca ya está, no se
 * le vuelve a escribir, pero la web recibe igualmente un «todo bien»: para esa
 * persona la cosa ha funcionado, su correo está en su buzón desde hace un rato.
 *
 * La marca vive en la memoria rápida de Google, que la borra sola. El máximo
 * que Google permite guardar ahí son seis horas, no un día entero; para lo que
 * hace falta —evitar el envío repetido de los próximos minutos— sobra.
 *
 * La marca se pone DESPUÉS de que el correo haya salido de verdad, nunca
 * antes. Si se pusiera antes y el envío fallara, la persona se quedaría sin
 * correo y encima el siguiente intento lo daría por hecho.
 */
function claveDeHoy(correo) {
  return 'enviado:' + correo + ':' + Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
}

function yaSeLeEscribioHoy(correo) {
  try {
    return Boolean(CacheService.getScriptCache().get(claveDeHoy(correo)));
  } catch (fallo) {
    // Si la memoria falla, se prefiere mandar el correo: mejor uno de más que
    // ninguno.
    console.warn('La memoria de repetidos no responde: ' + fallo);
    return false;
  }
}

function apuntarQueSeLeEscribio(correo) {
  try {
    // 21600 segundos = 6 horas, que es el máximo que permite Google.
    CacheService.getScriptCache().put(claveDeHoy(correo), '1', 21600);
  } catch (fallo) {
    console.warn('No se pudo apuntar el envío: ' + fallo);
  }
}

/* ==========================================================================
   PIEZAS PEQUEÑAS
   ========================================================================== */

/** Lee una propiedad del script, ya recortada. Devuelve '' si no está. */
function propiedad(nombre) {
  var valor = PropertiesService.getScriptProperties().getProperty(nombre);
  return valor ? String(valor).trim() : '';
}

/** Interpreta el cuerpo de la petición. Devuelve null si no es un JSON. */
function leerCuerpo(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  try {
    var datos = JSON.parse(e.postData.contents);
    // Un JSON válido también puede ser un número o un texto; aquí hace falta
    // un objeto con campos.
    return datos && typeof datos === 'object' ? datos : null;
  } catch (fallo) {
    console.error('Llegó algo que no es JSON: ' + String(e.postData.contents).slice(0, 200));
    return null;
  }
}

/**
 * Algo, arroba, algo, punto, algo, sin espacios. La misma comprobación que
 * hace la web en lib/captacion.ts: ni más estricta ni más floja, porque un
 * correo válido rechazado es un contacto perdido.
 */
function pareceCorreo(correo) {
  return /^[^\s@]+@[^\s@,]+\.[a-z]{2,}$/i.test(correo);
}

/** El nombre de pila, que es como se saluda a alguien. */
function nombreCorto(nombre) {
  return String(nombre || '').trim().split(/\s+/)[0] || '';
}

function empiezaPor(texto, principio) {
  return texto.lastIndexOf(principio, 0) === 0;
}

/** Para meter texto dentro de HTML sin romperlo. */
function escapar(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** La respuesta que espera la web: siempre JSON, pase lo que pase. */
function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/* ==========================================================================
   PARA PROBARLO A MANO
   ========================================================================== */

/**
 * Selecciona «probar» en el desplegable de arriba y pulsa «Ejecutar».
 *
 * Se manda un correo a la propia Sorela, como si alguien acabara de rellenar
 * el formulario. Sirve para dos cosas: comprobar que todo funciona (llega el
 * correo, llega el PDF, aparece la fila en la hoja) y, sobre todo, para que
 * Google pida los permisos, que solo los pide al ejecutar algo a mano.
 *
 * El resultado aparece abajo, en el «Registro de ejecución».
 */
function probar() {
  var mio = propiedad('AVISO_A') || Session.getActiveUser().getEmail();

  if (!propiedad('SECRETO')) {
    console.error('Falta la propiedad SECRETO. Míralo en Configuración del proyecto.');
    return;
  }

  var respuesta = doPost({
    postData: {
      contents: JSON.stringify({
        secreto: propiedad('SECRETO'),
        nombre: 'Prueba Prueba',
        correo: mio,
        whatsapp: '+34600000000',
        ciudad: 'Valencia',
        perfil: 'Esteticista con cabina propia',
        nota: 'Esto es una prueba, se puede borrar la fila.',
        origen: 'web',
        consentimiento: true,
      }),
    },
  });

  console.log('Respuesta: ' + respuesta.getContent());
  console.log('Correos que quedan hoy: ' + MailApp.getRemainingDailyQuota());
  console.log('Revisa el buzón de ' + mio + ' y la hoja de cálculo.');
}
