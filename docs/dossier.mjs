/**
 * Escribe `docs/dossier.html` a partir del contenido reescrito.
 *
 *   node docs/dossier.mjs
 *
 * El contenido NO se escribe a mano en el HTML: vive en un JSON con bloques
 * —títulos, párrafos, listas, destacados, avisos, cifras— y esto solo lo
 * maqueta. Así, corregir una frase es corregir el JSON y volver a imprimir, en
 * lugar de bucear en etiquetas.
 *
 * El PDF lo imprime después `docs/generar.mjs`, con el mismo Chromium y las
 * mismas tipografías del repositorio que los demás documentos.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ILUSTRACIONES } from './ilustraciones.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const ORIGEN =
  process.env.DOSSIER_JSON ||
  '/tmp/claude-0/-home-claude-repo/6dc5003f-e043-5a97-b6a7-877642377e91/scratchpad/dossier-limpio.json';

const { secciones } = JSON.parse(readFileSync(ORIGEN, 'utf8'));

const escapar = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Un bloque, a HTML. Lo que no reconozca, no lo pinta: mejor un hueco que basura. */
function bloque(b) {
  const t = escapar(b.texto);
  switch (b.tipo) {
    case 'h2':
      return `      <h2>${t}</h2>`;
    case 'h3':
      return `      <h3>${t}</h3>`;
    case 'p':
      return `      <p>${t}</p>`;
    case 'lista':
      return `      <ul class="lista">\n${(b.items ?? [])
        .map((i) => `        <li>${escapar(i)}</li>`)
        .join('\n')}\n      </ul>`;
    case 'destacado':
      return `      <div class="destacado">${
        b.etiqueta ? `<span class="rotulo">${escapar(b.etiqueta)}</span>` : ''
      }<p>${t}</p></div>`;
    case 'aviso':
      return `      <div class="aviso">${
        b.etiqueta ? `<span class="rotulo">${escapar(b.etiqueta)}</span>` : ''
      }<p>${t}</p></div>`;
    case 'dato':
      return `      <div class="dato"><span class="datoRotulo">${escapar(
        b.etiqueta ?? ''
      )}</span><p class="datoTexto">${t}</p></div>`;
    default:
      return '';
  }
}

const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Una figura: la imagen y su pie.
 *
 * Las láminas de anatomía llevan `lamina`, que las pinta sobre papel claro con
 * un filete alrededor en vez de a sangre. No es un capricho: son dibujos con
 * rótulos pequeños sobre fondo blanco, y recortarlos a sangre les come las
 * letras de los bordes, que es justo lo que hay que poder leer.
 */
function figura(f, clase = 'figura') {
  const clases = [clase, f.lamina ? 'figuraLamina' : '', f.alto ? 'figuraAlta' : '']
    .filter(Boolean)
    .join(' ');
  return `      <figure class="${clases}">
        <img src="${escapar(f.src)}" alt="">
        ${f.pie ? `<figcaption>${escapar(f.pie)}</figcaption>` : ''}
      </figure>`;
}

function galeria(g) {
  return `      <section class="galeria">
        <h3 class="galeriaTitulo">${escapar(g.titulo)}</h3>
        <div class="galeriaRejilla">
${g.fotos.map((src) => `          <img src="${escapar(src)}" alt="">`).join('\n')}
        </div>
        ${g.pie ? `<p class="galeriaPie">${escapar(g.pie)}</p>` : ''}
      </section>`;
}

const cuerpo = secciones
  .map((s, i) => {
    const entradilla = s.entradilla
      ? `\n        <p class="seccionEntradilla">${escapar(s.entradilla)}</p>`
      : '';
    const ilustra = ILUSTRACIONES[i] ?? {};

    /* Las imágenes de dentro se insertan POR POSICIÓN, detrás del bloque que
       les toca. Se recorre la lista una sola vez y se va mirando si a este
       bloque le sigue alguna: así una imagen mal colocada no desplaza el resto
       del texto, solo se queda donde estaba. */
    const dentro = new Map((ilustra.dentro ?? []).map((f) => [f.tras, f]));
    const pintados = [];
    s.bloques.forEach((b, j) => {
      const html = bloque(b);
      if (html) pintados.push(html);
      const f = dentro.get(j);
      if (f) pintados.push(figura(f));
    });

    return `    <section class="seccion">
      <header class="seccionCabeza">
        <span class="seccionNum">Parte ${romanos[i] ?? i + 1}</span>
        <h1 class="seccionTitulo">${escapar(s.titulo)}</h1>${entradilla}
      </header>
${ilustra.apertura ? figura(ilustra.apertura, 'figura figuraApertura') + '\n' : ''}${pintados.join('\n')}
${ilustra.galeria ? galeria(ilustra.galeria) : ''}
    </section>`;
  })
  .join('\n\n');

const indice = secciones
  .map(
    (s, i) => `        <li>
          <span class="indiceNum">${romanos[i] ?? i + 1}</span>
          <span class="indiceTexto">${escapar(s.titulo)}${
            s.entradilla ? `<span class="indiceSub">${escapar(s.entradilla)}</span>` : ''
          }</span>
        </li>`
  )
  .join('\n');

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Dossier · Precurso Técnica Divine</title>
  <link rel="stylesheet" href="estilo-dossier.css">
</head>
<body>

  <section class="portada">
    <img class="portadaFondo" src="./impresion/rostro.jpg" alt="">
    <div class="marca">
      <img src="../app/icon.png" alt="">
      <span>
        <span class="marcaNombre">SORELA CARO</span>
        <span class="marcaPie">Técnica Divine</span>
      </span>
    </div>

    <div class="portadaCentro">
      <span class="sello">Precurso oficial</span>
      <h1 class="portadaTitulo">Juventud<em>linfática</em></h1>
      <p class="portadaEntradilla">
        El dossier de la formación presencial en Técnica Divine: el sistema linfático,
        el protocolo de trabajo y las contraindicaciones.
      </p>
    </div>

    <div class="portadaPie">
      <span>Sorela Caro · Formación en estética avanzada</span>
      <span>Documento confidencial</span>
    </div>
  </section>

  <section class="indice">
    <span class="seccionNum" style="color:var(--oro)">Contenido</span>
    <h1 class="seccionTitulo" style="font-size:30pt;margin-top:2mm">Índice</h1>
    <ol class="indiceLista">
${indice}
    </ol>
  </section>

${cuerpo}

  <section class="cierre">
    <h1 class="cierreTitulo">Prepárate para el<em> éxito</em></h1>
    <p class="cierreTexto">
      Este dossier acompaña a la formación presencial. Lo que no está escrito aquí
      se trabaja con las manos, sobre el cuerpo, durante los dos días.
    </p>
    <p class="confidencial">
      Documento confidencial. Su contenido está protegido por el acuerdo de
      confidencialidad y no divulgación que firma cada alumna antes de la formación:
      no puede reproducirse, modificarse, hacerse público ni divulgarse a terceros sin
      autorización escrita y expresa de Sorela Caro.
    </p>
  </section>

</body>
</html>`;

writeFileSync(path.join(AQUI, 'dossier.html'), html);
console.log(`dossier.html escrito · ${secciones.length} secciones · ${html.length} caracteres`);
