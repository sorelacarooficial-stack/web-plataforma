'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import m from './metricas.module.css';

/**
 * Las métricas de Sorela: quién la ve, desde dónde, con qué, qué vídeos se
 * miran y cómo van las alumnas en el aula.
 *
 * Los números salen de /api/metricas, que los suma de los contadores diarios
 * de la web (ver lib/metricas.ts). Empiezan a contar el día que se publica el
 * medidor: lo anterior no existe.
 */

type Par = [string, number];
type Dia = { dia: string; vistas: number; visitas: number; personas: number; reproducciones: number; segundosVideo: number };
type Totales = Omit<Dia, 'dia'>;
type Video = { id: string; nombre: string; ruta: string; reproducciones: number; c25: number; c50: number; c75: number; c100: number; segundos: number; duracion: number };
type Aula = {
  totalClases: number;
  lecciones: { id: string; titulo: string; empezadas: number; completadas: number; minutosMedios: number }[];
  alumnas: { uid: string; nombre: string; correo: string; completadas: number; minutos: number; ultima: string | null }[];
};
type Historia = {
  primerContacto: string | null;
  contactos: number;
  cuentas: number;
  conAcceso: number;
  acuerdos: number;
  correos: number;
  semanas: { semana: string; contactos: number; cuentas: number; acuerdos: number }[];
  porOrigen: Par[];
  porFuente: Par[];
  porTipo: Par[];
};
type Datos = {
  dias: number;
  todo?: boolean;
  desdeMedidor?: string | null;
  historia?: Historia | null;
  serie: Dia[];
  totales: Totales;
  anteriores: Totales;
  rutas: Par[];
  entradas: Par[];
  origenes: Par[];
  paises: Par[];
  ciudades: Par[];
  dispositivos: Par[];
  horas: Record<string, number>;
  videos: Video[];
  aula: Aula | null;
  prueba: boolean;
};

const PAGINAS: Record<string, string> = {
  '·': 'Portada',
  '/': 'Portada',
  '·formaciones': 'Formaciones',
  '·metodo': 'El método',
  '·comunidad': 'Comunidad',
  '·terapeutas': 'Terapeutas',
  '·sobre': 'Sobre Sorela',
  '·contacto': 'Contacto',
  '·presentacion': 'Presentación',
  '·registro': 'Crear cuenta',
  '·entrar': 'Entrar',
  '·alumnas': 'Landing de alumnas',
  '·blog': 'Blog',
};
const pagina = (k: string) => PAGINAS[k] ?? k.replace(/·/g, '/');

const PAISES = new Intl.DisplayNames(['es'], { type: 'region' });
const bandera = (cc: string) =>
  /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐';
const nombrePais = (cc: string) => {
  try {
    return PAISES.of(cc) ?? cc;
  } catch {
    return cc;
  }
};

