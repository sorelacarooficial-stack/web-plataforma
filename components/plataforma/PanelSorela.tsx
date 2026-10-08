'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PENDIENTE_BETA, type Vista } from '@/lib/plataforma';
import { APERTURA, DIA_APERTURA, HORA_ESPANA } from '@/lib/apertura';
import { ETIQUETA_TIPO, TIPOS, type Tipo } from '@/lib/origenes';
import css from './plataforma.module.css';
import p from './panel.module.css';

/**
 * El panel de Sorela: lo primero que ve al entrar.
 *
 * Tres preguntas, en este orden: ¿a quién tengo que escribir hoy? (la
 * asistente), ¿cómo va la cosa? (las cifras y el gráfico) y ¿quién ha llegado?
 * (los últimos contactos, con los botones para escribirles sin salir de aquí).
 *
 * La asistente usa IA (lib/ia-panel.ts). Si la clave no está puesta, el resto
 * del panel funciona igual y la tarjeta lo explica.
 */

type Contacto = {
  id: string;
  nombre: string;
  correo: string;
  whatsapp: string;
  ciudad: string;
  origen: string;
  tipo: Tipo;
  estado: string;
  creado: string | null;
};

type Prioridad = { id: string; porque: string; accion: string };
type Resumen = { saludo: string; prioridades: Prioridad[]; consejo: string };
type Borrador = { id: string; canal: 'whatsapp' | 'correo'; asunto: string; texto: string };

const CLASE_ESTADO: Record<string, string> = {
  Nuevo: css.estadoTinta,
  Contactado: css.estadoNeutro,
  'En conversación': css.estadoOro,
  Cerrado: css.estadoApagado,
  Descartado: css.estadoApagado,
};

const DIA = 86400000;

const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('') || '·';

