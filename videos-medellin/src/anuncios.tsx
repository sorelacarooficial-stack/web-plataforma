import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BloqueTexto, Certificado, Contador, Etiquetas, Fechas, Plazas, useFoto } from './graficos';
import { duraVoz, EscenarioSorela } from './sorela';
import { Montaje, Plano } from './montaje';
import { Antetitulo, Cierre, media, Pildora, Tarjeta3D, Titular, useFormato, useU } from './piezas';
import { C } from './tema';

/* Piezas que se repiten entre anuncios */

const FotoPrincipal: React.FC<{ src: string; dura: number; enfoque?: string; video?: boolean; lado?: 1 | -1 }> = ({ src, dura, enfoque, video, lado = 1 }) => {
  const p = useFoto();
  return <Tarjeta3D src={src} video={video} desde={4} dura={dura} {...p} enfoque={enfoque} desdeLado={lado} giro={-12 * lado} />;
};

/** Dos fotos en profundidad: una delante y otra detrás. */
const DosFotos: React.FC<{ a: string; b: string; dura: number; ea?: string; eb?: string }> = ({ a, b, dura, ea, eb }) => {
  const { horizontal, historia } = useFormato();
  const p = useFoto();
  const k = horizontal ? 0.8 : historia ? 0.72 : 0.7;
  return (
    <>
      <Tarjeta3D src={b} desde={2} dura={dura} x={p.x - 230} y={p.y - 90} w={p.w * k} h={p.h * k} giro={16} z={-260} enfoque={eb} desdeLado={-1} />
      <Tarjeta3D src={a} desde={10} dura={dura} x={p.x + 90} y={p.y + 80} w={p.w * k} h={p.h * k} giro={-12} z={60} enfoque={ea} />
    </>
  );
};

const Cifra: React.FC<{ n: number; prefijo?: string; abajo: string; dura: number }> = ({ n, prefijo, abajo }) => {
  const largo = String(n).length + (prefijo?.length ?? 0) > 3;
  const { horizontal } = useFormato();
  return (
    <BloqueTexto centro={horizontal}>
      <div style={{ flex: horizontal ? undefined : 0.55 }} />
      <Contador hasta={n} prefijo={prefijo} desde={2} tam={largo ? 250 : horizontal ? 330 : 420} />
      <Titular texto={abajo} desde={14} tam={84} ancho={900} alinear={horizontal ? 'center' : 'left'} />
    </BloqueTexto>
  );
};

/* ─────────────── A1 · Autoridad ─────────────── */

export const planosAutoridad: Plano[] = [
  { dura: 70, el: (d) => <Cifra n={30} abajo={'años con las manos\nen el **cuerpo**.'} dura={d} /> },
  { dura: 70, el: (d) => <Cifra n={25000} prefijo="+" abajo={'casos que la\n**avalan**.'} dura={d} /> },
  {
    dura: 110,
    el: (d) => (
      <>
        <FotoPrincipal src={media('sorela-retrato.webp')} dura={d} enfoque="50% 18%" />
        <BloqueTexto>
          <Antetitulo texto="Sorela Caro" />
          <Titular texto={'Creó un **método**.\nAhora lo enseña.'} desde={6} tam={92} />
        </BloqueTexto>
        <Etiquetas items={[{ t: 'Creadora de la Técnica Divine®', x: 40, y: 760 }]} desde={30} />
      </>
    ),
  },
  {
    dura: 110,
    el: (d) => (
      <>
        <DosFotos a={media('sorela-corrigiendo.webp')} b={media('historia.webp')} dura={d} ea="50% 25%" eb="50% 30%" />
        <BloqueTexto>
          <Titular texto={'En persona.\nCon tus manos,\n**corregidas por ella**.'} tam={88} />
        </BloqueTexto>
      </>
    ),
  },
  {
    dura: 95,
    oscuro: true,
    el: () => (
      <BloqueTexto centro>
        <Antetitulo texto="Formación presencial" color={C.oroClaro} />
        <Titular texto="**Medellín**" tam={190} color={C.crema} oro alinear="center" desde={4} />
        <div style={{ height: 30 }} />
        <Fechas desde={14} oscuro />
      </BloqueTexto>
    ),
  },
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} /> },
];

/* ─────────────── A2 · Las manos ─────────────── */

const EtiquetasMetodo: React.FC = () => {
  const { horizontal, historia } = useFormato();
  const p = useFoto();
  const dy = historia ? 1 : 0.75;
  const items = horizontal
    ? [
        { t: 'observa', x: p.x - 330, y: -250 },
        { t: 'estimulación ganglionar', x: p.x + 160, y: -60 },
        { t: 'ritmo y velocidad', x: p.x - 280, y: 140 },
        { t: 'arrastre', x: p.x + 200, y: 300 },
      ]
    : [
        { t: 'observa', x: -230, y: p.y - 380 * dy },
        { t: 'estimulación ganglionar', x: 150, y: p.y - 120 * dy },
        { t: 'ritmo y velocidad', x: -170, y: p.y + 140 * dy },
        { t: 'arrastre', x: 230, y: p.y + 380 * dy },
      ];
  return <Etiquetas items={items} desde={26} cada={12} />;
};

