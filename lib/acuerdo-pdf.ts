import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { fechaLarga, type Clausula } from './acuerdo';

/**
 * El acuerdo firmado, en PDF.
 *
 * Es el documento que recibe la alumna por correo y el que Sorela descarga
 * desde su plataforma. Se genera a partir de la COPIA CONGELADA que se guardó
 * al firmar —título, cláusulas y cierre tal como se le enseñaron—, no del texto
 * actual de `lib/acuerdo.ts`. Si mañana se cambia una cláusula, el PDF de una
 * firma de hoy sigue diciendo lo que ella firmó.
 *
 * Lleva al pie el registro de la firma: referencia, hora del servidor,
 * dirección IP y navegador. Es lo que convierte un garabato en una firma que
 * se puede defender: qué se firmó, cuándo y desde dónde.
 *
 * Usa las tipografías estándar del PDF (Times) en vez de las de la marca: las
 * de la web son woff2, que un PDF no puede llevar dentro, y un contrato en
 * Times se lee como un contrato.
 */

export type AcuerdoGuardado = {
  referencia: string;
  nombre: string;
  apellidos: string;
  documento: string;
  correo: string;
  telefono: string;
  lugar: string;
  firma: string;
  firmadoEl: string;
  version: string;
  titulo: string;
  clausulas: Clausula[];
  cierre: string;
  prueba?: { ip?: string; navegador?: string };
};

const A4 = { ancho: 595.28, alto: 841.89 };
const MARGEN = 58;
const TINTA = rgb(0.08, 0.07, 0.06);
const SUAVE = rgb(0.42, 0.39, 0.35);
const ORO = rgb(0.54, 0.42, 0.2);

/**
 * Quita lo que la tipografía estándar no sabe pintar.
 *
 * Times trae el juego de caracteres de Windows, que cubre las tildes, la eñe,
 * las comillas angulares y la raya; un emoji o un carácter raro pegado en el
 * nombre haría fallar el documento entero. Se cambia por un espacio antes que
 * quedarse sin contrato por una letra.
 */
function limpio(texto: string, fuente: PDFFont): string {
  const validos = new Set(fuente.getCharacterSet());
  return Array.from(String(texto ?? ''))
    .map((c) => (validos.has(c.codePointAt(0) ?? 0) ? c : c === '\n' ? '\n' : ' '))
    .join('');
}

/** Parte un texto en líneas que caben en `ancho`. */
function lineas(texto: string, fuente: PDFFont, talla: number, ancho: number): string[] {
  const salida: string[] = [];
  for (const parrafo of texto.split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(prueba, talla) <= ancho) {
        actual = prueba;
      } else {
        if (actual) salida.push(actual);
        actual = palabra;
      }
    }
    salida.push(actual);
  }
  return salida;
}

