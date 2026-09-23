import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';

/**
 * La facturación de Sorela.
 *
 *   GET   → las facturas emitidas, sus datos fiscales y el trimestre en curso
 *   POST  → emitir una factura nueva
 *   PATCH → marcarla cobrada o pendiente, o guardar los datos del emisor
 *
 * Esto no es una lista bonita: es contabilidad. Una factura española tiene que
 * llevar, por el reglamento de facturación, número y serie, fecha de emisión,
 * nombre y NIF y domicilio de quien la emite y de quien la recibe, qué se ha
 * facturado, la base imponible, el tipo de IVA con su cuota, la retención de
 * IRPF si la hay, y el total. Todo eso se calcula y se congela AQUÍ.
 *
 * Tres decisiones que conviene entender antes de tocar nada:
 *
 * 1. NUMERACIÓN CORRELATIVA SIN HUECOS. Es lo más delicado de todo el fichero.
 *    Leer el número más alto y sumarle uno está mal: dos peticiones a la vez
 *    leen el mismo número y emiten dos facturas con el mismo. Aquí el número
 *    lo reparte una transacción de Firestore sobre el documento contador, y
 *    dentro de esa MISMA transacción se escribe la factura. Si la escritura
 *    falla, el contador no avanza; si el contador avanza, la factura existe.
 *    Ni duplicados ni huecos.
 *
 * 2. TODO EN CÉNTIMOS ENTEROS. Los euros en coma flotante producen los
 *    clásicos 0,30000000000000004 y los redondeos a 0,005 que no cuadran en el
 *    trimestre. Se convierte a céntimos en la frontera —una sola vez, al
 *    recibir— y a partir de ahí solo hay enteros. Los importes salen también
 *    en céntimos hacia el navegador, por eso los campos llevan el sufijo Cent.
 *
 * 3. LOS TOTALES NO SE ACEPTAN DEL NAVEGADOR. El navegador manda conceptos,
 *    cantidades y precios; la base, el IVA, el IRPF y el total los calcula el
 *    servidor. Lo que se ve mientras se escribe es una previsión, no la cifra.
 *
 * Y lo que NO hay, a propósito: no hay DELETE ni PUT. Una factura emitida no
 * se borra ni se edita, porque su número ya está dado y consumido; si está
 * mal, lo que procede es emitir una factura RECTIFICATIVA que la corrija.
 * Abrir aquí un borrado sería dejar huecos en la numeración, que es
 * exactamente lo que Hacienda mira.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cobrada o pendiente. No hay más: «vencida» se deduce de la fecha, no se guarda. */
export const ESTADOS_FACTURA = ['Pendiente', 'Cobrada'] as const;
export type EstadoFactura = (typeof ESTADOS_FACTURA)[number];

/** Quién emite. Se rellena una vez y se copia dentro de cada factura. */
export type DatosFiscales = {
  nombre: string;
  nif: string;
  direccion: string;
  serie: string;
};

type LineaGuardada = {
  concepto: string;
  cantidad: number;
  precioCent: number;
  importeCent: number;
};

async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { error: NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 }) };
  if (sesion.rol !== 'sorela') {
    // 403 y no 404: la persona está identificada, simplemente no le toca.
    return { error: NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 }) };
  }
  return { sesion };
}

function sinConfigurar() {
  return NextResponse.json({ ok: false, motivo: 'sin-configurar' }, { status: 503 });
}

/* ==========================================================================
   Fechas
   ========================================================================== */

/**
 * Hoy, en España, como '2026-09-23'.
 *
 * Importa el huso: el servidor de Vercel va en UTC, así que a partir de las
 * dos de la madrugada de un 1 de julio una factura emitida en Madrid caería
 * todavía en el segundo trimestre si se calculara con la fecha del servidor.
 * 'en-CA' se usa porque es el idioma que formatea la fecha justo como se
 * guarda: año, mes y día separados por guiones.
 */
function hoyEnMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

function dos(n: number): string {
  return String(n).padStart(2, '0');
}

