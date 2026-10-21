'use client';

import { useEffect, useState } from 'react';
import m from './metricas.module.css';
import c2 from './campana-meta.module.css';

/**
 * La campaña de Meta de la masterclass, arriba del todo en Métricas: cuánto se
 * ha gastado, cuánta gente se ha apuntado desde los anuncios, cuánto cuesta
 * cada una y qué anuncio funciona. Lee /api/metricas/campana.
 *
 * Se enseña mientras dura la campaña, aunque aún no haya gastado nada.
 *
 * Lo que sale de Meta (gasto, alcance, clics, registros que cuenta Meta) va en
 * azul, con la etiqueta «Meta»; lo que sale de la web (registros reales) va en
 * el oro de siempre. Así se ve de un vistazo qué número es de quién.
 *
 * Se refresca sola cada 5 minutos mientras la pantalla está abierta.
 */

const CADA = 5 * 60_000;

type Fila = { nombre: string; gasto: number; impresiones: number; clics: number; leadsMeta: number; registros?: number };
type Resumen = {
  hayMeta: boolean;
  gasto: number;
  alcance: number;
  clics: number;
  registros: number;
  registrosHoy: number;
  registrosAyer: number;
  coste: number | null;
  ctr: number | null;
  anuncios: (Fila & { registros: number })[];
  diasQuedan: number;
  ideas: string[];
  grupo: Grupo | null;
  error?: string;
};

type Grupo = {
  registradas: number;
  medidas: number;
  pulsaron: number;
  clics: number;
  clicsPorOrigen: Record<'web' | 'correo' | 'recordatorio' | 'plataforma', number>;
  sinPulsar: number;
  recordadas: number;
  enGrupo: number | null;
  enGrupoCuando: string | null;
};

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');

const eur = (v: number) => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const num = (v: number) => v.toLocaleString('es-ES');

