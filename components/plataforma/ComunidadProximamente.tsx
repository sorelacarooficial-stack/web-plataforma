'use client';

import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import {
  APERTURA,
  DIA_APERTURA,
  GRUPO_WHATSAPP,
  HORA_ESPANA,
  HORAS_APERTURA,
  ZONAS,
  horaEn,
} from '@/lib/apertura';
import css from './comunidadproximamente.module.css';

/**
 * «Comunidad» para quien todavía no tiene la membresía: la invitación a la
 * masterclass en la que se presenta la Comunidad Divine.
 *
 * Solo dice lo que se puede decir: cuándo abre, que se presenta en una
 * masterclass en directo por Zoom, que ahí se cuenta qué hay dentro y cómo
 * entrar, y el grupo de WhatsApp de la lista de espera. Ni lo que incluye ni
 * precios: el espacio de la comunidad no se enseña a quien no lo ha pagado.
 *
 * Tres momentos según la hora, y ninguno enseña una cuenta atrás negativa:
 *  - antes: la cuenta atrás;
 *  - directo (de la hora de inicio a DURACION_MIN después): «Es ahora · en
 *    directo», en lugar de cuatro ceros;
 *  - abierta: ya ha abierto.
 *
 * Es de cliente porque la cuenta va por segundos y «tu hora» depende de la
 * zona de quien mira, que el servidor no conoce. Lo que cambia con el reloj
 * lleva suppressHydrationWarning, que es lo que pide la guía de Next para
 * relojes y cuentas atrás (node_modules/next/dist/docs/01-app/02-guides/
 * preventing-flash-before-hydration.md).
 *
 * Todas las fechas y horas salen de lib/apertura.ts: si se mueve APERTURA,
 * se mueve todo (también el .ics).
 */

/** Lo que dura el directo y el evento del calendario. A confirmar con Sorela. */
const DURACION_MIN = 60;

/** El título de la masterclass, el mismo de los correos de la lista de espera. */
const MASTERCLASS = 'La nueva era de las manos';

const INSTANTE = new Date(APERTURA);
const INICIO = INSTANTE.getTime();
const FIN = INICIO + DURACION_MIN * 60_000;
const ANIO = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', year: 'numeric' }).format(INSTANTE);
/** «Viernes 6 de noviembre», para empezar línea. */
const DIA_TITULO = DIA_APERTURA.charAt(0).toUpperCase() + DIA_APERTURA.slice(1);
const CUANDO = `el ${DIA_APERTURA} de ${ANIO} a las ${HORA_ESPANA}, hora de España`;

type Fase = 'antes' | 'directo' | 'abierta';
const faseDe = (t: number): Fase => (t < INICIO ? 'antes' : t < FIN ? 'directo' : 'abierta');

type Clave = 'd' | 'h' | 'm' | 's';

function partes(t: number): Record<Clave, number> {
  const falta = Math.max(0, Math.floor((INICIO - t) / 1000));
  return {
    d: Math.floor(falta / 86400),
    h: Math.floor((falta % 86400) / 3600),
    m: Math.floor((falta % 3600) / 60),
    s: falta % 60,
  };
}

/** [uno, varios]. Los cortos se ven cuando el reloj mide menos de ~420 px. */
const UNIDADES: { k: Clave; largo: [string, string]; corto: [string, string] }[] = [
  { k: 'd', largo: ['Día', 'Días'], corto: ['Día', 'Días'] },
  { k: 'h', largo: ['Hora', 'Horas'], corto: ['Hora', 'Horas'] },
  { k: 'm', largo: ['Minuto', 'Minutos'], corto: ['Min', 'Min'] },
  { k: 's', largo: ['Segundo', 'Segundos'], corto: ['Seg', 'Seg'] },
];

const dos = (n: number) => String(n).padStart(2, '0');

