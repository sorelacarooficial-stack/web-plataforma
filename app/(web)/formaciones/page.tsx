import type { Metadata } from 'next';
import AvisarCiudad from '@/components/AvisarCiudad';
import BotonAsistente from '@/components/BotonAsistente';
import BotonCaptacion from '@/components/BotonCaptacion';
import DatosEstructurados from '@/components/DatosEstructurados';
import css from './formaciones.module.css';

/**
 * Junto con la portada, es la página que pelea por la búsqueda principal: una
 * esteticista que quiere formarse. La portada dice «formación» y esta dice
 * «curso», que es la otra manera de buscarlo, para que no compitan entre sí.
 *
 * La descripción no promete fechas, porque no hay ninguna cerrada (ver el
 * comentario de abajo). Prometer en Google lo que la página no da es peor que
 * no salir.
 */
export const metadata: Metadata = {
  title: { absolute: 'Curso de drenaje linfático manual, online y presencial' },
  description:
    'Primero la formación online, después dos días presenciales conmigo sobre modelos reales. Aún no hay fechas cerradas: dime tu ciudad y te guardo el sitio.',
};

/**
 * Formaciones.
 *
 * Esta página enseñaba tres convocatorias con ciudad, fecha, precio y plazas
 * («Madrid, 14-16 de noviembre, 1.450 €, quedan 3 de 8»). Ninguno de esos
 * datos era real: venían del prototipo de diseño. Sorela ha confirmado que
 * hoy no hay ninguna fecha cerrada.
 *
 * Así que la página ya no lista convocatorias: explica el recorrido, que sí
 * es cierto y sí es lo que diferencia a la formación, y ofrece guardar sitio
 * para la primera fecha que se cierre. Cuando haya convocatorias de verdad,
 * el listado vuelve con ellas.
 */

const ETAPAS = [
  {
    orden: 'Primera etapa',
    titulo: 'Formación online',
    texto:
      'Aquí empieza todo. Trabajas la anatomía linfática, la lógica del método y el protocolo por fases antes de ponerte a tocar. Desde tu país y a tu ritmo.',
    puntos: [
      'Anatomía del sistema linfático y de las estaciones ganglionares',
      'La lógica del método: qué se mira y en qué orden se trabaja',
      'Dossier precurso con el protocolo por fases',
      'Acceso flexible, sin horarios',
      'Requisito previo para entrar en la presencial',
    ],
    destacada: false,
  },
  {
    orden: 'Segunda etapa',
    titulo: 'Formación presencial',
    texto:
      'Dos jornadas conmigo al lado de la camilla. Es donde el método deja de ser teoría y pasa a tus manos, que es el único sitio donde sirve.',
    puntos: [
      'Día 1 · Lipodrenaje: protocolo completo y aplicación',
      'Día 2 · Moldeo y tonificación de silueta',
      'Práctica sobre modelos reales, no solo demostración',
      'Te corrijo sobre tus manos',
      'Grupos reducidos',
    ],
    destacada: true,
  },
];

/**
 * Las dos etapas, dichas en el formato que lee un buscador.
 *
 * El nombre y la descripción salen de ETAPAS, que es lo que se ve en la
 * página: no se escriben aparte, porque un dato estructurado que no coincide
 * con lo que hay a la vista es peor que no tener ninguno.
 *
 * Sin fechas, sin precio y sin convocatoria: hoy no hay ninguna cerrada y la
 * propia página lo dice. El único requisito que se declara es el que la página
 * afirma —la online es previa a la presencial— y no se declara ningún
 * certificado, porque aquí no se promete ninguno.
 */
const CURSOS = ETAPAS.map((e, i) => ({
  nombre: `${e.titulo} de la Técnica Divine`,
  descripcion: e.texto,
  ruta: '/formaciones',
  // Las dos viven en esta misma página, así que hace falta algo que las
  // distinga o quedarían con el mismo identificador.
  ancla: i === 0 ? 'online' : 'presencial',
  ...(i === 1 ? { requisitos: 'Haber completado antes la formación online.' } : {}),
}));

export default function Formaciones() {
  return (
    <main className="pagina">
      <DatosEstructurados
        cursos={CURSOS}
        migas={[
          { nombre: 'Inicio', ruta: '/' },
          { nombre: 'Formaciones', ruta: '/formaciones' },
        ]}
      />
      <section className={css.portada}>
        <div className="wrap">
          <h1 className="titulo-xl" style={{ marginBottom: 24 }}>
            Formaciones
          </h1>
          <p className="lede">
            Para ser terapeuta Divine hay un orden: primero la formación online y después la
            presencial. Así los días conmigo se dedican enteros a tus manos.
          </p>
        </div>
      </section>

      <section className="seccion">
        <div className="wrap">
          <div className={css.etapas}>
            {ETAPAS.map((e) => (
              <article
                key={e.titulo}
                className={`${css.etapa} ${e.destacada ? css.etapaDestacada : ''}`}
              >
                <span className={css.etapaOrden}>{e.orden}</span>
                <h2 className={css.etapaTitulo}>{e.titulo}</h2>
                <p className="texto-fijo">{e.texto}</p>
                <ul className={css.etapaLista}>
                  {e.puntos.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* Las fechas: la respuesta honesta hoy es que no hay ninguna cerrada,
              y se dice así. Una fecha que luego se mueve cuesta más que no
              darla, sobre todo cuando alguien ya ha comprado un vuelo. */}
          <div className={css.fechas}>
            <div>
              <p className="antetitulo" style={{ color: 'var(--oro)' }}>
                Próximas convocatorias
              </p>
              <h2 className={css.fechasTitulo}>Sudamérica, próximamente.</h2>
              <p className="texto max-520">
                Las ciudades y las fechas están a punto de confirmarse. Todavía no te voy a dar
                una fecha que pueda moverse. Lo que sí puedo es guardarte el sitio y avisarte
                antes que a nadie en cuanto se cierre.
              </p>
            </div>
            <div className={css.fechasAcciones}>
              <BotonCaptacion
                className="btn btn-md"
                titulo="Te guardo el sitio"
                entradilla="Déjame dónde escribirte y te aviso en cuanto se cierre la primera convocatoria, con la ciudad, las fechas y el precio."
                etiquetaVentana="Guardar sitio en la próxima formación"
                origen="formacion"
              >
                Guardar mi sitio
              </BotonCaptacion>
              <BotonAsistente
                pregunta="Quiero consultar las próximas fechas en Sudamérica y que me guardes sitio."
                className="enlace-subrayado"
              >
                Preguntar por el asistente
              </BotonAsistente>
            </div>
          </div>

          <div className={css.avisame}>
            <h2 className={css.avisameTitulo}>¿Tu ciudad no está?</h2>
            <div className="columna" style={{ gap: 20, alignItems: 'flex-start' }}>
              <p className="texto-fijo max-440">
                Dime dónde estás y lo tengo en cuenta al montar las próximas convocatorias. Si se
                juntan varias en una misma zona, la abro ahí.
              </p>
              <AvisarCiudad />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
