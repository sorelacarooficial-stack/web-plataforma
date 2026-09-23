# Cómo montar el correo automático

Sorela: esto es para ti. Son unos 30 minutos y no hay que programar nada. Solo
copiar, pegar y pulsar botones. Los pasos van numerados del 1 al 43; si te
atascas, dime el número y sé exactamente dónde estás.

## Qué vamos a montar y por qué

Ahora mismo, cuando alguien rellena un formulario de la web, su contacto se
guarda y ya está. Nadie le contesta hasta que tú entras a mirar.

Al terminar esta guía, en cuanto alguien deje su contacto pasarán tres cosas
solas, en el mismo minuto:

1. A esa persona le llega un correo tuyo con el PDF de la Técnica Divine.
2. A ti te llega un aviso con sus datos y un enlace para escribirle por WhatsApp.
3. Se apunta una fila en una hoja de cálculo, por si algún día quieres verlo
   todo junto o pasárselo a alguien.

El correo sale de tu Gmail, con tu nombre. No cuesta nada y no hay que
contratar ningún servicio.

**¿Por qué no lo hace Firebase, que ya lo tienes montado?** Porque Firebase, en
el plan gratuito, guarda datos pero no manda correos: para eso hay que pasar al
plan de pago. Google tiene otra herramienta, Apps Script, que sí manda correos
desde tu Gmail y es gratis. Es la que vamos a usar.

## Cuatro palabras que van a salir mucho

Te las explico ahora para que luego no te frenen.

- **Apps Script**: una herramienta de Google donde se guarda un texto de
  instrucciones (el «código») que Google ejecuta por ti. Es gratis y va con tu
  misma cuenta de Gmail. Vive en `script.google.com`.
- **Identificador** (o **ID**): el churro de letras y números que Google le pone
  a cada archivo. Está dentro de la dirección web del archivo. Sirve para que el
  script sepa de qué archivo le hablas.
- **Propiedad del script**: un dato que se guarda aparte del código, en una
  pantalla de ajustes. Ahí van las cosas que no se escriben dentro del código
  porque son tuyas y privadas (tu clave, tu correo, tus identificadores).
- **Implementar** (o **desplegar**): publicar el script para que la web pueda
  llamarlo. Mientras no lo implementes, el script existe pero está a oscuras:
  la web no lo ve.

## Antes de empezar, ten a mano

- El PDF de la Técnica Divine (`TECNICA-DIVINE.pdf`), en el ordenador.
- Los dos archivos de esta carpeta: `Codigo.gs` y `correo.html`. Los vas a
  copiar y pegar enteros, no hace falta entender lo que ponen.
- El acceso a tu panel de Vercel (donde está publicada la web).

**Importante desde el minuto uno:** haz todo esto con **una sola cuenta de
Google**, la que quieres que mande los correos (`sorelacarooficial@gmail.com`).
Si tienes varias cuentas abiertas en el navegador, cierra las demás o usa una
ventana de incógnito y entra solo con esa. La mitad de los líos de esta guía
vienen de tener dos cuentas mezcladas.

---

# PARTE 1 · Los dos archivos de Drive

El script busca tus archivos **por su nombre**, así que lo único que hay que
hacer aquí es comprobar que se llaman como toca. No hay que copiar ningún
identificador de la barra de direcciones: era el paso donde más se falla, son
treinta y tantos caracteres y no se ve si te has dejado uno.

**1.** Entra en `drive.google.com` con tu cuenta.

**2.** Comprueba que tienes estos dos archivos en **Mi unidad**, escritos
exactamente así:

| Archivo | Para qué es |
|---|---|
| `TECNICA-DIVINE.pdf` | Lo que se adjunta en cada correo. |
| `Respaldo` | La hoja de cálculo donde queda una copia de cada contacto. |

> Ojo con el nombre del PDF: tiene que ser igual, con los guiones y en
> mayúsculas. `Tecnica Divine.pdf` con espacios no vale, ni `tecnica-divine.pdf`
> en minúsculas.

