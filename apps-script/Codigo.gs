var REMITENTE = 'Sorela Caro · Técnica Divine';

var WEB = 'https://sorelacarodivine.com';

var WHATSAPP_SORELA = '34686154556';

var PESTANA = 'Contactos';

var NOMBRE_PDF = 'TECNICA-DIVINE.pdf';

var NOMBRE_HOJA = 'Respaldo';

/*
 * La fecha de la apertura, SOLO como reserva.
 *
 * La web la manda en cada contacto (`datos.apertura`), que es donde vive de
 * verdad: en `lib/apertura.ts`, escrita una vez. Esto de aquí es para el día
 * que llegue un contacto sin ella —una versión vieja de la web, una prueba a
 * mano— y es lo único que hay que tocar si eso pasa y la fecha ha cambiado.
 */
var APERTURA_RESERVA = {
  dia: 'viernes 6 de noviembre',
  hora: '19:00',
  paises: '19:00 en España · 15:00 en Argentina · 14:00 en Venezuela · 13:00 en Colombia',
};

function aperturaDe(datos) {
  var a = (datos && datos.apertura) || {};
  return {
    dia: String(a.dia || APERTURA_RESERVA.dia),
    hora: String(a.hora || APERTURA_RESERVA.hora),
    paises: String(a.paises || APERTURA_RESERVA.paises),
  };
}

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

function doPost(e) {
  try {
    var datos = leerCuerpo(e);
    if (!datos) return responder({ ok: false, motivo: 'datos' });

    var secretoGuardado = propiedad('SECRETO');
    if (!secretoGuardado || String(datos.secreto) !== secretoGuardado) {
      return responder({ ok: false, motivo: 'no-autorizado' });
    }

    var correo = String(datos.correo || '').trim().toLowerCase();
    if (!pareceCorreo(correo)) return responder({ ok: false, motivo: 'datos' });

    var nombre = String(datos.nombre || '').trim();
    var origen = String(datos.origen || '').trim();
    var tipo = queBusca(origen);

    /* Haber escrito hoy a alguien no puede impedir el correo de su acuerdo:
       quien pide información por la mañana y firma por la tarde se quedaría
       sin su dossier por haber hecho las dos cosas el mismo día. */
    var repetido = tipo !== 'acuerdo' && yaSeLeEscribioHoy(correo);
    var sinCuota = false;
    try {
      sinCuota = MailApp.getRemainingDailyQuota() < 5;
    } catch (falloCuota) {
      console.warn('No se pudo consultar la cuota de correo: ' + falloCuota);
    }

    var fila = 0;
    try {
      fila = guardarFila(datos, correo, nombre, origen, tipo);
    } catch (falloHoja) {
      console.error('No se pudo escribir en la hoja: ' + falloHoja);
    }

    var estado;
    var correoEnviado = false;

    if (repetido) {
      estado = 'repetido (ya se le escribió hoy)';
    } else if (sinCuota) {
      estado = 'no: sin cuota de Gmail';
      avisarSinCuota();
    } else {
      try {
        correoEnviado = escribirALaPersona(nombre, correo, tipo, aperturaDe(datos), datos);
        if (correoEnviado) apuntarQueSeLeEscribio(correo);
        estado = correoEnviado ? 'sí' : 'no';
      } catch (falloEnvio) {
        estado = 'no: ' + falloEnvio;
        console.error('No salió el correo de bienvenida: ' + falloEnvio);
      }
    }

    try {
      avisarASorela(datos, nombre, correo, origen, tipo, correoEnviado, repetido);
    } catch (falloAviso) {
      console.error('No salió el aviso a Sorela: ' + falloAviso);
    }

    if (fila) {
      try {
        hoja().getRange(fila, COLUMNAS.length).setValue(estado);
      } catch (falloEstado) {
        console.error('No se pudo anotar el estado en la hoja: ' + falloEstado);
      }
    }

    var todoBien = correoEnviado || repetido;
    /* `tipo` vuelve en la respuesta para que la web sepa que habla con esta
       versión del script: la anterior no conocía los acuerdos y mandaba el
       correo genérico. Si la web no recibe `tipo: 'acuerdo'`, lo manda ella
       por otro camino. */
    return responder({ ok: todoBien, correoEnviado: todoBien, guardado: Boolean(fila), tipo: tipo });
  } catch (fallo) {
    console.error(fallo);
    return responder({ ok: false, motivo: 'error' });
  }
}

