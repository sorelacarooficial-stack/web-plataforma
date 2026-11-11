'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import n from './novedadesagenda.module.css';

/**
 * Las novedades de la agenda, en diapositivas.
 *
 * Aquí va lo que pone Sorela, no lo que apunta cada una: su formación
 * presencial (de la convocatoria que trae su acceso) y la próxima clase en
 * directo. Antes las fechas de la formación iban mezcladas en la lista, día a
 * día, como si las hubiera apuntado ella; ahora van aparte, como noticia.
 * Las calcula app/api/agenda (campo `novedades`).
 */

export type Novedad =
  | { id: string; tipo: 'clase'; titulo: string; cuando: string }
  | {
      id: string;
      tipo: 'formacion';
      titulo: string;
      ciudad: string;
      lugar: string;
      dias: { dia: string; cuando: string; desde: string; hasta: string }[];
    };

const MES = new Intl.DateTimeFormat('es-ES', { month: 'long' });
const DIA_LARGO = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

/** «10, 11 y 12 de diciembre» (o «30 de enero y 1 de febrero»). */
function fechasEnFrase(dias: string[]): string {
  const f = dias.map((d) => new Date(`${d}T12:00:00`));
  const mismoMes = f.every((x) => x.getMonth() === f[0].getMonth());
  const unir = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0]);
  if (mismoMes) return `${unir(f.map((x) => String(x.getDate())))} de ${MES.format(f[0])}`;
  return unir(f.map((x) => `${x.getDate()} de ${MES.format(x)}`));
}

function faltan(iso: string): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const n = Math.round((d.getTime() - hoy.getTime()) / 86400000);
  if (n < 0) return 'Ya ha empezado';
  if (n === 0) return 'Es hoy';
  if (n === 1) return 'Es mañana';
  return `Faltan ${n} días`;
}

export default function NovedadesAgenda({ novedades }: { novedades: Novedad[] }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const quieto = useReducedMotion();
  const total = novedades.length;
  const actual = novedades[Math.min(i, total - 1)];

  useEffect(() => {
    if (total < 2 || pausa || quieto) return;
    const t = setInterval(() => setI((x) => (x + 1) % total), 7000);
    return () => clearInterval(t);
  }, [total, pausa, quieto]);

  if (!total || !actual) return null;
  const ir = (d: number) => setI((x) => (x + d + total) % total);

  return (
    <section
      className={n.marco}
      aria-roledescription="carrusel"
      aria-label="Novedades"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={actual.id}
          className={n.diapositiva}
          initial={quieto ? false : { opacity: 0, x: 24, filter: 'blur(6px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={quieto ? undefined : { opacity: 0, x: -24, filter: 'blur(6px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          drag={total > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60) ir(1);
            else if (info.offset.x > 60) ir(-1);
          }}
        >
          {actual.tipo === 'formacion' ? (
            <>
              <span className={n.etiqueta}>Tu formación presencial</span>
              <h3 className={n.titulo}>
                {actual.titulo}
                {actual.ciudad ? (
                  <>
                    {' '}
                    en <strong>{actual.ciudad}</strong>
                  </>
                ) : null}
              </h3>
              <p className={n.fecha}>{fechasEnFrase(actual.dias.map((d) => d.dia))}</p>
              <p className={n.detalle}>
                {[
                  actual.dias[0].hasta ? `${actual.dias[0].desde} – ${actual.dias[0].hasta} h` : `Desde las ${actual.dias[0].desde} h`,
                  actual.lugar,
                  'Con Sorela Caro',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <span className={n.cuenta}>{faltan(actual.dias[0].cuando)}</span>
            </>
          ) : (
            <>
              <span className={n.etiqueta}>Clase en directo</span>
              <h3 className={n.titulo}>
                <strong>{actual.titulo}</strong>
              </h3>
              <p className={n.fecha}>{DIA_LARGO.format(new Date(actual.cuando))}</p>
              <p className={n.detalle}>A las {HORA.format(new Date(actual.cuando))} h (tu hora) · El enlace está en Comunidad</p>
              <span className={n.cuenta}>{faltan(actual.cuando)}</span>
            </>
          )}
        </motion.article>
      </AnimatePresence>

      {total > 1 && (
        <div className={n.mandos}>
          <button type="button" className={n.flecha} onClick={() => ir(-1)} aria-label="Anterior">
            ‹
          </button>
          <div className={n.puntos}>
            {novedades.map((x, k) => (
              <button
                key={x.id}
                type="button"
                className={n.punto}
                data-activo={k === i ? '' : undefined}
                onClick={() => setI(k)}
                aria-label={`Novedad ${k + 1} de ${total}`}
                aria-current={k === i}
              />
            ))}
          </div>
          <button type="button" className={n.flecha} onClick={() => ir(1)} aria-label="Siguiente">
            ›
          </button>
        </div>
      )}
    </section>
  );
}
