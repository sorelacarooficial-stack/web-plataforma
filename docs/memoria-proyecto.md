# Memoria del proyecto

Lo que se ha decidido y por qué, para que cada sesión de Claude Code arranque
sabiendo dónde estamos. Se carga sola desde CLAUDE.md. **Actualízala al cerrar
cada cambio importante** (una línea por decisión, con la fecha).

## Cómo se trabaja

- Nada va directo a `main`: rama `claude/<tema>` + PR, y el merge lo hace la
  dueña del proyecto. El push directo a main está bloqueado.
- Al hablar con la usuaria: explicarlo todo muy fácil, como a un niño de 5
  años (frases cortas, sin palabras técnicas). (2026-11-05)
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

## Presentación en directo de la masterclass

- `/clase` (y `clase.sorelacarodivine.com` cuando se dé de alta en DNS y
  Vercel): la presentación de 28 diapositivas que Sorela comparte por Zoom.
  Aquí sí salen la Comunidad Divine y los precios (se cuentan en directo). No
  se indexa; con `CLASE_CLAVE` en Vercel solo abre con `?k=<clave>`.
  (2026-11-02)
- Todo lo que cambia (fecha, precios, plazas, vídeos de TV y de Beatriz,
  ciudades del mapa) está en `lib/clase.ts`. Diapositivas en
  `components/clase/diapositivas.tsx`.
- El QR apunta siempre a `/clase/entrar`, que redirige a `CLASE_ENLACE_PAGO`
  (Vercel) o, si no hay, al WhatsApp de Sorela con el mensaje escrito.
- Teclas: → siguiente, G vista general, P presentador (otra ventana
  sincronizada), F pantalla completa, B negro. Plazas, votos y ciudades se
  pulsan en directo y se ven igual en las dos ventanas.
- 2026-11-04, versión 2 según el PPTX de Sorela: problema (4), tres obstáculos
  (5), «fue ciego» (8), «El cuerpo expresa lo que esconde el alma» (13),
  estimulación ganglionar (15), Metodología Divine® online + Bogotá 11-13 dic
  (20), formación presencial 2.250 / 1.500 / 750 USD con reservas 250 / 250 /
  150 (21), Divine® Online 900 → 750 USD, reserva 250 (22), «¿Y qué pasa
  después de formarte?» (23) y Bienvenida a la Comunidad Divine® (24). Fuera:
  «Las 23:00», 10 plazas de fundadora y el precio 49 €/490 € de la comunidad.
  Precios y fechas en `lib/clase.ts` (`FORMACIONES`, `ONLINE`).
- 2026-11-04: diapositiva 18 «Otro abdomen, el mismo criterio», antes/después
  que se arrastra con la foto que mandó Sorela (`public/clase/abdomen2-*`).
- 2026-11-04: «Localiza tu terapeuta» = solo terapeutas homologadas por
  Sorela (sin buscador de ejemplo). «Marketing e IA» pasa a «Agente IA para tu
  negocio». La diapositiva del agente: un agente conectado a todo el negocio
  (agenda, WhatsApp, Instagram, fichas, servicios, cobros) con el objetivo de
  que el centro facture más. No se promete facturación garantizada.
- 2026-11-04: antes del agente, dos diapositivas nuevas. «¿Cuántas creéis que
  la tecnología y la IA están cambiando radicalmente el mundo…?» (votos SÍ/NO
  del chat + 86 %, WEF Future of Jobs 2025) y «Una cosa es formarte. Otra es
  hacer crecer tu negocio» (41,9 % de empresas españolas siguen abiertas a los
  5 años, INE cohorte 2018 → te forma, te acompaña, crece tu negocio). El
  agente: «Por eso hemos construido el Agente IA Divine, adaptado a tu
  negocio»: responde, ejecuta, publica, registra y vende; dato 55 % de Zenoti
  (vendedor de software, citar como tal).
- 2026-11-04, reunión con Sorela: la presencial pasa de Bogotá a Medellín y
  Caracas (fechas corregidas abajo) (`SEDES` en `lib/clase.ts`). Sin QR: para
  reservar se escribe **«QUIERO»** en el chat o en el grupo, y la persona de apoyo
  escribe por privado (mensajes en `docs/mensajes-quiero.md`). Sin Telegram: el
  canal de la comunidad va en la plataforma. La membresía (49 € / 47-49 USD) NO se
  vende en la masterclass: se presenta como servicio añadido y se vende en una
  sesión privada para alumnas. Pagos: Stripe (tarjeta), transferencia local
  (CO/VE) y cripto. Decir «activación/estimulación» de ganglios, nunca «abrir».
