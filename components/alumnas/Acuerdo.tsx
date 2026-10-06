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
import { PREFIJOS, regionProbable, telefonoCompleto } from '@/lib/prefijos';
import InfoPrivacidad from '@/components/InfoPrivacidad';
import { CAPA_ACUERDO } from '@/lib/privacidad';
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

/**
 * El envío, con un segundo intento.
 *
 * Una firma se manda UNA vez y desde un móvil, muchas veces con la cobertura
 * justa. Si el primer intento se cae por red, perder el acuerdo entero y
 * enseñar un error es desproporcionado: se espera un segundo y se reintenta.
 *
 * Solo se reintenta lo que se ha caído sin llegar —un `fetch` que lanza—. Una
 * respuesta del servidor, aunque sea un error, NO se reintenta: si ha llegado
 * y ha dicho que no, repetirlo no cambia nada y arriesga guardar dos veces.
 */
async function enviarConReintento(cuerpo: unknown): Promise<Response> {
  const peticion = () =>
    fetch('/api/acuerdos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  try {
    return await peticion();
  } catch {
    await new Promise((r) => setTimeout(r, 1200));
    return peticion();
  }
}

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
  /* Documento de cualquier país: DNI, cédula, pasaporte. Sorela forma en
     todo el mundo y pedir un DNI español dejaba fuera a quien no lo tiene. */
  { clave: 'documento', etiqueta: 'Documento de identidad o pasaporte', ejemplo: 'Número del documento', tipo: 'text', completar: 'off' },
  { clave: 'correo', etiqueta: 'Correo', ejemplo: 'maria@ejemplo.com', tipo: 'email', completar: 'email' },
  { clave: 'telefono', etiqueta: 'Teléfono', ejemplo: '300 123 4567', tipo: 'tel', completar: 'tel-national' },
];

