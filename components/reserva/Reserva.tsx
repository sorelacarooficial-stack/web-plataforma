'use client';

import { useEffect, useMemo, useState } from 'react';
import { CRIPTO, OPCIONES, PLAZAS_SEDE, RESERVA_HASTA, TRANSFERENCIA, enlaceStripe, type Opcion } from '@/lib/reserva';
import css from './reserva.module.css';

const usd = (n: number) => `${n.toLocaleString('es-ES')} USD`;
const dos = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

type Pago = 'tarjeta' | 'transferencia' | 'cripto';

export default function Reserva({ whatsapp }: { whatsapp: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  const [id, setId] = useState<string>('');
  const [pago, setPago] = useState<Pago | ''>('');
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const visibles = OPCIONES.filter((o) => o.grupo !== 'Membresía' || enlaceStripe(o));
  const elegida = visibles.find((o) => o.id === id);
  const conTarjeta = elegida ? !!enlaceStripe(elegida) : false;
  const transferencias = TRANSFERENCIA.filter((t) => t.datos);
  const pagos: { id: Pago; t: string; s: string; ok: boolean }[] = [
    { id: 'tarjeta', t: 'Tarjeta', s: 'Pago seguro con Stripe', ok: conTarjeta },
    { id: 'transferencia', t: 'Transferencia', s: 'Colombia o Venezuela', ok: transferencias.length > 0 },
    { id: 'cripto', t: 'Cripto', s: CRIPTO.red || 'USDT', ok: !!CRIPTO.direccion },
  ];

  const resta = ahora === null ? null : Date.parse(RESERVA_HASTA) - ahora;
  const cerrado = resta !== null && resta <= 0;

  const mensaje = useMemo(() => {
    const partes = [`Hola, soy ${nombre.trim() || '…'}. Vengo de la masterclass y quiero reservar:`];
    if (elegida) partes.push(`• ${elegida.titulo} (${elegida.detalle})${elegida.reserva ? ` · reserva ${usd(elegida.reserva)}` : ''}`);
    if (pago) partes.push(`• Pago: ${pago}`);
    partes.push('Te mando el comprobante por aquí.');
    return partes.join('\n');
  }, [nombre, elegida, pago]);
  const wa = (texto: string) => `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;

  const grupos = ['Presencial', 'Online', 'Membresía'] as const;

  return (
    <main className={css.pagina}>
      <header className={css.cabecera}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clase/logo-tinta.webp" alt="Sorela Caro · Técnica Divine" className={css.logo} />
        <p className={css.ceja}>Solo para quien estuvo en la masterclass</p>
        <h1 className={css.titulo}>
          Reserva tu plaza <strong>en un minuto</strong>
        </h1>
        <div className={`${css.reloj} ${cerrado ? css.relojFin : ''}`}>
          {resta === null ? (
            <span>Precio especial durante 24 horas</span>
          ) : cerrado ? (
            <span>El precio especial ya ha terminado. Escríbenos y te ayudamos.</span>
          ) : (
            <>
              <span>El precio especial termina en</span>
              <b>
                {dos(resta / 3600e3)}:{dos((resta % 3600e3) / 60e3)}:{dos((resta % 60e3) / 1000)}
              </b>
            </>
          )}
        </div>
        <p className={css.plazas}>
          <i /> Solo <b>{PLAZAS_SEDE} plazas</b> por ciudad en la formación presencial
        </p>
      </header>

      <section className={css.paso}>
        <h2>
          <span>1</span> ¿Qué quieres reservar?
        </h2>
        {grupos.map((g) => {
          const lista = visibles.filter((o) => o.grupo === g);
          if (!lista.length) return null;
          return (
            <div key={g} className={css.grupo}>
              <p className={css.grupoTitulo}>{g === 'Presencial' ? 'Formación presencial premium' : g}</p>
              <div className={css.opciones}>
                {lista.map((o) => (
                  <Tarjeta key={o.id} o={o} on={o.id === id} elegir={() => (setId(o.id), setPago(''))} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {elegida && (
        <section className={css.paso}>
          <h2>
            <span>2</span> ¿Cómo quieres pagar{elegida.reserva ? ` la reserva de ${usd(elegida.reserva)}` : ''}?
          </h2>
          <div className={css.pagos}>
            {pagos
              .filter((p) => p.ok)
              .map((p) => (
                <button key={p.id} type="button" className={`${css.pago} ${pago === p.id ? css.pagoOn : ''}`} onClick={() => setPago(p.id)}>
                  <b>{p.t}</b>
                  <span>{p.s}</span>
                </button>
              ))}
            {!pagos.some((p) => p.ok) && <p className={css.aviso}>Escríbenos por WhatsApp y te pasamos los datos de pago al momento.</p>}
          </div>

          {pago === 'tarjeta' && (
            <a className={css.boton} href={enlaceStripe(elegida)} target="_blank" rel="noopener noreferrer">
              Pagar {elegida.reserva ? usd(elegida.reserva) : ''} con tarjeta
            </a>
          )}
          {pago === 'transferencia' && (
            <div className={css.datos}>
              {transferencias.map((t) => (
                <div key={t.pais}>
                  <b>{t.pais}</b>
                  <pre>{t.datos}</pre>
                </div>
              ))}
            </div>
          )}
          {pago === 'cripto' && (
            <div className={css.datos}>
              <div>
                <b>Red</b>
                <pre>{CRIPTO.red}</pre>
              </div>
              <div>
                <b>Dirección</b>
                <pre>{CRIPTO.direccion}</pre>
              </div>
            </div>
          )}
        </section>
      )}

      {elegida && (
        <section className={css.paso}>
          <h2>
            <span>3</span> Envíanos el comprobante
          </h2>
          <label className={css.campo}>
            Tu nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" />
          </label>
          <a className={`${css.boton} ${css.botonWa}`} href={wa(mensaje)} target="_blank" rel="noopener noreferrer">
            Enviar por WhatsApp
          </a>
          <p className={css.nota}>Te confirmamos tu plaza por WhatsApp en cuanto recibamos el pago.</p>
        </section>
      )}

      <footer className={css.pie}>
        <p>
          <b>Por tu seguridad:</b> solo te escribimos desde el número oficial de Divine ({whatsapp}). Nadie te pedirá un pago por otro canal.
        </p>
        <a href={wa('Hola, vengo de la masterclass y tengo una duda sobre la reserva.')} target="_blank" rel="noopener noreferrer">
          ¿Tienes una duda? Escríbenos
        </a>
      </footer>
    </main>
  );
}

function Tarjeta({ o, on, elegir }: { o: Opcion; on: boolean; elegir: () => void }) {
  return (
    <button type="button" className={`${css.opcion} ${on ? css.opcionOn : ''}`} onClick={elegir} aria-pressed={on}>
      <b>{o.titulo}</b>
      <span>{o.detalle}</span>
      {o.precio ? (
        <span className={css.precio}>
          {o.antes ? <s>{usd(o.antes)}</s> : null} <strong>{usd(o.precio)}</strong>
        </span>
      ) : null}
      {o.reserva ? <span className={css.reserva}>Reserva con {usd(o.reserva)}</span> : null}
      {o.nota ? <span className={css.extra}>{o.nota}</span> : null}
    </button>
  );
}
