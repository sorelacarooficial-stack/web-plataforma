'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Grupo, Pieza } from '@/lib/revision';
import type { Comentario } from '@/app/api/revision/route';
import css from './revision.module.css';

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Revision({ grupos }: { grupos: Grupo[] }) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [autor, setAutor] = useState('Sorela');

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/revision', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setComentarios(j.comentarios);
    } catch {
      /* sin conexión: se queda lo que había */
    }
  }, []);

  useEffect(() => {
    cargar();
    try {
      const a = localStorage.getItem('revision-autor');
      if (a) setAutor(a);
    } catch {}
  }, [cargar]);

  const cambiarAutor = (a: string) => {
    setAutor(a);
    try {
      localStorage.setItem('revision-autor', a);
    } catch {}
  };

  /* Solo cuentan las piezas que ya se pueden revisar (no las que siguen en edición). */
  const revisables = new Set(grupos.flatMap((g) => g.piezas.filter((p) => p.progreso == null).map((p) => p.id)));
  const total = revisables.size;
  const vistas = new Set(comentarios.map((c) => c.pieza).filter((id) => revisables.has(id))).size;

  return (
    <main className={css.pagina}>
      <header className={css.cabecera}>
        <p className={css.ante}>Tu espacio de revisión</p>
        <h1 className={css.titular}>
          Hola, Sorela. Aquí revisas <strong>todo antes de que se publique.</strong>
        </h1>
        <p className={css.entrada}>
          Esta página es solo para ti y para el equipo. Aquí subimos <b>todo lo que preparamos</b> (anuncios, vídeos, publicaciones y páginas) para que lo
          veas y nos digas qué cambiar. <b>Nada de lo que ves aquí está publicado</b> y nadie de fuera puede verlo.
        </p>
        <ol className={css.pasos}>
          <li>
            <span>1</span>
            <p>
              <b>Mira o escucha</b> cada pieza. Los vídeos tienen sonido.
            </p>
          </li>
          <li>
            <span>2</span>
            <p>
              Si te gusta tal cual, pulsa <b>«Me gusta así»</b>.
            </p>
          </li>
          <li>
            <span>3</span>
            <p>
              Si quieres cambiar algo, <b>escríbelo debajo</b> con tus palabras y pulsa <b>«Enviar cambio»</b>. Lo arreglamos y te lo marcamos como «Hecho».
            </p>
          </li>
        </ol>
        <div className={css.barra}>
          <span className={css.cuenta}>
            <span>
              Llevas <b>{vistas}</b> de <b>{total}</b> piezas revisadas
            </span>
            <span className={css.cuentaPista}>
              <span style={{ width: `${total ? (vistas / total) * 100 : 0}%` }} />
            </span>
          </span>
          <label className={css.quien}>
            Escribes como
            <input value={autor} onChange={(e) => cambiarAutor(e.target.value)} maxLength={40} />
          </label>
        </div>
        <nav className={css.indice}>
          {grupos.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.titulo}
            </a>
          ))}
        </nav>
      </header>

      {grupos.map((g) => (
        <section key={g.id} id={g.id} className={css.grupo}>
          <h2 className={css.h2}>{g.titulo}</h2>
          <p className={css.explicacion}>{g.explicacion}</p>
          <div className={css.rejilla}>
            {g.piezas.map((p) => (
              <TarjetaPieza
                key={p.id}
                pieza={p}
                autor={autor}
                comentarios={comentarios.filter((c) => c.pieza === p.id)}
                alGuardar={(c) => setComentarios((cs) => [...cs, c])}
                alMarcar={(id, hecho) => setComentarios((cs) => cs.map((c) => (c.id === id ? { ...c, hecho } : c)))}
              />
            ))}
          </div>
        </section>
      ))}

      <footer className={css.pie}>Sorela Caro · Técnica Divine®</footer>
    </main>
  );
}

