'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import b from './buzon.module.css';

/**
 * El buzón hola@sorelacarodivine.com dentro de la plataforma: leer, contestar,
 * escribir y ordenar, como en el Mail del móvil. Lo cuenta `app/api/buzon`.
 */

type Carpeta = 'entrada' | 'enviados' | 'papelera' | 'spam';
type Persona = { nombre: string; correo: string };
type Resumen = {
  uid: number;
  de: Persona;
  para: Persona[];
  asunto: string;
  fecha: string | null;
  leido: boolean;
  respondido: boolean;
  destacado: boolean;
};
type Mensaje = {
  uid: number;
  de: Persona;
  para: Persona[];
  cc: Persona[];
  asunto: string;
  fecha: string | null;
  html: string | null;
  texto: string;
  adjuntos: { indice: number; nombre: string; tipo: string; tamano: number }[];
};
type Borrador = { para: string; asunto: string; texto: string; responde: { carpeta: Carpeta; uid: number } | null };

const CARPETAS: { id: Carpeta; nombre: string }[] = [
  { id: 'entrada', nombre: 'Recibidos' },
  { id: 'enviados', nombre: 'Enviados' },
  { id: 'spam', nombre: 'Spam' },
  { id: 'papelera', nombre: 'Papelera' },
];

function cuando(iso: string | null, largo = false) {
  if (!iso) return '';
  const d = new Date(iso);
  if (largo)
    return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(d);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const quien = (p: Persona) => p.nombre || p.correo || 'Desconocido';
const peso = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const inicial = (p: Persona) => (quien(p)[0] || '·').toUpperCase();

/* El HTML del correo, encerrado: sin scripts, y los enlaces se abren fuera. */
const envolver = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1c1a17;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
const textoAHtml = (t: string) =>
  envolver(
    `<div style="white-space:pre-wrap">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`
  );

export default function Buzon() {
  const [carpeta, setCarpeta] = useState<Carpeta>('entrada');
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [sinLeer, setSinLeer] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [abierto, setAbierto] = useState<Mensaje | null>(null);
  const [cargandoMsg, setCargandoMsg] = useState<number | null>(null);
  const [estado, setEstado] = useState<{ tipo: 'sin-buzon'; direccion: string } | { tipo: 'fallo'; texto: string } | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  // El portal del editor necesita el documento: solo después de montar.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const cargar = useCallback(async (c: Carpeta, p = 0) => {
    setEstado(null);
    try {
      const j = await (await fetch(`/api/buzon?carpeta=${c}&pagina=${p}`)).json();
      if (j.motivo === 'sin-buzon') {
        setEstado({ tipo: 'sin-buzon', direccion: j.direccion });
        setLista([]);
        return;
      }
      if (!j.ok) throw new Error(j.detalle);
      setLista((l) => (p > 0 && l ? [...l, ...j.mensajes] : j.mensajes));
      setHayMas(Boolean(j.hayMas));
      if (c === 'entrada') setSinLeer(j.sinLeer ?? 0);
    } catch (e) {
      setEstado({ tipo: 'fallo', texto: (e as Error).message || 'No se ha podido leer el buzón.' });
      setLista((l) => l ?? []);
    }
  }, []);

  useEffect(() => {
    setLista(null);
    setAbierto(null);
    setPagina(0);
    cargar(carpeta, 0);
  }, [carpeta, cargar]);

  // Mira si ha llegado algo cada dos minutos mientras la pestaña está a la vista.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && pagina === 0) cargar(carpeta, 0);
    }, 120_000);
    return () => clearInterval(t);
  }, [carpeta, pagina, cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function abrir(r: Resumen) {
    setCargandoMsg(r.uid);
    try {
      const j = await (await fetch(`/api/buzon?carpeta=${carpeta}&uid=${r.uid}`)).json();
      if (!j.ok) throw new Error(j.detalle);
      setAbierto(j.mensaje);
      if (!r.leido) {
        setLista((l) => l?.map((x) => (x.uid === r.uid ? { ...x, leido: true } : x)) ?? l);
        if (carpeta === 'entrada') setSinLeer((n) => Math.max(0, n - 1));
      }
    } catch (e) {
      setAviso((e as Error).message || 'No se ha podido abrir.');
    } finally {
      setCargandoMsg(null);
    }
  }

  async function marcarNoLeido(m: Mensaje) {
    await fetch('/api/buzon', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carpeta, uid: m.uid, leido: false }) });
    setLista((l) => l?.map((x) => (x.uid === m.uid ? { ...x, leido: false } : x)) ?? l);
    if (carpeta === 'entrada') setSinLeer((n) => n + 1);
    setAbierto(null);
  }

  async function borrar(m: Mensaje) {
    if (carpeta === 'papelera' && !window.confirm('¿Borrarlo para siempre? Ya está en la papelera.')) return;
    const j = await (await fetch(`/api/buzon?carpeta=${carpeta}&uid=${m.uid}`, { method: 'DELETE' })).json();
    if (j.ok) {
      setLista((l) => l?.filter((x) => x.uid !== m.uid) ?? l);
      setAbierto(null);
      setAviso(carpeta === 'papelera' ? 'Borrado.' : 'Movido a la papelera.');
    } else setAviso(j.detalle || 'No se ha podido borrar.');
  }

  async function enviar() {
    if (!borrador) return;
    setEnviando(true);
    setErrores({});
    try {
      const j = await (
        await fetch('/api/buzon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(borrador) })
      ).json();
      if (!j.ok) {
        setErrores(j.errores ?? { general: j.detalle || 'No se ha podido enviar.' });
        return;
      }
      setAviso(j.copia ? 'Enviado.' : 'Enviado (no se pudo guardar la copia en Enviados).');
      if (borrador.responde) setLista((l) => l?.map((x) => (x.uid === borrador.responde?.uid ? { ...x, respondido: true } : x)) ?? l);
      setBorrador(null);
    } catch {
      setErrores({ general: 'No hay conexión.' });
    } finally {
      setEnviando(false);
    }
  }

  if (estado?.tipo === 'sin-buzon') {
    return (
      <section className={b.configurar}>
        <h3>Conecta tu buzón</h3>
        <p>
          Para ver aquí los correos de <strong>{estado.direccion}</strong> falta un paso, una sola vez:
        </p>
        <ol>
          <li>En Vercel, abre tu proyecto <b>web-plataforma → Settings → Environment Variables</b>.</li>
          <li>
            Pulsa <b>Add</b>. Nombre: <code>BUZON_CLAVE</code>. Valor: la contraseña que pusiste al crear el buzón en Arsys.
            Marca <b>Production</b> y guarda.
          </li>
          <li>
            Ve a <b>Deployments</b>, en el primero pulsa los tres puntos y <b>Redeploy</b>.
          </li>
        </ol>
        <p className={b.nota}>La contraseña se queda solo en Vercel: no la ve nadie ni se guarda en el código.</p>
      </section>
    );
  }

  const filtrados = (lista ?? []).filter((m) => {
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    return [m.asunto, m.de.nombre, m.de.correo, ...m.para.map((p) => p.correo)].some((x) => x.toLowerCase().includes(t));
  });

  return (
    <div className={b.buzon}>
      <div className={b.barra}>
        <nav className={b.carpetas} aria-label="Carpetas">
          {CARPETAS.map((c) => (
            <button key={c.id} type="button" aria-pressed={carpeta === c.id} onClick={() => setCarpeta(c.id)}>
              {c.nombre}
              {c.id === 'entrada' && sinLeer > 0 && <span className={b.contador}>{sinLeer}</span>}
            </button>
          ))}
        </nav>
        <input className={b.buscar} placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar en el buzón" />
        <button type="button" className={b.btnOscuro} onClick={() => { setErrores({}); setBorrador({ para: '', asunto: '', texto: '', responde: null }); }}>
          + Escribir
        </button>
      </div>

      <AnimatePresence>
        {aviso && (
          <motion.p className={b.aviso} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {aviso}
          </motion.p>
        )}
      </AnimatePresence>
      {estado?.tipo === 'fallo' && (
        <p className={b.fallo} role="alert">
          {estado.texto}{' '}
          <button type="button" onClick={() => cargar(carpeta, 0)}>
            Reintentar
          </button>
        </p>
      )}

      <div className={b.panel} data-abierto={abierto ? '' : undefined}>
        <ul className={b.lista} aria-label="Correos">
          {lista === null &&
            Array.from({ length: 6 }, (_, i) => (
              <li key={i} className={b.esqueleto} />
            ))}
          {lista !== null && filtrados.length === 0 && !estado && (
            <li className={b.vacio}>{busca ? 'Nada con esa búsqueda.' : 'No hay correos aquí.'}</li>
          )}
          {filtrados.map((m) => {
            const otro = carpeta === 'enviados' ? m.para[0] ?? m.de : m.de;
            return (
              <li key={m.uid}>
                <button
                  type="button"
                  className={b.fila}
                  data-leido={m.leido ? '' : undefined}
                  data-activo={abierto?.uid === m.uid ? '' : undefined}
                  onClick={() => abrir(m)}
                  disabled={cargandoMsg === m.uid}
                >
                  <span className={b.avatar} aria-hidden="true">
                    {inicial(otro)}
                  </span>
                  <span className={b.filaTexto}>
                    <span className={b.filaArriba}>
                      <strong>{carpeta === 'enviados' ? `Para: ${quien(otro)}` : quien(otro)}</strong>
                      <time>{cuando(m.fecha)}</time>
                    </span>
                    <span className={b.filaAsunto}>
                      {m.respondido && <span className={b.respondido} title="Contestado">↩</span>}
                      {m.asunto}
                    </span>
                  </span>
                  {!m.leido && <span className={b.punto} aria-label="Sin leer" />}
                </button>
              </li>
            );
          })}
          {hayMas && !busca && (
            <li>
              <button type="button" className={b.masCorreos} onClick={() => { const p = pagina + 1; setPagina(p); cargar(carpeta, p); }}>
                Ver más antiguos
              </button>
            </li>
          )}
        </ul>

        <section className={b.lectura} aria-live="polite">
          {abierto ? (
            <>
              <header className={b.lecturaCabeza}>
                <button type="button" className={b.volver} onClick={() => setAbierto(null)}>
                  ← Volver
                </button>
                <h3>{abierto.asunto}</h3>
                <div className={b.remite}>
                  <span className={b.avatarGrande} aria-hidden="true">
                    {inicial(abierto.de)}
                  </span>
                  <div>
                    <strong>{quien(abierto.de)}</strong>
                    <span>{abierto.de.correo}</span>
                    <span>
                      Para: {abierto.para.map((p) => p.correo).join(', ')}
                      {abierto.cc.length > 0 && ` · Cc: ${abierto.cc.map((p) => p.correo).join(', ')}`}
                    </span>
                  </div>
                  <time>{cuando(abierto.fecha, true)}</time>
                </div>
                <div className={b.acciones}>
                  {carpeta !== 'enviados' && (
                    <button type="button" className={b.btnOscuro} onClick={() => { setErrores({}); setBorrador({ para: '', asunto: '', texto: '', responde: { carpeta, uid: abierto.uid } }); }}>
                      Responder
                    </button>
                  )}
                  <button type="button" className={b.btnLinea} onClick={() => marcarNoLeido(abierto)}>
                    Marcar no leído
                  </button>
                  <button type="button" className={b.btnPeligro} onClick={() => borrar(abierto)}>
                    {carpeta === 'papelera' ? 'Borrar para siempre' : 'Borrar'}
                  </button>
                </div>
              </header>
              {abierto.adjuntos.length > 0 && (
                <div className={b.adjuntos}>
                  {abierto.adjuntos.map((a) => (
                    <a key={a.indice} href={`/api/buzon?carpeta=${carpeta}&uid=${abierto.uid}&adjunto=${a.indice}`} className={b.adjunto}>
                      📎 {a.nombre} <small>{peso(a.tamano)}</small>
                    </a>
                  ))}
                </div>
              )}
              <iframe
                className={b.cuerpo}
                title="Contenido del correo"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                srcDoc={abierto.html ? envolver(abierto.html) : textoAHtml(abierto.texto)}
              />
            </>
          ) : (
            <div className={b.nada}>
              <span aria-hidden="true">✉</span>
              <p>Elige un correo para leerlo.</p>
            </div>
          )}
        </section>
      </div>

      {/* ---------- Escribir / responder ---------- */}
      {montado && createPortal(
        <AnimatePresence>
          {borrador && (
            <motion.div className={b.velo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                className={b.redactar}
                role="dialog"
                aria-modal="true"
                aria-label={borrador.responde ? 'Responder' : 'Escribir un correo'}
                initial={{ y: 30, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              >
                <header className={b.redactarCabeza}>
                  <strong>{borrador.responde ? `Responder a ${abierto ? quien(abierto.de) : ''}` : 'Escribir un correo'}</strong>
                  <button type="button" className={b.cerrar} onClick={() => setBorrador(null)} aria-label="Cerrar">
                    ×
                  </button>
                </header>
                {!borrador.responde && (
                  <>
                    <label className={b.campo}>
                      <span>Para</span>
                      <input type="email" value={borrador.para} onChange={(e) => setBorrador({ ...borrador, para: e.target.value })} placeholder="correo@ejemplo.com" />
                    </label>
                    {errores.para && <em className={b.error}>{errores.para}</em>}
                    <label className={b.campo}>
                      <span>Asunto</span>
                      <input value={borrador.asunto} onChange={(e) => setBorrador({ ...borrador, asunto: e.target.value })} />
                    </label>
                    {errores.asunto && <em className={b.error}>{errores.asunto}</em>}
                  </>
                )}
                <textarea
                  className={b.texto}
                  value={borrador.texto}
                  onChange={(e) => setBorrador({ ...borrador, texto: e.target.value })}
                  placeholder={borrador.responde ? 'Escribe tu respuesta…' : 'Escribe tu correo…'}
                  autoFocus
                />
                <p className={b.nota}>
                  Sale desde <b>hola@sorelacarodivine.com</b> con tu firma{borrador.responde ? ' y el correo original citado debajo' : ''}.
                </p>
                {errores.texto && <em className={b.error}>{errores.texto}</em>}
                {errores.general && <em className={b.error}>{errores.general}</em>}
                <footer className={b.redactarPie}>
                  <button type="button" className={b.btnLinea} onClick={() => setBorrador(null)}>
                    Cancelar
                  </button>
                  <button type="button" className={b.btnOscuro} onClick={enviar} disabled={enviando}>
                    {enviando ? 'Enviando…' : 'Enviar'}
                  </button>
                </footer>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
