import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, setCharacterSpacing, type Color, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  DIAS_SEMANA,
  GLOSARIO,
  analizar,
  cambio,
  decimal,
  deHasta,
  destacados,
  fechaCorta,
  fechaLarga,
  minutos,
  nombreDeCiudad,
  nombreDePagina,
  nombreDePais,
  num,
  porcentaje,
  primeros,
  sobrePeriodo,
  textosDe,
  unDecimal,
  type Cambio,
  type Consejo,
  type DatosInforme,
  type Par,
  type Textos,
} from './informe';

/**
 * El informe de métricas, pintado en PDF con pdf-lib.
 *
 * Los textos y las cuentas salen de lib/informe.ts; aquí solo se maqueta:
 * portada oscura con el logotipo, un resumen en una página y una sección por
 * cada bloque de datos, cada una con su gráfica, sus cifras, «Qué significa»
 * y «Qué haría yo». Al final, el glosario. Todas las páginas llevan su número.
 *
 * TIPOGRAFÍA. Las de la marca, metidas dentro del PDF: Cormorant Garamond
 * para titulares y cifras (con números de caja alta, `lnum`, para que las
 * cifras no bailen) y Jost para el texto, a 400 y 500 como en la web. Están en
 * `fuentes/` en formato TTF —un PDF no puede llevar woff2— y next.config.ts
 * las mete en el paquete de Vercel. Se incrustan solo con las letras que se
 * usan, así que el PDF pesa poco aunque los archivos pesen más. Las de
 * Cormorant son las del repositorio oficial de la fuente y no las que sirve
 * Google: con las de Google, el recorte de letras de pdf-lib se comía media
 * palabra. Si un día faltaran, el informe sale igual con las estándar del PDF.
 *
 * MAQUETA. Todo se pinta por bloques que primero se miden y luego se dibujan:
 * si un bloque no cabe en lo que queda de página, pasa entero a la siguiente.
 * Así nada sale cortado ni montado. El texto largo se parte en renglones por
 * su ancho real con la fuente y el tamaño con que se pinta.
 */

/* ------------------------------------------------------------- medidas */

const A4: [number, number] = [595.28, 841.89];
const [ANCHO, ALTO] = A4;
const MARGEN = 50;
const UTIL = ANCHO - MARGEN * 2;
/** Donde empieza el contenido, bajo la cabecera. */
const TECHO = ALTO - 70;
/** Hasta donde puede bajar, sobre el pie. */
const SUELO = 58;

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/* Los colores de la marca. Contrastes sobre blanco: tinta 18:1, gris 7,1:1,
   letra dorada 7,6:1; el oro vivo (5:1) va en barras y adornos, no en texto
   de lectura. En la portada, la crema suave sobre la noche da 11:1. */
const C = {
  tinta: hex('#141210'),
  tinta2: hex('#3e3831'),
  gris: hex('#5e564c'),
  oro: hex('#8a6a32'),
  oroLetra: hex('#6f5323'),
  oroClaro: hex('#c9a46b'),
  oroPalido: hex('#e6d6b8'),
  crema: hex('#f7f3ec'),
  cremaOro: hex('#f5efe2'),
  pista: hex('#eee8de'),
  linea: hex('#e2dbd0'),
  bien: hex('#3d5a33'),
  bienFondo: hex('#e6eee2'),
  mal: hex('#8f3f26'),
  malFondo: hex('#f7e6df'),
  noche: hex('#15120e'),
  nocheLinea: hex('#3a332a'),
  cremaNoche: hex('#f4efe7'),
  cremaSuave: hex('#cfc5b5'),
  oroNoche: hex('#d9b47c'),
  blanco: rgb(1, 1, 1),
};
/* Para repartos (móvil/ordenador/tablet…): del bronce a la crema, distinguibles también en gris. */
const SERIE = [hex('#6f5323'), hex('#b08a4f'), hex('#dcc59b'), hex('#3e3831'), hex('#a39889')];

/* ------------------------------------------------------------- fuentes */

type Fuentes = { titulo: PDFFont; cifra: PDFFont; cursiva: PDFFont; texto: PDFFont; medio: PDFFont };
const ARCHIVOS = {
  titulo: 'CormorantGaramond-Medium.ttf',
  cifra: 'CormorantGaramond-SemiBold.ttf',
  cursiva: 'CormorantGaramond-MediumItalic.ttf',
  texto: 'Jost-Regular.ttf',
  medio: 'Jost-Medium.ttf',
} as const;

/* Se leen del disco una vez por servidor, no en cada informe. */
let bytesFuentes: Promise<Record<keyof Fuentes, Uint8Array>> | null = null;
let bytesLogo: Promise<Uint8Array | null> | null = null;

function leerFuentes() {
  const claves = Object.keys(ARCHIVOS) as (keyof Fuentes)[];
  bytesFuentes ??= Promise.all(claves.map((k) => readFile(path.join(process.cwd(), 'fuentes', ARCHIVOS[k])))).then((bs) => {
    const salida = {} as Record<keyof Fuentes, Uint8Array>;
    claves.forEach((k, i) => (salida[k] = bs[i]));
    return salida;
  });
  // Si falla, que el siguiente informe lo vuelva a intentar.
  bytesFuentes.catch(() => (bytesFuentes = null));
  return bytesFuentes;
}

async function cargarFuentes(doc: PDFDocument): Promise<Fuentes> {
  try {
    const b = await leerFuentes();
    doc.registerFontkit(fontkit);
    /* `lnum`: números de caja alta. Cormorant trae por defecto los de estilo
       antiguo, que suben y bajan: en una cifra grande parecen bailar. */
    const [titulo, cifra, cursiva, texto, medio] = await Promise.all([
      doc.embedFont(b.titulo, { subset: true, features: { lnum: true } }),
      doc.embedFont(b.cifra, { subset: true, features: { lnum: true } }),
      doc.embedFont(b.cursiva, { subset: true, features: { lnum: true } }),
      doc.embedFont(b.texto, { subset: true }),
      doc.embedFont(b.medio, { subset: true }),
    ]);
    return { titulo, cifra, cursiva, texto, medio };
  } catch (e) {
    console.error('[informe] sin las fuentes de la marca, salen las estándar:', e);
    const [titulo, cifra, cursiva, texto, medio] = await Promise.all([
      doc.embedFont(StandardFonts.TimesRoman),
      doc.embedFont(StandardFonts.TimesRomanBold),
      doc.embedFont(StandardFonts.TimesRomanItalic),
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
    ]);
    return { titulo, cifra, cursiva, texto, medio };
  }
}

/* ------------------------------------------------------------- texto */

const juegos = new WeakMap<PDFFont, Set<number>>();
const juegoDe = (f: PDFFont) => {
  let s = juegos.get(f);
  if (!s) juegos.set(f, (s = new Set(f.getCharacterSet())));
  return s;
};
const SUSTITUTOS: Record<string, string> = { ' ': ' ', ' ': ' ', '→': '›', '’': "'" };

/**
 * Quita lo que la fuente no sabe pintar. Un emoji en el nombre de un vídeo o
 * una letra rara en una ciudad harían fallar el PDF entero: antes que eso, se
 * cambia por su parecido o se quita.
 */
function limpio(t: string, f: PDFFont): string {
  const s = juegoDe(f);
  let salida = '';
  for (const ch of String(t ?? '')) {
    const cp = ch.codePointAt(0) ?? 0;
    if (s.has(cp)) salida += ch;
    else if (SUSTITUTOS[ch] && [...SUSTITUTOS[ch]].every((c) => s.has(c.codePointAt(0) ?? 0))) salida += SUSTITUTOS[ch];
    else if (/\s/.test(ch)) salida += ' ';
  }
  // Lo quitado no deja huecos dobles ni un espacio suelto antes de cerrar comillas o paréntesis.
  return salida.replace(/ {2,}/g, ' ').replace(/ ([»),.;:!?])/g, '$1');
}

const medir = (t: string, f: PDFFont, talla: number, espaciado = 0) => {
  const l = limpio(t, f);
  return f.widthOfTextAtSize(l, talla) + Math.max(0, [...l].length - 1) * espaciado;
};

/** Recorta con «…» hasta que quepa. */
function caber(t: string, f: PDFFont, talla: number, maximo: number, espaciado = 0): string {
  let l = limpio(t, f);
  if (medir(l, f, talla, espaciado) <= maximo) return l;
  while (l.length > 1 && medir(`${l}…`, f, talla, espaciado) > maximo) l = l.slice(0, -1);
  return `${l.trimEnd()}…`;
}

type OpcionesTexto = { f: PDFFont; talla: number; color?: Color; espaciado?: number; alinear?: 'izq' | 'der' | 'centro'; maximo?: number };

