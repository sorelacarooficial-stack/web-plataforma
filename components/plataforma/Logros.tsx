'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ESCALONES,
  LOGROS,
  ORDEN_ESCALON,
  textoFalta,
  vitrinas,
  type EstadoLogro,
  type EstadoVitrina,
  type Resumen,
} from '@/lib/logros-tipos';
import { PUNTOS, formatoPuntos, type ResumenPuntos } from '@/lib/puntos-tipos';
import { irA } from '@/lib/navegar';
import { BarraNivel, CaminoNiveles, ContadorPuntos, DesglosePuntos } from './Puntos';
import { DistintivoCreadora, Icono, InsigniaNivel, Trofeo } from './IconosDivine';
import l from './logros.module.css';

/**
 * Los trofeos y el nivel: arriba, en negro, los puntos con la insignia del
 * nivel, el camino de los seis niveles y de dónde salen; debajo, la VITRINA:
 * una copa por cada cosa que se hace, que sube de bronce a plata y a oro, y
 * el trofeo Divine encima de todas. Lo que no se tiene se ve en gris con lo
 * que falta («te faltan 3 respuestas»): eso es lo que da ganas de volver.
 *
 * Sin `uid`, los propios (con certificado si toca); con `uid`, los de otra
 * persona, que se ven igual pero hablando de ella. De Sorela no hay nada que
 * contar: es la creadora y lleva su distintivo.
 *
 * Las barras y el camino se llenan cuando entran en pantalla, no antes.
 */

