import 'server-only';
import { APERTURA } from './apertura';
import { CURSO_DIVINE, revisarAccesos, tieneMembresia, type Acceso } from './accesos';
import { correoBienvenidaPorOrigen, correoRecordatorioGrupo } from './plantillas-bienvenida';
import { baseDeDatos, COLECCIONES, hayFirebase } from './firebase-servidor';
import { diaDe } from './metricas';
import { correoDeSorela, enlaceBaja, estaActiva, mandarCorreo, type Resultado } from './correos';
import {
  asuntoLimpio,
  convocatoriaCorta,
  diasEsperando,
  entradaEnLista,
  enListaDeEspera,
  esDeLaSerie,
  resumenSerie,
  situacion,
  textoMotivo,
  usuarioEnLista,
  type CampanaSerie,
  type CorreoLista,
  type DatosAtencion,
  type DatosUsuario,
  type Situacion,
} from './atencion';
import { contextoAtencion, esPrueba, idContacto, marcarCorreoLista } from './atencion-servidor';
import { esSoloSuDia } from './serie-lanzamiento';
import {
  correoAccesoComunidad,
  correoAccesoFormacion,
  correoInvitacion,
  correoResumen,
  type ResumenDatos,
} from './plantillas-automaticas';
import { enlaceGrupo, marcarRecordada, pendientesDeRecordatorio } from './grupo-whatsapp';

/**
 * Lo que dispara cada correo automático. Las rutas llaman a estas funciones
 * cuando pasa algo (se da un acceso, se crea un enlace, alguien se registra) y
 * el cron de cada mañana llama a `tareasDelDia`.
 *
 * Ninguna lanza: un correo que no sale nunca puede deshacer lo que Sorela
 * acaba de hacer. Queda apuntado como fallido y se ve en la pantalla Correos.
 */

const clave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const cursoDivine = (a: Acceso[]) => a.find((x) => x.tipo === 'curso' && clave(x.nombre ?? '') === clave(CURSO_DIVINE));
const tieneComunidad = (a: Acceso[]) => a.some((x) => x.tipo === 'membresia');

/**
 * Se ha cambiado lo que una persona tiene. Solo escribe por lo que GANA: quitar
 * un acceso no manda nada (eso se habla con ella, no se le notifica).
 *
 * La clave lleva el uid: si se le quita y se le vuelve a dar, no recibe el
 * mismo correo de bienvenida otra vez.
 *
 * Lo que sí hace al PERDER la Comunidad: quitar su ficha del mapa. Salir en
 * «Localiza tu terapeuta» va con la membresía, y una ficha que se queda en la
 * web cuando ya no es miembro es una promesa que la web no puede cumplir. Va
 * antes del correo y aparte: aunque no tenga correo, la ficha se quita.
 */