**3.** Si la hoja `Respaldo` no existe, créala: escribe `sheets.new` en la barra
de direcciones, pulsa Intro, y arriba a la izquierda cámbiale el nombre a
`Respaldo`. Déjala vacía: las columnas las pone el script solo la primera vez
que entre alguien.

> Ha salido bien si: en Mi unidad ves el PDF y la hoja, con esos dos nombres.

---

# PARTE 3 · El proyecto de Apps Script

**9.** Entra en `script.google.com`.

**10.** Pulsa **Nuevo proyecto** (arriba a la izquierda). Se abre una pantalla
con un recuadro de texto en el centro, que ya trae escritas tres o cuatro
líneas.

> Ha salido bien si: ves un editor de texto con algo parecido a
> `function myFunction() {}`.

**11.** Arriba del todo pone **Proyecto sin título**. Haz clic encima, escribe
`Captación Divine` y pulsa **Cambiar nombre**.

**12.** Haz clic dentro del recuadro de texto del centro. Selecciónalo todo
(`Ctrl + A` en Windows, `Cmd + A` en Mac) y bórralo. Que quede completamente en
blanco.

**13.** Abre el archivo `Codigo.gs` de esta misma carpeta, selecciónalo entero,
cópialo y pégalo en ese recuadro vacío.

> Ha salido bien si: el recuadro está lleno de texto y arriba del todo se lee
> «TÉCNICA DIVINE · el script que manda los correos».

**14.** Pulsa el icono del **disquete** (arriba, junto al botón Ejecutar)
para guardar. También vale `Ctrl + S` / `Cmd + S`.

> Ha salido bien si: el icono del disquete se apaga y deja de estar disponible.
> Eso significa que no queda nada por guardar.

**15.** Ahora el segundo archivo, el del diseño del correo. En la columna de la
izquierda pone **Archivos** y al lado hay un **+**. Púlsalo y elige **HTML**
(no «Secuencia de comandos»).

**16.** Te pide un nombre. Escribe exactamente `correo`, **sin el `.html`**
(Google se lo añade solo). Pulsa Intro.

> Ha salido bien si: en la columna de la izquierda ahora hay dos archivos:
> «Código.gs» y «correo.html».

**17.** Se ha abierto el archivo `correo.html` con unas líneas de ejemplo
dentro. Bórralas todas, igual que antes, abre el archivo `correo.html` de esta
carpeta, cópialo entero y pégalo ahí.

**18.** Guarda otra vez con el disquete.

> Ha salido bien si: el disquete vuelve a apagarse.

---

# PARTE 4 · Las dos claves

**19.** En la columna estrecha de la izquierda del todo (la de los iconos),
pulsa la **rueda dentada**. Se llama **Configuración del proyecto**.

**20.** Baja hasta el final de esa pantalla. Ahí está el apartado **Propiedades
de la secuencia de comandos**. Pulsa **Añadir propiedad de secuencia de
comandos**.

> Ha salido bien si: aparecen dos casillas vacías, una para el nombre
> («Propiedad») y otra para el valor («Valor»).

**21.** Vas a crear dos. Después de la primera, pulsa otra vez **Añadir
propiedad de secuencia de comandos** para que salga la siguiente fila.

Los nombres se escriben **exactamente así**, en mayúsculas y sin acentos. Si te
comes una letra, el script no encuentra el dato y falla sin decir por qué.

| Propiedad | Valor |
|---|---|
| `SECRETO` | `divine-correos-2026-badalona` |
| `AVISO_A` | `sorelacarooficial@gmail.com` |

**Sobre el SECRETO:** es una contraseña que solo se dicen entre ellos tu web y
este script, para que nadie más pueda usarlo. No hay que recordarla, pero
dentro de un rato hay que ponerla también en Vercel **idéntica**, así que no la
cambies ahora.

**22.** Pulsa **Guardar propiedades de la secuencia de comandos**.

> Ha salido bien si: al recargar la página (`F5`) las dos siguen ahí, con sus
> valores. Si alguna aparece vacía, es que no se guardó: vuelve a ponerla.

**23.** Míralas con calma. Que no haya quedado un **espacio delante o detrás**
al pegar, y que el correo esté bien escrito. Este paso de treinta segundos te
ahorra media hora después.

