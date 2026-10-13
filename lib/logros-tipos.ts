/**
 * Los trofeos de la plataforma, descritos en un sitio que leen el servidor
 * (para calcularlos) y la pantalla (para pintarlos). Sin nada de servidor dentro.
 *
 * Una VITRINA por cosa que se hace (formarse, compartir casos, ayudar a las
 * compañeras, inspirar, la constancia, el escaparate de su trabajo), y en cada
 * una tres escalones: bronce, plata y oro. Encima de todas, el trofeo Divine,
 * que se gana juntando oros. Lo que motiva no es el trofeo: es ver que el
 * siguiente está cerca («te faltan 3 respuestas para el oro»).
 *
 * Cada escalón es un «logro» (así se llamaban antes y así se guardan:
 * `usuarios/{uid}/logros/{id}` apunta cuándo se ganó y que ya se celebró).
 * Los identificadores de antes se conservan: lo ya ganado y celebrado no se
 * vuelve a celebrar. Todo se DERIVA de contadores que ya existían (clases
 * terminadas, `usuarios.stats`, racha, perfil, fotos): no hay libro aparte.
 */

import type { ResumenPuntos } from './puntos-tipos';

export type Escalon = 'bronce' | 'plata' | 'oro' | 'divine';

export const ESCALONES: Record<Escalon, string> = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', divine: 'Divine' };
/** De menos a más. */
export const ORDEN_ESCALON: Escalon[] = ['bronce', 'plata', 'oro', 'divine'];

export type IdVitrina = 'formacion' | 'casos' | 'companera' | 'inspiras' | 'constancia' | 'escaparate' | 'podio' | 'divine';

/** El dibujo que lleva grabado el trofeo (components/plataforma/IconosDivine.tsx). */
export type GlifoTrofeo = 'clase' | 'publicacion' | 'respuesta' | 'meGusta' | 'racha' | 'foto' | 'podio' | 'divine';

export type DefVitrina = {
  id: IdVitrina;
  nombre: string;
  /** De qué va, en una línea. */
  texto: string;
  glifo: GlifoTrofeo;
};

export const VITRINAS: DefVitrina[] = [
  { id: 'formacion', nombre: 'Tu formación', texto: 'Clases terminadas del curso.', glifo: 'clase' },
  { id: 'casos', nombre: 'Compartes casos', texto: 'Lo que publicas en la comunidad.', glifo: 'publicacion' },
  { id: 'companera', nombre: 'Echas una mano', texto: 'Respuestas a las dudas de otras.', glifo: 'respuesta' },
  { id: 'inspiras', nombre: 'Inspiras', texto: '«Me gusta» que te dan las compañeras.', glifo: 'meGusta' },
  { id: 'constancia', nombre: 'Constancia', texto: 'Días seguidos entrando.', glifo: 'racha' },
  { id: 'escaparate', nombre: 'Tu escaparate', texto: 'Tu perfil y las fotos de tu trabajo.', glifo: 'foto' },
  { id: 'podio', nombre: 'En el podio', texto: 'Entre las 3 más activas de un mes.', glifo: 'podio' },
  { id: 'divine', nombre: 'Trofeo Divine', texto: 'El más especial: se gana juntando oros.', glifo: 'divine' },
];

export type DefLogro = {
  id: string;
  vitrina: IdVitrina;
  escalon: Escalon;
  nombre: string;
  texto: string;
  meta: number;
  /** Cómo se cuenta lo que falta («te faltan 3 respuestas»). null: no se cuenta (sí/no). */
  unidad: readonly [string, string] | null;
};

const CLASES = ['clase', 'clases'] as const;
const PUBLICACIONES = ['publicación', 'publicaciones'] as const;
const RESPUESTAS = ['respuesta', 'respuestas'] as const;
const ME_GUSTA = ['«me gusta»', '«me gusta»'] as const;
const DIAS = ['día seguido', 'días seguidos'] as const;
const FOTOS = ['foto', 'fotos'] as const;

/** Cuántos oros hacen falta para el trofeo Divine. */
export const OROS_PARA_DIVINE = 3;