/** Escribe una línea con su línea base en `y`. Devuelve el ancho pintado. */
function escribir(p: PDFPage, texto: string, x: number, y: number, o: OpcionesTexto): number {
  const esp = o.espaciado ?? 0;
  const t = o.maximo ? caber(texto, o.f, o.talla, o.maximo, esp) : limpio(texto, o.f);
  if (!t) return 0;
  const w = medir(t, o.f, o.talla, esp);
  const x0 = o.alinear === 'der' ? x - w : o.alinear === 'centro' ? x - w / 2 : x;
  if (esp) p.pushOperators(setCharacterSpacing(esp));
  p.drawText(t, { x: x0, y, size: o.talla, font: o.f, color: o.color ?? C.tinta });
  if (esp) p.pushOperators(setCharacterSpacing(0));
  return w;
}

/** Las etiquetas pequeñas en mayúsculas, espaciadas: el «ojo» de cada bloque. */
const ojo = (p: PDFPage, f: Fuentes, t: string, x: number, y: number, color: Color = C.oroLetra, alinear: 'izq' | 'der' = 'izq') =>
  escribir(p, t.toLocaleUpperCase('es-ES'), x, y, { f: f.medio, talla: 7.2, espaciado: 1.15, color, alinear });

type Trozo = { t: string; f: PDFFont; w: number };
type Renglon = { palabras: Trozo[][]; w: number; espacio: number };

/**
 * Parte un texto en renglones que caben en `ancho`. Lo que va entre `**` se
 * escribe en la fuente fuerte: así las cifras importantes saltan a la vista.
 */
function componer(texto: string, normal: PDFFont, fuerte: PDFFont, talla: number, ancho: number): Renglon[] {
  const palabras: Trozo[][] = [[]];
  let negrita = false;
  /* Se limpia el texto entero antes de partirlo: un emoji quitado no puede
     dejar una «palabra» vacía. Y la cifra no se separa de su «%» al final de
     un renglón: van unidas con un espacio que no se parte. */
  for (const parte of limpio(String(texto), normal).replace(/(\d) (%|€)/g, '$1\u00a0$2').split('**')) {
    const f = negrita ? fuerte : normal;
    parte.split(' ').forEach((pz, i) => {
      if (i > 0) palabras.push([]);
      const t = limpio(pz, f);
      if (t) palabras[palabras.length - 1].push({ t, f, w: f.widthOfTextAtSize(t, talla) });
    });
    negrita = !negrita;
  }
  const espacio = normal.widthOfTextAtSize(' ', talla);
  const renglones: Renglon[] = [];
  let actual: Renglon = { palabras: [], w: 0, espacio };
  for (const palabra of palabras.filter((x) => x.length)) {
    const w = palabra.reduce((s, x) => s + x.w, 0);
    const con = actual.palabras.length ? actual.w + espacio + w : w;
    if (con > ancho && actual.palabras.length) {
      renglones.push(actual);
      actual = { palabras: [palabra], w, espacio };
    } else actual = { palabras: [...actual.palabras, palabra], w: con, espacio };
  }
  if (actual.palabras.length) renglones.push(actual);
  return renglones;
}

function pintarRenglones(p: PDFPage, rs: Renglon[], x: number, yTop: number, talla: number, alto: number, color: Color, colorFuerte: Color, fuerte: PDFFont) {
  rs.forEach((r, i) => {
    let cx = x;
    const y = yTop - talla - i * alto;
    for (const palabra of r.palabras) {
      for (const tr of palabra) {
        p.drawText(tr.t, { x: cx, y, size: talla, font: tr.f, color: tr.f === fuerte ? colorFuerte : color });
        cx += tr.w;
      }
      cx += r.espacio;
    }
  });
}

/* ------------------------------------------------------------- formas */

/** Rectángulo con las esquinas redondeadas; `esquinas` = [arriba-izq, arriba-der, abajo-der, abajo-izq]. */
function caja(p: PDFPage, x: number, yTop: number, w: number, h: number, r: number, color: Color, esquinas: [boolean, boolean, boolean, boolean] = [true, true, true, true]) {
  if (w <= 0 || h <= 0) return;
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  const [a, b, c, d] = esquinas.map((e) => (e ? k : 0));
  const ruta = [
    `M${a},0`,
    `H${w - b}`,
    b ? `Q${w},0 ${w},${b}` : '',
    `V${h - c}`,
    c ? `Q${w},${h} ${w - c},${h}` : '',
    `H${d}`,
    d ? `Q0,${h} 0,${h - d}` : '',
    `V${a}`,
    a ? `Q0,0 ${a},0` : '',
    'Z',
  ].join(' ');
  p.drawSvgPath(ruta, { x, y: yTop, color });
}

const raya = (p: PDFPage, x1: number, y1: number, x2: number, y2: number, color: Color = C.linea, grosor = 0.6) =>
  p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: grosor, color });

/** La flecha de sube/baja, dibujada: las fuentes de texto no la traen. */
function triangulo(p: PDFPage, x: number, yBase: number, lado: number, arriba: boolean, color: Color) {
  const h = lado * 0.86;
  const ruta = arriba ? `M0,${h} L${lado / 2},0 L${lado},${h} Z` : `M0,0 L${lado},0 L${lado / 2},${h} Z`;
  p.drawSvgPath(ruta, { x, y: yBase + h, color });
}

/** La pastilla «▲ 23 %». Devuelve su ancho. */
function pastilla(p: PDFPage, f: Fuentes, c: Cambio, x: number, yBase: number): number {
  if (!c) return 0;
  const talla = 7.4;
  const texto = c.tipo === 'nuevo' ? 'nuevo' : c.tipo === 'igual' ? 'igual' : `${c.p} %`;
  const flecha = c.tipo === 'sube' || c.tipo === 'baja';
  const w = medir(texto, f.medio, talla) + (flecha ? 9 : 0) + 12;
  const [fondo, letra] = c.tipo === 'sube' ? [C.bienFondo, C.bien] : c.tipo === 'baja' ? [C.malFondo, C.mal] : [C.blanco, C.oroLetra];
  caja(p, x, yBase + 9, w, 13, 6.5, fondo);
  let cx = x + 6;
  if (flecha) {
    triangulo(p, cx, yBase + 0.6, 5, c.tipo === 'sube', letra);
    cx += 9;
  }
  escribir(p, texto, cx, yBase, { f: f.medio, talla, color: letra });
  return w;
}

/* ------------------------------------------------------------- bloques */

/**
 * Un bloque se mide para un ancho y luego se pinta en una posición (`yTop` es
 * su borde de arriba). Medir antes de pintar es lo que permite saber si cabe.
 */
type Medido = { alto: number; pintar: (p: PDFPage, x: number, yTop: number) => void };
type Bloque = (ancho: number) => Medido;

/** Varios bloques uno al lado de otro, con el alto del más alto. */
const fila =
  (bloques: Bloque[], hueco = 22): Bloque =>
  (ancho) => {
    const w = (ancho - hueco * (bloques.length - 1)) / bloques.length;
    const ms = bloques.map((b) => b(w));
    return {
      alto: Math.max(0, ...ms.map((m) => m.alto)),
      pintar: (p, x, y) => ms.forEach((m, i) => m.pintar(p, x + i * (w + hueco), y)),
    };
  };

/** Varios bloques uno encima de otro, que viajan juntos. */
const pila =
  (bloques: Bloque[], hueco = 14): Bloque =>
  (ancho) => {
    const ms = bloques.map((b) => b(ancho)).filter((m) => m.alto > 0);
    return {
      alto: ms.reduce((s, m) => s + m.alto, 0) + hueco * Math.max(0, ms.length - 1),
      pintar: (p, x, y) => {
        let cy = y;
        for (const m of ms) {
          m.pintar(p, x, cy);
          cy -= m.alto + hueco;
        }
      },
    };
  };

function parrafo(f: Fuentes, texto: string, o: { talla?: number; interlineado?: number; color?: Color; fuente?: PDFFont; maximo?: number } = {}): Bloque {
  const talla = o.talla ?? 10;
  const alto = talla * (o.interlineado ?? 1.55);
  const normal = o.fuente ?? f.texto;
  return (ancho) => {
    const rs = componer(texto, normal, f.medio, talla, Math.min(ancho, o.maximo ?? ancho));
    return {
      alto: rs.length ? talla * 1.25 + (rs.length - 1) * alto : 0,
      pintar: (p, x, y) => pintarRenglones(p, rs, x, y, talla, alto, o.color ?? C.tinta2, C.tinta, f.medio),
    };
  };
}

/** El título de un gráfico o una lista, con su nota a la derecha (o debajo si no cabe). */
function subtitulo(f: Fuentes, titulo: string, nota?: string): Bloque {
  return (ancho) => {
    const wt = medir(titulo, f.titulo, 15.5);
    const wn = nota ? medir(nota, f.texto, 8) : 0;
    const junto = !nota || wt + wn + 16 <= ancho;
    return {
      alto: junto ? 22 : 34,
      pintar: (p, x, y) => {
        escribir(p, titulo, x, y - 15, { f: f.titulo, talla: 15.5, color: C.tinta, maximo: ancho });
        if (nota) escribir(p, nota, junto ? x + ancho : x, junto ? y - 14 : y - 29, { f: f.texto, talla: 8, color: C.gris, alinear: junto ? 'der' : 'izq', maximo: ancho });
      },
    };
  };
}

type Cifra = { etiqueta: string; valor: string; nota?: string; cambio?: Cambio };

