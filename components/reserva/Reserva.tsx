'use client';

import { useCallback, useEffect, useState } from 'react';
import { BECA, SEDES } from '@/lib/clase';
import { CRIPTO, OPCIONES, PLAZAS_SEDE, RESERVA_HASTA, enlaceStripe, type Opcion } from '@/lib/reserva';
import type { Transferencia } from '@/lib/transferencia';
import ReservaDatos from './ReservaDatos';
import css from './reserva.module.css';

const usd = (n: number) => `${n.toLocaleString('es-ES')} USD`;
const dos = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const slug = (c: string) => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const FOTOS: Record<string, string> = {
  completa: '/clase/grupo.webp',
  intensiva: '/trayectoria/cuerpo-1.webp',
  especifica: '/trayectoria/rostro-1.webp',
  online: '/clase/despues.webp',
  membresia: '/trayectoria/equipo.webp',
};
const INCLUYE_COMPLETA = ['3 días con Sorela', 'Abdomen, piernas, glúteos, facial y brazos', 'Cena de gala y certificado', 'Academia online incluida', 'Material, modelos y estación de snacks'];

/**
 * Una sola pantalla: eliges ciudad y cada formación lleva su botón de pago.
 * Con enlace de Stripe paga ahí mismo; sin él, abre WhatsApp con la elección
 * ya escrita.
 */