export const LOGROS: DefLogro[] = [
  // Los del curso cuentan en porcentaje (la meta), pero lo que falta se dice en clases.
  { id: 'primera-clase', vitrina: 'formacion', escalon: 'bronce', nombre: 'Primer paso', texto: 'Terminas tu primera clase.', meta: 1, unidad: CLASES },
  { id: 'mitad-curso', vitrina: 'formacion', escalon: 'plata', nombre: 'A mitad de camino', texto: 'Llevas la mitad de la formación.', meta: 50, unidad: CLASES },
  { id: 'curso-completo', vitrina: 'formacion', escalon: 'oro', nombre: 'Formación completa', texto: 'Terminas todas las clases. Te ganas tu certificado.', meta: 100, unidad: CLASES },

  { id: 'primera-publicacion', vitrina: 'casos', escalon: 'bronce', nombre: 'Me presento', texto: 'Publicas por primera vez en la comunidad.', meta: 1, unidad: PUBLICACIONES },
  { id: 'publicaciones-5', vitrina: 'casos', escalon: 'plata', nombre: 'Voz propia', texto: 'Publicas 5 casos o dudas.', meta: 5, unidad: PUBLICACIONES },
  { id: 'publicaciones-15', vitrina: 'casos', escalon: 'oro', nombre: 'Referente del muro', texto: 'Publicas 15 veces en la comunidad.', meta: 15, unidad: PUBLICACIONES },

  { id: 'primera-respuesta', vitrina: 'companera', escalon: 'bronce', nombre: 'Echo una mano', texto: 'Respondes a una compañera.', meta: 1, unidad: RESPUESTAS },
  { id: 'cinco-respuestas', vitrina: 'companera', escalon: 'plata', nombre: 'Compañera fiel', texto: 'Respondes 5 veces a compañeras.', meta: 5, unidad: RESPUESTAS },
  { id: 'respuestas-20', vitrina: 'companera', escalon: 'oro', nombre: 'Compañera de oro', texto: 'Respondes 20 veces a compañeras.', meta: 20, unidad: RESPUESTAS },

  { id: 'diez-me-gusta', vitrina: 'inspiras', escalon: 'bronce', nombre: 'Inspiras', texto: 'Recibes 10 «me gusta».', meta: 10, unidad: ME_GUSTA },
  { id: 'me-gusta-50', vitrina: 'inspiras', escalon: 'plata', nombre: 'Dejas huella', texto: 'Recibes 50 «me gusta».', meta: 50, unidad: ME_GUSTA },
  { id: 'me-gusta-150', vitrina: 'inspiras', escalon: 'oro', nombre: 'Musa de la comunidad', texto: 'Recibes 150 «me gusta».', meta: 150, unidad: ME_GUSTA },

  { id: 'racha-3', vitrina: 'constancia', escalon: 'bronce', nombre: 'Tres días seguidos', texto: 'Entras 3 días seguidos.', meta: 3, unidad: DIAS },
  { id: 'racha-7', vitrina: 'constancia', escalon: 'plata', nombre: 'Una semana entera', texto: 'Entras 7 días seguidos.', meta: 7, unidad: DIAS },
  { id: 'racha-30', vitrina: 'constancia', escalon: 'oro', nombre: 'Imparable', texto: 'Entras 30 días seguidos.', meta: 30, unidad: DIAS },

  { id: 'perfil-completo', vitrina: 'escaparate', escalon: 'bronce', nombre: 'Perfil listo', texto: 'Completas tu perfil: foto, quién eres y dónde trabajas.', meta: 1, unidad: null },
  { id: 'fotos-5', vitrina: 'escaparate', escalon: 'plata', nombre: 'Tu trabajo, a la vista', texto: 'Subes 5 fotos de tu trabajo al perfil.', meta: 5, unidad: FOTOS },
  { id: 'fotos-10', vitrina: 'escaparate', escalon: 'oro', nombre: 'Portfolio completo', texto: 'Subes 10 fotos de tu trabajo al perfil.', meta: 10, unidad: FOTOS },

  { id: 'podio', vitrina: 'podio', escalon: 'oro', nombre: 'En el podio', texto: 'Quedas entre las 3 más activas del mes.', meta: 1, unidad: null },

  { id: 'divine', vitrina: 'divine', escalon: 'divine', nombre: 'Alma Divine', texto: `Juntas ${OROS_PARA_DIVINE} trofeos de oro. El más especial de todos.`, meta: OROS_PARA_DIVINE, unidad: ['oro', 'oros'] },
];

export type EstadoLogro = DefLogro & {
  progreso: number;
  conseguido: boolean;
  cuando: string | null;
  /** Cuánto le falta, en su unidad. null si no se cuenta o no se sabe (un curso sin clases). */
  falta: number | null;
};

export type Resumen = {
  /** Sorela: no compite. Si es true, lo demás va vacío y la pantalla enseña su distintivo. */
  creadora: boolean;
  logros: EstadoLogro[];
  /** Conseguidos ahora mismo y que todavía no se habían celebrado. */
  nuevos: string[];
  curso: { hechas: number; total: number; porcentaje: number };
  racha: { actual: number; mejor: number };
  certificado: boolean;
  /** Sus puntos y su nivel, sacados de todo lo anterior (ver lib/puntos-tipos.ts). */
  puntos: ResumenPuntos;
};

/* ==========================================================================
   Para la pantalla
   ========================================================================== */

export type EstadoVitrina = DefVitrina & {
  escalones: EstadoLogro[];
  /** El escalón más alto conseguido, o null si aún ninguno. */
  actual: EstadoLogro | null;
  /** El primero que falta, o null si ya los tiene todos. */
  siguiente: EstadoLogro | null;
};

/** Los logros agrupados por vitrina, en el orden de VITRINAS y de menos a más. */
export function vitrinas(logros: EstadoLogro[]): EstadoVitrina[] {
  return VITRINAS.map((v) => {
    const escalones = logros
      .filter((l) => l.vitrina === v.id)
      .sort((a, b) => ORDEN_ESCALON.indexOf(a.escalon) - ORDEN_ESCALON.indexOf(b.escalon));
    const hechos = escalones.filter((l) => l.conseguido);
    return { ...v, escalones, actual: hechos[hechos.length - 1] ?? null, siguiente: escalones.find((l) => !l.conseguido) ?? null };
  }).filter((v) => v.escalones.length > 0);
}

/**
 * «Te faltan 3 respuestas» (o «Le faltan», si es de otra). Sin unidad o sin
 * dato, una frase con lo que hay que hacer.
 */
export function textoFalta(l: EstadoLogro, ajena = false): string {
  if (l.conseguido) return 'Conseguido';
  if (l.falta === null || !l.unidad) {
    if (l.id === 'perfil-completo') return ajena ? 'Le falta completar el perfil' : 'Completa tu perfil';
    if (l.id === 'podio') return ajena ? 'Aún no ha estado en el podio' : 'Entra en el top 3 de un mes';
    return l.texto;
  }
  const n = Math.max(1, Math.ceil(l.falta));
  const quien = ajena ? (n === 1 ? 'Le falta' : 'Le faltan') : n === 1 ? 'Te falta' : 'Te faltan';
  return `${quien} ${n} ${n === 1 ? l.unidad[0] : l.unidad[1]}`;
}
