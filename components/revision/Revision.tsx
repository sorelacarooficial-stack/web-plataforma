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

  const total = grupos.reduce((n, g) => n + g.piezas.length, 0);
  const vistas = new Set(comentarios.map((c) => c.pieza)).size;

  return (
    <main className={css.pagina}>
      <header className={css.cabecera}>
        <p className={css.ante}>Revisión · antes de publicar</p>
        <h1 className={css.titular}>
          Hola, Sorela. <strong>Esto es lo que tenemos preparado.</strong>
        </h1>
        <p className={css.entrada}>
          Mira cada pieza. Si te gusta, pulsa «Me gusta así». Si quieres cambiar algo, escríbelo debajo con tus palabras: una frase, una foto, un dato,
          lo que sea. Nadie de fuera ve esta página.
        </p>
        <div className={css.barra}>
          <span>
            Has opinado sobre <b>{vistas}</b> de <b>{total}</b>
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