type Datos = (Resumen & { esMio: boolean }) | { esMio: boolean; creadora: true };

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Logros({ uid, nombre }: { uid?: string; nombre?: string }) {
  const [r, setR] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState(false);
  const totalVisto = useRef<number | null>(null);

  const cargar = useCallback(
    (vivo: () => boolean = () => true) =>
      fetch(`/api/logros${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`)
        .then((x) => x.json())
        .then((j) => {
          if (!vivo()) return;
          if (j.ok) {
            totalVisto.current = j.puntos?.total ?? null;
            setR(j);
          } else setFallo(true);
        })
        .catch(() => vivo() && setFallo(true)),
    [uid]
  );

  useEffect(() => {
    let vivo = true;
    setR(null);
    setFallo(false);
    cargar(() => vivo);
    return () => {
      vivo = false;
    };
  }, [cargar]);

  /* Los propios se refrescan solos: si la Celebración reparte puntos nuevos
     (una clase, una foto…) mientras esta pantalla está abierta, se recargan
     para que la vitrina y el desglose no se queden atrás. */
  useEffect(() => {
    if (uid) return;
    const alLlegar = (e: Event) => {
      const d = (e as CustomEvent<ResumenPuntos>).detail;
      if (d && totalVisto.current !== null && d.total !== totalVisto.current) cargar();
    };
    window.addEventListener('divine:puntos', alLlegar);
    return () => window.removeEventListener('divine:puntos', alLlegar);
  }, [uid, cargar]);

  if (fallo) {
    return (
      <div className={l.vacio} role="alert">
        <span className={l.vacioIcono} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 7.5v6M12 17h.01" />
            <circle cx="12" cy="12" r="9.2" strokeWidth="1.7" />
          </svg>
        </span>
        <span className={l.vacioTexto}>
          <strong>No he podido cargar los trofeos.</strong>
          <span>Puede ser la conexión. Vuelve a intentarlo en un momento.</span>
        </span>
        <button type="button" className={l.reintentar} onClick={() => (setFallo(false), cargar())}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!r) return <div className={l.esqueleto} aria-busy="true" aria-label="Cargando los trofeos" />;

  if ('creadora' in r && r.creadora) return <DistintivoCreadora variante="bloque" ajena={!r.esMio} nombre={nombre} />;
  const d = r as Resumen & { esMio: boolean };
  const ajena = !d.esMio;
  const conseguidos = d.logros.filter((x) => x.conseguido).length;
  const p = d.puntos;

  return (
    <div className={l.logros}>
      <section className={l.resumen} aria-label={ajena ? 'Puntos y nivel' : 'Tus puntos y tu nivel'}>
        <div className={l.puntosCabecera}>
          <div>
            <p className={l.rotuloOscuro}>{ajena ? 'Sus puntos' : 'Tus puntos'}</p>
            <p className={l.total}>
              <ContadorPuntos valor={p.total} desde={0} />
              <small>puntos</small>
            </p>
          </div>
          <span className={l.moneda}>
            <InsigniaNivel n={p.nivel.n} size={84} title={`Nivel ${p.nivel.n}: ${p.nivel.nombre}`} />
          </span>
        </div>

        {d.esMio ? (
          <BarraNivel total={p.total} tamano="grande" />
        ) : (
          // De otra persona no se le habla de tú: los textos van aparte.
          <div className={l.barraAjena}>
            <p className={l.nivelLinea}>
              <span>Nivel {p.nivel.n}</span> · <strong>{p.nivel.nombre}</strong>
            </p>
            <BarraNivel total={p.total} tamano="grande" conTexto={false} />
            <p className={l.faltaAjena}>
              {p.nivel.siguiente ? `A ${formatoPuntos(p.nivel.falta)} pts de ${p.nivel.siguiente.nombre}` : 'En el nivel más alto'}
            </p>
          </div>
        )}

        <div className={l.caminoBloque}>
          <p className={l.rotuloOscuro}>El camino de niveles</p>
          <CaminoNiveles total={p.total} ajena={ajena} />
        </div>

        <div className={l.deDonde}>
          <p className={l.rotuloOscuro}>De dónde vienen</p>
          <DesglosePuntos desglose={p.desglose} ajena={ajena} vacio={ajena ? 'Todavía no tiene puntos.' : undefined} />
        </div>

        <div className={l.curso}>
          <Anillo valor={d.curso.porcentaje} />
          <div className={l.datos}>
            <p>
              <Icono nombre="clases" size={18} className={l.datoIcono} />
              <span>
                <b>{d.curso.hechas}</b> de {d.curso.total} clases terminadas
              </span>
            </p>
            <p>
              <Icono nombre="racha" size={18} className={l.datoIcono} style={d.racha.actual > 0 ? undefined : { opacity: 0.55 }} />
              <span>
                Racha de <b>{d.racha.actual}</b> {d.racha.actual === 1 ? 'día' : 'días'} · mejor: {d.racha.mejor}
              </span>
            </p>
            <p>
              <Icono nombre="logros" size={18} className={l.datoIcono} />
              <span>
                <b>{conseguidos}</b> de {d.logros.length} trofeos
              </span>
            </p>
            {d.esMio && d.certificado && (
              <a className={l.certificado} href="/api/certificado">
                <Icono nombre="curso" size={18} />
                Descargar mi certificado
              </a>
            )}
          </div>
        </div>
      </section>

      <Vitrina logros={d.logros} ajena={ajena} />
    </div>
  );
}

/** El anillo del curso: se dibuja al entrar en pantalla. */
function Anillo({ valor }: { valor: number }) {
  const reducir = useReducedMotion();
  const radio = 50;
  const c = 2 * Math.PI * radio;
  const fin = c * (1 - Math.max(0, Math.min(100, valor)) / 100);
  return (
    <svg viewBox="0 0 120 120" className={l.anillo} role="img" aria-label={`${valor}% del curso`}>
      <circle cx="60" cy="60" r={radio} className={l.anilloFondo} />
      <motion.circle
        cx="60"
        cy="60"
        r={radio}
        className={l.anilloValor}
        strokeDasharray={c}
        initial={{ strokeDashoffset: reducir ? fin : c }}
        whileInView={{ strokeDashoffset: fin }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: EASE, delay: 0.15 }}
      />
      <text x="60" y="64" textAnchor="middle" className={l.anilloNumero}>
        {valor}%
      </text>
      <text x="60" y="82" textAnchor="middle" className={l.anilloTexto}>
        del curso
      </text>
    </svg>
  );
}

/* ==========================================================================
   La vitrina
   ========================================================================== */

/** El escalón que se enseña en la copa: el más alto conseguido (o el primero, en gris). */
const escalonDe = (v: EstadoVitrina) => v.actual?.escalon ?? v.escalones[0].escalon;

/**
 * La vitrina de trofeos: el Divine arriba y una copa por vitrina debajo.
 * La exporta este archivo para que la use quien quiera enseñarla entera.
 */