- 2026-11-04: recta final. Pausado «A3 Sin ritmo ES» (0 registros en 3 días).
  España 1 €, Latam 7 €, Caliente (retargeting) 4 €. A 4 nov: 352 registros por
  174 € (0,50 €/registro; Latam 0,30 €). La campaña termina sola el 6 nov a las
  18:00; R1 (5 nov) y R2 (6 nov hasta las 19:00) a las registradas.
- 2026-11-04 (noche): **Caracas 4-6 dic y Medellín 10-12 dic.** La masterclass
  es por **Google Meet**, no Zoom: sala en `SALA_MASTERCLASS` (lib/apertura.ts) y
  todo enlaza a `/directo`, que redirige. La **Membresía Divine® es solo para
  terapeutas homologadas** (formación completa de 3 días); se les vende en
  sesión privada, no en la masterclass; el agente IA va incluido en ella (se
  vende la idea; aún no está construido). En la plataforma, «Comunidad» ya no
  enseña la lista de espera: `ComunidadHomologadas`. `lib/puesta-a-punto.ts`
  (cron de la mañana, una vez): crea las convocatorias `caracas-2026-12` y
  `medellin-2026-12` abiertas pero NO publicadas (internas, ver abajo), y pasa los correos programados a
  Google Meet con el botón del día 6 apuntando a /directo.
- 2026-11-05: las convocatorias de diciembre son **internas**: no salen en la
  web, solo en la plataforma para apuntar y dar accesos (la venta es en la
  masterclass). Divine® Online sí incluye la Comunidad; para la Membresía hay
  que pasar sí o sí por la formación completa de 3 días (certificada =
  homologada).
- 2026-11-05: presentación con dos vídeos. «Vídeo · Sorela Caro» (1 min, antes
  de «Mi historia»: motion graphics + entrevista de TV recortada de
  public/presentacion/tecnica-divine.mp4, en `public/clase/video/`) y «Vídeo ·
  Membresía Divine» (cinematográfico con ElevenLabs; sale solo cuando
  `VIDEOS.membresia` en lib/clase.ts tiene archivo). Los vídeos arrancan solos
  al llegar a la diapositiva; en Meet hay que compartir la pestaña con audio.
  Plataforma: pop-up «Próximamente · Agente IA Divine» (AgenteProximamente),
  sale una vez y luego desde la pastilla «Agente IA · Pronto».
  ElevenLabs: flujo `ndDWySHHfE6q5cLUZHLY`; la red de la sesión bloquea
  elevenlabsusercontent.com (hay que permitirlo para descargar).
- 2026-11-04: vídeo de la Membresía Divine montado (62,6 s,
  `public/clase/video/membresia.mp4`): 7 planos de Seedance + voz de Nicole +
  música de cine + lluvia, móvil, golpes con cola y barridos; color frío en el
  dolor y dorado en la solución. La subida de la música cae en el corte a la
  clase en directo (28,2 s) y el golpe final con el logo (55,55 s). Cierra con
  «Solo para terapeutas homologadas por Sorela Caro». El vídeo de Sorela lleva
  ya el piano debajo (delante en intro y cierre, de fondo en la entrevista).
  Los dos a −16 LUFS. Los medios brutos de ElevenLabs están en la rama
  `claude/eleven-medios` (carpeta `eleven/`), los bajó otra sesión.
- 2026-11-04: en la ventana del presentador (P) los vídeos se ven pero van sin
  sonido (antes sonaban en las dos y se podían colar por el micro en Meet).
  Chromium de Playwright no reproduce H.264: para probar vídeos se sirve un
  WebM con `ctx.route`.

- 2026-11-05: diapositiva «Hagamos cuentas» antes del agente: lo que cuesta
  hoy cada herramienta por separado (agente IA 99, CRM 20, agenda 30, redes
  25, diseño 18, vídeo 20, email 20 → ≈ 232 USD/mes, 2.784 al año; precios de
  lista nov. 2026 en `HERRAMIENTAS`, diapositivas.tsx). Cierra con «Con
  Divine®, todo en un solo agente, incluido en la Membresía» (sin precio de la
  membresía). Ojo: el agente aún no existe; se presenta como lo que tendrá.
