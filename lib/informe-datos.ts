import 'server-only';
import { FieldPath } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from './firebase-servidor';
import { COLECCION_DIAS, COLECCION_VIDEOS, diaDe } from './metricas';
import { ETIQUETA_TIPO, TIPOS, origenCorto, tipoDeContacto, type Tipo } from './origenes';
import { COLECCION_CORREOS, correosEnviadosTotal } from './correos';
import { listaDeEspera } from './automatizar';
import { APERTURA } from './apertura';
import { cursosDe, revisarAccesos, tieneMembresia } from './accesos';
import { TIPOS_CORREO, type DatosInforme, type DiaWeb, type Par, type Periodo, type Semana, type TotalesWeb } from './informe';

/**
 * Los números de Métricas, leídos de Firestore en un solo sitio.
 *
 * Los usan dos puertas que tienen que decir lo mismo:
 *
 *   · `metricasDelPanel`  → la pantalla de Métricas (app/api/metricas).
 *   · `datosDelInforme`   → el informe en PDF (app/api/metricas/informe), que
 *                           además cuenta contactos, lista de espera, cuentas,
 *                           acuerdos, comunidad y correos del periodo.
 *
 * Antes la lectura vivía dentro de la ruta de la pantalla; al sacarla aquí,
 * la pantalla y el PDF no pueden contar distinto la misma cosa.
 *
 * Las cuentas de prueba (`altaPor: 'prueba'`, las que crean los ensayos
 * automáticos) no cuentan en ningún sitio: no son alumnas de verdad. Sorela
 * tampoco: lo que mira ella no es progreso de nadie.
 *
 * Todo se lee a la vez y una sola vez por petición: el informe tiene que
 * salir en pocos segundos también en Vercel.
 */

type Mapa = Record<string, number>;
type Doc = FirebaseFirestore.QueryDocumentSnapshot;
type Datos = FirebaseFirestore.DocumentData;

const DIA_MS = 86_400_000;
/* Los mismos estados que el tablero de Personas (app/api/contactos). */
const ESTADOS = ['Nuevo', 'Contactado', 'En conversación', 'Cerrado', 'Descartado'] as const;
/* La comunidad vive en su propia colección; sus respuestas, en una subcolección de cada publicación. */
const POSTS = 'comunidad_posts';

/** El periodo pedido por la pantalla: 7, 30, 90 o 'todo'. Lo raro, 30. */
export function leerPeriodo(crudo: string | null): Periodo {
  if (crudo === 'todo') return 'todo';
  const n = Number(crudo);
  return n === 7 || n === 90 ? n : 30;
}

function sumar(destino: Mapa, origen: unknown) {
  if (!origen || typeof origen !== 'object') return;
  for (const [k, v] of Object.entries(origen as Mapa)) destino[k] = (destino[k] ?? 0) + (Number(v) || 0);
}
const ordenar = (m: Mapa, n = 12): Par[] =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
const anotar = (m: Mapa, k: string, n = 1) => (m[k] = (m[k] ?? 0) + n);

/**
 * Resta días de calendario a una fecha «AAAA-MM-DD». Se cuenta desde el
 * mediodía UTC de esa fecha y no restando 24 h al momento actual: con el
 * cambio de hora un día de Madrid dura 23 o 25 h, y entre las 23:00 y las
 * 24:00 un día salía repetido y otro desaparecía (y sus visitas se sumaban
 * dos veces).
 */
function restarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) - n * DIA_MS).toISOString().slice(0, 10);
}

function diasHacia(atras: number, cuantos: number): string[] {
  const hoy = diaDe();
  return Array.from({ length: cuantos }, (_, i) => restarDias(hoy, atras + cuantos - 1 - i));
}

/** El día (en España) de un campo de fecha, venga como Timestamp, Date o texto. */
function diaDeCampo(v: Datos, campo = 'creado'): string | null {
  const x = v[campo];
  const d: Date | null = x?.toDate?.() ?? (x instanceof Date ? x : typeof x === 'string' && x ? new Date(x) : null);
  return d && !Number.isNaN(d.getTime()) ? diaDe(d) : null;
}

const esDePrueba = (v: Datos) => v.altaPor === 'prueba';

/* ------------------------------------------------------------- periodo */