> **Dos propiedades más, solo si te hacen falta.** No las pongas de entrada.
>
> - `PDF_ID` y `HOJA_ID`: los identificadores de los dos archivos, por si algún
>   día tienes varios con el mismo nombre y quieres señalar uno concreto. Se
>   sacan de la barra de direcciones de Drive, entre `/d/` y `/view`.
> - `RESPONDER_A`: si quieres que las respuestas de la gente lleguen a un buzón
>   distinto del de los avisos. Si no la pones, van a `AVISO_A`.

---

# PARTE 5 · Darle permisos a Google

El script quiere mandar correos desde tu Gmail, abrir tu PDF y escribir en tu
hoja. Google no le deja hacer nada de eso hasta que tú se lo autorices
expresamente, y solo te lo pregunta cuando ejecutas algo a mano. Eso es lo que
vamos a hacer.

**24.** Vuelve al editor: en la columna de iconos de la izquierda, pulsa el
icono `< >` (**Editor**). Asegúrate de que estás viendo `Código.gs` y no
`correo.html`: si no, haz clic en «Código.gs» en la lista de archivos.

**25.** Arriba, junto al botón **Ejecutar**, hay un desplegable con nombres de
funciones. Ábrelo y elige **probar**.

> Ha salido bien si: en el desplegable pone «probar» y no «doPost» ni otra cosa.
> Esto importa: las demás no se pueden ejecutar a mano y dan error.

**26.** Pulsa **Ejecutar**.

**27.** Sale una ventana que dice **Autorización obligatoria**. Pulsa **Revisar
permisos** y elige tu cuenta de Google.

**28.** Ahora aparece una pantalla gris que dice **«Google no ha verificado esta
aplicación»**. No te asustes y no cierres nada.

Esa pantalla es normal y era de esperar. Google la enseña siempre que un script
no ha pasado por su revisión de aplicaciones públicas. Este script no es una
aplicación pública: es tuyo, lo acabas de escribir tú en tu propia cuenta, y
solo va a mandar tus correos. Google no tiene forma de saberlo, así que avisa.

Lo que hay que hacer:

- Abajo a la izquierda, en letra pequeña y gris, pone **Configuración
  avanzada**. Púlsalo.
- Se despliega un texto y al final aparece un enlace pequeño: **Ir a Captación
  Divine (no seguro)**. Púlsalo.
- En la pantalla siguiente, baja del todo y pulsa **Permitir**.

> Ha salido bien si: la ventana se cierra sola y vuelves al editor.

**29.** Abajo del editor se ha abierto un panel que pone **Registro de
ejecución**. Espera unos segundos a que termine.

> Ha salido bien si: ves tres líneas parecidas a estas:
>
> ```
> Respuesta: {"ok":true,"correoEnviado":true}
> Correos que quedan hoy: 98
> Revisa el buzón de sorelacarooficial@gmail.com y la hoja de cálculo.
> ```
>
> Lo que importa es `"ok":true` y `"correoEnviado":true`.

**30.** Abre tu Gmail. Te tienen que haber llegado **dos correos**:

- Uno de «Sorela Caro · Técnica Divine», con el PDF adjunto. Ése es el que va a
  recibir la gente: léelo como si fueras una clienta.
- Otro de «Web Divine» con el asunto «Contacto nuevo: Prueba Prueba», con los
  datos y el enlace de WhatsApp. Ése es el aviso que te llega a ti.

**31.** Abre la hoja «Captación Divine». Tiene que haber aparecido una pestaña
llamada **Contactos**, con la fila de cabecera en negrita y debajo la fila de
«Prueba Prueba». En la última columna pone `sí`.

Esa fila la puedes borrar cuando quieras, es de prueba.

> Si ha llegado todo esto, el script funciona. Lo que queda es conectarlo con la
> web.

---

# PARTE 6 · Publicar el script

Ahora mismo el script solo funciona cuando lo ejecutas tú a mano. Hay que
publicarlo para que la web pueda llamarlo.

**32.** Arriba a la derecha, pulsa el botón azul **Implementar** →
**Nueva implementación**.

