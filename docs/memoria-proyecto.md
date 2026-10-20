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
- La serie de correos vive en Firestore (Programados): cambiar
  `lib/serie-lanzamiento.ts` no cambia lo ya guardado.

## Meta Ads

- Cuenta Sorela Publi `4080934555473731`, página `405378099553859`, IG
  `@sorelacaro_`, conjunto de datos «Comunidad Divine» `968080569683493`.
- Campaña `120254915227270427` «MC 6 nov · Registros web · CAPI»
  (OUTCOME_LEADS, termina 6 nov 18:00). 10 €/día: A España 5 €, B Latam
  (CO/AR/VE/MX) 3 €, C Caliente 2 €. Excluye a las ya registradas.
- Sin píxel ni cookies: API de conversiones desde el servidor
  (`lib/meta-capi.ts`, evento Lead con datos cifrados).
- UTM de los anuncios: `utm_source=meta&utm_campaign=mc_6nov&utm_content=<anuncio>`.
- Panel: tarjeta «Campaña de la masterclass» en Métricas; lo de Meta en azul.
  Informe diario a Sorela a las 10:00 (cron en `vercel.json`).
- Variables en Vercel: `META_CAPI_TOKEN`, `META_DATASET_ID`, `META_ADS_TOKEN`
  (token de usuario largo, caduca ~mediados de diciembre).
- Para cambiar anuncios: sustituirlos, no pausar la campaña.