type Rango = {
  periodo: Periodo;
  hoy: string;
  n: number;
  actuales: string[];
  previos: string[];
  desdeMedidor: string | null;
  /** ¿Cae este día dentro del periodo? En «desde el inicio», todo cae. */
  dentro: (dia: string | null) => boolean;
  /** ¿Cae en el periodo anterior, el de comparar? */
  antes: (dia: string | null) => boolean;
};

async function rangoDe(db: FirebaseFirestore.Firestore, periodo: Periodo): Promise<Rango> {
  /* «Desde el inicio»: desde el primer día que el medidor guardó algo. El id
     de cada documento es la fecha, así que el primero en orden es el primero. */
  let desdeMedidor: string | null = null;
  try {
    const primero = await db.collection(COLECCION_DIAS).orderBy(FieldPath.documentId()).limit(1).get();
    desdeMedidor = primero.docs[0]?.id ?? null;
  } catch {
    desdeMedidor = null;
  }
  const hoy = diaDe();
  const todo = periodo === 'todo';
  const n = todo
    ? Math.min(730, Math.max(1, desdeMedidor ? Math.round((Date.parse(hoy) - Date.parse(desdeMedidor)) / DIA_MS) + 1 : 1))
    : periodo;
  const actuales = diasHacia(0, n);
  // Antes del inicio no hay nada con qué comparar.
  const previos = todo ? [] : diasHacia(n, n);
  const [d0, d1] = [actuales[0], actuales[actuales.length - 1]];
  const [p0, p1] = [previos[0], previos[previos.length - 1]];
  return {
    periodo,
    hoy,
    n,
    actuales,
    previos,
    desdeMedidor,
    dentro: (dia) => !!dia && (todo || (dia >= d0 && dia <= d1)),
    antes: (dia) => !!dia && !todo && dia >= p0 && dia <= p1,
  };
}

/* ------------------------------------------------------------- la web */

async function leerWeb(db: FirebaseFirestore.Firestore, r: Rango) {
  const col = db.collection(COLECCION_DIAS);
  const docs = await db.getAll(...[...r.previos, ...r.actuales].map((d) => col.doc(d)));
  const porDia = new Map(docs.filter((d) => d.exists).map((d) => [d.id, d.data() ?? {}]));

  const serie: DiaWeb[] = r.actuales.map((dia) => {
    const v = porDia.get(dia) ?? {};
    return {
      dia,
      vistas: Number(v.vistas) || 0,
      visitas: Number(v.visitas) || 0,
      personas: Number(v.personas) || 0,
      reproducciones: Number(v.reproducciones) || 0,
      segundosVideo: Number(v.segundosVideo) || 0,
    };
  });
  const total = (dias: string[]): TotalesWeb => {
    const t = { vistas: 0, visitas: 0, personas: 0, reproducciones: 0, segundosVideo: 0 };
    for (const d of dias) {
      const v = porDia.get(d) ?? {};
      for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += Number(v[k]) || 0;
    }
    return t;
  };

  const mapas: Record<string, Mapa> = { rutas: {}, entradas: {}, origenes: {}, paises: {}, ciudades: {}, dispositivos: {}, horas: {} };
  for (const d of r.actuales) {
    const v = porDia.get(d);
    if (!v) continue;
    for (const k of Object.keys(mapas)) sumar(mapas[k], v[k]);
  }
  return {
    serie,
    totales: total(r.actuales),
    anteriores: total(r.previos),
    rutas: ordenar(mapas.rutas),
    entradas: ordenar(mapas.entradas),
    origenes: ordenar(mapas.origenes),
    paises: ordenar(mapas.paises, 20),
    ciudades: ordenar(mapas.ciudades, 12),
    dispositivos: ordenar(mapas.dispositivos, 3),
    horas: mapas.horas,
  };
}

/** Vídeos de la web: totales de siempre, los más vistos primero. */
async function leerVideos(db: FirebaseFirestore.Firestore) {
  const vids = await db.collection(COLECCION_VIDEOS).orderBy('reproducciones', 'desc').limit(40).get().catch(() => null);
  return (vids?.docs ?? []).map((d) => {
    const v = d.data();
    const c = (v.cuartiles ?? {}) as Mapa;
    return {
      id: d.id,
      nombre: String(v.nombre ?? d.id),
      ruta: String(v.ruta ?? ''),
      reproducciones: Number(v.reproducciones) || 0,
      c25: Number(c['25']) || 0,
      c50: Number(c['50']) || 0,
      c75: Number(c['75']) || 0,
      c100: Number(c['100']) || 0,
      segundos: Number(v.segundos) || 0,
      duracion: Number(v.duracion) || 0,
    };
  });
}