**33.** Se abre una ventana. Arriba a la izquierda hay una **rueda dentada**
con el texto «Seleccionar tipo». Púlsala y elige **Aplicación web**.

> Ha salido bien si: la ventana cambia y ahora pide «Descripción»,
> «Ejecutar como» y «Quién tiene acceso».

**34.** Rellena así:

- **Descripción**: `Captación web` (da igual lo que pongas, es para ti).
- **Ejecutar como**: **Yo (sorelacarooficial@gmail.com)**.
- **Quién tiene acceso**: **Cualquier usuario**.

**Los dos últimos ajustes son los que más se equivocan, y son los importantes.**

- Si en «Ejecutar como» pones otra cosa, los correos no saldrán de tu Gmail.
- Si en «Quién tiene acceso» dejas «Solo yo» —que es lo que viene puesto de
  fábrica—, la web llamará al script y Google le contestará con una página de
  error en vez de dejarle pasar. El síntoma es que todo parece bien montado pero
  nadie recibe correos nunca. Tiene que poner **Cualquier usuario**.

No te preocupe que ponga «cualquier usuario»: cualquiera puede llamar a la
puerta, pero sin el SECRETO el script no le abre.

**35.** Pulsa **Implementar**.

**36.** Sale una ventana de «Nueva implementación actualizada» con una dirección
larguísima bajo el título **URL de la aplicación web**. Pulsa **Copiar** y
pégala en tu nota.

> Ha salido bien si: la dirección empieza por `https://script.google.com/macros/s/`
> y **termina en `/exec`**. Si termina en `/dev`, no es ésa: esa otra solo
> funciona para ti y no sirve aquí.

**37.** Pulsa **Listo** y, antes de irte, comprueba que está vivo: abre una
pestaña nueva del navegador, pega esa dirección y pulsa Intro.

> Ha salido bien si: el navegador enseña una línea de texto parecida a:
>
> ```
> {"ok":true,"listo":true,"faltan":[],"correosQueQuedanHoy":98}
> ```
>
> Lo que hay que mirar es **`"listo":true`**. Si pone `"listo":false`, en
> `"faltan"` te dice qué propiedad se ha quedado sin poner: vuelve al paso 19 y
> ponla.

---

# PARTE 7 · Conectarlo con la web (Vercel)

Vercel es donde está publicada tu web. Aviso: **el panel de Vercel está en
inglés**, así que aquí te pongo los nombres tal cual los vas a ver.

**38.** Entra en `vercel.com`, abre el proyecto de la web y pulsa **Settings**
(arriba) → **Environment Variables** (en la columna de la izquierda).

Una «variable de entorno» es un dato que la web necesita pero que no se escribe
dentro del código, por lo mismo que las propiedades del script: porque es
privado.

**39.** Crea la primera. En la casilla **Key** (nombre) escribe:

```
APPS_SCRIPT_URL
```

Y en **Value** (valor), pega la dirección que termina en `/exec` del paso 36.
Deja marcados los tres entornos (Production, Preview, Development) y pulsa
**Save**.

**40.** Crea la segunda igual. En **Key**:

```
APPS_SCRIPT_SECRETO
```

Y en **Value**, la frase que te inventaste en el paso 21, **exactamente la
misma**. Ni una letra de diferencia, ni un espacio de más al principio o al
final. Si no coinciden las dos, el script no abrirá la puerta y no saldrá ningún
correo. Pulsa **Save**.

> Ha salido bien si: en la lista aparecen las dos, `APPS_SCRIPT_URL` y
> `APPS_SCRIPT_SECRETO`. El valor sale tapado con puntos, es normal.

**41.** **Este paso se olvida siempre y sin él no sirve de nada lo anterior.**
Las variables nuevas no entran en la web hasta que se vuelve a publicar.

Ve a **Deployments** (arriba), busca el primero de la lista, pulsa los **tres
puntos** `···` de su derecha y elige **Redeploy**. Confirma.

> Ha salido bien si: aparece un despliegue nuevo y, en dos o tres minutos, se
> pone en verde («Ready»).

---

# PARTE 8 · La prueba de verdad

