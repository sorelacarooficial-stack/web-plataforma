'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FichaPersona, { type Persona } from './FichaPersona';
import { ETIQUETA_TIPO, TIPOS, comoLlego, type Tipo } from '@/lib/origenes';
import css from './plataforma.module.css';

/**
 * Los contactos que entran por la web, dentro de la plataforma.
 *
 * Esto sustituye a la lista de leads de mentira que traía la maqueta —Elena,
 * Rocío, Nuria— con sus estados y sus notas inventadas. Lo que se ve aquí es
 * lo que hay en Firestore, y nada más: si está vacío es que todavía no se ha
 * apuntado nadie, y eso es un dato, no un hueco que rellenar.
 *
 * El estado se guarda al pulsar y se pinta antes de que conteste el servidor.
 * Si el servidor dice que no, se deshace: para marcar veinte contactos
 * seguidos, esperar a cada respuesta es insufrible.
 *
 * La lista va separada por lo que busca cada persona, no por orden de llegada.
 * Quien deja su contacto en la portada quiere que le traten, quien lo deja en
 * formaciones quiere aprender y quien lo deja en la comunidad ya es terapeuta:
 * son tres conversaciones distintas y llamarlas igual obliga a adivinar cuál
 * toca. De dónde vino lo decide `lib/origenes.ts`, en el servidor.
 */

const ESTADOS = ['Nuevo', 'Contactado', 'En conversación', 'Cerrado', 'Descartado'] as const;
type Estado = (typeof ESTADOS)[number];

type Contacto = Persona & { estado: Estado; tipo: Tipo };

/* Se reutilizan los distintivos que ya tiene la plataforma en vez de inventar
   cuatro colores nuevos: el sin atender destaca, el descartado se apaga. */
const CLASE: Record<Estado, string> = {
  Nuevo: css.estadoTinta,
  Contactado: css.estadoOro,
  'En conversación': css.estadoOro,
  Cerrado: css.estadoNeutro,
  Descartado: css.estadoApagado,
};

