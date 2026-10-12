/**
 * La ficha de cada terapeuta en «Localiza tu terapeuta»: los tipos, las listas
 * cerradas y las reglas de lo que se puede escribir.
 *
 * Es un módulo PURO (sin nada de servidor) porque lo leen tres partes que
 * tienen que decir exactamente lo mismo: el onboarding, que avisa mientras se
 * escribe y pinta la vista previa; la API, que es la que manda y vuelve a
 * revisarlo todo; y las páginas públicas, que solo leen la copia pública. Si
 * la vista previa y la ficha publicada salieran de dos funciones distintas, un
 * día la vista previa enseñaría la dirección y la pública no, o al revés.
 *
 * Hay DOS documentos por terapeuta, a propósito:
 *   · `fichas/{uid}`: el maestro, privado. Lleva el consentimiento, el estado
 *     y todo lo que ella escribe, también lo que decide no enseñar.
 *   · `terapeutas_publicas/{slug}`: la copia pública, lo ÚNICO que leen las
 *     páginas de la web. Solo existe mientras la ficha está publicada, y no
 *     lleva nada privado: ni correo, ni consentimiento, ni la dirección si no
 *     la quiere enseñar.
 */

import { PREFIJOS } from './prefijos';

export const COLECCION_FICHAS = 'fichas';
export const COLECCION_PUBLICAS = 'terapeutas_publicas';

/* --------------------------------------------------------------- listas */

/**
 * Lo que se puede marcar. Lista cerrada: un texto libre acaba diciendo
 * «postquirúrgico» o «reductivo», y eso es una promesa sanitaria que una web
 * de estética no puede publicar. Es la misma lista que el buscador público.
 */
export const TRATAMIENTOS_FICHA = [
  'Drenaje linfático',
  'Moldeo y tonificación',
  'Divine facial',
  'Maderoterapia',
  'Valoración Divine',
] as const;
export type TratamientoFicha = (typeof TRATAMIENTOS_FICHA)[number];

/** A qué se dedica: las mismas opciones que el formulario de la web. */
export const ESPECIALIDADES = [
  'Esteticista con cabina propia',
  'Trabajo en un centro de otra persona',
  'Masajista o terapeuta corporal',
  'Estoy formándome todavía',
  'Otra cosa',
] as const;
export type Especialidad = (typeof ESPECIALIDADES)[number];

/**
 * Cómo se lee cada especialidad en la web. Las opciones están escritas para
 * que ella las elija («Trabajo en un centro de otra persona»); en una tarjeta
 * pública, en primera persona, suenan raras. «Otra cosa» y «Estoy formándome»
 * no dicen nada a quien busca terapeuta: no se publican.
 */
export const ESPECIALIDAD_PUBLICA: Record<Especialidad, string> = {
  'Esteticista con cabina propia': 'Esteticista con cabina propia',
  'Trabajo en un centro de otra persona': 'Esteticista en centro',
  'Masajista o terapeuta corporal': 'Masajista y terapeuta corporal',
  'Estoy formándome todavía': '',
  'Otra cosa': '',
};

/** El slug de una ficha nunca puede ser esto: `/terapeutas/en/…` son las ciudades. */
export const RESERVADOS = ['en'];

/** Lo largo que puede ser cada campo. El servidor recorta y rechaza con esto. */
export const LIMITES = {
  nombre: 60,
  centro: 80,
  frase: 90,
  sobre: 500,
  ciudad: 80,
  cp: 10,
  direccion: 120,
  instagram: 30,
  web: 200,
} as const;

/* ---------------------------------------------------------- consentimiento */

export const VERSION_CONSENTIMIENTO = 'ficha-v1';

/**
 * Lo que acepta, palabra por palabra. Se guarda copiado en su ficha junto con
 * la fecha: si un día cambia, se sube la versión y se sabe qué aceptó cada una.
 */
