import 'server-only';
import { APERTURA } from './apertura';
import { CURSO_DIVINE, revisarAccesos, type Acceso } from './accesos';
import { baseDeDatos, COLECCIONES, hayFirebase } from './firebase-servidor';
import { diaDe } from './metricas';
import { comoLlego, tipoDeOrigen } from './origenes';
import { correoDeSorela, estaActiva, mandarCorreo, type Resultado } from './correos';
import {
  correoAccesoComunidad,
  correoAccesoFormacion,
  correoInvitacion,
  correoRegistro,
  correoResumen,
  type ResumenDatos,
} from './plantillas-automaticas';

/**
 * Lo que dispara cada correo automático. Las rutas llaman a estas funciones
 * cuando pasa algo (se da un acceso, se crea un enlace, alguien se registra) y
 * el cron de cada mañana llama a `tareasDelDia`.
 *
 * Ninguna lanza: un correo que no sale nunca puede deshacer lo que Sorela
 * acaba de hacer. Queda apuntado como fallido y se ve en la pantalla Correos.
 */

const clave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const tieneCurso = (a: Acceso[]) => a.some((x) => x.tipo === 'curso' && clave(x.nombre ?? '') === clave(CURSO_DIVINE));
const tieneComunidad = (a: Acceso[]) => a.some((x) => x.tipo === 'membresia');

/**
 * Se ha cambiado lo que una persona tiene. Solo escribe por lo que GANA: quitar
 * un acceso no manda nada (eso se habla con ella, no se le notifica).
 *
 * La clave lleva el uid: si se le quita y se le vuelve a dar, no recibe el
 * mismo correo de bienvenida otra vez.
 */
export async function alCambiarAccesos(
  persona: { uid: string; correo: string | null; nombre: string | null; enlaceClave?: string | null },
  antes: unknown,
  despues: unknown
) {
  try {
    if (!persona.correo) return;
    const a = revisarAccesos(antes);
    const d = revisarAccesos(despues);
    if (!tieneCurso(a) && tieneCurso(d) && (await estaActiva('acceso-formacion'))) {
      await mandarCorreo({ para: persona.correo, ...correoAccesoFormacion(persona.nombre, persona.enlaceClave) }, {
        tipo: 'acceso-formacion',
        clave: `acceso-formacion:${persona.uid}`,
        uid: persona.uid,
      });
    }
    if (!tieneComunidad(a) && tieneComunidad(d) && (await estaActiva('acceso-comunidad'))) {
      await mandarCorreo({ para: persona.correo, ...correoAccesoComunidad(persona.nombre, persona.enlaceClave) }, {
        tipo: 'acceso-comunidad',
        clave: `acceso-comunidad:${persona.uid}`,
        uid: persona.uid,
      });
    }
  } catch (e) {
    console.error('[automatizar] accesos:', e);
  }
}

/** Sorela ha creado un enlace con el correo de la persona: se lo mandamos. */
export async function alCrearInvitacion(i: {
  codigo: string;
  correo: string | null;
  nombre: string | null;
  que: string[];
  caduca: string;
  enlace: string;
}): Promise<Resultado | null> {
  try {
    if (!i.correo || !(await estaActiva('invitacion'))) return null;
    return await mandarCorreo(
      { para: i.correo, ...correoInvitacion({ nombre: i.nombre, enlace: i.enlace, que: i.que, caduca: i.caduca }) },
      { tipo: 'invitacion', clave: `invitacion:${i.codigo.slice(0, 16)}` }
    );
  } catch (e) {
    console.error('[automatizar] invitación:', e);
    return null;
  }
}

/** Alguien se ha registrado sola y no tiene acceso a nada todavía. */
export async function alRegistrarse(p: { uid: string; correo: string; nombre: string | null; pide: string | null }) {
  try {
    if (!(await estaActiva('registro'))) return;
    const pide = p.pide === 'comunidad' || p.pide === 'curso' ? p.pide : null;
    await mandarCorreo({ para: p.correo, ...correoRegistro(p.nombre, pide) }, {
      tipo: 'registro',
      clave: `registro:${p.uid}`,
      uid: p.uid,
    });
  } catch (e) {
    console.error('[automatizar] registro:', e);
  }
}

/* --------------------------------------------------------- lista espera */

