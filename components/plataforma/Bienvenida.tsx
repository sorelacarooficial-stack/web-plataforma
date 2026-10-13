'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FORMAS_DE_SUMAR, NIVELES, SUMAN_AL_MES, formatoPuntos, type FuentePuntos } from '@/lib/puntos-tipos';
import { LOGROS, OROS_PARA_DIVINE } from '@/lib/logros-tipos';
import { DistintivoCreadora, ICONO_FUENTE, Icono, InsigniaNivel, Trofeo } from './IconosDivine';
import c from './comunidad.module.css';

/**
 * La bienvenida de la comunidad: fija arriba del muro, siempre.
 *
 * No es una publicación guardada en la base de datos sino parte de la
 * pantalla, así nunca se borra por error y la ve todo el mundo desde el
 * primer día: quien tiene la Comunidad y quien entra de visita con su curso,
 * cada una con su final.
 *
 * También explica el juego en cuatro líneas: cómo se ganan los puntos (con
 * los iconos y los valores de lib/puntos-tipos.ts, nunca escritos a mano), los
 * niveles, los trofeos y el ranking del mes. Lo de la comunidad y el aula va
 * primero, que es lo que mueve «Más activas este mes».
 */

const PRIMERO = new Set<FuentePuntos>(SUMAN_AL_MES);
const FORMAS = [
  ...SUMAN_AL_MES.map((f) => FORMAS_DE_SUMAR.find((x) => x.fuente === f)!).filter(Boolean),
  ...FORMAS_DE_SUMAR.filter((f) => !PRIMERO.has(f.fuente)),
];
const PRIMER_NIVEL = NIVELES[0];
const ULTIMO_NIVEL = NIVELES[NIVELES.length - 1];
const TROFEO_DIVINE = LOGROS.find((l) => l.escalon === 'divine')?.nombre ?? 'Divine';

function ComoSeSuma() {
  return (
    <section className={c.bienvenidaPuntos} aria-labelledby="bienvenida-puntos">
      <h4 id="bienvenida-puntos">Puntos, niveles y trofeos</h4>
      <p>Todo lo que haces aquí y en el aula suma puntos:</p>
      <ul className={c.formas}>
        {FORMAS.map((f) => (
          <li key={f.fuente} title={f.texto}>
            <span className={c.formaIcono} aria-hidden="true">
              <Icono nombre={ICONO_FUENTE[f.fuente]} size={17} grosor={1.7} />
            </span>
            <span className={c.formaTexto}>
              <b>+{formatoPuntos(f.puntos)}</b>
              {f.corto}
            </span>
          </li>
        ))}
      </ul>
      <p className={c.bienvenidaLinea}>
        <span className={c.bienvenidaMuestra} aria-hidden="true">
          {NIVELES.map((n) => (
            <InsigniaNivel key={n.n} n={n.n} size={24} />
          ))}
        </span>
        <span>
          Con los puntos subes de nivel: son {NIVELES.length}, de «{PRIMER_NIVEL.nombre}» a «{ULTIMO_NIVEL.nombre}» (desde{' '}
          {formatoPuntos(ULTIMO_NIVEL.desde)} puntos).
        </span>
      </p>
      <p className={c.bienvenidaLinea}>
        <span className={c.bienvenidaMuestra} aria-hidden="true">
          <Trofeo escalon="bronce" glifo="publicacion" size={28} />
          <Trofeo escalon="plata" glifo="respuesta" size={28} />
          <Trofeo escalon="oro" glifo="clase" size={28} />
          <Trofeo escalon="divine" glifo="divine" size={28} />
        </span>
        <span>
          Y ganas trofeos de bronce, plata y oro; con {OROS_PARA_DIVINE} oros, el trofeo «{TROFEO_DIVINE}». Los tienes en tu perfil.
        </span>
      </p>
      <p className={c.bienvenidaLinea}>
        <span className={c.bienvenidaMuestra} aria-hidden="true">
          <Icono nombre="medalla" size={24} grosor={1.6} />
        </span>
        <span>Cada mes, las que más comparten y ayudan salen en «Más activas este mes». Empieza de cero el día 1.</span>
      </p>
    </section>
  );
}

