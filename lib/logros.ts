import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, COLECCIONES } from './firebase-servidor';
import { revisarAccesos, tieneMembresia, type Acceso } from './accesos';
import { puedeVerla } from './aula';
import { diaDe } from './metricas';
import { COLECCION_ACTIVIDAD, cuentasDeSorela, mesDe } from './actividad';
import { LOGROS, MESES_PODIO, OROS_PARA_DIVINE, PODIO_MINIMO, type EstadoLogro, type Resumen } from './logros-tipos';
import { calcularPuntos, nivelDe, puntosDeLaFicha, type ResumenPuntos } from './puntos-tipos';
import { recorridoHecho } from './recorrido-tipos';

/**
 * Calcula los logros (los escalones de sus trofeos, lib/logros-tipos.ts) de
 * una persona con lo que ya está guardado: su progreso en las clases, sus
 * contadores de la comunidad, su racha de días, su perfil, sus fotos y su
 * recorrido de bienvenida.
 *
 * Los conseguidos se apuntan en `usuarios/{uid}/logros/{id}` la primera vez:
 * así se sabe cuáles son NUEVOS (para celebrarlos una sola vez) y cuándo se
 * ganó cada uno.
 *
 * Y de todo eso salen sus PUNTOS (lib/puntos-tipos.ts). No se guardan uno a
 * uno: se recalculan aquí. Solo se guarda una foto fija del total y el nivel
 * (`usuarios.puntosTotal`, `usuarios.nivel`) para enseñarlos en el ranking y
 * en el perfil sin repetir esta cuenta por cada persona de la lista.
 *
 * Sorela no compite: con ella no se calcula ni se guarda nada (ver `creadora`).
 */

const DIA = 86_400_000;

/**
 * Los últimos meses YA CERRADOS (sin el de ahora), del más reciente al más
 * antiguo: «2026-09», «2026-08»… El podio solo se gana con un mes terminado.
 * Se miran varios por si no entró el mes siguiente a ganarlo.
 */
function mesesCerrados(n: number, ahora: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => mesDe(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1 - i, 1))));
}

export type Actividad = { ultimoDia?: string; racha?: number; mejor?: number; dias?: number };

/** A quién va una clase. La misma regla que el aula (`app/api/lecciones`): si no lo dice, a la comunidad. */
export const paraDe = (crudo: unknown): Acceso => revisarAccesos([crudo])[0] ?? { tipo: 'membresia' };

/** Si una clase guardada le toca a quien tiene `accesos`: publicada y de lo que tiene contratado. */
export const leTocaLaClase = (v: { publicada?: unknown; para?: unknown }, accesos: Acceso[]) =>
  v.publicada !== false && puedeVerla(paraDe(v.para), accesos);

/**
 * Apunta que ha entrado hoy: su racha y los días distintos que lleva. Una
 * escritura al día como mucho.
 *
 * Primero se mira sin transacción, que es lo que pasa en casi todas las
 * cargas (ya entró hoy). Solo si toca apuntar se hace en transacción: dos
 * pestañas abriéndose a la vez no deben contar el mismo día dos veces.
 *
 * `leida`: la actividad si quien llama ya ha leído la ficha (la entrada a la
 * plataforma), para no leerla dos veces.
 */
export async function registrarActividad(uid: string, leida?: Actividad | null): Promise<Actividad | null> {
  try {
    const db = baseDeDatos();
    const ref = db.collection(COLECCIONES.usuarios).doc(uid);
    const hoy = diaDe();
    const vista = (leida ?? (await ref.get()).get('actividad') ?? {}) as Actividad;
    if (vista.ultimoDia === hoy && typeof vista.dias === 'number') return vista;
    return await db.runTransaction(async (t) => {
      const a = ((await t.get(ref)).get('actividad') ?? {}) as Actividad;
      // Quien ya contaba racha antes de existir `dias` arranca con lo que se sabe seguro.
      const base = typeof a.dias === 'number' ? a.dias : Math.max(a.racha ?? 0, a.mejor ?? 0, 0);
      if (a.ultimoDia === hoy) {
        if (typeof a.dias === 'number') return a;
        const nueva = { ...a, dias: Math.max(base, 1) };
        t.set(ref, { actividad: nueva }, { merge: true });
        return nueva;
      }
      const ayer = diaDe(new Date(Date.now() - DIA));
      const racha = a.ultimoDia === ayer ? (a.racha ?? 0) + 1 : 1;
      const nueva = { ultimoDia: hoy, racha, mejor: Math.max(racha, a.mejor ?? 0), dias: base + 1 };
      t.set(ref, { actividad: nueva }, { merge: true });
      return nueva;
    });
  } catch (e) {
    console.error('[logros] actividad', e);
    return null;
  }
}