const num = (n: number) => n.toLocaleString('es-ES');
const minutos = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1).replace('.', ',')} h` : `${Math.round(s / 60)} min`);
const DIA_CORTO = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const DIA_LARGO = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const fechaDe = (dia: string) => new Date(`${dia}T12:00:00`);
const conMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Cambio({ ahora, antes }: { ahora: number; antes: number }) {
  if (!antes && !ahora) return null;
  if (!antes) return <span className={m.cambioNuevo}>nuevo</span>;
  const p = Math.round(((ahora - antes) / antes) * 100);
  if (p === 0) return <span className={m.cambioIgual}>igual</span>;
  return (
    <span className={p > 0 ? m.cambioSube : m.cambioBaja}>
      {p > 0 ? '▲' : '▼'} {Math.abs(p)} %
    </span>
  );
}

function Barras({ pares, formato = (k: string) => k, vacio }: { pares: Par[]; formato?: (k: string) => React.ReactNode; vacio: string }) {
  const max = Math.max(1, ...pares.map((p) => p[1]));
  const total = pares.reduce((s, p) => s + p[1], 0);
  if (!pares.length) return <p className={m.vacio}>{vacio}</p>;
  return (
    <ul className={m.barras}>
      {pares.map(([k, v], i) => (
        <li key={k}>
          <span className={m.barraEtiqueta}>{formato(k)}</span>
          <span className={m.barraValor}>
            {num(v)} <em>{Math.round((v / total) * 100)} %</em>
          </span>
          <span className={m.barraPista}>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: v / max }}
              transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Grafica({ serie }: { serie: Dia[] }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map((d) => d.visitas));
  const marcas = serie.length > 14 ? [0, Math.floor(serie.length / 2), serie.length - 1] : serie.map((_, i) => i);
  const d = sobre !== null ? serie[sobre] : null;
  return (
    <div className={m.grafica} onMouseLeave={() => setSobre(null)}>
      <div className={m.graficaCuerpo} style={{ gridTemplateColumns: `repeat(${serie.length}, 1fr)` }}>
        {serie.map((dia, i) => (
          <button
            type="button"
            key={dia.dia}
            className={m.columna}
            data-activa={sobre === i ? '' : undefined}
            onMouseEnter={() => setSobre(i)}
            onFocus={() => setSobre(i)}
            aria-label={`${DIA_LARGO.format(fechaDe(dia.dia))}: ${dia.visitas} visitas`}
          >
            <motion.span
              className={m.columnaBarra}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: Math.max(dia.visitas / max, dia.visitas ? 0.03 : 0.012) }}
              transition={{ duration: 0.6, delay: i * (0.4 / serie.length), ease: [0.22, 1, 0.36, 1] }}
            />
          </button>
        ))}
      </div>
      <div className={m.graficaPie} style={{ gridTemplateColumns: `repeat(${serie.length}, 1fr)` }}>
        {serie.map((dia, i) => (
          <span key={dia.dia}>{marcas.includes(i) ? DIA_CORTO.format(fechaDe(dia.dia)) : ''}</span>
        ))}
      </div>
      {d && sobre !== null && (
        <div
          className={m.globo}
          style={{
            left: `${((sobre + 0.5) / serie.length) * 100}%`,
            // Cerca de los bordes, el globo se abre hacia dentro para no salirse.
            transform: `translate(${sobre / serie.length < 0.2 ? '-12%' : sobre / serie.length > 0.8 ? '-88%' : '-50%'}, -100%)`,
          }}
        >
          <strong>{conMayuscula(DIA_LARGO.format(fechaDe(d.dia)))}</strong>
          <span>{num(d.visitas)} visitas · {num(d.personas)} personas</span>
          <span>{num(d.vistas)} páginas vistas</span>
          {d.reproducciones > 0 && <span>{num(d.reproducciones)} vídeos reproducidos</span>}
        </div>
      )}
    </div>
  );
}

function Horas({ horas }: { horas: Record<string, number> }) {
  const valores = Array.from({ length: 24 }, (_, h) => horas[String(h).padStart(2, '0')] ?? 0);
  const max = Math.max(1, ...valores);
  const pico = valores.indexOf(Math.max(...valores));
  if (!valores.some(Boolean)) return <p className={m.vacio}>Todavía no hay horas que comparar.</p>;
  return (
    <>
      <div className={m.horas}>
        {valores.map((v, h) => (
          <span key={h} title={`${h}:00 · ${v} páginas vistas`} data-pico={h === pico ? '' : undefined}>
            <motion.i initial={{ scaleY: 0 }} animate={{ scaleY: Math.max(v / max, 0.04) }} transition={{ duration: 0.5, delay: h * 0.015 }} />
          </span>
        ))}
      </div>
      <div className={m.horasPie}>
        <span>0 h</span>
        <span>6 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>23 h</span>
      </div>
      <p className={m.nota}>Donde más te miran: sobre las {pico}:00 (hora de España).</p>
    </>
  );
}

const cuando = (iso: string | null) => {
  if (!iso) return 'Aún no ha empezado';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return dias <= 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} días`;
};

function fechaLarga(dia: string) {
  const [a, mm, d] = dia.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a, mm - 1, d));
}

