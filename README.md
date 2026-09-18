# Sorela Caro · Técnica Divine — web pública

Implementación en Next.js del prototipo de Claude Design `Web Sorela Divine.dc.html`.
El prototipo original queda en `diseno/` como referencia.

- **Stack**: Next.js 16 (App Router) · React 19 · TypeScript · CSS Modules
- **Dominio previsto**: `sorelacarodivine.com`
- **Despliegue**: Vercel

---

## Arrancar en local

```bash
npm install
npm run dev          # http://localhost:3000
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (25 rutas, todas estáticas) |
| `npm start` | Sirve el build |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run fotos` | Regenera `fotos/` desde los originales (ver más abajo) |
| `npm run mapa` | Regenera la geometría del mapa |
| `npm run pruebas` | 15 comprobaciones de interacción con Playwright (requiere `npm start` en otra terminal) |
| `npm run capturas` | Capturas de todas las páginas en claro, oscuro y móvil |

---

## Desplegar en Vercel

1. En Vercel, **Add New → Project → Import** el repositorio `sorelacarooficial-stack/web-plataforma`.
2. Framework: **Next.js** (lo detecta solo). **Root Directory**: la raíz, no hay que tocarla.
3. No hace falta ninguna variable de entorno para que funcione. La única opcional es
   `NEXT_PUBLIC_PLATAFORMA_URL`, que apunta el botón "Entrar" a la plataforma privada
   cuando exista; sin ella, lleva a `/entrar`.
4. **Deploy**. A partir de ahí, cada `git push` a `main` publica solo.

### Conectar el dominio

En Vercel: **Project → Settings → Domains → Add** → `sorelacarodivine.com`.
Marca también `www.sorelacarodivine.com` para que redirija al principal.

Vercel enseñará en pantalla los valores exactos de DNS que hay que poner. **Usa esos**,
no los de ningún tutorial: Vercel ha cambiado sus IP y sus destinos CNAME varias veces.
Normalmente son un registro `A` para el dominio raíz y un `CNAME` para `www`.

### Qué tocar y qué NO tocar en Arsys

El DNS está en Arsys. De los 9 registros actuales, **solo se cambian dos**:

| Registro | Tipo | Ahora | Qué hacer |
| --- | --- | --- | --- |
| `sorelacarodivine.com` | A | `217.76.128.47` | **Cambiar** a la IP que dé Vercel |
| `www.sorelacarodivine.com` | A | `217.76.128.47` | **Sustituir** por el CNAME que dé Vercel |

> Arsys no deja tener un `A` y un `CNAME` con el mismo nombre. Para `www` hay que
> **borrar primero el registro A** y después crear el CNAME.

Los **siete restantes son del correo y no se tocan**. Si se borran, deja de entrar y salir
correo de `@sorelacarodivine.com`:

- `sorelacarodivine.com` **MX 10** → `mx.serviciodecorreo.es`
- `sorelacarodivine.com` **SPF** → `v=spf1 include:_spf.serviciodecorreo.es ~all`
- `1789049975375._domainkey.sorelacarodivine.com` **TXT** (DKIM)
- `autoconfig`, `autodiscover`, `webmail`, `control` → **CNAME** a serviciodecorreo.es / servidoresdns.net

El certificado HTTPS lo emite Vercel solo en cuanto el DNS propaga (de minutos a un par
de horas).

---

## Qué hay montado

| Ruta | Contenido |
| --- | --- |
| `/` | Home: hero, marquesina, problema, cita, método, quién está detrás, banda de formaciones, comunidad, mapa, testimonios, FAQ, cierre |
| `/metodo` | Observar · Interpretar · Decidir, a quién va dirigido |
| `/formaciones` | Las tres convocatorias + aviso por ciudad |
| `/formaciones/[slug]` | Ficha de curso: capacidades, cómo son los días, qué incluye, precio, FAQ |
| `/comunidad` | Lista de espera, las cinco piezas y las objeciones |
| `/terapeutas` | Mapa interactivo + filtros de ciudad y tratamiento + listado |
| `/terapeutas/[slug]` | Ficha de terapeuta con agenda de reserva |
| `/sobre` | Historia de Sorela y cifras |
| `/contacto` | Formulario |
| `/legal/*` | Cuatro documentos legales, pendientes de redactar (ver abajo) |
| `/entrar` | Marcador de la plataforma privada |