/** Cifras secundarias en una franja fina, separadas por rayas: ocupan la mitad que las baldosas. */
function franja(f: Fuentes, items: Cifra[]): Bloque {
  return (ancho) => {
    const w = ancho / items.length;
    return {
      alto: 44,
      pintar: (p, x, y) => {
        raya(p, x, y, x + ancho, y);
        raya(p, x, y - 44, x + ancho, y - 44);
        items.forEach((c, i) => {
          const cx = x + i * w + (i ? 14 : 0);
          if (i) raya(p, x + i * w, y - 9, x + i * w, y - 35);
          ojo(p, f, c.etiqueta, cx, y - 15);
          const wv = escribir(p, c.valor, cx, y - 35, { f: f.cifra, talla: 17, color: C.tinta, maximo: w - 20 });
          if (c.nota) escribir(p, c.nota, cx + wv + 6, y - 35, { f: f.texto, talla: 8, color: C.gris, maximo: w - wv - 26 });
        });
      },
    };
  };
}

/** Las cifras grandes, en baldosas color crema. */
function cifras(f: Fuentes, items: Cifra[], columnas = items.length): Bloque {
  const altoBaldosa = 72;
  const hueco = 10;
  return (ancho) => {
    const filas = Math.ceil(items.length / columnas);
    const w = (ancho - hueco * (columnas - 1)) / columnas;
    return {
      alto: filas * altoBaldosa + (filas - 1) * hueco,
      pintar: (p, x, y) => {
        items.forEach((c, i) => {
          const bx = x + (i % columnas) * (w + hueco);
          const by = y - Math.floor(i / columnas) * (altoBaldosa + hueco);
          caja(p, bx, by, w, altoBaldosa, 14, C.crema);
          const dentro = w - 28;
          escribir(p, c.etiqueta.toLocaleUpperCase('es-ES'), bx + 14, by - 19, { f: f.medio, talla: 7, espaciado: 1, color: C.oroLetra, maximo: dentro });
          let talla = 26;
          while (talla > 15 && medir(c.valor, f.cifra, talla) > dentro) talla -= 1;
          escribir(p, c.valor, bx + 14, by - 45, { f: f.cifra, talla, color: C.tinta, maximo: dentro });
          const wp = pastilla(p, f, c.cambio ?? null, bx + 14, by - 61);
          if (c.nota) escribir(p, c.nota, bx + 14 + (wp ? wp + 6 : 0), by - 60.5, { f: f.texto, talla: 8, color: C.gris, maximo: dentro - (wp ? wp + 6 : 0) });
        });
      },
    };
  };
}

/** Escala «redonda» para el eje: 1, 2, 5, 10, 20, 50… */
function techoBonito(max: number) {
  if (max <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * e >= max) return m * e;
  return 10 * e;
}

type OpcionesColumnas = {
  valores: number[];
  etiquetas: (string | null)[];
  linea?: number[];
  alto?: number;
  /** Escribir el valor encima de cada columna (para pocas columnas). */
  valoresEncima?: boolean;
  formato?: (n: number) => string;
  vacio?: string;
  /** Columnas apiladas: cada valor es la suma de varias series. */
  apiladas?: { series: number[][]; colores: Color[] };
};

/** Columnas verticales (y una línea encima, si se pide). */
function columnas(f: Fuentes, o: OpcionesColumnas): Bloque {
  const altoGrafica = o.alto ?? 150;
  const pie = 16;
  const formato = o.formato ?? ((n: number) => num(n));
  return (ancho) => ({
    alto: altoGrafica + pie + (o.valoresEncima ? 10 : 0),
    pintar: (p, x, y) => {
      const n = o.valores.length;
      const max = Math.max(0, ...o.valores, ...(o.linea ?? []));
      const techo = techoBonito(max);
      const eje = medir(formato(techo), f.texto, 7) + 8;
      const x0 = x + eje;
      const w = ancho - eje;
      const arriba = y - (o.valoresEncima ? 10 : 0);
      const base = arriba - altoGrafica;
      const marcas = techo >= 2 && Number.isInteger(techo / 2) ? [0, techo / 2, techo] : [0, techo];
      for (const m of marcas) {
        const ym = base + (m / techo) * altoGrafica;
        if (!max && m) continue;
        raya(p, x0, ym, x0 + w, ym, m === 0 ? hex('#cfc6b8') : C.linea, m === 0 ? 0.8 : 0.5);
        if (max) escribir(p, formato(m), x0 - 6, ym - 2.5, { f: f.texto, talla: 7, color: C.gris, alinear: 'der' });
      }
      if (!max) {
        escribir(p, o.vacio ?? 'Sin datos en este periodo', x0 + w / 2, base + altoGrafica / 2, { f: f.cursiva, talla: 13, color: C.gris, alinear: 'centro' });
      }
      const hueco = w / Math.max(1, n);
      const bw = Math.max(1, Math.min(22, hueco * 0.62));
      const mayor = o.valores.indexOf(max);
      o.valores.forEach((v, i) => {
        const bx = x0 + i * hueco + (hueco - bw) / 2;
        if (o.apiladas) {
          let acumulado = 0;
          o.apiladas.series.forEach((serie, s) => {
            const h = (serie[i] / techo) * altoGrafica;
            if (h <= 0) return;
            const ultima = o.apiladas!.series.slice(s + 1).every((x) => !x[i]);
            caja(p, bx, base + acumulado + h, bw, h, ultima ? Math.min(2.5, bw / 2) : 0, o.apiladas!.colores[s], [ultima, ultima, false, false]);
            acumulado += h;
          });
        } else if (v > 0) {
          const h = Math.max(1, (v / techo) * altoGrafica);
          caja(p, bx, base + h, bw, h, Math.min(2.5, bw / 2), i === mayor && n > 3 ? C.oroLetra : C.oroClaro, [true, true, false, false]);
        }
        if (o.valoresEncima && v > 0) {
          escribir(p, formato(v), bx + bw / 2, base + (v / techo) * altoGrafica + 4, { f: f.medio, talla: 7.5, color: C.tinta2, alinear: 'centro' });
        }
      });
      if (o.linea && max) {
        const puntos = o.linea.map((v, i) => [x0 + i * hueco + hueco / 2, base + (v / techo) * altoGrafica] as const);
        const ruta = puntos.map(([px, py], i) => `${i ? 'L' : 'M'}${(px - x0).toFixed(2)},${(arriba - py).toFixed(2)}`).join(' ');
        p.drawSvgPath(ruta, { x: x0, y: arriba, borderColor: C.tinta, borderWidth: 1.2 });
        if (n <= 45) for (const [px, py] of puntos) p.drawCircle({ x: px, y: py, size: 1.7, color: C.tinta });
      }
      /* Las etiquetas de abajo, sin pisarse: si una no cabe, se salta. */
      let libreDesde = -Infinity;
      o.etiquetas.forEach((et, i) => {
        if (!et) return;
        const cx = x0 + i * hueco + hueco / 2;
        const we = medir(et, f.texto, 7);
        const izq = Math.max(x0, Math.min(cx - we / 2, x0 + w - we));
        if (izq < libreDesde + 6) return;
        escribir(p, et, izq, base - 12, { f: f.texto, talla: 7, color: C.gris });
        libreDesde = izq + we;
      });
    },
  });
}

type Fila = { etiqueta: string; valor: number; detalle?: string };

/** Barras horizontales: etiqueta, cifra y su barra debajo. */
function barras(f: Fuentes, filas: Fila[], o: { total?: number; vacio: string; color?: Color; max?: number } = { vacio: '' }): Bloque {
  const altoFila = 25;
  return (ancho) => {
    if (!filas.length || !filas.some((x) => x.valor > 0)) {
      return { alto: 18, pintar: (p, x, y) => escribir(p, o.vacio, x, y - 12, { f: f.cursiva, talla: 11.5, color: C.gris, maximo: ancho }) };
    }
    const max = o.max ?? Math.max(1, ...filas.map((x) => x.valor));
    return {
      alto: filas.length * altoFila - 4,
      pintar: (p, x, y) => {
        filas.forEach((fl, i) => {
          const fy = y - i * altoFila;
          const pct = o.total ? ` · ${porcentaje(fl.valor, o.total)} %` : '';
          const derecha = fl.detalle ?? `${num(fl.valor)}${pct}`;
          const wd = medir(derecha, f.medio, 8.5);
          escribir(p, fl.etiqueta, x, fy - 9, { f: f.texto, talla: 9, color: C.tinta2, maximo: ancho - wd - 10 });
          escribir(p, derecha, x + ancho, fy - 9, { f: f.medio, talla: 8.5, color: C.tinta, alinear: 'der' });
          caja(p, x, fy - 14, ancho, 4.5, 2.25, C.pista);
          if (fl.valor > 0) caja(p, x, fy - 14, Math.max(3, (fl.valor / max) * ancho), 4.5, 2.25, o.color ?? C.oro);
        });
      },
    };
  };
}