/* ------------------------------------------------------------- el aula */

/** Las alumnas de verdad con algún acceso: ni Sorela ni las cuentas de prueba. */
const alumnasDe = (usuarios: Doc[]) =>
  usuarios.filter((d) => {
    const v = d.data();
    return v.rol !== 'sorela' && !esDePrueba(v) && Array.isArray(v.accesos) && v.accesos.length > 0;
  });

/** Quién va por dónde en el aula. Sale del progreso de cada alumna. */
async function leerAula(db: FirebaseFirestore.Firestore, usuarios: Doc[], r: Rango) {
  const [lecciones, progreso] = await Promise.all([db.collection(COLECCIONES.lecciones).get(), db.collectionGroup('progreso').get()]);
  const publicadas = lecciones.docs.filter((d) => d.data().publicada !== false);
  const titulos = new Map(publicadas.map((d) => [d.id, String(d.data().titulo ?? d.id)]));
  const duraciones = new Map(publicadas.map((d) => [d.id, Number(d.data().duracion) || 0]));
  const conAcceso = alumnasDe(usuarios);
  const cuentan = new Set(conAcceso.map((d) => d.id));

  const porLeccion = new Map<string, { empezadas: number; completadas: number; segundos: number }>();
  const porAlumna = new Map<string, { completadas: number; segundos: number; ultima: string | null; activa: boolean }>();
  let terminadas = 0;
  for (const p of progreso.docs) {
    const uid = p.ref.parent.parent?.id;
    // Solo las alumnas que cuentan: lo que mira Sorela no es progreso de nadie.
    if (!uid || !titulos.has(p.id) || !cuentan.has(uid)) continue;
    const v = p.data();
    const l = porLeccion.get(p.id) ?? { empezadas: 0, completadas: 0, segundos: 0 };
    l.empezadas++;
    if (v.completada) l.completadas++;
    l.segundos += Math.min(Number(v.visto) || 0, duraciones.get(p.id) || Infinity);
    porLeccion.set(p.id, l);
    const a = porAlumna.get(uid) ?? { completadas: 0, segundos: 0, ultima: null, activa: false };
    if (v.completada) a.completadas++;
    a.segundos += Number(v.visto) || 0;
    const fecha = v.actualizado?.toDate?.().toISOString() ?? null;
    if (fecha && (!a.ultima || fecha > a.ultima)) a.ultima = fecha;
    if (r.dentro(diaDeCampo(v, 'actualizado'))) a.activa = true;
    if (v.completada && r.dentro(diaDeCampo(v, 'terminada'))) terminadas++;
    porAlumna.set(uid, a);
  }

  const total = publicadas.length;
  const tramos = { sinEmpezar: 0, empezando: 0, mitad: 0, terminado: 0 };
  let sumaPct = 0;
  for (const d of conAcceso) {
    const a = porAlumna.get(d.id);
    const pct = total && a ? Math.min(100, Math.round((a.completadas / total) * 100)) : 0;
    sumaPct += pct;
    if (!a) tramos.sinEmpezar++;
    else if (pct >= 100) tramos.terminado++;
    else if (pct >= 50) tramos.mitad++;
    else tramos.empezando++;
  }
  const lecc = publicadas.map((d) => {
    const l = porLeccion.get(d.id) ?? { empezadas: 0, completadas: 0, segundos: 0 };
    return { id: d.id, titulo: titulos.get(d.id) ?? d.id, empezadas: l.empezadas, completadas: l.completadas, minutosMedios: l.empezadas ? Math.round(l.segundos / l.empezadas / 60) : 0 };
  });

  return {
    /* Lo que enseña la pantalla, con el nombre de cada alumna (es la plataforma de Sorela). */
    panel: {
      totalClases: total,
      lecciones: lecc,
      alumnas: conAcceso
        .map((d) => {
          const v = d.data();
          const a = porAlumna.get(d.id) ?? { completadas: 0, segundos: 0, ultima: null };
          return {
            uid: d.id,
            nombre: String(v.nombre || v.correo || 'Sin nombre'),
            correo: String(v.correo || ''),
            completadas: a.completadas,
            minutos: Math.round(a.segundos / 60),
            ultima: a.ultima,
          };
        })
        .sort((x, y) => (y.ultima ?? '').localeCompare(x.ultima ?? '')),
    },
    /* Lo que va al PDF: solo cuentas, ningún nombre. */
    informe: {
      totalClases: total,
      conAcceso: conAcceso.length,
      activas: [...porAlumna.values()].filter((a) => a.activa).length,
      terminadas,
      progresoMedio: conAcceso.length ? Math.round(sumaPct / conAcceso.length) : 0,
      tramos,
      lecciones: lecc.map(({ titulo, empezadas, completadas, minutosMedios }) => ({ titulo, empezadas, completadas, minutosMedios })),
    },
  };
}

