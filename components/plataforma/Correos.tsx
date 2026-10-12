'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ETIQUETA_CORREO, type IdAutomatizacion } from '@/lib/automatizaciones';
import Programados from './Programados';
import k from './correos.module.css';

/**
 * Los correos automáticos, en una pantalla: por dónde salen, cuáles están
 * encendidos, qué va a salir y cuándo, y qué ha salido ya (y a quién no le ha
 * llegado). Todo lo que se lee aquí lo cuenta `app/api/correos`.
 */

type Auto = {
  id: IdAutomatizacion;
  nombre: string;
  cuando: string;
  quien: string;
  porDefecto: boolean;
  fijo?: boolean;
};

type Fila = {
  id: string;
  para: string;
  tipo: string;
  asunto: string;
  estado: 'enviado' | 'fallido' | 'omitido';
  via: string | null;
  detalle: string | null;
  cuando: string | null;
};

type Datos = {
  via: 'resend' | 'smtp' | 'apps-script' | null;
  correoSorela: string | null;
  activas: Record<IdAutomatizacion, boolean>;
  automatizaciones: Auto[];
  listaEspera: number;
  historial: Fila[];
};

const VIA: Record<string, { titulo: string; texto: string }> = {
  'apps-script': {
    titulo: 'Salen desde tu Gmail',
    texto: 'A través de tu Apps Script. Gmail deja unos 100 correos al día: de sobra para el día a día, justo para un aviso a toda la lista.',
  },
  resend: {
    titulo: 'Salen desde tu dominio',
    texto: 'Con Resend, desde la dirección de sorelacarodivine.com. Llegan mejor a la bandeja de entrada y no dependen del límite de Gmail.',
  },
  smtp: {
    titulo: 'Salen por SMTP',
    texto: 'Con la cuenta de correo configurada en el servidor.',
  },
};