function doGet() {
  var faltan = [];
  if (!propiedad('SECRETO')) faltan.push('SECRETO');
  if (!propiedad('AVISO_A')) faltan.push('AVISO_A');

  var hayPdf = false;
  try {
    hayPdf = Boolean(buscarPdf());
  } catch (falloPdf) {
    hayPdf = false;
  }

  var hayHoja = false;
  try {
    hoja();
    hayHoja = true;
  } catch (falloHoja) {
    hayHoja = false;
  }

  var quedan = null;
  try {
    quedan = MailApp.getRemainingDailyQuota();
  } catch (falloCuota) {
    quedan = 'no se sabe: falta ejecutar «probar» una vez y dar permisos';
  }

  return responder({
    ok: true,
    listo: faltan.length === 0 && hayPdf,
    faltan: faltan,
    encuentraElPdf: hayPdf,
    encuentraLaHoja: hayHoja,
    correosQueQuedanHoy: quedan,
  });
}

function queBusca(origen) {
  var o = String(origen || '').toLowerCase().trim();
  if (!o) return 'otro';

  /* El acuerdo firmado. No es alguien pidiendo información: es alguien que ya
     ha firmado y a quien hay que darle su dossier. Correo propio y aparte. */
  if (o === 'acuerdo') return 'acuerdo';

  if (o === 'comunidad' || empiezaPor(o, 'lista-comunidad') || empiezaPor(o, 'comunidad-')) {
    return 'comunidad';
  }

  if (empiezaPor(o, 'formacion') || empiezaPor(o, 'curso') || o === 'metodo') {
    return 'alumna';
  }

  if (empiezaPor(o, 'cita-') || o === 'terapeutas' || empiezaPor(o, 'avisar-ciudad')) {
    return 'clienta';
  }

  if (o === 'web' || o === 'informacion' || o === 'expo' || empiezaPor(o, 'qr')) {
    return 'clienta';
  }

  return 'otro';
}

var ETIQUETA = {
  acuerdo: 'ACUERDO FIRMADO: hay que darle acceso',
  clienta: 'Posible clienta (quiere que la traten)',
  alumna: 'Posible alumna (quiere aprender)',
  comunidad: 'Terapeuta certificada (comunidad)',
  otro: 'Sin clasificar: hay que preguntarle',
};

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
    'cita-asistente': 'Preguntó al asistente por una cita',
    'formacion-asistente': 'Preguntó al asistente por las fechas de formación',
    'formacion-precio': 'Preguntó al asistente por el precio de la formación',
    'comunidad-asistente': 'Preguntó al asistente por la comunidad',
  };
  if (tabla[o]) return tabla[o];

  if (empiezaPor(o, 'cita-')) {
    var ciudad = o.slice(5).replace(/-/g, ' ');
    return 'Pidió cita en ' + ciudad.charAt(0).toUpperCase() + ciudad.slice(1);
  }
  return o;
}

function escribirALaPersona(nombre, correo, tipo, apertura, datos) {
  var n = nombreCorto(nombre);

  /*
   * El correo del acuerdo firmado va por su cuenta.
   *
   * No lleva el PDF comercial de la técnica —que es lo que se le manda a quien
   * pide información— ni el cierre que invita a la membresía: quien ha firmado
   * ya está dentro. Lleva su referencia y el enlace a su dossier, y nada más.
   *
   * EL DOSSIER VA COMO ENLACE Y NO COMO ADJUNTO, a propósito. Un adjunto, una
   * vez enviado, ya no se puede retirar ni se sabe quién acaba teniéndolo. El
   * enlace está atado a la referencia de su firma: queda registrado cuándo se
   * descarga, y si un día hay que cortarlo, se corta.
   */
  if (tipo === 'acuerdo') return escribirPorElAcuerdo(n, correo, datos || {});

  var adjunto = buscarPdf();

  var texto = textoPlano(tipo, n, Boolean(adjunto), apertura);
  var html = plantilla(tipo, n, Boolean(adjunto), apertura);

  var mensaje = {
    to: correo,
    subject: asunto(tipo, n),
    body: texto,
    htmlBody: html,
    name: REMITENTE,
    replyTo: propiedad('RESPONDER_A') || propiedad('AVISO_A') || '',
  };

  if (adjunto) {
    mensaje.attachments = [adjunto];
  } else {
    console.warn('Va sin PDF: revisa la propiedad PDF_ID y que el archivo siga en Drive.');
  }

  if (!mensaje.replyTo) delete mensaje.replyTo;

  MailApp.sendEmail(mensaje);
  return true;
}

