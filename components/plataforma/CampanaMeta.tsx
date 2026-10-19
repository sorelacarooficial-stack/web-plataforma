'use client';

import { useEffect, useState } from 'react';
import m from './metricas.module.css';

/**
 * La campaña de Meta de la masterclass, arriba del todo en Métricas: cuánto se
 * ha gastado, cuánta gente se ha apuntado desde los anuncios, cuánto cuesta
 * cada una y qué anuncio funciona. Lee /api/metricas/campana.
 *
 * Solo se enseña mientras hay campaña: si no hay gasto ni registros, no ocupa
 * sitio.
 */

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
  error?: string;
};

const eur = (v: number) => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const num = (v: number) => v.toLocaleString('es-ES');

export default function CampanaMeta() {
  const [r, setR] = useState<Resumen | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/metricas/campana', { cache: 'no-store' })
      .then((x) => (x.ok ? x.json() : null))
      .then((j) => vivo && setR(j))
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, []);

  if (!r || (r.gasto === 0 && r.registros === 0 && r.hayMeta)) return null;

  const cifras = [
    { label: 'Gastado', valor: eur(r.gasto), nota: r.hayMeta ? `${num(r.alcance)} personas alcanzadas` : 'falta conectar Meta' },
    { label: 'Registros', valor: num(r.registros), nota: `hoy ${r.registrosHoy} · ayer ${r.registrosAyer}` },
    { label: 'Por registro', valor: r.coste !== null ? eur(r.coste) : '—', nota: 'gasto ÷ registros reales' },
    { label: 'Clics', valor: num(r.clics), nota: r.ctr !== null ? `${r.ctr.toFixed(2).replace('.', ',')} % de quien lo ve` : '' },
  ];
  const anuncios = [...r.anuncios].sort((a, b) => b.registros - a.registros || b.gasto - a.gasto);

  return (
    <section className={m.tarjeta}>
      <header className={m.cabecera}>
        <h3>Campaña de la masterclass</h3>
        <span className={m.nota}>Anuncios de Meta · quedan {r.diasQuedan} días</span>
      </header>

      <div className={m.cifras}>
        {cifras.map((c) => (
          <article key={c.label} className={m.cifra}>
            <span className={m.cifraEtiqueta}>{c.label}</span>
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
                  {a.registros} <em>· {eur(a.gasto)}{a.registros ? ` · ${eur(a.gasto / a.registros)} c/u` : ''}</em>
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
        {r.error && <p className={m.nota}>No se ha podido leer Meta: {r.error}</p>}
      </div>
    </section>
  );
}
