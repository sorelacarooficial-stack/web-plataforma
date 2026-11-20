import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AperturaAutoridad, AperturaCertificado, AperturaManos, AperturaMedellin, AperturaPlazas } from './aperturas';
import { Escena3D } from './escena3d';
import { BloqueTexto, Certificado, Contador, Fechas, Lista, Plazas } from './graficos';
import { Montaje, Plano, SOLAPE } from './montaje';
import { Antetitulo, Cierre, Titular, useFormato } from './piezas';
import { C } from './tema';
import { finVoz, fotogramaPalabra } from './voz';

/*
 * Medellín v2. Solo las fotos de Sorela (fotos/): ningún plano ni frase de los
 * vídeos de la plataforma. Cada pieza:
 *  · 0-3 s: encabezado con qué es, para quién y quién lo enseña (se entiende sin sonido);
 *  · la voz clonada de Sorela (aprobada) con su guion, subtitulada palabra a palabra;
 *  · cada plano entra con la frase que le toca (cortes por frase de la locución);
 *  · su propia música y efectos, y el cierre oscuro por capas.
 */

type Escena = { desde: number; oscuro?: boolean; el: (dura: number) => React.ReactNode };

/** Convierte escenas que empiezan en una palabra de la locución en planos con su duración. */
const conVoz = (voz: string, escenas: Escena[], cierre: Plano): Plano[] => {
  const inicio = (i: number) => (i === 0 ? 0 : Math.max(105, fotogramaPalabra(voz, escenas[i].desde) - 6));
  const fin = finVoz(voz) + 14;
  const planos: Plano[] = escenas.map((e, i) => {
    const a = inicio(i);
    const b = i + 1 < escenas.length ? inicio(i + 1) : fin;
    return { dura: b - a + SOLAPE, oscuro: e.oscuro, el: e.el };
  });
  return [...planos, cierre];
};

const foto = (o: Omit<React.ComponentProps<typeof Escena3D>, 'dura'>) => (d: number) => <Escena3D {...o} dura={d} />;

const FechasOscuro: React.FC<{ titular: string; ante?: string }> = ({ titular, ante = 'Formación presencial para terapeutas' }) => (
  <BloqueTexto centro>
    <Antetitulo texto={ante} color={C.oroClaro} />
    <Fechas desde={4} oscuro />
    <div style={{ height: 24 }} />
    <Titular texto={titular} desde={16} tam={84} color={C.crema} oro alinear="center" />
  </BloqueTexto>
);

const PlazasOscuro: React.FC = () => {
  const { horizontal } = useFormato();
  return (
    <BloqueTexto centro>
      <Antetitulo texto="Formación presencial · Medellín" color={C.oroClaro} />
      <Titular texto={'**10 plazas**.\nNi una más.'} tam={horizontal ? 96 : 104} color={C.crema} oro alinear="center" />
      <div style={{ height: 30 }} />
      <Plazas desde={10} oscuro tam={horizontal ? 112 : 136} />
    </BloqueTexto>
  );
};

const Cifras: React.FC = () => {
  const { horizontal } = useFormato();
  return (
    <BloqueTexto centro>
      <Antetitulo texto="Sorela Caro · creadora de la Técnica Divine®" color={C.oroClaro} />
      <div style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', gap: horizontal ? 140 : 30, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Contador hasta={30} desde={2} tam={horizontal ? 250 : 280} />
          <Titular texto="años de **práctica**" desde={10} tam={56} color={C.crema} alinear="center" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <Contador hasta={25000} prefijo="+" desde={10} dura={40} tam={horizontal ? 210 : 220} />
          <Titular texto="**casos**" desde={20} tam={56} color={C.crema} alinear="center" />
        </div>
      </div>
    </BloqueTexto>
  );
};

const Diploma: React.FC = () => {
  const { horizontal, historia } = useFormato();
  return (
    <>
      <Certificado desde={4} x={horizontal ? 420 : 0} y={horizontal ? 0 : historia ? 60 : 20} />
      <BloqueTexto>
        <Titular texto={'Práctica real\ny tu **certificación**.'} tam={92} desde={8} />
      </BloqueTexto>
    </>
  );
};