function escribirPorElAcuerdo(n, correo, datos) {
  var referencia = String(datos.referencia || '').trim();
  var enlace = String(datos.enlaceDossier || '').trim();
  var saludo = n ? 'Hola, ' + n + '.' : 'Hola.';

  var lineas = [
    saludo,
    '',
    'Queda firmado tu acuerdo de confidencialidad de la Técnica Divine. Gracias.',
    '',
    'Tu referencia es ' + (referencia || '—') + '. Guárdala: es lo que tienes que citar si alguna vez hay que localizar tu acuerdo.',
    '',
  ];

  var adjuntos = adjuntosDe(datos);

  if (adjuntos.length) {
    lineas.push('Te adjunto tu acuerdo firmado y tu dossier del precurso.');
    lineas.push('');
  }

  if (enlace) {
    lineas.push('Si el dossier no te llega adjunto, lo tienes también aquí:');
    lineas.push(enlace);
    lineas.push('');
    lineas.push('Es un documento confidencial. Lo que has firmado dice que no se reproduce, ni se modifica, ni se comparte con nadie. Te pido que lo cumplas: es el trabajo de treinta años.');
  } else {
    lineas.push('Te paso el dossier en cuanto lo tenga listo.');
  }

  lineas.push('');
  lineas.push('Nos vemos en la formación.');
  lineas.push('Sorela');

  var html =
    '<div style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#2b2622;max-width:560px">' +
    '<p>' + escaparHtml(saludo) + '</p>' +
    '<p>Queda firmado tu acuerdo de confidencialidad de la Técnica Divine. Gracias.</p>' +
    (adjuntos.length ? '<p>Te adjunto tu <strong>acuerdo firmado</strong> y tu <strong>dossier del precurso</strong>, los dos en PDF.</p>' : '') +
    '<p style="background:#f5efe2;border:1px solid #d9c6a0;border-radius:10px;padding:14px 16px;margin:22px 0">' +
    '<span style="display:block;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#6e5327">Tu referencia</span>' +
    '<strong style="font-size:21px;letter-spacing:.06em">' + escaparHtml(referencia || '—') + '</strong></p>' +
    (enlace
      ? '<p><a href="' + escaparHtml(enlace) + '" style="display:inline-block;background:#141210;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;padding:14px 26px;border-radius:999px">Abrir mi dossier</a></p>' +
        '<p style="font-size:13px;color:#6c645a">Si el dossier no te llega adjunto, este botón lo abre igualmente.</p>' +
        '<p style="font-size:14px;color:#6c645a">Es un documento confidencial. Lo que has firmado dice que no se reproduce, ni se modifica, ni se comparte con nadie. Te pido que lo cumplas: es el trabajo de treinta años.</p>'
      : '<p>Te paso el dossier en cuanto lo tenga listo.</p>') +
    '<p>Nos vemos en la formación.<br>Sorela</p>' +
    '</div>';

  var mensaje = {
    to: correo,
    subject: 'Tu acuerdo firmado y tu dossier' + (n ? ', ' + n : ''),
    body: lineas.join('\n'),
    htmlBody: html,
    name: REMITENTE,
    replyTo: propiedad('RESPONDER_A') || propiedad('AVISO_A') || '',
  };

  if (adjuntos.length) mensaje.attachments = adjuntos;
  if (!mensaje.replyTo) delete mensaje.replyTo;

  MailApp.sendEmail(mensaje);
  return true;
}

