import BotonCaptacion from '@/components/BotonCaptacion';
import { ETIQUETA_PLAZAS, anoDe, capital, diaDe, lineasHorario, mesCortoDe, rangoFechas, type ConvocatoriaPublica } from '@/lib/convocatorias-tipos';
import css from './formaciones.module.css';

/**
 * «Próximas fechas»: las convocatorias que Sorela ha marcado para la web y
 * todavía no han empezado.
 *
 * Solo lo que la página puede decir: la formación, la ciudad, los días, el
 * horario y si quedan plazas, en tres palabras («Quedan plazas», «Últimas
 * plazas», «Completa»). Nunca el precio, el lugar exacto ni los nombres: esos
 * datos ni siquiera llegan aquí (lib/convocatorias.ts los deja fuera de la
 * lectura).
 *
 * El botón de cada fecha es el mismo «Guardar mi sitio» que ya tenía la
 * página, con el texto de esa fecha: abre el formulario de siempre y la
 * persona entra en Clientes como interesada en formarse. No se manda al
 * asistente, que todavía contesta que no hay fechas cerradas.
 */
export default function ProximasFechas({ fechas }: { fechas: ConvocatoriaPublica[] }) {
  return (
    <section id="proximas-fechas" className={`${css.proximas} caja-landing`} aria-labelledby="proximas-titulo">
      <div className={css.proximasCabeza}>
        <p className="antetitulo" style={{ color: 'var(--oro)' }}>
          Próximas fechas
        </p>
        <h2 id="proximas-titulo" className={css.fechasTitulo}>
          {fechas.length === 1 ? 'La próxima presencial.' : 'Las próximas presenciales.'}
        </h2>
        <p className="texto max-520">
          Presencial conmigo, en grupo reducido. Para entrar hace falta tener hecha la formación online.
        </p>
      </div>

      <ol className={css.proximasLista}>
        {fechas.map((f) => {
          const horario = lineasHorario(f);
          const fechasTexto = rangoFechas(f.inicio, f.fin);
          const sinPlaza = f.plazas === 'completa' || f.plazas === 'cerrada';
          const mismoMes = f.inicio.slice(0, 7) === f.fin.slice(0, 7);
          return (
            <li key={f.id} className={css.fecha}>
              <time className={css.fechaHoja} dateTime={f.inicio}>
                <span className={css.fechaMes}>{mismoMes ? mesCortoDe(f.inicio) : `${mesCortoDe(f.inicio)}–${mesCortoDe(f.fin)}`}</span>
                <span className={css.fechaDias}>{f.inicio === f.fin ? diaDe(f.inicio) : `${diaDe(f.inicio)}–${diaDe(f.fin)}`}</span>
                <span className={css.fechaAno}>{anoDe(f.inicio)}</span>
              </time>

              <div className={css.fechaQue}>
                <p className={css.fechaModalidad}>{f.modalidad}</p>
                <h3 className={css.fechaCiudad}>{f.ciudad}</h3>
                <p className={css.fechaCuando}>{capital(fechasTexto)}</p>
                {horario.length > 0 && (
                  <ul className={css.fechaHorario}>
                    {horario.map((h) => (
                      <li key={h}>{capital(h)}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={css.fechaAcciones}>
                <span className={css.fechaPlazas} data-plazas={f.plazas}>
                  {ETIQUETA_PLAZAS[f.plazas]}
                </span>
                <BotonCaptacion
                  className={sinPlaza ? 'btn-linea' : 'btn btn-md'}
                  titulo={sinPlaza ? 'Lista por si se libera una plaza' : 'Reservar plaza'}
                  entradilla={
                    sinPlaza
                      ? `${f.modalidad} en ${f.ciudad}, ${fechasTexto}. Déjame tus datos para quedar en la lista por si se libera una plaza. Al terminar, entra en el grupo de WhatsApp de la Técnica Divine.`
                      : `${f.modalidad} en ${f.ciudad}, ${fechasTexto}. Déjame tus datos para pedir tu plaza. Al terminar, entra en el grupo de WhatsApp de la Técnica Divine.`
                  }
                  etiquetaVentana={`${f.modalidad} en ${f.ciudad}`}
                  origen="formacion"
                >
                  {sinPlaza ? 'Apuntarme a la lista' : 'Reservar plaza'}
                </BotonCaptacion>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
