'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { inicialesDe, type EstadoFicha, type FilaFicha } from '@/lib/fichas-tipos';
import { useAviso, useConfirmar } from './Confirmar';
import s from './fichasmapa.module.css';

/**
 * Las fichas del mapa «Localiza tu terapeuta», vistas por Sorela.
 *
 * Las fichas ya no esperan aprobación: salen solas cuando una miembro las
 * publica con su permiso. Esta pantalla es para vigilarlas: ver cuáles están en
 * la web, abrir la pública, ocultar una (y volver a enseñarla) o borrarla.
 *
 * Ocultar no pregunta: se deshace con un botón. Borrar sí, con el diálogo de la
 * casa: se pierde la ficha entera y ella tendría que hacerla de nuevo.
 */

type Filtro = 'todas' | EstadoFicha;

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: 'todas', texto: 'Todas' },
  { id: 'publicada', texto: 'En el mapa' },
  { id: 'oculta', texto: 'Ocultas' },
  { id: 'borrador', texto: 'Borradores' },
];

const ESTADO: Record<EstadoFicha, string> = {
  publicada: 'En el mapa',
  oculta: 'Oculta por ti',
  borrador: 'Borrador',
};

const MOTIVO: Record<string, string> = {
  propia: 'La quitó ella',
  'sin-membresia': 'Sin membresía',
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function FichasMapa() {
  const reducir = useReducedMotion();
  const [lista, setLista] = useState<FilaFicha[] | null>(null);
  const [fallo, setFallo] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [confirmar, dialogo] = useConfirmar();
  const [avisar, aviso] = useAviso();

  const cargar = useCallback(async () => {
    setFallo('');
    try {
      const r = await fetch('/api/ficha?todas=1', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo ?? String(r.status));
      setLista(j.fichas as FilaFicha[]);
    } catch {
      setLista((l) => l ?? []);
      setFallo('No he podido cargar las fichas. Revisa la conexión y vuelve a intentarlo.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarVisible(f: FilaFicha, ocultar: boolean) {
    setOcupada(f.uid);
    try {
      const r = await fetch('/api/ficha', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: f.uid, ocultar }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error();
      const estado = j.estado as EstadoFicha;
      setLista((l) => (l ?? []).map((x) => (x.uid === f.uid ? { ...x, estado, ocultaPorSorela: ocultar } : x)));
      if (ocultar) avisar(`La ficha de ${f.nombre} ya no se ve en la web.`, 'hecho');
      else if (estado === 'publicada') avisar(`La ficha de ${f.nombre} vuelve a estar en el mapa.`, 'hecho');
      else
        avisar(
          `Ya no está oculta, pero no vuelve sola al mapa: le falta algo (la membresía, su permiso o algún dato). Queda como borrador hasta que ella la publique.`,
          'hecho'
        );
    } catch {
      avisar('No se ha podido cambiar. Inténtalo otra vez.');
    } finally {
      setOcupada(null);
    }
  }

  async function borrar(f: FilaFicha) {
    const si = await confirmar({
      titulo: `¿Borrar la ficha de ${f.nombre}?`,
      texto:
        'Desaparece del mapa y se borra entera: textos, foto pública y permiso. Su cuenta y su perfil de la plataforma no se tocan. Si quiere volver a salir, tendrá que hacerla de nuevo.',
      boton: 'Borrar la ficha',
    });
    if (!si) return;
    setOcupada(f.uid);
    try {
      const r = await fetch(`/api/ficha?uid=${encodeURIComponent(f.uid)}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error();
      setLista((l) => (l ?? []).filter((x) => x.uid !== f.uid));
      avisar(`Ficha de ${f.nombre} borrada.`, 'hecho');
    } catch {
      avisar('No se ha podido borrar. Inténtalo otra vez.');
    } finally {
      setOcupada(null);
    }
  }

  const cuenta = (e: Filtro) => (lista ?? []).filter((f) => e === 'todas' || f.estado === e).length;
  const visibles = (lista ?? []).filter((f) => filtro === 'todas' || f.estado === filtro);

  return (
    <div className={s.pantalla}>
      <header className={s.intro}>
        <p className={s.entradilla}>
          Las fichas salen solas en «Localiza tu terapeuta» cuando una miembro las publica con su permiso. Desde aquí las
          vigilas: puedes ocultar una (y volver a enseñarla) o borrarla.
        </p>
        <a className={s.enlaceMapa} href="/terapeutas" target="_blank" rel="noopener noreferrer">
          Ver el mapa público ↗
        </a>
      </header>

      <section className={s.cifras} aria-label="Resumen">
        {(['publicada', 'oculta', 'borrador'] as const).map((e) => (
          <div key={e} className={s.cifra} data-estado={e}>
            <span className={s.cifraNumero}>{lista ? cuenta(e) : '–'}</span>
            <span className={s.cifraTexto}>{e === 'publicada' ? 'En el mapa' : e === 'oculta' ? 'Ocultas por ti' : 'Borradores'}</span>
          </div>
        ))}
      </section>

      {fallo && (
        <div className={s.banda} role="alert">
          <span className={s.bandaIcono} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9.2" strokeWidth="1.7" />
              <path d="M12 7.5v6M12 17h.01" />
            </svg>
          </span>
          <p>{fallo}</p>
          <button type="button" className={s.btnOscuro} onClick={cargar}>
            Reintentar
          </button>
        </div>
      )}

      {lista && lista.length > 0 && (
        <div className={s.filtros} role="group" aria-label="Filtrar fichas">
          {FILTROS.map((x) => (
            <button key={x.id} type="button" className={s.filtro} aria-pressed={filtro === x.id} onClick={() => setFiltro(x.id)}>
              {x.texto}
              <span className={s.filtroCuenta}>{cuenta(x.id)}</span>
            </button>
          ))}
        </div>
      )}

      {!lista && (
        <ul className={s.lista} aria-busy="true" aria-label="Cargando fichas">
          {[0, 1, 2].map((i) => (
            <li key={i} className={`${s.fila} ${s.esqueleto}`} />
          ))}
        </ul>
      )}

      {lista && lista.length === 0 && !fallo && (
        <div className={s.vacio}>
          <span className={s.vacioIcono} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
          </span>
          <h2 className={s.vacioTitulo}>Todavía no hay fichas</h2>
          <p className={s.vacioTexto}>Cuando una miembro termine su perfil y acepte salir en el mapa, aparecerá aquí al momento.</p>
        </div>
      )}

      {lista && lista.length > 0 && visibles.length === 0 && (
        <p className={s.vacioFiltro}>Ninguna ficha en «{FILTROS.find((x) => x.id === filtro)?.texto}».</p>
      )}

      {visibles.length > 0 && (
        <ul className={s.lista}>
          <AnimatePresence initial={false}>
            {visibles.map((f) => (
              <motion.li
                key={f.uid}
                className={s.fila}
                layout={!reducir}
                initial={reducir ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducir ? { opacity: 0 } : { opacity: 0, x: -16 }}
                transition={{ duration: reducir ? 0 : 0.22 }}
                aria-busy={ocupada === f.uid ? true : undefined}
              >
                <span className={s.foto} aria-hidden="true">
                  {f.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.foto} alt="" loading="lazy" />
                  ) : (
                    inicialesDe(f.nombre)
                  )}
                </span>

                <div className={s.quien}>
                  <p className={s.nombre}>{f.nombre}</p>
                  <p className={s.lugar}>{[f.ciudad, f.paisNombre].filter(Boolean).join(', ') || 'Sin ciudad'}</p>
                  {f.actualizado && <p className={s.meta}>Cambiada el {fecha(f.actualizado)}</p>}
                </div>

                <div className={s.estadoCaja}>
                  <span className={s.estado} data-estado={f.estado}>
                    <span className={s.punto} aria-hidden="true" />
                    {ESTADO[f.estado]}
                  </span>
                  {f.estado === 'borrador' && (f.ocultaPorSorela || (f.motivo && MOTIVO[f.motivo])) && (
                    <span className={s.motivo}>{f.ocultaPorSorela ? 'Bloqueada por ti' : MOTIVO[f.motivo ?? '']}</span>
                  )}
                </div>

                <div className={s.acciones}>
                  {f.estado === 'publicada' && f.slug && (
                    <a className={s.btnLinea} href={`/terapeutas/${f.slug}`} target="_blank" rel="noopener noreferrer">
                      Ver en la web ↗
                    </a>
                  )}
                  {f.estado === 'publicada' && (
                    <button type="button" className={s.btnLinea} onClick={() => cambiarVisible(f, true)} disabled={ocupada === f.uid}>
                      Ocultar
                    </button>
                  )}
                  {f.ocultaPorSorela && (
                    <button type="button" className={s.btnOscuro} onClick={() => cambiarVisible(f, false)} disabled={ocupada === f.uid}>
                      Volver a enseñar
                    </button>
                  )}
                  <button type="button" className={s.btnPeligro} onClick={() => borrar(f)} disabled={ocupada === f.uid}>
                    Borrar
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {dialogo}
      {aviso}
    </div>
  );
}
