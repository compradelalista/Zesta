# 🛒 Cesta — lista de la compra

Web app muy simple para el día a día. Funciona desde **GitHub Pages**, sin servidor, sin cuentas, y se puede instalar en el móvil como una app.

## Qué hace

- **Listas rápidas**: escribe `2 kg patatas, leche, una docena de huevos` y pulsa Enter → 3 productos. Toca un producto para marcarlo como comprado.
- **Dictado por voz** (botón del micrófono): hablas, ves el texto en directo y **nada se añade hasta que lo revisas**. En la revisión puedes corregir cantidad, unidad y nombre de cada producto, o editar el texto. Así lo que entra en la lista es siempre exactamente lo que quieres.
- **Habituales**: los productos que más compras aparecen como botones `+ Leche` para añadirlos de un toque.
- **Plantillas** (semanal, quincenal, mensual…): vienen tres de ejemplo y puedes crear las tuyas, guardar una lista como plantilla o generar una desde tus habituales. «Crear lista» hace una lista nueva con fecha; «+ A la lista actual» la suma.
- **Presupuesto estimado** en cada producto y total abajo:
  - Al momento, con una tabla orientativa de ~170 productos (`prices.js`, editable).
  - **Precios IA**: con tu clave de API de Anthropic, la IA busca en la web los precios de tu supermercado (Mercadona por defecto; también Carrefour, Lidl, Dia…) y recalcula. Los precios aprendidos se recuerdan.
  - Puedes poner el precio a mano en cualquier producto; ese manda siempre.
- **Compartir**: genera un enlace con la lista dentro (WhatsApp, copiar, menú de compartir del móvil). Quien lo abre guarda una copia; si vuelves a compartir, su copia se actualiza. También puedes pasar una lista a otro usuario del mismo dispositivo.
- **Usuarios locales**: cada persona del dispositivo tiene sus listas, plantillas y precios. Copia de seguridad descargable y restaurable.
- Modo oscuro automático, funciona sin conexión (salvo dictado e IA).

## Publicar en GitHub Pages (5 minutos)

1. Crea un repositorio nuevo en GitHub (por ejemplo `cesta`), público.
2. Sube **todos** los archivos de esta carpeta a la raíz del repositorio (botón *Add file → Upload files*, arrastra y *Commit*).
3. Ve a *Settings → Pages*. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)` y guarda.
4. En un minuto tendrás la app en `https://TU-USUARIO.github.io/cesta/`.
5. En el móvil, ábrela y usa *Añadir a pantalla de inicio* para tenerla como app.

Para probarla en tu ordenador antes: `python3 -m http.server` dentro de la carpeta y abre `http://localhost:8000`.

## Límites que conviene saber

- **Dictado**: usa el reconocimiento de voz del navegador (Chrome/Edge en Android y ordenador, Safari en iPhone). Si tu navegador no lo trae (p. ej. Firefox), la app te abre el cuadro de texto para que uses el micrófono del teclado. Necesita internet.
- **Precios de Mercadona directos**: un navegador no puede leer la web de Mercadona desde otra página (bloqueo CORS), así que la búsqueda de precios reales la hace la IA con búsqueda web. Cuesta céntimos por consulta en tu cuenta de Anthropic. La clave se guarda solo en tu navegador: no la uses en un móvil compartido.
- **Compartir** envía una copia, no es edición simultánea en tiempo real. Para eso haría falta un pequeño servidor (por ejemplo Firebase), que se puede añadir más adelante.
- Los datos viven en el navegador: si borras los datos del sitio, se pierden. Usa *Ajustes → Descargar copia de seguridad* de vez en cuando.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de la página |
| `style.css` | Diseño (móvil primero, modo oscuro) |
| `app.js` | Toda la lógica |
| `prices.js` | Tabla de precios orientativos (edítala a tu gusto) |
| `sw.js`, `manifest.webmanifest`, `icon*` | Instalación como app y uso sin conexión |

Si cambias archivos, sube el número de `CACHE` en `sw.js` (`cesta-v2`…) para que los móviles cojan la versión nueva.