/*
 * Los PDF que manda la web: el acuerdo firmado y el dossier.
 *
 * Llegan en base64 dentro del propio aviso, porque el acuerdo se genera en el
 * momento con la firma de la alumna y no está guardado en ningún Drive. Si
 * alguno llega roto se salta y el correo sale con los demás: es mejor que le
 * llegue el contrato sin el dossier que no le llegue nada.
 */
function adjuntosDe(datos) {
  var lista = Array.isArray(datos.adjuntos) ? datos.adjuntos : [];
  var salida = [];
  for (var i = 0; i < lista.length; i++) {
    try {
      var a = lista[i];
      salida.push(
        Utilities.newBlob(Utilities.base64Decode(String(a.base64)), String(a.tipo || 'application/pdf'), String(a.nombre || 'documento.pdf'))
      );
    } catch (roto) {
      console.warn('Un adjunto del acuerdo ha llegado roto: ' + roto);
    }
  }
  return salida;
}

function escaparHtml(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asunto(tipo, n) {
  var cola = n ? ', ' + n : '';
  if (tipo === 'alumna') return 'La formación en Técnica Divine' + cola;
  if (tipo === 'comunidad') return 'La Comunidad Divine' + cola;
  if (tipo === 'otro') return 'He recibido tu mensaje' + cola;
  return 'La información de la Técnica Divine' + cola;
}

/*
 * LOS CUATRO CORREOS.
 *
 * Cada uno cierra en la Membresía Divine, que es lo único que hay abierto
 * ahora mismo, pero NO todos de la misma manera, y eso es a propósito. La
 * membresía es para quien ya trabaja con las manos: ponérsela delante a una
 * posible clienta que solo quiere una sesión no la acerca, la despista. Así
 * que a la clienta se le ofrece primero lo suyo y la membresía va después, y
 * condicionada a que además sea terapeuta.
 *
 * El bloque de la membresía se arma solo, con la fecha que manda la web, en
 * `cierreMembresia`. Está en un sitio porque es el texto que más se va a
 * retocar de aquí a noviembre y no puede quedarse a medias en tres de cuatro.
 *
 * Reglas que no se saltan: ni efectos sobre la salud, ni cifras de dinero
 * ganado. En estética española lo primero es un reclamo sanitario y lo segundo
 * una promesa de rentabilidad; las dos cosas están prohibidas.
 */
var TEXTOS = {
  clienta: {
    saludo: {
      con: 'Gracias por pedirme la información. Va adjunta a este correo, en PDF.',
      sin: 'Gracias por pedirme la información. El PDF se me ha quedado fuera de este correo: respóndeme y te lo mando. Mientras tanto te lo cuento aquí.',
    },
    parrafos: [
      'La Técnica Divine es un masaje manual: mis manos, aceite y, en algunas zonas, herramientas de aluminio. Sin máquinas y sin nada invasivo.',
      {
        con: 'Lo que manda es el orden. Se empieza con la apertura de cinco puntos; después se trabaja la zona por partes —en el abdomen, primero la de abajo, luego la de arriba, luego los laterales— y se termina juntándolo todo. En el PDF tienes las fases completas y las zonas en las que se trabaja.',
        sin: 'Lo que manda es el orden. Se empieza con la apertura de cinco puntos; después se trabaja la zona por partes —en el abdomen, primero la de abajo, luego la de arriba, luego los laterales— y se termina juntándolo todo. Las fases completas y las zonas en las que se trabaja van en el PDF que te mando en cuanto me respondas.',
      },
      'Antes de empezar hablamos. Hay situaciones en las que esta técnica no se aplica, y eso lo miramos juntas antes de que te subas a la camilla.',
      'Si quieres una sesión o te queda alguna duda, respóndeme a este correo. Lo leo yo.',
      { membresia: 'clienta' },
    ],
  },

  alumna: {
    saludo: {
      con: 'Gracias por interesarte por la formación. Te adjunto la información de la técnica en PDF.',
      sin: 'Gracias por interesarte por la formación. Tengo un PDF con la información de la técnica, pero se me ha quedado fuera de este correo: respóndeme y te lo mando.',
    },
    parrafos: [
      'La formación son dos etapas y van siempre en este orden: primero online y después presencial. Lo online te prepara; en lo presencial te corrijo la mano sobre cuerpo real.',
      'Las próximas fechas las estoy cerrando ahora mismo y te las mando en cuanto las tenga, sin que tengas que estar pendiente.',
      { membresia: 'alumna' },
      'Cualquier duda mientras tanto, respóndeme a este correo.',
    ],
  },

  comunidad: {
    saludo: 'Gracias por apuntarte a la lista. Como ya eres terapeuta, voy al grano.',
    parrafos: [
      { membresia: 'comunidad' },
      'A ti te aviso antes que a nadie: tendrás el enlace en el correo horas antes de que se abra al resto.',
      {
        con: 'Te adjunto la información de la técnica por si quieres repasarla.',
        sin: 'Quería adjuntarte la información de la técnica por si querías repasarla y se me ha quedado fuera del correo: respóndeme y te la mando.',
      },
      'Cualquier duda hasta entonces, respóndeme a este correo.',
    ],
  },

  otro: {
    saludo: 'Gracias por escribirme.',
    parrafos: [
      {
        con: 'Te contesto yo en menos de 48 horas. Mientras tanto te adjunto la información de la Técnica Divine.',
        sin: 'Te contesto yo en menos de 48 horas. Quería adjuntarte la información de la Técnica Divine y se me ha quedado fuera del correo: respóndeme y te la mando.',
      },
      'Para no hacerte perder el tiempo: ¿buscas una sesión para ti, quieres formarte en la técnica, o es otra cosa? Con saber eso te mando lo que te sirve.',
      { membresia: 'otro' },
    ],
  },
};

/*
 * El párrafo de la membresía, distinto según con quién se hable.
 *
 * A la terapeuta se le cuenta como lo que es; a la alumna, como lo que viene
 * después del curso; a la clienta, condicionado, porque lo más probable es que
 * no le toque. Ninguno lleva el precio: el precio está en la web y aquí
 * repetirlo solo sirve para que un día diga uno y la web otro.
 */
function cierreMembresia(quien, apertura) {
  /* En mayúscula para empezar frase, en minúscula para ir dentro de una. Se
     construyen las dos porque meter una función que capitalice al vuelo acaba
     escribiendo «El» en mitad de una oración, que es justo lo que pasó. */
  var Cuando = 'El ' + apertura.dia + ' a las ' + apertura.hora + ', hora de España,';
  var cuando = 'el ' + apertura.dia + ' a las ' + apertura.hora + ', hora de España,';

  /* Los otros países, sin repetir España: ya se acaba de decir, y leerlo dos
     veces en la misma frase hace que parezca un error. */
  var fuera = String(apertura.paises || '')
    .split('·')
    .map(function (t) { return t.trim(); })
    .filter(function (t) { return t && t.indexOf('España') === -1; })
    .join(', ');

  if (quien === 'comunidad') {
    return (
      Cuando +
      ' abre la Membresía Divine' +
      (fuera ? ' (' + fuera + ')' : '') +
      ': una clase en vivo al mes con lo nuevo del método, tus casos mirados uno a uno, canal privado y tu ficha en el mapa de terapeutas. Quien entra en el lanzamiento conserva el precio de fundadora mientras siga dentro.'
    );
  }

  if (quien === 'alumna') {
    return (
      'Y por si te sirve para decidirte: la formación no termina en el certificado. ' +
      Cuando +
      ' abro la Membresía Divine, que es donde sigo enseñando después del curso: una clase en vivo al mes, tus casos mirados uno a uno y un canal privado donde preguntarme. Quien entra en el lanzamiento conserva el precio de fundadora.'
    );
  }

  if (quien === 'clienta') {
    return (
      'Y si además de clienta trabajas con las manos —eres terapeuta o esteticista—, dímelo: ' +
      cuando +
      ' abro la Membresía Divine, que es donde enseño el método a quien ya trabaja.'
    );
  }

  return (
    'Por si te viene al caso: ' +
    cuando +
    ' abro la Membresía Divine, para terapeutas que ya trabajan con las manos.'
  );
}

/*
 * Resuelve un párrafo a texto. Puede venir de tres formas:
 *   'texto'                  — tal cual
 *   { con: …, sin: … }       — según haya salido el PDF adjunto o no
 *   { membresia: 'alumna' }  — el cierre de la membresía, con la fecha puesta
 */
function resolver(texto, hayPdf, apertura) {
  if (!texto || typeof texto !== 'object') return texto;
  if (texto.membresia) return cierreMembresia(texto.membresia, apertura);
  return hayPdf ? texto.con : texto.sin;
}

function saludoDe(tipo, hayPdf, apertura) {
  return resolver((TEXTOS[tipo] || TEXTOS.otro).saludo, hayPdf, apertura);
}

function parrafosDe(tipo, hayPdf, apertura) {
  return (TEXTOS[tipo] || TEXTOS.otro).parrafos.map(function (p) {
    return resolver(p, hayPdf, apertura);
  });
}

function textoPlano(tipo, n, hayPdf, apertura) {
  return [
    n ? 'Hola ' + n + ',' : 'Hola,',
    '',
    saludoDe(tipo, hayPdf, apertura),
    '',
    parrafosDe(tipo, hayPdf, apertura).join('\n\n'),
    '',
    'Si te resulta más cómodo, escríbeme por WhatsApp: ' + enlaceWhatsapp(),
    '',
    'Sorela Caro',
    'Creadora de la Técnica Divine',
    WEB,
    '',
    'Te escribo porque dejaste tus datos en mi web. Si no quieres recibir más',
    'correos míos, respóndeme a este mismo y te doy de baja. No hace falta que',
    'me expliques nada.',
  ].join('\n');
}

function plantilla(tipo, n, hayPdf, apertura) {
  var carta = null;
  try {
    carta = HtmlService.createHtmlOutputFromFile('correo').getContent();
  } catch (noHayArchivo) {
    carta = null;
  }

  var ETIQUETA_P =
    '<p style="margin:0 0 16px 0; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:1.65; color:#141210;">';

  var cuerpo = parrafosDe(tipo, hayPdf, apertura)
    .map(function (p) {
      return ETIQUETA_P + escapar(p) + '</p>';
    })
    .join('\n');

  if (carta) {
    carta = carta.split('<!-- CORTAR-AQUI')[0];

    carta = rellenar(carta, 'NOMBRE', n ? escapar(n) + ',' : '');
    carta = rellenar(carta, 'SALUDO', escapar(saludoDe(tipo, hayPdf, apertura)));
    carta = rellenar(carta, 'ENLACE_WEB', WEB);
    carta = rellenar(carta, 'WHATSAPP', enlaceWhatsapp());
    return rellenar(carta, 'CUERPO', cuerpo);
  }

  return (
    '<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#fbf9f6">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf9f6;padding:32px 16px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fbf9f6;border-top:2px solid #8a6a32">' +
    '<tr><td style="padding:32px 24px">' +
    '<p style="margin:0 0 20px 0;font-family:Georgia,\'Times New Roman\',serif;font-size:22px;line-height:1.35;color:#141210">Hola ' +
    (n ? escapar(n) + ',' : '') +
    '</p>' +
    ETIQUETA_P +
    escapar(saludoDe(tipo, hayPdf, apertura)) +
    '</p>' +
    cuerpo +
    ETIQUETA_P +
    'Sorela Caro · Creadora de la Técnica Divine<br>' +
    '<a href="' + WEB + '" style="color:#8a6a32">' + WEB + '</a></p>' +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

function enlaceWhatsapp() {
  return 'https://wa.me/' + WHATSAPP_SORELA;
}

function buscarPdf() {
  var id = propiedad('PDF_ID');
  if (id) {
    try {
      var blob = DriveApp.getFileById(id).getBlob();
      blob.setName(NOMBRE_PDF);
      return blob;
    } catch (fallo) {
      console.error('No se pudo abrir el PDF por su identificador: ' + fallo);
    }
  }

  try {
    var encontrados = DriveApp.getFilesByName(NOMBRE_PDF);
    if (encontrados.hasNext()) {
      var blob2 = encontrados.next().getBlob();
      blob2.setName(NOMBRE_PDF);
      return blob2;
    }
    console.error('No hay ningún archivo llamado ' + NOMBRE_PDF + ' en Drive.');
  } catch (fallo2) {
    console.error('No se pudo buscar el PDF en Drive: ' + fallo2);
  }
  return null;
}

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

  if (datos.ciudad) lineas.push('Ciudad: ' + comoTexto(datos.ciudad));
  if (datos.perfil) lineas.push('Se dedica a: ' + comoTexto(datos.perfil));
  if (datos.nota) lineas.push('', 'Ha escrito:', comoTexto(datos.nota));

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
    replyTo: correo,
  });
}