/** Es una fecha de verdad y con la forma AAAA-MM-DD, no un texto cualquiera. */
function fechaValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, d] = v.split('-').map(Number);
  // El año se acota además de comprobarse la forma. Un dedazo del tipo
  // '0226-09-23' pasa el resto de controles y no tiene vuelta atrás: el número
  // saldría como A226/0001 y una factura emitida no se borra.
  if (a < 2000 || a > 2100) return false;
  if (m < 1 || m > 12 || d < 1) return false;
  // El día 0 del mes siguiente es el último del mes actual: así se cazan los
  // 31 de febrero sin tener que saberse los años bisiestos.
  return d <= new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** El trimestre natural al que pertenece una fecha, con sus dos extremos. */
function trimestreDe(fecha: string) {
  const anio = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  const numero = Math.floor((mes - 1) / 3) + 1;
  const primerMes = (numero - 1) * 3 + 1;
  const ultimoMes = primerMes + 2;
  const ultimoDia = new Date(Date.UTC(anio, ultimoMes, 0)).getUTCDate();
  return {
    etiqueta: `${numero}T ${anio}`,
    desde: `${anio}-${dos(primerMes)}-01`,
    hasta: `${anio}-${dos(ultimoMes)}-${dos(ultimoDia)}`,
  };
}

/* ==========================================================================
   NIF
   ========================================================================== */

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

/**
 * Comprueba el NIF de verdad, con su dígito de control.
 *
 * No es un capricho: una factura con el NIF del emisor mal escrito no es
 * deducible para quien la recibe, y el error se descubre meses después. Mirar
 * solo que «tenga ocho números y una letra» deja pasar justo el fallo típico,
 * que es una letra equivocada.
 *
 * Cubre las tres formas: DNI, NIE y CIF de sociedad.
 */
export function nifValido(valor: string): boolean {
  const n = valor.toUpperCase().replace(/[\s.-]/g, '');

  // DNI: ocho cifras y la letra que sale del resto de dividir por 23.
  if (/^\d{8}[A-Z]$/.test(n)) {
    return n[8] === LETRAS_DNI[Number(n.slice(0, 8)) % 23];
  }

  // NIE: lo mismo, pero la X, la Y y la Z valen 0, 1 y 2 delante del número.
  if (/^[XYZ]\d{7}[A-Z]$/.test(n)) {
    const numero = Number(String('XYZ'.indexOf(n[0])) + n.slice(1, 8));
    return n[8] === LETRAS_DNI[numero % 23];
  }

  // CIF: letra de forma jurídica, siete cifras y un control que unas veces es
  // cifra y otras letra.
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(n)) {
    const cifras = n.slice(1, 8).split('').map(Number);
    let suma = 0;
    cifras.forEach((d, i) => {
      // Las posiciones impares (1.ª, 3.ª, 5.ª y 7.ª, aquí índices pares) se
      // duplican y se suman sus dos cifras; las otras van tal cual.
      if (i % 2 === 0) {
        const doble = d * 2;
        suma += doble > 9 ? doble - 9 : doble;
      } else {
        suma += d;
      }
    });
    const control = (10 - (suma % 10)) % 10;
    const letra = 'JABCDEFGHI'[control];
    const ultimo = n[8];
    // Las sociedades de estas letras llevan control en letra; las de estas
    // otras, en cifra; el resto admite las dos.
    if ('PQRSNW'.includes(n[0])) return ultimo === letra;
    if ('ABEH'.includes(n[0])) return ultimo === String(control);
    return ultimo === String(control) || ultimo === letra;
  }

  return false;
}

/* ==========================================================================
   Dinero
   ========================================================================== */

/**
 * Tope de un precio unitario: un millón de euros en céntimos.
 *
 * No es por desconfianza, es aritmética. Con la cantidad llegando hasta 100.000
 * y cincuenta líneas por factura, un precio sin techo se sale del entero exacto
 * de JavaScript y las sumas empiezan a perder unidades en silencio, que es
 * justo lo que no puede pasar con dinero. Con este tope, el peor caso posible
 * se queda muy por debajo de Number.MAX_SAFE_INTEGER.
 */
const PRECIO_MAXIMO_CENT = 100_000_000;

/**
 * Un importe en euros recibido del navegador, en céntimos enteros.
 *
 * Acepta la coma como separador decimal porque es lo que escribe cualquiera en
 * España. Devuelve null si no es un número usable: el que llama decide qué
 * hacer con eso, aquí no se inventa un cero.
 */
function aCentimos(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  // Este es el único redondeo de euros a céntimos de todo el flujo. A partir
  // de aquí solo hay enteros.
  const cent = Math.round(n * 100);
  return cent > PRECIO_MAXIMO_CENT ? null : cent;
}