export const TEXTO_CONSENTIMIENTO =
  'Acepto que Sorela Caro publique mi ficha en su web, en «Localiza tu terapeuta», con lo que he escrito: ' +
  'mi nombre, mi foto, el nombre de mi centro, mi frase, el texto sobre mí, mi especialidad, mis tratamientos, ' +
  'mi ciudad y mi país, y mi WhatsApp, Instagram y web si los he puesto. La dirección y el código postal, ' +
  'solo si he elegido mostrarlos. Puedo quitar la ficha cuando quiera desde la plataforma.';

/* ------------------------------------------------------------------ tipos */

export type EstadoFicha = 'borrador' | 'publicada' | 'oculta';
export type Precision = 'exacta' | 'ciudad';

/** Lo que ella escribe. Es lo que manda el onboarding y lo que se revisa. */
export type DatosFicha = {
  nombre: string;
  centro: string;
  frase: string;
  sobre: string;
  especialidad: string;
  tratamientos: string[];
  /** Código de país en mayúsculas ('ES'), de la lista de lib/prefijos. */
  pais: string;
  ciudad: string;
  cp: string;
  direccion: string;
  mostrarDireccion: boolean;
  /** E.164 ('+34600111222') o vacío. */
  whatsapp: string;
  /** Sin @, o vacío. */
  instagram: string;
  /** https://… o vacío. */
  web: string;
};

export const FICHA_VACIA: DatosFicha = {
  nombre: '',
  centro: '',
  frase: '',
  sobre: '',
  especialidad: '',
  tratamientos: [],
  pais: 'ES',
  ciudad: '',
  cp: '',
  direccion: '',
  mostrarDireccion: false,
  whatsapp: '',
  instagram: '',
  web: '',
};

/** La ficha maestra tal como la ve su dueña (y la API): fechas en ISO. */
export type Ficha = DatosFicha & {
  uid: string;
  estado: EstadoFicha;
  ocultaPorSorela: boolean;
  slug: string | null;
  paisNombre: string;
  lat: number | null;
  lng: number | null;
  precision: Precision;
  /** URL pública de la foto (copia del avatar), o null: se pintan las iniciales. */
  foto: string | null;
  consentimiento: { fecha: string; version: string; texto: string } | null;
  creado: string | null;
  actualizado: string | null;
  publicadaEl: string | null;
};

/** La copia pública: lo único que lee la web. */
export type FichaPublica = {
  slug: string;
  uid: string;
  nombre: string;
  iniciales: string;
  centro: string;
  frase: string;
  sobre: string;
  especialidad: string;
  tratamientos: string[];
  pais: string;
  paisNombre: string;
  ciudad: string;
  ciudadSlug: string;
  /** '' si no muestra la dirección. */
  cp: string;
  /** '' si no la muestra. */
  direccion: string;
  /** Exactas solo si muestra la dirección; si no, el centro de su ciudad. */
  lat: number;
  lng: number;
  precision: Precision;
  whatsapp: string;
  instagram: string;
  web: string;
  foto: string | null;
  actualizado: string;
  publicadaEl: string;
};

/** Una fila de la lista de Sorela. */
export type FilaFicha = {
  uid: string;
  nombre: string;
  estado: EstadoFicha;
  ocultaPorSorela: boolean;
  ciudad: string;
  slug: string | null;
  actualizado: string | null;
  paisNombre: string;
  foto: string | null;
  /** Por qué dejó de estar publicada, si dejó: 'propia', 'sin-membresia'. */
  motivo: string | null;
};

export type ErroresFicha = Partial<Record<keyof DatosFicha | 'consentimiento' | 'permiso' | 'general', string>>;

