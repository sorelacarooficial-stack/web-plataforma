---
name: videos-sorela
description: Edición de los vídeos de Sorela Caro (plataforma, «Empieza aquí», clases cortas) con el motor Remotion de `videos/`. Úsala siempre que haya que editar un vídeo crudo de Sorela hablando a cámara, ponerle subtítulos, tarjetas de la plataforma o el cierre de marca. Adapta la skill «super-videos» de Gerson a la marca de Sorela.
---

# Vídeos de Sorela (v1, 19-nov-2026)

Un crudo de Sorela hablando a cámara → un vídeo de plataforma con acabado de
autoridad: limpio, cálido, caro. Todo vive en `videos/` (proyecto Remotion
propio, no toca la web).

## El estilo (lo que manda)
Viene de la skill «super-videos» (técnica del estilo ESTUDIO: pocas piezas muy
bien elegidas, palabra clave grande, acercamientos, curvas suaves), **pero en
la marca de Sorela**. Nada de letra pixel ni fondos rojo/azul: eso es de basis.

- **Tipografía**: Inter. Titulares en 300 con tracking cerrado (−0,035/−0,045 em),
  la palabra clave en 600. Sin mayúsculas. Texto pequeño en 400.
- **Color**: crema `#f4efe7`, tinta `#141210`, oro `#8a6a32` y degradado
  `#f3d9ae → #c99a5c`, bandas oscuras `#17140f`.
- **Autoridad**: rótulo al empezar («Sorela **Caro** · creadora de la Técnica
  Divine® · 30 años · +25.000 casos») con línea de oro que se dibuja, y chip
  «Empieza aquí · NN · título» arriba a la izquierda.
- **Subtítulos** palabra a palabra: entran con desenfoque 10→0 px y suben 14 px;
  las palabras clave en 600 con el degradado de oro. Abajo, con un velo oscuro
  suave que no toca la cara.
- **Cámara**: deriva lenta 100→102,5 % y **acercamiento 100→106 %** en cada
  palabra clave (sube 0,6 s, aguanta, baja), origen a la altura de los ojos.
- **Tarjetas de cristal oscuro** (estilo UI de la plataforma) a un lado, nunca
  encima de la cara: zona, título, filas con ✓ / anillo de oro / candado, y
  botón dorado que «se pulsa» («Marcar como vista»). Entran con giro 3D
  (rotateY) + desenfoque por velocidad + brillo que cruza el cristal.
  Ojo: `CameraMotionBlur` rompe el `backdrop-filter`; en las tarjetas el
  desenfoque de movimiento se calcula por velocidad.
- **Cierre oscuro por capas** (crema → oro → tinta suben una tras otra), con el
  logo dentro de un medallón de cristal que gira en 3D y «Tu tarea: …».
- **Sonido**: voz a −16 LUFS (filtro de graves, compresión suave, loudnorm) y
  cama de piano muy baja (`videos/public/musica/cama.mp3`, ElevenLabs).
- **Color de la imagen**: un poco más cálido y limpio (eq + colorbalance + unsharp).
- Sin promesas de salud ni de resultados. Nada tapa la cara.

## El flujo
1. **Transcribir** cada crudo con ElevenLabs Scribe (`creative_transcribe_audio`,
   eleven_scribe_v1, tiempos por palabra). `creative_attach_reference_file`
   necesita una URL que diga `audio/mpeg` (los enlaces de Drive NO valen: no
   mandan tipo). Guarda `{text, words}` en `videos/transcripciones/<crudo>.json`.
2. **Ficha** en `videos/fichas/<id>.json` (mira las que hay):
   - `partes`: uno o varios crudos en orden (`$CRUDOS/x.mov` + su transcripción;
     `quitar` = tropiezos en segundos de ese crudo). Así se unen dos tomas.
   - `corregir`: arregla el subtítulo («IVAL» → «Divine»; `null` lo quita).
   - `claves`: palabras en oro 600 + acercamiento 106 %.
   - `tarjetas`: ancladas a palabras (`en`, `hasta` o `dura`; «una#2» = la
     segunda vez que sale). Lado contrario a lo que haya: el rótulo ocupa la
     izquierda los primeros 5 s.
   - `cierre`: la tarea de la lección.
3. `cd videos && npm install` (la primera vez).
4. `CRUDOS=/ruta/crudos node scripts/preparar.mjs fichas/<id>.json` → quita
   silencios > 0,5 s y lo de `quitar`, corrige color y audio, 1920×1080, y
   escribe `guiones/<id>.json`. Con `--solo-guion` solo rehace el guion
   (tarjetas, claves) sin volver a cortar el vídeo.
5. **Fotogramas antes de renderizar**:
   `node scripts/render.mjs <id> --fotogramas 2,8,15` → PNG en `videos/salida/`.
   Revisa: rótulo legible, tarjeta sin tapar la cara, subtítulo en una línea.
6. **Render**: `node scripts/render.mjs <id> --salida ../public/empieza-aqui/NN.mp4`
   → MP4 H.264 con faststart (~1 MB cada 4 s) y póster `.jpg` al lado. Unos
   8-10 min por cada 40 s. Todo de golpe, de dos en dos:
   `CRUDOS=… bash scripts/todos.sh --render`.
7. En `lib/empieza-aqui.ts`, `video: '/empieza-aqui/NN.mp4'` en su lección (el
   reproductor coge solo el póster `.jpg`).

Los crudos y los `base.mp4` no se suben al repositorio (solo el MP4 final y su póster).
Chromium: `/opt/pw-browsers/chromium` (o la variable `CHROMIUM`).