/** Un reparto en una sola barra (móvil / ordenador / tablet), con su leyenda. */
function reparto(f: Fuentes, partes: Par[], vacio: string, colores: Color[] = SERIE): Bloque {
  const total = partes.reduce((s, x) => s + x[1], 0);
  const color = (k: string) => colores[partes.findIndex((x) => x[0] === k) % colores.length];
  const vivas = partes.filter((x) => x[1] > 0);
  return (ancho) => {
    if (!total) return { alto: 18, pintar: (p, x, y) => escribir(p, vacio, x, y - 12, { f: f.cursiva, talla: 11.5, color: C.gris }) };
    /* La leyenda se reparte en renglones según quepa. */
    const items = vivas.map(([k, v]) => ({ texto: `${k} · ${porcentaje(v, total)} % (${num(v)})`, color: color(k) }));
    const renglones: { texto: string; color: Color; x: number }[][] = [[]];
    let cx = 0;
    for (const it of items) {
      const w = medir(it.texto, f.texto, 8.5) + 16;
      if (cx + w > ancho && cx > 0) {
        renglones.push([]);
        cx = 0;
      }
      renglones[renglones.length - 1].push({ ...it, x: cx });
      cx += w + 14;
    }
    return {
      alto: 14 + 10 + renglones.length * 15,
      pintar: (p, x, y) => {
        let bx = x;
        vivas.forEach(([k, v], i) => {
          const w = (v / total) * ancho;
          const primera = i === 0;
          const ultima = i === vivas.length - 1;
          caja(p, bx, y, w, 14, 7, color(k), [primera, ultima, ultima, primera]);
          if (!primera) raya(p, bx, y, bx, y - 14, C.blanco, 1.4);
          bx += w;
        });
        renglones.forEach((r, j) => {
          const ly = y - 14 - 10 - j * 15 - 8;
          for (const it of r) {
            p.drawCircle({ x: x + it.x + 4, y: ly + 3, size: 3.6, color: it.color });
            escribir(p, it.texto, x + it.x + 12, ly, { f: f.texto, talla: 8.5, color: C.tinta2 });
          }
        });
      },
    };
  };
}

/** Dos barras en una (empezadas y terminadas de cada clase). */
function barrasDobles(f: Fuentes, filas: { etiqueta: string; a: number; b: number }[], nombres: [string, string], vacio: string): Bloque {
  const altoFila = 27;
  return (ancho) => {
    if (!filas.length) return { alto: 18, pintar: (p, x, y) => escribir(p, vacio, x, y - 12, { f: f.cursiva, talla: 11.5, color: C.gris }) };
    const max = Math.max(1, ...filas.map((x) => x.a));
    return {
      alto: filas.length * altoFila + 14,
      pintar: (p, x, y) => {
        filas.forEach((fl, i) => {
          const fy = y - i * altoFila;
          const derecha = `${num(fl.a)} ${nombres[0]} · ${num(fl.b)} ${nombres[1]}`;
          const wd = medir(derecha, f.texto, 8.2);
          escribir(p, fl.etiqueta, x, fy - 9, { f: f.medio, talla: 8.8, color: C.tinta2, maximo: ancho - wd - 12 });
          escribir(p, derecha, x + ancho, fy - 9, { f: f.texto, talla: 8.2, color: C.gris, alinear: 'der' });
          caja(p, x, fy - 14.5, ancho, 6, 3, C.pista);
          if (fl.a) caja(p, x, fy - 14.5, Math.max(3, (fl.a / max) * ancho), 6, 3, C.oroPalido);
          if (fl.b) caja(p, x, fy - 14.5, Math.max(3, (fl.b / max) * ancho), 6, 3, C.oro);
        });
        const ly = y - filas.length * altoFila - 6;
        p.drawCircle({ x: x + 4, y: ly + 3, size: 3.6, color: C.oroPalido });
        const w1 = escribir(p, nombres[0].charAt(0).toUpperCase() + nombres[0].slice(1), x + 12, ly, { f: f.texto, talla: 8.2, color: C.tinta2 });
        p.drawCircle({ x: x + 12 + w1 + 18, y: ly + 3, size: 3.6, color: C.oro });
        escribir(p, nombres[1].charAt(0).toUpperCase() + nombres[1].slice(1), x + 12 + w1 + 26, ly, { f: f.texto, talla: 8.2, color: C.tinta2 });
      },
    };
  };
}

type ItemLeyenda = { texto: string; color: Color; raya?: boolean };

/** Pinta una leyenda (puntos o rayas de color con su nombre) y devuelve su ancho. */
function pintarLeyenda(p: PDFPage, f: Fuentes, items: ItemLeyenda[], x: number, yBase: number): number {
  let cx = x;
  items.forEach((it, i) => {
    if (it.raya) raya(p, cx, yBase + 3, cx + 12, yBase + 3, it.color, 1.4);
    else caja(p, cx + 2, yBase + 7, 8, 8, 2, it.color);
    cx += 16 + escribir(p, it.texto, cx + 16, yBase, { f: f.texto, talla: 8, color: C.tinta2 }) + (i < items.length - 1 ? 16 : 0);
  });
  return cx - x;
}
const anchoLeyenda = (f: Fuentes, items: ItemLeyenda[]) => items.reduce((s, it, i) => s + 16 + medir(it.texto, f.texto, 8) + (i < items.length - 1 ? 16 : 0), 0);

/** El título de una gráfica con su leyenda a la derecha, en la misma línea. */
function subtituloConLeyenda(f: Fuentes, titulo: string, items: ItemLeyenda[]): Bloque {
  return (ancho) => ({
    alto: 22,
    pintar: (p, x, y) => {
      escribir(p, titulo, x, y - 15, { f: f.titulo, talla: 15.5, color: C.tinta, maximo: ancho - anchoLeyenda(f, items) - 16 });
      pintarLeyenda(p, f, items, x + ancho - anchoLeyenda(f, items), y - 14);
    },
  });
}

/** «Qué significa» y «Qué haría yo»: las dos cajas que explican cada sección. */
function explicacion(f: Fuentes, tipo: 'significa' | 'haria', items: string[]): Bloque {
  const talla = 9.8;
  const alto = talla * 1.56;
  const relleno = 16;
  const sangria = tipo === 'haria' ? 22 : 0;
  const lista = items.length ? items : ['Con estos números no cambiaría nada por ahora.'];
  return (ancho) => {
    const dentro = ancho - relleno * 2 - sangria;
    const partes = lista.map((t) => componer(t, f.texto, f.medio, talla, dentro));
    const altoTexto = partes.reduce((s, rs) => s + talla * 1.25 + (rs.length - 1) * alto, 0) + (partes.length - 1) * 9;
    const total = relleno + 12 + 12 + altoTexto + relleno - 2;
    return {
      alto: total,
      pintar: (p, x, y) => {
        caja(p, x, y, ancho, total, 16, tipo === 'haria' ? C.cremaOro : C.crema);
        ojo(p, f, tipo === 'haria' ? 'Qué haría yo' : 'Qué significa', x + relleno, y - relleno - 7, tipo === 'haria' ? C.oroLetra : C.gris);
        let cy = y - relleno - 24;
        partes.forEach((rs, i) => {
          if (tipo === 'haria') {
            p.drawCircle({ x: x + relleno + 7.5, y: cy - talla + 3.2, size: 7.5, color: C.oro });
            escribir(p, String(i + 1), x + relleno + 7.5, cy - talla + 0.4, { f: f.medio, talla: 7.8, color: C.blanco, alinear: 'centro' });
          }
          pintarRenglones(p, rs, x + relleno + sangria, cy, talla, alto, C.tinta2, C.tinta, f.medio);
          cy -= talla * 1.25 + (rs.length - 1) * alto + 9;
        });
      },
    };
  };
}

/* Los consejos de cada sección, del más urgente al que menos. */
const explicar = (f: Fuentes, t: Textos): Paso[] => [
  [explicacion(f, 'significa', t.significa), 12],
  [explicacion(f, 'haria', [...t.haria].sort((x, y) => y.prioridad - x.prioridad).map((c) => c.texto)), 12],
];

/* ------------------------------------------------------------- el lienzo */

type Entrada = { numero: string; titulo: string; pagina: number };

/** Las páginas y el punto por donde se va escribiendo. */
class Lienzo {
  pagina!: PDFPage;
  y = TECHO;
  grupo = '';
  indice: Entrada[] = [];
  constructor(
    readonly doc: PDFDocument,
    readonly f: Fuentes,
    readonly etiqueta: string
  ) {}

  nueva() {
    this.pagina = this.doc.addPage(A4);
    this.y = TECHO;
    const p = this.pagina;
    ojo(p, this.f, `Informe Divine · ${this.etiqueta}`, MARGEN, ALTO - 42, C.oroLetra);
    if (this.grupo) escribir(p, this.grupo, ANCHO - MARGEN, ALTO - 42, { f: this.f.texto, talla: 8, color: C.gris, alinear: 'der' });
    raya(p, MARGEN, ALTO - 52, ANCHO - MARGEN, ALTO - 52);
  }