export const planosManos: Plano[] = [
  {
    dura: 85,
    el: (d) => (
      <>
        <FotoPrincipal src={media('valoracion-abdomen.webp')} dura={d} enfoque="50% 40%" />
        <BloqueTexto>
          <Titular texto={'Tus manos ya\nsaben **tocar**.'} tam={104} />
        </BloqueTexto>
      </>
    ),
  },
  {
    dura: 130,
    el: (d) => (
      <>
        <FotoPrincipal src={media('sesion-consulta.webp')} dura={d} enfoque="50% 30%" lado={-1} />
        <EtiquetasMetodo />
        <BloqueTexto>
          <Titular texto={'Ahora aprende\na **leer el cuerpo**.'} tam={96} />
        </BloqueTexto>
      </>
    ),
  },
  {
    dura: 110,
    el: (d) => (
      <>
        <FotoPrincipal src={media('sorela-corrigiendo.webp')} dura={d} enfoque="50% 25%" />
        <BloqueTexto>
          <Antetitulo texto="Con Sorela Caro" />
          <Titular texto={'Te mira trabajar.\n**Te corrige.**\nUna a una.'} desde={6} tam={90} />
        </BloqueTexto>
      </>
    ),
  },
  {
    dura: 100,
    oscuro: true,
    el: () => (
      <BloqueTexto centro>
        <Titular texto={'3 días.\n**Medellín.**'} tam={150} color={C.crema} oro alinear="center" />
        <div style={{ height: 40 }} />
        <Fechas desde={18} oscuro />
      </BloqueTexto>
    ),
  },
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} titular={'Aprende la técnica\n**con su creadora**'} /> },
];

/* ─────────────── A3 · Medellín como destino (con Sorela hablando) ─────────────── */

export const planosMedellin: Plano[] = [
  {
    dura: duraVoz('el-cambio', 10),
    voz: { id: 'el-cambio', desde: 10 },
    el: (d) => <EscenarioSorela id="el-cambio" dura={d} voz={10} fondo="Medellín" chips={[{ t: 'Medellín · 28, 29 y 30 de enero', x: 0, y: -600, desde: 4 }]} />,
  },
  {
    dura: 105,
    oscuro: true,
    el: () => (
      <BloqueTexto centro>
        <Antetitulo texto="Formación presencial" color={C.oroClaro} />
        <Fechas desde={4} oscuro />
        <div style={{ height: 24 }} />
        <Titular texto={'Tres días con\n**Sorela Caro**.'} desde={22} tam={92} color={C.crema} oro alinear="center" />
      </BloqueTexto>
    ),
  },
  {
    dura: duraVoz('leer-cuerpo', 8),
    voz: { id: 'leer-cuerpo', desde: 8 },
    el: (d) => (
      <EscenarioSorela
        id="leer-cuerpo"
        dura={d}
        voz={8}
        fondo="enero"
        giro={-1}
        chips={[
          { t: 'observa', x: -220, y: -600, desde: 30 },
          { t: 'estimulación ganglionar', x: 120, y: -500, desde: 60 },
        ]}
      />
    ),
  },
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} /> },
];

/* ─────────────── A4 · Solo 10 plazas (con Sorela hablando) ─────────────── */

const PlazasOscuro: React.FC = () => {
  const { horizontal } = useFormato();
  return (
    <BloqueTexto centro>
      <Titular texto={'Por eso, en Medellín,\n**solo 10 plazas**.'} tam={horizontal ? 96 : 104} color={C.crema} oro alinear="center" />
      <div style={{ height: 34 }} />
      <Plazas desde={16} oscuro tam={horizontal ? 120 : 150} />
    </BloqueTexto>
  );
};

export const planosPlazas: Plano[] = [
  {
    dura: duraVoz('lo-que-frena', 3),
    voz: { id: 'lo-que-frena', desde: 3 },
    el: (d) => <EscenarioSorela id="lo-que-frena" dura={d} voz={3} fondo="práctica" chips={[{ t: 'Sorela Caro · 30 años', x: 0, y: -600, desde: 6 }]} />,
  },
  { dura: 120, oscuro: true, el: () => <PlazasOscuro /> },
  {
    dura: 110,
    el: (d) => (
      <>
        <FotoPrincipal src={media('sorela-corrigiendo.webp')} dura={d} enfoque="50% 25%" />
        <BloqueTexto>
          <Titular texto={'Para corregir\n**tus manos**,\nuna a una.'} tam={96} />
        </BloqueTexto>
      </>
    ),
  },
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} titular={'Reserva una de las\n**10 plazas**'} /> },
];