export default function Acuerdo() {
  const [abierto, setAbierto] = useState(false);
  /* El país del teléfono. Se propone por el idioma del móvil al abrir la
     página —en el servidor no se sabe—, y se cambia con un toque. */
  const [region, setRegion] = useState('ES');
  /* Que ha leído la información de protección de datos. Va en el primer paso,
     ANTES de enviar nada: es cuando la ley dice que hay que informar. */
  const [privacidad, setPrivacidad] = useState(false);
  useEffect(() => setRegion(regionProbable()), []);
  /** Los datos con el teléfono ya con su prefijo: lo que se revisa y se envía. */
  const completos = (): DatosAcuerdo => ({ ...datos, telefono: telefonoCompleto(region, datos.telefono) });
  const [paso, setPaso] = useState<Paso>(0);
  const [datos, setDatos] = useState<DatosAcuerdo>(VACIO);
  const [aceptadas, setAceptadas] = useState<number[]>([]);
  const [errores, setErrores] = useState<ErroresAcuerdo>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const [hecho, setHecho] = useState<{ referencia: string; firmadoEl: string; dossier: string } | null>(null);

  /** El señuelo para robots. Una persona no lo ve y no lo rellena. */
  const [empresa, setEmpresa] = useState('');

  const poner = (clave: keyof DatosAcuerdo, valor: string) => {
    setDatos((d) => ({ ...d, [clave]: valor }));
    setErrores((e) => ({ ...e, [clave]: undefined }));
  };

  const cerrar = useCallback(() => {
    setAbierto(false);
    /* No se borra lo escrito al cerrar: quien sale a mirar su documento vuelve y se
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
      const e = revisarAcuerdo({ ...completos(), firma: 'x'.repeat(2100), lugar: 'x' }, CLAUSULAS.length);
      /* En este paso solo importan los campos de este paso. */
      const soloDatos: ErroresAcuerdo = {};
      for (const { clave } of CAMPOS) if (e[clave]) soloDatos[clave] = e[clave];
      if (!privacidad) soloDatos.privacidad = 'Marca la casilla para seguir.';
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
    const e = revisarAcuerdo(completos(), aceptadas.length);
    if (Object.keys(e).length > 0) {
      setErrores(e);
      /* Si lo que falta está en un paso anterior, se vuelve a él: dejar a
         alguien en la pantalla de la firma con un error de su documento es dejarla
         sin saber qué hacer. */
      if (CAMPOS.some(({ clave }) => e[clave])) setPaso(0);
      else if (e.clausulas) setPaso(1);
      return;
    }

    setEnviando(true);
    setFallo('');
    try {
      const r = await enviarConReintento({ ...completos(), empresa, clausulas: aceptadas, privacidad });

      /*
       * La respuesta se lee como TEXTO y se intenta interpretar después.
       *
       * Llamar directo a `r.json()` parecía más corto y escondía el único fallo
       * que de verdad importa: cuando algo va mal por encima de la aplicación
       * —la ruta no está desplegada, la función revienta al arrancar, el
       * servidor devuelve su propia página de error— lo que llega es HTML, y
       * `r.json()` revienta con una excepción que acababa contada como «revisa
       * tu conexión». Decirle a alguien que mire su wifi cuando el problema
       * está en el servidor es mandarla a buscar donde no hay nada.
       */
      const crudo = await r.text();
      let c: Record<string, unknown> | null = null;
      try {
        c = JSON.parse(crudo) as Record<string, unknown>;
      } catch {
        c = null;
      }

      if (!c) {
        setFallo(
          `El servidor no ha respondido bien (error ${r.status}). No es cosa tuya: avisa a Sorela con este número.`
        );
        return;
      }

      if (!r.ok || !c.ok) {
        const errs = c.errores as ErroresAcuerdo | undefined;
        if (errs) {
          setErrores(errs);
          if (CAMPOS.some(({ clave }) => errs[clave]) || errs.privacidad) setPaso(0);
          else if (errs.firma) setPaso(2);
        } else if (c.motivo === 'demasiado-rapido') {
          setFallo('Has enviado varios seguidos. Espera un momento y vuelve a intentarlo.');
        } else if (c.motivo === 'sin-base') {
          setFallo('El registro está caído ahora mismo. Avisa a Sorela: le falta la configuración.');
        } else {
          setFallo(`No se ha podido guardar (${c.motivo ?? r.status}). Vuelve a intentarlo.`);
        }
        return;
      }

      setHecho({
        referencia: String(c.referencia),
        firmadoEl: String(c.firmadoEl),
        dossier: String(c.dossier ?? ''),
      });
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
                  <li
                    key={p}
                    className={css.paso}
                    data-estado={i < paso ? 'hecho' : i === paso ? 'ahora' : undefined}
                    aria-current={i === paso ? 'step' : undefined}
                  >
                    {/* Número, o una marca si ya está hecho: se ve de un
                        vistazo cuánto falta, que es lo que tranquiliza. */}
                    <span className={css.pasoNum} aria-hidden="true">
                      {i < paso ? '✓' : i + 1}
                    </span>
                    <span className={css.pasoTexto}>{p}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className={css.cuerpo}>
              {paso === 0 && (
                <Datos
                  datos={datos}
                  errores={errores}
                  poner={poner}
                  region={region}
                  setRegion={setRegion}
                  privacidad={privacidad}
                  setPrivacidad={(v) => {
                    setPrivacidad(v);
                    setErrores((e) => ({ ...e, privacidad: undefined }));
                  }}
                />
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
  region,
  setRegion,
  privacidad,
  setPrivacidad,
}: {
  datos: DatosAcuerdo;
  errores: ErroresAcuerdo;
  poner: (c: keyof DatosAcuerdo, v: string) => void;
  region: string;
  setRegion: (r: string) => void;
  privacidad: boolean;
  setPrivacidad: (v: boolean) => void;
}) {
  const nombre = nombreCompleto(datos);

  return (
    <>
      <h2 className={css.titulo}>Tus datos</h2>
      <div className={css.campos}>
        {CAMPOS.map(({ clave, etiqueta, ejemplo, tipo, completar }) =>
          clave === 'telefono' ? (
            <div key={clave} className={css.campo}>
              <label className={css.etiqueta} htmlFor="acuerdo-telefono">
                {etiqueta}
              </label>
              {/* El país va en un desplegable aparte del número: así nadie
                  tiene que saberse su prefijo, y un número escrito con su
                  «+» delante se respeta tal cual. */}
              <div className={css.telefono}>
                <select
                  className={`${css.entrada} ${css.prefijo}`}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  aria-label="País del teléfono"
                  disabled={datos.telefono.trim().startsWith('+')}
                >
                  {PREFIJOS.map((p) => (
                    <option key={p.region} value={p.region}>
                      {p.bandera} {p.prefijo} · {p.pais}
                    </option>
                  ))}
                </select>
                <input
                  id="acuerdo-telefono"
                  type="tel"
                  inputMode="tel"
                  value={datos.telefono}
                  placeholder={ejemplo}
                  autoComplete={completar}
                  onChange={(e) => poner('telefono', e.target.value)}
                  aria-invalid={errores.telefono ? true : undefined}
                  className={css.entrada}
                />
              </div>
              <span className={css.error}>{errores.telefono ?? ''}</span>
            </div>
          ) : (
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
          )
        )}
      </div>

      {/* La vista previa. Lo que se firma se ve antes de firmarlo: un documento
          que solo se enseña después de aceptar no se ha enseñado. */}
      <div className={css.vista}>
        <span className={css.vistaRotulo}>Vista previa</span>
        <p className={css.vistaTexto}>
          Celebran de una parte la alumna{' '}
          <mark className={css.hueco}>{nombre || '________'}</mark> con documento{' '}
          <mark className={css.hueco}>{datos.documento || '________'}</mark> y de otra parte la
          formadora <strong>Sorela Caro</strong>, ambas mayores de edad y con capacidad de obrar, a
          tenor de las declaraciones y las cláusulas siguientes.
        </p>
      </div>

      <label className={css.casilla}>
        <input
          type="checkbox"
          checked={privacidad}
          onChange={(e) => setPrivacidad(e.target.checked)}
          aria-invalid={errores.privacidad ? true : undefined}
        />
        <span>
          He leído la información sobre protección de datos y sé para qué se usan los datos de este
          acuerdo.
        </span>
      </label>
      {errores.privacidad && <span className={css.error}>{errores.privacidad}</span>}
      <InfoPrivacidad capa={CAPA_ACUERDO} claro />
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

  /**
   * La firma sale del lienzo REDUCIDA a un ancho fijo.
   *
   * El lienzo se dibuja a la densidad real de la pantalla para que el trazo no
   * salga borroso, y en un móvil moderno eso son tres píxeles por punto: una
   * imagen enorme para lo que es un garabato. Enviarla tal cual significa un
   * envío de varios cientos de kilobytes desde una conexión móvil, que es
   * justo donde más se cae. A 1000 píxeles de ancho la firma se lee
   * perfectamente —se imprime a 85 mm— y el envío baja de forma brutal.
   */
  function terminar() {
    if (!pintando.current) return;
    pintando.current = false;
    const c = lienzo.current;
    if (!c) return;

    const ANCHO = 1000;
    if (c.width <= ANCHO) return alFirmar(c.toDataURL('image/png'));

    const pequeno = document.createElement('canvas');
    pequeno.width = ANCHO;
    pequeno.height = Math.round((c.height / c.width) * ANCHO);
    const ctx = pequeno.getContext('2d');
    if (!ctx) return alFirmar(c.toDataURL('image/png'));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, pequeno.width, pequeno.height);
    alFirmar(pequeno.toDataURL('image/png'));
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
      <h2 className={css.titulo}>Tu firma</h2>
      <p className={css.explica}>Último paso. Escribe dónde estás y firma en el recuadro.</p>

      <label className={css.campo} style={{ maxWidth: 360 }}>
        <span className={css.etiqueta}>Lugar de firma</span>
        <input
          type="text"
          value={datos.lugar}
          placeholder="Ciudad donde firmas"
          onChange={(e) => poner('lugar', e.target.value)}
          aria-invalid={errores.lugar ? true : undefined}
          className={css.entrada}
        />
        <span className={css.error}>{errores.lugar ?? ''}</span>
      </label>

      {/* La instrucción va pegada al recuadro y no en un párrafo suelto:
          quien firma desde el móvil mira el recuadro, no el texto de arriba. */}
      <div className={css.firmaCabeza}>
        <span className={css.etiqueta}>Firma</span>
        <span className={css.firmaComo}>Con el dedo o con el ratón, dentro del recuadro</span>
      </div>

      <div className={css.marco} data-firmado={hayTrazo ? '' : undefined}>
        <canvas
          ref={lienzo}
          className={css.lienzo}
          onPointerDown={empezar}
          onPointerMove={seguir}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          aria-label="Dibuja aquí tu firma"
        />
        {!hayTrazo && (
          <span className={css.pista}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M3 17c3-4 5-9 7-9s-1 9 1 9 3-5 5-5 1 4 3 4h2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Firma aquí
          </span>
        )}
        <span className={css.raya} aria-hidden="true" />
      </div>

      <div className={css.firmaPie}>
        {/* Se dice cuándo la firma ya vale. Sin esto, quien firma no sabe si
            su garabato ha quedado guardado o tiene que hacer algo más. */}
        {errores.firma ? (
          <span className={css.error}>{errores.firma}</span>
        ) : hayTrazo ? (
          <span className={css.firmaLista}>✓ Firma lista. Pulsa «Firmar y enviar».</span>
        ) : (
          <span className={css.firmaNota}>La fecha y la hora las pone el sistema al enviar.</span>
        )}
        <button type="button" className={css.borrar} onClick={borrar} disabled={!hayTrazo}>
          Borrar y repetir
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
  hecho: { referencia: string; firmadoEl: string; dossier: string };
}) {
  return (
    <div className={css.gracias}>
      <span className={css.check} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={css.sello}>Acuerdo firmado</span>
      <h2 className={css.graciasTitulo}>Gracias, {datos.nombre}.</h2>
      <p className={css.graciasTexto}>
        Tu acuerdo queda registrado el {fechaLarga(hecho.firmadoEl)}. En unos minutos te llega a{' '}
        <strong>{datos.correo}</strong> un correo con <strong>tu acuerdo firmado</strong> y{' '}
        <strong>tu dossier</strong>. Si no lo ves, mira en la carpeta de spam.
      </p>

      {/* El dossier se abre AQUÍ MISMO, sin esperar al correo. El correo
          llega, pero depende de Google, de la cobertura y de la carpeta de
          promociones; esto no depende de nada. */}
      {hecho.dossier && (
        <a className={css.dossier} href={hecho.dossier} target="_blank" rel="noreferrer">
          Abrir mi dossier
        </a>
      )}
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
