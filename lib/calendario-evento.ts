/**
 * «Añadir a mi calendario» para cualquier evento: el enlace de Google, el de
 * Outlook y el archivo .ics (Apple y el resto).
 *
 * Todo en UTC: cada calendario lo enseña en la hora de quien lo abre, esté en
 * el país que esté. El .ics se genera en el navegador, sin servidor.
 */

export type EventoCalendario = {
  /** Fijo para el mismo evento: si se añade dos veces, el calendario lo reconoce. */
  uid: string;
  titulo: string;
  inicio: Date;
  minutos: number;
  descripcion?: string;
  lugar?: string;
};

const sello = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fin = (e: EventoCalendario) => new Date(e.inicio.getTime() + e.minutos * 60_000);

export function enlaceGoogle(e: EventoCalendario): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${sello(e.inicio)}/${sello(fin(e))}`,
    details: e.descripcion ?? '',
    location: e.lugar ?? '',
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function enlaceOutlook(e: EventoCalendario): string {
  const q = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.titulo,
    startdt: e.inicio.toISOString(),
    enddt: fin(e).toISOString(),
    body: e.descripcion ?? '',
    location: e.lugar ?? '',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
}

const escapa = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545: líneas de 75 octetos como mucho, sin partir una letra ni un escape. */
function pliega(linea: string): string {
  const enc = new TextEncoder();
  const lineas: string[] = [];
  let actual = '';
  let bytes = 0;
  for (const trozo of linea.match(/\\.|[\s\S]/gu) ?? []) {
    const b = enc.encode(trozo).length;
    if (bytes + b > (lineas.length ? 74 : 75)) {
      lineas.push(actual);
      actual = '';
      bytes = 0;
    }
    actual += trozo;
    bytes += b;
  }
  lineas.push(actual);
  return lineas.join('\r\n ');
}

export function textoIcs(e: EventoCalendario): string {
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sorela Caro//Tecnica Divine//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${e.uid}@sorelacarodivine.com`,
      `DTSTAMP:${sello(new Date())}`,
      `DTSTART:${sello(e.inicio)}`,
      `DTEND:${sello(fin(e))}`,
      `SUMMARY:${escapa(e.titulo)}`,
      ...(e.descripcion ? [`DESCRIPTION:${escapa(e.descripcion)}`] : []),
      ...(e.lugar ? [`LOCATION:${escapa(e.lugar)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapa(`${e.titulo} empieza en una hora`)}`,
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(pliega)
      .join('\r\n') + '\r\n'
  );
}

/** Descarga el .ics (Apple Calendar lo abre al tocarlo). Solo en el navegador. */
export function descargarIcs(e: EventoCalendario, nombre = 'clase-divine.ics') {
  const url = URL.createObjectURL(new Blob([textoIcs(e)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
