'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AUDIENCIAS, plantillaCampana, type Audiencia, type Campana, type EstadoCampana } from '@/lib/plantillas-campana';
import k from './programados.module.css';

/**
 * Avisos y correos programados: la cuenta atrás del lanzamiento, ya escrita, y
 * los avisos que escribe Sorela. Todo se puede leer, cambiar, pausar o mandar
 * ya. Lo cuenta `app/api/campanas`.
 */

type Borrador = {
  id: string | null;
  etiqueta: string;
  asunto: string;
  cuerpo: string;
  botonTexto: string;
  botonEnlace: string;
  audiencia: Audiencia;
  fecha: string;
  cuando: 'borrador' | 'programada';
};

const ESTADO: Record<EstadoCampana, string> = {
  borrador: 'Borrador',
  programada: 'Programado',
  enviada: 'Enviado',
  pausada: 'En pausa',
  caducada: 'No salió a tiempo',
};

function dia(f: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return '';
  const [a, m, d] = f.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(a, m - 1, d));
}

const vacio = (hoy: string): Borrador => ({
  id: null,
  etiqueta: '',
  asunto: '',
  cuerpo: '',
  botonTexto: '',
  botonEnlace: '',
  audiencia: 'espera',
  fecha: hoy,
  cuando: 'programada',
});

const deCampana = (c: Campana): Borrador => ({
  id: c.id,
  etiqueta: c.etiqueta,
  asunto: c.asunto,
  cuerpo: c.cuerpo,
  botonTexto: c.boton?.texto ?? '',
  botonEnlace: c.boton?.enlace ?? '',
  audiencia: c.audiencia,
  fecha: c.fecha,
  cuando: c.estado === 'borrador' ? 'borrador' : 'programada',
});

const aCuerpo = (b: Borrador) => ({
  etiqueta: b.etiqueta,
  asunto: b.asunto,
  cuerpo: b.cuerpo,
  boton: b.botonTexto && b.botonEnlace ? { texto: b.botonTexto, enlace: b.botonEnlace } : null,
  audiencia: b.audiencia,
  fecha: b.fecha,
  estado: b.cuando,
});

