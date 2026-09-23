'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import css from './plataforma.module.css';

/**
 * La facturación de Sorela, dentro de la plataforma.
 *
 * Aquí no hay nada de mentira: ni una factura de ejemplo, ni un «facturado
 * este mes: 3.400 €» de maqueta. El negocio acaba de abrir y lo que se ve es
 * lo que hay en Firestore, que de salida es cero.
 *
 * Tres cosas que conviene saber antes de tocar este fichero:
 *
 * 1. Todos los importes viajan del servidor en CÉNTIMOS ENTEROS (los campos
 *    terminan en Cent). Se dividen entre 100 solo en el momento de pintarlos.
 *    Eso evita que un 21 % de 33,33 € acabe siendo 6,999299999999999.
 *
 * 2. El total que se ve mientras escribe es una PREVISIÓN calculada igual que
 *    en el servidor, pero la cifra buena es la que devuelve el servidor al
 *    emitir. Por eso, después de emitir, se recarga la lista entera en vez de
 *    añadir a mano la factura recién creada.
 *
 * 3. El PDF lo hace el navegador. La vista imprimible se saca del árbol de la
 *    plataforma con un portal para que cuelgue directamente del <body>: así la
 *    regla de @media print puede apagar a sus hermanos —la barra lateral, el
 *    menú, los formularios— y dejar en el papel solo la factura. Generar el
 *    PDF en el servidor obligaría a meter una librería entera para algo que
 *    «Imprimir → Guardar como PDF» ya hace bien.
 */

/* ==========================================================================
   Lo que llega del servidor
   ========================================================================== */

type Parte = { nombre: string; nif: string; direccion: string };

type Linea = { concepto: string; cantidad: number; precioCent: number; importeCent: number };

type Estado = 'Pendiente' | 'Cobrada';

type Factura = {
  id: string;
  numero: string;
  serie: string;
  fecha: string;
  emisor: Parte;
  cliente: Parte;
  lineas: Linea[];
  ivaPorcentaje: number;
  irpfPorcentaje: number;
  baseCent: number;
  ivaCent: number;
  irpfCent: number;
  totalCent: number;
  nota: string;
  estado: Estado;
  creado: string | null;
};

type Fiscales = { nombre: string; nif: string; direccion: string; serie: string };

type Trimestre = {
  etiqueta: string;
  desde: string;
  hasta: string;
  cuantas: number;
  baseCent: number;
  ivaCent: number;
  irpfCent: number;
  totalCent: number;
  cobradoCent: number;
  pendienteCent: number;
};

type Datos = {
  facturas: Factura[];
  fiscales: Fiscales | null;
  trimestre: Trimestre;
  hoy: string;
};

/* ==========================================================================
   Formatos
   ========================================================================== */

/* Se crea una vez y se reutiliza: construir un Intl.NumberFormat por cada
   importe de la tabla es caro y no hace falta. */
const EUROS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** Céntimos enteros a «1.234,56 €». */
function euros(cent: number): string {
  return EUROS.format(cent / 100);
}

/**
 * '2026-09-23' a «23 de septiembre de 2026».
 *
 * Se construye y se formatea en UTC a propósito. Si se hiciera con la hora
 * local, un '2026-09-23' se leería como medianoche UTC y en cualquier huso al
 * oeste de Greenwich la factura aparecería fechada el día 22.
 */
