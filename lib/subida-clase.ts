import { TOPE_VIDEO, TROZO_VIDEO, extensionDeVideo } from './aula';
import type { Acceso } from './accesos';

/**
 * La subida del vídeo de una clase, desde el navegador de Sorela.
 *
 * Vive fuera de la pantalla, en este módulo, a propósito: una clase de una
 * hora pesa más de un giga y tarda en subir. Si viviera dentro de la pantalla
 * de Subir clases, irse un momento a mirar el correo la cortaría. Así la
 * subida sigue mientras ella se mueve por la plataforma, y al volver la
 * pantalla la encuentra por donde va. Solo se corta si cierra la pestaña, y
 * entonces el navegador le pregunta antes.
 *
 * Cómo sube:
 *   1. Pide a la API una sesión de subida reanudable de Google para la
 *      carpeta privada de la clase (app/api/lecciones/subida).
 *   2. Manda el vídeo a esa sesión por trozos de 8 MB, con Content-Range.
 *   3. Si un trozo falla (se va la wifi, se duerme el portátil, Google da un
 *      error pasajero), espera un poco, pregunta a Google cuánto tiene ya y
 *      sigue desde ahí. Sin conexión, espera a que vuelva.
 *   4. Al terminar, guarda la clase (POST /api/lecciones) con la portada.
 *
 * Y si se cierra la pestaña a medias: la sesión se apunta en este navegador.
 * Al volver, elegir el mismo archivo sigue donde se quedó en vez de empezar
 * de cero (la sesión de Google dura una semana).
 */

/* ==========================================================================
   Lo que se enseña
   ========================================================================== */

export type Problema = {
  /** `ilegible`: no se puede subir. `poco-compatible`: se puede, pero avisa. */
  tipo: 'ilegible' | 'poco-compatible';
  titulo: string;
  texto: string;
};

export type Analisis = {
  /** Segundos, o null si el archivo no lo dice. */
  duracion: number | null;
  ancho: number;
  alto: number;
  portada: Blob | null;
  /** La portada para enseñarla en pantalla (dirección local del navegador). */
  portadaUrl: string | null;
  problema: Problema | null;
};

/** Lo que se escribe en el formulario. Sobrevive a cambiar de pantalla. */
export type Borrador = {
  titulo: string;
  descripcion: string;
  /** 'membresia', el nombre de un curso, o NUEVO. */
  destino: string;
  cursoNuevo: string;
  modulo: string;
  publicar: boolean;
};

export type Fase =
  | 'libre' // sin vídeo
  | 'analizando' // leyendo el vídeo para la portada y la duración
  | 'aviso' // leído, con un problema que hay que ver antes de subir
  | 'preparando' // pidiendo la sesión
  | 'subiendo'
  | 'reintentando'
  | 'sin-red'
  | 'subida' // el vídeo está arriba entero; falta guardar la clase
  | 'guardando'
  | 'guardada'
  | 'error';

/** Una subida que se quedó a medias en una visita anterior. */
export type Pendiente = { id: string; sesion: string; nombre: string; tamano: number; modificado: number; creada: number };

export type Estado = {
  fase: Fase;
  archivo: { nombre: string; tamano: number } | null;
  analisis: Analisis | null;
  id: string | null;
  enviados: number;
  total: number;
  /** Bytes por segundo, medidos sobre los últimos segundos. */
  velocidad: number;
  /** Segundos que faltan, o null mientras no hay medida. */
  restante: number | null;
  /** Segundos para el próximo intento, si está esperando. */
  reintentoEn: number | null;
  /** Lo que ha salido mal, en una frase para ella. */
  error: string | null;
  /** Errores de los campos que devuelve la API al guardar. */
  errores: Record<string, string>;
  /** Pulsó «Guardar» antes de que acabara la subida: se guarda sola al terminar. */
  guardarAlTerminar: boolean;
  pendiente: Pendiente | null;
  borrador: Borrador;
  /** El título de la última clase guardada, para el aviso. */
  guardada: { id: string; titulo: string; publicada: boolean } | null;
};

export const NUEVO = '__nuevo__';

const BORRADOR_VACIO: Borrador = { titulo: '', descripcion: '', destino: 'membresia', cursoNuevo: '', modulo: '', publicar: false };

