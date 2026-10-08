/**
 * La protección de datos de la web, en un solo sitio.
 *
 * De aquí tiran dos cosas que tienen que decir exactamente lo mismo: la
 * política de privacidad completa (`/legal/privacidad`) y el recuadro corto
 * que acompaña a cada formulario —la «primera capa» que pide la Agencia
 * Española de Protección de Datos—. Con dos textos escritos por separado, un
 * día el formulario promete algo que la política no dice.
 *
 * TODO LO QUE HAY AQUÍ DESCRIBE LO QUE LA WEB HACE DE VERDAD. Cada
 * tratamiento corresponde a un formulario real y cada destinatario a un
 * servicio que se usa: Firestore y Gmail de Google, Vercel para el
 * alojamiento. Si se añade un formulario, un servicio o una analítica, hay
 * que añadirlo aquí; si no, la política deja de ser cierta.
 *
 * LA IDENTIDAD DE SORELA (nombre, NIF y domicilio) NO ESTÁ AQUÍ. El
 * repositorio es público. Se lee en el momento de Firestore (`ajustes/
 * fiscales`), que es donde ya están para las facturas.
 */

/** El correo para todo lo relacionado con los datos. */
export const CORREO_PRIVACIDAD = 'sorelacarooficial@gmail.com';

/** Cuándo se revisó por última vez. Cambiarlo cada vez que se toque esto. */
export const REVISADA = '6 de octubre de 2026';

export type Tratamiento = {
  /** Para qué formulario o parte de la web. */
  donde: string;
  datos: string;
  finalidad: string;
  base: string;
  conservacion: string;
};

export const TRATAMIENTOS: Tratamiento[] = [
  {
    donde: 'Formularios de información, contacto y lista de espera',
    datos:
      'Nombre, correo electrónico y, si lo das, teléfono o WhatsApp, ciudad, a qué te dedicas y el mensaje que escribas.',
    finalidad:
      'Enviarte la información que pides y escribirte sobre las formaciones de la Técnica Divine, la Comunidad Divine y su membresía.',
    base: 'Tu consentimiento, que das al marcar la casilla del formulario y puedes retirar cuando quieras.',
    conservacion:
      'Hasta que pidas la baja o retires el consentimiento y, como máximo, dos años desde el último contacto.',
  },
  {
    donde: 'Reserva de cita y aviso de terapeuta en tu ciudad',
    datos: 'Nombre, datos de contacto, ciudad y lo que indiques en el formulario.',
    finalidad: 'Gestionar tu cita o avisarte cuando haya una terapeuta certificada cerca de ti.',
    base: 'Tu consentimiento.',
    conservacion: 'El tiempo necesario para gestionar la cita o el aviso, y como máximo dos años.',
  },
  {
    donde: 'Cuenta en la plataforma',
    datos: 'Nombre, correo electrónico y, si entras con Google, tu identificador de Google.',
    finalidad: 'Darte acceso a tu espacio, a las formaciones que hayas contratado y a la comunidad.',
    base: 'La relación contractual que tienes con Sorela Caro al darte de alta o contratar una formación.',
    conservacion: 'Mientras tengas la cuenta y, después, los plazos legales de prescripción.',
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
      'Mientras dure la obligación de confidencialidad y, después, durante los plazos de prescripción de las acciones legales.',
  },
  {
    donde: 'Facturación',
    datos: 'Nombre o razón social, NIF y domicilio fiscal.',
    finalidad: 'Emitir y conservar las facturas de las formaciones.',
    base: 'El cumplimiento de las obligaciones fiscales y mercantiles.',
    conservacion: 'Los plazos que marca la ley: seis años para la documentación mercantil.',
  },
];

/** Quién trata los datos por encargo de Sorela, y para qué. */
export const ENCARGADOS: { quien: string; para: string }[] = [
  {
    quien: 'Google (Firebase, Gmail y Google Drive)',
    para: 'Guardar los datos de la web y la plataforma, y enviar los correos.',
  },
  { quien: 'Vercel', para: 'Alojar la web.' },
  {
    quien: 'YouTube (en modo de privacidad mejorada)',
    para: 'Mostrar los vídeos del aula de la plataforma.',
  },
  {
    quien: 'Anthropic (Claude)',
    para:
      'Ayudar a Sorela a priorizar y redactar sus respuestas. Solo recibe tu nombre de pila, qué buscas, tu ciudad y lo que escribiste; nunca tu correo ni tu teléfono.',
  },
];

/**
 * La primera capa: lo que va junto a cada formulario.
 *
 * `finalidad` y `base` cambian según el formulario; el resto es igual en
 * todos. Es lo mínimo que hay que tener delante ANTES de enviar los datos, y
 * remite a la política completa para lo demás.
 */
export type PrimeraCapa = { finalidad: string; base: string };

export const CAPA_INFORMACION: PrimeraCapa = {
  finalidad:
    'Enviarte la información que pides y escribirte sobre las formaciones, la Comunidad Divine y su membresía.',
  base: 'Tu consentimiento, que puedes retirar cuando quieras.',
};

export const CAPA_CITA: PrimeraCapa = {
  finalidad: 'Gestionar tu cita o avisarte cuando haya una terapeuta cerca de ti.',
  base: 'Tu consentimiento, que puedes retirar cuando quieras.',
};

export const CAPA_CUENTA: PrimeraCapa = {
  finalidad: 'Crear tu cuenta y darte acceso a tu espacio y a lo que contrates.',
  base: 'La relación contractual al darte de alta.',
};

export const CAPA_ACUERDO: PrimeraCapa = {
  finalidad:
    'Formalizar y custodiar tu acuerdo, poder acreditar la firma y enviarte tu copia y el dossier.',
  base: 'La ejecución del acuerdo que firmas y el interés legítimo en poder acreditarlo.',
};
