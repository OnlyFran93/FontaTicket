# FontaTicket

Aplicación web móvil para crear tickets de trabajos de fontanería, mantener un catálogo de productos y consultar tickets guardados.

## Requisitos

- Node.js 20 o posterior
- npm

## Instalar y ejecutar

```bash
npm install
npm run dev
```

Para verificar el proyecto:

```bash
npm test
npm run build
npm run preview
```

## Ver la aplicación en el móvil

Para abrir la versión de desarrollo en el móvil, conecta el teléfono y el ordenador a la misma red Wi-Fi y arranca el servidor así. Mantén el ordenador y el servidor encendidos mientras la usas:

```bash
npm run dev -- --host 0.0.0.0
```

Busca la dirección IPv4 local del ordenador (por ejemplo `192.168.1.25`) y abre `http://192.168.1.25:5173/` en el navegador del teléfono, sustituyendo la dirección por la del ordenador. Permite el acceso en la red local si el firewall de Windows lo solicita. Para acceder desde cualquier lugar, publica el sitio compilado en `dist/` siguiendo la sección de publicación; en móvil, abre la URL HTTPS asignada por el alojamiento.

## Publicar e instalar como PWA

El repositorio incluye un flujo de GitHub Actions que ejecuta las pruebas, compila la aplicación con la ruta `/FontaTicket/` y la publica en GitHub Pages cuando se actualiza `main`. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como fuente de publicación. El repositorio actual es privado; la publicación de Pages desde repositorios privados depende del plan de GitHub. Tras el primer despliegue, la aplicación estará disponible en `https://onlyfran93.github.io/FontaTicket/`.

La compilación normal (`npm run build`) usa la raíz del servidor para conservar el desarrollo y la vista previa locales. Para generar manualmente la versión de Pages en Windows PowerShell:

```powershell
$env:GITHUB_PAGES = "true"
npm run build
Remove-Item Env:GITHUB_PAGES
```

El sitio incluye un manifiesto instalable y un service worker que guarda la aplicación y el catálogo inicial para abrirlos sin conexión después de la primera carga. En Android, abre la URL publicada con Chrome y elige **Instalar aplicación** o **Añadir a pantalla de inicio**. En iPhone/iPad, ábrela en Safari y elige **Compartir → Añadir a pantalla de inicio**. La instalación requiere el sitio publicado mediante HTTPS. IndexedDB sigue siendo local a cada navegador/dispositivo; el service worker no sincroniza los datos.

El artefacto publicable manualmente es `dist/`; para cualquier alojamiento distinto de GitHub Pages, usa `npm run build` sin `GITHUB_PAGES`.

## Datos y privacidad

El catálogo, las fotos, el historial y las citas de AGENDA se guardan en IndexedDB del navegador y dispositivo actuales. Permanecen disponibles después de cerrar o actualizar la aplicación si se conserva el mismo origen y el almacenamiento del navegador no se borra. Los datos no se suben al alojamiento ni se sincronizan automáticamente entre navegadores o dispositivos: incluso si PC y móvil abren la misma web, cada uno mantiene sus propios datos locales. Para copiar el catálogo y las fotos entre dispositivos, exporta e importa el ZIP; el historial y las citas no forman parte de ese ZIP y permanecen en cada dispositivo. Como en cualquier aplicación web local, el navegador puede eliminar datos si el usuario borra el almacenamiento del sitio o por políticas de espacio.

Los tickets guardan una copia de sus conceptos, descripciones, referencias y precios al generarse: editar, eliminar o borrar productos del catálogo no modifica los tickets ya guardados. El botón `WHATSAPP` comparte la imagen PNG mediante el selector nativo de archivos del dispositivo si el navegador lo admite. En PC sin esa función, intenta copiar la imagen al portapapeles y abrir WhatsApp Web. Por restricciones del navegador y de WhatsApp Web, la aplicación no puede seleccionar una conversación ni adjuntar/enviar el archivo automáticamente desde una página web; el acceso al portapapeles normalmente requiere HTTPS o localhost. No se descarga un archivo como fallback. `IMPRIMIR` abre el diálogo de impresión del navegador.

En `HISTORIAL` se puede filtrar por fechas o seleccionar un mes completo. El resumen suma las líneas cuyo concepto sea `Mano de obra` en esa categoría y clasifica el resto como materiales; el producto se prepara en el catálogo con precio de `1,00 €` para que su cantidad equivalga directamente al importe de mano de obra. La cantidad de cada línea del ticket se puede introducir directamente.

`AGENDA` permite guardar citas ordenadas por fecha y hora, editarlas o eliminarlas. Cada cita incluye cliente, fecha, hora, dirección, trabajo a realizar y una lista de materiales con casillas para marcar lo que ya se tiene o se ha comprado. Las citas y el estado de esas casillas se guardan localmente en el mismo navegador.

## Formato del catálogo ZIP

`IMPORTAR CATÁLOGO` abre el selector de archivos para escoger directamente un `.zip`. Solo admite ZIP —no RAR ni otros formatos— con `productos.json` en la raíz y las fotos referenciadas dentro de `imagenes/`. Conserva los registros incompletos que tengan nombre o precio, además de sus asociaciones de imágenes; omite los que no tienen nombre ni precio (incluidos los que solo contienen foto). Ignora las imágenes sueltas que no estén asociadas a un registro. La referencia es opcional y también se admite el campo `referencia`, usado por el ZIP inicial adjunto. La importación reemplaza el catálogo actual.

`EXPORTAR CATÁLOGO` genera un ZIP compatible con este formato, con `productos.json` y la carpeta `imagenes/`. El JSON es una lista de productos con `reference`, `nombre`, `precio` y `foto`; `foto` contiene la ruta relativa de la imagen (`imagenes/...`) o `null` si no hay foto. No incluye productos que no tengan nombre ni precio.

El catálogo adjunto se importa automáticamente solo en el primer inicio y únicamente cuando el catálogo local está vacío. En la primera carga tras esta actualización se eliminan del catálogo local los productos que no tengan nombre ni precio; el historial y los demás productos no se modifican. El ZIP del catálogo inicial y sus fotos se publican como archivo estático para sembrar el primer uso. Los tickets y los cambios posteriores del catálogo (incluidas las fotos importadas o añadidas) permanecen en el IndexedDB de cada navegador y no se sincronizan con GitHub Pages.