/* ─────────────── A5 · Fórmate y certifícate con la creadora (con Sorela hablando) ─────────────── */

const Diploma: React.FC = () => {
  const { horizontal, historia } = useFormato();
  return (
    <>
      <Certificado desde={4} x={horizontal ? 420 : 0} y={horizontal ? 0 : historia ? 180 : 140} />
      <BloqueTexto>
        <Titular texto={'Fórmate con ella.\nY **certifícate**.'} tam={100} desde={10} />
      </BloqueTexto>
    </>
  );
};

export const planosCertificado: Plano[] = [
  {
    dura: duraVoz('soy-sorela', 3, 8),
    voz: { id: 'soy-sorela', desde: 3 },
    el: (d) => <EscenarioSorela id="soy-sorela" dura={d} voz={3} fondo="Divine®" chips={[{ t: 'Creadora de la Técnica Divine®', x: 0, y: -600, desde: 4 }]} />,
  },
  {
    dura: duraVoz('treinta-anos', 4),
    voz: { id: 'treinta-anos', desde: 4 },
    el: (d) => (
      <EscenarioSorela
        id="treinta-anos"
        dura={d}
        voz={4}
        fondo="30 años"
        giro={-1}
        chips={[
          { t: '30 años de práctica', x: -170, y: -600, desde: 20 },
          { t: '+25.000 casos', x: 190, y: -500, desde: 50 },
        ]}
      />
    ),
  },
  { dura: 120, el: () => <Diploma /> },
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} titular={'Medellín\n**28, 29 y 30 de enero**'} /> },
];

/* ─────────────── Landing (30-45 s) ─────────────── */

export const planosLanding: Plano[] = [
  {
    dura: 120,
    el: (d) => (
      <>
        <FotoPrincipal src={media('sorela-habla-2.mp4')} video dura={d} enfoque="50% 30%" />
        <BloqueTexto>
          <Antetitulo texto="Sorela Caro" />
          <Titular texto={'30 años.\n**+25.000 casos.**'} desde={6} tam={100} />
        </BloqueTexto>
      </>
    ),
  },
  {
    dura: 110,
    el: (d) => (
      <>
        <FotoPrincipal src={media('sorela-retrato.webp')} dura={d} enfoque="50% 18%" lado={-1} />
        <BloqueTexto>
          <Titular texto={'La **Técnica Divine®**,\nenseñada por\nsu creadora.'} tam={86} />
        </BloqueTexto>
      </>
    ),
  },
  {
    dura: 130,
    el: (d) => (
      <>
        <FotoPrincipal src={media('sesion-consulta.webp')} dura={d} enfoque="50% 30%" />
        <EtiquetasMetodo />
        <BloqueTexto>
          <Titular texto={'Aprende a\n**leer el cuerpo**.'} tam={96} />
        </BloqueTexto>
      </>
    ),
  },
  {
    dura: 110,
    el: (d) => (
      <>
        <DosFotos a={media('sorela-corrigiendo.webp')} b={media('sorela-alumna.webp')} dura={d} ea="50% 25%" eb="62% 30%" />
        <BloqueTexto>
          <Titular texto={'Con tus manos,\n**corregidas por ella**.'} tam={88} />
        </BloqueTexto>
      </>
    ),
  },
  {
    dura: 120,
    oscuro: true,
    el: () => (
      <BloqueTexto centro>
        <Titular texto="**Medellín**" tam={170} color={C.crema} oro alinear="center" />
        <div style={{ height: 30 }} />
        <Fechas desde={12} oscuro />
      </BloqueTexto>
    ),
  },
  {
    dura: 110,
    oscuro: true,
    el: () => {
      const { horizontal } = useFormato();
      return (
        <BloqueTexto centro>
          <Titular texto={'Solo **10** plazas.'} tam={110} color={C.crema} oro alinear="center" />
          <div style={{ height: 30 }} />
          <Plazas desde={12} oscuro tam={horizontal ? 110 : 140} />
        </BloqueTexto>
      );
    },
  },
  { dura: 150, cierre: true, el: (d) => <Cierre dura={d} /> },
];

/** Más aire para leer: cada plano (menos el cierre) dura un 20 % más. */
const aire = (ps: Plano[]): Plano[] => ps.map((p) => (p.cierre || p.voz ? p : { ...p, dura: Math.round(p.dura * 1.2) }));

export const ANUNCIOS = {
  autoridad: aire(planosAutoridad),
  manos: aire(planosManos),
  medellin: planosMedellin,
  plazas: planosPlazas,
  certificado: planosCertificado,
  landing: aire(planosLanding).map((p) => (p.cierre ? p : { ...p, dura: Math.round(p.dura * 1.1) })),
};

export const Anuncio: React.FC<{ id: keyof typeof ANUNCIOS }> = ({ id }) => (
  <AbsoluteFill>
    <Montaje planos={ANUNCIOS[id]} />
  </AbsoluteFill>
);

export { Pildora, useU };
