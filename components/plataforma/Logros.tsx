'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FAMILIAS, type EstadoLogro, type Familia, type Resumen } from '@/lib/logros-tipos';
import { PUNTOS, formatoPuntos, type ResumenPuntos } from '@/lib/puntos-tipos';
import { BarraNivel, ContadorPuntos, DesglosePuntos } from './Puntos';
import l from './logros.module.css';

/**
 * Los logros, en tarjetas: los conseguidos brillan y los que faltan muestran
 * cuánto queda. Arriba, en negro, los puntos y el nivel (lo que más tira),
 * de dónde salen, y debajo el progreso del curso y la racha, que es lo que da
 * ganas de entrar mañana. Sin `uid`, los propios (con certificado si toca);
 * con `uid`, los de otra persona, que se ven igual pero hablando de ella.
 *
 * Las barras y el anillo se llenan cuando entran en pantalla, no antes: si
 * están más abajo, la animación espera a que se vean.
 */

type Datos = Resumen & { esMio: boolean; puntos?: ResumenPuntos };

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Logros({ uid }: { uid?: string }) {
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
     para que los logros y el desglose no se queden atrás. */
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
          <strong>No he podido cargar los logros.</strong>
          <span>Puede ser la conexión. Vuelve a intentarlo en un momento.</span>
        </span>
        <button type="button" className={l.reintentar} onClick={() => (setFallo(false), cargar())}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!r) return <div className={l.esqueleto} aria-busy="true" aria-label="Cargando los logros" />;

  const conseguidos = r.logros.filter((x) => x.conseguido).length;
  const porFamilia = (f: Familia) => r.logros.filter((x) => x.familia === f);
  const p = r.puntos;

  return (
    <div className={l.logros}>
      <section className={l.resumen} aria-label={r.esMio ? 'Tus puntos y tu progreso' : 'Puntos y progreso'}>
        {p && (
          <div className={l.puntos}>
            <div className={l.puntosCabecera}>
              <div>
                <p className={l.rotuloOscuro}>{r.esMio ? 'Tus puntos' : 'Sus puntos'}</p>
                <p className={l.total}>
                  <ContadorPuntos valor={p.total} desde={0} />
                  <small>puntos</small>
                </p>
              </div>
              <span className={l.moneda} aria-hidden="true">
                <small>Nivel</small>
                <b>{p.nivel.n}</b>
              </span>
            </div>

            {r.esMio ? (
              <BarraNivel total={p.total} tamano="grande" />
            ) : (
              // De otra persona no se le habla de tú: los textos van aparte.
              <div className={l.barraAjena}>
                <p className={l.nivelLinea}>
                  <span>Nivel {p.nivel.n}</span> · <strong>{p.nivel.nombre}</strong>
                </p>
                <BarraNivel total={p.total} tamano="grande" conTexto={false} />
                <p className={l.faltaAjena}>
                  {p.nivel.siguiente
                    ? `A ${formatoPuntos(p.nivel.falta)} pts de ${p.nivel.siguiente.nombre}`
                    : 'En el nivel más alto'}
                </p>
              </div>
            )}

            <div className={l.deDonde}>
              <p className={l.rotuloOscuro}>De dónde vienen</p>
              <DesglosePuntos desglose={p.desglose} ajena={!r.esMio} vacio={r.esMio ? undefined : 'Todavía no tiene puntos.'} />
            </div>
          </div>
        )}

        <div className={l.curso}>
          <Anillo valor={r.curso.porcentaje} />
          <div className={l.datos}>
            <p>
              <b>{r.curso.hechas}</b> de {r.curso.total} clases terminadas
            </p>
            <p>
              <span className={l.fuego} data-viva={r.racha.actual > 0 ? '' : undefined} aria-hidden="true">
                🔥
              </span>{' '}
              Racha de <b>{r.racha.actual}</b> {r.racha.actual === 1 ? 'día' : 'días'} · mejor: {r.racha.mejor}
            </p>
            <p>
              <b>{conseguidos}</b> de {r.logros.length} logros
            </p>
            {r.esMio && r.certificado && (
              <a className={l.certificado} href="/api/certificado">
                🎓 Descargar mi certificado
              </a>
            )}
          </div>
        </div>
      </section>

      {(Object.keys(FAMILIAS) as Familia[]).map((f) => (
        <section key={f} className={l.familia}>
          <h4>{FAMILIAS[f]}</h4>
          <div className={l.rejilla}>
            {porFamilia(f).map((x, i) => (
              <Insignia key={x.id} x={x} i={i} />
            ))}
          </div>
        </section>
      ))}
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
      <text x="60" y="62" textAnchor="middle" className={l.anilloNumero}>
        {valor}%
      </text>
      <text x="60" y="80" textAnchor="middle" className={l.anilloTexto}>
        del curso
      </text>
    </svg>
  );
}

function Insignia({ x, i }: { x: EstadoLogro; i: number }) {
  const reducir = useReducedMotion();
  const parte = Math.max(0, Math.min(1, x.progreso / x.meta));
  return (
    <motion.article
      className={l.insignia}
      data-hecho={x.conseguido ? '' : undefined}
      initial={reducir ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ delay: i * 0.05, duration: 0.45, ease: EASE }}
    >
      <span className={l.icono} aria-hidden="true">
        {x.icono}
      </span>
      <strong>{x.nombre}</strong>
      <small>{x.texto}</small>
      {!x.conseguido && (
        <span className={l.progreso}>
          <span
            className={l.barra}
            role="progressbar"
            aria-label={x.nombre}
            aria-valuemin={0}
            aria-valuemax={x.meta}
            aria-valuenow={Math.min(x.progreso, x.meta)}
          >
            <motion.span
              initial={{ scaleX: reducir ? parte : 0 }}
              whileInView={{ scaleX: parte }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.15 + i * 0.05, ease: EASE }}
            />
          </span>
          <span className={l.cuantos}>
            {/* Los del curso cuentan en porcentaje; el resto, en veces. */}
            {x.familia === 'curso' && x.meta > 1
              ? `${Math.min(x.progreso, x.meta)} %`
              : `${formatoPuntos(Math.min(x.progreso, x.meta))}/${formatoPuntos(x.meta)}`}
          </span>
        </span>
      )}
      {x.conseguido && (
        <span className={l.hecho}>
          Conseguido <span aria-hidden="true">·</span> +{PUNTOS.logro} pts
        </span>
      )}
    </motion.article>
  );
}