/* ----------------------------------------------------------- utilidades */

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Minúsculas, sin tildes, con guiones. Nunca vacío y nunca una ruta reservada. */
export function slugDe(texto: string): string {
  const s = sinTildes(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
  if (!s) return 'terapeuta';
  return RESERVADOS.includes(s) ? `${s}-terapeuta` : s;
}

/** «María José García» → «MG». */
export function inicialesDe(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '·';
  const a = p[0][0] ?? '';
  const b = p.length > 1 ? (p[p.length - 1][0] ?? '') : '';
  return (a + b).toUpperCase();
}

/** El nombre del país a partir de su código, de la misma lista que los prefijos. */
export const paisNombreDe = (codigo: string) => PREFIJOS.find((p) => p.region === codigo)?.pais ?? '';

/** Los países que se ofrecen: los de la lista de prefijos, sin repetir. */
export const PAISES = PREFIJOS.map((p) => ({ codigo: p.region, nombre: p.pais, bandera: p.bandera }));

/**
 * «madrid» o «MADRID» → «Madrid». Solo si está todo en minúsculas o todo en
 * mayúsculas: si ella ya lo ha escrito con sus mayúsculas, se respeta.
 */
function capitalizar(t: string): string {
  if (t !== t.toLowerCase() && t !== t.toUpperCase()) return t;
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'da', 'do', 'dos']);
  return t
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && menores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Una línea: sin saltos ni caracteres de control, espacios simples. */
const linea = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Un párrafo: se respetan los saltos (como mucho uno en blanco seguido). */
const parrafo = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);

/* ------------------------------------------------- palabras prohibidas */

/**
 * Lo que no se puede escribir en una ficha pública: promesas de salud o de
 * resultado. Esto es estética, no sanidad, y la web entera lo cumple; una ficha
 * con «elimino la celulitis» lo rompería con el nombre de la Técnica Divine al
 * lado. Se buscan palabras enteras (sin tildes, con su plural), así que
 * «procura» no salta por «cura».
 */
export const PALABRAS_PROHIBIDAS: string[] = [
  'toxinas',
  'toxina',
  'desintoxicar',
  'desintoxicación',
  'detox',
  'linfedema',
  'lipedema',
  'postoperatorio',
  'postoperatoria',
  'post operatorio',
  'post operatoria',
  'postquirúrgico',
  'postquirúrgica',
  'post quirúrgico',
  'post quirúrgica',
  'quirúrgico',
  'quirúrgica',
  'cirugía',
  'celulitis',
  'adelgazar',
  'adelgazamiento',
  'adelgazante',
  'pérdida de peso',
  'perder peso',
  'bajar de peso',
  'reducir grasa',
  'quemar grasa',
  'eliminar grasa',
  'reductivo',
  'reductiva',
  'reductor',
  'reductora',
  'defensas',
  'inmunidad',
  'sistema inmune',
  'inmunológico',
  'inmunológica',
  'hormonas',
  'hormonal',
  'metabolismo',
  'curar',
  'cura',
  'curo',
  'curan',
  'curación',
  'curativo',
  'curativa',
  'patología',
  'patológico',
  'patológica',
  'diástasis',
  'cicatriz',
  'cicatrices',
  'estrías',
  'acné',
  'dolor',
  'ansiedad',
  'tratamiento médico',
  'fisioterapia',
  'fisioterapeuta',
];

/* «Dolores» es un nombre de mujer muy común (y de centro: «Estética Dolores»):
   de «dolor» no se busca el plural. */
const SIN_PLURAL = new Set(['dolor']);
const PROHIBIDAS_NORMALIZADAS = PALABRAS_PROHIBIDAS.map((p) => ({ p, n: ` ${normalizar(p)} `, plural: !SIN_PLURAL.has(p) }));

/*
 * Los compuestos típicos de estética («anticelulitis», «antiestrías»,
 * «quemagrasas», «posquirúrgico»…) no son palabras enteras de la lista, así
 * que se buscan por su RAÍZ al principio de palabra (con su prefijo, si lo
 * lleva). Se avisa con la palabra base, para que el texto siga siendo
 * «“celulitis” no se puede poner…». Al principio de palabra y no en cualquier
 * sitio: «estria» suelta saltaría en «maestría», y «grasa» sola en «piel
 * grasa», que sí es estética. Las que dan falsos positivos (cura/procura,
 * dolor/Dolores) siguen como palabra entera, arriba.
 */
