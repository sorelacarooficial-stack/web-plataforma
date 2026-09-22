/**
 * ============================================================================
 *  CAPTACIÓN SORELA DIVINE · script para pegar en Google
 * ============================================================================
 *
 *  Esto NO se ejecuta en la web. Se pega dentro de una hoja de cálculo de
 *  Google y es lo que guarda cada contacto y manda los dos correos.
 *
 *  ---------------------------------------------------------------------------
 *  CÓMO SE MONTA (diez minutos, una sola vez)
 *  ---------------------------------------------------------------------------
 *
 *  1. Entra en sheets.new con la cuenta de Google de Sorela. Se crea una hoja
 *     en blanco. Ponle de nombre «Captación Divine».
 *
 *  2. Menú Extensiones → Apps Script. Se abre una pestaña con un editor y un
 *     archivo que pone «function myFunction() {}». Borra todo lo que haya.
 *
 *  3. Pega este archivo entero.
 *
 *  4. Cambia las tres líneas de AJUSTES que hay justo aquí debajo. La clave
 *     invéntatela larga: son treinta caracteres al azar, no una contraseña
 *     que quieras recordar.
 *
 *  5. Pulsa el icono de guardar.
 *
 *  6. Botón azul «Implementar» (arriba a la derecha) → «Nueva implementación».
 *     Pulsa la rueda dentada de la izquierda y elige «Aplicación web».
 *        · Descripción:            captación
 *        · Ejecutar como:          Yo
 *        · Quién puede acceder:    CUALQUIER PERSONA      ← importante
 *     Pulsa «Implementar».
 *
 *  7. Google pedirá permiso. Di que sí a todo. Cuando salga la pantalla gris
 *     de «Google no ha verificado esta aplicación», pulsa «Configuración
 *     avanzada» y luego «Ir a Captación Divine (no seguro)». Es tu propio
 *     script: ese aviso sale siempre con los scripts propios.
 *
 *  8. Te dará una dirección larga que acaba en /exec. Ésa es la que hay que
 *     pasarme, junto con la clave que te inventaste en el punto 4.
 *
 *  ---------------------------------------------------------------------------
 *  SI DESPUÉS CAMBIAS ALGO DE ESTE ARCHIVO
 *  ---------------------------------------------------------------------------
 *  No basta con guardar. Hay que ir a Implementar → Gestionar implementaciones
 *  → lápiz → Versión: «Nueva versión» → Implementar. Si no, sigue corriendo la
 *  versión antigua y parece que el cambio no ha servido de nada.
 *
 *  ---------------------------------------------------------------------------
 *  CUÁNTOS CORREOS PUEDE MANDAR AL DÍA
 *  ---------------------------------------------------------------------------
 *  Cuenta de Gmail normal:   100 al día.
 *  Google Workspace:       1.500 al día.
 *  Cada contacto gasta dos (uno a la persona y otro a Sorela). Si se agota la
 *  cuota, la fila SE SIGUE GUARDANDO y solo se queda sin enviar el correo.
 *  Eso es a propósito: el contacto no se pierde nunca.
 */

/* ========================== AJUSTES ========================== */

/** La misma clave que me pases a mí. Invéntate treinta caracteres al azar. */
const SECRETO = 'CAMBIA-ESTO-POR-UNA-CLAVE-LARGA-Y-RARA';

/** A dónde llega el aviso de que alguien ha dejado el dato. */
const AVISAR_A = 'CAMBIA-ESTO@por-el-correo-de-sorela.com';

/** Cómo firma Sorela los correos automáticos. */
const FIRMA = 'Sorela Caro';

/* ============================================================= */

const COLUMNAS = [
  'Fecha',
  'Nombre',
  'Correo',
  'WhatsApp',
  'A qué se dedica',
  'De dónde viene',
  'Consentimiento',
  'Correo enviado',
];

/** Google llama a esto cada vez que la web manda un contacto. */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return responder(false, 'sin-cuerpo');

    const d = JSON.parse(e.postData.contents);

    // Sin la clave correcta no se guarda nada. Es lo único que impide que
    // cualquiera que descubra la dirección llene la hoja de basura.
    if (d.secreto !== SECRETO) return responder(false, 'clave');
    if (!d.nombre || !d.correo) return responder(false, 'faltan-datos');

    const hoja = hojaDeCaptacion();

    // Si ese correo ya está, se anota en la fila que existe en vez de crear
    // una nueva. En una exposición la gente escanea el QR dos veces.
    const yaEstaba = buscarFila(hoja, d.correo);

    const fila = [
      new Date(),
      d.nombre,
      d.correo,
      // El apóstrofo obliga a la hoja a tratarlo como texto. Sin él, Google
      // se come el signo + del prefijo y el número queda inservible.
      "'" + d.whatsapp,
      d.perfil || '',
      d.origen || 'web',
      d.consentimiento ? 'Sí' : 'No',
      '',
    ];

    const numeroFila = yaEstaba || hoja.getLastRow() + 1;
    hoja.getRange(numeroFila, 1, 1, fila.length).setValues([fila]);

    // Los correos van después de guardar y dentro de su propio try: si Google
    // se queda sin cuota de envío, la fila ya está escrita y no se pierde.
    let enviado = 'no';
    try {
      if (!yaEstaba) {
        enviarInformacion(d.nombre, d.correo);
        avisarASorela(d);
      }
      enviado = yaEstaba ? 'repetido' : 'sí';
    } catch (fallo) {
      enviado = 'no: ' + fallo.message;
      console.error('No se pudo enviar el correo: ' + fallo.message);
    }
    hoja.getRange(numeroFila, COLUMNAS.length).setValue(enviado);

    return responder(true);
  } catch (fallo) {
    console.error(fallo);
    return responder(false, String(fallo));
  }
}

