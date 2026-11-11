'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { TECNICA_COMPLETA, urlIncrustarDrive, urlVerDrive } from '@/lib/tecnica-completa';
import t from './tecnicacompleta.module.css';

/**
 * «Ver toda la técnica completa»: los vídeos largos, uno detrás de otro, en
 * una ventana grande. Se ven con el reproductor de Drive; si no carga (Drive
 * aún procesando un vídeo tan grande, o un navegador que lo bloquea), el
 * enlace de debajo lo abre en Drive.
 */
export default function TecnicaCompleta({ cerrar }: { cerrar: () => void }) {
  const [i, setI] = useState(0);
  const v = TECNICA_COMPLETA[i];

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', f);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', f);
      document.body.style.overflow = previo;
    };
  }, [cerrar]);

  if (!v || typeof document === 'undefined') return null;
  return createPortal(
    <div className={t.fondo} role="dialog" aria-modal="true" aria-labelledby="tecnica-titulo" onClick={cerrar}>
      <motion.div
        className={t.caja}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className={t.cabeza}>
          <div>
            <span className={t.rotulo}>La técnica completa · para estudiar a tu ritmo</span>
            <h3 id="tecnica-titulo" className={t.titulo}>
              {v.titulo.split(' · ')[0]} <strong>{v.titulo.split(' · ')[1] ?? ''}</strong>
            </h3>
          </div>
          <button type="button" className={t.cerrar} onClick={cerrar} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className={t.pantalla}>
          <iframe
            key={v.id}
            src={urlIncrustarDrive(v.id)}
            title={v.titulo}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>

        <div className={t.pie}>
          <p className={t.texto}>
            {v.texto} Puedes verlo las veces que quieras, sin que Sorela esté presente.{' '}
            <a href={urlVerDrive(v.id)} target="_blank" rel="noopener noreferrer">
              ¿No se ve? Ábrelo aquí
            </a>
          </p>
          {TECNICA_COMPLETA.length > 1 && (
            <div className={t.lista} role="tablist" aria-label="Vídeos">
              {TECNICA_COMPLETA.map((x, k) => (
                <button key={x.id} type="button" role="tab" aria-selected={k === i} className={t.opcion} data-activo={k === i ? '' : undefined} onClick={() => setI(k)}>
                  <span className={t.num}>{String(k + 1).padStart(2, '0')}</span>
                  {x.titulo}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
