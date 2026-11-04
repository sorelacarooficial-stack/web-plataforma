'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FORMACIONES, ONLINE, SEDES, VIDEOS } from '@/lib/clase';
import { AntesDespues, Cuenta, CuentaAtras, Cuerpo, Icono, Mapa, Movil, Polvo, Quedan, Titulo, useGoteo, VideoModal } from './piezas';
import { useClase } from './estado';
import css from './clase.module.css';

/**
 * Las 28 diapositivas de «Antes de tocar».
 *
 * Cada una dice cuántos `pasos` tiene: cuántas veces hay que pulsar «siguiente»
 * antes de pasar a la otra. Lo que entra en el paso k lleva `v(k)`. Lo del
 * paso 0 entra solo al llegar.
 */

export type Props = {
  paso: number;
  activa: boolean;
  estatica: boolean;
  qr: string;
  /** Visible a partir del paso k. */
  on: (k?: number) => boolean;
  /** La clase de entrada (`r`) más `on` si ya toca. */
  v: (k?: number, extra?: string) => string;
};

export type Diapo = {
  id: string;
  titulo: string;
  tema: 'oscuro' | 'crema';
  pasos: number;
  sinPie?: boolean;
  fase?: 1 | 2 | 3;
  notas: string;
  Vista: (p: Props) => ReactNode;
};

const d = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`${css.eyebrow} ${className ?? ''}`}>{children}</p>;
}

function Chip({ children, icono, className, style }: { children: ReactNode; icono?: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`${css.chip} ${className ?? ''}`} style={style}>
      {icono && <Icono n={icono} className={css.chipIcono} />}
      {children}
    </span>
  );
}

function Flecha({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 60 20" className={`${css.flecha} ${className ?? ''}`} style={style} aria-hidden>
      <path d="M2 10h52m-8-7 8 7-8 7" />
    </svg>
  );
}

/* --------------------------------------------------------------- 1 */

