# «Empieza aquí» · Guiones de los videos de Sorela

Adaptados de `docs/imperio-a-divine.md` (punto 6.2) a la plataforma tal y como
está el 16 nov 2026. Español latino, cortos, **una sola tarea por video**.
Entre **[ ]** van los datos que tiene que confirmar Sorela.

---

## 1. Qué hay hoy en la plataforma (comparado con los puntos 5 y 7)

El menú real de una alumna es: **Inicio · Clases · Comunidad · Agenda · Perfil**.
No existen «Formación», «Clases en vivo», «Mi asistente» ni «Recursos»: los
guiones usan los nombres de verdad.

### Ya existe (se reutiliza, no se duplica)

| Lo que pide el documento | Lo que ya hay |
|---|---|
| Lista de primeros pasos que se marca sola | «Tu camino» en Inicio (`PanelAlumna`): recorrido, perfil, precurso, presencial, clases, certificado / preséntate, ayuda, racha, podio. Se marca solo con lo que hace. |
| «Continuar donde lo dejaste» | «Tu próxima misión» en Inicio: la siguiente clase con «Seguir». |
| Tour de la plataforma | Recorrido de bienvenida (`Recorrido.tsx`) y «¿Cómo funciona?». |
| Completar perfil | Bienvenida por pasos (`Onboarding.tsx`) con puntos. |
| Ficha en Localiza tu terapeuta | En la bienvenida y en Perfil, **solo para homologadas** (miembros). |
| Recorrido de formación | Academia online por módulos con candados y reunión con Sorela (`lib/avance.ts`, `RecorridoAula`). |
| Agenda y reuniones con Sorela | Agenda con «Pedir reunión» (L-V, 6:00-15:00 Colombia, horas en 3 países). |
| Comunidad | **Muro propio dentro de la plataforma** (Caso, Duda, Resultado, Recurso, Anuncio) con ranking del mes. Solo homologadas. Mejor que Telegram: ya está. |
| Próxima clase en vivo | Sorela la programa en Comunidad (título, fecha, enlace). Sale en Comunidad y en Inicio, solo a homologadas. |
| Niveles y puntos | Puntos, niveles, trofeos y racha (`Puntos`, `Logros`). Ya miden lo que pasa dentro. |
| Asistente | Solo el aviso «Agente IA · Pronto» (`AgenteProximamente`). |

### Falta

1. **Video de bienvenida** en Inicio (no hay sitio para él).
2. **Curso «Empieza aquí»** fijado el primero en Clases, con huecos para los videos.
3. **Plantilla de lección**: video + 3 líneas + una tarea + «Marcar como vista» + progreso. Hoy una clase se marca sola al verla entera; no tiene tarea.
4. **«Añadir a mi calendario»** (Google, Apple, Outlook) para la clase en vivo y para la reunión con Sorela. Hay un `.ics` hecho para la masterclass (`ComunidadProximamente`) que se puede reutilizar.
5. **Guardar en el celular como app**: no hay `manifest`. Sin él, el video 02 pediría algo que funciona a medias.
6. **Grabaciones de las clases en vivo**: no hay sitio para ellas.
7. **Las alumnas de la academia no tienen comunidad dentro**: su pantalla Comunidad dice «solo homologadas». Su único sitio en común es el grupo de WhatsApp de la Comunidad Divine (`GRUPO_COMUNIDAD`).

### Sobra (o choca con lo decidido)

- **Telegram**: no hay (decidido el 4 nov). Se cambia por el muro (homologadas) o el grupo de WhatsApp (academia).
- **Video 04 del asistente** y la tarea «pídele tu primera tarea»: fuera hasta que el agente exista.
- **Las «3 rutas» del video 03** (curso base, marketing, IA): esos cursos no existen. La academia tiene **un solo camino**, en orden y con candados. Prometer rutas sería mentir. Propuesta: el video 03 explica ese camino.
- **Video 02 «Así funciona tu plataforma»** repite el recorrido de bienvenida, que ya enseña cada zona. Propuesta: video corto (60 s) que invita a hacer el recorrido y a guardar la plataforma en el celular.
- **Urgencia de «49 € para siempre»**: la membresía es 49 USD el primer mes y luego 98, y no se vende dentro del inicio.
- **Comentarios por lección con «resuelta»**: el muro ya tiene la categoría «Duda». Hacer otro sistema ahora duplica. Se deja para más adelante.
- `ACCESOS`, `PENDIENTE_BETA` y `CLASES_ANTERIORES` en `lib/plataforma.ts`: no los usa nadie (uno habla de Telegram). Se pueden borrar.
- «El resultado se ve desde la primera sesión» (video 07 original): es una promesa de resultado. Fuera.