export default function CampanaMeta() {
  const [r, setR] = useState<Resumen | null>(null);

  useEffect(() => {
    let vivo = true;
    const leer = () =>
      fetch('/api/metricas/campana', { cache: 'no-store' })
        .then((x) => (x.ok ? x.json() : null))
        .then((j) => vivo && j && setR(j))
        .catch(() => null);
    leer();
    const reloj = setInterval(() => {
      if (document.visibilityState === 'visible') leer();
    }, CADA);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, []);

  // Se enseña hasta que termina la campaña (diasQuedan llega a 0 el 6 de noviembre).
  if (!r || (r.diasQuedan === 0 && r.gasto === 0 && r.registros === 0)) return null;

  const cifras = [
    { label: 'Gastado', meta: true, valor: eur(r.gasto), nota: r.hayMeta ? `${num(r.alcance)} personas alcanzadas` : 'falta conectar Meta' },
    { label: 'Registros', meta: false, valor: num(r.registros), nota: `en la web · hoy ${r.registrosHoy} · ayer ${r.registrosAyer}` },
    { label: 'Por registro', meta: false, valor: r.coste !== null ? eur(r.coste) : '—', nota: 'gasto ÷ registros reales' },
    { label: 'Clics', meta: true, valor: num(r.clics), nota: r.ctr !== null ? `${r.ctr.toFixed(2).replace('.', ',')} % de quien lo ve` : '' },
  ];
  const anuncios = [...r.anuncios].sort((a, b) => b.registros - a.registros || b.gasto - a.gasto);

  return (
    <section className={m.tarjeta}>
      <header className={m.cabecera}>
        <h3>Campaña de la masterclass</h3>
        <span className={m.nota}>
          <em className={c2.chip}>Meta</em> en azul · <span className={c2.web}>web</span> en oro · quedan {r.diasQuedan} días
        </span>
      </header>

      <div className={m.cifras}>
        {cifras.map((c) => (
          <article key={c.label} className={`${m.cifra} ${c.meta ? c2.meta : ''}`}>
            <span className={m.cifraEtiqueta}>
              {c.label} {c.meta && <em className={c2.chip}>Meta</em>}
            </span>
            <strong className={m.cifraValor}>{c.valor}</strong>
            <span className={m.cifraNota}>{c.nota}</span>
          </article>
        ))}
      </div>

      {anuncios.length > 0 && (
        <ul className={m.barras}>
          {anuncios.map((a) => {
            const max = Math.max(1, ...anuncios.map((x) => x.registros));
            return (
              <li key={a.nombre}>
                <span className={m.barraEtiqueta}>{a.nombre}</span>
                <span className={m.barraValor}>
                  {a.registros} <em className={c2.azul}>· {eur(a.gasto)} en Meta{a.registros ? ` · ${eur(a.gasto / a.registros)} c/u` : ''}</em>
                </span>
                <span className={m.barraPista}>
                  <span style={{ width: `${(a.registros / max) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <p className={m.subtitulo}>Qué haría hoy</p>
        <ul className={m.nota} style={{ paddingLeft: 18, marginTop: 8 }}>
          {r.ideas.map((i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {i}
            </li>
          ))}
        </ul>
        {r.error && <p className={`${m.nota} ${c2.aviso}`}>No se ha podido leer Meta: {r.error}</p>}
      </div>

      {r.grupo && <EmbudoGrupo g={r.grupo} alGuardar={(enGrupo) => setR({ ...r, grupo: { ...r.grupo!, enGrupo } })} />}
    </section>
  );
}

/**
 * Registradas → pulsan el botón del grupo → están dentro. El último número lo
 * apunta Sorela mirando el grupo: WhatsApp no deja leerlo desde fuera.
 */
function EmbudoGrupo({ g, alGuardar }: { g: Grupo; alGuardar: (n: number) => void }) {
  const [valor, setValor] = useState(g.enGrupo === null ? '' : String(g.enGrupo));
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'hecho' | 'fallo'>('quieto');

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0) return setEstado('fallo');
    setEstado('guardando');
    const r = await fetch('/api/metricas/grupo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personas: n }),
    }).catch(() => null);
    if (r?.ok) {
      alGuardar(n);
      setEstado('hecho');
    } else setEstado('fallo');
  }

  const pasos = [
    { label: 'Apuntadas', valor: g.registradas, nota: 'a la lista de la masterclass' },
    { label: 'Pulsan el botón', valor: g.pulsaron, nota: `${pct(g.pulsaron, g.medidas)} de las ${num(g.medidas)} apuntadas desde que se mide` },
    { label: 'En el grupo', valor: g.enGrupo, nota: g.enGrupo === null ? 'apúntalo abajo' : `${pct(g.enGrupo, g.registradas)} de las apuntadas` },
  ];

  return (
    <div>
      <p className={m.subtitulo}>Grupo de WhatsApp</p>
      <div className={m.cifras} style={{ marginTop: 10 }}>
        {pasos.map((p) => (
          <article key={p.label} className={m.cifra}>
            <span className={m.cifraEtiqueta}>{p.label}</span>
            <strong className={m.cifraValor}>{p.valor === null ? '—' : num(p.valor)}</strong>
            <span className={m.cifraNota}>{p.nota}</span>
          </article>
        ))}
      </div>
      <p className={m.nota} style={{ marginTop: 10 }}>
        {num(g.clics)} clics en total (web {g.clicsPorOrigen.web} · correo {g.clicsPorOrigen.correo} · recordatorio{' '}
        {g.clicsPorOrigen.recordatorio}). {g.sinPulsar} llevan más de un día sin pulsar; {g.recordadas} ya han recibido el
        recordatorio. De quien se apuntó antes de medir los clics no se sabe si pulsó, así que no cuenta aquí ni recibe el recordatorio.
      </p>
      <form onSubmit={guardar} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <label htmlFor="en-grupo" className={m.nota}>
          Personas en el grupo ahora:
        </label>
        <input
          id="en-grupo"
          type="number"
          min={0}
          inputMode="numeric"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setEstado('quieto');
          }}
          style={{ width: 90, padding: '6px 10px', borderRadius: 10, border: '1px solid var(--line-4)', font: 'inherit' }}
        />
        <button type="submit" className="btn btn-sm" disabled={estado === 'guardando'}>
          {estado === 'guardando' ? 'Guardando…' : 'Guardar'}
        </button>
        {estado === 'hecho' && <span className={m.nota}>Guardado.</span>}
        {estado === 'fallo' && <span className={m.nota}>No se ha podido guardar. Escribe un número entero.</span>}
      </form>
    </div>
  );
}