function avisarSinCuota() {
  var destino = propiedad('AVISO_A');
  if (!destino) return;

  var clave = 'aviso-cuota:' + Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  try {
    if (CacheService.getScriptCache().get(clave)) return;
    CacheService.getScriptCache().put(clave, '1', 21600);
  } catch (sinMemoria) {
  }

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
    console.error('Tampoco salió el aviso de cuota: ' + fallo);
  }
}

function hoja() {
  var id = propiedad('HOJA_ID');
  var libro = null;

  if (id) {
    try {
      libro = SpreadsheetApp.openById(id);
    } catch (fallo) {
      console.error('No se pudo abrir la hoja por su identificador: ' + fallo);
    }
  }

  if (!libro) {
    var encontradas = DriveApp.getFilesByName(NOMBRE_HOJA);
    if (!encontradas.hasNext()) {
      throw new Error(
        'No encuentro la hoja. Pon su identificador en HOJA_ID, o llama «' +
          NOMBRE_HOJA +
          '» a una hoja de cálculo de tu Drive.'
      );
    }
    libro = SpreadsheetApp.openById(encontradas.next().getId());
  }
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

function guardarFila(datos, correo, nombre, origen, tipo) {
  var pestana = hoja();

  var cerrojo = LockService.getScriptLock();
  try {
    cerrojo.waitLock(10000);
  } catch (sinCerrojo) {
    console.warn('No se pudo coger el cerrojo: ' + sinCerrojo);
  }

  try {
    pestana.appendRow([
      new Date(),
      nombre,
      correo,
      datos.whatsapp ? "'" + comoTexto(datos.whatsapp) : '',
      comoTexto(datos.ciudad),
      comoTexto(datos.perfil),
      comoTexto(datos.nota),
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

function claveDeHoy(correo) {
  return 'enviado:' + correo + ':' + Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
}

function yaSeLeEscribioHoy(correo) {
  try {
    return Boolean(CacheService.getScriptCache().get(claveDeHoy(correo)));
  } catch (fallo) {
    console.warn('La memoria de repetidos no responde: ' + fallo);
    return false;
  }
}

function apuntarQueSeLeEscribio(correo) {
  try {
    CacheService.getScriptCache().put(claveDeHoy(correo), '1', 21600);
  } catch (fallo) {
    console.warn('No se pudo apuntar el envío: ' + fallo);
  }
}

function propiedad(nombre) {
  var valor = PropertiesService.getScriptProperties().getProperty(nombre);
  return valor ? String(valor).trim() : '';
}

function leerCuerpo(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  try {
    var datos = JSON.parse(e.postData.contents);
    return datos && typeof datos === 'object' ? datos : null;
  } catch (fallo) {
    console.error('Llegó algo que no es JSON: ' + String(e.postData.contents).slice(0, 200));
    return null;
  }
}

function pareceCorreo(correo) {
  return /^[^\s@]+@[^\s@,]+\.[a-z]{2,}$/i.test(correo);
}

function comoTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).slice(0, 1000);
}

function nombreCorto(nombre) {
  return String(nombre || '').trim().split(/\s+/)[0] || '';
}

function empiezaPor(texto, principio) {
  return texto.lastIndexOf(principio, 0) === 0;
}

function rellenar(carta, hueco, valor) {
  return carta.replace(new RegExp('\\{\\{' + hueco + '\\}\\}', 'g'), function () {
    return valor;
  });
}

function escapar(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

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