---

## 2. Los videos

Dos tipos de personas entran en la plataforma:

- **Academia** = alumnas de la academia online (módulos con candados y reuniones con Sorela).
- **Homologadas** = terapeutas con la formación completa y la Membresía (muro, clase en vivo, ficha en el mapa).

Los videos 00, 01, 02 y 07 son **iguales para las dos**. Del 03 al 06, cada uno
dice para quién es. Si se decide hacer una sola versión, se graban solo los comunes.

| # | Video | Para | Duración | Tarea |
|---|---|---|---|---|
| 00 | Bienvenida (Inicio) | Las dos | 45 s | Empieza por el video 01 |
| 01 | Te doy la bienvenida | Las dos | 60 s | Completa tu perfil |
| 02 | Tu plataforma en un minuto | Las dos | 60 s | Guárdala en tu celular |
| 03A | Cómo avanzas en tu formación | Academia | 75 s | Abre el Módulo 01 |
| 03B | Por dónde empezar | Homologadas | 60 s | Abre tu primera clase |
| 04A | Tus reuniones conmigo | Academia | 60 s | Mira cuándo pedirla |
| 04B | La clase en vivo | Homologadas | 60 s | Añádela a tu calendario |
| 05A | Tu grupo y cómo pedir ayuda | Academia | 60 s | Entra al grupo y preséntate |
| 05B | Tu comunidad y cómo pedir ayuda | Homologadas | 60 s | Preséntate en el muro |
| 06 | Que las clientas te encuentren | Homologadas | 60 s | Activa tu ficha |
| 07 | Tus próximos pasos | Las dos | 45 s | Los pasos de esta semana |

Fuera hasta que exista: **Tu Agente IA Divine**.

---

### 00 · Bienvenida (45 s) · las dos

**EN PANTALLA (0-3 s):** «Bienvenida a Divine» sobre fondo oscuro.

**SORELA:**
«Hola, soy Sorela Caro. Qué alegría que estés aquí.
Este es tu espacio. Aquí vas a entrenar tus manos y tu mirada, paso a paso.
*(Planos rápidos: Inicio, Clases, Agenda, Perfil.)*
Tienes tus clases, tu agenda, tu perfil y personas que caminan contigo.
Para empezar, abre el primer video. Son cortitos, te lo prometo.»

**CIERRE:** «Empieza por el video 01 →»

---

### 01 · Te doy la bienvenida (60 s) · las dos

**EN PANTALLA:** «01 · Bienvenida» + «No se trata solo de poner las manos».

**SORELA:**
«Hola, soy Sorela Caro, creadora de la Técnica Divine.
Llevo [30] años trabajando con las manos. Y siempre digo lo mismo: no se trata solo de poner las manos. Se trata de saber qué observar, qué interpretar y cómo decidir antes de tocar.
Eso es lo que vamos a entrenar aquí, juntas.
En los próximos videos te enseño cómo funciona todo. Son pocos y cortos.
Antes de seguir, haz una sola cosa: completa tu perfil. Tu foto y tu ciudad. Te toma un minuto.»

**CIERRE:** «Tu tarea: completa tu perfil →»

---

### 02 · Tu plataforma en un minuto (60 s) · las dos

**EN PANTALLA:** «02 · Tu plataforma» + «Siempre sabrás dónde está todo».

**SORELA (con la pantalla a su lado):**
«Te muestro rápido dónde está cada cosa.
*(Inicio)* En Inicio está tu camino: lo que ya hiciste y lo que te toca ahora.
*(Clases)* En Clases están tus videos y tus dosieres.
*(Agenda)* En Agenda ves tus fechas y tus reuniones conmigo.
*(Perfil)* Y en Perfil, tu foto y tus datos.
Si quieres verlo con calma, toca «Ver el recorrido». Te lo enseña paso a paso.
Un consejo: guarda la plataforma en tu celular. Así entras con un toque, como una app. Debajo de este video te digo cómo.»