/** «hace 3 h», «ayer», «12 oct». Una fecha completa no dice nada de un vistazo. */
function cuando(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function Contactos() {
  const [lista, setLista] = useState<Contacto[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'Todos' | Estado>('Todos');
  const [tipo, setTipo] = useState<'Todos' | Tipo>('Todos');
  const [busca, setBusca] = useState('');
  // Qué ficha está abierta. Se guarda el id y no la persona entera para que,
  // al cambiarle el estado o apuntarle algo, la ficha se repinte con lo nuevo
  // en vez de quedarse con la copia de cuando se abrió.
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const r = await fetch('/api/contactos');
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setFallo(
          c.motivo === 'sin-configurar'
            ? 'Falta la configuración de Firebase en el servidor.'
            : c.motivo === 'sin-permiso'
              ? 'Esta lista solo la ve Sorela.'
              : 'No he podido cargar los contactos.'
        );
        setLista([]);
        return;
      }
      setLista(c.contactos);
    } catch {
      setFallo('No hay conexión con el servidor.');
      setLista([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(id: string, estado: Estado) {
    const antes = lista;
    setLista((l) => l?.map((c) => (c.id === id ? { ...c, estado } : c)) ?? l);
    try {
      const r = await fetch('/api/contactos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
    } catch {
      // Se deshace y se avisa: dejar la pantalla diciendo «contactado» cuando
      // no se ha guardado es peor que no haber dejado pulsar.
      setLista(antes ?? null);
      setFallo('No se ha podido guardar el cambio. Vuelve a intentarlo.');
    }
  }

  /** Apunta algo de una persona. Se recarga para que la ficha lo enseñe ya. */
  async function apuntar(id: string, texto: string) {
    const r = await fetch('/api/contactos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nota: texto }),
    });
    if (!(await r.json().catch(() => ({ ok: false }))).ok) {
      throw new Error('No se ha podido guardar la nota.');
    }
    await cargar();
  }

  /** Descarga la lista tal como se ve, para abrirla en una hoja de cálculo. */
  function exportar() {
    if (!visibles.length) return;
    const cabecera = ['Fecha', 'Nombre', 'Correo', 'Teléfono', 'Ciudad', 'A qué se dedica', 'De dónde viene', 'Estado', 'Nota'];
    // Las comillas dobles dentro de un campo se escapan duplicándolas: sin
    // esto, una nota con comillas parte la fila en dos al abrir el archivo.
    const escapa = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = visibles.map((c) =>
      [c.creado ?? '', c.nombre, c.correo, c.whatsapp, c.ciudad, c.perfil, c.origen, c.estado, c.nota]
        .map(escapa)
        .join(',')
    );
    // El BOM del principio es lo que hace que Excel abra las tildes bien.
    const csv = '﻿' + [cabecera.map(escapa).join(','), ...filas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contactos-divine.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibles = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (lista ?? []).filter(
      (c) =>
        (filtro === 'Todos' || c.estado === filtro) &&
        (tipo === 'Todos' || c.tipo === tipo) &&
        (!t ||
          c.nombre.toLowerCase().includes(t) ||
          c.correo.toLowerCase().includes(t) ||
          c.ciudad.toLowerCase().includes(t))
    );
  }, [lista, filtro, tipo, busca]);

  const resumen = useMemo(() => {
    const l = lista ?? [];
    const ahora = Date.now();
    const de = (dias: number) =>
      l.filter((c) => c.creado && ahora - new Date(c.creado).getTime() < dias * 86400000).length;
    const porTipo = (t: Tipo) => l.filter((c) => c.tipo === t).length;
    return [
      { label: 'Sin atender', valor: String(l.filter((c) => c.estado === 'Nuevo').length), nota: 'nadie les ha escrito todavía' },
      { label: 'Posibles clientas', valor: String(porTipo('clienta')), nota: 'quieren que les trates' },
      { label: 'Posibles alumnas', valor: String(porTipo('alumna')), nota: 'quieren formarse' },
      { label: 'Esta semana', valor: String(de(7)), nota: 'han entrado en los últimos 7 días' },
    ];
  }, [lista]);

  if (lista === null) {
    return (
      <div className={css.columna}>
        <p className={css.vacioTexto}>Cargando los contactos…</p>
      </div>
    );
  }

  return (
    <div className={css.columna}>
      <div className={css.rejillaKpis}>
        {resumen.map((k) => (
          <article key={k.label} className={css.kpi}>
            <span className={css.kpiValor}>{k.valor}</span>
            <span className={css.kpiLabel}>{k.label}</span>
            <span className={css.kpiNota}>{k.nota}</span>
          </article>
        ))}
      </div>

      {fallo && (
        <p className={css.avisoFallo} role="alert">
          {fallo}{' '}
          <button type="button" className={css.btnLinea} onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}

      {/* Primero se separa por lo que busca cada uno, y solo después por en
          qué punto está. Son dos cortes distintos y mezclarlos en una sola
          fila de botones hace que nadie entienda cuál está aplicado. */}
      <div className={css.chips}>
        {(['Todos', ...TIPOS] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            aria-pressed={tipo === t}
            className={`${css.chip} ${tipo === t ? css.chipActivo : ''}`}
          >
            {t === 'Todos' ? 'Todos' : ETIQUETA_TIPO[t]}
            {t !== 'Todos' && (
              <span style={{ marginLeft: 7, opacity: 0.6 }}>
                {(lista ?? []).filter((c) => c.tipo === t).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className={css.chips}>
          <input
            placeholder="Buscar por nombre, correo o ciudad"
            aria-label="Buscar contacto"
            className={css.campoRedondo}
            style={{ flex: '0 1 260px' }}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {(['Todos', ...ESTADOS] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={`${css.chip} ${filtro === f ? css.chipActivo : ''}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button type="button" className={css.btn} onClick={exportar} disabled={!visibles.length}>
          Descargar en Excel
        </button>
      </div>

      <section className={css.tarjeta}>
        {visibles.length === 0 ? (
          <p className={css.vacioTexto}>
            {lista.length === 0
              ? 'Todavía no se ha apuntado nadie. En cuanto alguien deje su contacto en la web, aparecerá aquí.'
              : 'Ningún contacto con ese filtro.'}
          </p>
        ) : (
          visibles.map((c) => (
            <article key={c.id} className={css.fila} style={{ padding: '16px 0', gap: 14 }}>
              <span
                style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}
              >
                {/* El nombre abre la ficha. Es donde va a pulsar cualquiera
                    que quiera saber más de esa persona, así que mejor que sea
                    eso a poner un botón «ver» al final de la fila. */}
                <button
                  type="button"
                  onClick={() => setAbierta(c.id)}
                  className={css.abrirFicha}
                >
                  {c.nombre}
                  {c.ciudad && ` · ${c.ciudad}`}
                </button>
                <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                  {c.correo}
                  {c.whatsapp && ` · ${c.whatsapp}`}
                </span>
                {c.nota && (
                  <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--ink-3)' }}>
                    «{c.nota}»
                  </span>
                )}
              </span>

              <span style={{ flex: '0 1 200px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {/* Qué busca, en la propia fila. Los botones de arriba filtran,
                    pero con «Todos» puesto —que es como se mira casi siempre—
                    hacía falta poder distinguirlos de un vistazo. */}
                <span className={css.tipoPersona} data-tipo={c.tipo}>
                  {ETIQUETA_TIPO[c.tipo]}
                </span>
                {c.perfil && (
                  <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-3)' }}>
                    {c.perfil}
                  </span>
                )}
                <span style={{ fontSize: 11.5, fontWeight: 300, color: 'var(--faint)' }}>
                  {/* El origen en crudo —«cita-madrid»— no se le enseña a
                      nadie: se traduce a lo que significa. */}
                  {comoLlego(c.origen)} · {cuando(c.creado)}
                  {c.veces > 1 && ` · ${c.veces} veces`}
                </span>
              </span>

              <span className={`${css.estado} ${CLASE[c.estado]}`}>{c.estado}</span>

              <span className={css.acciones}>
                {c.whatsapp && (
                  <a
                    className={`${css.btn} ${css.btnSm}`}
                    href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                )}
                <select
                  aria-label={`Estado de ${c.nombre}`}
                  className={css.campoRedondo}
                  style={{ fontSize: 13 }}
                  value={c.estado}
                  onChange={(e) => cambiarEstado(c.id, e.target.value as Estado)}
                >
                  {ESTADOS.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </span>
            </article>
          ))
        )}
      </section>

      {/* La ficha se busca en la lista por su id en cada repintado: así, al
          cambiarle el estado o apuntarle algo, se ve al momento y no se queda
          con la copia de cuando se abrió. */}
      <FichaPersona
        persona={(lista ?? []).find((c) => c.id === abierta) ?? null}
        onCerrar={() => setAbierta(null)}
        onCambiarEstado={(id, estado) => cambiarEstado(id, estado as Estado)}
        onApuntar={apuntar}
      />
    </div>
  );
}
