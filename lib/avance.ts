import { CURSO_DIVINE, type Acceso } from './accesos';
import { clave } from './aula';
import { DOCUMENTOS, moduloOficial, type Lectura } from './material';

/**
 * El recorrido de la academia online: los módulos se abren en orden.
 *
 * Acordado en la reunión del 11 nov 2026:
 *
 *   1. Módulo 01 (Precurso), abierto desde el principio. No tiene vídeo.
 *   2. Al terminarlo, la alumna PIDE UNA REUNIÓN con Sorela en su agenda.
 *      Con la reunión pedida se abre el Módulo 02.
 *   3. Al leer el dosier de un módulo se abren sus vídeos (02 abdomen,
 *      03 piernas y glúteos, 04 facial).
 *   4. Un módulo está terminado cuando se ha leído su dosier y visto sus
 *      vídeos. Entonces se abre el siguiente.
 *
 * Esto es solo la cuenta, sin tocar Firestore: la usan igual el servidor
 * (que es quien cierra de verdad, en /api/material y /api/lecciones) y el
 * aula, que la pinta.
 */

/** El apartado de los vídeos largos, para estudiar sola. No entra en el recorrido. */
export const MODULO_COMPLETA = 'Técnica completa';
const ALIAS_COMPLETA = ['tecnica completa', 'clase completa', 'clases completas', 'curso completo', 'tratamiento completo'];
export const esTecnicaCompleta = (modulo: string | undefined) => ALIAS_COMPLETA.includes(clave(modulo));

export type PasoModulo = {
  /** El id de su dosier (lib/material.ts). */
  id: string;
  nombre: string;
  subtitulo: string;
  /** Si puede entrar (leer el dosier). */
  abierto: boolean;
  leido: boolean;
  /** Página por la que va y cuántas tiene el dosier. */
  pagina: number;
  paginas: number;
  /** Vídeos publicados del módulo y cuántos ha terminado. */
  videos: number;
  videosHechos: number;
  /** Si sus vídeos ya se pueden ver (módulo abierto y dosier leído). */
  videosAbiertos: boolean;
  completo: boolean;
};

export type SiguientePaso =
  | { tipo: 'leer'; modulo: number }
  | { tipo: 'cita'; modulo: number }
  | { tipo: 'video'; modulo: number; leccion: string }
  | { tipo: 'fin' };

export type Recorrido = {
  modulos: PasoModulo[];
  /** La reunión pedida con Sorela, si la hay. */
  cita: { cuando: string } | null;
  siguiente: SiguientePaso;
};

/** Si a esta persona le toca el recorrido por módulos. */
export function llevaRecorrido(accesos: Acceso[]): boolean {
  // Las homologadas (membresía) lo tienen todo abierto: ya pasaron por aquí.
  if (accesos.some((a) => a.tipo === 'membresia')) return false;
  /* Solo la academia ONLINE, marcada a propósito al dar el acceso («Academia
     online» en Dar acceso, o «Pasar a academia online» en Gestionar). Las de
     la presencial y las de antes siguen como estaban. */
  return accesos.some((a) => a.tipo === 'curso' && clave(a.nombre) === clave(CURSO_DIVINE) && a.online === true);
}

export type ClaseDelRecorrido = { id: string; modulo?: string; completada: boolean };

/**
 * @param conVideos `false` si solo ha dejado el abono: sus vídeos esperan a
 *   que pague el resto, así que no se le pueden pedir para avanzar.
 */
export function calcularRecorrido(x: {
  lectura: Record<string, Lectura>;
  clases: ClaseDelRecorrido[];
  cita: { cuando: string } | null;
  conVideos: boolean;
}): Recorrido {
  const modulos: PasoModulo[] = [];
  let siguiente: SiguientePaso | null = null;

  DOCUMENTOS.forEach((d, i) => {
    const suyas = x.conVideos ? x.clases.filter((c) => moduloOficial(c.modulo).puesto === i) : [];
    const l = x.lectura[d.id] ?? { pagina: 0, leido: false };
    const anterior = modulos[i - 1];
    // El 01 siempre; el 02 pide además la reunión con Sorela; el resto, el anterior terminado.
    const abierto = i === 0 || (anterior.completo && (i !== 1 || Boolean(x.cita)));
    const leido = abierto && l.leido;
    const pendiente = suyas.find((c) => !c.completada);
    const completo = leido && !pendiente;
    modulos.push({
      id: d.id,
      nombre: d.modulo,
      subtitulo: d.subtitulo,
      abierto,
      leido,
      pagina: l.pagina,
      paginas: d.paginas,
      videos: suyas.length,
      videosHechos: suyas.filter((c) => c.completada).length,
      videosAbiertos: leido,
      completo,
    });

    if (siguiente) return;
    if (!abierto) siguiente = { tipo: 'cita', modulo: i };
    else if (!leido) siguiente = { tipo: 'leer', modulo: i };
    else if (pendiente) siguiente = { tipo: 'video', modulo: i, leccion: pendiente.id };
  });

  return { modulos, cita: x.cita, siguiente: siguiente ?? { tipo: 'fin' } };
}

/** Si el vídeo de una clase sigue cerrado por el recorrido (su módulo no está abierto o su dosier sin leer). */
export function videoCerradoPorModulo(r: Recorrido, para: Acceso, modulo: string | undefined): boolean {
  if (para?.tipo !== 'curso' || clave(para.nombre) !== clave(CURSO_DIVINE)) return false;
  if (esTecnicaCompleta(modulo)) return false;
  const m = r.modulos[moduloOficial(modulo).puesto];
  return m ? !m.videosAbiertos : false;
}