export default function Reserva({ whatsapp, transferencias }: { whatsapp: string; transferencias: Transferencia[] }) {
  const [ahora, setAhora] = useState<number | null>(null);
  const [sede, setSede] = useState(0);
  const [otros, setOtros] = useState(false);
  const [elegida, setElegida] = useState<Opcion | null>(null);
  const elegir = useCallback((o: Opcion) => setElegida(o), []);
  const cerrar = useCallback(() => setElegida(null), []);

  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const wa = (texto: string) => `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
  const resta = ahora === null ? null : Date.parse(RESERVA_HASTA) - ahora;
  const cerrado = resta !== null && resta <= 0;
  const ciudad = slug(SEDES[sede].ciudad);
  const de = (id: string) => OPCIONES.find((o) => o.id === id)!;
  const completa = de(`${ciudad}-completa`);
  const intensiva = de(`${ciudad}-intensiva`);
  const especifica = de(`${ciudad}-especifica`);
  const beca = de('caracas-beca');
  const online = de('online');
  const membresia = de('membresia');
  const hayOtros = transferencias.length > 0 || !!CRIPTO.direccion;

  return (
    <main className={css.pagina}>
      <header className={css.hero} style={{ backgroundImage: 'url(/clase/credenciales.webp)' }}>
        <div className={css.heroVelo} />
        <div className={css.heroDentro}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clase/logo-oro.webp" alt="Sorela Caro · Técnica Divine" className={css.logo} />
          <p className={css.ceja}>Solo para quien estuvo en la masterclass</p>
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
                  {dos(resta / 3600e3)}
                  <i>h</i> {dos((resta % 3600e3) / 60e3)}
                  <i>min</i> {dos((resta % 60e3) / 1000)}
                  <i>s</i>
                </b>
              </>
            )}
          </div>
        </div>
      </header>

      <section className={css.beca}>
        <p className={css.pasoOro}>Solo para Venezuela</p>
        <h2 className={css.becaTitulo}>
          Beca <strong>especial</strong>
        </h2>
        <p className={css.becaSub}>{beca.detalle.split(' · ')[0]} · Caracas</p>
        <ul className={css.becaLista}>
          {BECA.incluye.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className={css.becaPlazas}>Solo {BECA.plazas} plazas con beca</p>
        <Boton o={beca} wa={wa} elegir={elegir} />
      </section>

      <section className={css.bloque}>
        <p className={css.paso}>¿Prefieres otra formación? · 1 · Elige tu ciudad</p>
        <div className={css.sedes}>
          {SEDES.map((s, k) => (
            <button key={s.ciudad} type="button" className={`${css.sede} ${k === sede ? css.sedeOn : ''}`} onClick={() => setSede(k)} aria-pressed={k === sede}>
              <b>{s.ciudad}</b>
              <span>{s.fechas}</span>
              <span className={css.plazas}>
                {Array.from({ length: PLAZAS_SEDE }, (_, i) => (
                  <i key={i} />
                ))}
                <em>Solo {PLAZAS_SEDE} plazas</em>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={css.bloque}>
        <p className={css.paso}>2 · Elige tu formación en {SEDES[sede].ciudad}</p>

        <article className={css.estrella}>
          <div className={css.estrellaFoto} style={{ backgroundImage: `url(${FOTOS.completa})` }}>
            <span className={css.cinta}>La más elegida</span>
          </div>
          <div className={css.estrellaTexto}>
            <p className={css.tipo}>
              Formación completa <span className={css.premium}>Premium</span>
            </p>
            <h2>
              {completa.titulo.split(' · ')[1]} <span>3 días</span>
            </h2>
            <ul className={css.lista}>
              {INCLUYE_COMPLETA.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <Precio o={completa} grande />
            <Boton o={completa} wa={wa} elegir={elegir} />
          </div>
        </article>

        <div className={css.dos}>
          {[intensiva, especifica].map((o) => (
            <article key={o.id} className={css.tarjeta}>
              <div className={css.tarjetaFoto} style={{ backgroundImage: `url(${o.id.endsWith('intensiva') ? FOTOS.intensiva : FOTOS.especifica})` }} />
              <div className={css.tarjetaTexto}>
                <p className={css.tipo}>{o.detalle.split(' · ')[1]}</p>
                <h3>{o.titulo.split(' · ')[1]}</h3>
                <p className={css.suave}>{o.id.endsWith('intensiva') ? 'Dos zonas, a fondo' : 'Una zona, para empezar'}</p>
                <Precio o={o} />
                <Boton o={o} wa={wa} elegir={elegir} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={`${css.banda} ${css.bandaOnline}`} style={{ backgroundImage: `url(${FOTOS.online})` }}>
        <div className={css.bandaVeloClaro} />
        <div className={css.bandaDentro}>
          <p className={css.paso}>¿Prefieres estudiar desde casa?</p>
          <h3 className={css.bandaTitulo}>
            Divine® <strong>Online</strong>
          </h3>
          <p className={css.bandaTexto}>100 % online y a tu ritmo, para profesionales con experiencia. Con certificado Divine®.</p>
          <Precio o={online} grande />
          <div className={css.bandaBoton}>
            <Boton o={online} wa={wa} elegir={elegir} />
          </div>
        </div>
      </section>

      <section className={`${css.banda} ${css.bandaMem}`} style={{ backgroundImage: `url(${FOTOS.membresia})` }}>
        <div className={css.bandaVeloOscuro} />
        <div className={css.bandaDentro}>
          <p className={css.pasoOro}>Solo terapeutas homologadas</p>
          <h3 className={css.bandaTitulo}>
            Membresía <strong>Divine®</strong>
          </h3>
          <p className={css.bandaTexto}>Clases en directo, comunidad, fichas y tu agente IA adaptado a tu negocio.</p>
          <p className={css.precioMem}>
            <strong>{usd(membresia.precio ?? 0)}</strong> este primer mes
            {membresia.despues ? <span> · después {usd(membresia.despues)}</span> : null}
          </p>
          <div className={css.bandaBoton}>
            <Boton o={membresia} wa={wa} elegir={elegir} />
          </div>
        </div>
      </section>

      {hayOtros && (
        <section className={css.transfer}>
          <p className={css.paso}>¿Prefieres pagar por transferencia?</p>
          <p className={css.suave} style={{ margin: '4px 0 0' }}>
            Haz el abono directo a esta cuenta y mándanos el comprobante por WhatsApp.
          </p>
          {transferencias.map((t) => (
            <div key={t.pais} className={css.transferCaja}>
              <b>Transferencia · {t.pais}</b>
              <ul>
                {t.lineas.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
          <a className={`${css.boton} ${css.botonWa}`} href={wa('Hola, vengo de la masterclass. Ya hice la transferencia: te mando el comprobante.')} target="_blank" rel="noopener noreferrer">
            Mandar el comprobante por WhatsApp
          </a>
          {CRIPTO.direccion && (
            <button type="button" className={css.otrosBoton} onClick={() => setOtros((x) => !x)}>
              {otros ? 'Ocultar' : '¿Prefieres cripto?'}
            </button>
          )}
          {otros && CRIPTO.direccion && (
            <div className={css.datos}>
              {CRIPTO.direccion && (
                <div>
                  <b>Cripto · {CRIPTO.red}</b>
                  <pre>{CRIPTO.direccion}</pre>
                </div>
              )}
              <a className={`${css.boton} ${css.botonWa}`} href={wa('Hola, vengo de la masterclass. Ya hice el pago: te mando el comprobante.')} target="_blank" rel="noopener noreferrer">
                Mandar el comprobante por WhatsApp
              </a>
            </div>
          )}
        </section>
      )}

      {elegida && <ReservaDatos o={elegida} alCerrar={cerrar} whatsapp={whatsapp} />}

      <footer className={css.pie}>
        <a href={wa('Hola, vengo de la masterclass y tengo una duda sobre la reserva.')} target="_blank" rel="noopener noreferrer">
          ¿Dudas? Escríbenos
        </a>
      </footer>
    </main>
  );
}

function Precio({ o, grande = false }: { o: Opcion; grande?: boolean }) {
  if (!o.precio) return null;
  return (
    <p className={`${css.precio} ${grande ? css.precioGrande : ''}`}>
      {o.antes ? <s>{usd(o.antes)}</s> : null}
      <strong>{usd(o.precio)}</strong>
    </p>
  );
}

/**
 * Con enlace de Stripe: abre los datos (paso 1) y de ahí va a pagar (paso 2).
 * Sin enlace: WhatsApp con la elección escrita.
 */
function Boton({ o, wa, elegir }: { o: Opcion; wa: (t: string) => string; elegir: (o: Opcion) => void }) {
  const stripe = enlaceStripe(o);
  const texto = o.reserva ? `Reservar con ${usd(o.reserva)}` : o.precio ? `Empezar por ${usd(o.precio)}` : 'Reservar';
  if (stripe)
    return (
      <button type="button" className={css.boton} onClick={() => elegir(o)} style={{ width: '100%', border: 0, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>
        {texto}
      </button>
    );
  return (
    <a className={css.boton} href={wa(`Hola, vengo de la masterclass y quiero reservar: ${o.titulo} (${o.detalle}).`)} target="_blank" rel="noopener noreferrer">
      {texto}
      <small>por WhatsApp</small>
    </a>
  );
}