export function Vitrina({ logros, ajena = false }: { logros: EstadoLogro[]; ajena?: boolean }) {
  const todas = vitrinas(logros);
  const divine = todas.find((v) => v.id === 'divine');
  const resto = todas.filter((v) => v.id !== 'divine');
  const conseguidos = logros.filter((x) => x.conseguido).length;

  return (
    <section className={l.vitrina} aria-labelledby="vitrina-titulo">
      <header className={l.vitrinaCabecera}>
        <div>
          <h3 id="vitrina-titulo">{ajena ? 'Su vitrina' : 'Tu vitrina'}</h3>
          <p>
            <b>{conseguidos}</b> de {logros.length} trofeos · cada uno, +{PUNTOS.logro} pts
          </p>
        </div>
        <ul className={l.leyenda} aria-label="Escalones">
          {ORDEN_ESCALON.map((e) => (
            <li key={e} data-escalon={e}>
              <span aria-hidden="true" />
              {ESCALONES[e]}
            </li>
          ))}
        </ul>
      </header>

      {divine && <TarjetaDivine v={divine} ajena={ajena} oros={logros.filter((x) => x.escalon === 'oro' && x.conseguido).length} />}

      <div className={l.rejilla}>
        {resto.map((v, i) => (
          <TarjetaVitrina key={v.id} v={v} i={i} ajena={ajena} />
        ))}
      </div>
    </section>
  );
}

