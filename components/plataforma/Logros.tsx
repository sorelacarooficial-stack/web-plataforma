'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FAMILIAS, type EstadoLogro, type Familia, type Resumen } from '@/lib/logros-tipos';
import l from './logros.module.css';

/**
 * Los logros, en tarjetas: los conseguidos brillan y los que faltan muestran
 * cuánto queda. Arriba, el progreso del curso y la racha, que es lo que da
 * ganas de entrar mañana. Sin `uid`, los propios (con certificado si toca).
 */
export default function Logros({ uid }: { uid?: string }) {
  const [r, setR] = useState<(Resumen & { esMio: boolean }) | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/logros${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`)
      .then((x) => x.json())
      .then((j) => vivo && (j.ok ? setR(j) : setFallo(true)))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [uid]);

  if (fallo) return <p className={l.vacio}>No he podido cargar los logros.</p>;
  if (!r) return <div className={l.esqueleto} />;

  const conseguidos = r.logros.filter((x) => x.conseguido).length;
  const porFamilia = (f: Familia) => r.logros.filter((x) => x.familia === f);

  return (
    <div className={l.logros}>
      <section className={l.resumen}>
        <div className={l.anillo} style={{ ['--p' as string]: `${r.curso.porcentaje}%` }}>
          <span>
            <b>{r.curso.porcentaje}%</b>
            <small>del curso</small>
          </span>
        </div>
        <div className={l.datos}>
          <p>
            <b>{r.curso.hechas}</b> de {r.curso.total} clases terminadas
          </p>
          <p>
            <span className={l.fuego} data-viva={r.racha.actual > 0 ? '' : undefined}>🔥</span> Racha de <b>{r.racha.actual}</b>{' '}
            {r.racha.actual === 1 ? 'día' : 'días'} · mejor: {r.racha.mejor}
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

function Insignia({ x, i }: { x: EstadoLogro; i: number }) {
  return (
    <motion.article
      className={l.insignia}
      data-hecho={x.conseguido ? '' : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
    >
      <span className={l.icono} aria-hidden="true">
        {x.icono}
      </span>
      <strong>{x.nombre}</strong>
      <small>{x.texto}</small>
      {!x.conseguido && (
        <span className={l.barra} aria-label={`${x.progreso} de ${x.meta}`}>
          <span style={{ width: `${(x.progreso / x.meta) * 100}%` }} />
        </span>
      )}
      {x.conseguido && <span className={l.hecho}>Conseguido</span>}
    </motion.article>
  );
}