function hace(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'ahora mismo';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const ESTADO: Record<Fila['estado'], string> = { enviado: 'Enviado', fallido: 'No salió', omitido: 'No hacía falta' };

export default function Correos() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [vista, setVista] = useState<{ id: IdAutomatizacion; asunto: string; html: string } | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'fallido'>('todos');

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/correos')).json();
      if (!j.ok) throw new Error();
      setDatos(j);
      setFallo(null);
    } catch {
      setFallo('No he podido cargar los correos.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function cambiar(id: IdAutomatizacion, activa: boolean) {
    setDatos((d) => (d ? { ...d, activas: { ...d.activas, [id]: activa } } : d));
    try {
      const j = await (
        await fetch('/api/correos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, activa }) })
      ).json();
      if (!j.ok) throw new Error();
    } catch {
      setDatos((d) => (d ? { ...d, activas: { ...d.activas, [id]: !activa } } : d));
      setFallo('No se ha podido guardar. Vuelve a intentarlo.');
    }
  }

  async function ver(id: IdAutomatizacion) {
    setOcupado(`ver:${id}`);
    try {
      const j = await (await fetch(`/api/correos?ver=${id}`)).json();
      if (j.ok) setVista({ id, asunto: j.asunto, html: j.html });
    } finally {
      setOcupado(null);
    }
  }

  async function probar(id: IdAutomatizacion) {
    setOcupado(`probar:${id}`);
    try {
      const j = await (
        await fetch('/api/correos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'prueba', id }) })
      ).json();
      setAviso(j.ok ? `Te he mandado la prueba a ${j.para}.` : `La prueba no ha salido: ${j.detalle || 'revisa cómo se envían'}.`);
      await cargar();
    } catch {
      setAviso('La prueba no ha salido: no hay conexión.');
    } finally {
      setOcupado(null);
    }
  }

  async function hacerHoy() {
    setOcupado('hoy');
    try {
      const j = await (
        await fetch('/api/correos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'ejecutar' }) })
      ).json();
      const n = (j.hechas ?? []).reduce((s: number, h: { enviados: number }) => s + h.enviados, 0);
      setAviso(n ? `Hecho: ${n} ${n === 1 ? 'correo enviado' : 'correos enviados'}.` : 'Hecho. Hoy no tocaba mandar nada.');
      await cargar();
    } catch {
      setAviso('No se ha podido. Vuelve a intentarlo.');
    } finally {
      setOcupado(null);
    }
  }

  const cifras = useMemo(() => {
    const h = datos?.historial ?? [];
    const mes = Date.now() - 30 * 86_400_000;
    const recientes = h.filter((f) => f.cuando && new Date(f.cuando).getTime() >= mes);
    return {
      enviados: recientes.filter((f) => f.estado === 'enviado').length,
      fallidos: recientes.filter((f) => f.estado === 'fallido').length,
    };
  }, [datos]);

  if (!datos) {
    return <p className={k.cargando}>{fallo ?? 'Cargando los correos…'}</p>;
  }

  const via = datos.via ? VIA[datos.via] : null;
  const filas = datos.historial.filter((f) => filtro === 'todos' || f.estado === 'fallido');

  return (
    <div className={k.correos}>
      <AnimatePresence>
        {aviso && (
          <motion.p className={k.aviso} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {aviso}
          </motion.p>
        )}
      </AnimatePresence>
      {fallo && <p className={k.fallo} role="alert">{fallo}</p>}

      {/* ---------- Cómo salen ---------- */}
      <section className={k.estado} data-bien={via ? '' : undefined}>
        <span className={k.estadoPunto} aria-hidden="true" />
        <div className={k.estadoTexto}>
          <strong>{via ? via.titulo : 'Ahora mismo no sale ningún correo automático'}</strong>
          <span>
            {via
              ? via.texto
              : 'Falta conectar una vía de envío en Vercel. Hasta entonces, cada correo queda apuntado aquí como «No salió».'}
          </span>
        </div>
        <button type="button" className={k.btn} onClick={hacerHoy} disabled={ocupado === 'hoy'}>
          {ocupado === 'hoy' ? 'Haciendo…' : 'Hacer ahora lo de hoy'}
        </button>
      </section>

      <div className={k.cifras}>
        <div className={k.cifra}>
          <span className={k.cifraEtiqueta}>Enviados</span>
          <span className={k.cifraValor}>{cifras.enviados}</span>
          <span className={k.cifraNota}>últimos 30 días</span>
        </div>
        <div className={k.cifra} data-mal={cifras.fallidos ? '' : undefined}>
          <span className={k.cifraEtiqueta}>No salieron</span>
          <span className={k.cifraValor}>{cifras.fallidos}</span>
          <span className={k.cifraNota}>{cifras.fallidos ? 'míralos en el historial' : 'todo en orden'}</span>
        </div>
        <div className={k.cifra}>
          <span className={k.cifraEtiqueta}>Lista de espera</span>
          <span className={k.cifraValor}>{datos.listaEspera}</span>
          <span className={k.cifraNota}>recibirán los avisos de apertura</span>
        </div>
      </div>

      <Programados alCambiar={cargar} />

      {/* ---------- Automatizaciones ---------- */}
      <section className={k.tarjeta}>
        <header className={k.cabecera}>
          <h3>Lo que sale solo, cuando pasa algo</h3>
          <p>Enciende o apaga cada correo. Antes de encender uno, míralo con «Ver correo» o mándate una prueba.</p>
        </header>
        <ul className={k.autos}>
          {datos.automatizaciones.map((a) => {
            const activa = datos.activas[a.id];
            return (
              <li key={a.id} className={k.auto} data-activa={activa ? '' : undefined}>
                <div className={k.autoTexto}>
                  <span className={k.autoNombre}>{a.nombre}</span>
                  <span className={k.autoCuando}>
                    <b>Cuándo:</b> {a.cuando}
                  </span>
                  <span className={k.autoCuando}>
                    <b>A quién:</b> {a.quien}
                  </span>
                  {a.id !== 'acuerdo' && <span className={k.autoBotones}>
                    <button type="button" className={k.enlace} onClick={() => ver(a.id)} disabled={ocupado === `ver:${a.id}`}>
                      Ver correo
                    </button>
                    <button type="button" className={k.enlace} onClick={() => probar(a.id)} disabled={ocupado === `probar:${a.id}`}>
                      {ocupado === `probar:${a.id}` ? 'Mandando…' : 'Mandarme una prueba'}
                    </button>
                  </span>}
                </div>
                {a.fijo ? (
                  <span className={k.fijo}>Siempre activo</span>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={activa}
                    aria-label={`${activa ? 'Apagar' : 'Encender'} «${a.nombre}»`}
                    className={k.interruptor}
                    onClick={() => cambiar(a.id, !activa)}
                  >
                    <motion.span layout className={k.bola} transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- Historial ---------- */}
      <section className={k.tarjeta}>
        <header className={k.cabecera}>
          <h3>Lo que ha salido</h3>
          <div className={k.filtro} role="group" aria-label="Filtrar">
            <button type="button" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>
              Todos
            </button>
            <button type="button" aria-pressed={filtro === 'fallido'} onClick={() => setFiltro('fallido')}>
              Solo los que no salieron
            </button>
          </div>
        </header>
        {filas.length === 0 ? (
          <p className={k.vacio}>
            {filtro === 'fallido' ? 'Ninguno ha fallado.' : 'Todavía no ha salido ningún correo desde que existe este historial.'}
          </p>
        ) : (
          <ul className={k.historial}>
            {filas.map((f) => (
              <li key={f.id} className={k.fila}>
                <span className={k.chip} data-estado={f.estado}>
                  {ESTADO[f.estado]}
                </span>
                <span className={k.filaTexto}>
                  <span className={k.filaQue}>{ETIQUETA_CORREO[f.tipo] ?? f.tipo}</span>
                  <span className={k.filaPara}>{f.para}</span>
                  {f.detalle && f.estado !== 'enviado' && <span className={k.filaDetalle}>{f.detalle}</span>}
                </span>
                <span className={k.filaCuando}>{hace(f.cuando)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Vista previa ---------- */}
      {createPortal(
        <AnimatePresence>
        {vista && (
          <motion.div className={k.velo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVista(null)}>
            <motion.div
              className={k.previa}
              role="dialog"
              aria-modal="true"
              aria-label={`Vista previa: ${vista.asunto}`}
              initial={{ y: 24, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className={k.previaCabeza}>
                <span>
                  <small>Asunto</small>
                  <strong>{vista.asunto}</strong>
                </span>
                <button type="button" className={k.cerrar} onClick={() => setVista(null)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                </button>
              </header>
              <iframe className={k.marco} title="Vista previa del correo" srcDoc={vista.html} sandbox="" />
              {vista.id === 'bienvenida' && datos.via !== 'resend' && (
                <p className={k.previaNota}>
                  Este lo escribe tu Apps Script y cambia un poco según de dónde venga la persona: esto es la versión de
                  reserva.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
