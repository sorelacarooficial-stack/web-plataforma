'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CIERRE_ACUERDO,
  CLAUSULAS,
  TITULO_ACUERDO,
  fechaLarga,
  nombreCompleto,
  revisarAcuerdo,
  type DatosAcuerdo,
  type ErroresAcuerdo,
} from '@/lib/acuerdo';
import css from './acuerdo.module.css';

/**
 * El acuerdo de confidencialidad, firmado en pantalla.
 *
 * Tres pasos y un final: los datos, las cláusulas una a una, el lugar y la
 * firma. Y después la referencia, que es lo que ella puede citar.
 *
 * POR QUÉ LAS CLÁUSULAS SE ACEPTAN DE UNA EN UNA. Una sola casilla de «he
 * leído y acepto» no demuestra que nadie haya leído nada, y en un documento
 * que se firma eso es justo lo que hay que poder demostrar. Tocando cada
 * cláusula, quien firma ha tenido delante cada una de las tres. Hay un botón
 * de «aceptar todas» porque negárselo a quien ya las ha leído es tratarla como
 * tonta; lo que no hay es una casilla única por defecto.
 *
 * LA FIRMA SE DIBUJA EN UN LIENZO, y el lienzo se dimensiona en píxeles
 * reales. Si se deja que el navegador lo estire con CSS, el trazo sale borroso
 * en cualquier pantalla moderna y, peor, las coordenadas del dedo dejan de
 * corresponderse con el punto donde se pinta.
 */

type Paso = 0 | 1 | 2 | 3;

const PASOS = ['Tus datos', 'Cláusulas', 'Firma'] as const;

const VACIO: DatosAcuerdo = {
  nombre: '',
  apellidos: '',
  documento: '',
  correo: '',
  telefono: '',
  lugar: '',
  firma: '',
};

const CAMPOS: {
  clave: keyof DatosAcuerdo;
  etiqueta: string;
  ejemplo: string;
  tipo: string;
  completar: string;
}[] = [
  { clave: 'nombre', etiqueta: 'Nombre', ejemplo: 'María José', tipo: 'text', completar: 'given-name' },
  { clave: 'apellidos', etiqueta: 'Apellidos', ejemplo: 'Pardo Ruiz', tipo: 'text', completar: 'family-name' },
  { clave: 'documento', etiqueta: 'DNI o NIE', ejemplo: '12345678Z', tipo: 'text', completar: 'off' },
  { clave: 'correo', etiqueta: 'Correo', ejemplo: 'maria@ejemplo.com', tipo: 'email', completar: 'email' },
  { clave: 'telefono', etiqueta: 'Teléfono', ejemplo: '600 00 00 00', tipo: 'tel', completar: 'tel' },
];