const COMPUESTOS: { p: string; re: RegExp }[] = [
  { p: 'celulitis', re: / (?:anti)?celulit/ },
  { p: 'estrías', re: / (?:anti)?estria/ },
  { p: 'cicatrices', re: / (?:anti)?cicatri/ },
  { p: 'adelgazar', re: / adelgaz/ },
  { p: 'linfedema', re: / (?:anti)?linfedem/ },
  { p: 'lipedema', re: / (?:anti)?lipedem/ },
  { p: 'toxinas', re: / (?:anti|des)?toxin/ },
  { p: 'detox', re: / detox/ },
  { p: 'desintoxicar', re: / des(?:in)?tox/ },
  { p: 'quirúrgico', re: / (?:post?|pre)?quirurg/ },
  { p: 'postoperatorio', re: / post?operat/ },
  { p: 'quemar grasa', re: / (?:quema|anti|reduce|reductor|reductora)grasa/ },
];

function normalizar(t: string) {
  return sinTildes(t)
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** La primera palabra prohibida que aparece en el texto, o null. */
export function buscarProhibida(texto: string): string | null {
  const t = ` ${normalizar(texto)} `;
  if (t.trim() === '') return null;
  for (const { p, n, plural } of PROHIBIDAS_NORMALIZADAS) {
    if (t.includes(n)) return p;
    if (!plural) continue;
    // El plural: «toxina» → «toxinas», «hormonal» → «hormonales».
    const raiz = n.trimEnd();
    if (t.includes(`${raiz}s `) || t.includes(`${raiz}es `)) return p;
  }
  for (const { p, re } of COMPUESTOS) if (re.test(t)) return p;
  return null;
}

/** El aviso de una palabra prohibida, igual en el navegador y en el servidor. */
export const avisoProhibida = (p: string) =>
  `«${p}» no se puede poner: es un término sanitario o de resultado. Cuenta cómo trabajas, no lo que cura.`;

/** Precios: en la ficha no van. Cada una los habla directamente con su clienta. */
const PRECIO = /(\d[\d.,]*\s*(€|eur\b|euros?\b))|(€\s*\d)/i;
const ENLACE = /(https?:\/\/|www\.)\S/i;

/* --------------------------------------------------------- contactos */

/**
 * El WhatsApp en formato internacional (E.164): «+» y de 8 a 15 cifras.
 *
 * Llega ya con su prefijo desde el desplegable de país (`telefonoCompleto` de
 * lib/prefijos). Si llega sin «+», se le pone el del país de la ficha. Un
 * «00» delante es el «+» de toda la vida. Devuelve '' si viene vacío y null
 * si no es un número que sirva para escribir por WhatsApp.
 */
export function normalizarWhatsapp(valor: string, pais = 'ES'): string | null {
  let v = String(valor ?? '').trim();
  if (!v) return '';
  v = v.replace(/[\s().\-/]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (!v.startsWith('+')) {
    const prefijo = PREFIJOS.find((p) => p.region === pais)?.prefijo ?? '+34';
    v = `${prefijo}${v.replace(/^0+/, '')}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(v)) return null;
  // España: nueve cifras y empieza por 6, 7, 8 o 9. Es el caso más común y
  // el que más dedazos tiene (una cifra de más o de menos).
  if (v.startsWith('+34') && !/^\+34[6-9]\d{8}$/.test(v)) return null;
  return v;
}

/**
 * El usuario de Instagram, sin @. Acepta que lo peguen como enlace
 * (instagram.com/usuario). Devuelve null si lleva algo que Instagram no admite.
 */
export function normalizarInstagram(valor: string): string | null {
  let v = String(valor ?? '').trim();
  if (!v) return '';
  v = v.replace(/^https?:\/\//i, '').replace(/^(www\.)?instagram\.com\//i, '');
  v = v.split(/[/?#]/)[0].replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(v)) return null;
  return v;
}

/**
 * La web, siempre con https. Si la escriben sin «https://» se le pone; si
 * la escriben con «http://» se rechaza: un enlace inseguro desde la web de
 * Sorela avisa en rojo en el navegador de quien lo pulsa.
 */
export function normalizarWeb(valor: string): string | null {
  let v = String(valor ?? '').trim();
  if (!v) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null;
    const limpio = u.toString();
    return limpio.length <= LIMITES.web ? limpio : null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------- revisión */

/**
 * Junta lo que llega con lo que ya había: SOLO las claves que llegan cambian.
 * El onboarding guarda paso a paso y no puede borrar la frase por mandar solo
 * la ciudad. Aquí se limpia la forma (largo, espacios, listas cerradas); que
 * los valores sean buenos lo dice `revisarFicha`.
 */
export function mezclarFicha(base: DatosFicha, crudo: unknown): DatosFicha {
  const c = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const d: DatosFicha = { ...base, tratamientos: [...base.tratamientos] };
  const hay = (k: keyof DatosFicha) => Object.prototype.hasOwnProperty.call(c, k);

  if (hay('nombre')) d.nombre = linea(c.nombre, LIMITES.nombre);
  if (hay('centro')) d.centro = linea(c.centro, LIMITES.centro);
  if (hay('frase')) d.frase = linea(c.frase, LIMITES.frase);
  if (hay('sobre')) d.sobre = parrafo(c.sobre, LIMITES.sobre);
  if (hay('especialidad')) {
    const e = linea(c.especialidad, 80);
    d.especialidad = (ESPECIALIDADES as readonly string[]).includes(e) ? e : '';
  }
  if (hay('tratamientos') && Array.isArray(c.tratamientos)) {
    const marcados = new Set(c.tratamientos.map((t) => String(t)));
    // En el orden de la lista, sin repetir y sin nada que no esté en ella.
    d.tratamientos = TRATAMIENTOS_FICHA.filter((t) => marcados.has(t));
  }
  if (hay('pais')) {
    const p = linea(c.pais, 4).toUpperCase();
    d.pais = PREFIJOS.some((x) => x.region === p) ? p : '';
  }
  if (hay('ciudad')) d.ciudad = capitalizar(linea(c.ciudad, LIMITES.ciudad));
  if (hay('cp')) d.cp = linea(c.cp, LIMITES.cp).toUpperCase();
  if (hay('direccion')) d.direccion = linea(c.direccion, LIMITES.direccion);
  if (hay('mostrarDireccion')) d.mostrarDireccion = c.mostrarDireccion === true;
  // Los contactos se guardan tal cual llegan; `revisarFicha` los valida y
  // `contactosLimpios` los deja en su forma buena.
  if (hay('whatsapp')) d.whatsapp = linea(c.whatsapp, 32);
  if (hay('instagram')) d.instagram = linea(c.instagram, 80);
  if (hay('web')) d.web = linea(c.web, LIMITES.web + 20);
  return d;
}

/**
 * Qué está mal, campo a campo, con un texto que se puede enseñar tal cual.
 *
 * `completa`: además de que lo escrito sea válido, que esté todo lo que hace
 * falta para salir en el mapa (nombre, país, ciudad, frase, un tratamiento y
 * una forma de contacto). Se pide al publicar y al guardar una ficha que ya
 * está publicada: lo que está en la web nunca puede quedar a medias.
 */
export function revisarFicha(d: DatosFicha, completa: boolean): ErroresFicha {
  const e: ErroresFicha = {};

  /* También el nombre y la dirección: salen en el título de la página, en el
     H1, en la descripción, en los datos para Google y en el slug. */
  for (const campo of ['nombre', 'centro', 'direccion', 'frase', 'sobre'] as const) {
    const p = buscarProhibida(d[campo]);
    if (p) e[campo] = avisoProhibida(p);
    else if (PRECIO.test(d[campo])) e[campo] = 'Sin precios en la ficha: eso lo hablas directamente con cada clienta.';
  }
  for (const campo of ['frase', 'sobre'] as const) {
    if (!e[campo] && ENLACE.test(d[campo])) e[campo] = 'Los enlaces van en su sitio: tu Instagram o tu web, más abajo.';
  }

  if (d.whatsapp && normalizarWhatsapp(d.whatsapp, d.pais) === null)
    e.whatsapp = 'Ese número no sirve para WhatsApp. Elige el país y escribe el móvil entero.';
  if (d.instagram && normalizarInstagram(d.instagram) === null)
    e.instagram = 'Escribe solo tu usuario: letras, números, punto y guion bajo.';
  if (d.web && normalizarWeb(d.web) === null) e.web = 'Esa web no es válida. Tiene que ser segura (https://).';
  if (d.cp && !/^[A-Z0-9][A-Z0-9 -]{1,9}$/.test(d.cp)) e.cp = 'Ese código postal no parece correcto.';

  if (completa) {
    if (!e.nombre && d.nombre.length < 2) e.nombre = 'Escribe tu nombre como quieres que salga.';
    if (!d.pais) e.pais = 'Elige tu país.';
    if (d.ciudad.length < 2) e.ciudad = 'Escribe la ciudad donde trabajas.';
    if (!e.frase && d.frase.length < 10) e.frase = 'Escribe una frase corta que te presente (al menos 10 letras).';
    if (!d.tratamientos.length) e.tratamientos = 'Marca al menos un tratamiento.';
    if (!d.whatsapp && !d.instagram && !e.whatsapp && !e.instagram)
      e.whatsapp = 'Pon al menos tu WhatsApp o tu Instagram: es por donde te van a escribir.';
    if (!e.direccion && d.mostrarDireccion && d.direccion.length < 4) e.direccion = 'Escribe la dirección o desmarca «Mostrar la dirección».';
  }
  return e;
}

/** Los contactos en su forma buena (después de `revisarFicha` sin errores). */
export function contactosLimpios(d: DatosFicha): Pick<DatosFicha, 'whatsapp' | 'instagram' | 'web'> {
  return {
    whatsapp: normalizarWhatsapp(d.whatsapp, d.pais) || '',
    instagram: normalizarInstagram(d.instagram) || '',
    web: normalizarWeb(d.web) || '',
  };
}

/* ------------------------------------------------------ copia pública */

/**
 * La copia pública a partir de la ficha. La usan el servidor al publicar y el
 * onboarding para la vista previa: por eso la vista previa es EXACTA.
 *
 * Lo que no se enseña no se copia: sin «mostrar dirección», ni calle ni código
 * postal, y las coordenadas son las del centro de la ciudad.
 */
export function fichaPublicaDe(
  d: DatosFicha & {
    uid: string;
    slug: string;
    foto: string | null;
    lat: number;
    lng: number;
    precision: Precision;
    actualizado: string;
    publicadaEl: string;
  }
): FichaPublica {
  const muestra = d.mostrarDireccion && Boolean(d.direccion);
  const c = contactosLimpios(d);
  return {
    slug: d.slug,
    uid: d.uid,
    nombre: d.nombre,
    iniciales: inicialesDe(d.nombre),
    centro: d.centro,
    frase: d.frase,
    sobre: d.sobre,
    especialidad: ESPECIALIDAD_PUBLICA[d.especialidad as Especialidad] ?? '',
    tratamientos: TRATAMIENTOS_FICHA.filter((t) => d.tratamientos.includes(t)),
    pais: d.pais,
    paisNombre: paisNombreDe(d.pais),
    ciudad: d.ciudad,
    ciudadSlug: slugDe(d.ciudad),
    cp: muestra ? d.cp : '',
    direccion: muestra ? d.direccion : '',
    lat: d.lat,
    lng: d.lng,
    precision: muestra ? d.precision : 'ciudad',
    whatsapp: c.whatsapp,
    instagram: c.instagram,
    web: c.web,
    foto: d.foto,
    actualizado: d.actualizado,
    publicadaEl: d.publicadaEl,
  };
}

/** El enlace de WhatsApp con un saludo ya escrito (el mismo en la web y en la vista previa). */
export function enlaceWhatsapp(numero: string, nombre: string): string {
  const digitos = numero.replace(/\D/g, '');
  const texto = `Hola, ${nombre.split(' ')[0] || ''}. Te he encontrado en «Localiza tu terapeuta» de la Técnica Divine y me gustaría pedirte cita.`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