/**
 * Un porcentaje de impuesto: un número entre 0 y 100, con decimales o sin ellos.
 *
 * Ojo con la diferencia entre «no lo manda» y «lo manda vacío», que no es la
 * misma cosa: si el campo no viene, se aplica el valor por defecto; si viene
 * pero está en blanco es que Sorela ha borrado la casilla, y en pantalla esa
 * casilla vacía enseña un 0 %. Devolver aquí el 21 % por defecto emitiría una
 * factura con un IVA que ella no ha visto en ningún momento.
 */
function aPorcentaje(valor: unknown, pordefecto: number): number | null {
  if (valor === undefined || valor === null) return pordefecto;
  if (typeof valor === 'string' && valor.trim() === '') return 0;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

/**
 * Un número que viene de Firestore, siempre usable.
 *
 * Lo que sale de la base de datos no está tipado: un campo que falte o que
 * alguien haya escrito a mano desde la consola de Firebase llega como undefined
 * o como texto, y Number() de eso es NaN. Un NaN suelto no revienta, que sería
 * lo cómodo: se propaga por las sumas y acaba imprimiéndose en una factura.
 */
function cifra(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function texto(valor: unknown, maximo = 300): string {
  return String(valor ?? '').trim().slice(0, maximo);
}

/* ==========================================================================
   Leer
   ========================================================================== */

/** La serie que PATCH deja escrita, o 'A' si lo guardado no tiene forma de serie. */
function serieValida(valor: unknown): string {
  const s = texto(valor, 6).toUpperCase();
  // Se vuelve a comprobar aquí aunque PATCH ya lo haga al guardar: esta serie
  // acaba siendo nombre de campo del contador, y lo que hay en la base de datos
  // pudo escribirlo cualquiera desde la consola de Firebase.
  return /^[A-Z0-9]{1,6}$/.test(s) ? s : 'A';
}

async function leerFiscales(): Promise<DatosFiscales | null> {
  const doc = await baseDeDatos().collection(COLECCIONES.ajustes).doc('fiscales').get();
  if (!doc.exists) return null;
  const v = doc.data() ?? {};
  const nombre = texto(v.nombre);
  const nif = texto(v.nif, 20);
  const direccion = texto(v.direccion);
  // Media ficha no sirve para emitir: se trata igual que no tener ninguna.
  if (!nombre || !nif || !direccion) return null;
  return { nombre, nif, direccion, serie: serieValida(v.serie) };
}

/**
 * Las líneas de una factura guardada, una por una y con todos sus campos.
 *
 * Se normalizan de verdad en vez de dar el array por bueno porque la pantalla
 * llama a toLocaleString sobre `cantidad` para imprimir la hoja: una línea a la
 * que le falte ese campo no enseña un hueco, tira abajo la factura entera al
 * abrirla.
 */
function lineasDe(valor: unknown): LineaGuardada[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((l) => {
    const linea = (l ?? {}) as Record<string, unknown>;
    return {
      concepto: texto(linea.concepto, 200),
      cantidad: cifra(linea.cantidad),
      precioCent: cifra(linea.precioCent),
      importeCent: cifra(linea.importeCent),
    };
  });
}

export async function GET() {
  if (!hayFirebase()) return sinConfigurar();
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  const [fiscales, lista] = await Promise.all([
    leerFiscales(),
    baseDeDatos()
      .collection(COLECCIONES.facturas)
      // Por 'orden', que es el número correlativo convertido en cifra
      // ordenable: así la lista sale exactamente en el orden en que se
      // emitieron, con la última arriba. Ordenar por fecha daría empates y
      // necesitaría un índice compuesto para desempatar.
      .orderBy('orden', 'desc')
      .limit(500)
      .get(),
  ]);

  const facturas = lista.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      numero: texto(v.numero, 40),
      serie: texto(v.serie, 6),
      fecha: texto(v.fecha, 10),
      emisor: {
        nombre: texto(v.emisor?.nombre),
        nif: texto(v.emisor?.nif, 20),
        direccion: texto(v.emisor?.direccion),
      },
      cliente: {
        nombre: texto(v.cliente?.nombre),
        nif: texto(v.cliente?.nif, 20),
        direccion: texto(v.cliente?.direccion),
      },
      lineas: lineasDe(v.lineas),
      ivaPorcentaje: cifra(v.ivaPorcentaje),
      irpfPorcentaje: cifra(v.irpfPorcentaje),
      baseCent: cifra(v.baseCent),
      ivaCent: cifra(v.ivaCent),
      irpfCent: cifra(v.irpfCent),
      totalCent: cifra(v.totalCent),
      nota: texto(v.nota, 400),
      // El estado se comprueba contra la lista en vez de creérselo: la pantalla
      // elige con él la clase del distintivo, y un valor que no esté previsto
      // pintaría el rótulo sin estilo ninguno.
      estado: (ESTADOS_FACTURA as readonly string[]).includes(v.estado)
        ? (v.estado as EstadoFactura)
        : 'Pendiente',
      // Un Timestamp de Firestore no sobrevive a JSON.stringify de forma
      // legible, así que se manda como texto ISO y se formatea en pantalla.
      creado: v.creado?.toDate?.().toISOString() ?? null,
    };
  });

  const hoy = hoyEnMadrid();
  const t = trimestreDe(hoy);
  // El trimestre se suma sobre las facturas ya traídas en vez de con otra
  // consulta. Es seguro: vienen ordenadas de la última a la primera, así que
  // las 500 más recientes contienen entero el trimestre en curso salvo que se
  // emitan más de 500 facturas en tres meses, que no es el caso.
  const delTrimestre = facturas.filter((f) => f.fecha >= t.desde && f.fecha <= t.hasta);
  const suma = (fs: typeof facturas, campo: 'baseCent' | 'ivaCent' | 'irpfCent' | 'totalCent') =>
    fs.reduce((acc, f) => acc + f[campo], 0);

  const trimestre = {
    etiqueta: t.etiqueta,
    desde: t.desde,
    hasta: t.hasta,
    cuantas: delTrimestre.length,
    baseCent: suma(delTrimestre, 'baseCent'),
    ivaCent: suma(delTrimestre, 'ivaCent'),
    irpfCent: suma(delTrimestre, 'irpfCent'),
    totalCent: suma(delTrimestre, 'totalCent'),
    cobradoCent: suma(
      delTrimestre.filter((f) => f.estado === 'Cobrada'),
      'totalCent'
    ),
    pendienteCent: suma(
      delTrimestre.filter((f) => f.estado !== 'Cobrada'),
      'totalCent'
    ),
  };

  return NextResponse.json({ ok: true, facturas, fiscales, trimestre, hoy });
}

