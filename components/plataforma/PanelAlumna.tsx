'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { minutos, porBloques, type Leccion, type Progreso } from '@/lib/aula';
import { tieneMembresia, type Acceso } from '@/lib/accesos';
import type { Vista } from '@/lib/plataforma';
import type { ProximaClase, Publicacion } from '@/lib/comunidad-tipos';
import Noticias from './Noticias';
import p from './panelalumna.module.css';

/**
 * El inicio de quien tiene algo contratado: su panel.
 *
 * Antes era una lista de «lo que tienes y lo que falta». Ahora es un panel de
 * verdad: cuánto lleva del curso, la clase por la que va con un botón para
 * seguir, el material, lo próximo de su agenda y lo último de la comunidad.
 * Todo lleva a su pantalla con un clic.
 */

type Evento = { id: string; titulo: string; cuando: string | null; tipo: string; estado: string };
type Doc = { id: string; titulo: string; subtitulo: string; paginas: number; portadaUrl: string };

const saludo = () => {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
};
const HOY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const DIA = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const DIA_SEMANA = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Anillo({ valor }: { valor: number }) {
  const r = 46;
  const cc = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 110 110" className={p.anillo} aria-hidden="true">
      <circle cx="55" cy="55" r={r} className={p.anilloFondo} />
      <motion.circle
        cx="55"
        cy="55"
        r={r}
        className={p.anilloValor}
        strokeDasharray={cc}
        initial={{ strokeDashoffset: cc }}
        animate={{ strokeDashoffset: cc * (1 - valor / 100) }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      />
      <text x="55" y="60" textAnchor="middle" className={p.anilloNumero}>
        {valor}%
      </text>
    </svg>
  );
}

const aparecer = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
});