**42.** Abre tu web en el navegador, como una desconocida. Rellena el formulario
de «Quiero la información» con **tu propio correo** y un nombre cualquiera.
Envíalo.

> Ha salido bien si: la web te contesta que te ha mandado un correo. Si te
> dice algo tipo «te escribo yo», es que el script no ha contestado: vete
> directo a la tabla de abajo.

**43.** Mira tu Gmail. Tienen que llegar los dos correos otra vez (el de
bienvenida con el PDF y tu aviso), y en la hoja «Captación Divine» una fila
nueva.

Si ha llegado todo: está montado. No hay que volver a tocar nada.

---

# Cuántos correos se pueden mandar al día

Una cuenta de Gmail normal deja mandar **unos 100 correos automáticos al día**.
Cada persona que entra gasta dos: el suyo y tu aviso. Es decir, unas **50
personas al día**.

Para el día a día sobra de largo. Donde puede quedarse corto es en un día
concreto: una feria, un directo, un vídeo que se mueva más de la cuenta.

**Qué pasa si se agota, para que lo sepas sin darle vueltas:**

- Nadie se pierde. Las personas que entren después se guardan igual, en la web y
  en la hoja de cálculo.
- La web deja de prometer un correo que no va a llegar: a esas personas les dice
  que les escribes tú.
- Te llega un aviso a tu correo con el asunto «Se ha agotado el correo de hoy»,
  para que sepas que toca escribir a mano.
- Se arregla solo. A las pocas horas el contador vuelve a cero.

**Qué haces ese día:** abres la hoja «Captación Divine», miras las filas que en
la última columna ponen `no: sin cuota de Gmail`, y les escribes tú por WhatsApp
o por correo. Que igual hasta es mejor.

**Si empieza a pasar a menudo**, avísame: hay servicios de envío que suben ese
límite a miles de correos al día por unos pocos euros al mes, y la web ya está
preparada para usarlos. Es cambiar dos datos, no rehacer nada.

---

# Si algún día cambias el texto del correo

El texto que recibe la gente está en el archivo `correo.html`, dentro del mismo
proyecto de Apps Script. Puedes cambiarlo cuando quieras.

Pero guardar **no basta**. Si solo guardas, sigue saliendo el texto viejo y
parece que el cambio no ha servido de nada. Hay que publicar la versión nueva:

1. Guarda con el disquete.
2. **Implementar** → **Gestionar implementaciones**.
3. Pulsa el **lápiz** (Editar), arriba a la derecha del recuadro.
4. En **Versión**, elige **Nueva versión**.
5. Pulsa **Implementar**.

La dirección `/exec` no cambia: no hay que tocar nada en Vercel.

**Un límite que no se puede saltar al escribir esos textos.** Esto es un negocio
de estética, no sanitario, y la ley española no deja prometer efectos sobre la
salud en la publicidad de estética. No se puede escribir que refuerza las
defensas, que elimina toxinas, que mejora la circulación, que reduce la
celulitis, que quita el dolor ni que adelgaza. Sí se puede contar qué es la
técnica, cómo se trabaja, en qué orden, qué se aprende, cuánto dura y para quién
es. Que es lo que de verdad convence.

---

# Si algo falla

Busca tu síntoma. Están ordenados de más probable a menos.

### La web dice «te escribo yo» en vez de «te he mandado un correo»

Significa que la web llamó al script y el script no le contestó como debía. Por
orden, comprueba:

1. **Que el despliegue es público.** Es la causa número uno. Ve a
   **Implementar** → **Gestionar implementaciones** → **lápiz** y mira que en
   «Quién tiene acceso» ponga **Cualquier usuario** y no «Solo yo». Si lo
   cambias, pulsa Implementar.
2. **Que los dos secretos son idénticos.** El del paso 21 (en Apps Script) y el
   de Vercel (paso 40). Si tienes la más mínima duda, invéntate uno nuevo y
   ponlo en los dos sitios. Acuérdate de volver a hacer **Redeploy** en Vercel.
3. **Que hiciste el Redeploy** del paso 41. Sin él, Vercel sigue sin conocer las
   variables.