  /** Pone un bloque; si no cabe en lo que queda, en la página siguiente. */
  poner(b: Bloque, despues = 20) {
    const m = b(UTIL);
    if (m.alto > this.y - SUELO && this.y < TECHO) this.nueva();
    m.pintar(this.pagina, MARGEN, this.y);
    this.y -= m.alto + despues;
  }

  /**
   * Una sección entera: su cabecera y sus bloques. Antes de empezar se mide
   * entera para decidir dónde arranca:
   *   · si cabe en lo que queda de página, sigue debajo de la anterior;
   *   · si no cabe pero sí en una página limpia, empieza en página nueva;
   *   · si es más larga que una página, sigue aquí si queda casi media página.
   * Así no quedan páginas con un recuadro solo y el resto en blanco, ni
   * secciones partidas sin necesidad.
   */
  seccion(numero: string, grupo: string, titulo: string, entradilla: string, pasos: Paso[]) {
    this.grupo = grupo;
    const f = this.f;
    const cabecera = pila(
      [
        () => ({ alto: 10, pintar: (p, x, y) => ojo(p, f, `${numero} · ${grupo}`, x, y - 7) }),
        () => ({ alto: 32, pintar: (p, x, y) => escribir(p, titulo, x, y - 27, { f: f.titulo, talla: 31, color: C.tinta }) }),
        parrafo(f, entradilla, { talla: 11, color: C.gris, maximo: 440, interlineado: 1.5 }),
      ],
      8
    );
    const todos: Paso[] = [[cabecera, 22], ...pasos];
    // El aire debajo del último bloque no ocupa sitio en la página.
    const alto = todos.reduce((s, [b, despues = 20], i) => s + b(UTIL).alto + (i < todos.length - 1 ? despues : 0), 0);
    const pagina = TECHO - SUELO;
    const separador = 42;
    if (this.y < TECHO) {
      const queda = this.y - SUELO - separador;
      if (alto <= queda || (alto > pagina && queda >= pagina * 0.45)) {
        this.y -= 12;
        raya(this.pagina, MARGEN, this.y, ANCHO - MARGEN, this.y);
        this.y -= separador - 12;
      } else this.nueva();
    }
    this.indice.push({ numero, titulo, pagina: this.doc.getPageCount() });
    for (const [b, despues] of todos) this.poner(b, despues);
  }
}

/** Un bloque de una sección y el aire que deja debajo. */
type Paso = [Bloque, number?];

/* ------------------------------------------------------------- utilidades */

const DIA_SEMANA_CORTO = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'short' });
const pares = (lista: Par[], n: number, nombre: (k: string) => string = (k) => k): Fila[] => lista.slice(0, n).map(([k, v]) => ({ etiqueta: nombre(k), valor: v }));
const total = (lista: Par[]) => lista.reduce((s, x) => s + x[1], 0);

/** Las etiquetas del eje de días: todas si son pocas; si no, unas cuantas contando desde hoy. */
function etiquetasDias(dias: string[]): (string | null)[] {
  const n = dias.length;
  if (n <= 10) return dias.map((d) => `${DIA_SEMANA_CORTO.format(new Date(`${d}T12:00:00Z`)).replace('.', '')} ${Number(d.slice(8))}`);
  const paso = Math.ceil(n / 7);
  return dias.map((d, i) => ((n - 1 - i) % paso === 0 ? fechaCorta(d) : null));
}

/** Para periodos largos, la serie diaria se junta por semanas (de lunes a domingo). */
function porSemanas(dias: string[], valores: number[][]): { dias: string[]; valores: number[][] } {
  const claves: string[] = [];
  const sumas = valores.map(() => [] as number[]);
  dias.forEach((d, i) => {
    const f = new Date(`${d}T12:00:00Z`);
    f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
    const k = f.toISOString().slice(0, 10);
    if (claves[claves.length - 1] !== k) {
      claves.push(k);
      sumas.forEach((s) => s.push(0));
    }
    valores.forEach((v, j) => (sumas[j][sumas[j].length - 1] += v[i]));
  });
  return { dias: claves, valores: sumas };
}

/* ------------------------------------------------------------- el informe */

/**
 * Pinta el informe y devuelve los bytes del PDF. `d` ya viene sumado de
 * lib/informe-datos.ts: aquí no hay ninguna consulta.
 */