export async function alCambiarAccesos(
  persona: { uid: string; correo: string | null; nombre: string | null; enlaceClave?: string | null },
  antes: unknown,
  despues: unknown
) {
  if (tieneComunidad(revisarAccesos(antes)) && !tieneComunidad(revisarAccesos(despues))) {
    try {
      // Se carga aquí y no arriba: arrastra sharp y Storage, y el cron de cada
      // mañana, que también importa este archivo, no los necesita.
      const { despublicarFicha } = await import('./fichas');
      await despublicarFicha(persona.uid, 'sin-membresia');
    } catch (e) {
      console.error('[automatizar] ficha del mapa:', e);
    }
  }
  try {
    if (!persona.correo) return;
    const a = revisarAccesos(antes);
    const d = revisarAccesos(despues);
    const cursoAntes = cursoDivine(a);
    const cursoDespues = cursoDivine(d);
    if (!cursoAntes && cursoDespues && (await estaActiva('acceso-formacion'))) {
      const modo = cursoDespues.completo === false ? 'precurso' : 'completo';
      await mandarCorreo({ para: persona.correo, ...correoAccesoFormacion(persona.nombre, persona.enlaceClave, modo) }, {
        tipo: 'acceso-formacion',
        clave: `acceso-formacion:${persona.uid}`,
        uid: persona.uid,
      });
    }
    // Tenía solo el precurso y ya ha pagado el resto: se le abre todo.
    if (cursoAntes?.completo === false && cursoDespues && cursoDespues.completo !== false && (await estaActiva('acceso-formacion'))) {
      await mandarCorreo({ para: persona.correo, ...correoAccesoFormacion(persona.nombre, null, 'desbloqueo') }, {
        tipo: 'acceso-formacion',
        clave: `acceso-formacion-completo:${persona.uid}`,
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

/**
 * Alguien se ha registrado sola y no tiene acceso a nada todavía.
 *
 * Recibe el correo de la lista, salvo que ya lo tenga: lo normal es dejar
 * primero los datos en la web y registrarse después, y entonces le llegaba
 * el mismo correo dos veces. Lo dice su ficha (`correoLista`), que
 * /api/registro acaba de guardar antes de llamar aquí.
 */
export async function alRegistrarse(p: { uid: string; correo: string; nombre: string | null; pide: string | null }) {
  try {
    if (!(await estaActiva('registro'))) return;
    const contactoId = idContacto(p.correo);
    const ficha = await baseDeDatos().collection(COLECCIONES.contactos).doc(contactoId).get();
    const previo = ficha.get('correoLista') as Partial<CorreoLista> | undefined;
    if (previo?.plantilla === 'lista-espera' && previo.estado === 'enviado') return;
    // El mismo correo que desde los formularios de la web: lista de espera + grupo de WhatsApp.
    const r = await mandarCorreo({ para: p.correo, ...correoBienvenidaPorOrigen(p.nombre, 'lista-comunidad', enlaceGrupo('correo', p.correo)) }, {
      tipo: 'registro',
      clave: `registro:${p.uid}`,
      uid: p.uid,
      contactoId,
    });
    await marcarCorreoLista(contactoId, { plantilla: 'lista-espera', estado: r.estado, por: 'registro' });
  } catch (e) {
    console.error('[automatizar] registro:', e);
  }
}

/* --------------------------------------------------------- lista espera */

type Persona = { correo: string; nombre: string | null };

/**
 * La lista de espera con lo ya leído de `contactos` y `usuarios`, sin
 * repetir correos. Quién entra lo decide lib/atencion.ts (`enListaDeEspera`
 * y `usuarioEnLista`), la misma regla con la que Clientes dice «en la lista»:
 * si la serie y la pantalla miraran cosas distintas, alguien saldría en la
 * lista sin recibir los correos, o al revés.
 *
 * No quita las bajas (eso lo hace cada envío, que no le escribe) ni mira
 * `comercial`: la casilla de novedades habla de formaciones y la serie no
 * anuncia ninguna, así que también la recibe quien la dejó sin marcar.
 */
export function listaDesde(
  contactos: Iterable<DatosAtencion & { nombre?: unknown }>,
  usuarios: Iterable<DatosUsuario>
): Persona[] {
  const miembros = new Set<string>();
  const salida = new Map<string, Persona>();
  for (const u of usuarios) {
    const correo = String(u.correo || '').trim().toLowerCase();
    if (!correo) continue;
    // Quien ya está dentro no está esperando, aunque también tenga ficha de contacto.
    if (tieneMembresia(revisarAccesos(u.accesos))) {
      miembros.add(correo);
      continue;
    }
    if (usuarioEnLista(u)) salida.set(correo, { correo, nombre: u.nombre ? String(u.nombre) : null });
  }
  for (const v of contactos) {
    const correo = String(v.correo || '').trim().toLowerCase();
    if (!correo || salida.has(correo) || !enListaDeEspera(v)) continue;
    salida.set(correo, { correo, nombre: v.nombre ? String(v.nombre) : null });
  }
  for (const m of miembros) salida.delete(m);
  return [...salida.values()];
}

/** Quién está en la lista de espera de la comunidad, sin repetir correos. */
export async function listaDeEspera(): Promise<Persona[]> {
  if (!hayFirebase()) return [];
  const db = baseDeDatos();
  // Solo los campos que mira la regla: la ficha y la cuenta llevan mucho más.
  const [contactos, usuarios] = await Promise.all([
    db.collection(COLECCIONES.contactos).select('correo', 'nombre', 'estado', 'lista', 'origen', 'aMano', 'pidioInformacion').get(),
    db.collection(COLECCIONES.usuarios).select('correo', 'nombre', 'accesos', 'quiereComunidad', 'pide').get(),
  ]);
  return listaDesde(
    contactos.docs.map((d) => d.data()),
    usuarios.docs.map((d) => d.data() as DatosUsuario)
  );
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

/**
 * El motivo en minúscula, para ir detrás del nombre en el resumen: «Ana Ruiz
 * — te escribió por el formulario de contacto — hace 2 días». La nota no va:
 * el resumen es para saber a quién contestar, y la nota se lee en su ficha.
 */
function motivoDelResumen(s: Pick<Situacion, 'motivo' | 'dato'>): string {
  const t = textoMotivo(s);
  if (!t) return '';
  if (s.motivo === 'mensaje' && s.dato?.desdeContacto) return 'te escribió por el formulario de contacto';
  const corto = `${t.corto.charAt(0).toLowerCase()}${t.corto.slice(1)}`;
  if (s.motivo === 'formacion' && s.dato?.convocatoria) return `${corto} (${convocatoriaCorta(s.dato.convocatoria)})`;
  if (s.motivo === 'correo-no-llego' && t.detalle) return `${corto} (${t.detalle})`;
  return corto;
}

/**
 * Datos del resumen de Sorela: lo que está esperando que haga ELLA algo.
 *
 * Quién la necesita sale de la regla de lib/atencion.ts, la misma que Clientes
 * y el inicio. Antes contaba a todo el que estaba en «Nuevo», y como quien se
 * apunta a la lista de espera se queda en Nuevo (los correos le llegan
 * solos), el resumen del 14 de octubre decía «10 cosas pendientes» cuando no
 * había ninguna. La lista va aparte, como dato, y nunca hace que salga.
 *
 * Las cuentas de prueba del equipo no cuentan en nada (`esPrueba`).
 */
export async function datosResumen(ahora: Date = new Date()): Promise<ResumenDatos> {
  const db = baseDeDatos();
  const [contactos, campanas, ctx] = await Promise.all([
    db.collection(COLECCIONES.contactos).get(),
    db.collection('campanas').get(),
    contextoAtencion(db, ahora),
  ]);
  const hoy = ctx.hoy;
  const prueba = (correo: string) => esPrueba(correo, ctx.usuarios.get(correo));
  // Se carga aquí y no arriba: lib/campanas.ts importa este archivo.
  const { aCampana } = await import('./campanas');
  const todas = campanas.docs.map((d) => aCampana(d.id, d.data()));

  // Los que salen en los próximos 7 días con el botón sin enlace (el de Zoom).
  const tope = diaDe(new Date(ahora.getTime() + 7 * DIA));
  const sinEnlace = todas
    .filter((c) => c.estado === 'programada' && c.boton?.texto && !/^https?:\/\/\S+$/.test(String(c.boton.enlace ?? '')))
    .map((c) => ({ asunto: c.asunto, fecha: c.fecha }))
    .filter((v) => v.fecha >= hoy && v.fecha <= tope)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const fichas = contactos.docs.map((d) => d.data() as DatosAtencion & { nombre?: unknown });
  const teNecesitan: ResumenDatos['teNecesitan'] = [];
  for (const v of fichas) {
    const correo = String(v.correo ?? '').trim().toLowerCase();
    if (prueba(correo)) continue;
    const s = situacion(v, ctx(correo));
    if (s.grupo !== 'te-necesita') continue;
    teNecesitan.push({ nombre: String(v.nombre || v.correo || 'Sin nombre'), dias: diasEsperando(s.desde, ahora), motivo: motivoDelResumen(s) });
  }
  teNecesitan.sort((a, b) => b.dias - a.dias);

  // Cuentas creadas en la web, sin enlace, que esperan a que Sorela les dé algo.
  const esperando = [...ctx.usuarios.values()]
    .filter((u) => u.altaPor === 'registro' && revisarAccesos(u.accesos).length === 0 && !u.bloqueada && !prueba(String(u.correo ?? '').toLowerCase()))
    .map((u) => ({
      nombre: String(u.nombre || 'Sin nombre'),
      correo: String(u.correo || ''),
      pide: u.pide === 'comunidad' ? 'pide la Comunidad Divine' : u.pide === 'curso' ? 'pide la formación' : 'sin especificar',
    }));

  /* La lista de espera, como dato: cuántas reciben la serie (sin bajas ni
     pruebas), cuántas entraron ayer, qué correo ha salido hoy y cuál toca. */
  const personas = listaDesde(fichas, ctx.usuarios.values()).filter((p) => !ctx.bajas.has(p.correo) && !prueba(p.correo));
  const enLaLista = new Set(personas.map((p) => p.correo));
  const ayer = diaDe(new Date(ahora.getTime() - DIA));
  const nuevasAyer = fichas.filter((v) => {
    const entrada = entradaEnLista(v);
    return entrada && enLaLista.has(String(v.correo ?? '').trim().toLowerCase()) && diaDe(entrada) === ayer;
  }).length;
  const serie: CampanaSerie[] = todas
    .filter((c) => esDeLaSerie(c.id))
    .map((c) => ({ ...c, soloSuDia: esSoloSuDia(c.id) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  // El cron manda la campaña antes que el resumen: a esta hora, la de hoy ya ha salido si iba a salir.
  const deHoy = serie.find((c) => c.fecha === hoy && (c.resultado?.enviados ?? 0) > 0);
  // El próximo: el primero programado desde hoy que no sea el que ya ha salido hoy.
  const siguiente = resumenSerie(
    serie.filter((c) => c.fecha >= hoy && c !== deHoy),
    hoy,
    [...enLaLista]
  ).siguiente;
  const lista: ResumenDatos['lista'] = {
    personas: personas.length,
    ayer: nuevasAyer,
    total: serie.length,
    hoySale: deHoy ? { n: serie.indexOf(deHoy) + 1, asunto: asuntoLimpio(deHoy.asunto), personas: deHoy.resultado?.enviados ?? 0 } : null,
    proximo: siguiente ? { n: serie.findIndex((c) => c.id === siguiente.id) + 1, fecha: siguiente.fecha } : null,
  };

  return { teNecesitan, esperando, sinEnlace, lista };
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

  /* Quien se apuntó y no ha pulsado el botón del grupo: un recordatorio, una
     vez (lib/grupo-whatsapp.ts). Antes del resumen, para que salga hoy mismo. */
  if (await estaActiva('recordatorio-grupo')) {
    const r = { id: 'recordatorio-grupo', enviados: 0, fallidos: 0, omitidos: 0 };
    for (const p of await pendientesDeRecordatorio(ahora.getTime()).catch(() => [])) {
      const x = await mandarCorreo(
        { para: p.correo, ...correoRecordatorioGrupo(p.nombre, enlaceGrupo('recordatorio', p.correo), enlaceBaja(p.correo)), baja: enlaceBaja(p.correo) },
        { tipo: 'recordatorio-grupo', clave: `recordatorio-grupo:${p.id}`, contactoId: p.id }
      );
      // Se marca también si se omite (baja, ya enviado): así no se vuelve a intentar.
      if (x.estado !== 'fallido') await marcarRecordada(p.id).catch(() => null);
      if (x.estado === 'enviado') r.enviados++;
      else if (x.estado === 'fallido') r.fallidos++;
      else r.omitidos++;
    }
    hechas.push(r);
  }

  const para = correoDeSorela();
  if (para && (await estaActiva('resumen-sorela'))) {
    const d = await datosResumen(ahora);
    const r = { id: 'resumen-sorela', enviados: 0, fallidos: 0, omitidos: 0 };
    // Solo si algo depende de ella. La lista de espera nunca hace que salga: sigue sola.
    if (d.teNecesitan.length + d.esperando.length + (d.sinEnlace?.length ?? 0) > 0) {
      const x = await mandarCorreo({ para, ...correoResumen(d) }, { tipo: 'resumen-sorela', clave: `resumen-sorela:${c.hoy}` });
      if (x.estado === 'enviado') r.enviados++;
      else if (x.estado === 'fallido') r.fallidos++;
      else r.omitidos++;
    }
    hechas.push(r);
  }
  return { hoy: c.hoy, hechas };
}