Modo claro y oscuro con conmutador en la cabecera; la elección se guarda y se aplica
**antes del primer pintado**, así que no hay parpadeo al recargar.

Capa de movimiento: revelado al hacer scroll con retardo escalonado, parallax en las fotos
a sangre, motas doradas en el hero, marquesina infinita, barra de progreso de lectura y
contadores. Todo se apaga con `prefers-reduced-motion`.

---

## Lo que todavía no está conectado

Está decidido así a propósito, no es un olvido:

1. **Los formularios no envían nada.** Lista de espera, contacto, aviso de ciudad y reserva
   de cita confirman en pantalla y ahí se queda. Para conectarlos: crear una route handler
   en `app/api/…` y sustituir el cuerpo del `onSubmit` de cada componente de
   `components/` (`ListaEspera`, `FormularioContacto`, `AvisarCiudad`, `Reserva`),
   dejando el estado de confirmación como está.

2. **El asistente responde con reglas, no con un modelo.** El prototipo llamaba a
   `window.claude.complete`, que solo existe dentro de Claude Design. Ahora resuelve con
   las ocho respuestas escritas a mano de `lib/asistente.ts`, encaminadas por palabra clave.
   El prompt de sistema con la voz de Sorela sigue ahí (`PROMPT_SISTEMA`): para enchufar un
   modelo de verdad, crear `app/api/asistente/route.ts` contra la API de Anthropic y dejar
   `responder()` como respuesta de reserva si la llamada falla.

3. **Los textos legales están sin redactar.** Las cuatro páginas explican qué tiene que
   recoger cada documento. No se ha puesto texto de relleno a propósito: un aviso legal
   aproximado da apariencia de cumplimiento sin cumplir, y en protección de datos eso tiene
   consecuencias. Lo redacta una asesoría y se sustituye `cuerpo` en `app/legal/[doc]/page.tsx`.

4. **La plataforma privada no está implementada.** Existe como prototipo en
   `diseno/Plataforma Divine.dc.html` (login con Google, panel de alumna, aula tipo Skool,
   CRM, facturación, agenda, admin). `/entrar` es un marcador.

5. **Falta la historia real de Sorela** en `/sobre`. Es el único hueco de copy: aparece
   marcado en monoespaciado sobre fondo dorado para que no se cuele en producción por
   descuido. Está en `app/sobre/page.tsx`.

---

## Notas de implementación

**Fotos.** Los originales pesan 91 MB (hasta 4704×10188 px) y no están en el repositorio;
viven en el bundle de diseño, en `project/uploads/`. `npm run fotos` los convierte a WebP
en `fotos/` — 812 KB en total, un 99,1 % menos — respetando la orientación EXIF. Se importan
de forma estática para que Next calcule dimensiones y placeholder difuminado en el build.
Si Sorela manda fotos nuevas, se añaden al script y se vuelve a lanzar.

**Mapa.** El prototipo cargaba D3, TopoJSON y la geometría desde CDN dentro de un `iframe`
que se comunicaba por `postMessage`. Aquí es un componente React (`MapaTerapeutas.tsx`) con
D3 como dependencia y la geometría auto-alojada en `public/geo/peninsula.geo.json`: no
depende de ningún servidor de terceros, que es justo lo que tumbó el mapa durante el diseño.
El recorte sale de Natural Earth a escala 1:50 M **porque a 1:110 M las Baleares no
existen** y el punto de Palma quedaría en el mar. `npm run mapa` lo regenera.

**Estilos.** El prototipo llevaba todo en `style=""` inline, con los mismos valores repetidos
decenas de veces. Aquí los tokens de color y los patrones que se repetían (contenedores,
escala tipográfica, botones, campos, tarjetas) están en `app/globals.css`, y lo específico de
cada página en CSS Modules. Los valores son los mismos: mismos `clamp()`, mismos colores,
mismos tiempos de transición.

**Dos arreglos sobre el prototipo**, ambos en móvil:
- El menú de la cabecera se cortaba a media palabra contra el botón de tema. Ahora se
  difumina en el borde, que es como se lee "hay más, desliza".
- El velo del hero iba de izquierda a derecha, que es como se reparte el hero en escritorio.
  En vertical el texto cae debajo de la foto, así que ahí el velo baja: sin eso, la línea
  "Sorela Caro, creadora del método" quedaba casi ilegible sobre la imagen.
