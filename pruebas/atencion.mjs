/**
 * La regla de «qué toca ahora con cada persona» (lib/atencion.ts), probada
 * sola y contra los datos de verdad.
 *
 *   node pruebas/atencion.mjs                         → solo la regla, sin red
 *   node --env-file=.env.local pruebas/atencion.mjs   → la regla y una pasada
 *                                                       de SOLO LECTURA por Firestore
 *   … --sin-reales                                    → salta la pasada aunque haya llave
 *
 * La pasada real no escribe nada: lee contactos, cuentas, bajas,
 * convocatorias, campañas y el historial de correos, calcula dónde sale cada
 * persona y lo enseña con su nombre de pila (nunca correos ni teléfonos).
 * También simula EN MEMORIA el relleno de `correoLista`
 * (scripts/rellenar-correo-lista.mjs) para ver qué cambiaría con él.
 *
 * lib/atencion.ts se convierte a JavaScript con el propio TypeScript
 * (`transpileModule`, sin comprobar tipos: eso lo hace `npm run typecheck`)
 * en una carpeta temporal, junto con lo que importa, y se borra al acabar.
 *
 * Se puede importar: `probarRegla()` y `pasadaReal(db)` no hacen nada hasta
 * que se las llama.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/* ---------------------------------------------------- compilar la regla */

let modulo = null;
let carpeta = null;