export default function Acuerdo() {
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>(0);
  const [datos, setDatos] = useState<DatosAcuerdo>(VACIO);
  const [aceptadas, setAceptadas] = useState<number[]>([]);
  const [errores, setErrores] = useState<ErroresAcuerdo>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const [hecho, setHecho] = useState<{ referencia: string; firmadoEl: string } | null>(null);

  /** El señuelo para robots. Una persona no lo ve y no lo rellena. */
  const [empresa, setEmpresa] = useState('');

  const poner = (clave: keyof DatosAcuerdo, valor: string) => {
    setDatos((d) => ({ ...d, [clave]: valor }));
    setErrores((e) => ({ ...e, [clave]: undefined }));
  };

  const cerrar = useCallback(() => {
    setAbierto(false);
    /* No se borra lo escrito al cerrar: quien sale a mirar su DNI vuelve y se
       lo encuentra puesto. Solo se limpia al terminar de firmar. */
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', tecla);
    /* Se bloquea el desplazamiento de detrás: si no, al llegar al final del
       acuerdo sigue bajando la página entera por debajo. */
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [abierto, cerrar]);

  function siguiente() {
    if (paso === 0) {
      const e = revisarAcuerdo({ ...datos, firma: 'x'.repeat(2100), lugar: 'x' }, CLAUSULAS.length);
      /* En este paso solo importan los campos de este paso. */
      const soloDatos: ErroresAcuerdo = {};
      for (const { clave } of CAMPOS) if (e[clave]) soloDatos[clave] = e[clave];
      if (Object.keys(soloDatos).length > 0) return setErrores(soloDatos);
      return setPaso(1);
    }
    if (paso === 1) {
      if (aceptadas.length < CLAUSULAS.length) {
        return setErrores({ clausulas: 'Tienes que aceptar las tres cláusulas.' });
      }
      setErrores({});
      return setPaso(2);
    }
  }

  async function firmar() {
    const e = revisarAcuerdo(datos, aceptadas.length);
    if (Object.keys(e).length > 0) {
      setErrores(e);
      /* Si lo que falta está en un paso anterior, se vuelve a él: dejar a
         alguien en la pantalla de la firma con un error de su DNI es dejarla
         sin saber qué hacer. */
      if (CAMPOS.some(({ clave }) => e[clave])) setPaso(0);
      else if (e.clausulas) setPaso(1);
      return;
    }

    setEnviando(true);
    setFallo('');
    try {
      const r = await fetch('/api/acuerdos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datos,
          empresa,
          clausulas: aceptadas,
        }),
      });
      const c = await r.json();
      if (!r.ok || !c.ok) {
        if (c.errores) {
          setErrores(c.errores);
          if (CAMPOS.some(({ clave }) => c.errores[clave])) setPaso(0);
        } else {
          setFallo(
            c.motivo === 'demasiado-rapido'
              ? 'Has enviado varios seguidos. Espera un momento y vuelve a intentarlo.'
              : 'No se ha podido guardar. Vuelve a intentarlo en un minuto.'
          );
        }
        return;
      }
      setHecho({ referencia: c.referencia, firmadoEl: c.firmadoEl });
      setPaso(3);
    } catch {
      setFallo('No se ha podido guardar. Revisa tu conexión y vuelve a intentarlo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" className={css.llamada} onClick={() => setAbierto(true)}>
        Firmar el acuerdo
      </button>

      {abierto && (
        <div
          className={css.fondo}
          role="dialog"
          aria-modal="true"
          aria-label="Acuerdo de confidencialidad"
        >
          <div className={css.hoja}>
            <header className={css.cabecera}>
              <span className={css.identidad}>
                <span className={css.tituloDoc}>Acuerdo de confidencialidad</span>
                <span className={css.subtitulo}>Técnica Divine · Sorela Caro</span>
              </span>
              <button
                type="button"
                className={css.cerrar}
                onClick={cerrar}
                aria-label="Cerrar el acuerdo"
              >
                ✕
              </button>
            </header>

            {paso < 3 && (
              <ol className={css.pasos}>
                {PASOS.map((p, i) => (
                  <li key={p} className={css.paso} data-estado={i < paso ? 'hecho' : i === paso ? 'ahora' : undefined}>
                    <span className={css.pasoBarra} />
                    <span className={css.pasoTexto}>{p}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className={css.cuerpo}>
              {paso === 0 && (
                <Datos datos={datos} errores={errores} poner={poner} />
              )}

              {paso === 1 && (
                <Clausulas
                  aceptadas={aceptadas}
                  error={errores.clausulas}
                  alternar={(i) => {
                    setErrores((e) => ({ ...e, clausulas: undefined }));
                    setAceptadas((a) => (a.includes(i) ? a.filter((x) => x !== i) : [...a, i]));
                  }}
                  todas={() => {
                    setErrores((e) => ({ ...e, clausulas: undefined }));
                    setAceptadas(CLAUSULAS.map((_, i) => i));
                  }}
                />
              )}

              {paso === 2 && (
                <Firma
                  datos={datos}
                  errores={errores}
                  poner={poner}
                  alFirmar={(png) => {
                    setDatos((d) => ({ ...d, firma: png }));
                    setErrores((e) => ({ ...e, firma: undefined }));
                  }}
                />
              )}

              {paso === 3 && hecho && <Gracias datos={datos} hecho={hecho} />}
            </div>

            {paso < 3 && (
              <footer className={css.pie}>
                {fallo && (
                  <p className={css.fallo} role="alert">
                    {fallo}
                  </p>
                )}
                <div className={css.botones}>
                  {paso > 0 && (
                    <button
                      type="button"
                      className={css.atras}
                      onClick={() => setPaso((p) => (p - 1) as Paso)}
                    >
                      Atrás
                    </button>
                  )}
                  {paso < 2 ? (
                    <button type="button" className={css.avanzar} onClick={siguiente}>
                      Continuar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={css.avanzar}
                      onClick={firmar}
                      disabled={enviando}
                    >
                      {enviando ? 'Firmando…' : 'Firmar y enviar'}
                    </button>
                  )}
                </div>
              </footer>
            )}

            {/* Fuera de la vista y fuera del tabulador, pero NO con
                display:none: hay robots que se saltan lo que está oculto de
                esa manera. */}
            <input
              type="text"
              name="empresa"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ==========================================================================
   Paso 1 · Los datos
   ========================================================================== */

function Datos({
  datos,
  errores,
  poner,
}: {
  datos: DatosAcuerdo;
  errores: ErroresAcuerdo;
  poner: (c: keyof DatosAcuerdo, v: string) => void;
}) {
  const nombre = nombreCompleto(datos);

  return (
    <>
      <h2 className={css.titulo}>Tus datos</h2>
      <div className={css.campos}>
        {CAMPOS.map(({ clave, etiqueta, ejemplo, tipo, completar }) => (
          <label key={clave} className={css.campo}>
            <span className={css.etiqueta}>{etiqueta}</span>
            <input
              type={tipo}
              value={datos[clave]}
              placeholder={ejemplo}
              autoComplete={completar}
              autoCapitalize={clave === 'correo' ? 'none' : 'words'}
              onChange={(e) => poner(clave, e.target.value)}
              aria-invalid={errores[clave] ? true : undefined}
              className={css.entrada}
            />
            <span className={css.error}>{errores[clave] ?? ''}</span>
          </label>
        ))}
      </div>

      {/* La vista previa. Lo que se firma se ve antes de firmarlo: un documento
          que solo se enseña después de aceptar no se ha enseñado. */}
      <div className={css.vista}>
        <span className={css.vistaRotulo}>Vista previa</span>
        <p className={css.vistaTexto}>
          Celebran de una parte la alumna{' '}
          <mark className={css.hueco}>{nombre || '________'}</mark> con DNI{' '}
          <mark className={css.hueco}>{datos.documento || '________'}</mark> y de otra parte la
          formadora <strong>Sorela Caro</strong>, ambas mayores de edad y con capacidad de obrar, a
          tenor de las declaraciones y las cláusulas siguientes.
        </p>
      </div>
    </>
  );
}

/* ==========================================================================
   Paso 2 · Las cláusulas
   ========================================================================== */

function Clausulas({
  aceptadas,
  error,
  alternar,
  todas,
}: {
  aceptadas: number[];
  error?: string;
  alternar: (i: number) => void;
  todas: () => void;
}) {
  return (
    <>
      <h2 className={css.titulo}>Cláusulas</h2>
      <p className={css.explica}>
        Lee cada una y tócala para aceptarla. <strong>DIVULGANTE</strong>: la formadora.{' '}
        <strong>RECEPTOR</strong>: la alumna.
      </p>

      <ul className={css.clausulas}>
        {CLAUSULAS.map((c, i) => {
          const si = aceptadas.includes(i);
          return (
            <li key={c.orden}>
              <button
                type="button"
                className={css.clausula}
                data-si={si ? '' : undefined}
                onClick={() => alternar(i)}
                aria-pressed={si}
              >
                <span className={css.clausulaCuerpo}>
                  <span className={css.clausulaOrden}>
                    {c.orden} · {c.titulo}
                  </span>
                  {c.parrafos.map((p, j) => (
                    <span key={j} className={css.clausulaTexto}>
                      {p}
                    </span>
                  ))}
                </span>
                <span className={css.marca} aria-hidden="true">
                  {si ? '✓' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className={css.fallo} role="alert">
          {error}
        </p>
      )}

      <button type="button" className={css.todas} onClick={todas}>
        Aceptar todas
      </button>
    </>
  );
}

/* ==========================================================================
   Paso 3 · Lugar y firma
   ========================================================================== */

function Firma({
  datos,
  errores,
  poner,
  alFirmar,
}: {
  datos: DatosAcuerdo;
  errores: ErroresAcuerdo;
  poner: (c: keyof DatosAcuerdo, v: string) => void;
  alFirmar: (png: string) => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const pintando = useRef(false);
  const [hayTrazo, setHayTrazo] = useState(false);

  /*
   * El lienzo se dimensiona en píxeles REALES de la pantalla.
   *
   * Dejando que el navegador estire un lienzo pequeño con CSS pasan dos cosas:
   * el trazo sale borroso en cualquier pantalla de densidad alta, y —peor— las
   * coordenadas del dedo dejan de corresponderse con el punto donde se pinta,
   * así que la firma aparece desplazada de donde se está tocando.
   */
  useEffect(() => {
    const c = lienzo.current;
    if (!c) return;
    const ajustar = () => {
      const caja = c.getBoundingClientRect();
      const densidad = window.devicePixelRatio || 1;
      c.width = Math.round(caja.width * densidad);
      c.height = Math.round(caja.height * densidad);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.scale(densidad, densidad);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#141210';
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caja.left, y: e.clientY - caja.top };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = lienzo.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    pintando.current = true;
  }

  function seguir(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pintando.current) return;
    const ctx = lienzo.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hayTrazo) setHayTrazo(true);
  }

  function terminar() {
    if (!pintando.current) return;
    pintando.current = false;
    const c = lienzo.current;
    if (c) alFirmar(c.toDataURL('image/png'));
  }

  function borrar() {
    const c = lienzo.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
    alFirmar('');
  }

  return (
    <>
      <h2 className={css.titulo}>Lugar y firma</h2>

      <label className={css.campo} style={{ maxWidth: 320 }}>
        <span className={css.etiqueta}>Lugar de firma</span>
        <input
          type="text"
          value={datos.lugar}
          placeholder="Valencia"
          onChange={(e) => poner('lugar', e.target.value)}
          aria-invalid={errores.lugar ? true : undefined}
          className={css.entrada}
        />
        <span className={css.error}>{errores.lugar ?? ''}</span>
      </label>

      <p className={css.explica}>
        Firma con el dedo o con el ratón. La fecha la pone el sistema al enviarlo.
      </p>

      <div className={css.marco}>
        <canvas
          ref={lienzo}
          className={css.lienzo}
          onPointerDown={empezar}
          onPointerMove={seguir}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          aria-label="Dibuja aquí tu firma"
        />
        {!hayTrazo && <span className={css.pista}>Firma aquí</span>}
        <span className={css.raya} aria-hidden="true" />
      </div>

      <div className={css.firmaPie}>
        <span className={css.error}>{errores.firma ?? ''}</span>
        <button type="button" className={css.borrar} onClick={borrar}>
          Borrar
        </button>
      </div>

      <p className={css.legal}>{CIERRE_ACUERDO}</p>
    </>
  );
}

/* ==========================================================================
   Final
   ========================================================================== */

function Gracias({
  datos,
  hecho,
}: {
  datos: DatosAcuerdo;
  hecho: { referencia: string; firmadoEl: string };
}) {
  return (
    <div className={css.gracias}>
      <span className={css.sello}>Acuerdo firmado</span>
      <h2 className={css.graciasTitulo}>Gracias, {datos.nombre}.</h2>
      <p className={css.graciasTexto}>
        Queda registrado el {fechaLarga(hecho.firmadoEl)}. Sorela lo recibe en su plataforma y te
        escribe para darte acceso al dossier y a tu espacio de alumna.
      </p>
      <p className={css.referencia}>
        <span>Tu referencia</span>
        <strong>{hecho.referencia}</strong>
      </p>
      <p className={css.graciasFino}>
        Guárdala. Es lo que tienes que citar si alguna vez hay que localizar tu acuerdo.
      </p>
      <p className={css.legal}>{TITULO_ACUERDO}.</p>
    </div>
  );
}