/** Lo que lee el lector de pantalla: cambia una vez por minuto y no se anuncia solo. */
function fraseFalta({ d, h, m }: Record<Clave, number>): string {
  const trozos: string[] = [];
  if (d) trozos.push(`${d} ${d === 1 ? 'día' : 'días'}`);
  if (h) trozos.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
  if (m) trozos.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  const cola = ` La masterclass es ${CUANDO}.`;
  if (!trozos.length) return `Falta menos de un minuto.${cola}`;
  const lista =
    trozos.length > 1 ? `${trozos.slice(0, -1).join(', ')} y ${trozos[trozos.length - 1]}` : trozos[0];
  const verbo = trozos.length === 1 && trozos[0].startsWith('1 ') ? 'Falta' : 'Faltan';
  return `${verbo} ${lista}.${cola}`;
}

/**
 * El país de una zona horaria, si es uno de los de ZONAS. Canarias
 * (Atlantic/Canary) no cuenta como «España»: allí son las 18:00 y le sale su
 * hora en «En tu hora». Además, abajo solo se marca si la hora coincide.
 * Argentina tiene varias zonas (y dos nombres antiguos que aún devuelve algún
 * navegador); todas dan la misma hora.
 */
function paisDe(zona: string): string | null {
  if (zona === 'Africa/Ceuta') return 'España';
  if (zona.startsWith('America/Argentina/') || zona === 'America/Buenos_Aires' || zona === 'America/Cordoba') {
    return 'Argentina';
  }
  return ZONAS.find((z) => z.zona === zona)?.lugar ?? null;
}

/* ---------- El .ics ---------- */

const escapa = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

const sello = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545: líneas de 75 octetos como mucho, plegadas con CRLF + espacio, sin
 *  partir una letra de varios octetos ni un escape («\n», «\,»). */
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

/**
 * El evento, en UTC: cada calendario lo enseña en la hora de quien lo abre.
 * Sin enlace de Zoom, que todavía no existe: lo dicen la descripción y el
 * lugar. El UID sale de la fecha de APERTURA: si se mueve, el evento es otro.
 */
function ics(): string {
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sorela Caro//Tecnica Divine//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:masterclass-comunidad-divine-${sello(INSTANTE).slice(0, 8)}@sorelacarodivine.com`,
      `DTSTAMP:${sello(new Date())}`,
      `DTSTART:${sello(INSTANTE)}`,
      `DTEND:${sello(new Date(FIN))}`,
      `SUMMARY:${escapa(`${MASTERCLASS} · Masterclass en directo`)}`,
      `DESCRIPTION:${escapa(
        'Sorela Caro presenta la Comunidad Divine en directo por Zoom: qué hay dentro y cómo entrar.\n' +
          'El enlace de Zoom te llegará por correo.\n' +
          `Grupo de WhatsApp de la lista de espera: ${GRUPO_WHATSAPP}`
      )}`,
      `LOCATION:${escapa('Zoom (el enlace llegará por correo)')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapa('La masterclass empieza en una hora')}`,
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(pliega)
      .join('\r\n') + '\r\n'
  );
}