/* ==========================================================================
   Emitir
   ========================================================================== */

type LineaEntrante = { concepto?: unknown; cantidad?: unknown; precio?: unknown };

type CuerpoFactura = {
  cliente?: { nombre?: unknown; nif?: unknown; direccion?: unknown };
  lineas?: LineaEntrante[];
  ivaPorcentaje?: unknown;
  irpfPorcentaje?: unknown;
  fecha?: unknown;
  nota?: unknown;
};

function falta(mensaje: string) {
  return NextResponse.json({ ok: false, motivo: 'falta', mensaje }, { status: 400 });
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) return sinConfigurar();
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;
  const { sesion } = guardia;

  let cuerpo: CuerpoFactura;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  // 1. Sin datos del emisor no hay factura posible: faltarían el NIF y el
  //    domicilio, que son obligatorios.
  const fiscales = await leerFiscales();
  if (!fiscales) {
    return falta(
      'Antes de emitir hay que rellenar tus datos de facturación: nombre o razón social, NIF y domicilio.'
    );
  }

  // 2. El destinatario.
  const cliente = {
    nombre: texto(cuerpo.cliente?.nombre),
    // El NIF del cliente no se valida contra el dígito de control porque puede
    // ser un NIF-IVA extranjero, que no sigue el esquema español. Se guarda
    // tal cual: si lo da, va en la factura.
    nif: texto(cuerpo.cliente?.nif, 20).toUpperCase(),
    direccion: texto(cuerpo.cliente?.direccion),
  };
  if (!cliente.nombre) {
    return falta('Falta el nombre de quien recibe la factura.');
  }

  // 3. La fecha de emisión.
  const fecha = texto(cuerpo.fecha, 10) || hoyEnMadrid();
  if (!fechaValida(fecha)) {
    return falta('La fecha de la factura no es válida.');
  }
  if (fecha > hoyEnMadrid()) {
    // Una factura con fecha futura no es válida: se emite cuando se emite.
    return falta('No se puede poner una fecha futura en una factura.');
  }

  // 4. Las líneas. Sin ninguna no hay nada que facturar.
  const entrantes = Array.isArray(cuerpo.lineas) ? cuerpo.lineas : [];
  if (entrantes.length === 0) {
    return falta('Añade al menos un concepto a la factura.');
  }
  if (entrantes.length > 50) {
    return falta('Demasiadas líneas en una sola factura.');
  }

  const lineas: LineaGuardada[] = [];
  for (const [i, l] of entrantes.entries()) {
    const concepto = texto(l.concepto, 200);
    const cantidad =
      typeof l.cantidad === 'number' ? l.cantidad : Number(String(l.cantidad ?? '').replace(',', '.'));
    const precioCent = aCentimos(l.precio);

    if (!concepto) return falta(`Falta el concepto de la línea ${i + 1}.`);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 100000) {
      return falta(`La cantidad de la línea ${i + 1} no es válida.`);
    }
    // Cae aquí tanto lo que no es un número como lo que pasa del tope: las dos
    // cosas se arreglan mirando el precio, así que el aviso es el mismo.
    if (precioCent === null) return falta(`El precio de la línea ${i + 1} no es válido.`);

    lineas.push({
      concepto,
      cantidad,
      precioCent,
      // La cantidad puede llevar decimales (hora y media, 2,5 sesiones), así
      // que el importe de la línea también se redondea a céntimo entero.
      importeCent: Math.round(precioCent * cantidad),
    });
  }

  // 5. Impuestos.
  const ivaPorcentaje = aPorcentaje(cuerpo.ivaPorcentaje, 21);
  const irpfPorcentaje = aPorcentaje(cuerpo.irpfPorcentaje, 0);
  if (ivaPorcentaje === null) return falta('El tipo de IVA no es válido.');
  if (irpfPorcentaje === null) return falta('El porcentaje de retención no es válido.');

  // 6. Las cuentas, aquí y solo aquí.
  const baseCent = lineas.reduce((acc, l) => acc + l.importeCent, 0);
  if (baseCent <= 0) {
    return falta('El importe de la factura es cero. Revisa los precios.');
  }
  const ivaCent = Math.round((baseCent * ivaPorcentaje) / 100);
  // La retención se RESTA: es dinero que el cliente ingresa a Hacienda en
  // nombre de Sorela, no dinero que ella cobre.
  const irpfCent = Math.round((baseCent * irpfPorcentaje) / 100);
  const totalCent = baseCent + ivaCent - irpfCent;

  // 7. El número, dentro de una transacción junto con la propia factura.
  const db = baseDeDatos();
  const serie = fiscales.serie;
  const anio = Number(fecha.slice(0, 4));
  const clave = `${serie}_${anio}`;
  const refContador = db.collection(COLECCIONES.ajustes).doc('contador');
  const refFactura = db.collection(COLECCIONES.facturas).doc();

  const resultado = await db.runTransaction(async (t) => {
    const snap = await t.get(refContador);
    const datos: Record<string, unknown> = snap.data() ?? {};
    const serieDatos = (datos[clave] ?? {}) as { emitidas?: number; ultimaFecha?: string };
    const emitidas = typeof serieDatos.emitidas === 'number' ? serieDatos.emitidas : 0;
    const ultimaFecha = typeof serieDatos.ultimaFecha === 'string' ? serieDatos.ultimaFecha : '';

    // Dentro de una serie, los números tienen que ir en el mismo orden que las
    // fechas. Si se permitiera fechar hacia atrás, la factura 7 sería anterior
    // a la 6 y la numeración dejaría de ser correlativa en el tiempo.
    if (ultimaFecha && fecha < ultimaFecha) {
      // Se sale sin escribir nada: la transacción no llega a tocar el contador.
      return { ok: false as const, ultimaFecha };
    }

    const n = emitidas + 1;
    const numero = `${serie}${anio}/${String(n).padStart(4, '0')}`;

    t.set(refContador, { [clave]: { emitidas: n, ultimaFecha: fecha } }, { merge: true });
    t.set(refFactura, {
      numero,
      serie,
      anio,
      // Una cifra que ordena igual que el número: 2026 y la 7.ª factura dan
      // 2026000007. Permite ordenar la lista con un solo campo y sin índices.
      orden: anio * 1000000 + n,
      fecha,
      // Copia CONGELADA de los datos del emisor. Si Sorela se muda el año que
      // viene, las facturas viejas tienen que seguir enseñando el domicilio
      // que se imprimió y se entregó, no el nuevo.
      emisor: { nombre: fiscales.nombre, nif: fiscales.nif, direccion: fiscales.direccion },
      cliente,
      lineas,
      ivaPorcentaje,
      irpfPorcentaje,
      baseCent,
      ivaCent,
      irpfCent,
      totalCent,
      nota: texto(cuerpo.nota, 400),
      estado: 'Pendiente' as EstadoFactura,
      creado: FieldValue.serverTimestamp(),
      emitidaPor: sesion.uid,
    });

    return { ok: true as const, numero, n };
  });

  if (!resultado.ok) {
    return falta(
      `La última factura de la serie ${serie} es del ${resultado.ultimaFecha}. No se puede emitir una con fecha anterior sin romper la numeración.`
    );
  }

  return NextResponse.json({
    ok: true,
    id: refFactura.id,
    numero: resultado.numero,
    baseCent,
    ivaCent,
    irpfCent,
    totalCent,
  });
}