export async function pdfDelInforme(d: DatosInforme): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const sobre = sobrePeriodo(d.periodo);
  const generado = new Date(d.generado);
  doc.setTitle(`Informe Divine · ${sobre.etiqueta}`, { showInWindowTitleBar: true });
  doc.setAuthor('Sorela Caro · Técnica Divine');
  doc.setSubject('Informe de métricas de la web y la plataforma');
  doc.setCreator('Plataforma Técnica Divine');
  doc.setProducer('Plataforma Técnica Divine');
  doc.setLanguage('es-ES');
  doc.setCreationDate(generado);

  const [f, logo] = await Promise.all([cargarFuentes(doc), leerLogo().then((b) => (b ? doc.embedPng(b).catch(() => null) : null))]);
  const a = analizar(d);
  const tx = textosDe(d, a);
  const L = new Lienzo(doc, f, sobre.etiqueta);
  const todo = d.periodo === 'todo';
  const w = d.web;
  const t = w.totales;
  const ant = w.anteriores;
  const c = d.contactos;
  /* Sin visitas, las gráficas de la web se quedan bajitas: un hueco grande vacío no dice nada. */
  const hayWeb = t.visitas > 0;
  const altoWeb = (alto: number) => (hayWeb ? alto : 56);

  /* ================= Portada ================= */
  const portada = doc.addPage(A4);
  portada.drawRectangle({ x: 0, y: 0, width: ANCHO, height: ALTO, color: C.noche });
  if (logo) {
    const lw = 168;
    const lh = (logo.height / logo.width) * lw;
    portada.drawImage(logo, { x: (ANCHO - lw) / 2, y: ALTO - 82 - lh, width: lw, height: lh });
  }
  const px = 64;
  ojo(portada, f, 'Informe de métricas', px, 590, C.oroNoche);
  escribir(portada, 'Cómo va tu web', px, 532, { f: f.titulo, talla: 54, color: C.cremaNoche });
  escribir(portada, 'y tu plataforma', px, 494, { f: f.cursiva, talla: 34, color: C.oroNoche });
  escribir(portada, sobre.etiqueta, px, 446, { f: f.medio, talla: 12.5, color: C.cremaNoche });
  /* «Desde el inicio» empieza en lo primero que haya: el primer contacto o el primer día medido. */
  const inicio = [c.primero, d.desdeMedidor, d.rango.desde].filter((x): x is string => !!x).sort()[0];
  const rangoTexto = todo
    ? `Desde el ${fechaLarga(inicio)} hasta el ${fechaLarga(d.hoy)}`
    : deHasta(d.rango.desde, d.rango.hasta).replace(/^./, (x) => x.toUpperCase());
  escribir(portada, rangoTexto, px, 428, { f: f.texto, talla: 10.5, color: C.cremaSuave });

  /* Tres cifras para abrir. */
  const portadaCifras: [string, number][] = [
    ['Personas en la web', t.personas],
    ['Visitas', t.visitas],
    [todo ? 'Contactos' : 'Contactos nuevos', todo ? c.total : c.nuevos],
  ];
  const anchoCifra = (ANCHO - px * 2) / 3;
  portadaCifras.forEach(([k, v], i) => {
    const cx = px + i * anchoCifra;
    if (i) raya(portada, cx - 14, 392, cx - 14, 336, C.nocheLinea, 0.8);
    escribir(portada, num(v), cx, 352, { f: f.cifra, talla: 36, color: C.cremaNoche });
    ojo(portada, f, k, cx, 336, C.cremaSuave);
  });
  raya(portada, px, 302, ANCHO - px, 302, C.oroNoche, 0.6);
  ojo(portada, f, 'En este informe', px, 278, C.oroNoche);
  /* El índice se escribe al final, cuando ya se sabe en qué página cae cada sección. */

  escribir(portada, `Preparado para Sorela Caro · Técnica Divine`, px, 62, { f: f.texto, talla: 8.5, color: C.cremaSuave });
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(generado);
  escribir(portada, `Generado el ${fechaLarga(d.hoy)} a las ${hora}`, ANCHO - px, 62, { f: f.texto, talla: 8.5, color: C.cremaSuave, alinear: 'der' });
  if (d.prueba) {
    const wpr = medir('DATOS DE PRUEBA', f.medio, 7.2, 1.15) + 18;
    caja(portada, ANCHO - px - wpr, 610, wpr, 16, 8, hex('#4a2a1f'));
    ojo(portada, f, 'Datos de prueba', ANCHO - px - 9, 599, hex('#f1c3ae'), 'der');
  }

  /* ================= Resumen ================= */
  L.grupo = 'Resumen';
  L.nueva();
  L.indice.push({ numero: '—', titulo: 'En una página', pagina: doc.getPageCount() });
  L.poner(
    pila(
      [
        () => ({ alto: 10, pintar: (p, x, y) => ojo(p, f, 'Resumen', x, y - 7) }),
        () => ({ alto: 32, pintar: (p, x, y) => escribir(p, 'En una página', x, y - 27, { f: f.titulo, talla: 31 }) }),
        parrafo(
          f,
          todo
            ? `Todo lo que ha pasado desde el principio. Las visitas de la web se miden desde el ${d.desdeMedidor ? fechaLarga(d.desdeMedidor) : 'día en que se instaló el medidor'}; contactos, cuentas y acuerdos están completos desde el primer día.`
            : `Lo que ha pasado ${deHasta(d.rango.desde, d.rango.hasta)}, comparado con ${sobre.anterior} (${deHasta(d.anterior!.desde, d.anterior!.hasta)}). Las flechas dicen si sube o baja.`,
          { talla: 11, color: C.gris, maximo: 450 }
        ),
      ],
      8
    ),
    22
  );
  L.poner(
    cifras(
      f,
      [
        { etiqueta: 'Personas', valor: num(t.personas), cambio: cambio(t.personas, ant?.personas), nota: 'distintas' },
        { etiqueta: 'Visitas', valor: num(t.visitas), cambio: cambio(t.visitas, ant?.visitas), nota: `${decimal(a.mediaDia)} al día` },
        { etiqueta: 'Páginas vistas', valor: num(t.vistas), cambio: cambio(t.vistas, ant?.vistas) },
        todo
          ? { etiqueta: 'Contactos', valor: num(c.total), nota: 'desde el principio' }
          : { etiqueta: 'Contactos nuevos', valor: num(c.nuevos), cambio: cambio(c.nuevos, c.nuevosAntes) },
        todo
          ? { etiqueta: 'Cuentas', valor: num(d.cuentas.total), nota: `${num(d.cuentas.conCurso)} con la formación` }
          : { etiqueta: 'Cuentas nuevas', valor: num(d.cuentas.nuevas), cambio: cambio(d.cuentas.nuevas, d.cuentas.nuevasAntes) },
        { etiqueta: 'Lista de espera', valor: num(d.espera.total), nota: d.espera.nuevas ? `${num(d.espera.nuevas)} nuevas` : 'personas' },
      ],
      3
    ),
    24
  );
  L.poner(subtitulo(f, 'Lo más importante'), 8);
  for (const s of destacados(d, a)) {
    L.poner(
      (ancho) => {
        const m = parrafo(f, s, { talla: 10.5 })(ancho - 16);
        return {
          alto: m.alto,
          pintar: (p, x, y) => {
            p.drawCircle({ x: x + 3, y: y - 7, size: 2.4, color: C.oro });
            m.pintar(p, x + 16, y);
          },
        };
      },
      8
    );
  }
  L.y -= 12;
  L.poner(explicacion(f, 'haria', primeros(tx, 3).map((x: Consejo) => x.texto)), 16);
  if (d.prueba)
    L.poner(
      parrafo(f, '**Ojo: datos de prueba.** Este informe se ha sacado desde el ordenador de pruebas, así que las visitas y los vídeos de la web son de prueba. Contactos, cuentas y comunidad sí son los reales.', {
        talla: 8.8,
        color: C.mal,
      })
    );

  /* ================= 01 Visitas ================= */
  {
    const ppv = a.paginasPorVisita;
    const ppvAntes = ant && ant.visitas ? ant.vistas / ant.visitas : ant ? 0 : null;
    const largo = w.serie.length > 92;
    const dias = w.serie.map((x) => x.dia);
    const s = largo ? porSemanas(dias, [w.serie.map((x) => x.visitas), w.serie.map((x) => x.personas)]) : { dias, valores: [w.serie.map((x) => x.visitas), w.serie.map((x) => x.personas)] };
    L.seccion('01', 'Tu web', 'Visitas', 'Cuánta gente ha entrado en la web y cómo ha ido cada día.', [
      [
        cifras(f, [
          { etiqueta: 'Personas', valor: num(t.personas), cambio: cambio(t.personas, ant?.personas) },
          { etiqueta: 'Visitas', valor: num(t.visitas), cambio: cambio(t.visitas, ant?.visitas) },
          { etiqueta: 'Páginas vistas', valor: num(t.vistas), cambio: cambio(t.vistas, ant?.vistas) },
          { etiqueta: 'Páginas por visita', valor: unDecimal(ppv), cambio: ppvAntes === null ? null : cambio(Math.round(ppv * 10), Math.round(ppvAntes * 10)) },
        ]),
        16,
      ],
      [
        pila([
          subtituloConLeyenda(f, largo ? 'Visitas por semana' : 'Visitas por día', [
            { texto: 'Visitas', color: C.oroClaro },
            { texto: 'Personas', color: C.tinta, raya: true },
          ]),
          columnas(f, {
            valores: s.valores[0],
            linea: s.valores[1],
            etiquetas: largo ? s.dias.map((x, i) => (i % Math.ceil(s.dias.length / 7) === 0 ? fechaCorta(x) : null)) : etiquetasDias(s.dias),
            alto: altoWeb(110),
            vacio: 'Todavía no hay visitas en este periodo',
          }),
        ], 10),
        16,
      ],
      [
        franja(f, [
          { etiqueta: 'Media al día', valor: decimal(a.mediaDia), nota: 'visitas' },
          { etiqueta: 'Tu mejor día', valor: a.mejor ? fechaCorta(a.mejor.dia) : '—', nota: a.mejor ? `${num(a.mejor.visitas)} visitas` : 'sin visitas aún' },
          { etiqueta: 'Días sin visitas', valor: num(a.sinVisitas), nota: `de ${num(a.dias)}` },
        ]),
        16,
      ],
      ...explicar(f, tx.visitas),
    ]);
  }

  /* ================= 02 Cuándo ================= */
  L.seccion('02', 'Tu web', 'Cuándo te visitan', 'Qué días de la semana y a qué horas entra más gente: sirve para elegir cuándo publicar.', [
    [
      pila([
        subtitulo(f, 'Qué día de la semana', 'Media de visitas de cada día'),
        columnas(f, {
          valores: a.semana.map((v) => Math.round(v * 10) / 10),
          etiquetas: DIAS_SEMANA.map((x) => x.slice(0, 3)),
          alto: altoWeb(100),
          valoresEncima: true,
          formato: (n) => decimal(n),
          vacio: 'Todavía no hay visitas',
        }),
      ]),
    ],
    [
      pila([
        subtitulo(f, 'A qué hora', 'Páginas vistas por hora · hora de España'),
        columnas(f, {
          valores: a.horas,
          etiquetas: a.horas.map((_, h) => (h % 3 === 0 ? `${h} h` : null)),
          alto: altoWeb(100),
          vacio: 'Todavía no hay visitas',
        }),
      ]),
    ],
    ...explicar(f, tx.cuando),
  ]);

  /* ================= 03 Cómo te encuentran ================= */
  L.seccion('03', 'Tu web', 'Cómo te encuentran', 'Desde dónde llega la gente a tu web y por qué página entra.', [
    [
      fila([
        pila([subtitulo(f, 'De dónde llegan'), barras(f, pares(w.origenes, 8), { total: a.totalOrigen, vacio: 'Aún no hay visitas.' })]),
        pila([subtitulo(f, 'Por qué página entran'), barras(f, pares(w.entradas, 8, nombreDePagina), { total: total(w.entradas), vacio: 'Aún no hay visitas.' })]),
      ]),
      24,
    ],
    ...explicar(f, tx.llegan),
  ]);

  /* ================= 04 Quién te ve ================= */
  L.seccion('04', 'Tu web', 'Quién te ve', 'Desde qué países y ciudades te visitan, y con qué aparato.', [
    [
      fila([
        pila([subtitulo(f, 'Países'), barras(f, pares(w.paises, 8, nombreDePais), { total: a.totalPaises, vacio: 'Aún no hay países.' })]),
        pila([subtitulo(f, 'Ciudades'), barras(f, pares(w.ciudades, 8, nombreDeCiudad), { total: total(w.ciudades), vacio: 'Aún no hay ciudades.' })]),
      ]),
      24,
    ],
    [pila([subtitulo(f, 'Con qué te ven', a.totalDispositivos ? `${a.movil} % desde el móvil` : undefined), reparto(f, w.dispositivos, 'Aún no hay aparatos.')]), 24],
    ...explicar(f, tx.quien),
  ]);

  /* ================= 05 Qué miran ================= */
  L.seccion('05', 'Tu web', 'Qué páginas miran', 'Las páginas que más se abren. Cuenta cada vez que se abre una, aunque sea la misma persona.', [
    [barras(f, pares(w.rutas, 10, nombreDePagina), { total: a.totalRutas, vacio: 'Aún no hay páginas vistas.' }), 24],
    ...explicar(f, tx.miran),
  ]);

  /* ================= 06 Vídeos ================= */
  L.seccion('06', 'Tu web', 'Vídeos de la web', 'Cuánta gente pone cada vídeo con sonido y hasta dónde lo ve. Desde que se empezó a medir.', [
    [tablaVideos(f, d.videos.slice(0, 8)), 24],
    ...explicar(f, tx.videos),
  ]);

  /* ================= 07 Contactos ================= */
  {
    const dias = w.serie.map((x) => x.dia);
    const sem = d.historia?.semanas ?? [];
    L.seccion('07', 'Tus personas', 'Contactos', 'Quién te ha dejado sus datos, qué busca y cómo está tu lista.', [
      [
        cifras(f, [
          todo
            ? { etiqueta: 'En tu lista', valor: num(c.total), nota: 'desde el principio' }
            : { etiqueta: 'Contactos nuevos', valor: num(c.nuevos), cambio: cambio(c.nuevos, c.nuevosAntes) },
          todo
            ? { etiqueta: 'Últimas 4 semanas', valor: num(sem.slice(-4).reduce((s, x) => s + x.contactos, 0)), nota: 'contactos nuevos' }
            : { etiqueta: 'En tu lista', valor: num(c.total), nota: 'en total' },
          { etiqueta: 'Por atender', valor: num(c.porAtender), nota: 'nadie les ha escrito' },
          { etiqueta: 'Esperan +3 días', valor: num(c.porAtenderViejos), nota: c.porAtenderViejos ? 'escríbeles primero' : 'ninguna' },
        ]),
      ],
      todo
        ? [
            pila([
              subtitulo(f, 'Contactos nuevos por semana', 'Desde el primero'),
              columnas(f, { valores: sem.map((x) => x.contactos), etiquetas: sem.map((x, i) => (i % Math.max(1, Math.ceil(sem.length / 7)) === 0 ? fechaCorta(x.semana) : null)), alto: 110, vacio: 'Aún no hay contactos' }),
            ]),
          ]
        : [
            pila([
              subtitulo(f, 'Contactos nuevos por día'),
              columnas(f, { valores: c.porDia, etiquetas: etiquetasDias(dias), alto: c.nuevos ? 100 : 56, valoresEncima: dias.length <= 31, vacio: 'Nadie ha dejado sus datos en este periodo' }),
            ]),
          ],
      [
        fila([
          pila([subtitulo(f, 'Qué buscan'), barras(f, pares(c.porTipo, 6), { total: total(c.porTipo), vacio: 'Sin contactos nuevos.' })]),
          pila([subtitulo(f, 'Por dónde entraron'), barras(f, pares(c.porOrigen, 6), { total: total(c.porOrigen), vacio: 'Sin contactos nuevos.' })]),
        ]),
        22,
      ],
      [
        fila([
          pila([subtitulo(f, 'Desde dónde llegaron'), barras(f, pares(c.porFuente, 6), { total: total(c.porFuente), vacio: 'Sin contactos nuevos.' })]),
          pila([subtitulo(f, 'Cómo está tu lista', 'Todos, no solo los nuevos'), barras(f, pares(c.porEstado, 5), { total: c.total, vacio: 'Tu lista está vacía.', color: C.tinta2 })]),
        ]),
        24,
      ],
      ...explicar(f, tx.contactos),
    ]);
  }

  /* ================= 08 Lista de espera ================= */
  {
    const faltan = Math.max(0, Math.ceil((Date.parse(d.espera.apertura) - generado.getTime()) / 86_400_000));
    L.seccion('08', 'Tus personas', 'Lista de espera', 'Quién espera la apertura de la Comunidad Divine.', [
      [
        cifras(f, [
          { etiqueta: 'En la lista', valor: num(d.espera.total), nota: 'sin repetir' },
          { etiqueta: todo ? 'Nuevas' : 'Nuevas en el periodo', valor: num(d.espera.nuevas) },
          { etiqueta: 'Para la apertura', valor: faltan ? `${faltan} ${faltan === 1 ? 'día' : 'días'}` : 'Abierta', nota: fechaLarga(d.espera.apertura.slice(0, 10)) },
        ]),
      ],
      ...explicar(f, tx.espera),
    ]);
  }

  /* ================= 09 Cuentas y acuerdos ================= */
  {
    const cu = d.cuentas;
    const ac = d.acuerdos;
    L.seccion('09', 'Tus personas', 'Cuentas y acuerdos', 'Quién puede entrar en la plataforma, con qué acceso, y los acuerdos de confidencialidad firmados.', [
      [
        cifras(
          f,
          [
            todo ? { etiqueta: 'Cuentas', valor: num(cu.total) } : { etiqueta: 'Cuentas nuevas', valor: num(cu.nuevas), cambio: cambio(cu.nuevas, cu.nuevasAntes), nota: `${num(cu.total)} en total` },
            { etiqueta: 'Con la formación', valor: num(cu.conCurso), nota: 'acceso al curso' },
            { etiqueta: 'Con la Comunidad', valor: num(cu.conComunidad), nota: 'membresía' },
            todo ? { etiqueta: 'Acuerdos firmados', valor: num(ac.total) } : { etiqueta: 'Acuerdos firmados', valor: num(ac.nuevos), cambio: cambio(ac.nuevos, ac.nuevosAntes), nota: `${num(ac.total)} en total` },
            { etiqueta: 'Por aprobar', valor: num(ac.porAprobar), nota: ac.porAprobar ? 'esperan el dossier' : 'todo al día' },
            { etiqueta: 'Descargas del dossier', valor: num(ac.descargas) },
          ],
          3
        ),
      ],
      ...explicar(f, tx.cuentas),
    ]);
  }

  /* ================= 10 El aula ================= */
  {
    const au = d.aula;
    L.seccion(
      '10',
      'Tu plataforma',
      'El aula',
      'Cómo avanzan tus alumnas en las clases del curso. Sin nombres: solo cuántas.',
      au
        ? [
            [
              cifras(f, [
                { etiqueta: 'Con acceso', valor: num(au.conAcceso), nota: `${num(au.totalClases)} clases publicadas` },
                { etiqueta: 'Activas', valor: num(au.activas), nota: 'vieron alguna clase' },
                { etiqueta: 'Clases terminadas', valor: num(au.terminadas), nota: 'en el periodo' },
                { etiqueta: 'Progreso medio', valor: `${au.progresoMedio} %`, nota: 'del curso' },
              ]),
            ],
            [
              pila([
                subtitulo(f, 'Por dónde van'),
                reparto(
                  f,
                  [
                    ['Sin empezar', au.tramos.sinEmpezar],
                    ['Menos de la mitad', au.tramos.empezando],
                    ['Más de la mitad', au.tramos.mitad],
                    ['Curso terminado', au.tramos.terminado],
                  ],
                  'Todavía no hay alumnas con acceso.',
                  // De claro a oscuro según avanzan: se lee como una progresión.
                  [hex('#e3d6bd'), hex('#c9a46b'), hex('#8a6a32'), hex('#3e3831')]
                ),
              ]),
              24,
            ],
            [
              pila([
                subtitulo(f, 'Clase a clase', 'Desde siempre'),
                barrasDobles(f, au.lecciones.map((l) => ({ etiqueta: l.titulo, a: l.empezadas, b: l.completadas })), ['empezadas', 'terminadas'], 'Todavía no hay clases publicadas.'),
              ]),
              24,
            ],
            ...explicar(f, tx.aula),
          ]
        : [[parrafo(f, 'No se ha podido leer el aula para este informe.', { color: C.gris })], ...explicar(f, tx.aula)]
    );
  }

  /* ================= 11 Comunidad ================= */
  {
    const co = d.comunidad;
    L.seccion(
      '11',
      'Tu plataforma',
      'La comunidad',
      'Lo que se mueve en el espacio de las terapeutas: publicaciones, respuestas y «me gusta».',
      co
        ? [
            [
              cifras(
                f,
                [
                  { etiqueta: 'Publicaciones', valor: num(co.publicaciones), cambio: cambio(co.publicaciones, co.publicacionesAntes) },
                  { etiqueta: 'Respuestas', valor: num(co.respuestas), cambio: cambio(co.respuestas, co.respuestasAntes), nota: co.deSorela ? `${num(co.deSorela)} ${co.deSorela === 1 ? 'tuya' : 'tuyas'}` : undefined },
                  { etiqueta: 'Me gusta', valor: num(co.meGusta), nota: 'en lo publicado' },
                  { etiqueta: 'Terapeutas activas', valor: num(co.participantes), cambio: cambio(co.participantes, co.participantesAntes), nota: `de ${num(co.miembros)}` },
                  { etiqueta: 'Sin respuesta', valor: num(co.sinRespuesta), nota: co.sinRespuesta ? 'esperan a alguien' : 'ninguna' },
                  { etiqueta: 'Desde el principio', valor: num(co.totalPublicaciones), nota: 'publicaciones' },
                ],
                3
              ),
            ],
            ...(co.porCategoria.length ? [[pila([subtitulo(f, 'De qué hablan'), barras(f, pares(co.porCategoria, 6), { total: total(co.porCategoria), vacio: '' })]), 24] as Paso] : []),
            ...explicar(f, tx.comunidad),
          ]
        : [[parrafo(f, 'No se ha podido leer la comunidad para este informe.', { color: C.gris })], ...explicar(f, tx.comunidad)]
    );
  }

  /* ================= 12 Correos ================= */
  {
    const cr = d.correos;
    L.seccion(
      '12',
      'Tu plataforma',
      'Correos',
      'Los correos que han salido de la web, automáticos y campañas.',
      cr
        ? [
            [
              cifras(f, [
                { etiqueta: cr.parcial ? 'Enviados (30 días)' : 'Enviados', valor: num(cr.enviados), cambio: cambio(cr.enviados, cr.enviadosAntes) },
                { etiqueta: 'No salieron', valor: num(cr.fallidos), nota: cr.fallidos ? 'revísalos' : 'ninguno' },
                { etiqueta: 'Desde el principio', valor: num(cr.enviadosSiempre), nota: 'enviados' },
              ]),
            ],
            ...(cr.porTipo.length ? [[pila([subtitulo(f, 'Qué ha salido'), barras(f, pares(cr.porTipo, 8), { total: cr.enviados, vacio: '' })]), 24] as Paso] : []),
            ...explicar(f, tx.correos),
          ]
        : [[parrafo(f, 'No se ha podido leer el historial de correos para este informe.', { color: C.gris })], ...explicar(f, tx.correos)]
    );
  }

  /* ================= 13 Desde el principio ================= */
  if (todo && d.historia) {
    const sem = d.historia.semanas;
    L.seccion('13', 'Historia', 'Desde el principio', 'Contactos, cuentas y acuerdos semana a semana, desde el primer día.', [
      [
        pila([
          subtituloConLeyenda(f, 'Semana a semana', [
            { texto: 'Contactos', color: SERIE[1] },
            { texto: 'Cuentas', color: SERIE[0] },
            { texto: 'Acuerdos', color: SERIE[3] },
          ]),
          columnas(f, {
            valores: sem.map((x) => x.contactos + x.cuentas + x.acuerdos),
            apiladas: { series: [sem.map((x) => x.contactos), sem.map((x) => x.cuentas), sem.map((x) => x.acuerdos)], colores: [SERIE[1], SERIE[0], SERIE[3]] },
            etiquetas: sem.map((x, i) => (i % Math.max(1, Math.ceil(sem.length / 7)) === 0 ? fechaCorta(x.semana) : null)),
            alto: 150,
            vacio: 'Todavía no hay nada que contar',
          }),
        ]),
        24,
      ],
      [pila([subtitulo(f, 'Por dónde entraron', 'Todos los contactos'), barras(f, pares(d.historia.porOrigen, 8), { total: c.total, vacio: 'Aún no hay contactos.' })]), 24],
      ...explicar(f, tx.historia),
    ]);
  }

  /* ================= Glosario ================= */
  L.grupo = 'Glosario';
  L.nueva();
  L.indice.push({ numero: '—', titulo: 'Glosario y cómo se mide', pagina: doc.getPageCount() });
  L.poner(
    pila(
      [
        () => ({ alto: 10, pintar: (p, x, y) => ojo(p, f, 'Para consultar', x, y - 7) }),
        () => ({ alto: 32, pintar: (p, x, y) => escribir(p, 'Glosario', x, y - 27, { f: f.titulo, talla: 31 }) }),
        parrafo(f, 'Lo que quiere decir cada palabra del informe, en una frase.', { talla: 11, color: C.gris }),
      ],
      8
    ),
    22
  );
  const mitad = Math.ceil(GLOSARIO.length / 2);
  const columnaGlosario = (lista: [string, string][]): Bloque =>
    pila(
      lista.map(([termino, def]) => pila([() => ({ alto: 12, pintar: (p, x, y) => escribir(p, termino, x, y - 10, { f: f.medio, talla: 9.6, color: C.tinta }) }), parrafo(f, def, { talla: 8.8, color: C.tinta2, interlineado: 1.45 })], 2)),
      10
    );
  L.poner(fila([columnaGlosario(GLOSARIO.slice(0, mitad)), columnaGlosario(GLOSARIO.slice(mitad))], 28), 26);
  L.poner(
    explicacion(f, 'significa', [
      '**Cómo se mide la web.** Con un medidor propio, sin cookies y sin Google Analytics: no hace falta pedir permiso a nadie. Se guardan contadores por día (cuántas visitas, de qué país, desde dónde), nunca a cada persona. La IP no se guarda: solo sirve, mezclada y cambiando cada día, para no contar dos veces a la misma persona.',
      '**Qué no sale aquí.** Ningún nombre, correo ni teléfono: este informe solo cuenta cuántos. Las cuentas de prueba y tus propias visitas al aula no cuentan.',
      `**Desde cuándo.** Las visitas se miden desde el ${d.desdeMedidor ? fechaLarga(d.desdeMedidor) : 'día en que se instaló el medidor'}; lo anterior no se guardó y no se puede recuperar. Contactos, cuentas y acuerdos están completos desde el principio. El historial de correos guarda 30 días.`,
    ])
  );

  /* ================= Índice de la portada y números de página ================= */
  const entradas = L.indice;
  const filasIndice = Math.ceil(entradas.length / 2);
  const anchoCol = (ANCHO - px * 2 - 30) / 2;
  entradas.forEach((e, i) => {
    const col = Math.floor(i / filasIndice);
    const ix = px + col * (anchoCol + 30);
    const iy = 252 - (i % filasIndice) * 19;
    const wn = escribir(portada, e.numero === '—' ? '' : e.numero, ix, iy, { f: f.medio, talla: 7.5, color: C.oroNoche, espaciado: 0.6 });
    escribir(portada, e.titulo, ix + (wn ? 20 : 0), iy, { f: f.texto, talla: 10, color: C.cremaNoche, maximo: anchoCol - 40 });
    escribir(portada, String(e.pagina), ix + anchoCol, iy, { f: f.medio, talla: 9, color: C.cremaSuave, alinear: 'der' });
  });

  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    if (i === 0) return;
    escribir(p, 'Sorela Caro · Técnica Divine', MARGEN, 34, { f: f.texto, talla: 7.8, color: C.gris });
    escribir(p, `Página ${i + 1} de ${paginas.length}`, ANCHO - MARGEN, 34, { f: f.medio, talla: 7.8, color: C.gris, alinear: 'der' });
  });

  return doc.save();
}