/** Quién está en la lista de espera de la comunidad, sin repetir correos. */
export async function listaDeEspera(): Promise<{ correo: string; nombre: string | null }[]> {
  if (!hayFirebase()) return [];
  const db = baseDeDatos();
  const [contactos, usuarios] = await Promise.all([
    db.collection(COLECCIONES.contactos).get(),
    db.collection(COLECCIONES.usuarios).get(),
  ]);
  const miembros = new Set<string>();
  const salida = new Map<string, { correo: string; nombre: string | null }>();

  for (const u of usuarios.docs) {
    const v = u.data();
    const correo = String(v.correo || '').toLowerCase();
    if (!correo) continue;
    // Quien ya está dentro no está esperando.
    if (tieneComunidad(revisarAccesos(v.accesos))) {
      miembros.add(correo);
      continue;
    }
    if (v.quiereComunidad || v.pide === 'comunidad') salida.set(correo, { correo, nombre: v.nombre || null });
  }
  for (const c of contactos.docs) {
    const v = c.data();
    const correo = String(v.correo || '').toLowerCase();
    if (!correo || v.estado === 'Descartado') continue;
    const tipo = ['clienta', 'alumna', 'comunidad', 'otro'].includes(v.tipoManual) ? v.tipoManual : tipoDeOrigen(v.origen);
    if (tipo === 'comunidad' && !salida.has(correo)) salida.set(correo, { correo, nombre: v.nombre || null });
  }
  for (const m of miembros) salida.delete(m);
  return [...salida.values()];
}

/* ------------------------------------------------------------- diarias */

const DIA = 86_400_000;

/** Qué toca hoy. Lo usan el cron y la pantalla («Próximos envíos»). */
export function calendario(ahora = new Date()) {
  const apertura = new Date(APERTURA);
  return {
    hoy: diaDe(ahora),
    semana: diaDe(new Date(apertura.getTime() - 7 * DIA)),
    dia: diaDe(apertura),
  };
}

export type InformeDia = {
  hoy: string;
  hechas: { id: string; enviados: number; fallidos: number; omitidos: number }[];
};

/** Datos del resumen de Sorela: lo que está esperando que haga algo. */
export async function datosResumen(): Promise<ResumenDatos> {
  const db = baseDeDatos();
  const [contactos, usuarios, programadas] = await Promise.all([
    db.collection(COLECCIONES.contactos).get(),
    db.collection(COLECCIONES.usuarios).where('altaPor', '==', 'registro').get(),
    db.collection('campanas').where('estado', '==', 'programada').get(),
  ]);
  // Los que salen en los próximos 7 días con el botón sin enlace (el de Zoom).
  const hoy = diaDe(new Date());
  const tope = diaDe(new Date(Date.now() + 7 * DIA));
  const sinEnlace = programadas.docs
    .map((d) => d.data())
    .filter((v) => v.boton?.texto && !/^https?:\/\/\S+$/.test(String(v.boton.enlace ?? '')))
    .map((v) => ({ asunto: String(v.asunto ?? ''), fecha: String(v.fecha ?? '') }))
    .filter((v) => v.fecha >= hoy && v.fecha <= tope)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ahora = Date.now();
  const sinAtender = contactos.docs
    .map((d) => d.data())
    .filter((v) => !v.estado || v.estado === 'Nuevo')
    .map((v) => ({
      nombre: String(v.nombre || v.correo || 'Sin nombre'),
      dias: v.creado?.toDate ? Math.floor((ahora - v.creado.toDate().getTime()) / DIA) : 0,
      como: comoLlego(v.origen) + (v.fuente && v.fuente !== 'Directo' ? ` (desde ${v.fuente})` : ''),
    }))
    .sort((a, b) => b.dias - a.dias);
  const esperando = usuarios.docs
    .map((d) => d.data())
    .filter((v) => revisarAccesos(v.accesos).length === 0 && !v.bloqueada)
    .map((v) => ({
      nombre: String(v.nombre || 'Sin nombre'),
      correo: String(v.correo || ''),
      pide: v.pide === 'comunidad' ? 'pide la Comunidad Divine' : v.pide === 'curso' ? 'pide la formación' : 'sin especificar',
    }));
  return { sinAtender, esperando, sinEnlace };
}

/**
 * Lo de cada mañana. Se puede llamar varias veces el mismo día sin miedo:
 * las claves impiden que nada salga dos veces.
 */
export async function tareasDelDia(ahora = new Date()): Promise<InformeDia> {
  const c = calendario(ahora);
  const hechas: InformeDia['hechas'] = [];
  if (!hayFirebase()) return { hoy: c.hoy, hechas };

  // Los avisos y la serie del lanzamiento que tocan hoy (lib/campanas.ts).
  const { campanasDelDia } = await import('./campanas');
  for (const r of await campanasDelDia(ahora)) hechas.push({ ...r, id: `campana:${r.id}` });

  const para = correoDeSorela();
  if (para && (await estaActiva('resumen-sorela'))) {
    const d = await datosResumen();
    const r = { id: 'resumen-sorela', enviados: 0, fallidos: 0, omitidos: 0 };
    if (d.sinAtender.length + d.esperando.length + (d.sinEnlace?.length ?? 0) > 0) {
      const x = await mandarCorreo({ para, ...correoResumen(d) }, { tipo: 'resumen-sorela', clave: `resumen-sorela:${c.hoy}` });
      if (x.estado === 'enviado') r.enviados++;
      else if (x.estado === 'fallido') r.fallidos++;
      else r.omitidos++;
    }
    hechas.push(r);
  }
  return { hoy: c.hoy, hechas };
}