**DEBAJO DEL VIDEO:**
- iPhone: abre la plataforma en Safari › botón compartir › «Agregar a inicio».
- Android: abre la plataforma en Chrome › los tres puntos › «Agregar a la pantalla principal».

**CIERRE:** «Tu tarea: guárdala en tu celular →»

---

### 03A · Cómo avanzas en tu formación (75 s) · academia

**EN PANTALLA:** «03 · Tu formación» + «Un paso cada vez».

**SORELA:**
«Tu formación va por módulos, en orden. Son cuatro: Precurso, Desbloqueo, Tonificación y moldeo, y Facial y brazos.
Cada módulo tiene un dosier para leer y sus videos.
Al principio verás candados. Es a propósito: cada paso se abre cuando terminas el anterior. Así no te saltas la base.
Primero lees el dosier. Al terminarlo, se abren sus videos. Y al ver los videos, se abre el módulo siguiente.
Lo que más frena no es la falta de información. Es querer verlo todo y no aplicar nada.
Tu tarea de hoy: abre el Módulo 01 y empieza a leer.»

**CIERRE:** «Tu tarea: abre el Módulo 01 →»

---

### 03B · Por dónde empezar (60 s) · homologadas

**EN PANTALLA:** «03 · Por dónde empezar» + «No tienes que verlo todo».

**SORELA:**
«Ya hiciste la formación completa. Aquí tienes todas tus clases abiertas para repasar.
No tienes que verlas todas de golpe.
Mi consejo: elige la zona que más trabajas en tu cabina y empieza por ahí. [Si Sorela quiere fijar una clase de inicio: «Empieza por …».]
Cada vez que repasas, tus manos se afinan.
Tu tarea: abre hoy tu primera clase y mírala hasta el final.»

**CIERRE:** «Tu tarea: abre tu primera clase →»

---

### 04A · Tus reuniones conmigo (60 s) · academia

**EN PANTALLA:** «04 · Tus reuniones» + «No vas a caminar sola».

**SORELA:**
«En tu formación nos vamos a ver cara a cara.
La primera vez, al terminar el Módulo 01. Ahí te sale un botón para pedir tu reunión conmigo.
Eliges el día y la hora. La ves en la hora de Colombia, de Venezuela y de España, para que no haya confusiones.
La reunión queda en tu Agenda, con el enlace. Toca «Añadir a mi calendario» y te llega el aviso.
Llega con tus preguntas listas. Ese rato es tuyo.
Y al final de todo, hacemos juntas las prácticas.
Tu tarea: entra en tu Agenda y mira cómo es.»

**CIERRE:** «Tu tarea: abre tu Agenda →»

---

### 04B · La clase en vivo (60 s) · homologadas

**EN PANTALLA:** «04 · La clase en vivo» + «Tus casos reales, no teoría».

**SORELA:**
«[Una vez al mes] nos vemos en vivo. Es mi momento favorito: resolvemos tus casos reales.
Normalmente es [día y hora], hora de [Colombia]. La fecha siempre sale en tu Inicio y en Comunidad.
Toca «Añadir a mi calendario». Así te llega el aviso con el enlace.
Llega con tu pregunta lista: una clienta difícil, un resultado que no te convence, una duda de tu negocio.
[¿Queda grabada? Si sí: «Si un día no puedes, queda grabada aquí».]
Tu tarea: añade la próxima clase a tu calendario.»

**CIERRE:** «Tu tarea: añádela a tu calendario →»

---

### 05A · Tu grupo y cómo pedir ayuda (60 s) · academia

**EN PANTALLA:** «05 · Tu grupo» + «Aquí nadie camina sola».