function Portada({ activa, estatica, v, on }: Props) {
  return (
    <div className={css.portada}>
      {!estatica && <Polvo activa={activa} />}
      <div className={css.halo} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/clase/logo-oro.webp" alt="Sorela Caro · Técnica Divine" className={`${css.logoPortada} ${v(0)}`} />
      <Eyebrow className={v(0)}>
        <span style={d(0.2)}>Clase gratuita · En directo</span>
      </Eyebrow>
      <Titulo as="h1" texto="Antes de *tocar*" on={on(0)} className={css.tituloPortada} retraso={0.3} paso={0.16} />
      <p className={`${css.sub} ${v(0)}`} style={d(0.9)}>
        Qué observar, qué interpretar y cómo decidir antes de trabajar.
      </p>
      <div className={v(0)} style={d(1.1)}>
        <CuentaAtras activa={activa && !estatica} />
      </div>
      <div className={css.fila} style={{ justifyContent: 'center' }}>
        <Chip icono="chat" className={v(0)} style={d(1.3)}>
          Escribe en el chat desde dónde nos ves
        </Chip>
        <Chip icono="calendario" className={v(0)} style={d(1.4)}>
          Vie 6 nov · 19:00 España · 13:00 Colombia
        </Chip>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 2 */

function Bienvenida({ activa, estatica, v, on }: Props) {
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.8fr 1.2fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Bienvenida</Eyebrow>
        <Titulo texto={'¿Desde dónde\n*nos ves?*'} on={on(0)} className={css.h2} />
        <p className={`${css.texto} ${v(0)}`} style={d(0.6)}>
          Y cuéntame: ¿cuántos años llevas <b>trabajando con tus manos</b>?
        </p>
        <div className={`${css.tarjetaSorela} ${v(0)}`} style={d(0.9)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clase/sorela-cara.webp" alt="" />
          <div>
            <b>Sorela Caro</b>
            <span>Creadora de la Técnica Divine</span>
          </div>
          <span className={css.enDirecto}>en directo</span>
        </div>
      </div>
      <div className={`${css.vidrio} ${css.mapaCaja} ${v(0, css.rEscala)}`} style={d(0.3)}>
        <Eyebrow>Escríbelo en el chat · pulsa tu ciudad</Eyebrow>
        <Mapa activa={activa} estatica={estatica} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 3 */

function TresCosas({ v, on }: Props) {
  const cosas = [
    ['ojo', 'Qué observar', 'Lo que te dice el cuerpo antes de tocarlo'],
    ['lupa', 'Qué interpretar', 'Lo que hay detrás de lo que ves'],
    ['decidir', 'Cómo decidir', 'Por dónde empezar, y por qué'],
  ];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Lo que te llevas hoy</Eyebrow>
      <Titulo texto="Hoy te llevas *3 cosas*" on={on(0)} className={css.h2} />
      <div className={css.tres}>
        {cosas.map(([i, t, s], k) => (
          <div key={t} className={`${css.vidrio} ${css.cosa} ${v(0, css.rArriba)}`} style={d(0.5 + k * 0.18)}>
            <div className={css.cosaCabeza}>
              <span className={css.circuloIcono}>
                <Icono n={i} />
              </span>
              <span className={css.numFino}>0{k + 1}</span>
            </div>
            <h3>{t}</h3>
            <p>{s}</p>
          </div>
        ))}
      </div>
      <div className={`${css.barraOscura} ${v(1)}`}>
        <Icono n="regalo" className={css.chipIcono} />
        Al final, solo en directo: tu ficha <b>«Lo que miro antes de tocar»</b> y una noticia
        <span className={css.brillo} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 4 */

function Bucle({ v, on }: Props) {
  const { estado, cambiar } = useClase();
  const pasos = ['Llega con\nuna necesidad', 'Repites el protocolo\nque ya conoces', 'No identificas qué\nnecesita realmente\nsu cuerpo', 'Y el resultado\nno llega como\nesperabas'];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>El problema</Eyebrow>
      <Titulo texto={'Pones todo de ti,\n*pero no consigues el cambio\nque tu clienta espera.*'} on={on(0)} className={`${css.h2} ${css.h2medio}`} />
      <div className={css.bucle} style={{ paddingBottom: 0, marginTop: 56 }}>
        {pasos.map((p, k) => (
          <div key={p} className={css.bucleTramo}>
            <div
              className={`${css.caja} ${css.cajaProblema} ${k === 3 ? css.cajaFinal : ''} ${k === 3 && on(1) ? css.cajaAlarma : ''} ${v(0, css.rIzq)}`}
              style={d(0.8 + k * 0.45)}
            >
              {p.split('\n').map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
            {k < 3 && <Flecha className={v(0)} style={d(1 + k * 0.45)} />}
          </div>
        ))}
      </div>
      <div className={`${css.conclusion} ${v(1)}`}>
        <Titulo as="p" texto={'No necesitas trabajar más.\nNecesitas aprender a *observar, interpretar y actuar con criterio.*'} on={on(1)} className={css.conclusionTexto} retraso={0.2} paso={0.06} />
      </div>
      <div className={`${css.contadorGrande} ${v(0)}`} style={d(2.6)}>
        <div>
          <span className={css.contadorNum} key={estado.unos}>
            {estado.unos}
          </span>
          <span className={css.contadorTexto}>
            personas han escrito <b>«1»</b> en el chat
          </span>
        </div>
        <div className={css.fila}>
          <button type="button" className={css.boton} onClick={(e) => (e.stopPropagation(), cambiar((s) => ({ ...s, unos: s.unos + 1 })))}>
            +1
          </button>
          <button type="button" className={css.boton} onClick={(e) => (e.stopPropagation(), cambiar((s) => ({ ...s, unos: s.unos + 5 })))}>
            +5
          </button>
          <button type="button" className={css.miniSuave} onClick={(e) => (e.stopPropagation(), cambiar((s) => ({ ...s, unos: Math.max(0, s.unos - 1) })))}>
            −1
          </button>
        </div>
      </div>
      <Chip icono="chat" className={`${css.chipEsquina} ${v(0)}`} style={d(1.6)}>
        Si te ha pasado, escribe un 1
      </Chip>
    </div>
  );
}

/* --------------------------------------------------------------- 5 */

function Trampas({ v, on }: Props) {
  const { estado, cambiar } = useClase();
  const total = estado.votos.reduce((a, b) => a + b, 0);
  const obstaculos = [
    ['aparato', 'Aparatología que no ofrece los resultados que esperas', 'Inviertes en tecnología, pero no siempre consigues solucionar lo que realmente necesita tu clienta.'],
    ['copia', 'El mismo protocolo para todas', 'Cada cuerpo es diferente. Cada persona tiene necesidades, circunstancias y respuestas distintas. Un mismo protocolo no puede responder a todas por igual.'],
    ['mano', 'Improvisar y esperar resultados', 'Trabajar sin conocer el antes, el durante y el después; sin comprender el cómo ni el porqué de cada maniobra, es trabajar sin criterio y asumir resultados inciertos.'],
  ];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Los tres obstáculos</Eyebrow>
      <Titulo texto={'¿Por qué trabajas tanto\n*y no consigues los resultados que esperas?*'} on={on(0)} className={`${css.h2} ${css.h2medio}`} />
      <div className={css.tres} style={{ margin: '44px 0 34px' }}>
        {obstaculos.map(([i, t, s], k) => {
          const pct = total ? Math.round((estado.votos[k] / total) * 100) : 0;
          return (
            <button
              type="button"
              key={k}
              className={`${css.oscuraCaja} ${css.trampa} ${css.obstaculo} ${v(k + 1, css.rArriba)}`}
              onClick={(e) => {
                e.stopPropagation();
                cambiar((st) => {
                  const votos = [...st.votos] as [number, number, number];
                  votos[k]++;
                  return { ...st, votos };
                });
              }}
              title="Pulsa para sumar un voto del chat"
            >
              <div className={css.cosaCabeza}>
                <span className={css.numGrande}>{k + 1}</span>
                <span className={css.circuloIconoOscuro}>
                  <Icono n={i} />
                </span>
              </div>
              <h3>{t}</h3>
              <p>{s}</p>
              <div className={css.voto}>
                <span className={css.votoBarra} style={{ width: `${pct}%` }} />
              </div>
              <span className={css.votoNum}>{total ? `${estado.votos[k]} · ${pct} %` : 'pulsa para contar votos'}</span>
            </button>
          );
        })}
      </div>
      <div className={css.filaEntre}>
        <p className={`${css.cita} ${v(3)}`} style={d(0.4)}>
          «Sin conocimiento, sin criterio y sin personalización, no hay evolución profesional».
        </p>
        <div className={css.fila}>
          {total > 0 && (
            <button type="button" className={css.miniSuave} onClick={(e) => (e.stopPropagation(), cambiar((st) => ({ ...st, votos: [0, 0, 0] })))}>
              borrar votos
            </button>
          )}
          <Chip icono="chat" className={v(1)}>
            ¿Cuál te ha pasado? Escribe 1, 2 o 3
          </Chip>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 6 */

function Cita({ v, on }: Props) {
  return (
    <div className={css.centro}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/clase/logo-tinta.webp" alt="" className={`${css.logoCita} ${v(0)}`} />
      <Titulo
        as="blockquote"
        texto={'No se trata de poner las manos.\nSe trata de saber *qué observar*, *qué interpretar*\ny *cómo decidir* antes de trabajar.'}
        on={on(0)}
        className={css.citaGrande}
        retraso={0.4}
        paso={0.11}
      />
      <p className={`${css.firma} ${v(0)}`} style={d(3.2)}>
        Sorela Caro
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- 7 */

function Historia({ v, on }: Props) {
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.75fr 1fr' }}>
      <div className={`${css.foto} ${css.fotoAlta} ${v(0, css.rCortina)}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clase/historia.webp" alt="Sorela Caro" />
      </div>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Mi historia</Eyebrow>
        <Titulo texto={'Empecé peinando.\n*Me quedé por\nlas emociones.*'} on={on(0)} className={css.h2} retraso={0.4} />
        <p className={`${css.texto} ${v(1)}`}>
          Quería entender lo que la persona <b>sentía</b>, no solo cómo se veía.
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 8 */

function Aprendi({ v, on }: Props) {
  return (
    <div className={css.sangre}>
      <div className={`${css.fotoSangre} ${on(1) ? css.fotoNitida : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clase/aprendi.webp" alt="Sorela trabajando con las manos" />
      </div>
      <div className={css.sangreTexto}>
        <Eyebrow className={v(0)}>Lo que aprendí</Eyebrow>
        <Titulo texto={'El masajista\nmás famoso\n*fue ciego.*'} on={on(0)} className={css.h2} paso={0.12} />
        <p className={`${css.texto} ${v(1)}`}>Las manos leen lo que los ojos no ven.</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 9 */

function Credenciales({ v, on }: Props) {
  const [video, setVideo] = useState(false);
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.7fr 1fr' }}>
      <div className={`${css.foto} ${css.fotoAlta} ${v(0, css.rCortina)}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clase/credenciales.webp" alt="Sorela Caro en cabina" />
      </div>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Por qué puedo enseñarte esto</Eyebrow>
        <Titulo texto="Sorela Caro" on={on(0)} className={css.h2} />
        <p className={`${css.textoSuave} ${v(0)}`} style={d(0.3)}>
          Creadora de la Técnica Divine
        </p>
        <div className={css.cuatro}>
          <div className={`${css.vidrio} ${css.dato} ${v(0, css.rArriba)}`} style={d(0.5)}>
            <b>
              <Cuenta a={30} on={on(0)} />
            </b>
            <span>años con las manos en el cuerpo de otras personas</span>
          </div>
          <div className={`${css.vidrio} ${css.dato} ${v(0, css.rArriba)}`} style={d(0.65)}>
            <b>
              +<Cuenta a={25000} on={on(0)} ms={2200} />
            </b>
            <span>casos en cabina</span>
          </div>
          <div className={`${css.vidrio} ${css.dato} ${css.datoRevista} ${v(0, css.rArriba)}`} style={d(0.8)}>
            <b>
              <Cuenta a={6} on={on(0)} />
            </b>
            <span>páginas en la revista Nueva Estética</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/clase/revista.webp" alt="" />
          </div>
          <button
            type="button"
            className={`${css.vidrio} ${css.dato} ${v(0, css.rArriba)}`}
            style={d(0.95)}
            onClick={(e) => (e.stopPropagation(), VIDEOS.tele && setVideo(true))}
          >
            <b>TV</b>
            <span>entrevista en televisión · clip de 30 segundos</span>
            {VIDEOS.tele && (
              <span className={css.playRedondo}>
                <Icono n="play" />
              </span>
            )}
          </button>
        </div>
      </div>
      {video && <VideoModal src={VIDEOS.tele} onCerrar={() => setVideo(false)} />}
    </div>
  );
}

/* -------------------------------------------------------------- 10 */

function Metodo({ v, on }: Props) {
  const pasos = [
    ['ojo', 'Observar', 'Mira y escucha'],
    ['lupa', 'Interpretar', 'Entiende qué hay detrás'],
    ['decidir', 'Decidir', 'Elige por dónde empezar'],
  ];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>El método</Eyebrow>
      <Titulo texto="Lo que hago con cada clienta *antes de tocarla*" on={on(0)} className={css.h2} />
      <div className={css.metodo}>
        {pasos.map(([i, t, s], k) => (
          <div key={t} className={css.metodoTramo}>
            <div className={`${css.metodoPaso} ${v(k + 1, css.rEscala)}`}>
              <div className={`${css.orbe} ${on(k + 1) && !on(k + 2) ? css.orbeActivo : ''}`}>
                <span className={css.orbeNum}>{k + 1}</span>
                <Icono n={i} className={css.orbeIcono} />
              </div>
              <h3>{t}</h3>
              <p>{s}</p>
            </div>
            {k < 2 && <Flecha className={v(k + 2)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 11 */

function Observar({ v, on }: Props) {
  const mira = ['La piel', 'La postura', 'La respiración', 'Dónde retiene'];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Paso 1 · Observar</Eyebrow>
      <Titulo texto="Antes de tocar, *mira y escucha*" on={on(0)} className={css.h2} />
      <div className={css.dosCol} style={{ gridTemplateColumns: '0.7fr 1fr', marginTop: 40 }}>
        <div className={`${css.vidrio} ${css.cuerpoCaja} ${v(0, css.rEscala)}`} style={d(0.3)}>
          <Cuerpo
            on={on(0)}
            puntos={[
              { x: 100, y: 96, etiqueta: 'Nudos', lado: 'der' },
              { x: 100, y: 180, etiqueta: 'Atascos', lado: 'der' },
              { x: 84, y: 300, etiqueta: 'Bloqueos', lado: 'der' },
            ]}
          />
        </div>
        <div className={css.columna} style={{ gap: 28 }}>
          <div className={`${css.oscuraCaja} ${css.panel} ${v(1, css.rDer)}`}>
            <h3>
              <span className={css.circuloIconoOscuro}>
                <Icono n="ojo" />
              </span>
              Mira
            </h3>
            <div className={css.fila}>
              {mira.map((m, k) => (
                <span key={m} className={`${css.chipOscuro} ${v(1)}`} style={d(0.4 + k * 0.2)}>
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div className={`${css.vidrio} ${css.panel} ${v(2, css.rDer)}`}>
            <h3>
              <span className={css.circuloIcono}>
                <Icono n="oreja" />
              </span>
              Escucha
            </h3>
            <p className={css.texto}>
              La zona que te señala suele ser <b>el final del problema, no el principio.</b>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 12 */

function NoTocar({ v, on }: Props) {
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Paso 1 · Observar</Eyebrow>
      <Titulo texto={'Saber *cuándo no tocar*\ntambién es técnica'} on={on(0)} className={css.h2} />
      <div className={css.dosIguales}>
        <div className={`${css.oscuraCaja} ${css.aviso} ${v(0, css.rArriba)}`} style={d(0.5)}>
          <h3>
            <span className={css.luzRoja} />
            Primero, el visto bueno de su médico
          </h3>
          <ul>
            {['Antecedentes de cáncer', 'Problemas cardíacos'].map((t, k) => (
              <li key={t} className={v(0)} style={d(0.9 + k * 0.2)}>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className={`${css.oscuraCaja} ${css.aviso} ${v(1, css.rArriba)}`}>
          <h3>
            <span className={css.luzAmbar} />
            Con más suavidad
          </h3>
          <ul>
            {['Mayores de 60 años', 'Lipedema', 'Linfedema'].map((t, k) => (
              <li key={t} className={v(1)} style={d(0.4 + k * 0.2)}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 13 */

function Interpretar({ v, on }: Props) {
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '1.3fr 0.7fr', alignItems: 'stretch' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Paso 2 · Interpretar</Eyebrow>
        <Titulo texto="El cuerpo expresa *lo que esconde el alma*" on={on(0)} className={`${css.h2} ${css.h2medio}`} />
        <p className={`${css.textoSuave} ${v(0)}`} style={d(0.7)}>
          O lo que muchas veces no sabemos poner en palabras.
        </p>
        <div className={css.dosIguales} style={{ marginTop: 36 }}>
          {[
            { n: 'A', detras: 'tensión y estrés', p: on(1) ? { x: 100, y: 120, tono: 'oro' as const } : { x: 100, y: 180 } },
            { n: 'B', detras: 'retención en piernas', p: on(2) ? { x: 86, y: 330 } : { x: 100, y: 180 } },
          ].map((c, k) => (
            <div key={c.n} className={`${css.oscuraCaja} ${css.clienta} ${v(0, css.rArriba)}`} style={d(0.4 + k * 0.2)}>
              <Eyebrow>Clienta {c.n}</Eyebrow>
              <Cuerpo on={on(0)} oscuro puntos={[{ ...c.p }]} className={css.cuerpoPeque} />
              <p>Hinchazón en el abdomen.</p>
              <p className={`${css.detras} ${v(k + 1)}`}>
                Detrás: <b>{c.detras}</b>.
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className={css.misma}>
        <Titulo as="p" texto={'Misma queja.\n*Distinto origen.*\nDistinta sesión.'} on={on(3)} className={css.h3grande} paso={0.12} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 14 */

function Noventa({ v, on }: Props) {
  const epocas = [
    ['Años 30', 'Nace el drenaje manual clásico', 'Un protocolo pensado para los cuerpos de entonces'],
    ['Hoy', 'Cuerpos sentados, con estrés y otra alimentación', 'Lo que llega a tu cabina ya no es igual'],
    ['Divine', 'Ritmo, sentido y conciencia', 'Leer cada cuerpo antes de decidir'],
  ];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Paso 2 · Interpretar</Eyebrow>
      <Titulo texto={'El drenaje de hace *90 años*\nno llega a los cuerpos de hoy'} on={on(0)} className={css.h2} />
      <div className={css.dosCol} style={{ gridTemplateColumns: '0.6fr 1fr', marginTop: 30 }}>
        <div className={`${css.vidrio} ${css.cuerpoCaja} ${css.cuerpoCajaBaja} ${v(0, css.rEscala)}`} style={d(0.3)}>
          <Eyebrow>Ganglios · y su recorrido</Eyebrow>
          <Cuerpo on={on(0)} linfa puntos={[]} />
        </div>
        <div className={css.columna} style={{ gap: 22 }}>
          {epocas.map(([e, t, s], k) => (
            <div key={e} className={`${k === 2 ? css.epocaOscura : css.vidrio} ${css.epoca} ${v(k, css.rDer)}`} style={d(k === 0 ? 0.6 : 0)}>
              <span className={css.epocaAno}>{e}</span>
              <div>
                <b>{t}</b>
                <span>{s}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 15 */

function Secuencia({ v, on }: Props) {
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Paso 3 · Decidir</Eyebrow>
      <Titulo texto="La *secuencia*" on={on(0)} className={css.h2} />
      <div className={css.secuencia}>
        <div className={`${css.vidrio} ${css.sec} ${v(1, css.rArriba)}`}>
          <div className={css.cosaCabeza}>
            <span className={css.circuloIcono}>
              <Icono n="reloj" />
            </span>
            <span className={css.numNegro}>1</span>
          </div>
          <h3>
            Estimulación
            <br />
            ganglionar
          </h3>
          <div className={css.anillo}>
            <svg viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="17" className={css.anilloFondo} />
              <circle cx="20" cy="20" r="17" className={`${css.anilloLleno} ${on(1) ? css.on : ''}`} />
            </svg>
            <span>≈ 10 minutos</span>
          </div>
        </div>
        <Flecha className={v(2)} />
        <div className={`${css.vidrio} ${css.sec} ${v(2, css.rArriba)}`}>
          <div className={css.cosaCabeza}>
            <span className={css.circuloIcono}>
              <Icono n="onda" />
            </span>
            <span className={css.numNegro}>2</span>
          </div>
          <h3>
            Escucha
            <br />
            el abdomen
          </h3>
          <svg viewBox="0 0 300 60" className={`${css.ondaSonido} ${on(2) ? css.on : ''}`}>
            <path d="M0 30 H70 L82 10 L94 50 L106 4 L118 56 L130 18 L142 40 L154 30 H300" />
          </svg>
        </div>
        <Flecha className={v(3)} />
        <div className={`${css.vidrio} ${css.sec} ${v(3, css.rArriba)}`}>
          <div className={css.cosaCabeza}>
            <span className={css.circuloIcono}>
              <Icono n="ola" />
            </span>
            <span className={css.numNegro}>3</span>
          </div>
          <h3>
            Maniobras
            <br />
            lentas
          </h3>
          <svg viewBox="0 0 300 60" className={`${css.ondaLenta} ${on(3) ? css.on : ''}`}>
            <path d="M0 40 C50 40 60 12 110 12 S170 48 220 48 S280 20 300 20" />
          </svg>
        </div>
      </div>
      <div className={css.fila} style={{ marginTop: 50 }}>
        <span className={`${css.barraOscura} ${v(2)}`} style={d(0.8)}>
          <Icono n="oreja" className={css.chipIcono} />
          «Si suena, has llegado a capas profundas»
        </span>
        <span className={`${css.texto} ${v(3)}`} style={{ ...d(0.8), margin: 0 }}>
          Con <b className={css.oroTexto}>ritmo</b> · <b className={css.oroTexto}>sentido</b> · <b className={css.oroTexto}>conciencia</b>
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 16 */

function CuerpoLimpio({ v, on }: Props) {
  const capas = ['Tus tratamientos', 'Tu cosmética', 'Tu aparatología'];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Paso 3 · Decidir</Eyebrow>
        <Titulo texto={'Sobre un cuerpo\nlimpio, *todo lo\ndemás funciona*'} on={on(0)} className={css.h2} />
        <p className={`${css.texto} ${v(3)}`} style={d(0.5)}>
          Solo con las manos. No sustituye lo que ya haces: <b>hace que funcione.</b>
        </p>
      </div>
      <div className={css.pila}>
        {capas.map((c, k) => (
          <div key={c} className={`${css.capa} ${v(3 - k, css.rCae)}`} style={{ width: `${66 + k * 6}%` }}>
            {c}
          </div>
        ))}
        <div className={`${css.capaBase} ${v(0, css.rArriba)}`} style={d(0.6)}>
          Técnica Divine · cuerpo limpio
          <span className={css.brillo} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 17 */

function Casos({ v, on }: Props) {
  return (
    <div className={css.columna}>
      <div className={css.filaEntre}>
        <div>
          <Eyebrow className={v(0)}>Casos reales</Eyebrow>
          <Titulo texto="Una sesión. *55 minutos.*" on={on(0)} className={css.h2} />
        </div>
        <div className={css.fila}>
          {['Qué observó', 'Qué interpretó', 'Qué decidió'].map((t, k) => (
            <span key={t} className={`${css.chipOscuro} ${v(0)}`} style={d(0.6 + k * 0.15)}>
              <span className={css.puntoOro} /> {t}
            </span>
          ))}
        </div>
      </div>
      <div className={css.dosIguales} style={{ marginTop: 40 }}>
        <div className={v(0, css.rArriba)} style={d(0.4)}>
          <AntesDespues antes="/clase/abdomen-antes.webp" despues="/clase/abdomen-despues.webp" on={on(1)} alto={620} />
          <p className={css.pieFoto}>Abdomen · arrastra la línea</p>
        </div>
        <div className={v(0, css.rArriba)} style={d(0.55)}>
          <AntesDespues antes="/clase/rostro-antes.webp" despues="/clase/rostro-despues.webp" on={on(2)} alto={620} />
          <p className={css.pieFoto}>Rostro · sin aparatos</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- 17b */

function Caso2({ v, on }: Props) {
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.5fr 1fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Casos reales</Eyebrow>
        <Titulo texto={'Otro abdomen,\n*el mismo criterio.*'} on={on(0)} className={css.h2} />
        <div className={css.columna} style={{ gap: 14, marginTop: 40, alignItems: 'flex-start' }}>
          {['Qué observó', 'Qué interpretó', 'Qué decidió'].map((t, k) => (
            <span key={t} className={`${css.chipOscuro} ${v(0, css.rIzq)}`} style={d(0.6 + k * 0.15)}>
              <span className={css.puntoOro} /> {t}
            </span>
          ))}
        </div>
        <p className={`${css.pieFoto} ${v(1)}`} style={{ marginTop: 34 }}>
          Arrastra la línea para comparar
        </p>
      </div>
      <div className={v(0, css.rEscala)} style={d(0.4)}>
        <AntesDespues antes="/clase/abdomen2-antes.webp" despues="/clase/abdomen2-despues.webp" on={on(1)} alto={692} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 18 */

function Lunes({ v, on }: Props) {
  const { estado, cambiar } = useClase();
  const preguntas = ['¿Qué veo?', '¿Qué me dice su cuerpo?', '¿Por dónde empiezo, y por qué?'];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.8fr 1fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Tu lunes</Eyebrow>
        <Titulo texto={'Antes de tu\npróxima clienta,\n*pregúntate esto*'} on={on(0)} className={css.h2} />
        <span className={`${css.barraOscura} ${v(0)}`} style={{ ...d(0.8), alignSelf: 'flex-start' }}>
          <Icono n="ficha" className={css.chipIcono} />
          La ficha completa te llega hoy
        </span>
      </div>
      <div className={`${css.ficha} ${v(0, css.rGiro)}`} style={d(0.4)}>
        <div className={css.filaEntre}>
          <div>
            <Eyebrow>Ficha de valoración</Eyebrow>
            <h3 className={css.fichaTitulo}>Lo que miro antes de tocar</h3>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clase/logo-tinta.webp" alt="" className={css.fichaLogo} />
        </div>
        {preguntas.map((p, k) => (
          <button
            type="button"
            key={p}
            className={`${css.fichaLinea} ${v(k + 1, css.rDer)}`}
            onClick={(e) => {
              e.stopPropagation();
              cambiar((s) => {
                const fichas = [...s.fichas];
                fichas[k] = !fichas[k];
                return { ...s, fichas };
              });
            }}
          >
            <span className={`${css.casilla} ${estado.fichas[k] ? css.casillaOn : ''}`}>
              <Icono n="check" />
            </span>
            <span className={css.fichaPregunta}>{p}</span>
            <span className={css.numFino}>0{k + 1}</span>
          </button>
        ))}
        <div className={css.fichaRenglones}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 19 */

function Prueba({ v, on }: Props) {
  const [video, setVideo] = useState(false);
  const pasos = ['Resultado desde la 1ª sesión', 'Vuelve sin convencerla', 'Agenda llena'];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.8fr 1fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>La prueba</Eyebrow>
        <Titulo texto={'Lo que cambia *en tu\ncabina*'} on={on(0)} className={css.h2} />
        <div className={css.escalera}>
          {pasos.map((p, k) => (
            <div key={p} className={css.columna} style={{ gap: 8 }}>
              <div className={`${k === 2 ? css.cajaOro : css.caja} ${v(k + 1, css.rIzq)}`}>{p}</div>
              {k < 2 && <span className={`${css.flechaAbajo} ${v(k + 2)}`}>↓</span>}
            </div>
          ))}
        </div>
      </div>
      <div className={v(0, css.rEscala)} style={d(0.4)}>
        <AntesDespues antes="/clase/prueba-antes.webp" despues="/clase/prueba-despues.webp" on={on(1)} alto={640} />
        <div className={css.filaEntre} style={{ marginTop: 18 }}>
          <span className={css.pieFoto}>Alumna en prácticas · facial sin aparatos</span>
          <button
            type="button"
            className={`${css.chipOscuro} ${VIDEOS.beatriz ? css.chipBoton : ''}`}
            onClick={(e) => (e.stopPropagation(), VIDEOS.beatriz && setVideo(true))}
          >
            {VIDEOS.beatriz && <Icono n="play" className={css.chipIcono} />}
            Testimonio de Beatriz · 1 min
          </button>
        </div>
      </div>
      {video && <VideoModal src={VIDEOS.beatriz} onCerrar={() => setVideo(false)} />}
    </div>
  );
}

/* -------------------------------------------------------------- 20 */

function Metodologia({ activa, estatica, v, on }: Props) {
  const dias = [
    ['Día 1', 'Abdomen', 'Trabajo interior y exterior.'],
    ['Día 2', 'Piernas y glúteos', 'Lipedema · Linfedema · Armonización.'],
    ['Día 3', 'Facial y brazos', 'Técnica y protocolos.'],
  ];
  return (
    <div className={css.columna}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Metodología Divine®</Eyebrow>
        <Titulo texto={'Aprende *online*.\nPractica *presencialmente*.'} on={on(0)} className={css.h2} />
        <div className={css.fila} style={{ marginTop: 26 }}>
          {SEDES.map((s, k) => (
            <span key={s.ciudad} className={`${css.chipOscuro} ${css.chipGrande} ${v(0)}`} style={d(0.8 + k * 0.15)}>
              <Icono n="pin" className={css.chipIcono} /> {s.ciudad} · {s.fechas}
              {k === 0 && !estatica && (
                <em className={css.chipSuave}>
                  · <Quedan hasta={s.inicio} activa={activa} />
                </em>
              )}
            </span>
          ))}
        </div>
      </div>
      <div className={css.fases2}>
        <div className={`${css.oscuraCaja} ${css.faseCaja} ${v(1, css.rIzq)}`}>
          <span className={css.faseNum}>Fase 1</span>
          <h3>Preparación online</h3>
          <ul className={css.lista}>
            {['Acceso inmediato al aula virtual.', 'Formación teórica.', 'Estudio a tu ritmo.'].map((t, k) => (
              <li key={t} className={v(1)} style={d(0.4 + k * 0.18)}>
                <Icono n="check" className={css.chipIcono} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <Flecha className={v(2)} style={{ width: 90, flex: 'none' }} />
        <div className={`${css.oscuraCaja} ${css.faseCaja} ${css.faseCajaOro} ${v(2, css.rDer)}`}>
          <span className={css.faseNum}>Fase 2 · Caracas o Medellín</span>
          <h3>Formación presencial</h3>
          <div className={css.dias}>
            {dias.map(([f, t, s], k) => (
              <div key={f} className={`${css.dia} ${v(2)}`} style={d(0.4 + k * 0.25)}>
                <span className={css.diaFecha}>{f}</span>
                <div>
                  <b>{t}</b>
                  <span>{s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={`${css.barraOscura} ${css.barraOro} ${v(3)}`} style={{ alignSelf: 'center' }}>
        Tres días para aprender, practicar y ganar seguridad profesional.
        <span className={css.brillo} />
      </div>
    </div>
  );
}

function Presencial({ v, on }: Props) {
  const [elegida, setElegida] = useState(0);
  const [sede, setSede] = useState(0);
  const incluye = [
    ['libro', 'Academia online incluida'],
    ['gente', 'Material, modelos y comida'],
    ['chispa', 'Cena de gala y certificado'],
  ];
  return (
    <div className={css.columna}>
      <div className={css.filaEntre} style={{ alignItems: 'flex-end' }}>
        <div>
          <Eyebrow className={v(0)}>Technique Divine® · Formación presencial</Eyebrow>
          <Titulo texto={'Tres días, *dos ciudades*'} on={on(0)} className={css.h2} />
        </div>
        <div className={css.fila}>
          {SEDES.map((s, k) => (
            <button
              type="button"
              key={s.ciudad}
              className={`${css.sede} ${k === sede ? css.sedeOn : ''} ${v(0)}`}
              style={d(0.5 + k * 0.12)}
              onClick={(e) => (e.stopPropagation(), setSede(k))}
            >
              <Icono n="pin" className={css.chipIcono} />
              <span>
                <b>{s.ciudad}</b>
                <small>{s.fechas}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className={css.formaciones} style={{ marginTop: 50 }}>
        {FORMACIONES.map((f, k) => (
          <button
            type="button"
            key={f.nombre}
            className={`${k === elegida ? css.formacionOn : ''} ${css.formacion} ${v(k + 1, css.rArriba)}`}
            onClick={(e) => (e.stopPropagation(), setElegida(k))}
          >
            {k === 0 && <span className={css.corona}>Recomendada</span>}
            <span className={css.formacionTipo}>Formación</span>
            <b className={css.formacionNombre}>{f.nombre}</b>
            <span className={css.formacionDias}>{f.dias}</span>
            <span className={css.formacionPrecio}>
              <Cuenta a={f.precio} on={on(k + 1)} ms={1400} /> <small>USD</small>
            </span>
            <span className={css.formacionReserva}>
              Reserva <b>{f.reserva} USD</b>
            </span>
          </button>
        ))}
      </div>
      <div className={`${css.zonas} ${v(3)}`} style={d(0.6)}>
        {incluye.map(([i, t]) => (
          <span key={t} className={css.zona}>
            <Icono n={i} className={css.chipIcono} /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Online({ v, on }: Props) {
  const incluye = [
    ['libro', 'Acceso a nuestra Academia Virtual.'],
    ['carpeta', 'Dosieres profesionales y material audiovisual.'],
    ['pantalla', 'Una clase en directo con Sorela Caro por cada módulo.'],
    ['mano', 'Clase práctica online con modelo real.'],
    ['gente', 'Incorporación a la Comunidad Divine®.'],
    ['escudo', 'Acompañamiento y apoyo continuado.'],
  ];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '1fr 0.85fr', alignItems: 'center' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Formación profesional · 100 % online</Eyebrow>
        <Titulo texto={'Divine® Online:\n*inversión en tu formación*'} on={on(0)} className={css.h2} />
        <p className={`${css.textoSuave} ${v(0)}`} style={d(0.6)}>
          Especialízate en la Técnica Divine® desde cualquier lugar del mundo.
        </p>
        <div className={css.incluye}>
          {incluye.map(([i, t], k) => (
            <span key={t} className={`${css.itemIcono} ${css.itemIconoPeque} ${v(0, css.rIzq)}`} style={d(0.9 + k * 0.14)}>
              <span className={css.circuloIcono}>
                <Icono n={i} />
              </span>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className={css.columna} style={{ gap: 22 }}>
        <div className={`${css.precioOscuro} ${css.precio} ${css.precioOnline} ${v(1, css.rArriba)}`}>
          <div className={css.filaEntre}>
            <Eyebrow>Inversión en tu formación</Eyebrow>
            <span className={css.insignia}>Precio especial</span>
          </div>
          <p className={css.precioHabitual}>
            Precio habitual <s className={on(1) ? css.tachadoOn : ''}>{ONLINE.habitual} USD</s>
          </p>
          <p className={css.cifra}>
            <Cuenta a={ONLINE.especial} on={on(1)} ms={1600} />
            <small>USD</small>
          </p>
          <div className={`${css.reservaBanda} ${v(2)}`}>
            <Icono n="calendario" className={css.chipIcono} />
            Reserva tu plaza con solo <b>{ONLINE.reserva} USD</b>
          </div>
          <p className={`${css.precioNota} ${v(2)}`} style={d(0.3)}>
            Tu reserva garantiza tu plaza y el precio promocional de la formación.
          </p>
          <span className={css.brillo} />
        </div>
        <p className={`${css.textoSuave} ${v(3)}`} style={{ margin: 0 }}>
          <b>Mucho más que una formación.</b> No vienes solamente a aprender una técnica. Vienes a formar parte de una comunidad profesional que te acompaña.
        </p>
      </div>
    </div>
  );
}

function Despues({ v, on }: Props) {
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '1.1fr 0.9fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Después de formarte</Eyebrow>
        <Titulo texto={'¿Y qué pasa *después\nde formarte?*'} on={on(0)} className={css.h2} />
        <p className={`${css.texto} ${css.textoAncho} ${v(0)}`} style={d(0.7)}>
          Aprender una técnica es importante, pero <b>mantenerse actualizada, acompañada y en constante evolución</b> es lo que marca la diferencia.
        </p>
        <p className={`${css.texto} ${css.textoAncho} ${v(1)}`}>
          Sabemos que muchas profesionales terminan una formación y después se encuentran <b>solas, con dudas, inseguridades</b> y sin saber cómo seguir avanzando.
        </p>
        <p className={`${css.textoGrandeOro} ${v(2)}`}>Por eso hemos creado algo más.</p>
      </div>
      <div className={`${css.foto} ${css.fotoAlta} ${v(0, css.rCortina)}`} style={d(0.3)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clase/despues.webp" alt="Sorela con una alumna" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 21 */

function Comunidad({ v, on }: Props) {
  const tres = [
    ['libro', 'Sigues aprendiendo'],
    ['gente', 'Sigues acompañada'],
    ['chispa', 'Sigues evolucionando'],
  ];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.85fr 1fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Bienvenida a la</Eyebrow>
        <Titulo texto={'Comunidad\n*Divine®*'} on={on(0)} className={css.h1crema} paso={0.2} />
        <p className={`${css.texto} ${v(0)}`} style={{ ...d(0.7), maxWidth: '30ch' }}>
          Divine® no quiere que simplemente aprendas. <b>Queremos que sigas creciendo, evolucionando y formando parte de una comunidad profesional.</b>
        </p>
        <span className={`${css.barraOscura} ${v(1)}`} style={{ ...d(0.5), alignSelf: 'flex-start', marginTop: 22 }}>
          <Icono n="calendario" className={css.chipIcono} /> Solo para terapeutas homologadas por Sorela
        </span>
        <div className={css.fila} style={{ gap: 22, marginTop: 24 }}>
          {tres.map(([i, t], k) => (
            <span key={t} className={`${css.itemIcono} ${css.itemIconoPeque} ${v(1, css.rIzq)}`} style={d(k * 0.2)}>
              <span className={css.circuloIcono}>
                <Icono n={i} />
              </span>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className={`${css.foto} ${css.fotoAncha} ${v(0, css.rEscala)}`} style={{ ...d(0.5), height: 640 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clase/grupo.webp" alt="Sorela con su equipo de alumnas" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 22 */

function Dentro({ v, on }: Props) {
  const items = [
    ['pantalla', 'Clase en directo', 'Una cada mes, conmigo, y queda grabada'],
    ['chat', 'Canal en la plataforma', 'Consultas y aportes, dentro de la web de Divine®'],
    ['ficha', 'Fichas, vídeos y dossier', 'Fichas descargables y vídeos paso a paso'],
    ['pin', 'Localiza tu terapeuta', 'Si estás homologada por Sorela, apareces en el mapa mundial de terapeutas Divine®'],
    ['chispa', 'Agente IA para tu negocio', 'Adaptado a tu centro, a tus servicios y a tus clientas'],
  ];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Qué hay dentro</Eyebrow>
      <Titulo texto="Todo lo que necesitas, *en un solo sitio*" on={on(0)} className={css.h2} />
      <div className={css.cinco}>
        {items.map(([i, t, s], j) => (
          <div key={t} className={`${css.vidrio} ${css.item} ${v(0, css.rArriba)}`} style={d(0.5 + j * 0.14)}>
            <span className={css.circuloIcono}>
              <Icono n={i} />
            </span>
            <h3>{t}</h3>
            <p>{s}</p>
            {j === 3 && (
              <span className={css.sello}>
                <Icono n="escudo" className={css.chipIcono} /> Homologada Divine®
              </span>
            )}
            {j === 4 && (
              <span className={css.sello}>
                <Icono n="chispa" className={css.chipIcono} /> Conectado a tu negocio
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 23 */

function PreguntaIA({ v, on }: Props) {
  const { estado, cambiar } = useClase();
  const [si, no] = estado.tec;
  const total = si + no;
  const sumar = (k: 0 | 1, n: number) =>
    cambiar((st) => {
      const tec = [...st.tec] as [number, number];
      tec[k] = Math.max(0, tec[k] + n);
      return { ...st, tec };
    });
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Una pregunta antes de seguir</Eyebrow>
      <Titulo
        texto={'¿Cuántas creéis que la tecnología y la IA\n*están cambiando radicalmente*\nel mundo y la forma de trabajar?'}
        on={on(0)}
        className={`${css.h2} ${css.tituloPregunta}`}
      />
      <div className={css.encuesta}>
        {(['Sí', 'No'] as const).map((t, k) => {
          const n = estado.tec[k];
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <div key={t} className={`${css.oscuraCaja} ${css.voto2} ${v(0, css.rArriba)}`} style={d(1.4 + k * 0.15)}>
              <div className={css.filaEntre}>
                <b className={css.voto2Texto}>{t}</b>
                <span className={css.voto2Num} key={n}>
                  {n}
                  {total > 0 && <em> · {pct} %</em>}
                </span>
              </div>
              <div className={css.voto}>
                <span className={css.votoBarra} style={{ width: `${pct}%` }} />
              </div>
              <div className={css.fila}>
                <button type="button" className={css.boton} onClick={(e) => (e.stopPropagation(), sumar(k as 0 | 1, 1))}>
                  +1
                </button>
                <button type="button" className={css.boton} onClick={(e) => (e.stopPropagation(), sumar(k as 0 | 1, 5))}>
                  +5
                </button>
                <button type="button" className={css.miniSuave} onClick={(e) => (e.stopPropagation(), sumar(k as 0 | 1, -1))}>
                  −1
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`${css.datoGrande} ${v(1)}`}>
        <b>
          <Cuenta a={86} on={on(1)} /> %
        </b>
        <span>
          de las empresas del mundo espera que la IA <strong>transforme su negocio antes de 2030</strong>.
          <small>Foro Económico Mundial · Future of Jobs Report 2025 (1.000 empresas, 55 países)</small>
        </span>
      </div>
      <Chip icono="chat" className={`${css.chipEsquina} ${v(0)}`} style={d(1.2)}>
        Escribe SÍ o NO en el chat
      </Chip>
    </div>
  );
}

function Crecer({ v, on }: Props) {
  const tres = [
    ['libro', 'Te formas', 'La Técnica Divine®, con método y criterio.'],
    ['gente', 'Creces acompañada', 'Una comunidad profesional que no te deja sola.'],
    ['chispa', 'Crece tu negocio', 'Un Agente IA Divine adaptado a tu centro.'],
  ];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Nos hemos dado cuenta</Eyebrow>
      <Titulo texto={'Una cosa es *formarte*.\nOtra es *hacer crecer tu negocio*.'} on={on(0)} className={css.h2} />
      <div className={`${css.vidrio} ${css.datoCrema} ${v(0, css.rArriba)}`} style={d(0.9)}>
        <b>
          <Cuenta a={41.9} decimales={1} on={on(0)} ms={1800} /> %
        </b>
        <span>
          de las empresas que nacen en España <strong>sigue abierta a los cinco años</strong>. Más de la mitad cierra antes.
          <small>INE · Demografía Armonizada de Empresas (empresas nacidas en 2018)</small>
        </span>
      </div>
      <p className={`${css.texto} ${css.textoAncho} ${v(1)}`} style={{ maxWidth: '60ch' }}>
        Ser muy buena con las manos no basta para que la agenda se llene. Por eso Divine® no solo te forma: <b>te forma, te acompaña y hace crecer tu negocio.</b>
      </p>
      <div className={css.tres} style={{ margin: '34px 0 0' }}>
        {tres.map(([i, t, s], k) => (
          <div key={t} className={`${k === 2 ? css.epocaOscura : css.vidrio} ${css.pilar} ${v(2, css.rArriba)}`} style={d(k * 0.2)}>
            <span className={k === 2 ? css.circuloIconoOscuro : css.circuloIcono}>
              <Icono n={i} />
            </span>
            <div>
              <b>{t}</b>
              <span>{s}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 23 */

/** Lo que el agente conecta, alrededor del centro (x, y en un lienzo de 760×620). */
const CONEXIONES: [string, string, number, number][] = [
  ['calendario', 'Agenda', 380, 70],
  ['chat', 'WhatsApp', 640, 170],
  ['chispa', 'Instagram y Facebook', 650, 450],
  ['ficha', 'Registros y fichas', 380, 560],
  ['pantalla', 'Tu web', 110, 450],
  ['tarjeta', 'Ventas y cobros', 120, 170],
];

function Agente({ activa, estatica, v, on }: Props) {
  const [vuelta, setVuelta] = useState(0);
  const acciones: [string, string, string][] = [
    ['avion', 'Reel creado y publicado', 'Un vídeo con tu marca, a partir de tu sesión, en Instagram y Facebook.'],
    ['chat', 'Clienta nueva por Instagram', 'Le explico el drenaje, resuelvo sus dudas y la dejo agendada.'],
    ['ficha', 'Registro desde tu web', 'Ficha creada, bienvenida enviada y primera cita propuesta.'],
    ['tarjeta', 'Venta cerrada', 'Bono de 5 sesiones pagado online. Ya está en tu agenda.'],
  ];
  const k = useGoteo(acciones.length, activa && !estatica, 1500, 1800, vuelta);
  const vistas = estatica ? acciones.length : k;
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '1fr 1fr', gap: 70 }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Por eso hemos construido</Eyebrow>
        <Titulo texto={'El Agente IA Divine,\n*adaptado a tu negocio*'} on={on(0)} className={`${css.h2} ${css.h2medio}`} />
        <p className={`${css.texto} ${v(0)}`} style={{ ...d(0.6), maxWidth: '36ch' }}>
          Se instala en tu web con un complemento y se conecta con tu agenda, tu WhatsApp, tus redes y tus registros. No solo responde: <b>ejecuta, publica y vende por ti.</b>
        </p>
        <div className={css.fila} style={{ marginTop: 26, gap: 10 }}>
          {['Responde', 'Ejecuta', 'Publica', 'Crea vídeos', 'Vende'].map((t, i) => (
            <span key={t} className={`${css.verbo} ${v(0)}`} style={d(1 + i * 0.12)}>
              {t}
            </span>
          ))}
        </div>
        <svg viewBox="0 0 760 620" className={`${css.red} ${v(0, css.rEscala)}`} style={d(0.4)}>
          {CONEXIONES.map(([, , x, y], i) => (
            <g key={i}>
              <path d={`M${x} ${y} L380 310`} className={css.redLinea} />
              {on(0) && !estatica && <path d={`M${x} ${y} L380 310`} className={css.redFlujo} style={{ animationDelay: `${i * 0.25}s` }} />}
            </g>
          ))}
          <circle cx="380" cy="310" r="118" className={css.redHalo} />
          <circle cx="380" cy="310" r="86" className={css.redCentro} />
          <text x="380" y="300" textAnchor="middle" className={css.redCentroTexto}>
            Agente
          </text>
          <text x="380" y="338" textAnchor="middle" className={css.redCentroTexto2}>
            Divine®
          </text>
          {CONEXIONES.map(([ico, t, x, y], i) => (
            <g key={t} className={`${css.redNodo} ${on(0) ? css.on : ''}`} style={{ '--d': `${0.8 + i * 0.15}s` } as CSSProperties}>
              <circle cx={x} cy={y} r="44" className={css.redNodoFondo} />
              <svg x={x - 18} y={y - 18} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={css.redIcono}>
                <Icono n={ico} className={css.redIconoSvg} />
              </svg>
              <text x={x} y={y + (y > 310 ? 74 : -58)} textAnchor="middle" className={css.redTexto}>
                {t}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className={css.columna} style={{ gap: 18 }}>
        <div className={`${css.oscuraCaja} ${css.panelAgente} ${v(0, css.rDer)}`} style={d(0.6)}>
          <div className={css.filaEntre}>
            <span className={css.panelTitulo}>
              <span className={css.enLinea} /> Hoy, mientras estás en cabina
            </span>
            <button type="button" className={css.chatOtraVez} onClick={(e) => (e.stopPropagation(), setVuelta((n) => n + 1))} title="Repetir">
              ↻
            </button>
          </div>
          <div className={css.acciones}>
            {acciones.map(([ico, t, s], i) => (
              <div key={t} className={`${css.accion} ${i < vistas ? css.avisoOn : ''}`}>
                <span className={css.circuloIconoOscuro}>
                  <Icono n={ico} />
                </span>
                <div>
                  <b>{t}</b>
                  <span>{s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <span className={`${css.barraOscura} ${css.barraOro} ${v(1)}`} style={{ alignSelf: 'flex-start', fontSize: 21, padding: '14px 26px' }}>
          Incluido en la Membresía Divine®, para terapeutas homologadas
        </span>
        <div className={css.palancas}>
          {['Más citas', 'Más ventas', 'Clientas que vuelven'].map((t, i) => (
            <span key={t} className={`${css.palanca} ${v(1, css.rArriba)}`} style={d(i * 0.18)}>
              {t}
            </span>
          ))}
        </div>
        <p className={`${css.notaDato} ${v(1)}`} style={d(0.7)}>
          <b>55 %</b> de las clientas de salones y spas ya se siente cómoda hablando con una recepcionista de IA.
          <small>Zenoti · encuesta a 1.000 clientas, 2025</small>
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 26 */

function Escanea({ v, on }: Props) {
  const { estado, cambiar } = useClase();
  const pasos = [
    ['chat', 'Escribe «QUIERO»', 'En el chat o en el grupo de WhatsApp'],
    ['gente', 'Te escribimos por privado', 'Desde el número oficial de Sorela, con tu reserva'],
    ['tarjeta', 'Reservas tu plaza', 'Tarjeta · transferencia local · cripto'],
  ];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.9fr 1fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Cómo reservar</Eyebrow>
        <Titulo texto={'Escribe *«QUIERO»*'} on={on(0)} className={css.h2} />
        <div className={`${css.quieroCaja} ${v(0, css.rEscala)}`} style={d(0.4)}>
          <span className={css.quieroPalabra}>QUIERO</span>
          <div className={css.quieroCuenta}>
            <b key={estado.quiero}>{estado.quiero}</b>
            <span>personas ya lo han escrito</span>
          </div>
          <div className={css.fila} style={{ justifyContent: 'center' }}>
            <button type="button" className={css.boton} onClick={(e) => (e.stopPropagation(), cambiar((s) => ({ ...s, quiero: s.quiero + 1 })))}>
              +1
            </button>
            <button type="button" className={css.boton} onClick={(e) => (e.stopPropagation(), cambiar((s) => ({ ...s, quiero: s.quiero + 5 })))}>
              +5
            </button>
            <button type="button" className={css.miniSuave} onClick={(e) => (e.stopPropagation(), cambiar((s) => ({ ...s, quiero: Math.max(0, s.quiero - 1) })))}>
              −1
            </button>
          </div>
        </div>
      </div>
      <div className={css.columna} style={{ gap: 24, justifyContent: 'center' }}>
        {pasos.map(([i, t, s], k) => (
          <div key={t} className={`${css.oscuraCaja} ${css.paso} ${v(k + 1, css.rDer)}`}>
            <span className={css.numOro}>{k + 1}</span>
            <div>
              <b>{t}</b>
              <span>{s}</span>
            </div>
            <Icono n={i} className={css.pasoIcono} />
          </div>
        ))}
        <p className={`${css.seguridad} ${v(3)}`} style={d(0.4)}>
          <Icono n="escudo" className={css.chipIcono} />
          <span>
            <b>Por tu seguridad:</b> solo te escribiremos desde el número oficial de Sorela. Nadie de Divine te pedirá un pago por otro canal.
          </span>
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 27 */

function Preguntas({ v, on }: Props) {
  return (
    <div className={css.preguntas}>
      <div className={css.centro} style={{ flex: 1 }}>
        <Eyebrow className={v(0)}>Preguntas</Eyebrow>
        <Titulo texto={'Pregúntame\n*lo que quieras*'} on={on(0)} className={css.h1crema} paso={0.14} />
      </div>
      <div className={css.filaEntre} style={{ alignItems: 'flex-end' }}>
        <div className={css.fila}>
          <span className={`${css.chipOscuro} ${v(0)}`} style={d(0.8)}>
            <Icono n="pantalla" className={css.chipIcono} /> Divine® Online · {ONLINE.especial} USD
          </span>
          {SEDES.map((s, k) => (
            <span key={s.ciudad} className={`${css.chipOscuro} ${v(0)}`} style={d(0.9 + k * 0.1)}>
              <Icono n="pin" className={css.chipIcono} /> {s.ciudad} · {s.fechas}
            </span>
          ))}
        </div>
        <div className={`${css.vidrio} ${css.quieroMini} ${v(0, css.rArriba)}`} style={d(1.1)}>
          <Eyebrow>Para reservar</Eyebrow>
          <b>QUIERO</b>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 28 */

function Gracias({ activa, estatica, v, on }: Props) {
  return (
    <div className={css.portada}>
      {!estatica && <Polvo activa={activa} cuantas={90} />}
      {!estatica && activa && <Polvo activa={activa} cuantas={120} rafaga />}
      <div className={css.halo} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/clase/logo-oro.webp" alt="Sorela Caro · Técnica Divine" className={`${css.logoPortada} ${v(0)}`} />
      <Titulo as="h1" texto="*Gracias.*" on={on(0)} className={css.tituloPortada} retraso={0.3} />
      <p className={`${css.sub} ${v(0)}`} style={d(0.9)}>
        Tu ficha <b>«Lo que miro antes de tocar»</b> llega hoy a tu email.
      </p>
      <div className={css.fila} style={{ justifyContent: 'center' }}>
        <Chip icono="chat" className={v(0)} style={d(1.2)}>
          Para reservar, escribe «QUIERO»
        </Chip>
        <Chip icono="calendario" className={v(0)} style={d(1.3)}>
          Caracas 4-6 dic · Medellín 10-12 dic
        </Chip>
        <Chip className={v(0)} style={d(1.4)}>
          @sorelacaro_
        </Chip>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- vídeos */

/**
 * Una diapositiva que es un vídeo a pantalla completa. Empieza solo al llegar
 * (la tecla o el clic de Sorela cuenta como gesto, así que suena) y se para al
 * irse. Pulsar encima lo pausa o lo sigue. En la vista general y en la de
 * presentador sale solo la portada.
 */
function diapoVideo(src: string, portada: string) {
  return function DiapoVideo({ activa, estatica }: Props) {
    const ref = useRef<HTMLVideoElement>(null);
    const [bloqueado, setBloqueado] = useState(false);
    useEffect(() => {
      const v = ref.current;
      if (!v || estatica) return;
      if (activa) {
        v.currentTime = 0;
        v.play().then(() => setBloqueado(false)).catch(() => setBloqueado(true));
      } else v.pause();
    }, [activa, estatica]);
    if (estatica) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={portada} alt="" className={css.videoLleno} />;
    }
    return (
      <div className={css.videoCaja}>
        <video
          ref={ref}
          src={src}
          poster={portada}
          className={css.videoLleno}
          playsInline
          preload="auto"
          onClick={(e) => {
            e.stopPropagation();
            const v = e.currentTarget;
            if (v.paused) v.play().then(() => setBloqueado(false)).catch(() => {});
            else v.pause();
          }}
        />
        {bloqueado && (
          <button
            type="button"
            className={css.videoPlay}
            onClick={(e) => {
              e.stopPropagation();
              ref.current?.play().then(() => setBloqueado(false)).catch(() => {});
            }}
          >
            <Icono n="play" /> Reproducir
          </button>
        )}
      </div>
    );
  };
}

const VideoSorela = diapoVideo(VIDEOS.sorela, VIDEOS.sorelaPortada);
const VideoMembresia = diapoVideo(VIDEOS.membresia, VIDEOS.membresiaPortada);

/* ================================================================ lista */


export const DIAPOSITIVAS: Diapo[] = [
  { id: 'portada', titulo: 'Antes de tocar', tema: 'oscuro', pasos: 0, sinPie: true, Vista: Portada, notas: 'Saluda mientras corre la cuenta atrás. Pide que escriban en el chat desde dónde te ven. Pulsar la cuenta la reinicia.' },
  { id: 'bienvenida', titulo: '¿Desde dónde nos ves?', tema: 'crema', pasos: 0, Vista: Bienvenida, notas: 'Lee ciudades del chat y pulsa cada una en el mapa para encenderla. «+ otro sitio» suma las que no salen. Pregunta cuántos años llevan con las manos.' },
  { id: 'tres-cosas', titulo: 'Hoy te llevas 3 cosas', tema: 'crema', pasos: 1, Vista: TresCosas, notas: 'Las tres cosas. Siguiente: anuncia la ficha y «una noticia» al final (solo en directo), para que se queden.' },
  { id: 'problema', titulo: 'El problema', tema: 'oscuro', pasos: 1, Vista: Bucle, notas: 'Los cuatro pasos entran solos. Suma los «1» del chat con +1 / +5. Clic: «No necesitas trabajar más. Necesitas aprender a observar, interpretar y actuar con criterio».' },
  { id: 'obstaculos', titulo: 'Los tres obstáculos', tema: 'oscuro', pasos: 3, Vista: Trampas, notas: 'Un obstáculo por clic. Pulsa cada tarjeta para sumar los votos del chat (1, 2 o 3). Al final, la frase: sin conocimiento, sin criterio y sin personalización, no hay evolución profesional.' },
  { id: 'cita', titulo: 'Qué observar, interpretar, decidir', tema: 'crema', pasos: 0, Vista: Cita, notas: 'Pausa. Deja que la frase entre entera antes de hablar.' },
  { id: 'video-sorela', titulo: 'Vídeo · Sorela Caro', tema: 'oscuro', pasos: 0, sinPie: true, Vista: VideoSorela, notas: 'Vídeo de 1 min: empieza solo. En Google Meet comparte la pestaña con «Compartir también el audio de la pestaña». Al terminar, «Ahora, en directo»: entras tú.' },
  { id: 'historia', titulo: 'Empecé peinando', tema: 'crema', pasos: 1, Vista: Historia, notas: 'Tu historia: de peluquería a las emociones. Siguiente: «Quería entender lo que la persona sentía».' },
  { id: 'aprendi', titulo: 'El masajista más famoso fue ciego', tema: 'oscuro', pasos: 1, Vista: Aprendi, notas: 'La foto está en penumbra. Siguiente: se ilumina con «Las manos leen lo que los ojos no ven».' },
  { id: 'credenciales', titulo: 'Por qué puedo enseñarte esto', tema: 'crema', pasos: 0, Vista: Credenciales, notas: '30 años, +25.000 casos, Nueva Estética, televisión. La tarjeta TV abre el clip si está cargado (lib/clase.ts).' },
  { id: 'metodo', titulo: 'El método', tema: 'crema', pasos: 3, Vista: Metodo, notas: 'Un paso por clic: Observar, Interpretar, Decidir.' },
  { id: 'observar', titulo: 'Paso 1 · Mira y escucha', tema: 'crema', fase: 1, pasos: 2, Vista: Observar, notas: 'Los puntos del cuerpo se pueden pulsar. Clic: «Mira» (piel, postura, respiración, dónde retiene). Clic: «Escucha».' },
  { id: 'no-tocar', titulo: 'Cuándo no tocar', tema: 'oscuro', fase: 1, pasos: 1, Vista: NoTocar, notas: 'Contraindicaciones: primero médico. Clic: con más suavidad.' },
  { id: 'interpretar', titulo: 'Paso 2 · El cuerpo expresa', tema: 'oscuro', fase: 2, pasos: 3, Vista: Interpretar, notas: 'El cuerpo expresa lo que esconde el alma. Clic: clienta A, el punto sube al pecho (estrés). Clic: B, baja a las piernas. Clic: «Misma queja. Distinto origen».' },
  { id: 'noventa', titulo: 'El drenaje de hace 90 años', tema: 'crema', fase: 2, pasos: 2, Vista: Noventa, notas: 'La linfa se mueve hacia los ganglios. Clic: Hoy. Clic: Divine.' },
  { id: 'secuencia', titulo: 'Paso 3 · La secuencia', tema: 'crema', fase: 3, pasos: 3, Vista: Secuencia, notas: 'Un paso por clic: estimulación ganglionar (~10 min; nunca «abrir» ganglios), escucha el abdomen, maniobras lentas.' },
  { id: 'cuerpo-limpio', titulo: 'Sobre un cuerpo limpio', tema: 'oscuro', fase: 3, pasos: 3, Vista: CuerpoLimpio, notas: 'La base primero. Cada clic apila una capa: aparatología, cosmética, tratamientos.' },
  { id: 'casos', titulo: 'Una sesión. 55 minutos', tema: 'oscuro', pasos: 2, Vista: Casos, notas: 'Clic: el abdomen se descubre. Clic: el rostro. Puedes arrastrar la línea mientras explicas.' },
  { id: 'caso-2', titulo: 'Otro abdomen, el mismo criterio', tema: 'oscuro', pasos: 1, Vista: Caso2, notas: 'Clic: la línea barre y se ve el después. Arrástrala despacio mientras cuentas qué observaste, qué interpretaste y qué decidiste.' },
  { id: 'lunes', titulo: 'Tu lunes', tema: 'crema', pasos: 3, Vista: Lunes, notas: 'Una pregunta por clic. Puedes marcar las casillas.' },
  { id: 'prueba', titulo: 'Lo que cambia en tu cabina', tema: 'oscuro', pasos: 3, Vista: Prueba, notas: 'Un escalón por clic. El antes/después se descubre en el primero.' },
  { id: 'metodologia', titulo: 'Metodología Divine®', tema: 'oscuro', pasos: 3, Vista: Metodologia, notas: 'Aprende online, practica presencialmente. Dos sedes: Caracas 4, 5 y 6 de diciembre y Medellín 10, 11 y 12. Clic: fase 1 online. Clic: los tres días presenciales. Clic: tres días para aprender, practicar y ganar seguridad.' },
  { id: 'presencial', titulo: 'Formación presencial · Medellín y Caracas', tema: 'crema', pasos: 3, Vista: Presencial, notas: 'Pulsa Caracas o Medellín arriba. Una formación por clic: completa (3 días, incluye la academia online), intensiva (2 días, dos zonas), específica (1 día, una zona). Último clic: material, modelos y comida incluidos (solo llegar), cena de gala con entrega de certificados.' },
  { id: 'online', titulo: 'Divine® Online', tema: 'crema', pasos: 3, Vista: Online, notas: 'Lo que incluye entra solo. Clic: el precio (900 se tacha, 750). Clic: reserva con 250 USD. Clic: mucho más que una formación.' },
  ...(VIDEOS.membresia ? [{ id: 'video-membresia', titulo: 'Vídeo · Membresía Divine', tema: 'oscuro' as const, pasos: 0, sinPie: true, Vista: VideoMembresia, notas: 'Vídeo cinematográfico de la membresía. Empieza solo; al terminar, sigue con «¿Y qué pasa después de formarte?».' }] : []),
  { id: 'despues', titulo: '¿Y qué pasa después de formarte?', tema: 'crema', pasos: 2, Vista: Despues, notas: 'Clic: muchas terminan solas, con dudas. Clic: «Por eso hemos creado algo más».' },
  { id: 'comunidad', titulo: 'Bienvenida a la Comunidad Divine®', tema: 'crema', pasos: 1, Vista: Comunidad, notas: 'La comunidad NO se vende hoy: es solo para terapeutas homologadas (formación completa de 3 días); a ellas se les vende en una sesión privada. Clic: el requisito.' },
  { id: 'dentro', titulo: 'Qué hay dentro', tema: 'crema', pasos: 0, Vista: Dentro, notas: 'Clases en directo mensuales y grabadas, canal en la plataforma (sin Telegram), fichas, vídeos paso a paso y dossier, Localiza tu terapeuta (mapa mundial, solo homologadas) y el agente IA.' },
  { id: 'pregunta-ia', titulo: '¿La IA está cambiando el mundo?', tema: 'oscuro', pasos: 1, Vista: PreguntaIA, notas: 'Pregunta y pide SÍ o NO en el chat. Suma con +1 / +5. Clic: el 86 % (Foro Económico Mundial, Future of Jobs Report 2025: el 86 % de las empresas espera que la IA transforme su negocio antes de 2030).' },
  { id: 'crecer', titulo: 'Formarte y hacer crecer tu negocio', tema: 'crema', pasos: 2, Vista: Crecer, notas: 'Nos hemos dado cuenta: solo el 41,9 % de las empresas que nacen en España sigue abierta a los cinco años (INE, empresas nacidas en 2018). Clic: por eso Divine te forma, te acompaña y hace crecer tu negocio. Clic: los tres pilares.' },
  { id: 'agente', titulo: 'Tu agente Divine', tema: 'oscuro', pasos: 1, Vista: Agente, notas: 'Por eso hemos construido el Agente IA Divine, adaptado a tu negocio: responde, ejecuta, publica en redes, gestiona registros y vende. Dato de abajo: Zenoti (empresa de software de salones), encuesta a 1.000 clientas en EE. UU., 2025. Se conecta con agenda, WhatsApp, Instagram, fichas, servicios y cobros. Las acciones del día entran solas (↻ las repite). Clic: más citas, menos huecos, clientas que vuelven.' },
  { id: 'reservar', titulo: 'Escribe «QUIERO»', tema: 'oscuro', pasos: 3, Vista: Escanea, notas: 'Pide que escriban QUIERO en el chat o en el grupo. Suma con +1 / +5. La persona de apoyo las saca del chat y les escribe por privado con el mensaje preparado. Último clic: aviso de seguridad (cuenta hackeada en el pasado).' },
  { id: 'preguntas', titulo: 'Preguntas', tema: 'crema', pasos: 0, Vista: Preguntas, notas: 'Turno de preguntas. Recuerda: para reservar, QUIERO.' },
  { id: 'gracias', titulo: 'Gracias', tema: 'oscuro', pasos: 0, sinPie: true, Vista: Gracias, notas: 'Cierre. La ficha llega hoy por email. QUIERO para reservar. Caracas 4-6 dic, Medellín 10-12 dic.' },
];
