import type { Metadata } from 'next';
import AvisarCiudad from '@/components/AvisarCiudad';
import BotonAsistente from '@/components/BotonAsistente';
import BotonCaptacion from '@/components/BotonCaptacion';
import DatosEstructurados, { GrafoJsonLd } from '@/components/DatosEstructurados';
import Apiladas from '@/components/landing/Apiladas';
import { nodosConvocatorias, proximasPublicas } from '@/lib/convocatorias';
import ProximasFechas from './ProximasFechas';
import css from './formaciones.module.css';

/**
 * La página se genera una vez y se guarda (ISR). Se rehace como mucho cada
 * hora —así una fecha que ya ha empezado deja de salir sin que nadie toque
 * nada— y al momento cuando Sorela cambia una convocatoria o una inscrita
 * (lib/convocatorias.ts llama a revalidatePath).
 */
export const revalidate = 3600;

const TITULO = 'Curso de drenaje linfático manual, online y presencial';

/**
 * Junto con la portada, es la página que pelea por la búsqueda principal: una
 * esteticista que quiere formarse. La portada dice «formación» y esta dice
 * «curso», que es la otra manera de buscarlo, para que no compitan entre sí.
 *
 * La descripción solo promete fechas cuando las hay en la página: prometer en
 * Google lo que la página no da es peor que no salir. Con fechas, dice dónde;
 * nunca el precio.
 */
export async function generateMetadata(): Promise<Metadata> {
  const fechas = await proximasPublicas();
  if (fechas.length === 0) {
    return {
      title: { absolute: TITULO },
      description:
        'Primero la formación online, después dos días presenciales conmigo sobre modelos reales. Aún no hay fechas cerradas: dime tu ciudad y te guardo el sitio.',
    };
  }
  const ciudades = [...new Set(fechas.map((f) => f.ciudad))];
  const donde = ciudades.length === 1 ? ciudades[0] : `${ciudades.slice(0, -1).join(', ')} y ${ciudades[ciudades.length - 1]}`;
  return {
    title: { absolute: TITULO },
    description: `Primero la formación online, después dos días presenciales conmigo sobre modelos reales. Próximas fechas en ${donde}: reserva tu plaza.`,
  };
}

/**
 * Formaciones.
 *
 * Esta página enseñaba tres convocatorias con ciudad, fecha, precio y plazas
 * («Madrid, 14-16 de noviembre, 1.450 €, quedan 3 de 8»). Ninguno de esos
 * datos era real: venían del prototipo de diseño, y se quitaron.
 *
 * Ahora las fechas son las de verdad: las convocatorias que Sorela crea en la
 * plataforma (Contenido › Formaciones) y marca con «Mostrar en la web». Si hay
 * alguna por delante, sale «Próximas fechas» con la ciudad, los días, el
 * horario y si quedan plazas; nunca el precio ni los nombres. Si no hay
 * ninguna, la página queda como estaba: el recorrido y «te guardo el sitio».
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

export default async function Formaciones() {
  const fechas = await proximasPublicas();
  const hayFechas = fechas.length > 0;

  /* Con fechas, el curso presencial se declara junto a ellas (con su
     `hasCourseInstance`) en vez de en el bloque general: un mismo curso
     descrito en dos bloques sueltos Google no siempre lo junta. */
  const presencial = CURSOS.find((c) => c.ancla === 'presencial');
  const cursos = hayFechas ? CURSOS.filter((c) => c.ancla !== 'presencial') : CURSOS;
  const nodosFechas = hayFechas && presencial
    ? nodosConvocatorias(fechas, {
        presencial: { nombre: presencial.nombre, descripcion: presencial.descripcion, requisitos: presencial.requisitos },
      })
    : [];

  return (
    <main className="pagina">
      <DatosEstructurados
        cursos={cursos}
        migas={[
          { nombre: 'Inicio', ruta: '/' },
          { nombre: 'Formaciones', ruta: '/formaciones' },
        ]}
      />
      {nodosFechas.length > 0 && <GrafoJsonLd nodos={nodosFechas} />}
      <section className={`${css.portada} portada-landing`}>
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
          {/* Las dos etapas, en tarjetas que se apilan al bajar. */}
          <Apiladas
            /* Una clara y otra oscura, como en la portada: con las dos en
               relieve crema sobre el papel no se distinguían. */
            clasesTarjetas={ETAPAS.map((e) => (e.destacada ? css.etapaCajaOscura : css.etapaCajaClara))}
            tarjetas={ETAPAS.map((e) => (
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
          />

          {/* Las fechas. Con convocatorias publicadas, las de verdad. Sin
              ninguna, la respuesta honesta es que no hay ninguna cerrada, y se
              dice así: una fecha que luego se mueve cuesta más que no darla,
              sobre todo cuando alguien ya ha comprado un vuelo. */}
          {hayFechas ? (
            <ProximasFechas fechas={fechas} />
          ) : (
            <div className={`${css.fechas} caja-landing`}>
              <div>
                <p className="antetitulo" style={{ color: 'var(--oro)' }}>
                  Próximas convocatorias
                </p>
                <h2 className={css.fechasTitulo}>Nuevas fechas, pronto.</h2>
                <p className="texto max-520">
                  Ahora mismo no hay ninguna fecha abierta. Apúntate y te escribo en cuanto abra
                  la próxima.
                </p>
              </div>
              <div className={css.fechasAcciones}>
                <BotonCaptacion
                  className="btn btn-md"
                  titulo="Apúntate"
                  entradilla="Déjame tu nombre, tu correo y tu teléfono. Al terminar, el siguiente paso es entrar en el grupo de WhatsApp de la Técnica Divine."
                  etiquetaVentana="Apuntarme a la próxima formación"
                  origen="formacion"
                >
                  Apuntarme
                </BotonCaptacion>
                <BotonAsistente
                  pregunta="Quiero saber cuándo es la próxima formación presencial."
                  className="enlace-subrayado"
                >
                  Preguntar por el asistente
                </BotonAsistente>
              </div>
            </div>
          )}

          <div className={`${css.avisame} caja-landing`}>
            <h2 className={css.avisameTitulo}>¿Tu ciudad no está?</h2>
            <div className="columna" style={{ gap: 20, alignItems: 'flex-start' }}>
              <p className="texto-fijo max-440">
                Dime dónde estás y lo tengo en cuenta al montar las próximas convocatorias. Si se
                juntan varias en una misma zona, la abro ahí.
              </p>
              <AvisarCiudad para="convocatoria" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
