'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { Documento } from '@/lib/material';
import m from './material.module.css';

/**
 * El material del curso: las tarjetas de los dossieres y el lector.
 *
 * El lector enseña cada página como imagen, con el correo de quien mira
 * repetido en diagonal por encima. No hay botón de descargar ni de imprimir, el
 * clic derecho no hace nada y las direcciones de las páginas caducan a los 15
 * minutos. Lo que NO se puede impedir en una web es una foto a la pantalla: por
 * eso la marca de agua, para que esa foto diga de quién salió.
 */

export type DocumentoVisible = Omit<Documento, 'para'> & { portadaUrl: string };

/** La marca de agua: el correo en diagonal, como fondo que se repite. */
function fondoDeMarca(correo: string) {
  const texto = correo.replace(/[<>&'"]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='220'><text x='0' y='130' transform='rotate(-28 180 110)' font-family='sans-serif' font-size='15' fill='rgba(80,60,35,0.16)'>${texto}</text></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

export function TarjetasMaterial({
  documentos,
  abrir,
}: {
  documentos: DocumentoVisible[];
  abrir: (id: string, pagina?: number) => void;
}) {
  return (
    <div className={m.tarjetas}>
      {documentos.map((d) => (
        <button key={d.id} type="button" className={m.tarjeta} onClick={() => abrir(d.id)}>
          <span className={m.portada} onContextMenu={(e) => e.preventDefault()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.portadaUrl} alt="" draggable={false} loading="lazy" />
          </span>
          <span className={m.tarjetaTexto}>
            <span className={m.tarjetaTitulo}>{d.titulo}</span>
            <span className={m.tarjetaSub}>{d.subtitulo}</span>
            <span className={m.tarjetaMeta}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" strokeLinejoin="round" /><path d="M14 3v4h4" strokeLinejoin="round" /></svg>
              {d.paginas} páginas · Leer
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function Lector({
  doc,
  correo,
  desde = 1,
  cerrar,
}: {
  doc: DocumentoVisible;
  correo?: string | null;
  desde?: number;
  cerrar: () => void;
}) {
  const [paginas, setPaginas] = useState<string[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [actual, setActual] = useState(desde);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  /* Qué páginas se piden. No se usa `loading="lazy"` del navegador porque al
     saltar desde el índice no siempre arranca la carga: se piden a mano las
     que están cerca de lo que se ve, y las ya pedidas se quedan. */
  const [cerca, setCerca] = useState<Set<number>>(() => new Set([desde - 1, desde, desde + 1, desde + 2]));
  const acercar = useCallback((ps: number[]) => {
    setCerca((c) => (ps.every((p) => c.has(p)) ? c : new Set([...c, ...ps])));
  }, []);
  const hoja = useRef<HTMLDivElement>(null);
  const ultimaRecarga = useRef(0);
  const yaSalto = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/material?id=${encodeURIComponent(doc.id)}`);
      const j = await r.json();
      if (j.ok) {
        setPaginas(j.paginas);
        setFallo(false);
      } else setFallo(true);
    } catch {
      setFallo(true);
    }
  }, [doc.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Las direcciones caducan: si una página no carga, se piden otras. Como
     mucho una vez cada medio minuto, para no entrar en bucle si falla de
     verdad. */
  const alFallarPagina = () => {
    if (Date.now() - ultimaRecarga.current < 30_000) return;
    ultimaRecarga.current = Date.now();
    cargar();
  };

  /* Mientras está abierto: sin desplazar la página de detrás, Esc cierra, y
     Ctrl+P / Ctrl+S no imprimen ni guardan. */
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener('keydown', alPulsar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener('keydown', alPulsar);
    };
  }, [cerrar]);

  const ir = useCallback((p: number, suave = true) => {
    acercar([p - 1, p, p + 1, p + 2]);
    hoja.current
      ?.querySelector(`[data-pagina="${p}"]`)
      ?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    setIndiceAbierto(false);
  }, [acercar]);

  /* Al abrir por un apartado, se va directo a él. */
  useEffect(() => {
    if (!paginas || yaSalto.current) return;
    yaSalto.current = true;
    if (desde > 1) requestAnimationFrame(() => ir(desde, false));
  }, [paginas, desde, ir]);

  /* Qué página se está leyendo, para el contador y el índice. */
  useEffect(() => {
    if (!paginas || !hoja.current) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setActual(Number((e.target as HTMLElement).dataset.pagina));
        }
      },
      { root: hoja.current, rootMargin: '-45% 0px -50% 0px' }
    );
    // Con margen de sobra, para que la siguiente ya esté cuando se llegue.
    const previa = new IntersectionObserver(
      (entradas) => {
        const ps = entradas.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.pagina));
        if (ps.length) acercar(ps);
      },
      { root: hoja.current, rootMargin: '150% 0px' }
    );
    hoja.current.querySelectorAll('[data-pagina]').forEach((n) => {
      obs.observe(n);
      previa.observe(n);
    });
    return () => {
      obs.disconnect();
      previa.disconnect();
    };
  }, [paginas, acercar]);

  const marca = useMemo(() => (correo ? fondoDeMarca(correo) : undefined), [correo]);
  const apartado = [...doc.indice].reverse().find((i) => i.p <= actual);

  const indice = (
    <ol className={m.indice}>
      <li>
        <button type="button" data-activo={!apartado ? '' : undefined} onClick={() => ir(1)}>
          <span>Portada</span>
          <span className={m.indiceP}>1</span>
        </button>
      </li>
      {doc.indice.map((i) => (
        <li key={i.p}>
          <button type="button" data-activo={apartado?.p === i.p ? '' : undefined} onClick={() => ir(i.p)}>
            <span>{i.titulo}</span>
            <span className={m.indiceP}>{i.p}</span>
          </button>
        </li>
      ))}
    </ol>
  );

  return createPortal(
    <motion.div
      className={m.lector}
      role="dialog"
      aria-modal="true"
      aria-label={doc.titulo}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Si alguien intenta imprimir igualmente, sale en blanco. */}
      <style>{'@media print { body * { display: none !important; } }'}</style>

      <header className={m.barra}>
        <div className={m.barraTitulo}>
          <span className={m.barraRotulo}>Material del curso</span>
          <strong>{doc.titulo}</strong>
        </div>
        <span className={m.contador}>
          {actual} / {doc.paginas}
        </span>
        <button
          type="button"
          className={m.botonIndice}
          onClick={() => setIndiceAbierto((a) => !a)}
          aria-expanded={indiceAbierto}
        >
          Índice
        </button>
        <button type="button" className={m.cerrar} onClick={cerrar} aria-label="Cerrar el dossier">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        </button>
      </header>

      <div className={m.cuerpo}>
        <nav className={m.lateral} data-abierto={indiceAbierto ? '' : undefined} aria-label="Índice del dossier">
          <p className={m.lateralRotulo}>Índice</p>
          {indice}
        </nav>

        <div className={m.hoja} ref={hoja}>
          {fallo && !paginas && (
            <p className={m.aviso}>
              No he podido abrir el dossier.{' '}
              <button type="button" onClick={cargar}>
                Reintentar
              </button>
            </p>
          )}
          {!paginas && !fallo && <p className={m.aviso}>Abriendo el dossier…</p>}
          {paginas?.map((url, i) => (
            <div key={i} className={m.pagina} data-pagina={i + 1}>
              {cerca.has(i + 1) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`Página ${i + 1}`} draggable={false} onError={alFallarPagina} />
              )}
              {marca && <span className={m.marca} style={{ backgroundImage: marca }} aria-hidden="true" />}
              <span className={m.numero}>{i + 1}</span>
            </div>
          ))}
          {paginas && correo && (
            <p className={m.pie}>
              Material personal de {correo}. Solo para tu formación: no se puede compartir.
            </p>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
