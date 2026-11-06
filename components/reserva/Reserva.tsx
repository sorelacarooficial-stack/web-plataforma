'use client';

import { useEffect, useState } from 'react';
import { CRIPTO, OPCIONES, PLAZAS_SEDE, RESERVA_HASTA, TRANSFERENCIA, enlaceStripe, type Opcion } from '@/lib/reserva';
import css from './reserva.module.css';

const usd = (n: number) => `${n.toLocaleString('es-ES')} USD`;
const dos = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

/**
 * Una sola pantalla: cada opción lleva su botón de pago. Con enlace de
 * Stripe, paga ahí mismo; sin él, abre WhatsApp con la elección ya escrita.
 */
export default function Reserva({ whatsapp }: { whatsapp: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  const [otros, setOtros] = useState(false);

  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const wa = (texto: string) => `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
  const resta = ahora === null ? null : Date.parse(RESERVA_HASTA) - ahora;
  const cerrado = resta !== null && resta <= 0;
  const visibles = OPCIONES.filter((o) => o.grupo !== 'Membresía' || enlaceStripe(o) || o.precio);
  const transferencias = TRANSFERENCIA.filter((t) => t.datos);
  const hayOtros = transferencias.length > 0 || !!CRIPTO.direccion;

  return (
    <main className={css.pagina}>
      <header className={css.cabecera}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clase/logo-tinta.webp" alt="Sorela Caro · Técnica Divine" className={css.logo} />
        <h1 className={css.titulo}>
          Reserva tu plaza <strong>ahora</strong>
        </h1>
        <div className={`${css.reloj} ${cerrado ? css.relojFin : ''}`}>
          {resta === null ? (
            <span>Precio especial durante 24 horas</span>
          ) : cerrado ? (
            <span>El precio especial ha terminado. Escríbenos y te ayudamos.</span>
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
          <i /> Solo <b>{PLAZAS_SEDE} plazas</b> por ciudad
        </p>
      </header>

      <div className={css.opciones}>
        {visibles.map((o) => (
          <Tarjeta key={o.id} o={o} wa={wa} />
        ))}
      </div>

      {hayOtros && (
        <section className={css.otros}>
          <button type="button" className={css.otrosBoton} onClick={() => setOtros((x) => !x)}>
            {otros ? 'Ocultar' : '¿Prefieres transferencia o cripto?'}
          </button>
          {otros && (
            <div className={css.datos}>
              {transferencias.map((t) => (
                <div key={t.pais}>
                  <b>Transferencia · {t.pais}</b>
                  <pre>{t.datos}</pre>
                </div>
              ))}
              {CRIPTO.direccion && (
                <div>
                  <b>Cripto · {CRIPTO.red}</b>
                  <pre>{CRIPTO.direccion}</pre>
                </div>
              )}
              <a className={`${css.boton} ${css.botonWa}`} href={wa('Hola, vengo de la masterclass. Ya hice la transferencia: te mando el comprobante.')} target="_blank" rel="noopener noreferrer">
                Mandar el comprobante por WhatsApp
              </a>
            </div>
          )}
        </section>
      )}

      <footer className={css.pie}>
        <p>
          <b>Por tu seguridad:</b> solo te escribimos desde el número oficial de Divine ({whatsapp}).
        </p>
        <a href={wa('Hola, vengo de la masterclass y tengo una duda sobre la reserva.')} target="_blank" rel="noopener noreferrer">
          ¿Dudas? Escríbenos
        </a>
      </footer>
    </main>
  );
}

function Tarjeta({ o, wa }: { o: Opcion; wa: (t: string) => string }) {
  const stripe = enlaceStripe(o);
  const cobra = o.reserva || o.precio || 0;
  const href = stripe || wa(`Hola, vengo de la masterclass y quiero reservar: ${o.titulo} (${o.detalle}).`);
  return (
    <div className={`${css.opcion} ${o.nota ? css.opcionTop : ''}`}>
      {o.nota && <span className={css.extra}>{o.nota}</span>}
      <b>{o.titulo}</b>
      <span>{o.detalle}</span>
      {o.precio ? (
        <span className={css.precio}>
          {o.antes ? <s>{usd(o.antes)}</s> : null} <strong>{usd(o.precio)}</strong>
          {o.grupo === 'Membresía' && o.despues ? <em> este primer mes · después {usd(o.despues)}</em> : null}
        </span>
      ) : null}
      <a className={css.boton} href={href} target="_blank" rel="noopener noreferrer">
        {stripe ? (o.reserva ? `Reservar con ${usd(o.reserva)}` : `Pagar ${usd(cobra)}`) : 'Reservar por WhatsApp'}
      </a>
    </div>
  );
}