function fechaLarga(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('es-ES', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fechaCorta(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('es-ES', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Un número escrito a mano, con coma o con punto. NaN si no vale. */
function numero(v: string): number {
  return Number(String(v).replace(',', '.').trim());
}

/** Euros escritos a mano, en céntimos enteros. Misma cuenta que en el servidor. */
function aCent(v: string): number {
  const n = numero(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

/* Los distintivos ya existen en la plataforma: lo pendiente destaca en tinta,
   lo cobrado se queda tranquilo en oro. */
const CLASE_ESTADO: Record<Estado, string> = {
  Pendiente: css.estadoTinta,
  Cobrada: css.estadoOro,
};

/* ==========================================================================
   Piezas sueltas
   ========================================================================== */

/* Definido fuera del componente grande a propósito: un componente declarado
   dentro se vuelve a crear en cada render y React desmonta el <input>, con lo
   que se pierde el cursor a cada tecla. */
function Campo({
  etiqueta,
  valor,
  cambia,
  ...resto
}: {
  etiqueta: string;
  valor: string;
  cambia: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className={css.etiquetaCampo}>
      {etiqueta}
      <input
        className={css.campoCaja}
        value={valor}
        onChange={(e) => cambia(e.target.value)}
        {...resto}
      />
    </label>
  );
}

/** Una fila del bloque de totales de la hoja impresa. */
function FilaTotal({ que, cuanto, fuerte }: { que: string; cuanto: string; fuerte?: boolean }) {
  return (
    <div className={`${css.hojaTotalFila} ${fuerte ? css.hojaTotalFinal : ''}`}>
      <span>{que}</span>
      <span>{cuanto}</span>
    </div>
  );
}

/**
 * La factura tal y como sale por la impresora.
 *
 * Lleva todo lo que la ley exige que aparezca: serie y número, fecha, emisor
 * con NIF y domicilio, destinatario, el detalle de lo facturado, la base, el
 * tipo de IVA con su cuota, la retención si la hay y el total.
 */
function Hoja({ factura, cerrar }: { factura: Factura; cerrar: () => void }) {
  return (
    <div className={css.hoja}>
      <div className={css.sinImprimir}>
        <button type="button" className={css.btnLinea} onClick={cerrar}>
          Cerrar
        </button>
        <button type="button" className={css.btn} onClick={() => window.print()}>
          Imprimir o guardar en PDF
        </button>
      </div>

      <article className={css.hojaPapel}>
        <header className={css.hojaCabecera}>
          <div>
            <span className={css.hojaTitulo}>{factura.emisor.nombre}</span>
            <p className={css.hojaLineas}>
              NIF {factura.emisor.nif}
              <br />
              {factura.emisor.direccion}
            </p>
          </div>
          <div className={css.hojaDerecha}>
            <span className={css.hojaRotulo}>Factura</span>
            <p className={css.hojaNumero}>{factura.numero}</p>
            <p className={css.hojaLineas}>{fechaLarga(factura.fecha)}</p>
          </div>
        </header>

        <section className={css.hojaPartes}>
          <div>
            <span className={css.hojaRotulo}>Destinatario</span>
            <p className={css.hojaLineas}>
              {factura.cliente.nombre}
              {factura.cliente.nif && (
                <>
                  <br />
                  NIF {factura.cliente.nif}
                </>
              )}
              {factura.cliente.direccion && (
                <>
                  <br />
                  {factura.cliente.direccion}
                </>
              )}
            </p>
          </div>
        </section>

        <table className={css.hojaTabla}>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col">Cantidad</th>
              <th scope="col">Precio</th>
              <th scope="col">Importe</th>
            </tr>
          </thead>
          <tbody>
            {factura.lineas.map((l, i) => (
              <tr key={`${l.concepto}-${i}`}>
                <td>{l.concepto}</td>
                <td>{l.cantidad.toLocaleString('es-ES')}</td>
                <td>{euros(l.precioCent)}</td>
                <td>{euros(l.importeCent)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={css.hojaTotales}>
          <FilaTotal que="Base imponible" cuanto={euros(factura.baseCent)} />
          <FilaTotal
            que={`IVA (${factura.ivaPorcentaje.toLocaleString('es-ES')} %)`}
            cuanto={euros(factura.ivaCent)}
          />
          {/* La retención solo se enseña cuando la hay: una línea de «IRPF 0 %»
              en una factura de quien no retiene solo confunde. */}
          {factura.irpfPorcentaje > 0 && (
            <FilaTotal
              que={`Retención IRPF (${factura.irpfPorcentaje.toLocaleString('es-ES')} %)`}
              cuanto={`−${euros(factura.irpfCent)}`}
            />
          )}
          <FilaTotal que="Total" cuanto={euros(factura.totalCent)} fuerte />
        </div>

        {factura.nota && <p className={css.hojaNota}>{factura.nota}</p>}

        <footer className={css.hojaPie}>
          Factura emitida por {factura.emisor.nombre}, NIF {factura.emisor.nif}. Serie{' '}
          {factura.serie}, número correlativo {factura.numero}.
          {factura.irpfPorcentaje > 0 &&
            ' El importe de la retención lo ingresa el destinatario en la Agencia Tributaria.'}
        </footer>
      </article>
    </div>
  );
}

/* ==========================================================================
   La pantalla
   ========================================================================== */

export default function FacturacionSorela() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Datos del emisor
  const [ficha, setFicha] = useState<Fiscales>({ nombre: '', nif: '', direccion: '', serie: 'A' });
  const [guardandoFicha, setGuardandoFicha] = useState(false);
  const [editandoFicha, setEditandoFicha] = useState(false);
  /* Si Sorela ya ha empezado a escribir sus datos, una recarga de la lista no
     se los puede pisar. Va en un ref y no en el estado para no tener que
     meterlo en las dependencias de `cargar`. */
  const fichaTocada = useRef(false);

  // Factura nueva
  const [cliente, setCliente] = useState<Parte>({ nombre: '', nif: '', direccion: '' });
  const [lineas, setLineas] = useState([{ concepto: '', cantidad: '1', precio: '' }]);
  const [iva, setIva] = useState('21');
  const [irpf, setIrpf] = useState('0');
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);
  /* El botón se apaga con `emitiendo`, pero eso no surte efecto hasta el
     siguiente pintado: dos clics muy seguidos entran los dos y emiten DOS
     facturas, con dos números correlativos gastados, por el mismo servicio. Y
     una factura emitida no se borra. El cerrojo va en un ref porque hay que
     leerlo y cerrarlo en el mismo instante, sin esperar a React. */
  const emitiendoYa = useRef(false);
  // null significa «no ha decidido»: entonces manda el valor por defecto.
  const [abierto, setAbierto] = useState<boolean | null>(null);

  const [imprimible, setImprimible] = useState<Factura | null>(null);

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const r = await fetch('/api/facturas');
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setFallo(
          c.motivo === 'sin-configurar'
            ? 'Falta la configuración de Firebase en el servidor.'
            : c.motivo === 'sin-permiso'
              ? 'La facturación solo la ve Sorela.'
              : 'No he podido cargar las facturas.'
        );
        return;
      }
      setDatos(c);
      if (c.fiscales && !fichaTocada.current) setFicha(c.fiscales);
      // La fecha por defecto la pone el servidor, que sabe qué día es en
      // España; el navegador podría estar en otro huso.
      setFecha((f) => f || c.hoy);
    } catch {
      setFallo('No hay conexión con el servidor.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Mientras la hoja está abierta, el <body> lleva una marca que la regla de
     impresión usa para apagar todo lo demás. Se quita al cerrar; si no, la
     próxima vez que imprimiera cualquier otra cosa saldría en blanco. */
  useEffect(() => {
    if (!imprimible) return;
    const cuerpo = document.body;
    const previo = cuerpo.style.overflow;
    cuerpo.classList.add(css.imprimiendoFactura);
    cuerpo.style.overflow = 'hidden';
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImprimible(null);
    };
    window.addEventListener('keydown', alPulsar);
    return () => {
      cuerpo.classList.remove(css.imprimiendoFactura);
      cuerpo.style.overflow = previo;
      window.removeEventListener('keydown', alPulsar);
    };
  }, [imprimible]);

  /* El total mientras escribe. Es la misma cuenta que hace el servidor —en
     céntimos enteros, la retención restando— pero la definitiva es la suya. */
  const cuentas = useMemo(() => {
    const baseCent = lineas.reduce((acc, l) => {
      const cantidad = numero(l.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) return acc;
      return acc + Math.round(aCent(l.precio) * cantidad);
    }, 0);
    const pIva = Number.isFinite(numero(iva)) ? numero(iva) : 0;
    const pIrpf = Number.isFinite(numero(irpf)) ? numero(irpf) : 0;
    const ivaCent = Math.round((baseCent * pIva) / 100);
    const irpfCent = Math.round((baseCent * pIrpf) / 100);
    return { baseCent, ivaCent, irpfCent, totalCent: baseCent + ivaCent - irpfCent };
  }, [lineas, iva, irpf]);

  async function guardarFicha(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoFicha(true);
    setFallo(null);
    setAviso(null);
    try {
      const r = await fetch('/api/facturas?que=fiscales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ficha),
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        setFallo(c.mensaje ?? 'No se han podido guardar tus datos.');
        return;
      }
      setAviso('Tus datos de facturación están guardados.');
      setEditandoFicha(false);
      fichaTocada.current = false;
      await cargar();
    } catch {
      setFallo('No hay conexión con el servidor.');
    } finally {
      setGuardandoFicha(false);
    }
  }

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    if (emitiendoYa.current) return;
    emitiendoYa.current = true;
    setEmitiendo(true);
    setFallo(null);
    setAviso(null);
    try {
      const r = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente,
          lineas,
          ivaPorcentaje: iva,
          irpfPorcentaje: irpf,
          fecha,
          nota,
        }),
      });
      const c = await r.json().catch(() => ({ ok: false }));
      if (!c.ok) {
        // El servidor manda el motivo escrito para poder enseñarlo tal cual:
        // «falta el nombre del cliente» se entiende, «motivo: datos» no.
        setFallo(c.mensaje ?? 'No se ha podido emitir la factura.');
        return;
      }
      setAviso(`Factura ${c.numero} emitida. Ya puedes verla e imprimirla.`);
      setCliente({ nombre: '', nif: '', direccion: '' });
      setLineas([{ concepto: '', cantidad: '1', precio: '' }]);
      setNota('');
      await cargar();
    } catch {
      // Aquí, y solo aquí, no se sabe qué ha pasado: la petición pudo morir de
      // ida —y entonces no hay factura— o de vuelta —y entonces sí la hay—. En
      // cualquier otra pantalla daría igual, pero volver a darle a emitir
      // gastaría OTRO número correlativo para la misma factura y no hay forma
      // de deshacerlo. Así que se recarga la lista y se le dice que mire.
      // El fallo se pone DESPUÉS de cargar porque cargar() empieza borrándolo.
      await cargar();
      setFallo(
        'Se ha cortado la conexión al emitir. Mira en la lista de abajo si la factura ha entrado: si entró, volver a emitirla gastaría otro número.'
      );
    } finally {
      emitiendoYa.current = false;
      setEmitiendo(false);
    }
  }

  async function cambiarEstado(id: string, estado: Estado) {
    const antes = datos;
    setAviso(null);
    // Se pinta antes de que conteste el servidor: marcar varias cobradas
    // seguidas esperando a cada respuesta es insufrible.
    setDatos((d) =>
      d ? { ...d, facturas: d.facturas.map((f) => (f.id === id ? { ...f, estado } : f)) } : d
    );
    try {
      const r = await fetch('/api/facturas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
      if (!(await r.json().catch(() => ({ ok: false }))).ok) throw new Error();
    } catch {
      setDatos(antes);
      setFallo('No se ha podido guardar el cambio. Vuelve a intentarlo.');
      return;
    }

    // La recarga va FUERA del try de arriba a propósito. Si se metiera dentro,
    // un tropiezo AL RECARGAR desharía en pantalla un cambio que el servidor ya
    // tiene guardado: la factura volvería a verse pendiente estando cobrada,
    // que es la mentira peor de las dos. Se recarga porque el cobrado y el
    // pendiente del trimestre los suma el servidor, no esta pantalla.
    await cargar();
  }

  function cambiarLinea(i: number, campo: 'concepto' | 'cantidad' | 'precio', v: string) {
    setLineas((ls) => ls.map((l, j) => (i === j ? { ...l, [campo]: v } : l)));
  }

  if (datos === null) {
    return (
      <div className={css.columna}>
        {fallo ? (
          <p className={css.avisoFallo} role="alert">
            {fallo}{' '}
            <button type="button" className={css.btnLinea} onClick={cargar}>
              Reintentar
            </button>
          </p>
        ) : (
          <p className={css.vacioTexto}>Cargando la facturación…</p>
        )}
      </div>
    );
  }

  const t = datos.trimestre;
  const sinFicha = datos.fiscales === null;
  // Con los datos del emisor sin rellenar no se puede emitir nada, así que no
  // se enseña un formulario que solo va a poder dar error.
  const verFormulario = !sinFicha && (abierto ?? datos.facturas.length === 0);

  const resumen = [
    {
      label: 'Facturado',
      valor: euros(t.totalCent),
      nota: t.cuantas === 0 ? `ninguna factura en el ${t.etiqueta}` : `${t.cuantas} en el ${t.etiqueta}`,
    },
    {
      label: 'Cobrado',
      valor: euros(t.cobradoCent),
      nota: t.cobradoCent === 0 ? 'nada cobrado todavía' : 'ya está en la cuenta',
    },
    {
      label: 'Pendiente de cobro',
      valor: euros(t.pendienteCent),
      nota: t.pendienteCent === 0 ? 'nada pendiente' : 'emitido y sin cobrar',
    },
    {
      label: 'IVA repercutido',
      valor: euros(t.ivaCent),
      nota: t.ivaCent === 0 ? 'nada que declarar todavía' : `a declarar en el ${t.etiqueta}`,
    },
  ];

  const fichaFormulario = (
    /* Las dos clases juntas y en este orden a propósito: .tarjeta pone el aire
       entre las piezas y .punteada —que va después en el CSS— le cambia el
       borde por el de puntos cuando es lo primero que hay que rellenar. */
    <form
      className={sinFicha ? `${css.tarjeta} ${css.punteada}` : css.tarjeta}
      onSubmit={guardarFicha}
    >
      <p className={css.rotuloSeccion}>Tus datos de facturación</p>
      <h2 className={css.h3}>Quién emite la factura</h2>
      <p className={css.parrafo}>
        {sinFicha
          ? 'Sin esto no se puede emitir ninguna factura: una factura tiene que llevar por ley el nombre o razón social, el NIF y el domicilio de quien la emite. Se rellena una vez y se queda guardado.'
          : 'Esto es lo que sale impreso arriba en cada factura. Las ya emitidas no cambian: cada una guarda los datos con los que se imprimió.'}
      </p>

      <div className={css.formRejilla}>
        <Campo
          etiqueta="Nombre o razón social"
          valor={ficha.nombre}
          cambia={(v) => {
            fichaTocada.current = true;
            setFicha((f) => ({ ...f, nombre: v }));
          }}
          placeholder="Sorela Caro"
          autoComplete="name"
          required
        />
        <Campo
          etiqueta="NIF"
          valor={ficha.nif}
          cambia={(v) => {
            fichaTocada.current = true;
            setFicha((f) => ({ ...f, nif: v }));
          }}
          placeholder="12345678Z"
          required
        />
        <Campo
          etiqueta="Domicilio fiscal"
          valor={ficha.direccion}
          cambia={(v) => {
            fichaTocada.current = true;
            setFicha((f) => ({ ...f, direccion: v }));
          }}
          placeholder="Calle, número, código postal y ciudad"
          required
        />
        <Campo
          etiqueta="Serie"
          valor={ficha.serie}
          cambia={(v) => {
            fichaTocada.current = true;
            setFicha((f) => ({ ...f, serie: v.toUpperCase() }));
          }}
          placeholder="A"
          maxLength={6}
        />
      </div>

      <p className={css.apunte}>
        La serie es la letra que va delante del número. Se deja en «A» salvo que
        lleves varias numeraciones aparte. Cada serie cuenta desde 1 cada año.
      </p>

      <div className={css.acciones}>
        <button type="submit" className={css.btn} disabled={guardandoFicha}>
          {guardandoFicha ? 'Guardando…' : 'Guardar mis datos'}
        </button>
        {!sinFicha && (
          <button
            type="button"
            className={css.btnLinea}
            onClick={() => {
              fichaTocada.current = false;
              setEditandoFicha(false);
              if (datos.fiscales) setFicha(datos.fiscales);
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className={css.columna}>
      {/* Lo primero que se ve si faltan los datos del emisor. */}
      {sinFicha && fichaFormulario}

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

      {aviso && (
        <p className={css.avisoBien} role="status">
          {aviso}
        </p>
      )}

      {!sinFicha && (
        <div className={css.barraAcciones}>
          <p className={css.intro} style={{ maxWidth: 520, fontSize: 14.5 }}>
            Facturas emitidas desde aquí, con su numeración correlativa. Del{' '}
            {fechaCorta(t.desde)} al {fechaCorta(t.hasta)} llevas {t.cuantas}
            {t.cuantas === 1 ? ' factura' : ' facturas'}.
          </p>
          <div className={css.acciones}>
            <button
              type="button"
              className={css.btnLinea}
              onClick={() => setEditandoFicha((v) => !v)}
            >
              Mis datos
            </button>
            <button type="button" className={css.btn} onClick={() => setAbierto(!verFormulario)}>
              {verFormulario ? 'Cerrar' : 'Nueva factura'}
            </button>
          </div>
        </div>
      )}

      {!sinFicha && editandoFicha && fichaFormulario}

      {verFormulario && (
        <form className={css.tarjeta} onSubmit={emitir}>
          <p className={css.rotuloSeccion}>Nueva factura</p>
          <h2 className={css.h3}>A quién se la haces</h2>

          <div className={css.formRejilla}>
            <Campo
              etiqueta="Nombre o razón social"
              valor={cliente.nombre}
              cambia={(v) => setCliente((c) => ({ ...c, nombre: v }))}
              placeholder="Nombre de la clienta o de la empresa"
              required
            />
            <Campo
              etiqueta="NIF (si lo da)"
              valor={cliente.nif}
              cambia={(v) => setCliente((c) => ({ ...c, nif: v.toUpperCase() }))}
              placeholder="12345678Z"
            />
            <Campo
              etiqueta="Domicilio"
              valor={cliente.direccion}
              cambia={(v) => setCliente((c) => ({ ...c, direccion: v }))}
              placeholder="Calle, número, código postal y ciudad"
            />
            <label className={css.etiquetaCampo}>
              Fecha de emisión
              <input
                type="date"
                className={css.campoCaja}
                value={fecha}
                max={datos.hoy}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </label>
          </div>

          <h3 className={css.h3} style={{ marginTop: 6 }}>
            Qué le facturas
          </h3>

          {lineas.map((l, i) => (
            <div key={i} className={css.lineaFactura}>
              <label className={css.etiquetaCampo}>
                Concepto
                <input
                  className={css.campoCaja}
                  value={l.concepto}
                  onChange={(e) => cambiarLinea(i, 'concepto', e.target.value)}
                  placeholder="Sesión de drenaje linfático"
                  required
                />
              </label>
              <label className={css.etiquetaCampo}>
                Cantidad
                <input
                  className={css.campoCaja}
                  inputMode="decimal"
                  value={l.cantidad}
                  onChange={(e) => cambiarLinea(i, 'cantidad', e.target.value)}
                  required
                />
              </label>
              <label className={css.etiquetaCampo}>
                Precio (€)
                <input
                  className={css.campoCaja}
                  inputMode="decimal"
                  value={l.precio}
                  onChange={(e) => cambiarLinea(i, 'precio', e.target.value)}
                  placeholder="60"
                  required
                />
              </label>
              <button
                type="button"
                className={css.quitarLinea}
                aria-label={`Quitar la línea ${i + 1}`}
                // La última no se puede quitar: una factura sin líneas no es
                // una factura, y el servidor la rechazaría igualmente.
                disabled={lineas.length === 1}
                onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}

          <div className={css.acciones}>
            <button
              type="button"
              className={`${css.btnLinea} ${css.btnSm}`}
              onClick={() =>
                setLineas((ls) => [...ls, { concepto: '', cantidad: '1', precio: '' }])
              }
            >
              Añadir línea
            </button>
          </div>

          <div className={css.formRejilla}>
            <Campo
              etiqueta="IVA (%)"
              valor={iva}
              cambia={setIva}
              inputMode="decimal"
              required
            />
            <Campo etiqueta="Retención IRPF (%)" valor={irpf} cambia={setIrpf} inputMode="decimal" />
            <label className={css.etiquetaCampo} style={{ gridColumn: '1 / -1' }}>
              Nota (forma de pago, exención de IVA…)
              <input
                className={css.campoCaja}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Pago por transferencia a ES.."
                maxLength={400}
              />
            </label>
          </div>

          {numero(iva) === 0 && (
            <p className={css.apunte}>
              Con el IVA a cero, la factura tiene que decir por qué está exenta.
              Escríbelo en la nota.
            </p>
          )}

          <div className={css.totalVivo}>
            <span className={css.desglose}>
              <span>Base {euros(cuentas.baseCent)}</span>
              <span>IVA {euros(cuentas.ivaCent)}</span>
              {cuentas.irpfCent > 0 && <span>IRPF −{euros(cuentas.irpfCent)}</span>}
            </span>
            <span className={css.totalVivoCifra}>{euros(cuentas.totalCent)}</span>
          </div>

          <p className={css.apunte}>
            Esta cifra es una previsión. Al emitir, las cuentas las rehace el
            servidor y son esas las que se guardan y se imprimen.
          </p>

          <div className={css.acciones}>
            <button type="submit" className={css.btn} disabled={emitiendo}>
              {emitiendo ? 'Emitiendo…' : 'Emitir factura'}
            </button>
          </div>

          <p className={css.apunte}>
            Una vez emitida no se puede borrar ni corregir: llevará un número
            correlativo que ya queda gastado. Si sale mal, se arregla emitiendo
            una factura rectificativa.
          </p>
        </form>
      )}

      <section className={css.tarjeta}>
        <p className={css.rotuloSeccion}>Facturas emitidas</p>
        {datos.facturas.length === 0 ? (
          <p className={css.vacioTexto}>
            Todavía no has emitido ninguna factura. Cuando emitas la primera
            aparecerá aquí con su número, y desde el botón de ver la podrás
            imprimir o guardar en PDF.
          </p>
        ) : (
          datos.facturas.map((f) => (
            <article key={f.id} className={css.factura}>
              <span className={css.facturaNum}>{f.numero}</span>

              <span className={css.facturaCliente}>
                <span style={{ fontSize: 15, color: 'var(--ink)' }}>{f.cliente.nombre}</span>
                <span style={{ fontSize: 12.5, fontWeight: 300, color: 'var(--muted)' }}>
                  {fechaCorta(f.fecha)}
                  {f.lineas[0] && ` · ${f.lineas[0].concepto}`}
                  {f.lineas.length > 1 && ` y ${f.lineas.length - 1} más`}
                </span>
              </span>

              <span className={css.facturaImporte}>{euros(f.totalCent)}</span>

              <span className={`${css.estado} ${CLASE_ESTADO[f.estado]}`}>{f.estado}</span>

              <span className={css.acciones}>
                <button
                  type="button"
                  className={css.enlaceAccion}
                  onClick={() => setImprimible(f)}
                >
                  Ver e imprimir
                </button>
                <select
                  aria-label={`Estado de la factura ${f.numero}`}
                  className={css.campoRedondo}
                  style={{ fontSize: 13 }}
                  value={f.estado}
                  onChange={(e) => cambiarEstado(f.id, e.target.value as Estado)}
                >
                  <option>Pendiente</option>
                  <option>Cobrada</option>
                </select>
              </span>
            </article>
          ))
        )}
      </section>

      {/* La hoja se monta colgando del <body>, no de aquí dentro: ver el
          comentario de cabecera. */}
      {imprimible &&
        createPortal(
          <Hoja factura={imprimible} cerrar={() => setImprimible(null)} />,
          document.body
        )}
    </div>
  );
}