export default function Programados({ alCambiar }: { alCambiar?: () => void }) {
  const [lista, setLista] = useState<Campana[] | null>(null);
  const [grupos, setGrupos] = useState<Record<Audiencia, number> | null>(null);
  const [hoy, setHoy] = useState('');
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [soloLectura, setSoloLectura] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/campanas')).json();
      if (!j.ok) throw new Error();
      setLista(j.campanas);
      setGrupos(j.grupos);
      setHoy(j.hoy);
    } catch {
      setAviso('No he podido cargar los avisos programados.');
      setLista([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 7000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function pedir(metodo: string, cuerpo: unknown, url = '/api/campanas') {
    const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return r.json().catch(() => ({ ok: false }));
  }

  async function guardar(): Promise<string | null> {
    if (!editando) return null;
    setOcupado('guardar');
    setErrores({});
    try {
      const j = editando.id
        ? await pedir('PATCH', { id: editando.id, ...aCuerpo(editando) })
        : await pedir('POST', { campana: aCuerpo(editando) });
      if (!j.ok) {
        setErrores(j.errores ?? { general: j.motivo === 'ya-enviada' ? 'Este ya se envió: no se puede cambiar.' : 'No se ha podido guardar.' });
        return null;
      }
      await cargar();
      return j.campana.id as string;
    } finally {
      setOcupado(null);
    }
  }

  async function guardarYCerrar() {
    if (!editando) return;
    const id = await guardar();
    if (id) {
      setAviso(editando.cuando === 'borrador' ? 'Guardado como borrador.' : `Programado para el ${dia(editando.fecha)}.`);
      setEditando(null);
    }
  }

  async function enviarYa(id: string, asunto: string, audiencia: Audiencia) {
    const n = grupos?.[audiencia] ?? 0;
    if (!window.confirm(`¿Mandar ahora «${asunto}» a ${n} ${n === 1 ? 'persona' : 'personas'} (${AUDIENCIAS[audiencia]})?`)) return;
    setOcupado(`enviar:${id}`);
    try {
      const j = await pedir('POST', { accion: 'enviar', id });
      setAviso(
        j.ok
          ? `Enviado a ${j.enviados}.${j.fallidos ? ` ${j.fallidos} no salieron: míralos en el historial.` : ''}${j.omitidos ? ` ${j.omitidos} no hacía falta (ya lo tenían o se dieron de baja).` : ''}`
          : 'No se ha podido enviar.'
      );
      await cargar();
      alCambiar?.();
    } finally {
      setOcupado(null);
    }
  }

  async function guardarYEnviar() {
    if (!editando) return;
    const id = await guardar();
    if (id) {
      setEditando(null);
      await enviarYa(id, editando.asunto, editando.audiencia);
    }
  }

  async function prueba() {
    if (!editando) return;
    setOcupado('prueba');
    setErrores({});
    try {
      const j = await pedir('POST', { accion: 'prueba', campana: aCuerpo(editando) });
      if (j.errores) setErrores(j.errores);
      setAviso(j.ok ? `Te he mandado la prueba a ${j.para}.` : `La prueba no ha salido${j.detalle ? `: ${j.detalle}` : ''}.`);
      alCambiar?.();
    } finally {
      setOcupado(null);
    }
  }

  async function cambiarEstado(c: Campana, estado: 'programada' | 'pausada') {
    setLista((l) => l?.map((x) => (x.id === c.id ? { ...x, estado } : x)) ?? l);
    const j = await pedir('PATCH', { id: c.id, estado });
    if (!j.ok) {
      setAviso('No se ha podido cambiar.');
      await cargar();
    }
  }

  async function borrar(c: Campana) {
    if (!window.confirm(`¿Borrar «${c.asunto}»? No se ha enviado a nadie.`)) return;
    const j = await pedir('DELETE', null, `/api/campanas?id=${c.id}`);
    if (j.ok) setLista((l) => l?.filter((x) => x.id !== c.id) ?? l);
  }

  async function pausarSerie(pausar: boolean) {
    const serie = (lista ?? []).filter((c) => c.serie && (pausar ? c.estado === 'programada' : c.estado === 'pausada'));
    for (const c of serie) await pedir('PATCH', { id: c.id, estado: pausar ? 'pausada' : 'programada' });
    await cargar();
    setAviso(pausar ? 'Cuenta atrás en pausa: no saldrá nada hasta que la reanudes.' : 'Cuenta atrás reanudada.');
  }

  const previa = useMemo(() => {
    if (!editando) return '';
    return plantillaCampana(
      {
        etiqueta: editando.etiqueta,
        asunto: editando.asunto || '(sin asunto)',
        cuerpo: editando.cuerpo || 'Aquí va tu texto.',
        boton: editando.botonTexto ? { texto: editando.botonTexto, enlace: editando.botonEnlace || 'https://' } : null,
      },
      'María',
      '#'
    ).html;
  }, [editando]);

  if (!lista) return <p className={k.cargando}>Cargando los avisos…</p>;

  const serie = lista.filter((c) => c.serie);
  const propios = lista.filter((c) => !c.serie).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const seriePausada = serie.some((c) => c.estado === 'pausada');
  const serieActiva = serie.some((c) => c.estado === 'programada');

  const fila = (c: Campana) => {
    const pasada = c.estado === 'enviada' || c.estado === 'caducada';
    return (
      <li key={c.id} className={k.fila} data-estado={c.estado} data-hoy={c.fecha === hoy ? '' : undefined}>
        <span className={k.fecha}>
          <b>{dia(c.fecha).split(' ')[1] ?? ''}</b>
          <small>{dia(c.fecha).replace(',', '').split(' ').filter((_, i) => i !== 1).join(' · ')}</small>
        </span>
        <span className={k.texto}>
          {c.etiqueta && <span className={k.etiqueta}>{c.etiqueta}</span>}
          <button type="button" className={k.asunto} onClick={() => { setSoloLectura(pasada); setErrores({}); setEditando(deCampana(c)); }}>
            {c.asunto}
          </button>
          <span className={k.meta}>
            {AUDIENCIAS[c.audiencia]}
            {grupos && !pasada && ` · ${grupos[c.audiencia]} personas`}
            {c.resultado && ` · enviado a ${c.resultado.enviados}${c.resultado.fallidos ? `, ${c.resultado.fallidos} fallaron` : ''}`}
          </span>
        </span>
        <span className={k.chip} data-estado={c.estado}>{ESTADO[c.estado]}</span>
        <span className={k.acciones}>
          {!pasada && (
            <button type="button" className={k.enlace} onClick={() => { setSoloLectura(false); setErrores({}); setEditando(deCampana(c)); }}>
              Editar
            </button>
          )}
          {c.estado === 'programada' && (
            <button type="button" className={k.enlace} onClick={() => cambiarEstado(c, 'pausada')}>
              Pausar
            </button>
          )}
          {c.estado === 'pausada' && (
            <button type="button" className={k.enlace} onClick={() => cambiarEstado(c, 'programada')}>
              Reanudar
            </button>
          )}
          {!pasada && (
            <button type="button" className={k.enlace} disabled={ocupado === `enviar:${c.id}`} onClick={() => enviarYa(c.id, c.asunto, c.audiencia)}>
              {ocupado === `enviar:${c.id}` ? 'Enviando…' : 'Enviar ya'}
            </button>
          )}
          {!c.serie && c.estado !== 'enviada' && (
            <button type="button" className={k.enlacePeligro} onClick={() => borrar(c)}>
              Borrar
            </button>
          )}
        </span>
      </li>
    );
  };

  const campo = (nombre: keyof Borrador, v: string) => setEditando((e) => (e ? { ...e, [nombre]: v } : e));

  return (
    <section className={k.tarjeta}>
      <header className={k.cabecera}>
        <div>
          <h3>Avisos y correos programados</h3>
          <p>Escribe un aviso para un grupo y elige cuándo sale. Salen a primera hora del día que elijas.</p>
        </div>
        <button
          type="button"
          className={k.btn}
          onClick={() => {
            setSoloLectura(false);
            setErrores({});
            setEditando(vacio(hoy));
          }}
        >
          + Escribir un aviso
        </button>
      </header>

      <AnimatePresence>
        {aviso && (
          <motion.p className={k.aviso} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {aviso}
          </motion.p>
        )}
      </AnimatePresence>

      {serie.length > 0 && (
        <div className={k.grupo}>
          <div className={k.grupoCabeza}>
            <div>
              <h4>Cuenta atrás del lanzamiento</h4>
              <p>
                A la lista de espera: uno por semana y, la última semana, uno cada día hasta la apertura. Cada uno trae
                una idea útil para su trabajo. Ábrelos para leerlos o cambiarlos.
              </p>
            </div>
            {serieActiva ? (
              <button type="button" className={k.btnLinea} onClick={() => pausarSerie(true)}>
                Pausar toda la cuenta atrás
              </button>
            ) : seriePausada ? (
              <button type="button" className={k.btnLinea} onClick={() => pausarSerie(false)}>
                Reanudar la cuenta atrás
              </button>
            ) : null}
          </div>
          <ul className={k.lista}>{serie.map(fila)}</ul>
        </div>
      )}

      <div className={k.grupo}>
        <div className={k.grupoCabeza}>
          <div>
            <h4>Tus avisos</h4>
            <p>Los que escribes tú: una novedad, una clase en vivo, un cambio de fecha…</p>
          </div>
        </div>
        {propios.length ? (
          <ul className={k.lista}>{propios.map(fila)}</ul>
        ) : (
          <p className={k.vacio}>Todavía no has escrito ninguno. Pulsa «Escribir un aviso».</p>
        )}
      </div>

      {/* ---------- Editor ---------- */}
      {createPortal(
        <AnimatePresence>
        {editando && (
          <motion.div className={k.velo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className={k.editor}
              role="dialog"
              aria-modal="true"
              aria-label={editando.id ? 'Editar aviso' : 'Escribir un aviso'}
              initial={{ y: 24, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <header className={k.editorCabeza}>
                <strong>{soloLectura ? 'Correo enviado' : editando.id ? 'Editar aviso' : 'Escribir un aviso'}</strong>
                <button type="button" className={k.cerrar} onClick={() => setEditando(null)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                </button>
              </header>

              <div className={k.editorCuerpo}>
                <fieldset className={k.campos} disabled={soloLectura}>
                  <label className={k.campo}>
                    <span>Asunto</span>
                    <input value={editando.asunto} onChange={(e) => campo('asunto', e.target.value)} placeholder="Lo que se lee en la bandeja de entrada" maxLength={160} />
                    {errores.asunto && <em>{errores.asunto}</em>}
                  </label>
                  <label className={k.campo}>
                    <span>Línea pequeña de arriba <small>(opcional)</small></span>
                    <input value={editando.etiqueta} onChange={(e) => campo('etiqueta', e.target.value)} placeholder="Por ejemplo: Novedad · Clase en vivo" maxLength={60} />
                  </label>
                  <label className={k.campo}>
                    <span>Texto</span>
                    <textarea value={editando.cuerpo} onChange={(e) => campo('cuerpo', e.target.value)} rows={12} placeholder="Escribe como hablas. El saludo («Hola María,») y tu firma se ponen solos." />
                    <small className={k.ayuda}>
                      Línea en blanco = párrafo nuevo · <b>**así**</b> = negrita · empieza una línea con «- » para una lista · <b>{'{nombre}'}</b> = su nombre
                    </small>
                    {errores.cuerpo && <em>{errores.cuerpo}</em>}
                  </label>
                  <div className={k.dosCampos}>
                    <label className={k.campo}>
                      <span>Botón <small>(opcional)</small></span>
                      <input value={editando.botonTexto} onChange={(e) => campo('botonTexto', e.target.value)} placeholder="Texto del botón" maxLength={60} />
                    </label>
                    <label className={k.campo}>
                      <span>Enlace del botón</span>
                      <input value={editando.botonEnlace} onChange={(e) => campo('botonEnlace', e.target.value)} placeholder="https://…" />
                    </label>
                  </div>
                  {errores.boton && <em className={k.error}>{errores.boton}</em>}
                  <label className={k.campo}>
                    <span>A quién</span>
                    <select value={editando.audiencia} onChange={(e) => campo('audiencia', e.target.value)}>
                      {(Object.keys(AUDIENCIAS) as Audiencia[]).map((a) => (
                        <option key={a} value={a}>
                          {AUDIENCIAS[a]}
                          {grupos ? ` (${grupos[a]})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={k.dosCampos}>
                    <label className={k.campo}>
                      <span>Qué hago con él</span>
                      <select value={editando.cuando} onChange={(e) => campo('cuando', e.target.value)}>
                        <option value="programada">Programarlo para un día</option>
                        <option value="borrador">Guardarlo como borrador</option>
                      </select>
                    </label>
                    {editando.cuando === 'programada' && (
                      <label className={k.campo}>
                        <span>Día</span>
                        <input type="date" value={editando.fecha} min={hoy} onChange={(e) => campo('fecha', e.target.value)} />
                        {errores.fecha && <em>{errores.fecha}</em>}
                      </label>
                    )}
                  </div>
                  {errores.general && <em className={k.error}>{errores.general}</em>}
                </fieldset>

                <div className={k.previa}>
                  <span className={k.previaRotulo}>Así le llega</span>
                  <iframe title="Vista previa" srcDoc={previa} sandbox="" className={k.marco} />
                </div>
              </div>

              {!soloLectura && (
                <footer className={k.editorPie}>
                  <button type="button" className={k.btnLinea} onClick={prueba} disabled={ocupado === 'prueba'}>
                    {ocupado === 'prueba' ? 'Mandando…' : 'Mandarme una prueba'}
                  </button>
                  <span className={k.hueco} />
                  <button type="button" className={k.btnLinea} onClick={guardarYEnviar} disabled={!!ocupado}>
                    Enviar ahora
                  </button>
                  <button type="button" className={k.btn} onClick={guardarYCerrar} disabled={!!ocupado}>
                    {ocupado === 'guardar' ? 'Guardando…' : editando.cuando === 'borrador' ? 'Guardar borrador' : 'Programar'}
                  </button>
                </footer>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
        document.body
      )}
    </section>
  );
}