/** Lo que ha pasado desde que existe la web, semana a semana. */
function Historia({ h, desdeMedidor }: { h: Historia; desdeMedidor: string | null }) {
  const max = Math.max(1, ...h.semanas.map((s) => s.contactos + s.cuentas + s.acuerdos));
  const corta = (dia: string) => {
    const [a, mm, d] = dia.split('-').map(Number);
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(a, mm - 1, d));
  };
  return (
    <>
      <section className={m.tarjeta}>
        <header className={m.cabecera}>
          <h3>Tu web desde el principio</h3>
          <span className={m.nota}>{h.primerContacto ? `Primer contacto: ${fechaLarga(h.primerContacto)}` : 'Aún no hay contactos'}</span>
        </header>
        <div className={m.historiaCifras}>
          {[
            { k: 'Contactos', v: h.contactos, n: 'han dejado sus datos' },
            { k: 'Cuentas', v: h.cuentas, n: `${h.conAcceso} con acceso a algo` },
            { k: 'Acuerdos firmados', v: h.acuerdos, n: 'de confidencialidad' },
            { k: 'Correos enviados', v: h.correos, n: desdeMedidor ? 'desde el historial de correos' : '' },
          ].map((c) => (
            <div key={c.k} className={m.historiaCifra}>
              <span className={m.cifraEtiqueta}>{c.k}</span>
              <strong className={m.cifraValor}>{num(c.v)}</strong>
              <span className={m.cifraNota}>{c.n}</span>
            </div>
          ))}
        </div>

        <h4 className={m.subtitulo}>Semana a semana</h4>
        {h.semanas.length === 0 ? (
          <p className={m.vacio}>Todavía no hay nada que contar.</p>
        ) : (
          <div className={m.semanas} role="list">
            {h.semanas.map((s, i) => {
              const total = s.contactos + s.cuentas + s.acuerdos;
              return (
                <div key={s.semana} className={m.semana} role="listitem" title={`Semana del ${corta(s.semana)}: ${s.contactos} contactos, ${s.cuentas} cuentas, ${s.acuerdos} acuerdos`}>
                  <span className={m.semanaNumero}>{total || ''}</span>
                  <div className={m.semanaColumna}>
                    {(['acuerdos', 'cuentas', 'contactos'] as const).map((k) =>
                      s[k] ? (
                        <motion.span
                          key={k}
                          className={m.semanaTrozo}
                          data-k={k}
                          initial={{ height: 0 }}
                          animate={{ height: `${(s[k] / max) * 100}%` }}
                          transition={{ delay: i * 0.04, type: 'spring', stiffness: 160, damping: 22 }}
                        />
                      ) : null
                    )}
                  </div>
                  <span className={m.semanaFecha}>{corta(s.semana)}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className={m.leyenda}>
          <span data-k="contactos">Contactos</span>
          <span data-k="cuentas">Cuentas</span>
          <span data-k="acuerdos">Acuerdos</span>
        </div>
      </section>

      <div className={m.rejilla}>
        <section className={m.tarjeta}>
          <header className={m.cabecera}>
            <h3>Por dónde entraron</h3>
          </header>
          <Barras pares={h.porOrigen} vacio="Aún no hay contactos." />
        </section>
        <section className={m.tarjeta}>
          <header className={m.cabecera}>
            <h3>Qué buscan</h3>
          </header>
          <Barras pares={h.porTipo} vacio="Aún no hay contactos." />
          <h4 className={m.subtitulo}>Desde dónde llegaron a la web</h4>
          <Barras pares={h.porFuente} vacio="Aún no hay datos." />
        </section>
      </div>
    </>
  );
}

export default function Metricas() {
  const [dias, setDias] = useState<number | 'todo'>(30);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(async (n: number | 'todo') => {
    setFallo(false);
    try {
      const j = await (await fetch(`/api/metricas?dias=${n}`)).json();
      if (j.ok) setDatos(j);
      else setFallo(true);
    } catch {
      setFallo(true);
    }
  }, []);

  useEffect(() => {
    cargar(dias);
  }, [cargar, dias]);

  const movil = useMemo(() => {
    if (!datos) return 0;
    const total = datos.dispositivos.reduce((s, p) => s + p[1], 0);
    const mv = datos.dispositivos.find((p) => p[0] === 'Móvil')?.[1] ?? 0;
    return total ? Math.round((mv / total) * 100) : 0;
  }, [datos]);

  if (fallo)
    return (
      <p className={m.vacio}>
        No he podido cargar las métricas.{' '}
        <button type="button" className={m.enlace} onClick={() => cargar(dias)}>
          Reintentar
        </button>
      </p>
    );

  const t = datos?.totales;
  const a = datos?.anteriores;
  const sinDatos = datos && !datos.serie.some((d) => d.vistas);

  return (
    <div className={m.metricas}>
      <div className={m.barraSuperior}>
        <LayoutGroup id="periodo">
          <div className={m.periodo} role="tablist" aria-label="Periodo">
            {([7, 30, 90, 'todo'] as const).map((n) => (
              <button key={n} type="button" role="tab" aria-selected={dias === n} onClick={() => setDias(n)}>
                {dias === n && <motion.span layoutId="periodo-activo" className={m.periodoActivo} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span>{n === 7 ? '7 días' : n === 30 ? '30 días' : n === 90 ? '3 meses' : 'Desde el inicio'}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
        {datos?.prueba && <span className={m.prueba}>Datos de prueba</span>}
      </div>

      {datos?.todo && datos.historia && <Historia h={datos.historia} desdeMedidor={datos.desdeMedidor ?? null} />}

      {datos?.todo && datos.desdeMedidor && (
        <div className={m.aviso}>
          <strong>Visitas de la web: desde el {fechaLarga(datos.desdeMedidor)}.</strong> Ese día se instaló el medidor; lo
          anterior no se guardó en ningún sitio y no se puede recuperar. Lo de arriba (contactos, cuentas, acuerdos) sí está
          completo desde el principio.
        </div>
      )}

      {sinDatos && !datos?.todo && (
        <div className={m.aviso}>
          <strong>Las métricas empiezan a contar desde hoy.</strong> Lo de antes no se midió, así que irás viendo
          números a medida que entre gente en la web.
        </div>
      )}

      {/* ---------- Las cifras ---------- */}
      <section className={m.cifras}>
        {[
          { label: 'Personas', valor: t?.personas, antes: a?.personas, nota: 'distintas que han entrado' },
          { label: 'Visitas', valor: t?.visitas, antes: a?.visitas, nota: 'veces que han entrado' },
          { label: 'Páginas vistas', valor: t?.vistas, antes: a?.vistas, nota: t && t.visitas ? `${(t.vistas / t.visitas).toFixed(1).replace('.', ',')} por visita` : 'por visita' },
          { label: 'Vídeos reproducidos', valor: t?.reproducciones, antes: a?.reproducciones, nota: t ? `${minutos(t.segundosVideo)} vistos en total` : '' },
        ].map((c, i) => (
          <motion.article key={c.label} className={m.cifra} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <span className={m.cifraEtiqueta}>{c.label}</span>
            <strong className={m.cifraValor}>{datos ? num(c.valor ?? 0) : '—'}</strong>
            <span className={m.cifraNota}>
              {datos && !datos.todo && <Cambio ahora={c.valor ?? 0} antes={c.antes ?? 0} />} {c.nota}
            </span>
          </motion.article>
        ))}
      </section>

      {/* ---------- Visitas por día ---------- */}
      <section className={m.tarjeta}>
        <header className={m.cabecera}>
          <h3>Visitas por día</h3>
          <span className={m.nota}>Pasa por encima de un día para ver el detalle</span>
        </header>
        {datos ? <Grafica serie={datos.serie} /> : <div className={m.esqueleto} style={{ height: 180 }} />}
      </section>

      <div className={m.rejilla}>
        <section className={m.tarjeta}>
          <header className={m.cabecera}>
            <h3>De dónde llegan</h3>
          </header>
          <Barras pares={datos?.origenes ?? []} vacio="Todavía nadie ha llegado desde otra web." />
          <p className={m.nota}>«Directo» es quien escribe la dirección o abre un enlace sin origen (muchas veces, WhatsApp).</p>
        </section>

        <section className={m.tarjeta}>
          <header className={m.cabecera}>
            <h3>Desde dónde te ven</h3>
          </header>
          <Barras
            pares={datos?.paises ?? []}
            formato={(k) => (
              <>
                <span className={m.bandera}>{bandera(k)}</span> {nombrePais(k)}
              </>
            )}
            vacio="Aún no hay países."
          />
          {datos && datos.ciudades.length > 0 && (
            <>
              <h4 className={m.subtitulo}>Ciudades</h4>
              <div className={m.chips}>
                {datos.ciudades.map(([c, v]) => (
                  <span key={c} className={m.chip}>
                    {c} <b>{num(v)}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className={m.tarjeta}>
          <header className={m.cabecera}>
            <h3>Qué páginas miran</h3>
          </header>
          <Barras pares={datos?.rutas ?? []} formato={pagina} vacio="Aún no hay páginas vistas." />
        </section>

        <section className={m.tarjeta}>
          <header className={m.cabecera}>
            <h3>Con qué te ven</h3>
          </header>
          {datos && datos.dispositivos.length ? (
            <>
              <div className={m.reparto}>
                {datos.dispositivos.map(([k, v], i) => {
                  const total = datos.dispositivos.reduce((s, p) => s + p[1], 0);
                  return (
                    <motion.span key={k} data-n={i} initial={{ flexGrow: 0 }} animate={{ flexGrow: v / total }} transition={{ duration: 0.8 }} title={`${k}: ${Math.round((v / total) * 100)} %`} />
                  );
                })}
              </div>
              <ul className={m.leyenda}>
                {datos.dispositivos.map(([k, v], i) => (
                  <li key={k}>
                    <i data-n={i} /> {k} <b>{num(v)}</b>
                  </li>
                ))}
              </ul>
              <p className={m.nota}>
                {movil >= 50 ? `El ${movil} % entra desde el móvil: lo primero que se ve tiene que funcionar ahí.` : `El ${movil} % entra desde el móvil.`}
              </p>
            </>
          ) : (
            <p className={m.vacio}>Aún no hay dispositivos.</p>
          )}
          <h4 className={m.subtitulo}>A qué hora</h4>
          {datos && <Horas horas={datos.horas} />}
        </section>
      </div>

      {/* ---------- Vídeos ---------- */}
      <section className={m.tarjeta}>
        <header className={m.cabecera}>
          <h3>Vídeos de la web</h3>
          <span className={m.nota}>Desde que se empezó a medir · cuenta cuando se ven con sonido</span>
        </header>
        {datos && datos.videos.length ? (
          <div className={m.tabla}>
            <div className={m.filaTitulo}>
              <span>Vídeo</span>
              <span>Reproducciones</span>
              <span>Hasta dónde llegan</span>
              <span>Tiempo medio</span>
            </div>
            {datos.videos.map((v) => {
              const r = Math.max(1, v.reproducciones);
              return (
                <div key={v.id} className={m.fila}>
                  <span className={m.videoNombre}>
                    <strong>{v.nombre}</strong>
                    <em>{pagina(v.ruta.replace(/\//g, '·') || '·')}</em>
                  </span>
                  <span className={m.grande}>{num(v.reproducciones)}</span>
                  <span className={m.embudo} title={`25 %: ${v.c25} · 50 %: ${v.c50} · 75 %: ${v.c75} · final: ${v.c100}`}>
                    {[v.c25, v.c50, v.c75, v.c100].map((c, i) => (
                      <span key={i}>
                        <span className={m.pozo}>
                          <i style={{ height: `${Math.min(100, (c / r) * 100)}%` }} />
                        </span>
                        <em>{['25', '50', '75', 'fin'][i]}</em>
                      </span>
                    ))}
                    <b>{Math.min(100, Math.round((v.c100 / r) * 100))} % lo termina</b>
                  </span>
                  <span>{v.reproducciones ? minutos(v.segundos / v.reproducciones) : '—'}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={m.vacio}>Todavía nadie ha visto un vídeo de la web con sonido.</p>
        )}
      </section>

      {/* ---------- Aula ---------- */}
      {datos?.aula && (
        <section className={m.tarjeta}>
          <header className={m.cabecera}>
            <h3>Tus alumnas en el aula</h3>
            <span className={m.nota}>{datos.aula.alumnas.length} con acceso · {datos.aula.totalClases} clases publicadas</span>
          </header>
          <div className={m.rejillaAula}>
            <div>
              <h4 className={m.subtitulo}>Por clase</h4>
              <ul className={m.lecciones}>
                {datos.aula.lecciones.map((l) => (
                  <li key={l.id}>
                    <strong>{l.titulo}</strong>
                    <span>
                      {l.empezadas} la han empezado · {l.completadas} terminado{l.minutosMedios ? ` · ${l.minutosMedios} min de media` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className={m.subtitulo}>Por alumna</h4>
              {datos.aula.alumnas.length ? (
                <ul className={m.alumnas}>
                  {datos.aula.alumnas.map((al) => {
                    const pct = datos.aula!.totalClases ? Math.round((al.completadas / datos.aula!.totalClases) * 100) : 0;
                    return (
                      <li key={al.uid}>
                        <span className={m.inicial}>{al.nombre.slice(0, 1).toUpperCase()}</span>
                        <span className={m.alumnaTexto}>
                          <strong>{al.nombre}</strong>
                          <em>
                            {al.completadas} de {datos.aula!.totalClases} clases · {al.minutos} min · {cuando(al.ultima)}
                          </em>
                        </span>
                        <span className={m.alumnaBarra}>
                          <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100 }} transition={{ duration: 0.7 }} />
                        </span>
                        <b>{pct} %</b>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={m.vacio}>Todavía no hay alumnas con acceso.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