function TarjetaPieza({
  pieza,
  autor,
  comentarios,
  alGuardar,
  alMarcar,
}: {
  pieza: Pieza;
  autor: string;
  comentarios: Comentario[];
  alGuardar: (c: Comentario) => void;
  alMarcar: (id: string, hecho: boolean) => void;
}) {
  const [formato, setFormato] = useState(0);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'' | 'enviando' | 'error'>('');
  const f = pieza.formatos[formato];
  const gustado = comentarios.some((c) => c.tipo === 'ok');

  const enviar = async (tipo: 'ok' | 'cambio') => {
    if (tipo === 'cambio' && texto.trim().length < 2) return;
    setEstado('enviando');
    try {
      const r = await fetch('/api/revision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pieza: pieza.id, tipo, texto: tipo === 'ok' ? '' : texto, autor }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error();
      alGuardar(j.comentario);
      if (tipo === 'cambio') setTexto('');
      setEstado('');
    } catch {
      setEstado('error');
    }
  };

  const marcar = async (c: Comentario) => {
    alMarcar(c.id, !c.hecho);
    try {
      await fetch('/api/revision', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: c.id, hecho: !c.hecho }),
      });
    } catch {
      alMarcar(c.id, c.hecho);
    }
  };

  if (pieza.progreso != null) {
    return (
      <article className={css.tarjeta}>
        <h3 className={css.h3}>{pieza.titulo}</h3>
        <EnEdicion porcentaje={pieza.progreso} />
        {pieza.nota && <p className={css.nota}>{pieza.nota}</p>}
      </article>
    );
  }

  return (
    <article className={css.tarjeta}>
      <div className={css.tarjetaCabeza}>
        <h3 className={css.h3}>{pieza.titulo}</h3>
        {gustado && <span className={css.sello}>✓ Te gusta</span>}
      </div>

      {pieza.formatos.length > 1 && (
        <div className={css.formatos} role="tablist">
          {pieza.formatos.map((x, i) => (
            <button key={x.src} role="tab" aria-selected={i === formato} className={i === formato ? css.formatoActivo : css.formato} onClick={() => setFormato(i)}>
              {x.etiqueta}
            </button>
          ))}
        </div>
      )}

      <div className={css.medio}>
        {f.tipo === 'video' && <video key={f.src} src={f.src} poster={f.poster} controls playsInline preload="metadata" />}
        {f.tipo === 'imagen' && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={f.src} src={f.src} alt={pieza.titulo} loading="lazy" />
        )}
        {f.tipo === 'pagina' && (
          <a className={css.abrir} href={f.src} target="_blank" rel="noopener">
            {f.etiqueta} ↗
          </a>
        )}
      </div>

      {pieza.nota && <p className={css.nota}>{pieza.nota}</p>}
      {pieza.guion && (
        <details className={css.guion}>
          <summary>Lo que dices en el vídeo</summary>
          <p>{pieza.guion}</p>
        </details>
      )}

      {comentarios.filter((c) => c.tipo === 'cambio').length > 0 && (
        <ul className={css.comentarios}>
          {comentarios
            .filter((c) => c.tipo === 'cambio')
            .map((c) => (
              <li key={c.id} className={c.hecho ? css.hecho : undefined}>
                <p>{c.texto}</p>
                <small>
                  {c.autor} · {fechaCorta(c.fecha)}
                  <button onClick={() => marcar(c)}>{c.hecho ? '✓ Hecho' : 'Marcar como hecho'}</button>
                </small>
              </li>
            ))}
        </ul>
      )}

      <div className={css.opinar}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Quieres cambiar algo? Escríbelo aquí…" rows={3} maxLength={2000} />
        <div className={css.botones}>
          {!gustado && (
            <button className={css.botonOk} onClick={() => enviar('ok')} disabled={estado === 'enviando'}>
              Me gusta así
            </button>
          )}
          <button className={css.botonCambio} onClick={() => enviar('cambio')} disabled={estado === 'enviando' || texto.trim().length < 2}>
            Enviar cambio
          </button>
        </div>
        {estado === 'error' && <p className={css.error}>No se ha guardado. Prueba otra vez.</p>}
      </div>
    </article>
  );
}

/** Tarjeta de «en edición»: la barra se llena hasta el porcentaje al entrar y un brillo la recorre. */
function EnEdicion({ porcentaje }: { porcentaje: number }) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setValor(porcentaje), 120);
    return () => clearTimeout(t);
  }, [porcentaje]);
  return (
    <div className={css.edicion} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} aria-label="Edición del vídeo">
      <div className={css.edicionCabeza}>
        <span className={css.edicionPunto} aria-hidden />
        <span>En edición · color y sonido</span>
      </div>
      <div className={css.edicionCifra}>
        {porcentaje}
        <small>%</small>
      </div>
      <div className={css.edicionPista}>
        <div className={css.edicionRelleno} style={{ width: `${valor}%` }} />
      </div>
      <p className={css.edicionPie}>Falta un {100 - porcentaje} % para terminarlo</p>
    </div>
  );
}
