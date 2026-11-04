'use client';

import { useEffect, useState } from 'react';
import css from './agenteproximamente.module.css';

/**
 * «Próximamente: Agente IA Divine». Se abre sola la primera vez que alguien
 * entra (se recuerda en este navegador) y después se vuelve a abrir con la
 * pastilla de abajo a la derecha.
 *
 * Es un anuncio: el agente todavía no está construido. Por eso dice
 * «Próximamente» y lo que TENDRÁ, nunca que ya funciona. Va incluido en la
 * Membresía Divine®, que es solo para terapeutas homologadas.
 */

const CLAVE = 'divine:agente-ia-visto';

const PODRA: { titulo: string; texto: string; icono: string }[] = [
  { icono: 'M4 5h16v11H9l-5 4V5Z', titulo: 'Responde por ti', texto: 'A tus clientas por WhatsApp e Instagram, a cualquier hora y con tu tono.' },
  { icono: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4', titulo: 'Agenda y confirma', texto: 'Da cita, mueve las que se caen y llena los huecos libres de tu semana.' },
  { icono: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4', titulo: 'Recuerda y recupera', texto: 'Avisa el día antes y escribe a las clientas que hace tiempo que no vuelven.' },
  { icono: 'm3 11 18-8-7 18-3-7-8-3Zm8 3 4-4', titulo: 'Publica en tus redes', texto: 'Prepara y publica tus antes y después con el texto y la hora que mejor funcionan.' },
  { icono: 'M4 6h11v12H4zM15 10l5-3v10l-5-3', titulo: 'Crea vídeos con tu marca', texto: 'A partir de tus sesiones, listos para reels, sin agencias.' },
  { icono: 'M2.5 5h19v14h-19zM2.5 10h19M6 15h4', titulo: 'Vende y cobra', texto: 'Ofrece tus bonos y tratamientos, cobra online y lo deja en tu agenda.' },
];

export default function AgenteProximamente() {
  const [abierto, setAbierto] = useState(false);

  /* La primera vez, cuando no haya otra ventana abierta (la bienvenida o el
     recorrido salen también la primera vez): se espera a que se cierren. */
  useEffect(() => {
    let visto = true;
    try {
      visto = !!localStorage.getItem(CLAVE);
    } catch {}
    if (visto) return;
    const id = setInterval(() => {
      if (!document.querySelector('[role="dialog"], [aria-modal="true"]')) {
        setAbierto(true);
        clearInterval(id);
      }
    }, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [abierto]);

  const cerrar = () => {
    setAbierto(false);
    try {
      localStorage.setItem(CLAVE, '1');
    } catch {}
  };

  return (
    <>
      <button type="button" className={css.pastilla} onClick={() => setAbierto(true)}>
        <span className={css.chispa} aria-hidden />
        Agente IA <em>Pronto</em>
      </button>

      {abierto && (
        <div className={css.fondo} role="dialog" aria-modal="true" aria-labelledby="agente-titulo" onClick={cerrar}>
          <div className={css.caja} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={css.cerrar} onClick={cerrar} aria-label="Cerrar">
              ×
            </button>

            <div className={css.cabeza}>
              <div className={css.orbe} aria-hidden>
                <span className={css.anillo} />
                <span className={css.anillo2} />
                <span className={css.nucleo}>IA</span>
              </div>
              <div>
                <p className={css.eyebrow}>Próximamente · Membresía Divine®</p>
                <h2 id="agente-titulo" className={css.titulo}>
                  Tu <strong>Agente IA Divine</strong>, adaptado a tu negocio
                </h2>
                <p className={css.sub}>
                  Se conectará con tu agenda, tu WhatsApp, tus redes y tu web. No solo responderá: ejecutará, publicará y venderá mientras tú estás en
                  cabina.
                </p>
              </div>
            </div>

            <ul className={css.lista}>
              {PODRA.map((p, i) => (
                <li key={p.titulo} className={css.item} style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                  <span className={css.icono}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={p.icono} />
                    </svg>
                  </span>
                  <div>
                    <b>{p.titulo}</b>
                    <span>{p.texto}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className={css.pie}>
              <p>
                Incluido en la <b>Membresía Divine®</b>, para terapeutas homologadas por Sorela Caro. Te avisaremos aquí en cuanto esté listo.
              </p>
              <button type="button" className={css.boton} onClick={cerrar}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
