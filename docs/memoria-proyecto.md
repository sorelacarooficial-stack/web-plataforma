# Memoria del proyecto

Lo que se ha decidido y por qué, para que cada sesión de Claude Code arranque
sabiendo dónde estamos. Se carga sola desde CLAUDE.md. **Actualízala al cerrar
cada cambio importante** (una línea por decisión, con la fecha).

## Cómo se trabaja

- Nada va directo a `main`: rama `claude/<tema>` + PR, y el merge lo hace la
  dueña del proyecto. El push directo a main está bloqueado.
- Tokens y claves solo en Vercel (variables de entorno), nunca en el chat ni
  en el repositorio.
- Grafo del código: codebase-memory-mcp. Se instala e indexa solo al arrancar
  la sesión (`scripts/codebase-memory.sh`, hook en `.claude/settings.json`).

## Marca y diseño

- Tipografía única: **Inter** (la de los artefactos y anuncios). Titulares en
  300 con tracking cerrado (-0.035 a -0.045em) y la palabra clave en 600 con
  `<strong>`. Sin mayúsculas en titulares. Texto pequeño en 400, nunca 300.
  (2026-10-20, PR #7)
- Paleta: crema `#f4efe7`, tinta `#141210`, oro `#8a6a32` / degradado
  `#f3d9ae → #c99a5c`. Bandas oscuras `#17140f`.
- Vídeos de anuncios: siempre motion graphics al estilo de los artefactos
  (Inter, crema, captions palabra a palabra con desenfoque, cierre oscuro por
  capas). Nunca foto con zoom.
- Los correos y el PDF del informe mantienen sus fuentes propias.

## Masterclass «Antes de tocar» / «La nueva era de las manos»

- Gratuita, 1 hora, por Zoom. Viernes 6 nov 2026, 19:00 España (15:00 AR,
  14:00 VE, 13:00 CO, 12:00 MX). Landing: `/comunidad`.
- **El precio de la formación no aparece en ningún sitio** (ni landing ni
  anuncios ni correos de captación).
- Formularios solo para mayores de 18 años (2026-10-20, PR #6).
- El enlace de Zoom se pide a Sorela el 5 nov (recordatorio programado).
- Grupo de WhatsApp: los botones pasan por `/grupo`, que cuenta el clic
  (y en la ficha `grupoClic` si el enlace va firmado para la persona) y
  redirige. Solo las apuntadas con `grupoMedido` cuentan en el embudo y
  reciben el recordatorio «Te falta un paso» (cron de la mañana, una vez,
  entre 1 y 10 días). Las personas dentro del grupo las apunta Sorela a mano
  en Métricas. (2026-10-21)
- Los correos van a la lista de espera de la web, NO al grupo de WhatsApp:
  quien está solo en el grupo no recibe nada (ni el Zoom del 6 nov). El
  enlace de Zoom hay que ponerlo también en el grupo.
- CRM: «Te necesitan» = solo quien escribió, preguntó o pidió algo
  (`situacion().grupo === 'te-necesita'`, lib/atencion.ts). Las apuntadas a la
  masterclass van en «Masterclass · van solas» y no llevan «Ya le escribí».
  En la ficha hay una casilla manual «Está en el grupo» (`enGrupo`): WhatsApp
  no deja leer quién está dentro. (2026-10-27)
- A las apuntadas nunca se les habla de la Comunidad Divine, tampoco en el
  mensaje de WhatsApp que propone la ficha: solo de la masterclass.
- Vídeo de invitación de Sorela en la portada de `/comunidad`
  (`components/VideoInvitacion.tsx`, `public/video/`), sin reproducción
  automática; Medidor cuenta reproducciones. (2026-10-31)
- La serie de correos vive en Firestore (Programados): cambiar
  `lib/serie-lanzamiento.ts` no cambia lo ya guardado.

## Meta Ads

- Cuenta Sorela Publi `4080934555473731`, página `405378099553859`, IG
  `@sorelacaro_`, conjunto de datos «Comunidad Divine» `968080569683493`.
- Campaña `120254915227270427` «MC 6 nov · Registros web · CAPI»
  (OUTCOME_LEADS, termina 6 nov 18:00). 10 €/día. Desde 2026-10-22: A España
  3 €, B Latam (CO/AR/VE/MX) 5 €, C Caliente 2 € (a 22 oct: Latam 0,35 €/registro,
  España 4,11 €). Sin Audience Network (daba clics sin registros): solo
  Facebook, Instagram y Threads. Excluye a las ya registradas.
- Sin píxel ni cookies: API de conversiones desde el servidor
  (`lib/meta-capi.ts`, evento Lead con datos cifrados).
- UTM de los anuncios: `utm_source=meta&utm_campaign=mc_6nov&utm_content=<anuncio>`.
- Panel: tarjeta «Campaña de la masterclass» en Métricas; lo de Meta en azul.
  Informe diario a Sorela a las 10:00 (cron en `vercel.json`).
- Variables en Vercel: `META_CAPI_TOKEN`, `META_DATASET_ID`, `META_ADS_TOKEN`
  (token de usuario largo, caduca ~mediados de diciembre).
- Para cambiar anuncios: sustituirlos, no pausar la campaña.
- Desde 2026-10-31: España 2 €, Latam 6 €, Caliente 2 €. Anuncio A8 «Vamos a
  ser honestas» (Sorela a cámara, 9:16 para historias/reels y 4:5 para feed)
  en los tres conjuntos. La versión larga dice «zonas de congestión»: no va a
  Meta (regla de no prometer salud); la de Meta no lo dice.
- Campaña «MC 6 nov · Recordatorio a registradas» `120255122303810427`
  (alcance, solo el público de registradas): R1 «Mañana a las 19:00» el 5 nov y
  R2 «Hoy a las 19:00» el 6 nov hasta las 19:00, 2,50 € cada una. Enlace a
  `/grupo`; cuando llegue el Zoom, se puede cambiar el de R2.
- Medios públicos para Meta: rama `medios-anuncios` (raw.githubusercontent).