function TarjetaDivine({ v, ajena, oros }: { v: EstadoVitrina; ajena: boolean; oros: number }) {
  const reducir = useReducedMotion();
  const t = v.escalones[0];
  const hecho = t.conseguido;
  return (
    <motion.article
      className={l.divine}
      data-hecho={hecho ? '' : undefined}
      initial={reducir ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Trofeo escalon="divine" glifo="divine" size={92} apagado={!hecho} className={l.divineCopa} />
      <div className={l.divineTexto}>
        <p className={l.divineRotulo}>Trofeo especial</p>
        <h4>{t.nombre}</h4>
        <p>{t.texto}</p>
        <div className={l.divineOros} role="img" aria-label={`${Math.min(oros, t.meta)} de ${t.meta} oros`}>
          {Array.from({ length: t.meta }, (_, i) => (
            <span key={i} data-lleno={i < oros ? '' : undefined}>
              <Trofeo escalon="oro" glifo="divine" size={30} apagado={i >= oros} />
            </span>
          ))}
          <em>{hecho ? (ajena ? 'Conseguido' : '¡Conseguido!') : textoFalta(t, ajena)}</em>
        </div>
      </div>
      {hecho && (
        <span className={l.sello}>
          Conseguido <span aria-hidden="true">·</span> +{PUNTOS.logro} pts
        </span>
      )}
    </motion.article>
  );
}

function TarjetaVitrina({ v, i, ajena }: { v: EstadoVitrina; i: number; ajena: boolean }) {
  const reducir = useReducedMotion();
  const [abierta, setAbierta] = useState(false);
  const idLista = useId();
  const sig = v.siguiente;
  const actual = v.actual;
  const titulo = actual?.nombre ?? v.escalones[0].nombre;
  const parte = sig ? Math.max(0, Math.min(1, sig.progreso / sig.meta)) : 1;
  const completa = !sig;

  return (
    <motion.article
      className={l.copa}
      data-escalon={actual ? actual.escalon : 'ninguno'}
      initial={reducir ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ delay: i * 0.05, duration: 0.45, ease: EASE }}
    >
      <div className={l.copaCabeza}>
        <Trofeo
          escalon={escalonDe(v)}
          glifo={v.glifo}
          size={64}
          apagado={!actual}
          title={actual ? `${v.nombre}: trofeo de ${ESCALONES[actual.escalon].toLowerCase()}` : `${v.nombre}: aún sin trofeo`}
        />
        <div className={l.copaNombre}>
          <p className={l.copaRotulo}>{v.nombre}</p>
          <h4>{titulo}</h4>
          <span className={l.copaEscalon} data-escalon={actual ? actual.escalon : 'ninguno'}>
            {actual ? ESCALONES[actual.escalon] : 'Por estrenar'}
          </span>
        </div>
      </div>

      {/* Los escalones de esta vitrina: hechos en su metal, el siguiente con su anillo. */}
      <ol className={l.peldanos} aria-label={`Escalones de ${v.nombre}`}>
        {v.escalones.map((e) => (
          <li key={e.id} data-escalon={e.escalon} data-hecho={e.conseguido ? '' : undefined} data-siguiente={sig?.id === e.id ? '' : undefined}>
            <span className={l.peldanoPunto} aria-hidden="true" />
            <span className={l.peldanoNombre}>{ESCALONES[e.escalon]}</span>
            <span className={l.soloLector}>{e.conseguido ? ': conseguido' : `: ${textoFalta(e, ajena)}`}</span>
          </li>
        ))}
      </ol>

      {completa ? (
        <p className={l.copaHecha}>
          <Icono nombre="logros" size={16} />
          {v.escalones.length > 1 ? 'Vitrina completa' : 'Conseguido'} · +{formatoPuntos(PUNTOS.logro * v.escalones.length)} pts
        </p>
      ) : (
        <div className={l.copaProgreso}>
          <span className={l.barra} role="progressbar" aria-label={`${sig.nombre}`} aria-valuemin={0} aria-valuemax={sig.meta} aria-valuenow={Math.min(sig.progreso, sig.meta)}>
            <motion.span
              initial={{ scaleX: reducir ? parte : 0 }}
              whileInView={{ scaleX: parte }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.15 + i * 0.05, ease: EASE }}
            />
          </span>
          <p className={l.falta}>
            {textoFalta(sig, ajena)}
            {sig.unidad || sig.id === 'perfil-completo' ? (
              <>
                {' '}
                para <b>{ESCALONES[sig.escalon].toLowerCase()}</b>
              </>
            ) : null}
          </p>
        </div>
      )}

      <button type="button" className={l.verEscalones} aria-expanded={abierta} aria-controls={idLista} onClick={() => setAbierta((a) => !a)}>
        {abierta ? 'Ocultar' : 'Qué hay que hacer'}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-abierta={abierta ? '' : undefined}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {abierta && (
          <motion.ul
            id={idLista}
            className={l.detalle}
            initial={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reducir ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {v.escalones.map((e) => (
              <li key={e.id} data-hecho={e.conseguido ? '' : undefined}>
                <Trofeo escalon={e.escalon} glifo={v.glifo} size={30} apagado={!e.conseguido} />
                <span>
                  <strong>{e.nombre}</strong>
                  <em>{e.texto}</em>
                </span>
                <b>{e.conseguido ? '✓' : `+${PUNTOS.logro}`}</b>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ==========================================================================
   La vitrina en pequeño (para el panel de inicio)
   ========================================================================== */

/**
 * Una fila con una copa por vitrina, en el metal que lleva cada una, y un
 * botón a la vitrina entera (pestaña Trofeos del perfil). Sin datos todavía,
 * un hueco del mismo alto para que nada salte.
 */
export function VitrinaMini({ logros, soloVer = false }: { logros: EstadoLogro[] | null; soloVer?: boolean }) {
  if (!logros) return <div className={l.miniEsqueleto} aria-busy="true" aria-label="Cargando tus trofeos" />;
  const todas = vitrinas(logros);
  const conseguidos = logros.filter((x) => x.conseguido).length;
  return (
    <div className={l.mini}>
      <div className={l.miniCabeza}>
        <p className={l.rotuloOscuro}>Tus trofeos</p>
        <p className={l.miniCuenta}>
          <b>{conseguidos}</b> de {logros.length}
        </p>
      </div>
      <ul className={l.miniFila}>
        {todas.map((v) => (
          <li key={v.id} data-hecho={v.actual ? '' : undefined}>
            <Trofeo
              escalon={escalonDe(v)}
              glifo={v.glifo}
              size={46}
              apagado={!v.actual}
              title={v.actual ? `${v.nombre}: ${ESCALONES[v.actual.escalon]}` : `${v.nombre}: ${v.siguiente ? textoFalta(v.siguiente) : ''}`}
            />
          </li>
        ))}
      </ul>
      {!soloVer && (
        <button type="button" className={l.miniBoton} onClick={() => irA('perfil', { t: 'trofeos' })}>
          Ver tu vitrina
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

/** Trofeos de muestra (Sorela mirando «Ver como»): algunos ganados, otros a medias. */
export function trofeosDeMuestra(): EstadoLogro[] {
  const hechos = new Set(['primera-clase', 'perfil-completo', 'racha-3', 'primera-publicacion']);
  return LOGROS.map((x) => {
    const conseguido = hechos.has(x.id);
    const progreso = conseguido ? x.meta : Math.floor(x.meta / 3);
    // Los del curso van en porcentaje, pero lo que falta se cuenta en clases.
    const falta = conseguido ? 0 : x.vitrina === 'formacion' ? 3 : x.unidad ? x.meta - progreso : null;
    return { ...x, conseguido, progreso, cuando: null, falta };
  });
}