/** La tabla de los vídeos de la web, con una barrita de «lo terminan». */
function tablaVideos(f: Fuentes, videos: DatosInforme['videos']): Bloque {
  const vistos = videos.filter((v) => v.reproducciones > 0);
  const altoFila = 34;
  return (ancho) => {
    if (!vistos.length)
      return { alto: 18, pintar: (p, x, y) => escribir(p, 'Todavía nadie ha visto un vídeo de la web con sonido.', x, y - 12, { f: f.cursiva, talla: 11.5, color: C.gris }) };
    const cols = [0.33, 0.15, 0.13, 0.22, 0.17].map((k) => k * ancho);
    const xs = cols.map((_, i) => cols.slice(0, i).reduce((s, w) => s + w, 0));
    const titulos = ['Vídeo', 'Reproducciones', 'A la mitad', 'Lo terminan', 'Tiempo medio'];
    return {
      alto: 20 + vistos.length * altoFila,
      pintar: (p, x, y) => {
        titulos.forEach((tt, i) => ojo(p, f, tt, i === 0 ? x : x + xs[i] + cols[i], y - 9, C.gris, i === 0 ? 'izq' : 'der'));
        raya(p, x, y - 16, x + ancho, y - 16, C.linea, 0.8);
        vistos.forEach((v, j) => {
          const fy = y - 20 - j * altoFila;
          const r = Math.max(1, v.reproducciones);
          escribir(p, v.nombre, x, fy - 13, { f: f.medio, talla: 9, color: C.tinta, maximo: cols[0] - 10 });
          escribir(p, nombreDePagina(v.ruta.replace(/\//g, '·') || '·'), x, fy - 25, { f: f.texto, talla: 7.8, color: C.gris, maximo: cols[0] - 10 });
          escribir(p, num(v.reproducciones), x + xs[1] + cols[1], fy - 18, { f: f.cifra, talla: 15, color: C.tinta, alinear: 'der' });
          escribir(p, `${Math.min(100, porcentaje(v.c50, r))} %`, x + xs[2] + cols[2], fy - 17, { f: f.medio, talla: 9, color: C.tinta2, alinear: 'der' });
          const termina = Math.min(100, porcentaje(v.c100, r));
          const bx = x + xs[3] + 12;
          const bw = cols[3] - 12 - 34;
          caja(p, bx, fy - 13, bw, 5, 2.5, C.pista);
          if (termina) caja(p, bx, fy - 13, Math.max(3, (termina / 100) * bw), 5, 2.5, C.oro);
          escribir(p, `${termina} %`, x + xs[3] + cols[3], fy - 17, { f: f.medio, talla: 9, color: C.tinta2, alinear: 'der' });
          escribir(p, minutos(v.segundos / r), x + xs[4] + cols[4], fy - 17, { f: f.texto, talla: 9, color: C.tinta2, alinear: 'der' });
          raya(p, x, fy - altoFila, x + ancho, fy - altoFila);
        });
      },
    };
  };
}

function leerLogo() {
  bytesLogo ??= readFile(path.join(process.cwd(), 'fotos', 'logo-sorela.png')).catch(() => null);
  return bytesLogo;
}