export default function PanelAlumna({
  nombre,
  foto,
  accesos,
  ir,
}: {
  nombre: string;
  foto: string | null;
  accesos: Acceso[];
  ir: (v: Vista) => void;
}) {
  const [lecciones, setLecciones] = useState<Leccion[] | null>(null);
  const [progreso, setProgreso] = useState<Record<string, Progreso>>({});
  const [docs, setDocs] = useState<Doc[]>([]);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [com, setCom] = useState<{ publicaciones: Publicacion[]; proximaClase: ProximaClase } | null>(null);

  useEffect(() => {
    const json = (u: string) => fetch(u).then((r) => r.json()).catch(() => ({ ok: false }));
    json('/api/lecciones').then((j) => setLecciones(j.ok ? j.lecciones ?? [] : []));
    json('/api/progreso').then((j) => j.ok && setProgreso(j.progreso ?? {}));
    json('/api/material').then((j) => j.ok && setDocs(j.documentos ?? []));
    json('/api/agenda').then((j) => setEventos(j.ok ? j.eventos ?? [] : []));
    json('/api/comunidad').then((j) => j.ok && setCom({ publicaciones: j.publicaciones ?? [], proximaClase: j.proximaClase ?? null }));
  }, []);

  const ordenadas = useMemo(
    () => (lecciones ? porBloques(lecciones).flatMap((b) => b.lecciones.map((l) => ({ ...l, modulo: l.modulo || b.nombre }))) : []),
    [lecciones]
  );
  const hechas = ordenadas.filter((l) => progreso[l.id]?.completada).length;
  const pct = ordenadas.length ? Math.round((hechas / ordenadas.length) * 100) : 0;
  const siguiente = ordenadas.find((l) => !progreso[l.id]?.completada) ?? ordenadas[0];
  const pSig = siguiente ? progreso[siguiente.id] : undefined;
  const pctSig = siguiente?.duracion && pSig?.visto ? Math.min(99, Math.round((pSig.visto / siguiente.duracion) * 100)) : 0;
  const minutosVistos = Math.round(Object.values(progreso).reduce((s, x) => s + (x.visto || 0), 0) / 60);
  const proximos = (eventos ?? []).filter((e) => e.estado !== 'Cancelado' && e.cuando && new Date(e.cuando).getTime() > Date.now() - 3600_000).slice(0, 3);
  const miembro = tieneMembresia(accesos);
  const pila = (nombre || '').trim().split(/\s+/)[0];

  return (
    <div className={p.panel}>
      {/* ---------- Saludo y progreso ---------- */}
      <motion.section className={p.hero} {...aparecer(0)}>
        <div className={p.heroTexto}>
          <span className={p.fecha}>{mayus(HOY.format(new Date()))}</span>
          <h2 className={p.saludo}>
            {saludo()}
            {pila ? `, ${pila}` : ''}
          </h2>
          <p className={p.frase}>
            {ordenadas.length === 0
              ? 'Tu espacio está abierto. En cuanto Sorela publique tus clases, aparecen aquí.'
              : hechas === 0
                ? 'Tu formación te está esperando. Empieza por la primera clase, a tu ritmo.'
                : hechas === ordenadas.length
                  ? 'Has terminado todas las clases. Repasa cuando quieras: las manos se afinan repitiendo.'
                  : `Llevas ${hechas} de ${ordenadas.length} clases. Sigue así: cada sesión se nota en las manos.`}
          </p>
          {siguiente && (
            <button type="button" className={p.seguir} onClick={() => ir('aula')}>
              <span className={p.seguirFoto}>
                {siguiente.portada ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={siguiente.portada} alt="" />
                ) : null}
                <span className={p.play} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
                </span>
              </span>
              <span className={p.seguirTexto}>
                <span className={p.seguirRotulo}>{hechas === 0 && !pctSig ? 'Empieza por aquí' : 'Seguir donde lo dejé'}</span>
                <strong>{siguiente.titulo}</strong>
                <span className={p.seguirMeta}>
                  {siguiente.modulo}
                  {siguiente.duracion ? ` · ${minutos(siguiente.duracion)}` : ''}
                </span>
                {pctSig > 0 && (
                  <span className={p.barra}>
                    <i style={{ width: `${pctSig}%` }} />
                  </span>
                )}
              </span>
            </button>
          )}
        </div>
        <div className={p.heroProgreso}>
          <Anillo valor={pct} />
          <div className={p.datos}>
            <span>
              <b>{hechas}</b> {hechas === 1 ? 'clase hecha' : 'clases hechas'}
            </span>
            <span>
              <b>{minutosVistos}</b> min de estudio
            </span>
            <span>
              <b>{pct === 100 ? 'Listo' : 'Al 100 %'}</b> tu certificado
            </span>
          </div>
        </div>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className={p.heroFoto} />
        )}
      </motion.section>

      {/* ---------- Noticias: la apertura de la comunidad, en grande ---------- */}
      <Noticias yaEsMiembro={miembro} ir={ir} />

      <div className={p.rejilla}>
        {/* ---------- Clases ---------- */}
        <motion.section className={p.tarjeta} {...aparecer(1)}>
          <header className={p.cabecera}>
            <h3>Tus clases</h3>
            <button type="button" className={p.enlace} onClick={() => ir('aula')}>
              Ver todas →
            </button>
          </header>
          {lecciones === null ? (
            <div className={p.esqueleto} />
          ) : ordenadas.length === 0 ? (
            <p className={p.vacio}>Todavía no hay clases publicadas.</p>
          ) : (
            <ul className={p.clases}>
              {ordenadas.slice(0, 4).map((l) => {
                const pr = progreso[l.id];
                const v = pr?.completada ? 100 : l.duracion && pr?.visto ? Math.min(99, Math.round((pr.visto / l.duracion) * 100)) : 0;
                return (
                  <li key={l.id}>
                    <button type="button" onClick={() => ir('aula')}>
                      <span className={p.mini}>
                        {l.portada ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.portada} alt="" />
                        ) : null}
                      </span>
                      <span className={p.claseTexto}>
                        <strong>{l.titulo}</strong>
                        <em>{l.modulo}</em>
                      </span>
                      <span className={p.estado} data-hecha={pr?.completada ? '' : undefined}>
                        {pr?.completada ? '✓' : `${v}%`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>

        {/* ---------- Material ---------- */}
        <motion.section className={p.tarjeta} {...aparecer(2)}>
          <header className={p.cabecera}>
            <h3>Tu material</h3>
            <button type="button" className={p.enlace} onClick={() => ir('aula')}>
              Abrir →
            </button>
          </header>
          {docs.length === 0 ? (
            <p className={p.vacio}>Los dossieres de cada día aparecerán aquí.</p>
          ) : (
            <div className={p.dossieres}>
              {docs.map((d) => (
                <button key={d.id} type="button" className={p.dossier} onClick={() => ir('aula')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.portadaUrl} alt="" draggable={false} />
                  <span>
                    <strong>{d.titulo}</strong>
                    <em>{d.paginas} páginas</em>
                  </span>
                </button>
              ))}
            </div>
          )}
        </motion.section>

        {/* ---------- Agenda ---------- */}
        <motion.section className={p.tarjeta} {...aparecer(3)}>
          <header className={p.cabecera}>
            <h3>Tu agenda</h3>
            <button type="button" className={p.enlace} onClick={() => ir('agenda')}>
              {proximos.length ? 'Ver agenda →' : 'Apuntar algo →'}
            </button>
          </header>
          {eventos === null ? (
            <div className={p.esqueleto} />
          ) : proximos.length === 0 ? (
            <p className={p.vacio}>Nada apuntado. Tu agenda es para tus sesiones con clientas: apúntalas y te las recuerda.</p>
          ) : (
            <ul className={p.eventos}>
              {proximos.map((e) => (
                <li key={e.id}>
                  <span className={p.eventoDia}>
                    <b>{new Date(e.cuando!).getDate()}</b>
                    <em>{DIA_SEMANA.format(new Date(e.cuando!)).replace('.', '')}</em>
                  </span>
                  <span className={p.eventoTexto}>
                    <strong>{e.titulo}</strong>
                    <em>
                      {HORA.format(new Date(e.cuando!))} · {e.tipo}
                    </em>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* ---------- Comunidad ---------- */}
        <motion.section className={`${p.tarjeta} ${p.oscura}`} {...aparecer(4)}>
          <header className={p.cabecera}>
            <h3>Comunidad</h3>
            <button type="button" className={p.enlace} onClick={() => ir('comunidad')}>
              Entrar →
            </button>
          </header>
          {com?.proximaClase ? (
            <div className={p.claseVivo}>
              <span>Próxima clase en vivo</span>
              <strong>{com.proximaClase.titulo}</strong>
              <em>{mayus(DIA.format(new Date(com.proximaClase.cuando)))} · {HORA.format(new Date(com.proximaClase.cuando))}</em>
            </div>
          ) : null}
          {com && com.publicaciones.length > 0 ? (
            <ul className={p.posts}>
              {com.publicaciones.slice(0, 2).map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => ir('comunidad')}>
                    <strong>{x.titulo}</strong>
                    <em>
                      {x.autora.nombre} · {x.respuestas} {x.respuestas === 1 ? 'respuesta' : 'respuestas'}
                    </em>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={p.vacioClaro}>
              {miembro ? 'Sé la primera en compartir un caso.' : 'Puedes leer la comunidad de terapeutas. Para escribir, entras al terminar tu formación.'}
            </p>
          )}
        </motion.section>
      </div>
    </div>
  );
}