- 2026-11-05: vídeo de la membresía v2: música épica nueva (ElevenLabs,
  impacto a 25 s y subida a 28,6 s, entra en −0,4 s) con menos «ducking»
  (4,5 dB) para que no suba y baje a cada frase; el plano del grupo lleva a
  Sorela de blanco (imagen editada con gemini-3-pro-image a partir de sus
  fotos + Seedance; la otra variante la rechazó el filtro de personas reales).
  Medios en la rama `claude/eleven-medios-2` (carpeta `eleven2/`).
- 2026-11-05: sala de espera en la portada: cuenta atrás + frases rotando
  (`ESPERA.frases`) + botón «Poner música» (`public/clase/musica/espera.mp3`,
  6 min de lounge con piano generado en ElevenLabs, bucle, −18 LUFS). La
  música se apaga sola en fundido al llegar la cuenta a cero o al pasar de
  diapositiva; en el presentador no suena. En «QUIERO», 10 min de preguntas y
  reservas (`MINUTOS_PREGUNTAS`, estado compartido `preguntasDesde`; pulsar
  reinicia). Guion de venta completo en `docs/mensajes-quiero.md`.
- 2026-11-05: ajustes pedidos: mapa sin contador «Nos ves desde N sitios»;
  «Hoy te llevas 3 cosas» pasa a «Hoy tenemos dos partes» (1: lo que vas a
  aprender; 2: una oportunidad para todas, solo en directo); fuera el
  contador «Si te ha pasado, escribe un 1» y la diapositiva «El masajista más
  famoso fue ciego»; «Tu lunes» centrada, sin giro y con las preguntas
  siempre visibles (se encienden por clic). Quedan 34 diapositivas.
- 2026-11-05: diapositiva puente «Esto es solo el principio» (parte 2) entre
  «Lo que cambia en tu cabina» y «Metodología». Bloque de la membresía
  reordenado: vídeo → «Tres datos» (86 % WEF, 41,9 % INE y 55 % Zenoti en una
  sola diapositiva; fuera la encuesta SÍ/NO) → «Hagamos cuentas» (sin nombres
  de herramientas) → Agente (demo de conversación que entra sola, ↻ repite) →
  ¿Y después? → Comunidad → Qué hay dentro → «QUIERO» (centrada, sin
  contador de personas).
- 2026-11-06 (reunión del 5 nov): parte 2 solo «Una oportunidad para todas»;
  credenciales sin revista ni tele (30 años, +25.000 casos); «Observa» sin
  «Escucha»; «Cuándo no tocar» con cáncer, terminales, cardíacos e
  infecciones y tarjeta «Con nosotros · Doctor Achile» (le damos la palabra);
  casos reales solo el facial; puente con «Toda persona que se somete a este
  tratamiento obtiene resultados»; presencial con precio tachado (`antes` en
  `FORMACIONES`: 3000/2000/1000, confirmar), «Solo 10 plazas por ciudad»
  (`PLAZAS`) y cena de gala solo en la completa; Online para quien ya tiene
  buenos resultados; datos = pregunta + 86 % antes de 2030; costes en 4
  grupos (CRM, automatizaciones, vídeos, agente) por suscripción; agente «lo
  estamos construyendo» y se entrena con cada terapeuta; fuera «¿Y después?»
  y «Comunidad»; «Qué hay dentro» = Membresía, solo homologadas; en «QUIERO»
  escribe «nuestro equipo». Quedan 32 diapositivas.
- 2026-11-06: fuera «La ficha completa te llega hoy» (no se manda ficha) y la
  frase de la ficha en «Gracias». Divine® Online empieza con «Si ya tienes muy
  buenos resultados…» y sin la Comunidad. **Membresía: este primer mes 49 USD,
  después 98** (`MEMBRESIA` en lib/clase.ts, ahora sí se dice en directo); con
  las 10 primeras, sesión 1 a 1 para adaptar su agente; el agente se entrena
  solo para terapeutas y mejora con el uso. `/reserva`: una pantalla, cada
  opción con su botón de pago (Stripe en `STRIPE`, lib/reserva.ts; sin enlace
  abre WhatsApp con la elección escrita). Vale hasta el 7 nov 19:00 España.