export async function pdfDelAcuerdo(a: AcuerdoGuardado): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${a.titulo} · ${a.referencia}`);
  doc.setAuthor('Sorela Caro · Técnica Divine');
  doc.setSubject('Acuerdo de confidencialidad firmado');

  const normal = await doc.embedFont(StandardFonts.TimesRoman);
  const negrita = await doc.embedFont(StandardFonts.TimesRomanBold);
  const cursiva = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  const anchoUtil = A4.ancho - MARGEN * 2;
  let pagina: PDFPage = doc.addPage([A4.ancho, A4.alto]);
  let y = A4.alto - MARGEN;

  /** Si lo siguiente no cabe, página nueva. */
  const sitio = (alto: number) => {
    if (y - alto < MARGEN) {
      pagina = doc.addPage([A4.ancho, A4.alto]);
      y = A4.alto - MARGEN;
    }
  };

  const escribir = (
    texto: string,
    { fuente = normal, talla = 10.8, color = TINTA, interlineado = 1.42, despues = 8, centrado = false } = {}
  ) => {
    const ls = lineas(limpio(texto, fuente), fuente, talla, anchoUtil);
    for (const l of ls) {
      sitio(talla * interlineado);
      const x = centrado ? (A4.ancho - fuente.widthOfTextAtSize(l, talla)) / 2 : MARGEN;
      pagina.drawText(l, { x, y: y - talla, size: talla, font: fuente, color });
      y -= talla * interlineado;
    }
    y -= despues;
  };

  /* ---------- El logotipo ---------- */
  try {
    const bytes = await readFile(path.join(process.cwd(), 'fotos', 'logo-sorela.png'));
    const logo = await doc.embedPng(bytes);
    const ancho = 108;
    const alto = (logo.height / logo.width) * ancho;
    pagina.drawImage(logo, { x: (A4.ancho - ancho) / 2, y: y - alto, width: ancho, height: alto });
    y -= alto + 18;
  } catch {
    /* Sin logotipo el contrato sigue siendo el contrato. */
  }

  /* ---------- Título y partes ---------- */
  escribir(a.titulo.toUpperCase(), { fuente: negrita, talla: 13, centrado: true, despues: 14 });

  const nombre = `${a.nombre} ${a.apellidos}`.trim();
  escribir(
    `Celebran de una parte la alumna ${nombre}, con documento de identidad n.º ${a.documento}, en adelante el RECEPTOR, y de otra parte la formadora Sorela Caro, en adelante el DIVULGANTE, ambas mayores de edad y con capacidad de obrar, a tenor de las cláusulas siguientes.`,
    { despues: 12 }
  );

  /* ---------- Cláusulas ---------- */
  for (const c of a.clausulas ?? []) {
    sitio(40);
    escribir(`${c.orden}. ${c.titulo}`, { fuente: negrita, talla: 11.5, despues: 4 });
    for (const p of c.parrafos) escribir(p, { despues: 6 });
    y -= 4;
  }

  escribir(a.cierre, { fuente: cursiva, despues: 12 });
  escribir(`En ${a.lugar}, a ${fechaLarga(a.firmadoEl)}.`, { despues: 18 });

  /* ---------- Firmas ----------
     Firma y registro van juntos: si no caben los dos, pasan juntos a la
     página siguiente. Una firma separada del registro que la acredita es
     justo lo que no se quiere. */
  sitio(260);
  const columna = anchoUtil / 2 - 12;
  const arriba = y;

  pagina.drawText('EL RECEPTOR (la alumna)', { x: MARGEN, y: arriba - 10, size: 9, font: sans, color: SUAVE });
  pagina.drawText('EL DIVULGANTE (la formadora)', {
    x: MARGEN + columna + 24,
    y: arriba - 10,
    size: 9,
    font: sans,
    color: SUAVE,
  });

  try {
    const base64 = a.firma.replace(/^data:image\/png;base64,/, '');
    const firma = await doc.embedPng(Buffer.from(base64, 'base64'));
    const ancho = Math.min(columna, 210);
    const alto = Math.min((firma.height / firma.width) * ancho, 80);
    pagina.drawImage(firma, { x: MARGEN, y: arriba - 22 - alto, width: (firma.width / firma.height) * alto, height: alto });
  } catch {
    pagina.drawText('[firma no disponible]', { x: MARGEN, y: arriba - 60, size: 10, font: cursiva, color: SUAVE });
  }

  const linea = arriba - 108;
  pagina.drawLine({ start: { x: MARGEN, y: linea }, end: { x: MARGEN + columna, y: linea }, thickness: 0.6, color: SUAVE });
  pagina.drawLine({
    start: { x: MARGEN + columna + 24, y: linea },
    end: { x: MARGEN + columna * 2 + 24, y: linea },
    thickness: 0.6,
    color: SUAVE,
  });
  pagina.drawText(limpio(nombre, normal), { x: MARGEN, y: linea - 15, size: 10.5, font: normal, color: TINTA });
  pagina.drawText('Sorela Caro', { x: MARGEN + columna + 24, y: linea - 15, size: 10.5, font: normal, color: TINTA });
  y = linea - 44;

  /* ---------- Registro de la firma ---------- */
  pagina.drawLine({ start: { x: MARGEN, y }, end: { x: A4.ancho - MARGEN, y }, thickness: 0.6, color: ORO });
  y -= 16;
  escribir('REGISTRO DE LA FIRMA ELECTRÓNICA', { fuente: sans, talla: 8, color: ORO, despues: 4 });
  const registro = [
    `Referencia: ${a.referencia}`,
    `Firmado el: ${a.firmadoEl} (hora del servidor, UTC)`,
    `Correo: ${a.correo} · Teléfono: ${a.telefono}`,
    `Dirección IP: ${a.prueba?.ip ?? 'no consta'}`,
    `Navegador: ${a.prueba?.navegador ?? 'no consta'}`,
    `Versión del texto: ${a.version}`,
  ];
  for (const r of registro) escribir(r, { fuente: sans, talla: 8, color: SUAVE, interlineado: 1.45, despues: 0 });

  return doc.save();
}
