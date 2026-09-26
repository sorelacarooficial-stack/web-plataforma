# Los manuales de Sorela

Dos documentos, pensados para que los lea ella y no un programador:

- **`manual-cuentas.pdf`** — cómo dar de alta a una persona, qué le llega y qué
  tiene que hacer ella para que esa persona pueda entrar.
- **`manual-plataforma.pdf`** — qué hay en cada apartado, de dónde sale lo que
  ve, y qué pasa cuando alguien deja su contacto en la web.

## Cómo se vuelven a generar

Los PDF no se editan: se escriben los `.html` y se imprimen.

```
npm run manuales
```

Son tres pasos, y se pueden lanzar sueltos:

1. `node --env-file=.env.local docs/capturas.mjs` — abre la plataforma con una
   sesión de verdad, le siembra unos contactos y unas citas de ejemplo, la
   fotografía y borra lo sembrado al terminar.
2. `node docs/optimizar.mjs` — deja cada captura a 1300 px y con paleta. Las
   originales a doble resolución no se suben; las `op-` sí, que son las que los
   manuales enseñan.
3. `node docs/generar.mjs` — imprime los HTML a PDF.

Usa el Chromium que ya está instalado y las tipografías del propio repositorio
(`app/fuentes`), así que el resultado no depende de tener nada más ni de que
haya red. Los tres archivos fuente son `manual-*.html` y `estilo-manual.css`.

## Cuándo hay que tocarlos

Cada vez que cambie algo de lo que cuentan: el menú de la plataforma, los
textos de la pantalla de Cuentas, los roles o el correo automático. Los dos
documentos terminan diciendo que, si algo no encaja, manda la pantalla — pero
eso es una red de seguridad, no una excusa para dejarlos viejos.
