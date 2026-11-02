'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { FIN_PRECIO, PLAZAS, PRECIOS, VIDEOS } from '@/lib/clase';
import { AntesDespues, Cuenta, CuentaAtras, Cuerpo, Icono, Mapa, Movil, Plazas, Polvo, Quedan, Titulo, useGoteo, VideoModal } from './piezas';
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
  const pasos = ['Entra', 'La tumbas', 'Tu protocolo\nde siempre', 'Sale igual'];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>¿Te ha pasado?</Eyebrow>
      <Titulo texto={'Pones todo de ti.\n*Y sale igual que entró.*'} on={on(0)} className={css.h2} />
      <div className={css.bucle}>
        {pasos.map((p, k) => (
          <div key={p} className={css.bucleTramo}>
            <div
              className={`${css.caja} ${k === 3 ? css.cajaFinal : ''} ${k === 3 && on(1) ? css.cajaAlarma : ''} ${v(0, css.rIzq)}`}
              style={d(0.6 + k * 0.35)}
            >
              {p.split('\n').map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
            {k < 3 && <Flecha className={v(0)} style={d(0.8 + k * 0.35)} />}
          </div>
        ))}
        <svg viewBox="0 0 1500 120" className={`${css.vuelta} ${on(0) ? css.on : ''}`} aria-hidden>
          <path d="M1290 10 C1290 90 1200 100 750 100 C300 100 150 90 150 10" />
          <path d="M1290 10 C1290 90 1200 100 750 100 C300 100 150 90 150 10" className={css.vueltaFlujo} />
          <path d="M140 24 150 8 162 22" />
        </svg>
        <span className={`${css.vueltaTexto} ${v(0)}`} style={d(2.4)}>
          Y vuelta a empezar
        </span>
      </div>
      <div className={`${css.contadorGrande} ${v(1)}`}>
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
  const trampas = [
    ['aparato', 'El aparato que\nno se paga', '−€€€'],
    ['copia', 'El mismo protocolo\npara todas', ''],
    ['mano', 'Improvisar\ny esperar', ''],
  ];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Las tres trampas</Eyebrow>
      <Titulo texto={'Por qué trabajas tanto\n*y no ves lo que esperas*'} on={on(0)} className={css.h2} />
      <div className={css.tres}>
        {trampas.map(([i, t, extra], k) => {
          const pct = total ? Math.round((estado.votos[k] / total) * 100) : 0;
          return (
            <button
              type="button"
              key={k}
              className={`${css.oscuraCaja} ${css.trampa} ${v(k + 1, css.rArriba)}`}
              onClick={(e) => {
                e.stopPropagation();
                cambiar((s) => {
                  const votos = [...s.votos] as [number, number, number];
                  votos[k]++;
                  return { ...s, votos };
                });
              }}
              title="Pulsa para sumar un voto del chat"
            >
              <div className={css.cosaCabeza}>
                <span className={css.numGrande}>{k + 1}</span>
                <span className={css.circuloIconoOscuro}>
                  <Icono n={i} />
                  {extra && <em className={css.menosDinero}>{extra}</em>}
                </span>
              </div>
              <h3>
                {t.split('\n').map((l, j) => (
                  <span key={j}>
                    {l}
                    <br />
                  </span>
                ))}
              </h3>
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
          «Sin ritmo, sin sentido, sin conciencia.»
        </p>
        <div className={css.fila}>
          {total > 0 && (
            <button
              type="button"
              className={css.miniSuave}
              onClick={(e) => (e.stopPropagation(), cambiar((s) => ({ ...s, votos: [0, 0, 0] })))}
            >
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
        <Titulo texto={'El masajista\nmás famoso\n*es ciego.*'} on={on(0)} className={css.h2} paso={0.12} />
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
        <Titulo texto="Lo que callas, *tu cuerpo lo siente*" on={on(0)} className={css.h2} />
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
          <h3>Abre ganglios</h3>
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

function Noche({ activa, estatica, v, on }: Props) {
  const avisos = [
    ['Lucía', '¿Tienes hueco el jueves por la tarde?', 'ahora'],
    ['Marta', 'Me ha surgido algo, no puedo ir mañana', '5 min'],
    ['Elena', '¿Cuánto cuesta la sesión de drenaje?', '12 min'],
  ];
  const k = useGoteo(avisos.length + 1, activa && !estatica, 1300, 900);
  const vistos = estatica ? avisos.length + 1 : k;
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '1.25fr 0.75fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>La otra mitad del trabajo</Eyebrow>
        <Titulo texto={'Las 23:00.\n*Sigues contestando\nmensajes.*'} on={on(0)} className={css.h2} />
        <p className={`${css.texto} ${v(1)}`}>
          Citas que se caen, clientas que escriben a deshoras y <b>hacerlo todo sola.</b>
        </p>
        <div className={`${css.oscuraCaja} ${css.estadistica} ${v(2, css.rArriba)}`}>
          <b>
            <Cuenta a={12} on={on(2)} />–<Cuenta a={19} on={on(2)} /> %
          </b>
          <span>
            de las citas en clínicas privadas españolas se quedan sin atender
            <small>Fuente: Servimedia en The Objective, septiembre de 2025</small>
          </span>
        </div>
      </div>
      <Movil className={v(0, css.rArriba)}>
        <div className={css.bloqueo}>
          <span className={css.bloqueoHora}>23:0{Math.min(4, 1 + vistos)}</span>
          <span className={css.bloqueoDia}>martes</span>
        </div>
        <div className={css.avisos}>
          {avisos.map(([n, t, h], i) => (
            <div key={n} className={`${css.aviso2} ${i < vistos ? css.avisoOn : ''}`}>
              <span className={css.avisoApp}>
                <i /> Mensajes <em>{h}</em>
              </span>
              <b>{n}</b>
              <span>{t}</span>
            </div>
          ))}
          <span className={`${css.masMensajes} ${vistos > avisos.length ? css.avisoOn : ''}`}>
            + <Cuenta a={14} on={vistos > avisos.length} ms={1400} /> mensajes sin leer
          </span>
        </div>
      </Movil>
    </div>
  );
}

/* -------------------------------------------------------------- 21 */

function Comunidad({ v, on }: Props) {
  const tres = [
    ['libro', 'Sigues aprendiendo'],
    ['pin', 'Te encuentran clientas'],
    ['mano', 'Te quitamos trabajo de encima'],
  ];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.8fr 1fr' }}>
      <div className={css.columna}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clase/logo-tinta.webp" alt="" className={`${css.logoPeque} ${v(0)}`} />
        <Eyebrow className={v(0)}>Por eso nace</Eyebrow>
        <Titulo texto={'Comunidad\n*Divine*'} on={on(0)} className={css.h1crema} paso={0.2} />
        <p className={`${css.texto} ${v(0)}`} style={d(0.7)}>
          Para que <b>no lo hagas sola.</b>
        </p>
        <div className={css.columna} style={{ gap: 16, marginTop: 14 }}>
          {tres.map(([i, t], k) => (
            <span key={t} className={`${css.itemIcono} ${v(0, css.rIzq)}`} style={d(1 + k * 0.2)}>
              <span className={css.circuloIcono}>
                <Icono n={i} />
              </span>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className={css.columna} style={{ gap: 26 }}>
        <div className={`${css.foto} ${css.fotoAncha} ${v(0, css.rEscala)}`} style={d(0.5)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clase/grupo.webp" alt="Sorela con su equipo de alumnas" />
        </div>
        <span className={`${css.barraOscura} ${v(1)}`} style={{ alignSelf: 'flex-start' }}>
          <Icono n="check" className={css.chipIcono} />
          No hace falta haber hecho mi curso
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 22 */

function Dentro({ activa, estatica, v, on }: Props) {
  const k = useGoteo(3, activa && !estatica, 700, 2200);
  const busca = estatica ? 3 : k;
  const items = [
    ['pantalla', 'Clase en directo', 'Una cada mes, conmigo'],
    ['avion', 'Canal de Telegram', 'Novedades y avisos de la comunidad'],
    ['ficha', 'Fichas y descargables', 'Para usar en cabina'],
    ['pin', 'Localiza tu terapeuta', 'Tu ficha en la web, para que te encuentren'],
    ['chispa', 'Marketing e IA', 'Formación para tu negocio'],
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
              <div className={css.buscador}>
                <span className={css.buscadorCampo}>
                  <Icono n="lupa" className={css.chipIcono} />
                  {'Vigo'.slice(0, busca > 0 ? 4 : 0) || 'Tu ciudad'}
                </span>
                <span className={`${css.resultado} ${busca > 1 ? css.avisoOn : ''}`}>
                  <span className={css.puntoOro} /> Terapeuta Divine · Vigo
                </span>
                <span className={`${css.resultado} ${busca > 2 ? css.avisoOn : ''}`}>
                  <span className={css.puntoOro} /> Terapeuta Divine · Madrid
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 23 */

function Agente({ activa, estatica, v, on }: Props) {
  const [vuelta, setVuelta] = useState(0);
  const mensajes: [string, string][] = [
    ['ella', 'Hola, ¿tienes hueco esta semana para un drenaje?'],
    ['agente', '¡Hola, Lucía! Tengo el jueves a las 17:00 o el viernes a las 10:00. ¿Cuál te va mejor?'],
    ['ella', 'El jueves'],
    ['agente', 'Hecho: jueves a las 17:00. Te lo recuerdo el miércoles.'],
  ];
  const k = useGoteo(mensajes.length + 1, activa && !estatica, 1700, 900, vuelta);
  const vistos = estatica ? mensajes.length + 1 : k;
  const escribiendo = !estatica && vistos < mensajes.length && mensajes[vistos]?.[0] === 'agente';
  const funciones = [
    ['chat', 'Responde', 'A tus clientas, a cualquier hora'],
    ['calendario', 'Agenda', 'Da cita y mueve las que se caen'],
    ['campana', 'Recuerda', 'La cita, el día antes'],
    ['carpeta', 'Organiza', 'Tu semana y tu negocio'],
  ];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '1.1fr 0.9fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Tu agente Divine</Eyebrow>
        <Titulo texto={'Tu asistente, *mientras tú\nestás en cabina*'} on={on(0)} className={css.h2} />
        <div className={css.cuatro} style={{ marginTop: 30 }}>
          {funciones.map(([i, t, s], j) => (
            <div key={t} className={`${css.oscuraCaja} ${css.funcion} ${v(0, css.rArriba)}`} style={d(0.5 + j * 0.15)}>
              <span className={css.circuloIconoOscuro}>
                <Icono n={i} />
              </span>
              <div>
                <b>{t}</b>
                <span>{s}</span>
              </div>
            </div>
          ))}
        </div>
        <span className={`${css.chipOscuro} ${v(0)}`} style={{ ...d(1.3), alignSelf: 'flex-start', marginTop: 24 }}>
          <Icono n="escudo" className={css.chipIcono} /> Hecho solo para terapeutas
        </span>
      </div>
      <div className={css.columna} style={{ alignItems: 'center' }}>
        <Eyebrow className={v(0)}>Así funcionará</Eyebrow>
        <Movil className={v(0, css.rArriba)}>
          <div className={css.chatCabeza}>
            <span className={css.chatAvatar}>D</span>
            <div>
              <b>Tu centro · Asistente</b>
              <span>en línea</span>
            </div>
            <button type="button" className={css.chatOtraVez} onClick={(e) => (e.stopPropagation(), setVuelta((n) => n + 1))} title="Repetir">
              ↻
            </button>
          </div>
          <div className={css.chat}>
            {mensajes.map(([quien, t], i) => (
              <div key={i} className={`${quien === 'ella' ? css.burbujaElla : css.burbujaAgente} ${i < vistos ? css.avisoOn : ''}`}>
                {t}
              </div>
            ))}
            {escribiendo && (
              <div className={`${css.burbujaAgente} ${css.avisoOn} ${css.escribiendo}`}>
                <i />
                <i />
                <i />
              </div>
            )}
            <span className={`${css.chatSistema} ${vistos > mensajes.length ? css.avisoOn : ''}`}>
              <Icono n="campana" className={css.chipIcono} /> Miércoles 10:00 · recordatorio enviado
            </span>
          </div>
        </Movil>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 24 */

function DiezPlazas({ v, on }: Props) {
  const { estado } = useClase();
  const quedan = PLAZAS - estado.plazas;
  const pasos = ['Entendemos tu negocio', 'Dejamos tu agente\na tu medida', 'Lo que aprendemos entrena\nel agente de todas'];
  return (
    <div className={css.columna}>
      <Eyebrow className={v(0)}>Solo {PLAZAS} plazas</Eyebrow>
      <Titulo texto={`Las ${PLAZAS} primeras:\n*nos sentamos contigo, 1 a 1*`} on={on(0)} className={css.h2} />
      <div className={v(0)} style={d(0.6)}>
        <Plazas grande on={on(0)} />
      </div>
      <p className={`${css.textoSuave} ${v(0)}`} style={d(1.2)}>
        {quedan === PLAZAS ? (
          'Las plazas se rellenan en directo, con cada alta.'
        ) : quedan > 0 ? (
          <>
            <b className={css.oroTexto}>Quedan {quedan}</b> · se rellenan en directo, con cada alta.
          </>
        ) : (
          <b className={css.oroTexto}>Plazas de fundadora completas.</b>
        )}
      </p>
      <div className={css.flujo}>
        {pasos.map((p, k) => (
          <div key={p} className={css.flujoTramo}>
            <div className={`${css.oscuraCaja} ${css.flujoPaso} ${v(1, css.rIzq)}`} style={d(k * 0.3)}>
              <span className={css.numOro}>{k + 1}</span>
              <span>
                {p.split('\n').map((l, i) => (
                  <span key={i} style={{ display: 'block' }}>
                    {l}
                  </span>
                ))}
              </span>
            </div>
            {k < 2 && <Flecha className={v(1)} style={d(0.2 + k * 0.3)} />}
          </div>
        ))}
      </div>
      <span className={`${css.chipOscuro} ${v(2)}`} style={{ alignSelf: 'flex-start' }}>
        <Icono n="calendario" className={css.chipIcono} /> Del 10 al 25 de noviembre
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- 25 */

function Precio({ activa, estatica, v, on }: Props) {
  return (
    <div className={css.centro} style={{ gap: 34 }}>
      <Eyebrow className={v(0)}>Precio de lanzamiento</Eyebrow>
      <Titulo texto="Entra hoy, *al precio de hoy*" on={on(0)} className={css.h2} />
      <div className={css.precios}>
        <div className={`${css.vidrio} ${css.precio} ${v(0, css.rArriba)}`} style={d(0.5)}>
          <Eyebrow>Mensual</Eyebrow>
          <p className={css.cifra}>
            <Cuenta a={PRECIOS.mensual} on={on(0)} /> €<small>/mes</small>
          </p>
          <p className={css.precioNota}>
            Después, <b>{PRECIOS.mensualDespues} €/mes</b>
          </p>
        </div>
        <div className={`${css.precioOscuro} ${css.precio} ${v(1, css.rArriba)}`}>
          <div className={css.filaEntre}>
            <Eyebrow>Anual</Eyebrow>
            <span className={css.insignia}>Solo en la masterclass</span>
          </div>
          <p className={css.cifra}>
            <Cuenta a={PRECIOS.anual} on={on(1)} /> €<small>/año</small>
          </p>
          <p className={css.precioNota}>
            <b>2 meses gratis</b> · ahorras {PRECIOS.ahorro} €
          </p>
          <span className={css.brillo} />
        </div>
      </div>
      <div className={css.fila} style={{ justifyContent: 'center' }}>
        <span className={`${css.barraOscura} ${v(2)}`}>
          <Icono n="check" className={css.chipIcono} /> Quien entra ahora, mantiene su precio
        </span>
        <span className={`${css.barraOscura} ${v(2)}`} style={d(0.2)}>
          <Icono n="reloj" className={css.chipIcono} /> Hasta el domingo 8 de noviembre · 23:59 ·{' '}
          <Quedan hasta={FIN_PRECIO} activa={activa && !estatica} />
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 26 */

function Escanea({ qr, v, on }: Props) {
  const pasos = [
    ['qr', 'Entras', 'Desde el QR o el enlace del chat'],
    ['tarjeta', 'Pagas', 'Mensual o anual'],
    ['llave', 'Te llega el acceso', 'Y si eres fundadora, tu cita 1 a 1'],
  ];
  return (
    <div className={css.dosCol} style={{ gridTemplateColumns: '0.9fr 1fr' }}>
      <div className={css.columna}>
        <Eyebrow className={v(0)}>Cómo entrar</Eyebrow>
        <Titulo texto="Escanea y *entra*" on={on(0)} className={css.h2} />
        <div className={`${css.qrCaja} ${v(0, css.rEscala)}`} style={d(0.4)}>
          <div className={css.qr} dangerouslySetInnerHTML={{ __html: qr }} />
          <span className={css.qrLaser} />
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
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 27 */

function Preguntas({ qr, v, on }: Props) {
  return (
    <div className={css.preguntas}>
      <div className={css.centro} style={{ flex: 1 }}>
        <Eyebrow className={v(0)}>Preguntas</Eyebrow>
        <Titulo texto={'Pregúntame\n*lo que quieras*'} on={on(0)} className={css.h1crema} paso={0.14} />
      </div>
      <div className={css.filaEntre} style={{ alignItems: 'flex-end' }}>
        <div className={`${css.vidrio} ${css.fundadoras} ${v(0, css.rArriba)}`} style={d(0.8)}>
          <Eyebrow>Fundadoras</Eyebrow>
          <Plazas on={on(0)} />
        </div>
        <div className={`${css.vidrio} ${css.qrMini} ${v(0, css.rArriba)}`} style={d(1)}>
          <div className={css.qr} dangerouslySetInnerHTML={{ __html: qr }} />
          <Eyebrow>Entra aquí</Eyebrow>
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
        <Chip icono="reloj" className={v(0)} style={d(1.2)}>
          Precio de lanzamiento hasta el domingo 8, 23:59 · <Quedan hasta={FIN_PRECIO} activa={activa && !estatica} />
        </Chip>
        <Chip className={v(0)} style={d(1.35)}>
          @sorelacaro_
        </Chip>
      </div>
    </div>
  );
}

/* ================================================================ lista */

export const DIAPOSITIVAS: Diapo[] = [
  { id: 'portada', titulo: 'Antes de tocar', tema: 'oscuro', pasos: 0, sinPie: true, Vista: Portada, notas: 'Saluda mientras corre la cuenta atrás. Pide que escriban en el chat desde dónde te ven. Pulsar la cuenta la reinicia.' },
  { id: 'bienvenida', titulo: '¿Desde dónde nos ves?', tema: 'crema', pasos: 0, Vista: Bienvenida, notas: 'Lee ciudades del chat y pulsa cada una en el mapa para encenderla. «+ otro sitio» suma las que no salen. Pregunta cuántos años llevan con las manos.' },
  { id: 'tres-cosas', titulo: 'Hoy te llevas 3 cosas', tema: 'crema', pasos: 1, Vista: TresCosas, notas: 'Las tres cosas. Siguiente: anuncia la ficha y «una noticia» al final (solo en directo), para que se queden.' },
  { id: 'bucle', titulo: 'Y sale igual que entró', tema: 'oscuro', pasos: 1, Vista: Bucle, notas: 'Cuenta el bucle. Siguiente: aparece el contador de «1». Súmalos con +1 / +5 según llegan al chat.' },
  { id: 'trampas', titulo: 'Las tres trampas', tema: 'oscuro', pasos: 3, Vista: Trampas, notas: 'Una trampa por clic. Pulsa cada tarjeta para sumar los votos del chat (1, 2 o 3): las barras se mueven solas.' },
  { id: 'cita', titulo: 'Qué observar, interpretar, decidir', tema: 'crema', pasos: 0, Vista: Cita, notas: 'Pausa. Deja que la frase entre entera antes de hablar.' },
  { id: 'historia', titulo: 'Empecé peinando', tema: 'crema', pasos: 1, Vista: Historia, notas: 'Tu historia: de peluquería a las emociones. Siguiente: «Quería entender lo que la persona sentía».' },
  { id: 'aprendi', titulo: 'El masajista más famoso es ciego', tema: 'oscuro', pasos: 1, Vista: Aprendi, notas: 'La foto está en penumbra. Siguiente: se ilumina con «Las manos leen lo que los ojos no ven».' },
  { id: 'credenciales', titulo: 'Por qué puedo enseñarte esto', tema: 'crema', pasos: 0, Vista: Credenciales, notas: '30 años, +25.000 casos, Nueva Estética, televisión. La tarjeta TV abre el clip si está cargado (lib/clase.ts).' },
  { id: 'metodo', titulo: 'El método', tema: 'crema', pasos: 3, Vista: Metodo, notas: 'Un paso por clic: Observar, Interpretar, Decidir.' },
  { id: 'observar', titulo: 'Paso 1 · Mira y escucha', tema: 'crema', fase: 1, pasos: 2, Vista: Observar, notas: 'Los puntos del cuerpo se pueden pulsar. Clic: «Mira» (piel, postura, respiración, dónde retiene). Clic: «Escucha».' },
  { id: 'no-tocar', titulo: 'Cuándo no tocar', tema: 'oscuro', fase: 1, pasos: 1, Vista: NoTocar, notas: 'Contraindicaciones: primero médico. Clic: con más suavidad.' },
  { id: 'interpretar', titulo: 'Paso 2 · Lo que callas', tema: 'oscuro', fase: 2, pasos: 3, Vista: Interpretar, notas: 'Las dos con la misma queja. Clic: A, el punto sube al pecho (estrés). Clic: B, baja a las piernas. Clic: «Misma queja. Distinto origen».' },
  { id: 'noventa', titulo: 'El drenaje de hace 90 años', tema: 'crema', fase: 2, pasos: 2, Vista: Noventa, notas: 'La linfa se mueve hacia los ganglios. Clic: Hoy. Clic: Divine.' },
  { id: 'secuencia', titulo: 'Paso 3 · La secuencia', tema: 'crema', fase: 3, pasos: 3, Vista: Secuencia, notas: 'Un paso por clic: ganglios (~10 min), escucha el abdomen, maniobras lentas.' },
  { id: 'cuerpo-limpio', titulo: 'Sobre un cuerpo limpio', tema: 'oscuro', fase: 3, pasos: 3, Vista: CuerpoLimpio, notas: 'La base primero. Cada clic apila una capa: aparatología, cosmética, tratamientos.' },
  { id: 'casos', titulo: 'Una sesión. 55 minutos', tema: 'oscuro', pasos: 2, Vista: Casos, notas: 'Clic: el abdomen se descubre. Clic: el rostro. Puedes arrastrar la línea mientras explicas.' },
  { id: 'lunes', titulo: 'Tu lunes', tema: 'crema', pasos: 3, Vista: Lunes, notas: 'Una pregunta por clic. Puedes marcar las casillas.' },
  { id: 'prueba', titulo: 'Lo que cambia en tu cabina', tema: 'oscuro', pasos: 3, Vista: Prueba, notas: 'Un escalón por clic. El antes/después se descubre en el primero.' },
  { id: 'noche', titulo: 'Las 23:00', tema: 'oscuro', pasos: 2, Vista: Noche, notas: 'Los mensajes entran solos. Clic: el texto. Clic: el dato 12–19 %.' },
  { id: 'comunidad', titulo: 'Comunidad Divine', tema: 'crema', pasos: 1, Vista: Comunidad, notas: 'Presentas la comunidad. Clic: «No hace falta haber hecho mi curso».' },
  { id: 'dentro', titulo: 'Qué hay dentro', tema: 'crema', pasos: 0, Vista: Dentro, notas: 'Las cinco cosas. El buscador de terapeutas se escribe solo.' },
  { id: 'agente', titulo: 'Tu agente Divine', tema: 'oscuro', pasos: 0, Vista: Agente, notas: 'El chat se reproduce solo. ↻ en el móvil lo repite.' },
  { id: 'plazas', titulo: 'Solo 10 plazas', tema: 'oscuro', pasos: 2, Vista: DiezPlazas, notas: 'Pulsa un círculo por cada alta: se llena aquí, en la diapositiva 27 y en la vista de presentador. Clic: los tres pasos. Clic: fechas.' },
  { id: 'precio', titulo: 'Precio de lanzamiento', tema: 'crema', pasos: 2, Vista: Precio, notas: 'Primero mensual. Clic: anual (solo en la masterclass). Clic: condiciones y cuenta atrás hasta el domingo 23:59.' },
  { id: 'escanea', titulo: 'Escanea y entra', tema: 'oscuro', pasos: 3, Vista: Escanea, notas: 'El QR lleva a /clase/entrar. Pega también el enlace en el chat de Zoom.' },
  { id: 'preguntas', titulo: 'Preguntas', tema: 'crema', pasos: 0, Vista: Preguntas, notas: 'Turno de preguntas. Sigue llenando plazas de fundadora según entran.' },
  { id: 'gracias', titulo: 'Gracias', tema: 'oscuro', pasos: 0, sinPie: true, Vista: Gracias, notas: 'Cierre. Recuerda que la ficha llega hoy por email y el precio hasta el domingo.' },
];
