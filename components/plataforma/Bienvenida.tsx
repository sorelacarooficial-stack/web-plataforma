'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import c from './comunidad.module.css';

/**
 * La bienvenida de la comunidad: fija arriba del muro, siempre.
 *
 * No es una publicación guardada en la base de datos sino parte de la
 * pantalla, así nunca se borra por error y la ve todo el mundo desde el
 * primer día: quien tiene la Comunidad y quien entra de visita con su curso,
 * cada una con su final.
 */

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
          <span className={c.nombre}>
            {sorela.nombre}
            <span className={c.selloSorela}>✦ Sorela</span>
          </span>
          <span className={c.cuando}>
            Para todas · <b>Bienvenida</b>
          </span>
        </span>
        <span className={c.sellos}>
          <span className={c.selloFijada}>📌 Fijada</span>
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
                  <li>Quien más comparte y ayuda a las demás sube en «Más activas este mes».</li>
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