const INICIAL: Estado = {
  fase: 'libre',
  archivo: null,
  analisis: null,
  id: null,
  enviados: 0,
  total: 0,
  velocidad: 0,
  restante: null,
  reintentoEn: null,
  error: null,
  errores: {},
  guardarAlTerminar: false,
  pendiente: null,
  borrador: BORRADOR_VACIO,
  guardada: null,
};

/* ==========================================================================
   El almacén (para useSyncExternalStore)
   ========================================================================== */

let estado: Estado = INICIAL;
const oyentes = new Set<() => void>();
let ultimoAviso = 0;
let avisoPendiente: ReturnType<typeof setTimeout> | null = null;

function poner(cambios: Partial<Estado>, sinPrisa = false) {
  estado = { ...estado, ...cambios };
  // El progreso llega decenas de veces por segundo: a la pantalla, cuatro.
  if (sinPrisa) {
    const falta = 250 - (Date.now() - ultimoAviso);
    if (falta > 0) {
      avisoPendiente ??= setTimeout(() => {
        avisoPendiente = null;
        avisar();
      }, falta);
      return;
    }
  }
  avisar();
}

function avisar() {
  ultimoAviso = Date.now();
  if (avisoPendiente) {
    clearTimeout(avisoPendiente);
    avisoPendiente = null;
  }
  for (const o of oyentes) o();
}

let leidoPendiente = false;