/* ==========================================================================
   Cambiar lo poco que se puede cambiar
   ========================================================================== */

export async function PATCH(peticion: Request) {
  if (!hayFirebase()) return sinConfigurar();
  const guardia = await exigirAdmin();
  if (guardia.error) return guardia.error;

  const que = new URL(peticion.url).searchParams.get('que');

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  // --- Los datos del emisor ---
  if (que === 'fiscales') {
    const nombre = texto(cuerpo.nombre, 160);
    const nif = texto(cuerpo.nif, 20).toUpperCase().replace(/[\s.-]/g, '');
    const direccion = texto(cuerpo.direccion, 300);
    const serie = texto(cuerpo.serie, 6).toUpperCase() || 'A';

    if (!nombre) return falta('Falta tu nombre o razón social.');
    if (!nif) return falta('Falta tu NIF.');
    if (!nifValido(nif)) return falta('Ese NIF no es correcto: revisa la letra.');
    if (direccion.length < 5) return falta('Falta el domicilio fiscal completo.');
    // La serie acaba siendo nombre de campo del contador, así que nada de
    // puntos ni barras: Firestore los interpretaría como ruta.
    if (!/^[A-Z0-9]{1,6}$/.test(serie)) {
      return falta('La serie solo puede llevar letras y números, hasta seis.');
    }

    await baseDeDatos()
      .collection(COLECCIONES.ajustes)
      .doc('fiscales')
      .set({ nombre, nif, direccion, serie, actualizado: FieldValue.serverTimestamp() }, { merge: true });

    return NextResponse.json({ ok: true, fiscales: { nombre, nif, direccion, serie } });
  }

  // --- Cobrada o pendiente ---
  const id = texto(cuerpo.id, 60);
  const estado = texto(cuerpo.estado, 20);
  // Del identificador se comprueba la FORMA, no solo que venga algo: un id con
  // barras dentro no es un identificador para Firestore, es una ruta, y
  // 'facturas/x/otra/y' escribiría en una colección que no es esta.
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id) || !(ESTADOS_FACTURA as readonly string[]).includes(estado)) {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  try {
    // update y no set con merge, que es lo que parecería natural: set CREA el
    // documento si el identificador no existe, y dejaría en la colección una
    // factura fantasma con un estado y nada más —sin número, sin importes y sin
    // el campo 'orden' por el que se ordena la lista, así que ni siquiera se
    // vería—. update falla, que es justo lo que queremos.
    //
    // Se escribe solo el estado: lo único que se puede cambiar de una factura
    // emitida es si está cobrada. Los importes, el número y las fechas no.
    await baseDeDatos()
      .collection(COLECCIONES.facturas)
      .doc(id)
      .update({ estado, estadoCambiado: FieldValue.serverTimestamp() });
  } catch (e) {
    // Se distingue «esa factura no existe» de «Firestore no contesta». Tratar
    // las dos igual diría que la factura no está cuando lo que pasa es que la
    // base de datos está caída, y eso asusta a cualquiera que esté mirando.
    const codigo = (e as { code?: unknown } | null)?.code;
    if (codigo === 5 || codigo === 'not-found') {
      return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, id, estado });
}