/* ------------------------------------------------------------- historia */

/**
 * La historia de la web con lo que SÍ estaba guardado desde el principio:
 * contactos, cuentas, acuerdos y correos. Las visitas no: esas solo existen
 * desde que se instaló el medidor.
 */
function historiaDe(contactos: Doc[], usuarios: Doc[], acuerdos: Doc[], correos: number) {
  /* La semana empieza en lunes: la clave es el lunes de cada semana. */
  const lunes = (dia: string) => {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const semanas = new Map<string, Omit<Semana, 'semana'>>();
  const contar = (dia: string | null, k: keyof Omit<Semana, 'semana'>) => {
    if (!dia) return;
    const s = lunes(dia);
    const v = semanas.get(s) ?? { contactos: 0, cuentas: 0, acuerdos: 0 };
    v[k]++;
    semanas.set(s, v);
  };

  const porOrigen: Mapa = {};
  const porFuente: Mapa = {};
  const porTipo: Mapa = {};
  let primero: string | null = null;
  for (const d of contactos) {
    const v = d.data();
    const f = diaDeCampo(v);
    contar(f, 'contactos');
    if (f && (!primero || f < primero)) primero = f;
    anotar(porOrigen, origenCorto(v.origen));
    anotar(porFuente, typeof v.fuente === 'string' ? v.fuente : 'Sin dato (antes del 12 oct)');
    anotar(porTipo, ETIQUETA_TIPO[tipoDeContacto(v)]);
  }
  const cuentas = usuarios.filter((d) => d.get('rol') !== 'sorela' && !esDePrueba(d.data()));
  for (const d of cuentas) contar(diaDeCampo(d.data()), 'cuentas');
  for (const d of acuerdos) contar(diaDeCampo(d.data(), 'firmadoEl'), 'acuerdos');

  // Todas las semanas desde la primera, también las vacías: un hueco es un dato.
  const claves = [...semanas.keys()].sort();
  const serieSemanas: Semana[] = [];
  if (claves.length) {
    const fin = lunes(diaDe());
    for (let s = claves[0]; s <= fin; ) {
      serieSemanas.push({ semana: s, ...(semanas.get(s) ?? { contactos: 0, cuentas: 0, acuerdos: 0 }) });
      const d = new Date(`${s}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7);
      s = d.toISOString().slice(0, 10);
      if (serieSemanas.length > 120) break;
    }
  }

  return {
    primerContacto: primero,
    contactos: contactos.length,
    cuentas: cuentas.length,
    conAcceso: cuentas.filter((d) => Array.isArray(d.get('accesos')) && d.get('accesos').length > 0).length,
    acuerdos: acuerdos.length,
    correos,
    semanas: serieSemanas,
    porOrigen: ordenar(porOrigen),
    porFuente: ordenar(porFuente),
    porTipo: ordenar(porTipo),
  };
}

/** Los acuerdos que siguen en pie (los borrados no cuentan). */
const acuerdosVivos = (docs: Doc[]) => docs.filter((d) => !d.get('borrado'));

/* ------------------------------------------------------------- la pantalla */

/** Lo que pinta la pantalla de Métricas. */
export async function metricasDelPanel(periodo: Periodo) {
  const db = baseDeDatos();
  const r = await rangoDe(db, periodo);
  const todo = periodo === 'todo';
  const [web, videos, usuarios, historiaLeida] = await Promise.all([
    leerWeb(db, r),
    leerVideos(db),
    db.collection(COLECCIONES.usuarios).get(),
    todo
      ? Promise.all([
          db.collection(COLECCIONES.contactos).get(),
          db.collection('acuerdos').get(),
          // El historial de correos se purga a los 30 días: el total suma también lo ya purgado.
          correosEnviadosTotal().catch(() => 0),
        ])
      : null,
  ]);
  const aula = await leerAula(db, usuarios.docs, r).catch((e) => (console.error('[metricas] aula', e), null));
  let historia: ReturnType<typeof historiaDe> | null = null;
  if (historiaLeida) {
    try {
      const [contactos, acuerdos, correos] = historiaLeida;
      historia = historiaDe(contactos.docs, usuarios.docs, acuerdosVivos(acuerdos.docs), correos);
    } catch (e) {
      console.error('[metricas] historia', e);
    }
  }
  return {
    ok: true as const,
    dias: r.n,
    todo,
    desdeMedidor: r.desdeMedidor,
    historia,
    ...web,
    videos,
    aula: aula?.panel ?? null,
    // Para que el panel avise si está enseñando datos de pruebas.
    prueba: COLECCION_DIAS.endsWith('_prueba'),
  };
}

/* ------------------------------------------------------------- el informe */

/**
 * Todo lo que necesita el informe en PDF, ya sumado. Nada de aquí lleva el
 * nombre, el correo ni el teléfono de nadie: solo cuántos.
 */
export async function datosDelInforme(periodo: Periodo): Promise<DatosInforme> {
  const db = baseDeDatos();
  const r = await rangoDe(db, periodo);
  const todo = periodo === 'todo';
  /* El historial de correos solo guarda 30 días: no hace falta pedir más. */
  const desdeCorreos = new Date(Date.now() - 32 * DIA_MS);

  const [web, videos, usuariosQ, contactosQ, acuerdosQ, postsQ, respuestasQ, correosQ, correosSiempre, espera] = await Promise.all([
    leerWeb(db, r),
    leerVideos(db),
    db.collection(COLECCIONES.usuarios).get(),
    db.collection(COLECCIONES.contactos).get(),
    db.collection('acuerdos').get(),
    db.collection(POSTS).select('autor', 'categoria', 'creado', 'respuestas', 'meGusta', 'resuelta').get().catch(() => null),
    /* Todas las respuestas de golpe y no publicación a publicación: una sola
       lectura. Sin filtro de fecha porque eso pediría un índice de grupo. */
    db.collectionGroup('respuestas').select('autor', 'creado', 'meGusta').get().catch(() => null),
    db.collection(COLECCION_CORREOS).where('cuando', '>=', desdeCorreos).select('tipo', 'estado', 'cuando').get().catch(() => null),
    correosEnviadosTotal().catch(() => null),
    listaDeEspera().catch(() => null),
  ]);
  const usuarios = usuariosQ.docs;
  const aula = await leerAula(db, usuarios, r).catch((e) => (console.error('[informe] aula', e), null));
  const indice = new Map(r.actuales.map((d, i) => [d, i]));

  /* ---------- Contactos ---------- */
  const porTipo: Mapa = {};
  const porOrigen: Mapa = {};
  const porFuente: Mapa = {};
  const porEstado: Mapa = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  const porDia = r.actuales.map(() => 0);
  let nuevos = 0;
  let nuevosAntes = 0;
  let porAtender = 0;
  let porAtenderViejos = 0;
  let primero: string | null = null;
  const hace3 = restarDias(diaDe(), 3);
  /* Desde cuándo espera cada correo la comunidad, para contar las nuevas de la lista. */
  const altaEspera = new Map<string, string>();
  const apuntarEspera = (correo: unknown, dia: string | null) => {
    const c = String(correo || '').toLowerCase();
    if (!c || !dia) return;
    const ya = altaEspera.get(c);
    if (!ya || dia < ya) altaEspera.set(c, dia);
  };
  for (const d of contactosQ.docs) {
    const v = d.data();
    const dia = diaDeCampo(v);
    if (dia && (!primero || dia < primero)) primero = dia;
    const tipo: Tipo = tipoDeContacto(v);
    if (tipo === 'comunidad') apuntarEspera(v.correo, dia);
    const estado = (ESTADOS as readonly string[]).includes(v.estado) ? String(v.estado) : 'Nuevo';
    anotar(porEstado, estado);
    if (estado === 'Nuevo') {
      porAtender++;
      if (dia && dia <= hace3) porAtenderViejos++;
    }
    if (r.antes(dia)) nuevosAntes++;
    if (!r.dentro(dia)) continue;
    nuevos++;
    anotar(porTipo, ETIQUETA_TIPO[tipo]);
    anotar(porOrigen, origenCorto(v.origen));
    anotar(porFuente, typeof v.fuente === 'string' && v.fuente ? v.fuente : 'Sin dato (antes del 12 oct)');
    const i = indice.get(dia ?? '');
    if (i !== undefined) porDia[i]++;
  }

  /* ---------- Cuentas ---------- */
  const reales = usuarios.filter((d) => d.get('rol') !== 'sorela' && !esDePrueba(d.data()));
  const sorela = new Set(usuarios.filter((d) => d.get('rol') === 'sorela').map((d) => d.id));
  /* Lo que escriben las cuentas de prueba en la comunidad tampoco cuenta. */
  const deEnsayo = new Set(usuarios.filter((d) => esDePrueba(d.data())).map((d) => d.id));
  let nuevas = 0;
  let nuevasAntes = 0;
  let conCurso = 0;
  let conComunidad = 0;
  let sinAcceso = 0;
  for (const d of reales) {
    const v = d.data();
    const dia = diaDeCampo(v);
    if (r.dentro(dia)) nuevas++;
    if (r.antes(dia)) nuevasAntes++;
    const accesos = revisarAccesos(v.accesos);
    if (cursosDe(accesos).length) conCurso++;
    if (tieneMembresia(accesos)) conComunidad++;
    if (!accesos.length) sinAcceso++;
    if (v.quiereComunidad || v.pide === 'comunidad') apuntarEspera(v.correo, diaDeCampo(v, v.quiereComunidad ? 'quiereComunidad' : 'creado'));
  }

  /* ---------- Acuerdos ---------- */
  const acuerdos = acuerdosVivos(acuerdosQ.docs);
  let acNuevos = 0;
  let acAntes = 0;
  let porAprobar = 0;
  let sinCorreo = 0;
  let descargas = 0;
  for (const d of acuerdos) {
    const v = d.data();
    const dia = diaDeCampo(v, 'firmadoEl');
    if (r.dentro(dia)) acNuevos++;
    if (r.antes(dia)) acAntes++;
    const estado = String(v.estado ?? 'firmado');
    if (estado !== 'aprobado' && estado !== 'anulado') porAprobar++;
    if (!v.envioCorreo?.enviado) sinCorreo++;
    descargas += Number(v.descargas) || 0;
  }

  /* ---------- Comunidad ---------- */
  let comunidad: DatosInforme['comunidad'] = null;
  if (postsQ && respuestasQ) {
    const cuentaMG = (v: Datos) => (v.meGusta && typeof v.meGusta === 'object' ? Object.keys(v.meGusta).length : 0);
    const porCategoria: Mapa = {};
    const quienes = new Set<string>();
    const quienesAntes = new Set<string>();
    let publicaciones = 0;
    let publicacionesAntes = 0;
    let respuestas = 0;
    let respuestasAntes = 0;
    let meGusta = 0;
    let deSorela = 0;
    let sinRespuesta = 0;
    for (const d of postsQ.docs) {
      const v = d.data();
      const dia = diaDeCampo(v);
      const autor = String(v.autor ?? '');
      if (deEnsayo.has(autor)) continue;
      if (!Number(v.respuestas) && !v.resuelta && v.categoria !== 'Anuncio' && !sorela.has(autor)) sinRespuesta++;
      if (r.antes(dia)) {
        publicacionesAntes++;
        if (!sorela.has(autor)) quienesAntes.add(autor);
      }
      if (!r.dentro(dia)) continue;
      publicaciones++;
      meGusta += cuentaMG(v);
      anotar(porCategoria, String(v.categoria ?? 'Sin categoría'));
      if (!sorela.has(autor)) quienes.add(autor);
    }
    for (const d of respuestasQ.docs) {
      // Solo las de la comunidad: el nombre de la subcolección podría repetirse en otro sitio.
      if (d.ref.parent.parent?.parent.id !== POSTS) continue;
      const v = d.data();
      const dia = diaDeCampo(v);
      const autor = String(v.autor ?? '');
      if (deEnsayo.has(autor)) continue;
      if (r.antes(dia)) {
        respuestasAntes++;
        if (!sorela.has(autor)) quienesAntes.add(autor);
      }
      if (!r.dentro(dia)) continue;
      respuestas++;
      meGusta += cuentaMG(v);
      if (sorela.has(autor)) deSorela++;
      else quienes.add(autor);
    }
    comunidad = {
      miembros: reales.filter((d) => tieneMembresia(revisarAccesos(d.get('accesos')))).length,
      publicaciones,
      publicacionesAntes: todo ? null : publicacionesAntes,
      respuestas,
      respuestasAntes: todo ? null : respuestasAntes,
      meGusta,
      participantes: quienes.size,
      participantesAntes: todo ? null : quienesAntes.size,
      deSorela,
      sinRespuesta,
      porCategoria: ordenar(porCategoria),
      totalPublicaciones: postsQ.docs.filter((d) => !deEnsayo.has(String(d.get('autor') ?? ''))).length,
    };
  }

  /* ---------- Correos ---------- */
  let correos: DatosInforme['correos'] = null;
  if (correosQ) {
    const t = { enviados: 0, fallidos: 0, omitidos: 0, antes: 0 };
    const porTipoCorreo: Mapa = {};
    for (const d of correosQ.docs) {
      const v = d.data();
      const dia = diaDeCampo(v, 'cuando');
      const estado = String(v.estado ?? 'enviado');
      if (r.antes(dia) && estado === 'enviado') t.antes++;
      if (!r.dentro(dia)) continue;
      if (estado === 'fallido') t.fallidos++;
      else if (estado === 'omitido') t.omitidos++;
      else {
        t.enviados++;
        anotar(porTipoCorreo, TIPOS_CORREO[String(v.tipo)] ?? 'Otros');
      }
    }
    /* El periodo anterior solo se puede comparar si cae entero dentro de los 30 días que se guardan. */
    const comparable = !todo && r.n * 2 <= 30;
    correos = {
      enviadosSiempre: correosSiempre ?? t.enviados,
      enviados: t.enviados,
      fallidos: t.fallidos,
      omitidos: t.omitidos,
      enviadosAntes: comparable ? t.antes : null,
      porTipo: ordenar(porTipoCorreo),
      parcial: todo || r.n > 30,
    };
  }

  /* ---------- Lista de espera ---------- */
  const lista = espera ?? [];
  const nuevasEspera = lista.filter((x) => r.dentro(altaEspera.get(x.correo.toLowerCase()) ?? null)).length;

  const historia = todo ? historiaDe(contactosQ.docs, usuarios, acuerdos, correosSiempre ?? 0) : null;

  return {
    periodo,
    generado: new Date().toISOString(),
    hoy: r.hoy,
    rango: { desde: r.actuales[0], hasta: r.actuales[r.actuales.length - 1], dias: r.n },
    anterior: todo ? null : { desde: r.previos[0], hasta: r.previos[r.previos.length - 1] },
    prueba: COLECCION_DIAS.endsWith('_prueba'),
    desdeMedidor: r.desdeMedidor,
    web: { ...web, anteriores: todo ? null : web.anteriores },
    videos: videos.map(({ nombre, ruta, reproducciones, c25, c50, c75, c100, segundos }) => ({ nombre, ruta, reproducciones, c25, c50, c75, c100, segundos })),
    contactos: {
      total: contactosQ.size,
      nuevos,
      nuevosAntes: todo ? null : nuevosAntes,
      porDia,
      porTipo: ordenar(porTipo),
      porOrigen: ordenar(porOrigen, 8),
      porFuente: ordenar(porFuente, 8),
      porEstado: ESTADOS.map((e) => [e, porEstado[e] ?? 0] as Par),
      porAtender,
      porAtenderViejos,
      primero,
    },
    espera: { total: lista.length, nuevas: nuevasEspera, apertura: APERTURA },
    cuentas: { total: reales.length, nuevas, nuevasAntes: todo ? null : nuevasAntes, conCurso, conComunidad, sinAcceso },
    acuerdos: { total: acuerdos.length, nuevos: acNuevos, nuevosAntes: todo ? null : acAntes, porAprobar, sinCorreo, descargas },
    aula: aula?.informe ?? null,
    comunidad,
    correos,
    historia: historia ? { semanas: historia.semanas, porOrigen: historia.porOrigen } : null,
  };
}