const LoQueTeLlevas: React.FC = () => {
  const { horizontal } = useFormato();
  return (
    <BloqueTexto centro={!horizontal}>
      <Titular texto={'Todo lo que\n**te llevas**.'} tam={92} alinear={horizontal ? 'left' : 'center'} />
      <div style={{ height: 16 }} />
      <Lista desde={10} items={['Formación online completa', '3 días presenciales con Sorela', 'Certificación Técnica Divine®']} />
    </BloqueTexto>
  );
};

/* ─────────────── A1 · Autoridad: quién es Sorela ─────────────── */

export const planosAutoridad = conVoz(
  'autoridad',
  [
    { desde: 0, oscuro: true, el: (d) => <AperturaAutoridad dura={d} /> },
    { desde: 8, el: foto({ foto: 'sorela-retrato.webp', segunda: 'historia.webp', enfoque: '50% 16%', fondo: 'Sorela', chips: [{ t: 'Sorela Caro · creadora del método', x: 0, y: -0.86, desde: 6 }] }) },
    { desde: 19, el: foto({ foto: 'sorela-corrigiendo.webp', enfoque: '50% 25%', fondo: 'en persona', giro: -1, chips: [{ t: 'Para terapeutas y esteticistas', x: 0, y: -0.86, desde: 8 }] }) },
    { desde: 30, oscuro: true, el: () => <FechasOscuro titular={'Tres días en\n**Medellín**.'} /> },
  ],
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} /> },
);

/* ─────────────── A2 · Las manos: qué aprendes ─────────────── */

export const planosManos = conVoz(
  'manos',
  [
    { desde: 0, oscuro: true, el: (d) => <AperturaManos dura={d} /> },
    { desde: 8, el: foto({ foto: 'sorela-corrigiendo.webp', enfoque: '50% 25%', fondo: 'leer', giro: -1, chips: [{ t: 'Formación presencial', x: 0, y: -0.86, desde: 6 }] }) },
    {
      desde: 17,
      el: foto({
        foto: 'sesion-consulta.webp',
        segunda: 'trabajo-lumbar.webp',
        enfoque: '50% 35%',
        fondo: 'cuerpo',
        chips: [
          { t: 'observa', x: -0.42, y: -0.84, desde: 4 },
          { t: 'estimulación ganglionar', x: 0.12, y: -0.62, desde: 56 },
          { t: 'ritmo', x: -0.4, y: -0.38, desde: 116 },
          { t: 'arrastre', x: 0.4, y: -0.16, desde: 140 },
        ],
      }),
    },
    { desde: 30, oscuro: true, el: () => <FechasOscuro titular={'3 días conmigo.\n**Medellín.**'} /> },
  ],
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} titular={'Aprende la técnica\n**con su creadora**'} /> },
);

/* ─────────────── A3 · Medellín como destino ─────────────── */

export const planosMedellin = conVoz(
  'medellin',
  [
    { desde: 0, el: (d) => <AperturaMedellin dura={d} /> },
    { desde: 10, el: foto({ foto: 'valoracion-abdomen.webp', segunda: 'trabajo-lumbar.webp', enfoque: '50% 40%', fondo: 'drenaje', giro: -1, chips: [{ t: 'drenaje y moldeo · solo con las manos', x: 0, y: -0.86, desde: 6 }] }) },
    { desde: 20, el: foto({ foto: 'sorela-corrigiendo.webp', enfoque: '50% 25%', fondo: 'enero', chips: [{ t: 'Medellín · 28, 29 y 30 de enero', x: 0, y: -0.86, desde: 6 }] }) },
    { desde: 26, el: foto({ foto: 'sorela-alumna.webp', segunda: 'sorela-corrigiendo.webp', enfoque: '62% 30%', fondo: 'a mi lado', chips: [{ t: 'con certificación', x: 0, y: -0.86, desde: 40 }] }) },
  ],
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} titular={'Te espero en\n**Medellín**'} /> },
);

/* ─────────────── A4 · Solo 10 plazas: por qué tan pocas ─────────────── */

export const planosPlazas = conVoz(
  'plazas',
  [
    { desde: 0, oscuro: true, el: () => <AperturaPlazas /> },
    { desde: 15, el: foto({ foto: 'sorela-corrigiendo.webp', enfoque: '50% 25%', fondo: 'una a una', chips: [{ t: 'corrección una a una', x: 0, y: -0.86, desde: 6 }] }) },
    { desde: 28, el: foto({ foto: 'sorela-alumna.webp', enfoque: '62% 30%', fondo: 'enero', giro: -1, chips: [{ t: 'Medellín · 28, 29 y 30 de enero', x: 0, y: -0.86, desde: 6 }] }) },
  ],
  { dura: 130, cierre: true, el: (d) => <Cierre dura={d} titular={'Reserva una de las\n**10 plazas**'} /> },
);