/**
 * El sello «Fijada»: la chincheta dibujada (la misma del menú «Fijar arriba»)
 * en lugar del emoji, que cada móvil pinta a su manera. En el móvil se queda
 * en la chincheta, para que quepa el distintivo de Sorela al lado del nombre.
 */
export function SelloFijada() {
  return (
    <span className={c.selloFijada} title="Fijada arriba">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        <path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" />
      </svg>
      <span className={c.selloTexto}>Fijada</span>
    </span>
  );
}

export default function Bienvenida({
  sorela,
  puedeEscribir,
  abiertaAlEmpezar,
}: {
  sorela: { nombre: string; foto: string | null };
  puedeEscribir: boolean;
  abiertaAlEmpezar: boolean;
}) {
  const [abierta, setAbierta] = useState(abiertaAlEmpezar);

  return (
    <motion.article className={`${c.tarjeta} ${c.bienvenida}`} data-fijada="" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <header className={c.cabecera}>
        <span className={c.avatar} data-sorela="" style={{ width: 44, height: 44, fontSize: 16 }}>
          {sorela.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sorela.foto} alt="" />
          ) : (
            'SC'
          )}
        </span>
        <span className={c.quien}>
          <span className={c.nombreFila}>
            <span className={c.nombre}>{sorela.nombre}</span>
            <DistintivoCreadora className={c.distintivo} />
          </span>
          <span className={c.cuando}>
            Para todas · <b>Bienvenida</b>
          </span>
        </span>
        <span className={c.sellos}>
          <SelloFijada />
        </span>
      </header>

      <h3 className={c.bienvenidaTitulo}>Bienvenida a la Comunidad Divine</h3>
      <p className={c.texto}>
        Este es nuestro sitio: el de las terapeutas que trabajamos con la Técnica Divine. Aquí no estás sola con los casos
        difíciles. Se comparte lo que pasa en cabina, se pregunta sin miedo y se aprende entre todas.
      </p>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            className={c.bienvenidaCuerpo}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={c.bienvenidaBloques}>
              <section>
                <h4>Qué puedes subir</h4>
                <ul>
                  <li>
                    <b>Casos:</b> una clienta concreta, qué tenía, qué hiciste y qué pasó.
                  </li>
                  <li>
                    <b>Dudas:</b> lo que no te sale o no tienes claro. Aquí ninguna pregunta sobra.
                  </li>
                  <li>
                    <b>Resultados:</b> tus antes y después, siempre con el permiso de tu clienta.
                  </li>
                  <li>
                    <b>Recursos:</b> un material, un producto o una lectura que te sirva en cabina.
                  </li>
                </ul>
              </section>
              <section>
                <h4>Cómo funciona</h4>
                <ul>
                  <li>Leo todo lo que se publica y respondo las dudas técnicas.</li>
                  <li>Cada mes hay una clase en vivo: la fecha y el enlace salen aquí, en la tarjeta «Próxima clase en vivo».</li>
                  <li>Puedes subir hasta cuatro fotos por publicación y responder en cada caso.</li>
                </ul>
              </section>
              <section>
                <h4>Las normas</h4>
                <ul>
                  <li>Sin caras ni nombres de clientas si no te han dado permiso.</li>
                  <li>Lo que se comparte aquí, se queda aquí.</li>
                  <li>Siempre con respeto y con cariño: todas empezamos alguna vez.</li>
                </ul>
              </section>
            </div>
            <ComoSeSuma />
            <p className={c.bienvenidaCierre}>
              {puedeEscribir
                ? 'Para empezar, preséntate en tu primera publicación: quién eres, desde dónde trabajas y qué te gustaría aprender. Te estaba esperando.'
                : 'Ahora estás de visita: puedes leerlo todo y dar «me gusta». Cuando termines tu formación y entres en la Comunidad Divine, podrás publicar y responder. Te estaré esperando.'}
            </p>
            <p className={c.firma}>Sorela</p>
          </motion.div>
        )}
      </AnimatePresence>

      <button type="button" className={c.verMas} onClick={() => setAbierta((a) => !a)}>
        {abierta ? 'Recoger' : 'Leer la bienvenida completa'}
      </button>
    </motion.article>
  );
}