/** Devuelve la hoja, creando la cabecera la primera vez. */
function hojaDeCaptacion() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName('Contactos') || libro.insertSheet('Contactos');
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
    hoja.setColumnWidth(1, 150);
    hoja.setColumnWidth(3, 230);
  }
  return hoja;
}

/** Número de la fila que ya tiene ese correo, o 0 si no está. */
function buscarFila(hoja, correo) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return 0;
  const correos = hoja.getRange(2, 3, ultima - 1, 1).getValues();
  for (let i = 0; i < correos.length; i++) {
    if (String(correos[i][0]).toLowerCase().trim() === String(correo).toLowerCase().trim()) {
      return i + 2;
    }
  }
  return 0;
}

/** El correo que recibe quien ha dejado su dato. */
function enviarInformacion(nombre, correo) {
  const nombreCorto = String(nombre).trim().split(' ')[0];

  const texto =
    'Hola ' + nombreCorto + ',\n\n' +
    'Soy Sorela. Te escribo porque me has dejado tu contacto y te prometí la información de la Técnica Divine.\n\n' +
    'Te la resumo en tres líneas, que es lo que necesitas para decidir si te interesa:\n\n' +
    'La Técnica Divine no es otro protocolo. Es aprender a leer el cuerpo que tienes delante antes de ponerle las manos encima: qué carga, de dónde viene y qué necesita hoy. Cuando sabes eso, dejas de aplicar lo mismo a todas y empiezas a poder explicar lo que estás haciendo.\n\n' +
    'Se aprende presencialmente, en tres días y en grupos de ocho personas. No hay vídeos ni PDF: esto se aprende con las manos y mirándonos.\n\n' +
    'PRÓXIMAS FECHAS\n' +
    '· Formación Base — Madrid, 14 al 16 de noviembre\n' +
    '· Nivel Avanzado — Valencia, 30 de enero al 1 de febrero\n' +
    '· Lectura corporal (intensivo) — Sevilla, 7 y 8 de marzo\n\n' +
    'Tienes las tres con precio, plazas y requisitos aquí:\n' +
    'https://sorelacarodivine.com/formaciones\n\n' +
    'Lo único que pido es que ya trabajes con las manos y con clientas. No hace falta titulación concreta.\n\n' +
    'Si tienes cualquier duda, respóndeme a este correo. Lo leo yo.\n\n' +
    FIRMA;

  MailApp.sendEmail({
    to: correo,
    subject: 'La información de la Técnica Divine, ' + nombreCorto,
    body: texto,
    name: FIRMA,
  });
}

/** El aviso interno, para que Sorela pueda escribir por WhatsApp el mismo día. */
function avisarASorela(d) {
  const wa = String(d.whatsapp || '').replace(/[^\d]/g, '');
  MailApp.sendEmail({
    to: AVISAR_A,
    subject: 'Contacto nuevo: ' + d.nombre + ' (' + (d.origen || 'web') + ')',
    body:
      d.nombre + '\n' +
      d.correo + '\n' +
      d.whatsapp + '\n' +
      (d.perfil || 'sin especificar') + '\n\n' +
      'Escribirle por WhatsApp:\nhttps://wa.me/' + wa + '\n\n' +
      'Ya le ha llegado el correo con la información de la técnica.',
    name: 'Web Divine',
  });
}

function responder(ok, motivo) {
  return ContentService.createTextOutput(
    JSON.stringify(motivo ? { ok: ok, motivo: motivo } : { ok: ok })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Pruébalo sin la web: selecciona «probar» arriba, dale a Ejecutar y mira que
 * aparezca una fila y que te llegue el correo.
 */
function probar() {
  const r = doPost({
    postData: {
      contents: JSON.stringify({
        secreto: SECRETO,
        nombre: 'Prueba Prueba',
        correo: AVISAR_A,
        whatsapp: '+34600000000',
        perfil: 'Esteticista con cabina propia',
        origen: 'prueba',
        consentimiento: true,
      }),
    },
  });
  console.log(r.getContent());
}