/* ─────────────── A5 · Fórmate y certifícate con la creadora ─────────────── */

export const planosCertificado = conVoz(
  'certificado',
  [
    { desde: 0, el: () => <AperturaCertificado /> },
    { desde: 10, el: foto({ foto: 'sorela-retrato.webp', segunda: 'historia.webp', enfoque: '50% 16%', fondo: 'creadora', giro: -1, chips: [{ t: 'Sorela Caro · creadora del método', x: 0, y: -0.86, desde: 6 }] }) },
    { desde: 16, el: foto({ foto: 'sorela-corrigiendo.webp', enfoque: '50% 25%', fondo: '3 días', chips: [{ t: '3 días presenciales · Medellín', x: 0, y: -0.86, desde: 6 }] }) },
    { desde: 22, el: () => <LoQueTeLlevas /> },
  ],
  { dura: 140, cierre: true, el: (d) => <Cierre dura={d} titular={'Fórmate con\n**su creadora**'} /> },
);

/* ─────────────── Landing (≈ 36 s) ─────────────── */

export const planosLanding = conVoz(
  'landing',
  [
    { desde: 0, el: foto({ foto: 'sorela-retrato.webp', enfoque: '50% 16%', fondo: 'Sorela', portada: true }) },
    { desde: 8, oscuro: true, el: () => <Cifras /> },
    { desde: 21, el: foto({ foto: 'historia.webp', segunda: 'credenciales.webp', enfoque: '40% 30%', fondo: 'en persona', giro: -1 }) },
    { desde: 27, el: foto({ foto: 'sorela-alumna.webp', segunda: 'sorela-corrigiendo.webp', enfoque: '62% 30%', fondo: 'terapeutas', chips: [{ t: 'terapeutas · esteticistas · masajistas', x: 0, y: -0.86, desde: 8 }] }) },
    {
      desde: 42,
      el: foto({
        foto: 'sesion-consulta.webp',
        segunda: 'trabajo-lumbar.webp',
        enfoque: '50% 35%',
        fondo: 'cuerpo',
        giro: -1,
        chips: [
          { t: 'leer el cuerpo', x: -0.3, y: -0.84, desde: 6 },
          { t: 'corrección una a una', x: 0.2, y: -0.62, desde: 70 },
        ],
      }),
    },
    { desde: 56, oscuro: true, el: () => <FechasOscuro ante="Medellín · enero de 2027" titular={'Tres días\n**conmigo**.'} /> },
    { desde: 63, oscuro: true, el: () => <PlazasOscuro /> },
  ],
  { dura: 150, cierre: true, el: (d) => <Cierre dura={d} /> },
);

/** Cada pieza con su voz, su música y sus efectos (ninguna repite pista). */
export const ANUNCIOS = {
  autoridad: { planos: planosAutoridad, voz: 'autoridad', encabezado: false as const, musica: 'musica-autoridad.mp3', paso: 'barrido.mp3', golpe: 'piano-golpe.mp3' },
  manos: { planos: planosManos, voz: 'manos', musica: 'musica-manos.mp3', paso: 'destello.mp3', golpe: 'golpe.mp3', encabezado: false as const },
  medellin: { planos: planosMedellin, voz: 'medellin', encabezado: false as const, musica: 'musica-medellin.mp3', paso: 'whoosh.mp3', golpe: 'piano-golpe.mp3' },
  plazas: { planos: planosPlazas, voz: 'plazas', encabezado: false as const, musica: 'musica-plazas.mp3', paso: 'barrido.mp3', golpe: 'golpe.mp3' },
  certificado: { planos: planosCertificado, voz: 'certificado', musica: 'musica-certificado.mp3', paso: 'destello.mp3', golpe: 'piano-golpe.mp3', encabezado: false as const },
  landing: { planos: planosLanding, voz: 'landing', musica: 'musica-landing.mp3', paso: 'whoosh.mp3', golpe: 'golpe.mp3' },
};

export const Anuncio: React.FC<{ id: keyof typeof ANUNCIOS }> = ({ id }) => (
  <AbsoluteFill>
    <Montaje {...ANUNCIOS[id]} />
  </AbsoluteFill>
);