export function suscribir(oyente: () => void) {
  if (!leidoPendiente) {
    leidoPendiente = true;
    const p = leerPendiente();
    if (p && estado.fase === 'libre') estado = { ...estado, pendiente: p.pendiente, borrador: { ...BORRADOR_VACIO, ...p.borrador } };
  }
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export const foto = () => estado;
export const fotoServidor = () => INICIAL;

/** Si hay algo en marcha que se perdería al cerrar la pestaña. */
export const enMarcha = (f: Fase = estado.fase) =>
  f === 'preparando' || f === 'subiendo' || f === 'reintentando' || f === 'sin-red' || f === 'guardando';

/* ==========================================================================
   Lo apuntado en este navegador, para seguir tras cerrar la pestaña
   ========================================================================== */

const CLAVE = 'divine-subida-clase';
const SEMANA_CASI = 6 * 24 * 60 * 60 * 1000;

function leerPendiente(): { pendiente: Pendiente; borrador: Partial<Borrador> } | null {
  try {
    const j = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!j?.pendiente?.id || !j.pendiente.sesion) return null;
    // Google borra las sesiones a la semana: una más vieja ya no sirve.
    if (Date.now() - Number(j.pendiente.creada) > SEMANA_CASI) {
      localStorage.removeItem(CLAVE);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

function apuntar(p: Pendiente | null) {
  try {
    if (p) localStorage.setItem(CLAVE, JSON.stringify({ pendiente: p, borrador: estado.borrador }));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento local: solo se pierde poder seguir tras cerrar */
  }
}

/* ==========================================================================
   Leer el vídeo antes de subirlo: portada, duración y si se puede ver
   ========================================================================== */

const CONSEJO_IPHONE = 'En el iPhone: Ajustes › Cámara › Formatos › Más compatible.';

/**
 * El códec del vídeo, leído de la cabecera del MP4/MOV sin cargar el archivo.
 *
 * Hace falta porque el navegador de Sorela puede leer cosas que el de sus
 * alumnas no: un Mac con Safari ve el HEVC del iPhone sin problema, y un
 * Windows con Chrome muchas veces no. Si solo se mirara si SU navegador lo
 * puede ver, subiría tranquila una clase que media clase no podría abrir.
 *
 * Se recorren las cajas del archivo hasta la de índice (`moov`), que va al
 * principio o al final, y dentro se busca la descripción de cada pista
 * (`stsd`): los cuatro caracteres que siguen son el códec (avc1, hvc1…).
 */
async function codecs(archivo: File): Promise<string[]> {
  const leer = async (desde: number, hasta: number) => new Uint8Array(await archivo.slice(desde, hasta).arrayBuffer());
  const texto = (b: Uint8Array, i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
  let pos = 0;
  for (let vueltas = 0; vueltas < 64 && pos + 8 <= archivo.size; vueltas++) {
    const c = await leer(pos, pos + 16);
    const v = new DataView(c.buffer);
    let tam = v.getUint32(0);
    const tipo = texto(c, 4);
    if (tam === 1) tam = Number(v.getBigUint64(8));
    else if (tam === 0) tam = archivo.size - pos;
    if (tam < 8) return [];
    if (tipo === 'moov') {
      // Un índice de más de 64 MB no es de un vídeo normal: no se lee.
      if (tam > 64 * 1024 * 1024) return [];
      const m = await leer(pos, pos + tam);
      const vistos: string[] = [];
      for (let i = 4; i + 20 <= m.length; i++) {
        if (m[i] === 0x73 && texto(m, i) === 'stsd') vistos.push(texto(m, i + 16));
      }
      return vistos;
    }
    pos += tam;
  }
  return [];
}

const HEVC = ['hvc1', 'hev1', 'dvh1', 'dvhe'];
const PRORES = ['apch', 'apcn', 'apcs', 'apco', 'ap4h', 'ap4x'];

/** Dónde se busca la portada: a esas alturas del vídeo, en ese orden. */
const POSICIONES = [0.12, 0.3, 0.5, 0.7, 0.88, 0.04];

let lector: HTMLVideoElement | null = null;
let lectorUrl: string | null = null;
let posicion = 0;

function soltarLector() {
  if (lector) {
    lector.removeAttribute('src');
    lector.load();
  }
  if (lectorUrl) URL.revokeObjectURL(lectorUrl);
  lector = null;
  lectorUrl = null;
}

function esperarEvento(el: HTMLElement, ok: string, mal: string, ms: number) {
  return new Promise<boolean>((resolver) => {
    const fin = (r: boolean) => {
      el.removeEventListener(ok, si);
      el.removeEventListener(mal, no);
      clearTimeout(t);
      resolver(r);
    };
    const si = () => fin(true);
    const no = () => fin(false);
    const t = setTimeout(() => fin(false), ms);
    el.addEventListener(ok, si);
    el.addEventListener(mal, no);
  });
}

/**
 * Saca un fotograma del vídeo como imagen. Si sale casi negro (un fundido,
 * la tapa del objetivo), prueba en la siguiente posición: una portada negra
 * no dice nada de la clase.
 */
async function sacarPortada(v: HTMLVideoElement, empezarEn: number, buscarLuz: boolean): Promise<Blob | null> {
  const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
  const lienzo = document.createElement('canvas');
  const escala = Math.min(1, 1280 / Math.max(1, v.videoWidth));
  lienzo.width = Math.max(1, Math.round(v.videoWidth * escala));
  lienzo.height = Math.max(1, Math.round(v.videoHeight * escala));
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;

  for (let intento = 0; intento < (buscarLuz ? 3 : 1); intento++) {
    posicion = (empezarEn + intento) % POSICIONES.length;
    const t = dur ? Math.min(dur - 0.1, Math.max(0.1, dur * POSICIONES[posicion])) : 0.5;
    if (Math.abs(v.currentTime - t) > 0.01) {
      v.currentTime = t;
      if (!(await esperarEvento(v, 'seeked', 'error', 8000))) return null;
    }
    // Un fotograma más, para que el que se pinta sea el de después de saltar.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
    if (!buscarLuz) break;
    // ¿Casi negro? Se mira en pequeño, que basta para saberlo.
    const m = document.createElement('canvas');
    m.width = 32;
    m.height = 18;
    const mc = m.getContext('2d');
    if (!mc) break;
    mc.drawImage(lienzo, 0, 0, 32, 18);
    const px = mc.getImageData(0, 0, 32, 18).data;
    let luz = 0;
    for (let i = 0; i < px.length; i += 4) luz += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    if (luz / (px.length / 4) > 18) break;
  }

  const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/webp', 0.84));
  // Safari no sabe hacer webp y devuelve png: entonces, jpeg, que pesa menos.
  if (blob && blob.type === 'image/webp') return blob;
  return new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', 0.86));
}

async function analizar(archivo: File): Promise<Analisis> {
  soltarLector();
  const ext = extensionDeVideo(archivo.name, archivo.type);
  const lista = ext === 'webm' ? [] : await codecs(archivo).catch(() => [] as string[]);

  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  lector = v;
  lectorUrl = URL.createObjectURL(archivo);
  v.src = lectorUrl;

  const ilegible: Analisis = {
    duracion: null,
    ancho: 0,
    alto: 0,
    portada: null,
    portadaUrl: null,
    problema: {
      tipo: 'ilegible',
      titulo: 'Este navegador no puede ver este vídeo',
      texto: lista.some((c) => HEVC.includes(c))
        ? `Está grabado en HEVC, el formato del iPhone, y muchas de tus alumnas tampoco podrían verlo. ${CONSEJO_IPHONE}`
        : `Así tampoco lo verían tus alumnas. Expórtalo en MP4 (H.264) y vuelve a elegirlo. ${CONSEJO_IPHONE}`,
    },
  };

  /* Primero la cabecera (medidas y duración). Si ni eso se puede leer, el
     navegador no entiende el archivo. */
  if (!(await esperarEvento(v, 'loadedmetadata', 'error', 20000))) {
    soltarLector();
    return ilegible;
  }
  /* Después, la primera imagen. El Safari del iPhone no carga nada de un
     vídeo hasta que se le da al play: se le da (sin sonido, que eso sí lo
     deja) y se para. */
  if (v.readyState < 2) {
    await v.play().catch(() => {});
    v.pause();
    await esperarEvento(v, 'loadeddata', 'error', 12000);
  }
  /* Con la imagen cargada y sin anchura, el navegador solo entiende el
     sonido: es lo que hace Chrome con el HEVC en un ordenador sin el códec. */
  if (v.error || (v.readyState >= 2 && !v.videoWidth)) {
    soltarLector();
    return ilegible;
  }

  posicion = 0;
  // Si la imagen no llegó a cargar (algún móvil), se sube sin portada: la
  // clase se ve igual, con su fondo, y eso no es motivo para no dejar subir.
  const portada = v.readyState >= 2 ? await sacarPortada(v, 0, true).catch(() => null) : null;
  const duracion = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null;

  let problema: Problema | null = null;
  if (lista.some((c) => HEVC.includes(c))) {
    problema = {
      tipo: 'poco-compatible',
      titulo: 'Este vídeo no se verá en todos los ordenadores',
      texto: `Está grabado en HEVC, el formato del iPhone: tu navegador lo ve, pero muchos ordenadores con Windows no. ${CONSEJO_IPHONE}`,
    };
  } else if (lista.some((c) => PRORES.includes(c))) {
    problema = {
      tipo: 'poco-compatible',
      titulo: 'Es un archivo de edición (ProRes)',
      texto: 'Pesa muchísimo y casi ningún navegador lo reproduce. Expórtalo en MP4 (H.264) y vuelve a elegirlo.',
    };
  }

  return {
    duracion,
    ancho: v.videoWidth,
    alto: v.videoHeight,
    portada,
    portadaUrl: portada ? URL.createObjectURL(portada) : null,
    problema,
  };
}

/** Otra portada: el siguiente momento del vídeo. */
export async function otraPortada() {
  const a = estado.analisis;
  if (!lector || !a) return;
  const blob = await sacarPortada(lector, posicion + 1, false).catch(() => null);
  if (!blob) return;
  if (a.portadaUrl) URL.revokeObjectURL(a.portadaUrl);
  poner({ analisis: { ...a, portada: blob, portadaUrl: URL.createObjectURL(blob) } });
}

/* ==========================================================================
   Subir
   ========================================================================== */

let archivoActual: File | null = null;
let sesionActual: string | null = null;
/** Cada subida lleva su ficha; cancelar la marca y todo lo que cuelga de ella se para. */
let ficha: { cancelada: boolean; xhr: XMLHttpRequest | null } | null = null;
let muestras: { t: number; b: number }[] = [];

class Fatal extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Una petición a la sesión de Google. Con XMLHttpRequest porque fetch no da el progreso de lo que se envía. */
function enviar(
  f: NonNullable<typeof ficha>,
  cuerpo: Blob | null,
  rango: string,
  alProgresar?: (n: number) => void
): Promise<{ status: number; range: string | null }> {
  return new Promise((ok, mal) => {
    const x = new XMLHttpRequest();
    f.xhr = x;
    x.open('PUT', sesionActual as string);
    x.setRequestHeader('Content-Range', rango);
    /* Un trozo que no avanza en un minuto está colgado (pasa al cambiar de
       wifi): se corta y se pregunta por dónde iba, en vez de esperar para
       siempre a algo que no va a llegar. */
    let ultimo = Date.now();
    const vigia = setInterval(() => {
      if (Date.now() - ultimo > 60_000) x.abort();
    }, 5000);
    const fin = () => {
      clearInterval(vigia);
      if (f.xhr === x) f.xhr = null;
    };
    x.upload.onprogress = (e) => {
      ultimo = Date.now();
      alProgresar?.(e.loaded);
    };
    x.onload = () => {
      fin();
      ok({ status: x.status, range: x.getResponseHeader('Range') });
    };
    x.onerror = () => {
      fin();
      mal(new Error('red'));
    };
    x.onabort = () => {
      fin();
      mal(new Error('cortada'));
    };
    x.send(cuerpo);
  });
}

/** «bytes=0-8388607» → 8388608: lo que Google ya tiene. Sin cabecera, nada. */
const tieneHasta = (range: string | null) => {
  const m = /bytes=0-(\d+)/.exec(range ?? '');
  return m ? Number(m[1]) + 1 : 0;
};

function medir(enviados: number) {
  const ahora = Date.now();
  muestras.push({ t: ahora, b: enviados });
  // La velocidad de los últimos diez segundos: la de todo el rato miente
  // en cuanto la conexión cambia.
  muestras = muestras.filter((m) => ahora - m.t <= 10_000);
  const a = muestras[0];
  const z = muestras[muestras.length - 1];
  const velocidad = z.t - a.t >= 1500 ? Math.max(0, (z.b - a.b) / ((z.t - a.t) / 1000)) : estado.velocidad;
  const restante = velocidad > 0 ? (estado.total - enviados) / velocidad : null;
  poner({ enviados, velocidad, restante }, true);
}

function esperarRed(f: NonNullable<typeof ficha>) {
  return new Promise<void>((r) => {
    const mirar = () => {
      if (navigator.onLine || f.cancelada) {
        window.removeEventListener('online', mirar);
        clearInterval(t);
        r();
      }
    };
    const t = setInterval(mirar, 3000);
    window.addEventListener('online', mirar);
  });
}

/** Cuánto tiene ya Google. Si la sesión ya no existe, Fatal. */
async function consultar(f: NonNullable<typeof ficha>, total: number): Promise<number> {
  const r = await enviar(f, null, `bytes */${total}`);
  if (r.status === 200 || r.status === 201) return total;
  if (r.status === 308) return tieneHasta(r.range);
  if (r.status === 404 || r.status === 410) throw new Fatal('caducada');
  throw new Error(`estado ${r.status}`);
}

/** Espera antes de volver a intentarlo, contando hacia atrás en pantalla. */
async function pausa(f: NonNullable<typeof ficha>, intento: number) {
  const s = Math.min(30, 2 ** Math.min(intento, 5));
  for (let i = s; i > 0 && !f.cancelada; i--) {
    poner({ fase: 'reintentando', reintentoEn: i });
    await esperar(1000);
  }
  poner({ reintentoEn: null });
}

async function bucle(f: NonNullable<typeof ficha>, archivo: File, desde: number) {
  const total = archivo.size;
  let hecho = desde;
  let fallos = 0;
  muestras = [];
  poner({ fase: 'subiendo', enviados: hecho, total, velocidad: 0, restante: null, error: null });

  while (hecho < total) {
    if (f.cancelada) return;
    if (!navigator.onLine) {
      poner({ fase: 'sin-red' });
      await esperarRed(f);
      if (f.cancelada) return;
    }
    const hasta = Math.min(hecho + TROZO_VIDEO, total);
    let fue: 'bien' | 'mal' = 'mal';
    try {
      poner({ fase: 'subiendo' });
      const desdeAqui = hecho;
      const r = await enviar(f, archivo.slice(hecho, hasta), `bytes ${hecho}-${hasta - 1}/${total}`, (n) => medir(desdeAqui + n));
      if (r.status === 308) {
        hecho = tieneHasta(r.range);
        fue = 'bien';
      } else if (r.status === 200 || r.status === 201) {
        hecho = total;
        fue = 'bien';
      } else if (r.status === 404 || r.status === 410) {
        throw new Fatal('caducada');
      } else if (r.status !== 408 && r.status !== 429 && r.status < 500) {
        throw new Fatal(`estado ${r.status}`);
      }
    } catch (e) {
      if (e instanceof Fatal) throw e;
      if (f.cancelada) return;
    }

    if (fue === 'bien') {
      fallos = 0;
      medir(hecho);
      continue;
    }

    /* Algo ha fallado. Se espera (cada vez algo más, hasta medio minuto), se
       pregunta a Google cuánto tiene y se sigue desde ahí. Se insiste unos
       diez minutos; si no hay manera, se para y lo dice, con un botón para
       seguir cuando quiera. */
    for (;;) {
      fallos++;
      if (fallos > 24) throw new Fatal('no-avanza');
      if (!navigator.onLine) {
        poner({ fase: 'sin-red' });
        await esperarRed(f);
      } else {
        await pausa(f, fallos);
      }
      if (f.cancelada) return;
      try {
        hecho = await consultar(f, total);
        medir(hecho);
        break;
      } catch (e) {
        if (e instanceof Fatal) throw e;
        if (f.cancelada) return;
      }
    }
  }
}

function aFrase(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m === 'caducada') return 'La subida ha caducado (pasa si se deja a medias más de una semana). Vuelve a elegir el vídeo.';
  if (m === 'no-avanza') return 'La conexión no deja subir el vídeo. Revisa la wifi y pulsa «Seguir subiendo».';
  return 'No se ha podido subir el vídeo. Pulsa «Seguir subiendo» para intentarlo otra vez.';
}

async function arrancar(archivo: File, f: NonNullable<typeof ficha>, desde: number) {
  aguantarPestaña(true);
  try {
    await bucle(f, archivo, desde);
    if (f.cancelada) return;
    poner({ fase: 'subida', enviados: archivo.size, restante: 0, reintentoEn: null }, false);
    if (estado.guardarAlTerminar && envio) await guardarYa(envio);
  } catch (e) {
    if (f.cancelada) return;
    const caducada = e instanceof Error && e.message === 'caducada';
    if (caducada) {
      apuntar(null);
      sesionActual = null;
    }
    poner({ fase: 'error', error: aFrase(e), reintentoEn: null, id: caducada ? null : estado.id });
  } finally {
    if (!enMarcha()) aguantarPestaña(false);
  }
}

/** Abre una sesión nueva y empieza a subir. */
async function empezar(archivo: File) {
  const f = (ficha = { cancelada: false, xhr: null });
  poner({ fase: 'preparando', error: null, enviados: 0, total: archivo.size });
  let r: { ok?: boolean; id?: string; sesion?: string; texto?: string };
  try {
    const res = await fetch('/api/lecciones/subida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: archivo.name, tipo: archivo.type, tamano: archivo.size }),
    });
    r = await res.json().catch(() => ({ ok: false }));
  } catch {
    r = { ok: false, texto: 'No hay conexión con el servidor. Vuelve a probar en un momento.' };
  }
  if (f.cancelada) return;
  if (!r.ok || !r.id || !r.sesion) {
    poner({ fase: 'error', error: r.texto || 'No he podido preparar la subida. Vuelve a probar en un momento.' });
    return;
  }
  sesionActual = r.sesion;
  const pendiente: Pendiente = {
    id: r.id,
    sesion: r.sesion,
    nombre: archivo.name,
    tamano: archivo.size,
    modificado: archivo.lastModified,
    creada: Date.now(),
  };
  apuntar(pendiente);
  poner({ id: r.id, pendiente: null });
  await arrancar(archivo, f, 0);
}

/** Sigue una subida de una visita anterior con el mismo archivo. */
async function seguirPendiente(archivo: File, p: Pendiente) {
  const f = (ficha = { cancelada: false, xhr: null });
  sesionActual = p.sesion;
  poner({ fase: 'preparando', id: p.id, pendiente: null, total: archivo.size, enviados: 0, error: null });
  try {
    const desde = await consultar(f, archivo.size);
    if (f.cancelada) return;
    await arrancar(archivo, f, desde);
  } catch (e) {
    if (f.cancelada) return;
    // La sesión ya no vale: se empieza de cero con una nueva.
    if (e instanceof Fatal) {
      apuntar(null);
      await empezar(archivo);
    } else {
      poner({ fase: 'error', error: aFrase(e) });
    }
  }
}

/* Cerrar la pestaña a medias pierde lo que lleva: el navegador lo pregunta. */
function alCerrar(e: BeforeUnloadEvent) {
  if (!enMarcha()) return;
  e.preventDefault();
  e.returnValue = '';
}
function aguantarPestaña(si: boolean) {
  if (si) window.addEventListener('beforeunload', alCerrar);
  else window.removeEventListener('beforeunload', alCerrar);
}

/* ==========================================================================
   Lo que hace la pantalla
   ========================================================================== */

/** Comprobaciones rápidas antes de leer el vídeo. Devuelve la frase del problema o null. */
export function revisarArchivo(archivo: File): string | null {
  if (!extensionDeVideo(archivo.name, archivo.type)) return 'Eso no es un vídeo que se pueda subir. Vale MP4, MOV o WebM.';
  if (archivo.size > TOPE_VIDEO) return 'El vídeo pesa más de 4 GB. Expórtalo en 1080p y vuelve a probar.';
  if (archivo.size === 0) return 'Ese archivo está vacío.';
  return null;
}

/** Ha elegido (o soltado) un vídeo: se lee y, si se puede ver bien, empieza a subir. */
export async function elegir(archivo: File) {
  const malo = revisarArchivo(archivo);
  if (malo) {
    poner({ error: malo, fase: estado.fase === 'error' ? 'libre' : estado.fase });
    return;
  }
  // Si ya había otra en marcha, se cancela entera antes de empezar esta.
  if (estado.fase !== 'libre' && estado.fase !== 'guardada') await cancelar(true);
  limpiarAnalisis();
  archivoActual = archivo;
  poner({
    fase: 'analizando',
    archivo: { nombre: archivo.name, tamano: archivo.size },
    id: null,
    error: null,
    errores: {},
    guardada: null,
    enviados: 0,
    total: archivo.size,
    velocidad: 0,
    restante: null,
    reintentoEn: null,
  });

  const analisis = await analizar(archivo);
  if (archivoActual !== archivo) return;
  poner({ analisis });
  if (analisis.problema) {
    poner({ fase: 'aviso' });
    return;
  }
  await subir();
}

/** Empieza a subir el vídeo elegido (tras un aviso, si lo hubo). */
export async function subir() {
  const archivo = archivoActual;
  if (!archivo) return;
  const p = estado.pendiente ?? leerPendiente()?.pendiente ?? null;
  const mismo = p && p.nombre === archivo.name && p.tamano === archivo.size && p.modificado === archivo.lastModified;
  if (p && mismo) return seguirPendiente(archivo, p);
  // Una a medias de otro archivo: se descarta (no se van a subir dos a la vez).
  if (p) await descartarPendiente();
  return empezar(archivo);
}

/** Tras un error: sigue desde donde lo dejó Google, con la misma sesión. */
export async function seguir() {
  const archivo = archivoActual;
  if (!archivo) return;
  if (!sesionActual || !estado.id) return empezar(archivo);
  const f = (ficha = { cancelada: false, xhr: null });
  poner({ fase: 'preparando', error: null });
  try {
    const desde = await consultar(f, archivo.size);
    await arrancar(archivo, f, desde);
  } catch (e) {
    if (f.cancelada) return;
    if (e instanceof Fatal) {
      apuntar(null);
      return empezar(archivo);
    }
    poner({ fase: 'error', error: aFrase(e) });
  }
}

/** Para todo y no deja nada: ni la sesión en Google ni restos en el almacén. */
export async function cancelar(enSilencio = false) {
  const id = estado.id;
  const sesion = sesionActual;
  if (ficha) {
    ficha.cancelada = true;
    ficha.xhr?.abort();
  }
  ficha = null;
  sesionActual = null;
  apuntar(null);
  aguantarPestaña(false);
  limpiarAnalisis();
  archivoActual = null;
  envio = null;
  if (!enSilencio) poner({ ...INICIAL, borrador: estado.borrador });
  await tirarSubida(id, sesion);
}

/** Avisa a Google de que la sesión no sigue y pide a la API que borre lo que hubiera llegado. */
async function tirarSubida(id: string | null, sesion: string | null) {
  // Google cierra la sesión con un DELETE a su dirección (contesta 499). Así,
  // si el último trozo iba de camino, ya no se convierte en un archivo.
  if (sesion) await fetch(sesion, { method: 'DELETE' }).catch(() => {});
  if (id) await fetch(`/api/lecciones/subida?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
}

/** Olvida la subida a medias de la otra vez (y lo que dejó). */
export async function descartarPendiente() {
  const p = estado.pendiente ?? leerPendiente()?.pendiente;
  apuntar(null);
  poner({ pendiente: null });
  if (p) await tirarSubida(p.id, p.sesion);
}

function limpiarAnalisis() {
  soltarLector();
  if (estado.analisis?.portadaUrl) URL.revokeObjectURL(estado.analisis.portadaUrl);
  if (estado.analisis) poner({ analisis: null });
}

export function editar(cambios: Partial<Borrador>) {
  poner({ borrador: { ...estado.borrador, ...cambios }, errores: {} });
  // Lo escrito viaja con la subida apuntada, para no perderlo si se cierra.
  if (sesionActual && estado.id && archivoActual) {
    apuntar({
      id: estado.id,
      sesion: sesionActual,
      nombre: archivoActual.name,
      tamano: archivoActual.size,
      modificado: archivoActual.lastModified,
      creada: leerPendiente()?.pendiente.creada ?? Date.now(),
    });
  }
}

/* ==========================================================================
   Guardar la clase
   ========================================================================== */

export type Envio = { titulo: string; descripcion: string; para: Acceso; modulo: string; publicada: boolean };
let envio: Envio | null = null;

/**
 * Guardar. Si el vídeo ya está arriba, ahora; si todavía sube, se apunta y se
 * guarda sola al terminar: así puede rellenar, pulsar y olvidarse.
 */
export async function guardar(datos: Envio) {
  envio = datos;
  if (estado.fase === 'subida') return guardarYa(datos);
  if (enMarcha() || estado.fase === 'analizando' || estado.fase === 'aviso') poner({ guardarAlTerminar: true, errores: {} });
}

/** Se arrepiente de «guardar al terminar» para cambiar algo. */
export function noGuardarAun() {
  envio = null;
  poner({ guardarAlTerminar: false });
}

async function guardarYa(datos: Envio) {
  const id = estado.id;
  if (!id) return;
  poner({ fase: 'guardando', errores: {}, error: null });
  aguantarPestaña(true);
  const form = new FormData();
  form.set('id', id);
  form.set('titulo', datos.titulo);
  form.set('descripcion', datos.descripcion);
  form.set('para', JSON.stringify(datos.para));
  form.set('modulo', datos.modulo);
  form.set('publicada', String(datos.publicada));
  if (estado.analisis?.duracion) form.set('duracion', String(Math.round(estado.analisis.duracion)));
  form.set('tamano', String(estado.total));
  const portada = estado.analisis?.portada;
  if (portada) form.set('portada', portada, portada.type === 'image/webp' ? 'portada.webp' : 'portada.jpg');

  let r: { ok?: boolean; errores?: Record<string, string>; motivo?: string };
  try {
    const res = await fetch('/api/lecciones', { method: 'POST', body: form });
    r = await res.json().catch(() => ({ ok: false }));
  } catch {
    r = { ok: false };
  }
  aguantarPestaña(false);
  if (!r.ok) {
    envio = null;
    const errores = r.errores ?? {};
    poner({
      fase: 'subida',
      guardarAlTerminar: false,
      errores,
      error: Object.keys(errores).length ? null : 'No se ha podido guardar la clase. El vídeo sigue subido: vuelve a pulsar «Guardar la clase».',
    });
    return;
  }

  // Hecho. Se olvida la subida y se deja el formulario listo para la
  // siguiente, con el mismo destino: lo normal es subir varias del mismo curso.
  apuntar(null);
  limpiarAnalisis();
  archivoActual = null;
  sesionActual = null;
  ficha = null;
  envio = null;
  poner({
    ...INICIAL,
    fase: 'guardada',
    guardada: { id, titulo: datos.titulo, publicada: datos.publicada },
    borrador: { ...BORRADOR_VACIO, destino: estado.borrador.destino, cursoNuevo: estado.borrador.cursoNuevo, modulo: estado.borrador.modulo, publicar: estado.borrador.publicar },
  });
}

/** Tras ver el «guardada», vuelve a la zona de soltar. */
export function otra() {
  if (estado.fase === 'guardada') poner({ fase: 'libre', guardada: null });
}