**SORELA:**
«Aquí nadie camina sola.
Tenemos un grupo de WhatsApp de la Comunidad Divine. Ahí van los avisos y ahí conoces a otras terapeutas.
Cuando te trabes con algo, sigue este orden.
Uno: vuelve a mirar el dosier o el video. Muchas dudas están ahí.
Dos: si sigue, pregúntalo en el grupo.
Tres: si es un caso para ver con calma, tráelo a tu reunión conmigo.
Un consejo: cuando preguntes, cuenta qué hiciste, qué esperabas y qué pasó. Así te ayudamos de verdad.
Tu tarea: entra al grupo y preséntate. Debajo te dejo cómo.»

**PLANTILLA (debajo del video):**
```
Soy [nombre], de [ciudad].
Trabajo con [lo que haces].
Este mes quiero [una meta].
```

**CIERRE:** «Tu tarea: preséntate en el grupo →»

---

### 05B · Tu comunidad y cómo pedir ayuda (60 s) · homologadas

**EN PANTALLA:** «05 · Tu comunidad» + «Aquí nadie camina sola».

**SORELA:**
«Aquí nadie camina sola.
En Comunidad tienes el muro: casos, dudas, resultados y recursos de otras terapeutas homologadas. Todo queda guardado, no se pierde entre mensajes.
Cuando te trabes con algo, sigue este orden.
Uno: busca en el muro. Puede que alguien ya lo preguntó.
Dos: si no, publícalo como «Duda».
Tres: si es un caso para ver con calma, tráelo a la clase en vivo.
Cuenta qué hiciste, qué esperabas y qué pasó. Si puedes, con una foto.
Tu tarea: preséntate en el muro. Debajo te dejo cómo.»

**PLANTILLA:** la misma que 05A.

**CIERRE:** «Tu tarea: preséntate en el muro →»

---

### 06 · Que las clientas te encuentren (60 s) · homologadas

**EN PANTALLA:** «06 · Localiza tu terapeuta» + «Que te encuentren a ti».

**SORELA:**
«Esta parte me emociona. En la web de Divine hay un buscador: Localiza tu terapeuta.
Ahí salen solo las terapeutas homologadas por mí. Las personas de tu zona te buscan para atenderse con alguien de confianza.
Para salir, activa tu ficha: tu foto, tu ciudad, lo que haces y cómo te contactan.
Dos consejos. Usa una foto tuya, real, con buena luz. Nada de logos.
Y cuenta lo que haces pensando en la persona que te lee, no en la técnica.
Si tu ficha no está activa, nadie te puede encontrar.
Tu tarea: activa tu ficha hoy.»

**CIERRE:** «Tu tarea: activa tu ficha →»

---

### 07 · Tus próximos pasos (45 s) · las dos

**EN PANTALLA:** «07 · Tus próximos pasos» + «Ahora toca hacer».

**SORELA:**
«Ya sabes cómo funciona todo. Ahora viene lo que de verdad cambia las cosas: hacer.
Tus pasos de esta semana están en tu Inicio, y se marcan solos cuando los haces.
No tienes que hacerlo perfecto. Tienes que empezar.
A las terapeutas que mejor les va no son las que más saben. Son las que aplican una cosa cada semana.
Aquí estoy. Nos vemos pronto.»

**CIERRE:** los pasos en pantalla, con check:
- Academia: perfil · celular · Módulo 01 · grupo.
- Homologadas: perfil · ficha · muro · clase en vivo.

---

## 3. Cómo grabarlos

1. **Una sesión con Sorela (unos 45 min, con teleprompter):** 00, 01 y 07 enteros a cámara. Del resto, su voz leyendo el guion y su cara a la vez.
2. **Grabaciones de pantalla** después, con la plataforma ya terminada, siguiendo su audio.
3. **Formato:** horizontal 16:9. Sorela siempre visible; la pantalla a un lado, nunca encima de ella. Subtítulos palabra a palabra, Inter, crema. Cierre oscuro con la tarea y el logo.
4. Del 00 se saca un recorte vertical para Instagram.

## 4. Lo que tiene que confirmar Sorela

- [30] años: ¿es la cifra que quiere decir?
- 03B: ¿hay una clase por la que empezar las homologadas?
- 04B: ¿cada cuánto es la clase en vivo, qué día, a qué hora y en qué país manda la hora? ¿Se graba?
- 05A: ¿todas las alumnas de la academia entran al grupo de WhatsApp?
