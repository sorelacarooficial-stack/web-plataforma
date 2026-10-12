'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { APERTURA, APERTURA_POR_PAISES, DIA_APERTURA, HORA_ESPANA } from '@/lib/apertura';
import type { Vista } from '@/lib/plataforma';
import n from './noticias.module.css';

/**
 * Las noticias del panel de las alumnas.
 *
 * La grande, arriba, es la apertura de la Comunidad Divine con su cuenta
 * atrás en directo y el botón «Quiero ser parte del cambio Divine», que la
 * apunta a la lista (ver app/api/comunidad/quiero). Debajo, lo último del
 * blog. La fecha sale de lib/apertura.ts: si se mueve, se mueve aquí sola.
 */

type Articulo = { slug: string; titulo: string; categoria: string; portada: string | null };

const OBJETIVO = new Date(APERTURA).getTime();

function partes(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), seg: s % 60 };
}

/** Un número que, al cambiar, baja y entra el nuevo. */
function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const texto = String(valor).padStart(2, '0');
  return (
    <div className={n.cifra}>
      <span className={n.cifraCaja}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={texto}
            className={n.cifraNumero}
            initial={{ y: '-60%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '60%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {texto}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className={n.cifraEtiqueta}>{etiqueta}</span>
    </div>
  );
}

export default function Noticias({ yaEsMiembro, ir }: { yaEsMiembro: boolean; ir?: (v: Vista) => void }) {
  const [ahora, setAhora] = useState<number | null>(null);
  const [quiere, setQuiere] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [articulos, setArticulos] = useState<Articulo[]>([]);

  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    fetch('/api/comunidad/quiero')
      .then((r) => r.json())
      .then((j) => setQuiere(Boolean(j.quiere)))
      .catch(() => setQuiere(false));
    fetch('/api/blog/publicos')
      .then((r) => r.json())
      .then((j) => j.ok && setArticulos(j.articulos))
      .catch(() => {});
    return () => clearInterval(t);
  }, []);

  async function apuntarme() {
    setEnviando(true);
    try {
      const j = await (await fetch('/api/comunidad/quiero', { method: 'POST' })).json();
      if (j.ok) setQuiere(true);
    } catch {
      /* se puede volver a pulsar */
    }
    setEnviando(false);
  }

  const falta = ahora === null ? null : OBJETIVO - ahora;
  const abierta = falta !== null && falta <= 0;
  const p = partes(falta ?? 0);

  return (
    <section className={n.noticias} aria-label="Noticias">
      <div className={n.cabecera}>
        <span className={n.rotulo}>
          <i /> Noticias
        </span>
      </div>

      <motion.article
        className={n.grande}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={n.brillo} aria-hidden="true" />
        <span className={n.etiqueta}>Comunidad Divine</span>
        <h2 className={n.titulo}>{abierta ? 'La Comunidad Divine ya está abierta' : 'La Comunidad Divine abre en'}</h2>

        {!abierta && (
          <div className={n.cuenta} role="timer" aria-live="off" aria-label={falta === null ? '' : `Faltan ${p.dias} días, ${p.horas} horas y ${p.min} minutos`}>
            <Cifra valor={p.dias} etiqueta={p.dias === 1 ? 'día' : 'días'} />
            <span className={n.dos}>:</span>
            <Cifra valor={p.horas} etiqueta="horas" />
            <span className={n.dos}>:</span>
            <Cifra valor={p.min} etiqueta="min" />
            <span className={n.dos}>:</span>
            <Cifra valor={p.seg} etiqueta="seg" />
          </div>
        )}

        <p className={n.cuando}>
          {DIA_APERTURA.charAt(0).toUpperCase() + DIA_APERTURA.slice(1)}, a las {HORA_ESPANA} (España)
          <span>{APERTURA_POR_PAISES}</span>
        </p>
        <p className={n.texto}>
          El sitio para no quedarte sola con los casos difíciles: una clase en vivo al mes con Sorela, casos resueltos entre
          todas y el material de consulta siempre a mano. Quien está en la lista lo sabe antes que nadie y entra con el precio
          fundador.
        </p>

        <div className={n.accion}>
          {abierta ? (
            ir && (
              <button type="button" className={n.boton} onClick={() => ir('comunidad')}>
                Entrar en la Comunidad
              </button>
            )
          ) : yaEsMiembro ? (
            <span className={n.hecho}>✦ Ya eres parte. Nos vemos el día de la apertura.</span>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {quiere ? (
                <motion.span key="si" className={n.hecho} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                  ✦ ¡Estás dentro de la lista! Te avisamos antes que a nadie.
                </motion.span>
              ) : (
                <motion.button
                  key="no"
                  type="button"
                  className={n.boton}
                  onClick={apuntarme}
                  disabled={enviando || quiere === null}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  {enviando ? 'Un momento…' : 'Quiero ser parte del cambio Divine'}
                </motion.button>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.article>

      {articulos.length > 0 && (
        <div className={n.blog}>
          <p className={n.blogRotulo}>Desde el blog</p>
          <div className={n.blogLista}>
            {articulos.map((a) => (
              <a key={a.slug} href={`/blog/${a.slug}`} target="_blank" rel="noreferrer" className={n.articulo}>
                <span className={n.articuloFoto}>
                  {a.portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.portada} alt="" loading="lazy" />
                  ) : null}
                </span>
                <span className={n.articuloTexto}>
                  {a.categoria && <em>{a.categoria}</em>}
                  <strong>{a.titulo}</strong>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