/** lib/atencion.ts y lo que importa en tiempo de ejecución (origenes, accesos, metricas), en CommonJS. */
export function cargar() {
  if (modulo) return modulo;
  carpeta = mkdtempSync(join(tmpdir(), 'atencion-'));
  const hechos = new Set();
  const compilar = (rel) => {
    if (hechos.has(rel)) return;
    hechos.add(rel);
    const fuente = readFileSync(join(RAIZ, `${rel}.ts`), 'utf8');
    const { outputText } = ts.transpileModule(fuente, {
      fileName: `${rel}.ts`,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const destino = join(carpeta, `${rel}.js`);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, outputText);
    // Los `import type` desaparecen al convertir: solo quedan los require de verdad.
    for (const [, dep] of outputText.matchAll(/require\("(\.{1,2}\/[^"]+)"\)/g)) {
      const siguiente = posix.join(posix.dirname(rel), dep);
      if (!existsSync(join(RAIZ, `${siguiente}.ts`))) throw new Error(`lib/atencion.ts importa ${dep}, que no es un .ts del proyecto`);
      compilar(siguiente);
    }
  };
  compilar('lib/atencion');
  modulo = createRequire(import.meta.url)(join(carpeta, 'lib/atencion.js'));
  return modulo;
}

export function limpiar() {
  if (carpeta) rmSync(carpeta, { recursive: true, force: true });
  carpeta = null;
  modulo = null;
}

/* ------------------------------------------------------- la regla sola */

/** Prueba la función pura con un caso de cada grupo y de cada motivo. Devuelve los fallos. */
export function probarRegla() {
  const A = cargar();
  const fallos = [];
  let bien = 0;
  const caso = (nombre, fn) => {
    try {
      fn();
      bien++;
    } catch (e) {
      fallos.push(`${nombre}: ${e.message}`);
    }
  };
  const igual = (a, b, que = '') => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${que} esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)}`);
  };
  const donde = (s) => `${s.grupo}${s.motivo ? `/${s.motivo}` : ''}`;

  const VACIO = { deBaja: false, miembro: false, convocatorias: [], ciudades: {} };
  const VIGO = { id: 'vigo1', ciudad: 'Vigo', inicio: '2026-10-24', fin: '2026-10-25' };
  const CON_VIGO = { ...VACIO, convocatorias: [VIGO], ciudades: { vigo1: 'Vigo', AbC9: 'Bogotá' } };
  const DE_BAJA = { ...VACIO, deBaja: true };
  const yo = (extra) => ({ correo: 'ana@ejemplo.com', creado: '2026-10-01T10:00:00Z', ...extra });

  // 0 · marcada
  caso('pendiente sobre Contactado → te necesita (marcada)', () => {
    const s = A.situacion(yo({ origen: 'lista-comunidad', estado: 'Contactado', estadoCambiado: '2026-10-10T10:00:00Z', pendiente: true, pendienteDesde: '2026-10-12T10:00:00Z' }), VACIO);
    igual(donde(s), 'te-necesita/marcada');
    igual(s.desde, '2026-10-12T10:00:00.000Z', 'desde');
    igual(A.fraseConNombre('Ana', s), 'Marcaste a Ana para escribirle');
  });
  caso('pendiente sobre Descartado → descartado', () => {
    igual(donde(A.situacion(yo({ origen: 'lista-comunidad', estado: 'Descartado', estadoCambiado: '2026-10-10', pendiente: true }), VACIO)), 'descartado');
  });

  // 1 · reserva
  caso('reserva de plaza → te necesita (reserva) con su ciudad', () => {
    const s = A.situacion(yo({ origen: 'formacion-conv-vigo1' }), CON_VIGO);
    igual(donde(s), 'te-necesita/reserva');
    igual(A.textoMotivo(s).corto, 'Pidió plaza en Vigo');
    igual(A.fraseConNombre('Lucía', s), 'Lucía pidió plaza en Vigo');
    igual(A.botonDe(s), 'Ya le escribí');
    igual(s.enLista, false, 'una reserva no entra en la lista');
  });
  caso('reserva con un id con mayúsculas (el origen llega en minúsculas)', () => {
    igual(A.situacion(yo({ origen: 'formacion-conv-abc9' }), CON_VIGO).dato.ciudad, 'Bogotá');
  });
  caso('Cerrada que pide plaza DESPUÉS de cerrarla → te necesita; antes → cerrado', () => {
    const v = (cuando) => yo({ origen: 'lista-comunidad', estado: 'Cerrado', estadoCambiado: '2026-10-05T10:00:00Z', pidio: { 'formacion-conv-vigo1': cuando } });
    igual(donde(A.situacion(v('2026-10-12T10:00:00Z'), CON_VIGO)), 'te-necesita/reserva');
    igual(donde(A.situacion(v('2026-10-02T10:00:00Z'), CON_VIGO)), 'cerrado');
  });

  // 2 · mensaje
  caso('formulario de contacto → te necesita (mensaje), «Te escribió»', () => {
    const s = A.situacion(yo({ origen: 'contacto', lista: true, nota: 'Hola, me encantaría saber más de la técnica' }), VACIO);
    igual(donde(s), 'te-necesita/mensaje');
    igual(A.textoMotivo(s).corto, 'Te escribió');
    igual(A.botonDe(s), 'Ya le contesté');
    igual(s.enLista, true, 'quien escribe por contacto sigue en la lista');
  });
  caso('nota de la lista sin pregunta → lista, con notaLista', () => {
    const s = A.situacion(yo({ origen: 'lista-comunidad', nota: 'Casos reales y comunidad' }), VACIO);
    igual(donde(s), 'lista');
    igual(s.notaLista, 'Casos reales y comunidad');
  });
  caso('nota de la lista con «¿cuánto cuesta?» → te necesita (mensaje), «Te preguntó»', () => {
    const s = A.situacion(yo({ origen: 'lista-comunidad', nota: '¿cuánto cuesta?' }), VACIO);
    igual(donde(s), 'te-necesita/mensaje');
    igual(A.textoMotivo(s).corto, 'Te preguntó');
    igual(A.textoMotivo(s).detalle, '«¿cuánto cuesta?»');
    igual(s.notaLista, null);
  });
  caso('la nota de un alta a mano la escribió Sorela → nunca mensaje', () => {
    const s = A.situacion(yo({ origen: 'a-mano', aMano: true, pidioInformacion: true, lista: true, nota: '¿La llamo el lunes?' }), VACIO);
    igual(donde(s), 'lista');
    igual(s.notaLista, null);
  });
  caso('alguien de la lista que luego escribe por contacto → te necesita (mensaje) desde ese envío', () => {
    const s = A.situacion(
      yo({ origen: 'lista-comunidad', pidio: { 'lista-comunidad': '2026-10-01T10:00:00Z', contacto: '2026-10-10T10:00:00Z' }, ultimaNota: 'Quería preguntarte una cosa', ultimaNotaOrigen: 'contacto' }),
      VACIO
    );
    igual(donde(s), 'te-necesita/mensaje');
    igual(s.desde, '2026-10-10T10:00:00.000Z', 'desde');
    igual(s.enLista, true);
  });

  // 3 · pregunta
  caso('asistente a secas (fichas antiguas) → te necesita (pregunta)', () => {
    const s = A.situacion(yo({ origen: 'asistente', lista: true }), VACIO);
    igual(donde(s), 'te-necesita/pregunta');
    igual(A.botonDe(s), 'Ya le contesté');
  });
  caso('comunidad-asistente → lista', () => igual(donde(A.situacion(yo({ origen: 'comunidad-asistente' }), VACIO)), 'lista'));

  // 4 · formación
  caso('formación sin convocatoria → espera un aviso; con ella → te necesita (formacion)', () => {
    igual(donde(A.situacion(yo({ origen: 'formacion', lista: true }), VACIO)), 'avisar');
    const s = A.situacion(yo({ origen: 'formacion', lista: true }), CON_VIGO);
    igual(donde(s), 'te-necesita/formacion');
    igual(A.textoMotivo(s).queHacer, 'Cuéntale la próxima: Vigo, 24–25 oct.');
  });
  caso('aviso de formación en otra ciudad → avisar; en la suya («Vigo» frente a «vigo») → formacion', () => {
    igual(donde(A.situacion(yo({ origen: 'avisar-ciudad-formacion', ciudad: 'Madrid' }), CON_VIGO)), 'avisar');
    igual(donde(A.situacion(yo({ origen: 'avisar-ciudad-formacion', ciudad: 'vigo' }), CON_VIGO)), 'te-necesita/formacion');
  });
  caso('formacion-precio y formacion-asistente siguen la regla de formación', () => {
    igual(donde(A.situacion(yo({ origen: 'formacion-precio', lista: true }), VACIO)), 'avisar');
    igual(donde(A.situacion(yo({ origen: 'formacion-asistente', lista: true }), CON_VIGO)), 'te-necesita/formacion');
  });

  // 5 · cita
  caso('cita → te necesita (cita)', () => {
    const s = A.situacion(yo({ origen: 'cita-madrid' }), VACIO);
    igual(donde(s), 'te-necesita/cita');
    igual(A.fraseConNombre('Ana', s), 'Ana quiere que la trates');
  });

  // 6 · a mano
  caso('apuntada a mano sin «pidió información» → te necesita (a-mano), fuera de la lista', () => {
    const s = A.situacion(yo({ origen: 'a-mano', aMano: true }), VACIO);
    igual(donde(s), 'te-necesita/a-mano');
    igual(s.enLista, false);
  });

  // 7 · correo que no llegó
  caso('bienvenida antigua (sin el grupo) → te necesita (correo-no-llego), y sigue en la lista', () => {
    const s = A.situacion(yo({ origen: 'web', lista: true, comercial: false, correoLista: { plantilla: 'informacion', estado: 'enviado', por: 'bienvenida', cuando: '2026-10-13T18:59:00Z' } }), VACIO);
    igual(donde(s), 'te-necesita/correo-no-llego');
    igual(A.textoMotivo(s).detalle, 'le llegó el antiguo, sin el grupo de WhatsApp');
    igual(A.fraseConNombre('Flor', s), 'A Flor no le llegó su correo');
    igual(s.enLista, true, 'sigue recibiendo la serie');
  });
  caso('rebote: correoMal y de baja → te necesita (correo-no-llego)', () => {
    const s = A.situacion(yo({ origen: 'lista-comunidad', correoMal: { entrega: 'rebotado', cuando: '2026-10-14T09:00:00Z' } }), DE_BAJA);
    igual(donde(s), 'te-necesita/correo-no-llego');
    igual(s.dato.fallo, 'rebotado');
    igual(s.enLista, false, 'de baja ya no recibe la serie');
  });
  caso('correo de la lista fallido → «no salió»', () => {
    const s = A.situacion(yo({ origen: 'lista-comunidad', correoLista: { plantilla: 'lista-espera', estado: 'fallido', por: 'bienvenida', cuando: '2026-10-14' } }), VACIO);
    igual(A.textoMotivo(s).detalle, 'no salió');
  });
  caso('sin correoLista no es «no le llegó» (no consta)', () => igual(donde(A.situacion(yo({ origen: 'lista-comunidad' }), VACIO)), 'lista'));

  // Lo que hizo Sorela
  caso('nota de seguimiento después del motivo → hablando; envío nuevo después de la nota → vuelve', () => {
    const atendida = yo({ origen: 'contacto', nota: 'Hola', seguimiento: [{ cuando: '2026-10-02T10:00:00Z', texto: 'La llamé' }] });
    igual(donde(A.situacion(atendida, VACIO)), 'hablando');
    const vuelve = { ...atendida, pidio: { contacto: '2026-10-05T10:00:00Z' }, ultimaNota: 'Otra cosa', ultimaNotaOrigen: 'contacto' };
    igual(donde(A.situacion(vuelve, VACIO)), 'te-necesita/mensaje');
  });
  caso('una nota de Sorela sin motivo no la saca de la lista', () => {
    igual(donde(A.situacion(yo({ origen: 'lista-comunidad', seguimiento: [{ cuando: '2026-10-08T15:49:00Z' }] }), VACIO)), 'lista');
  });
  caso('Cerrada por el registro con enlace (sin estadoCambiado) no vuelve a «te necesita» por lo que pidió antes', () => {
    igual(donde(A.situacion(yo({ origen: 'formacion', lista: true, estado: 'Cerrado' }), CON_VIGO)), 'cerrado');
  });

  // Avisos, lista y sin correos
  caso('terapeutas → avisar', () => igual(donde(A.situacion(yo({ origen: 'terapeutas' }), VACIO)), 'avisar'));
  caso('avisar-ciudad → avisar, fuera de la lista', () => {
    const s = A.situacion(yo({ origen: 'avisar-ciudad' }), VACIO);
    igual(donde(s), 'avisar');
    igual(A.botonDe(s), 'Ya la avisé');
    igual(s.enLista, false);
  });
  caso('Flor: portada, lista:true y comercial:false → en la lista (recibe la serie)', () => {
    const s = A.situacion(yo({ origen: 'web', lista: true, estado: 'Nuevo', comercial: false }), VACIO);
    igual(donde(s), 'lista');
    igual(s.enLista, true);
    igual(A.botonDe(s), null);
  });
  caso('alumna que entra con su enlace (Cerrado, lista:true) → cerrado, y sigue en la serie', () => {
    const s = A.situacion(yo({ origen: 'invitacion', lista: true, estado: 'Cerrado' }), VACIO);
    igual(donde(s), 'cerrado');
    igual(s.enLista, true);
  });
  caso('tipoManual alumna con lista:true → sigue en la lista', () => igual(donde(A.situacion(yo({ origen: 'web', lista: true, tipoManual: 'alumna' }), VACIO)), 'lista'));
  caso('estado vacío, "" y raro → Nuevo', () => {
    for (const estado of [undefined, '', 'Atendido']) igual(A.situacion(yo({ origen: 'lista-comunidad', estado }), VACIO).estado, 'Nuevo', String(estado));
  });
  caso('de baja, sin motivo → sin correos', () => igual(donde(A.situacion(yo({ origen: 'lista-comunidad' }), DE_BAJA)), 'sin-correos'));
  caso('ya es miembro → sin correos (no espera la apertura)', () => igual(donde(A.situacion(yo({ origen: 'lista-comunidad' }), { ...VACIO, miembro: true })), 'sin-correos'));
  caso('Descartado no está en la lista', () => igual(A.enListaDeEspera(yo({ origen: 'lista-comunidad', estado: 'Descartado' })), false));

  // Fechas
  caso('horaDeEnvio: 8:30 hasta el 24 de octubre, 7:30 desde el 25', () => {
    igual(A.horaDeEnvio('2026-10-16'), '08:30');
    igual(A.horaDeEnvio('2026-10-24'), '08:30');
    igual(A.horaDeEnvio('2026-10-25'), '07:30');
    igual(A.horaDeEnvio('2026-10-30'), '07:30');
  });
  caso('envioDiario avisa del cambio de hora', () => igual(A.envioDiario('2026-10-14'), { utc: '06:30', hoy: '08:30', cambia: { dia: '2026-10-25', hora: '07:30' } }));
  caso('cuandoSale dice «desde las», nunca «a las»', () => igual(A.cuandoSale('2026-10-16').texto, 'vie 16 oct, desde las 8:30'));
  caso('diasEsperando cuenta días de calendario en Madrid', () => {
    const ahora = new Date('2026-10-14T07:00:00Z');
    igual(A.diasEsperando('2026-10-13T23:30:00Z', ahora), 0, 'pasada la medianoche de Madrid');
    igual(A.diasEsperando('2026-10-13T20:00:00Z', ahora), 1, 'ayer por la noche');
    igual(A.diasEsperando(null, ahora), 0);
  });
  caso('aFecha entiende Timestamp, { seconds }, { _seconds }, Date e ISO', () => {
    const t = Date.UTC(2026, 9, 14);
    for (const x of [{ toDate: () => new Date(t) }, { seconds: t / 1000 }, { _seconds: t / 1000 }, new Date(t), new Date(t).toISOString()]) igual(A.aFecha(x)?.getTime(), t);
    igual(A.aFecha('no es una fecha'), null);
  });

  // La serie
  const FECHAS = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  const IDS = ['01-manos', '02-volver', '03-semana', '04-ritmo', '05-cabina', '06-valor', '07-redes', '08-termatalia', '09-manana', '10-hoy'];
  const serie = (cambios = {}) =>
    FECHAS.map((fecha, i) => ({
      id: `lanzamiento-${IDS[i]}`,
      fecha,
      estado: 'programada',
      asunto: i === 0 ? 'Tus manos son tu herramienta más cara, {nombre}' : `Correo ${i + 1}`,
      boton: i === 9 ? { texto: 'Entrar en Zoom', enlace: '' } : null,
      resultado: null,
      soloSuDia: i >= 8,
      ...(cambios[i] ?? {}),
    }));
  const ENVIADO_1 = { 0: { estado: 'enviada', resultado: { enviados: 8, fallidos: 0, omitidos: 0, cuando: '2026-10-16T06:44:00Z' } } };
  caso('progresoSerie: quien entra el 20 de octubre → 0 recibidos, quedan 9', () => igual(A.progresoSerie(serie(ENVIADO_1), '2026-10-20T10:00:00Z', false), { recibidos: 0, quedan: 9 }));
  caso('progresoSerie: quien ya estaba → 1 recibido, quedan 9; de baja, no le queda ninguno', () => {
    igual(A.progresoSerie(serie(ENVIADO_1), '2026-10-01T10:00:00Z', false), { recibidos: 1, quedan: 9 });
    igual(A.progresoSerie(serie(ENVIADO_1), '2026-10-01T10:00:00Z', true), { recibidos: 1, quedan: 0 });
  });
  caso('textoProgreso: «de 10» solo si le llegan todos', () => {
    igual(A.textoProgreso({ recibidos: 0, quedan: 10 }, 10), 'ha recibido 0 de 10');
    igual(A.textoProgreso({ recibidos: 0, quedan: 9 }, 10), 'ha recibido 0 · quedan 9');
    igual(A.textoProgreso({ recibidos: 10, quedan: 0 }, 10), 'recibió los 10 correos');
  });
  caso('entradaEnLista: la primera petición; si no hay, el alta (no el cuándo del motivo)', () => {
    const v = yo({ origen: 'lista-comunidad', pidio: { 'lista-comunidad': '2026-09-30T12:00:00Z', contacto: '2026-10-10T10:00:00Z' } });
    igual(A.entradaEnLista(v)?.toISOString(), '2026-09-30T12:00:00.000Z');
    igual(A.entradaEnLista(yo({ origen: 'web' }))?.toISOString(), '2026-10-01T10:00:00.000Z');
  });
  caso('resumenSerie del 14 de octubre: el 1, vie 16 a las 08:30, a 8 personas', () => {
    const lista = ['a@x.es', 'b@x.es', 'c@x.es', 'd@x.es', 'e@x.es', 'f@x.es', 'g@x.es', 'h@x.es'];
    const r = A.resumenSerie(serie({ 0: { excluir: ['A@x.es'], anadir: [{ correo: 'z@x.es', nombre: null }] } }), '2026-10-14', lista);
    igual(r.siguiente, { id: 'lanzamiento-01-manos', n: 1, fecha: '2026-10-16', hora: '08:30', asunto: 'Tus manos son tu herramienta más cara', personas: 8 });
    igual([r.total, r.enviadas], [10, 0]);
    igual(r.faltaEnlace, ['lanzamiento-10-hoy']);
    igual(r.soloSuDia, ['lanzamiento-09-manana', 'lanzamiento-10-hoy']);
  });
  caso('resumenSerie: el 10 sin enlace el día 6 sigue siendo el siguiente; el 7 ya no sale (solo su día)', () => {
    const casi = serie(Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [i, { estado: 'enviada' }])));
    igual(A.resumenSerie(casi, '2026-11-06', []).siguiente?.id, 'lanzamiento-10-hoy');
    igual(A.resumenSerie(casi, '2026-11-07', []).siguiente, null);
  });

  // Textos y contexto
  caso('convocatoriaCorta y asuntoLimpio', () => {
    igual(A.convocatoriaCorta(VIGO), 'Vigo, 24–25 oct');
    igual(A.convocatoriaCorta({ ciudad: 'Bogotá', inicio: '2026-10-31', fin: '2026-11-01' }), 'Bogotá, 31 oct–1 nov');
    igual(A.asuntoLimpio('{nombre}, te espero el viernes'), 'te espero el viernes');
  });
  caso('contextoDesde: solo convocatorias publicadas, abiertas y sin terminar; bajas y miembros en minúsculas', () => {
    const ctx = A.contextoDesde(
      {
        bajas: ['Baja@Ejemplo.com'],
        usuarios: [
          { correo: 'Miembro@Ejemplo.com', accesos: [{ tipo: 'membresia' }] },
          { correo: 'espera@ejemplo.com', quiereComunidad: true, accesos: [] },
        ],
        convocatorias: [
          { id: 'vale', publicada: true, ciudad: 'Vigo', inicio: '2026-10-24', fin: '2026-10-25' },
          { id: 'oculta', publicada: false, ciudad: 'Lugo', inicio: '2026-10-24', fin: '2026-10-25' },
          { id: 'cerrada', publicada: true, abierta: false, ciudad: 'Ourense', inicio: '2026-10-24', fin: '2026-10-25' },
          { id: 'pasada', publicada: true, ciudad: 'León', inicio: '2026-10-01', fin: '2026-10-02' },
        ],
      },
      '2026-10-14'
    );
    igual(ctx.convocatorias.map((c) => c.id), ['vale']);
    igual(ctx.ciudades.pasada, 'León', 'las ciudades son de todas');
    igual(ctx('baja@ejemplo.com').deBaja, true);
    igual(ctx(' MIEMBRO@ejemplo.com ').miembro, true);
    igual(A.usuarioEnLista(ctx.usuarios.get('espera@ejemplo.com')), true);
    igual(A.usuarioEnLista(ctx.usuarios.get('miembro@ejemplo.com')), false);
  });
  caso('contarGrupos tiene siempre los siete grupos', () => {
    igual(Object.keys(A.contarGrupos([])), ['te-necesita', 'avisar', 'lista', 'sin-correos', 'hablando', 'cerrado', 'descartado']);
  });

  return { bien, fallos };
}

/* ---------------------------------------------- con los datos reales */

const pila = (n) => String(n || '').trim().split(/\s+/)[0] || '(sin nombre)';

/* Los correos 09 y 10 solo pueden salir su día (diseño, R7). Hasta que
   lib/serie-lanzamiento.ts lo diga por id, la prueba los marca aquí. */
const SOLO_SU_DIA = new Set(['lanzamiento-09-manana', 'lanzamiento-10-hoy']);

/* La misma regla que esPrueba (lib/atencion-servidor.ts), que no se puede
   importar desde aquí porque es solo de servidor. */
const correosPrueba = new Set((process.env.CORREOS_PRUEBA ?? '').split(/[\s,;]+/).map((c) => c.trim().toLowerCase()).filter(Boolean));
const esPrueba = (correo, u) => {
  const alta = typeof u?.altaPor === 'string' ? u.altaPor : '';
  return alta === 'prueba' || alta.startsWith('pruebas/') || correosPrueba.has(String(correo ?? '').toLowerCase());
};

/**
 * Una pasada de SOLO LECTURA: dónde sale hoy cada persona. `db` es un
 * Firestore de firebase-admin. No escribe nada.
 */
export async function pasadaReal(db, ahora = new Date()) {
  const A = cargar();
  const [contactos, usuarios, bajas, convocatorias, campanas, correos] = await Promise.all([
    db.collection('contactos').get(),
    db.collection('usuarios').select('correo', 'nombre', 'altaPor', 'accesos', 'quiereComunidad', 'pide', 'bloqueada').get(),
    db.collection('correos_bajas').select('correo').get(),
    db.collection('convocatorias').select('publicada', 'abierta', 'ciudad', 'inicio', 'fin').get(),
    db.collection('campanas').get(),
    db.collection('correos').select('para', 'tipo', 'estado', 'asunto', 'campanaId').get(),
  ]);
  const ctx = A.contextoDesde(
    {
      bajas: bajas.docs.map((d) => d.get('correo')),
      usuarios: usuarios.docs.map((d) => ({ ...d.data(), uid: d.id })),
      convocatorias: convocatorias.docs.map((d) => ({ ...d.data(), id: d.id })),
    },
    A.hoyMadrid(ahora)
  );
  const serie = campanas.docs.map((d) => ({ id: d.id, ...d.data(), soloSuDia: SOLO_SU_DIA.has(d.id) }));

  /* El relleno de `correoLista`, simulado en memoria con el historial (lo que
     haría scripts/rellenar-correo-lista.mjs): la campaña del grupo o una
     bienvenida nueva → lista-espera; una bienvenida antigua → informacion. */
  const porPara = new Map();
  for (const d of correos.docs) {
    const p = String(d.get('para') || '').toLowerCase();
    if (!porPara.has(p)) porPara.set(p, []);
    porPara.get(p).push(d.data());
  }
  const rellenoDe = (correo) => {
    const cs = (porPara.get(correo) ?? []).filter((c) => c.estado === 'enviado');
    if (cs.some((c) => c.campanaId === 'lista-espera-grupo-whatsapp')) return { plantilla: 'lista-espera', estado: 'enviado', por: 'campana' };
    const b = cs.filter((c) => c.tipo === 'bienvenida' || c.tipo === 'registro');
    if (b.some((c) => String(c.asunto || '').startsWith('Tu sitio'))) return { plantilla: 'lista-espera', estado: 'enviado', por: 'bienvenida' };
    if (b.length) return { plantilla: 'informacion', estado: 'enviado', por: 'bienvenida' };
    return null;
  };

  const filas = [];
  const lista = new Set();
  for (const d of contactos.docs) {
    const v = d.data();
    const correo = String(v.correo || '').toLowerCase();
    const s = A.situacion(v, ctx(correo));
    const conRelleno = v.correoLista ? s : A.situacion({ ...v, correoLista: rellenoDe(correo) }, ctx(correo));
    const prueba = esPrueba(correo, ctx.usuarios.get(correo));
    if (s.enLista && !prueba) lista.add(correo);
    filas.push({ nombre: pila(v.nombre), v, s, conRelleno, prueba, comercial: v.comercial });
  }
  for (const [correo, u] of ctx.usuarios) if (A.usuarioEnLista(u) && !ctx.bajas.has(correo) && !esPrueba(correo, u)) lista.add(correo);
  const resumen = A.resumenSerie(serie, ctx.hoy, [...lista]);

  console.log(`\nDatos reales (solo lectura) · hoy ${ctx.hoy} · ${contactos.size} contactos · ${ctx.convocatorias.length} convocatoria(s) abierta(s): ${ctx.convocatorias.map(A.convocatoriaCorta).join(' · ') || '—'}`);
  for (const f of filas.sort((a, b) => a.s.grupo.localeCompare(b.s.grupo) || a.nombre.localeCompare(b.nombre, 'es'))) {
    const t = A.textoMotivo(f.s);
    const p = f.s.enLista ? A.progresoSerie(serie, A.entradaEnLista(f.v), f.s.deBaja) : null;
    const partes = [
      `${f.nombre}${f.prueba ? ' (prueba)' : ''}`,
      A.PASTILLA_GRUPO[f.s.grupo] + (t ? `: ${t.corto}${t.detalle ? ` (${t.detalle})` : ''}` : ''),
      `origen ${f.v.origen ?? '—'}`,
      f.s.enLista ? `en la serie · ${A.textoProgreso(p, resumen.total)}` : 'fuera de la serie',
      f.s.notaLista ? `nota de la lista (${f.s.notaLista.length} letras)` : null,
      f.comercial === false ? 'comercial:false' : null,
      f.conRelleno.grupo !== f.s.grupo || f.conRelleno.motivo !== f.s.motivo ? `con el relleno → ${A.PASTILLA_GRUPO[f.conRelleno.grupo]}${f.conRelleno.motivo ? `: ${A.textoMotivo(f.conRelleno).corto}` : ''}` : null,
    ];
    console.log('  · ' + partes.filter(Boolean).join(' · '));
  }

  const cuentas = A.contarGrupos(filas.map((f) => f.s));
  const sinPruebas = A.contarGrupos(filas.filter((f) => !f.prueba).map((f) => f.s));
  const relleno = A.contarGrupos(filas.map((f) => f.conRelleno));
  const linea = (c) => A.GRUPOS.map((g) => `${A.TITULO_GRUPO[g]} ${c[g]}`).join(' · ');
  console.log(`\n  Por grupo:              ${linea(cuentas)}`);
  console.log(`  Sin cuentas de prueba:  ${linea(sinPruebas)}`);
  console.log(`  Con el relleno (simulado, no escribe): ${linea(relleno)}`);

  const flor = filas.filter((f) => f.comercial === false);
  console.log(`  Con comercial:false: ${flor.length}, de ellas en la serie: ${flor.filter((f) => f.s.enLista).length} (deben ser todas)`);
  const sig = resumen.siguiente;
  console.log(
    `  Serie: ${resumen.enviadas} de ${resumen.total} enviadas · siguiente: ${sig ? `${sig.n} «${sig.asunto}» · ${A.cuandoSale(sig.fecha).texto} · a ${sig.personas} personas` : 'ninguno'}` +
      ` · falta el enlace: ${resumen.faltaEnlace.join(', ') || 'ninguno'}`
  );

  /* Lo que esperaba el diseño con los datos del 14 de octubre (§1.7 y §6.2),
     con Flor en la lista (decisión de Sorela). Otro día las cifras cambian. */
  const esperado = { 'te-necesita': 0, avisar: 1, lista: 8, 'sin-correos': 0, hablando: 0, cerrado: 1, descartado: 0 };
  const coincide = A.GRUPOS.every((g) => cuentas[g] === esperado[g]);
  console.log(`  El diseño esperaba el 14 oct: ${linea(esperado)} → ${coincide ? 'coincide' : 'NO coincide (puede haber altas nuevas)'}`);

  /* Invariantes que valen cualquier día. */
  const fallos = [];
  if (flor.some((f) => !f.s.enLista && f.s.grupo !== 'descartado' && !f.s.deBaja && !ctx(f.v.correo).miembro && A.enListaDeEspera(f.v)))
    fallos.push('alguien con comercial:false de la lista se ha quedado fuera de la serie');
  if (filas.some((f) => f.s.grupo === 'te-necesita' && !f.s.motivo)) fallos.push('alguien sale en «Te necesitan» sin motivo');
  if (filas.some((f) => f.s.grupo === 'lista' && !f.s.enLista)) fallos.push('alguien sale en la lista sin recibir la serie');
  return { cuentas, sinPruebas, relleno, resumen, fallos };
}

/* ------------------------------------------------------------ a correr */

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (esPrincipal) {
  let mal = 0;
  try {
    const { bien, fallos } = probarRegla();
    console.log(`La regla: ${bien} casos bien, ${fallos.length} mal.`);
    for (const f of fallos) console.log('  ✗ ' + f);
    mal += fallos.length;

    const hayLlave = ['FIREBASE_PROYECTO_ID', 'FIREBASE_CLIENTE_CORREO', 'FIREBASE_CLAVE_PRIVADA'].every((v) => process.env[v]);
    if (hayLlave && !process.argv.includes('--sin-reales')) {
      const { cert, getApps, initializeApp } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');
      const app =
        getApps()[0] ??
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROYECTO_ID,
            clientEmail: (process.env.FIREBASE_CLIENTE_CORREO || '').trim(),
            privateKey: (process.env.FIREBASE_CLAVE_PRIVADA || '').replace(/\\n/g, '\n'),
          }),
          projectId: process.env.FIREBASE_PROYECTO_ID,
        });
      const r = await pasadaReal(getFirestore(app));
      for (const f of r.fallos) console.log('  ✗ ' + f);
      mal += r.fallos.length;
    } else if (!hayLlave) {
      console.log('Sin la llave de Firebase: no hay pasada por los datos reales (node --env-file=.env.local pruebas/atencion.mjs).');
    }
  } finally {
    limpiar();
  }
  process.exit(mal ? 1 : 0);
}