4. **Que la dirección de `APPS_SCRIPT_URL` termina en `/exec`** y no en `/dev`.

### Abro la dirección del script en el navegador y pone `"listo":false`

Falta alguna propiedad. En esa misma línea, dentro de `"faltan"`, te dice cuál:
por ejemplo `"faltan":["SECRETO"]`. Vuelve al paso 19 y ponla. No hace falta
volver a implementar: las propiedades entran en el momento.

### Abro la dirección del script y me sale una página de Google pidiendo iniciar sesión

El despliegue no es público. Es el punto 1 de más arriba: «Quién tiene acceso»
tiene que ser **Cualquier usuario**.

### Al pulsar Ejecutar me sale un error rojo raro

Casi seguro que en el desplegable de arriba no está elegida **probar**, sino
`doPost` u otra. Solo `probar` se puede ejecutar a mano. Cámbialo (paso 25) y
vuelve a darle.

### El correo llega, pero sin el PDF adjunto

El script no encuentra el archivo. Comprueba en Drive:

1. Que existe un archivo llamado **exactamente** `TECNICA-DIVINE.pdf`. Con
   guiones, en mayúsculas y con la extensión. Si lo renombraste, vuelve a
   dejarlo así.
2. Que está en **Mi unidad** de la misma cuenta con la que creaste el script, y
   no en la papelera ni en una unidad compartida.

Fíjate en que el correo llega igual: el script prefiere mandarlo sin adjunto
antes que no mandarlo.

### No llega ningún correo, pero la fila sí aparece en la hoja

Mira la última columna de esa fila, que te dice el motivo:

- `repetido (ya se le escribió hoy)`: a esa dirección ya se le mandó hace poco.
  Es a propósito, para que nadie reciba tres correos iguales por rellenar el
  formulario tres veces. Si estás probando, prueba con otra dirección o espera
  un rato.
- `no: sin cuota de Gmail`: se han agotado los correos del día. Mira el apartado
  de más arriba.
- `no: ...` con un texto detrás: apunta ese texto y mándamelo.

### La fila no aparece en la hoja

El script no encuentra la hoja. Comprueba que existe una hoja de cálculo
llamada **exactamente** `Respaldo` en Mi unidad, y en la misma cuenta de Google
con la que creaste el script. Si tienes varias cuentas abiertas, es casi
siempre eso.

El correo sale igual aunque la hoja falle: la hoja es el respaldo, no lo
urgente.

### Me llegan los correos a mí pero la persona no recibe el suyo

Dile que mire en Spam o Correo no deseado, y en la pestaña «Promociones» si usa
Gmail. Los primeros correos automáticos de una cuenta nueva a veces caen ahí
hasta que la gente los va abriendo.

### Nada de lo anterior

Entra en `script.google.com`, abre el proyecto y, en la columna de iconos de la
izquierda, pulsa **Ejecuciones** (el icono de las rayitas). Ahí está la lista de
todas las veces que el script se ha puesto en marcha, con la hora. Abre la
última, copia lo que ponga en rojo y mándamelo. Con eso sé exactamente qué ha
pasado.

---

# Chuleta

Apunta esto donde lo tengas a mano. Son los tres datos de todo el montaje.

```
En Drive tienen que estar, con estos nombres exactos:

    TECNICA-DIVINE.pdf        (el adjunto)
    Respaldo                  (la hoja de cálculo)

Correo de los avisos (AVISO_A) .......  sorelacarooficial@gmail.com

Secreto (SECRETO en Apps Script, APPS_SCRIPT_SECRETO en Vercel) ...

    divine-correos-2026-badalona

Dirección del script (APPS_SCRIPT_URL), la que acaba en /exec ...

    ____________________________________________________________________
```

Dónde está cada cosa:

- **El script**: `script.google.com` → proyecto «Captación Divine».
- **Los contactos**: hoja «Captación Divine» en tu Drive (respaldo) y la
  plataforma de la web (la buena).
- **Las propiedades**: dentro del script, rueda dentada → **Configuración del
  proyecto** → abajo del todo.
- **Las variables de la web**: `vercel.com` → tu proyecto → **Settings** →
  **Environment Variables**.