function haceCuanto(iso: string | null) {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const soloDigitos = (t: string) => t.replace(/\D/g, '');

const enlaceWhatsapp = (numero: string, texto = '') =>
  `https://wa.me/${soloDigitos(numero)}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;

const enlaceCorreo = (correo: string, asunto = '', texto = '') =>
  `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;

/* ==========================================================================
   La asistente
   ========================================================================== */

function Asistente({
  activa,
  contactos,
  onRedactar,
}: {
  activa: boolean | null;
  contactos: Contacto[];
  onRedactar: (id: string, canal: 'whatsapp' | 'correo') => void;
}) {
  const [estado, setEstado] = useState<'quieta' | 'pensando' | 'lista' | 'fallo'>('quieta');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [fallo, setFallo] = useState('');

  const porId = useMemo(() => new Map(contactos.map((c) => [c.id, c])), [contactos]);

  const preparar = async () => {
    setEstado('pensando');
    setFallo('');
    try {
      const r = await fetch('/api/ia/panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'resumen' }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.motivo);
      setResumen({ saludo: j.saludo, prioridades: j.prioridades, consejo: j.consejo });
      setEstado('lista');
    } catch (e) {
      setFallo(
        String((e as Error).message) === 'ocupada'
          ? 'La asistente está saturada ahora mismo. Prueba en un minuto.'
          : 'No he podido preparar el resumen. Prueba otra vez en un momento.'
      );
      setEstado('fallo');
    }
  };

  return (
    <section className={p.asistente} aria-live="polite">
      <div className={p.asistenteCabeza}>
        <span className={p.chispa} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z" />
          </svg>
        </span>
        <div className={p.asistenteTitulos}>
          <p className={p.asistenteRotulo}>Tu asistente</p>
          <h2 className={p.asistenteTitulo}>A quién escribir hoy</h2>
        </div>
        {activa && estado !== 'pensando' && (
          <button type="button" className={p.botonDorado} onClick={preparar}>
            {estado === 'lista' ? 'Actualizar' : 'Preparar mi día'}
          </button>
        )}
      </div>

      {activa === null && <p className={p.asistenteTexto}>Comprobando…</p>}

      {activa === false && (
        <p className={p.asistenteTexto}>
          Lee tus contactos, te dice a quién escribir primero y te deja el mensaje redactado con tu
          voz, listo para enviar por WhatsApp o por correo. Para encenderla falta poner la clave de
          IA en la configuración de la web.
        </p>
      )}

      {activa && estado === 'quieta' && (
        <p className={p.asistenteTexto}>
          Miro tus contactos abiertos y te digo a quién escribir primero y por qué. Después te
          preparo cada mensaje con tu voz: tú lo lees, lo cambias si quieres y lo envías.
        </p>
      )}

      {estado === 'pensando' && (
        <div className={p.pensando}>
          <span className={p.puntos} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Mirando tus contactos…
        </div>
      )}

      {estado === 'fallo' && <p className={p.asistenteTexto}>{fallo}</p>}

      <AnimatePresence>
        {estado === 'lista' && resumen && (
          <motion.div
            className={p.resultado}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className={p.saludo}>{resumen.saludo}</p>
            {resumen.prioridades.length > 0 && (
              <ol className={p.prioridades}>
                {resumen.prioridades.map((pr, i) => {
                  const c = porId.get(pr.id);
                  if (!c) return null;
                  return (
                    <motion.li
                      key={pr.id}
                      className={p.prioridad}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 * i }}
                    >
                      <span className={p.numero}>{i + 1}</span>
                      <div className={p.prioridadTexto}>
                        <p className={p.prioridadNombre}>{c.nombre}</p>
                        <p className={p.prioridadPorque}>{pr.porque}</p>
                        <p className={p.prioridadAccion}>{pr.accion}</p>
                      </div>
                      <div className={p.prioridadBotones}>
                        {c.whatsapp && (
                          <button type="button" className={p.botonClaro} onClick={() => onRedactar(c.id, 'whatsapp')}>
                            WhatsApp
                          </button>
                        )}
                        <button type="button" className={p.botonClaro} onClick={() => onRedactar(c.id, 'correo')}>
                          Correo
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            )}
            {resumen.consejo && <p className={p.consejo}>{resumen.consejo}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ==========================================================================
   El gráfico de entradas por día
   ========================================================================== */

function Entradas({ contactos }: { contactos: Contacto[] }) {
  const [encima, setEncima] = useState<number | null>(null);
  const DIAS = 14;

  const dias = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const lista = Array.from({ length: DIAS }, (_, i) => {
      const d = new Date(hoy.getTime() - (DIAS - 1 - i) * DIA);
      return { fecha: d, n: 0 };
    });
    for (const c of contactos) {
      if (!c.creado) continue;
      const d = new Date(c.creado);
      d.setHours(0, 0, 0, 0);
      const i = Math.round((d.getTime() - lista[0].fecha.getTime()) / DIA);
      if (i >= 0 && i < DIAS) lista[i].n += 1;
    }
    return lista;
  }, [contactos]);

  const max = Math.max(1, ...dias.map((d) => d.n));
  const total = dias.reduce((s, d) => s + d.n, 0);
  const fmtCorto = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
  const fmtLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section className={`${css.tarjeta} ${p.grafico}`}>
      <div className={p.graficoCabeza}>
        <h2 className={css.rotuloSeccion}>Contactos por día</h2>
        <span className={p.graficoTotal}>
          {total} en 14 días
        </span>
      </div>
      <div className={p.barras} onMouseLeave={() => setEncima(null)}>
        <span className={p.ejeMax} aria-hidden="true">{max}</span>
        {dias.map((d, i) => (
          <button
            type="button"
            key={i}
            className={p.columna}
            onMouseEnter={() => setEncima(i)}
            onFocus={() => setEncima(i)}
            onBlur={() => setEncima(null)}
            aria-label={`${fmtLargo.format(d.fecha)}: ${d.n} contacto${d.n === 1 ? '' : 's'}`}
          >
            <motion.span
              className={`${p.barra} ${d.n === 0 ? p.barraCero : ''} ${i === DIAS - 1 ? p.barraHoy : ''}`}
              initial={{ height: 0 }}
              animate={{ height: d.n === 0 ? 2 : `${(d.n / max) * 100}%` }}
              transition={{ delay: 0.03 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
            {encima === i && (
              <span className={p.globo} role="tooltip">
                <b>{d.n}</b> {fmtCorto.format(d.fecha)}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={p.ejeX} aria-hidden="true">
        <span>{fmtCorto.format(dias[0].fecha)}</span>
        <span>{fmtCorto.format(dias[7].fecha)}</span>
        <span>Hoy</span>
      </div>
    </section>
  );
}

function Procedencia({ contactos }: { contactos: Contacto[] }) {
  const cuenta = TIPOS.map((t) => ({ t, n: contactos.filter((c) => c.tipo === t).length })).filter(
    (x) => x.n > 0
  );
  const max = Math.max(1, ...cuenta.map((x) => x.n));
  return (
    <section className={`${css.tarjeta} ${p.procedencia}`}>
      <h2 className={css.rotuloSeccion}>Qué buscan</h2>
      {cuenta.length === 0 ? (
        <p className={css.vacioTexto}>Aún no hay contactos.</p>
      ) : (
        <ul className={p.tiras}>
          {cuenta
            .sort((a, b) => b.n - a.n)
            .map((x, i) => (
              <li key={x.t} className={p.tira}>
                <span className={p.tiraNombre}>{ETIQUETA_TIPO[x.t]}</span>
                <span className={p.tiraValor}>{x.n}</span>
                <span className={p.tiraFondo}>
                  <motion.span
                    className={p.tiraRelleno}
                    initial={{ width: 0 }}
                    animate={{ width: `${(x.n / max) * 100}%` }}
                    transition={{ delay: 0.1 * i, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

/* ==========================================================================
   El panel
   ========================================================================== */

export function PanelSorela({ ir }: { ir: (v: Vista) => void }) {
  const [lista, setLista] = useState<Contacto[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [activa, setActiva] = useState<boolean | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [redactando, setRedactando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vivo = true;
    fetch('/api/contactos')
      .then((r) => r.json())
      .then((c) => {
        if (!vivo) return;
        if (c.ok) setLista(c.contactos);
        else {
          setFallo(true);
          setLista([]);
        }
      })
      .catch(() => {
        if (!vivo) return;
        setFallo(true);
        setLista([]);
      });
    fetch('/api/ia/panel')
      .then((r) => r.json())
      .then((j) => vivo && setActiva(Boolean(j.ok && j.activa)))
      .catch(() => vivo && setActiva(false));
    // Si Sorela cambia de pantalla mientras carga, no se toca un estado que
    // ya no está montado.
    return () => {
      vivo = false;
    };
  }, []);

  const l = useMemo(() => lista ?? [], [lista]);
  const ahora = Date.now();
  const semana = l.filter((c) => c.creado && ahora - new Date(c.creado).getTime() < 7 * DIA).length;
  const sinAtender = l.filter((c) => c.estado === 'Nuevo').length;
  const faltan = Math.max(0, Math.ceil((new Date(APERTURA).getTime() - ahora) / DIA));
  const hechas = PENDIENTE_BETA.filter((x) => x.listo).length;

  const kpis = [
    { label: 'Sin atender', valor: lista === null ? '·' : String(sinAtender), nota: 'contactos que nadie ha tocado', urgente: sinAtender > 0 },
    { label: 'Esta semana', valor: lista === null ? '·' : String(semana), nota: 'han dejado sus datos en la web' },
    { label: 'En total', valor: lista === null ? '·' : String(l.length), nota: 'desde que la web capta' },
    { label: 'Abre la Comunidad', valor: faltan === 0 ? 'Hoy' : `${faltan} días`, nota: `${DIA_APERTURA}, ${HORA_ESPANA}` },
  ];

  const redactar = useCallback(async (id: string, canal: 'whatsapp' | 'correo') => {
    setRedactando(id);
    setBorrador(null);
    setCopiado(false);
    try {
      const r = await fetch('/api/ia/panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'mensaje', id, canal }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.motivo);
      setBorrador({ id, canal, asunto: j.asunto ?? '', texto: j.texto ?? '' });
    } catch {
      setAviso('No he podido redactar el mensaje. Prueba otra vez.');
      setTimeout(() => setAviso(''), 4000);
    } finally {
      setRedactando(null);
    }
  }, []);

  const marcar = async (id: string, estado: string) => {
    setLista((ls) => (ls ? ls.map((c) => (c.id === id ? { ...c, estado } : c)) : ls));
    const r = await fetch('/api/contactos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado }),
    }).catch(() => null);
    if (!r?.ok) {
      setAviso('No se ha podido guardar el cambio.');
      setTimeout(() => setAviso(''), 4000);
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const contactoBorrador = borrador ? l.find((c) => c.id === borrador.id) : undefined;

  return (
    <>
      <Asistente activa={activa} contactos={l} onRedactar={redactar} />

      <div className={p.kpis}>
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            className={`${css.kpi} ${i === 3 ? p.kpiOscuro : ''}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.5 }}
          >
            <span className={css.kpiLabel}>{k.label}</span>
            <span className={css.kpiValor}>
              {k.valor}
              {k.urgente && <span className={p.latido} aria-hidden="true" />}
            </span>
            <span className={css.kpiNota}>{k.nota}</span>
          </motion.div>
        ))}
      </div>

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          No he podido leer los contactos. Comprueba la configuración de Firebase.
        </p>
      )}

      <div className={p.dosColumnas}>
        <Entradas contactos={l} />
        <Procedencia contactos={l} />
      </div>

      <section className={css.tarjeta} style={{ gap: 4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <h2 className={css.rotuloSeccion}>Últimos contactos</h2>
          {l.length > 0 && (
            <button type="button" className={css.enlaceAccion} onClick={() => ir('leads')}>
              Ver todos
            </button>
          )}
        </div>

        {lista === null ? (
          <p className={css.vacioTexto}>Cargando…</p>
        ) : l.length === 0 ? (
          <p className={css.vacioTexto}>
            Todavía no se ha apuntado nadie. En cuanto alguien deje su nombre y su correo en la
            web, aparece aquí.
          </p>
        ) : (
          <ul className={p.contactos}>
            {l.slice(0, 6).map((c, i) => (
              <motion.li
                key={c.id}
                className={p.contacto}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
              >
                <span className={p.avatar} data-tipo={c.tipo} aria-hidden="true">
                  {iniciales(c.nombre)}
                </span>
                <span className={p.quien}>
                  <span className={p.nombre}>{c.nombre}</span>
                  <span className={p.meta}>
                    {ETIQUETA_TIPO[c.tipo]}
                    {c.ciudad && ` · ${c.ciudad}`}
                    {c.creado && ` · ${haceCuanto(c.creado)}`}
                  </span>
                </span>
                <span className={`${css.estado} ${CLASE_ESTADO[c.estado] ?? ''}`}>{c.estado}</span>
                <span className={p.acciones}>
                  {c.whatsapp && (
                    <a className={p.accion} href={enlaceWhatsapp(c.whatsapp)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${c.nombre}`} title="WhatsApp">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
                    </a>
                  )}
                  {c.correo && (
                    <a className={p.accion} href={enlaceCorreo(c.correo)} aria-label={`Correo a ${c.nombre}`} title="Correo">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                    </a>
                  )}
                  {activa && (
                    <button
                      type="button"
                      className={`${p.accion} ${p.accionIA}`}
                      onClick={() => redactar(c.id, c.whatsapp ? 'whatsapp' : 'correo')}
                      disabled={redactando === c.id}
                      title="Redactar con la asistente"
                      aria-label={`Redactar un mensaje para ${c.nombre}`}
                    >
                      {redactando === c.id ? (
                        <span className={p.girando} aria-hidden="true" />
                      ) : (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" /></svg>
                      )}
                    </button>
                  )}
                  {c.estado === 'Nuevo' && (
                    <button type="button" className={p.accionTexto} onClick={() => marcar(c.id, 'Contactado')}>
                      Atendido
                    </button>
                  )}
                </span>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <section className={css.tarjeta} style={{ gap: 4 }}>
        <div className={p.faltaCabeza}>
          <h2 className={css.rotuloSeccion}>Lo que falta para abrir</h2>
          <span className={p.faltaCuenta}>
            {hechas} de {PENDIENTE_BETA.length}
          </span>
        </div>
        <span className={p.progreso} aria-hidden="true">
          <motion.span
            className={p.progresoRelleno}
            initial={{ width: 0 }}
            animate={{ width: `${(hechas / PENDIENTE_BETA.length) * 100}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
        {PENDIENTE_BETA.map((x) => (
          <div key={x.que} className={css.fila} style={{ padding: '13px 0' }}>
            <span style={{ fontSize: 14.5, fontWeight: 300, color: x.listo ? 'var(--muted)' : 'var(--ink-4)' }}>
              {x.que}
            </span>
            <span className={`${css.estado} ${x.listo ? css.estadoOro : css.estadoApagado}`}>
              {x.listo ? 'Hecho' : 'Pendiente'}
            </span>
          </div>
        ))}
      </section>

      <AnimatePresence>
        {borrador && (
          <motion.div
            className={p.borradorFondo}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setBorrador(null)}
          >
            <motion.div
              className={p.borrador}
              role="dialog"
              aria-modal="true"
              aria-label="Mensaje redactado"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={p.borradorCabeza}>
                <p className={p.asistenteRotulo}>
                  {borrador.canal === 'whatsapp' ? 'WhatsApp' : 'Correo'} para {contactoBorrador?.nombre}
                </p>
                <button type="button" className={p.cerrar} onClick={() => setBorrador(null)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                </button>
              </div>
              {borrador.canal === 'correo' && (
                <input
                  id="borrador-asunto"
                  className={p.campo}
                  value={borrador.asunto}
                  onChange={(e) => setBorrador({ ...borrador, asunto: e.target.value })}
                  aria-label="Asunto"
                />
              )}
              <textarea
                id="borrador-texto"
                className={`${p.campo} ${p.area}`}
                value={borrador.texto}
                onChange={(e) => setBorrador({ ...borrador, texto: e.target.value })}
                rows={borrador.canal === 'whatsapp' ? 6 : 11}
                aria-label="Mensaje"
              />
              <p className={p.borradorNota}>Revísalo antes de enviarlo: lo ha escrito la asistente.</p>
              <div className={p.borradorBotones}>
                <button type="button" className={p.botonClaro} onClick={() => copiar(borrador.texto)}>
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  type="button"
                  className={p.botonClaro}
                  onClick={() => contactoBorrador && redactar(contactoBorrador.id, borrador.canal)}
                >
                  Otra versión
                </button>
                {borrador.canal === 'whatsapp' && contactoBorrador?.whatsapp ? (
                  <a
                    className={p.botonDorado}
                    href={enlaceWhatsapp(contactoBorrador.whatsapp, borrador.texto)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => contactoBorrador.estado === 'Nuevo' && marcar(contactoBorrador.id, 'Contactado')}
                  >
                    Abrir en WhatsApp
                  </a>
                ) : contactoBorrador?.correo ? (
                  <a
                    className={p.botonDorado}
                    href={enlaceCorreo(contactoBorrador.correo, borrador.asunto, borrador.texto)}
                    onClick={() => contactoBorrador.estado === 'Nuevo' && marcar(contactoBorrador.id, 'Contactado')}
                  >
                    Abrir en el correo
                  </a>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {aviso && (
        <p className={p.aviso} role="status">
          {aviso}
        </p>
      )}
    </>
  );
}