/** Se genera en el navegador, sin servidor: un Blob y un enlace de descarga. */
function descargarIcs() {
  const url = URL.createObjectURL(new Blob([ics()], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'masterclass-la-nueva-era-de-las-manos.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- Iconos (trazo, heredan el color) ---------- */

const IconoSobre = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4.5 7 7.5 5.5L19.5 7" />
  </svg>
);
const IconoWhatsapp = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.6z" />
    <path d="M9.2 9.2c.2 1.6 1.9 3.9 4 4.9l1.2-1.1 1.7.8c-.2 1-.9 1.6-1.9 1.6-2.8-.2-5.6-3-5.9-5.8 0-1 .6-1.7 1.6-1.9l.8 1.7z" />
  </svg>
);
const IconoCalendario = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
  </svg>
);
const IconoFlecha = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export default function ComunidadProximamente({ nombre }: { nombre?: string }) {
  const pila = (nombre || '').trim().split(/\s+/)[0];
  const idSaludo = useId();
  const [ahora, setAhora] = useState(() => Date.now());
  const [tuya, setTuya] = useState<{ pais: string | null; linea: string | null }>({ pais: null, linea: null });
  const [guardado, setGuardado] = useState(false);

  // El reloj: un tic por segundo, alineado con el cambio de segundo (si no,
  // el segundero va a saltos de dos de vez en cuando). Deja de latir al
  // terminar el directo: ya no hay nada que contar.
  useEffect(() => {
    let id = 0;
    const tic = () => {
      const t = Date.now();
      setAhora(t);
      if (t < FIN) id = window.setTimeout(tic, 1000 - (t % 1000) + 5);
    };
    tic();
    return () => window.clearTimeout(id);
  }, []);

  // La hora de quien mira: se marca su país o se le dice su hora. Con la
  // misma cuenta que las cuatro de arriba (horaEn), así no pueden discrepar.
  useEffect(() => {
    let zona = '';
    let hora = '';
    let dia = '';
    try {
      zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!zona) return;
      hora = horaEn(zona);
      dia = new Intl.DateTimeFormat('es-ES', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long' })
        .format(INSTANTE)
        .replace(',', '');
    } catch {
      // Un navegador que no sabe su zona (o da una rara): sin «tu hora», y
      // las cuatro de arriba siguen valiendo.
      return;
    }
    const pais = paisDe(zona);
    if (pais && HORAS_APERTURA.some((x) => x.lugar === pais && x.hora === hora)) {
      setTuya({ pais, linea: null });
      return;
    }
    setTuya({ pais: null, linea: `${dia}, ${hora}` });
  }, []);

  const fase = faseDe(ahora);
  const v = partes(ahora);
  // «Sobre esto» vive en la lateral (SobreEsto.tsx) y escucha este aviso. En
  // el móvil la lateral es un cajón cerrado, pero la carta es un <dialog>
  // modal: sale por encima de todo aunque el cajón esté fuera de pantalla.
  const abrirCarta = () => window.dispatchEvent(new Event('divine:sobre'));

  const grupo = (
    <a className={`${css.boton} ${css.botonPrimario}`} href={GRUPO_WHATSAPP} target="_blank" rel="noopener noreferrer">
      <IconoWhatsapp />
      Entrar al grupo de WhatsApp
    </a>
  );

  const palabras = (
    <button type="button" className={css.palabras} onClick={abrirCarta} aria-haspopup="dialog">
      <span className={css.palabrasFoto}>
        <Image src="/alumnas/sorela-cara.webp" alt="" width={34} height={34} />
      </span>
      Unas palabras de Sorela
      <IconoFlecha />
    </button>
  );

  if (fase === 'abierta') {
    return (
      <div className={css.escena}>
        <span className={css.aura} aria-hidden="true" />
        <span className={css.orbita} aria-hidden="true" />
        <section className={css.comunidad} aria-labelledby={idSaludo}>
          <p id={idSaludo} className={`${css.saludo} ${css.saludoSolo}`}>
            {pila ? `${pila}, la ` : 'La '}
            <b>Comunidad Divine</b> ya ha abierto
          </p>
          {/* Este texto conviene que lo confirme Sorela antes del día: depende
              de cómo se entre después de la masterclass. */}
          <div className={css.ahora}>
            <h2 className={css.ahoraTitulo}>Gracias por estar aquí.</h2>
            <p className={css.ahoraTexto}>
              La presenté en la masterclass <b>«{MASTERCLASS}»</b>: qué hay dentro y cómo entrar. En el grupo de
              WhatsApp aviso de todo.
            </p>
          </div>
          <div className={`${css.acciones} ${css.accionesSolo}`}>{grupo}</div>
          {palabras}
        </section>
      </div>
    );
  }

  return (
    <div className={css.escena}>
      <span className={css.aura} aria-hidden="true" />
      <span className={css.orbita} aria-hidden="true" />
      <section className={css.comunidad} aria-labelledby={idSaludo}>
        <p className={`${css.invitacion} ${css.entra} ${css.entra1}`}>
          <IconoSobre />
          <span>
            {pila ? (
              <>
                <b>{pila}</b>, esta es tu invitación
              </>
            ) : (
              'Esta es tu invitación'
            )}
          </span>
        </p>

        <p id={idSaludo} className={`${css.saludo} ${css.entra} ${css.entra1}`}>
          La <b>Comunidad Divine</b> {fase === 'antes' ? 'abre en' : 'se presenta ahora'}
        </p>

        {fase === 'antes' ? (
          <div className={`${css.reloj} ${css.entra} ${css.entra2}`}>
            {/* Lo que se ve cambia cada segundo: oculto al lector de pantalla,
                que lee la frase de debajo (una vez por minuto, sin anunciarse). */}
            <div className={css.relojCifras} aria-hidden="true">
              {UNIDADES.map(({ k, largo, corto }) => {
                const n = v[k];
                const i = n === 1 ? 0 : 1;
                return (
                  <div key={k} className={css.unidad}>
                    {/* La clave cambia con la cifra: se vuelve a montar y entra con su animación. */}
                    <span key={n} className={css.numero} suppressHydrationWarning>
                      {dos(n)}
                    </span>
                    <span className={css.rotuloReloj}>
                      {k === 's' && <span className={css.latido} />}
                      <span className={css.largo} suppressHydrationWarning>
                        {largo[i]}
                      </span>
                      <span className={css.corto} suppressHydrationWarning>
                        {corto[i]}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            {/* role="timer" lleva aria-live="off" implícito: se lee al llegar
                a él, pero no interrumpe a nadie cada minuto. */}
            <p className="sr-only" role="timer" suppressHydrationWarning>
              {fraseFalta(v)}
            </p>
          </div>
        ) : (
          /* En directo, nunca cuatro ceros: se dice que es ahora. */
          <div className={css.ahora}>
            <p className={css.enDirecto}>
              <span className={css.pulso} aria-hidden="true" />
              Es ahora · en directo
            </p>
            <p className={css.ahoraTitulo}>La masterclass ya ha empezado.</p>
            <p className={css.ahoraTexto}>El enlace está en tu correo.</p>
          </div>
        )}

        <p className={`${css.evento} ${css.entra} ${css.entra3}`}>Masterclass en directo por Zoom</p>
        <h2 className={`${css.masterclass} ${css.entra} ${css.entra3}`}>{MASTERCLASS}</h2>
        <p className={`${css.fecha} ${css.entra} ${css.entra4}`}>
          <b>{DIA_TITULO}</b> de {ANIO}
        </p>

        <ul className={`${css.horas} ${css.entra} ${css.entra4}`} aria-label="Hora de la masterclass en cada país">
          {HORAS_APERTURA.map(({ lugar, hora }) => {
            const esTuya = tuya.pais === lugar;
            return (
              <li key={lugar} className={esTuya ? css.tuya : undefined} title={esTuya ? 'Tu hora' : undefined}>
                <span className={css.pais}>{lugar}</span>
                <span className={css.hora}>{hora}</span>
                {esTuya && <span className="sr-only"> (tu hora)</span>}
              </li>
            );
          })}
        </ul>
        {tuya.linea && (
          <p className={css.tuHora}>
            En tu hora: <b>{tuya.linea}</b>
          </p>
        )}

        <figure className={`${css.nota} ${css.entra} ${css.entra5}`}>
          <span className={css.notaFoto}>
            <Image src="/alumnas/sorela-cara.webp" alt="" width={50} height={50} />
          </span>
          <figcaption>
            <p>
              En la masterclass te presento la <span className={css.junto}>Comunidad Divine:</span>
              <br className={css.brAncho} /> qué hay dentro y cómo entrar.
            </p>
            <cite>Sorela Caro</cite>
          </figcaption>
        </figure>

        <div className={`${css.acciones} ${css.entra} ${css.entra5}`}>
          {grupo}
          {fase === 'antes' && (
            <button
              type="button"
              className={`${css.boton} ${css.botonVidrio}`}
              onClick={() => {
                descargarIcs();
                setGuardado(true);
              }}
            >
              <IconoCalendario />
              Añadir a mi calendario
            </button>
          )}
        </div>

        <p className={`${css.pieNota} ${css.entra} ${css.entra5}`}>
          <span>El grupo de WhatsApp es el de la lista de espera: ahí aviso de todo lo de la masterclass.</span>
          {fase === 'antes' && (
            <span role="status">
              {guardado
                ? 'Listo: abre el archivo para guardarlo en tu calendario. El enlace de Zoom te llegará por correo.'
                : 'El enlace de Zoom te llegará por correo.'}
            </span>
          )}
        </p>

        {palabras}
      </section>
    </div>
  );
}