/** Lo que se devuelve de Sorela: nada que contar, solo que es la creadora. */
const DE_LA_CREADORA: Resumen = {
  creadora: true,
  logros: [],
  nuevos: [],
  miembro: true,
  curso: { hechas: 0, total: 0, porcentaje: 0 },
  racha: { actual: 0, mejor: 0 },
  certificado: false,
  puntos: { total: 0, desglose: calcularPuntos({ clases: 0, cursoCompleto: false, publicaciones: 0, respuestas: 0, meGusta: 0, dias: 0, mejorRacha: 0, logros: 0, perfilCompleto: false, fotos: 0, recorrido: false }).desglose, nivel: nivelDe(0), antes: null, subioNivel: false },
};

/**
 * El resumen de logros y puntos de una persona.
 *
 *   celebrar → los nuevos se apuntan como vistos y se devuelve desde cuántos
 *              puntos contar (`antes`) y si ha subido de nivel. Solo la propia.
 *   propia   → es ella misma quien mira: se apunta el día si no estaba y se
 *              refresca la foto fija de sus puntos. Por defecto, = celebrar.
 */
export async function resumenLogros(uid: string, celebrar: boolean, propia: boolean = celebrar): Promise<Resumen> {
  const db = baseDeDatos();
  const ref = db.collection(COLECCIONES.usuarios).doc(uid);
  /* Todo de una vez. Del progreso solo hacen falta los identificadores de las
     terminadas, y de las clases dos campos: se piden así para no traer de más. */
  const [usuario, terminadas, lecciones, guardados, rankings, fotos, sorela] = await Promise.all([
    ref.get(),
    ref.collection('progreso').where('completada', '==', true).select().get(),
    db.collection(COLECCIONES.lecciones).select('publicada', 'para').get(),
    ref.collection('logros').get(),
    db.getAll(...mesesCerrados(MESES_PODIO).map((m) => db.collection(COLECCION_ACTIVIDAD).doc(m))),
    db
      .collection('perfiles')
      .doc(uid)
      .collection('fotos')
      .count()
      .get()
      .then((r) => r.data().count)
      .catch(() => 0),
    cuentasDeSorela(),
  ]);
  const u = usuario.data() ?? {};
  /* Sorela es la creadora: no tiene puntos, nivel, trofeos ni racha que
     enseñar. Se vuelve antes de apuntar nada (ni el día, ni la foto fija). */
  if (u.rol === 'sorela' || sorela.has(uid)) return DE_LA_CREADORA;
  const accesos = revisarAccesos(u.accesos);

  // Las clases que le tocan por lo que tiene contratado (como las ve en el aula).
  const suyas = lecciones.docs.filter((d) => leTocaLaClase(d.data(), accesos));
  const hechasSet = new Set(terminadas.docs.map((d) => d.id));
  // Cada clase terminada suma sus puntos, sea del curso o de la Comunidad.
  const clasesHechas = suyas.filter((d) => hechasSet.has(d.id)).length;
  /* Pero la FORMACIÓN (sus trofeos, el certificado y el «x de y» del curso)
     es solo la del curso: curso ≠ membresía. Terminar las clases de la
     Comunidad no da el certificado de la Formación Técnica Divine, y con el
     abono sus clases del curso están bloqueadas y no cuentan (aún). */
  const delCurso = suyas.filter((d) => paraDe(d.get('para')).tipo === 'curso').map((d) => d.id);
  const hechas = delCurso.filter((id) => hechasSet.has(id)).length;
  const total = delCurso.length;
  const porcentaje = total ? Math.round((hechas / total) * 100) : 0;

  const stats = (u.stats ?? {}) as { publicaciones?: number; respuestas?: number; meGustaRecibidos?: number };
  let act = (u.actividad ?? {}) as Actividad;
  // Si es ella y hoy aún no constaba (una pestaña abierta desde ayer), se apunta ahora.
  if (propia && (act.ultimoDia !== diaDe() || typeof act.dias !== 'number')) act = (await registrarActividad(uid)) ?? act;
  const rachaViva = act.ultimoDia === diaDe() || act.ultimoDia === diaDe(new Date(Date.now() - DIA)) ? act.racha ?? 0 : 0;
  const mejor = Math.max(act.mejor ?? 0, rachaViva);
  const dias = typeof act.dias === 'number' ? act.dias : Math.max(act.racha ?? 0, act.mejor ?? 0);
  const perfilCompleto = Boolean((u.onboarding as { completado?: unknown } | undefined)?.completado);
  // Terminado alguna vez (saltarlo no cuenta; repetirlo no lo quita): ver lib/recorrido-tipos.ts.
  const recorrido = recorridoHecho(u);

  /* El podio: entre las 3 primeras de un mes YA CERRADO y con al menos
     PODIO_MINIMO compañeras puntuando ese mes. Con el mes en curso bastaba
     publicar una vez el día 1 (o ser de las pocas activas) para llevarse un
     oro para siempre; así cuesta lo que dice. */
  const puesto = rankings.some((ranking) => {
    const mapa = (ranking.data() ?? {}) as Record<string, { puntos?: number }>;
    const orden = Object.entries(mapa)
      .filter(([k, v]) => (Number(v?.puntos) || 0) > 0 && !sorela.has(k))
      .sort((a, b) => (Number(b[1].puntos) || 0) - (Number(a[1].puntos) || 0))
      .map(([k]) => k);
    if (orden.length < PODIO_MINIMO) return false;
    const i = orden.indexOf(uid);
    return i >= 0 && i < 3;
  })
    ? 1
    : 0;

  const publicaciones = Math.max(0, stats.publicaciones ?? 0);
  const respuestas = Math.max(0, stats.respuestas ?? 0);
  const meGusta = Math.max(0, stats.meGustaRecibidos ?? 0);
  const valor: Record<string, number> = {
    recorrido: recorrido ? 1 : 0,
    'primera-clase': hechas,
    'mitad-curso': total ? porcentaje : 0,
    'curso-completo': total ? porcentaje : 0,
    'primera-publicacion': publicaciones,
    'publicaciones-5': publicaciones,
    'publicaciones-15': publicaciones,
    'primera-respuesta': respuestas,
    'cinco-respuestas': respuestas,
    'respuestas-20': respuestas,
    'diez-me-gusta': meGusta,
    'me-gusta-50': meGusta,
    'me-gusta-150': meGusta,
    'racha-3': mejor,
    'racha-7': mejor,
    'racha-30': mejor,
    'perfil-completo': perfilCompleto ? 1 : 0,
    'fotos-5': fotos,
    'fotos-10': fotos,
    podio: puesto,
  };
  /* Lo que falta del curso se dice en clases, no en porcentaje: «te faltan 3
     clases» se entiende; «te falta un 37 %», no tanto. */
  const faltaCurso = (pct: number) => (total ? Math.max(0, Math.ceil((total * pct) / 100) - hechas) : null);

  const ya = new Map(guardados.docs.map((d) => [d.id, d.get('cuando')?.toDate?.().toISOString() ?? null]));
  let nuevos: string[] = [];
  const estado = (l: (typeof LOGROS)[number], v: number): EstadoLogro => {
    const progreso = Math.min(l.meta, Math.max(0, v));
    const conseguido = ya.has(l.id) || progreso >= l.meta;
    if (conseguido && !ya.has(l.id)) nuevos.push(l.id);
    const falta = conseguido
      ? 0
      : l.id === 'mitad-curso'
        ? faltaCurso(50)
        : l.id === 'curso-completo'
          ? faltaCurso(100)
          : l.unidad
            ? l.meta - progreso
            : null;
    return { ...l, progreso: conseguido ? l.meta : progreso, conseguido, cuando: ya.get(l.id) ?? (conseguido ? new Date().toISOString() : null), falta };
  };
  // Primero todos menos el Divine, que se gana juntando los oros de los demás.
  const logros = LOGROS.filter((l) => l.vitrina !== 'divine').map((l) => estado(l, valor[l.id] ?? 0));
  const oros = logros.filter((l) => l.escalon === 'oro' && l.conseguido).length;
  for (const l of LOGROS.filter((x) => x.vitrina === 'divine')) logros.push(estado(l, Math.min(oros, OROS_PARA_DIVINE)));

  const { total: puntosTotal, desglose } = calcularPuntos({
    clases: clasesHechas,
    cursoCompleto: logros.some((l) => l.id === 'curso-completo' && l.conseguido),
    publicaciones: stats.publicaciones ?? 0,
    respuestas: stats.respuestas ?? 0,
    meGusta: stats.meGustaRecibidos ?? 0,
    dias,
    mejorRacha: mejor,
    logros: logros.filter((l) => l.conseguido).length,
    perfilCompleto,
    fotos,
    recorrido,
  });
  const nivel = nivelDe(puntosTotal);
  let antes: number | null = null;
  let subioNivel = false;
  /* Lo que su ficha valía al hacer la foto fija: con eso las listas suman lo
     que gane después sin que ella abra la plataforma (lib/puntos-tipos.ts, puntosAlDia). */
  const puntosBase = puntosDeLaFicha({ ...u, actividad: act });
  const fotoFijaCambia = u.puntosTotal !== puntosTotal || u.nivel !== nivel.n || u.puntosBase !== puntosBase;

  if (celebrar) {
    const vistos = typeof u.puntosVistos === 'number' ? u.puntosVistos : 0;
    const nivelVisto = typeof u.nivelVisto === 'number' ? u.nivelVisto : 1;
    antes = vistos;
    subioNivel = nivel.n > nivelVisto;
    /* Se apuntan solo al mirarlos la propia persona: así la celebración la ve
       ella. En transacción, y leyendo otra vez lo apuntado: con dos pestañas
       (o el móvil y el ordenador) a la vez, solo una celebra cada cosa. */
    if (nuevos.length || vistos !== puntosTotal || nivelVisto < nivel.n || fotoFijaCambia) {
      try {
        const r = await db.runTransaction(async (t) => {
          const refs = nuevos.map((id) => ref.collection('logros').doc(id));
          const [fresco, ...apuntados] = await t.getAll(ref, ...refs);
          const deVerdad = nuevos.filter((_, i) => !apuntados[i]?.exists);
          for (const id of deVerdad) t.set(ref.collection('logros').doc(id), { cuando: FieldValue.serverTimestamp() });
          const pv = fresco.get('puntosVistos');
          const nv = fresco.get('nivelVisto');
          const nvAntes = typeof nv === 'number' ? nv : 1;
          t.set(
            ref,
            {
              puntosVistos: puntosTotal,
              /* El nivel más alto que ya celebró: si baja (ha borrado algo) y
                 vuelve a subir, ese mismo nivel no se celebra dos veces. */
              nivelVisto: Math.max(nvAntes, nivel.n),
              puntosTotal,
              puntosBase,
              nivel: nivel.n,
            },
            { merge: true }
          );
          return { nuevos: deVerdad, antes: typeof pv === 'number' ? pv : 0, subio: nivel.n > nvAntes };
        });
        nuevos = r.nuevos;
        antes = r.antes;
        subioNivel = r.subio;
      } catch (e) {
        console.error('[logros] apuntar lo celebrado', e);
      }
    }
  } else if (propia && fotoFijaCambia) {
    await ref.set({ puntosTotal, puntosBase, nivel: nivel.n }, { merge: true }).catch((e) => console.error('[logros] foto de puntos', e));
  }

  const puntos: ResumenPuntos = { total: puntosTotal, desglose, nivel, antes, subioNivel };

  return {
    creadora: false,
    logros,
    nuevos: celebrar ? nuevos : [],
    miembro: tieneMembresia(accesos),
    curso: { hechas, total, porcentaje },
    racha: { actual: rachaViva, mejor },
    certificado: logros.some((l) => l.id === 'curso-completo' && l.conseguido),
    puntos,
  };
}
