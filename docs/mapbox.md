# Versión "Mapbox" del visualizador (rama `mapbox`)

Réplica del globo de satélites usando **MapLibre GL JS** (proyección de globo) en vez de globe.gl.
MapLibre es el fork open-source de Mapbox GL: misma API, pero **gratis, sin token ni cuenta ni
tarjeta**. Vive en la ruta `/map` (link "Mapa (beta)" en el nav). Reusa el mismo
`satellites.service` — no duplica lógica de dominio, solo cambia la capa de render.

> El amigo de Diego pidió "replicar el mapa en Mapbox". Mapbox exige tarjeta/banco de EEUU para
> activar la cuenta, así que se usó MapLibre (mismo motor, estilo libre de Carto) para lograr lo
> mismo sin costo. Si algún día se quiere el Mapbox real, es cambiar el import y poner el token.

## Para verlo andar

No hace falta configurar nada: `npm start` → entrá a `/map`. Usa el estilo libre
`dark-matter` de Carto (`https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`),
que no pide key.

## Qué está implementado

- Mapa MapLibre con **proyección de globo** + atmósfera (`setProjection({ type: 'globe' })`),
  estilo oscuro libre de Carto.
- Los **satélites** como puntos, actualizados cada segundo (`positionsAt`).
- **Clic en un satélite** → popup con su telemetría (altitud, velocidad, período, inclinación) y
  se dibuja su **órbita** como línea. El seleccionado se resalta.
- **Clic en el vacío** → deselecciona (limpia órbita y resalte).
- Cursor `pointer` al pasar por encima de un satélite.

## Posibles próximos pasos

- Toggle **Puntos / Calor** (MapLibre tiene capa `heatmap` nativa).
- **"¿Qué tengo encima?"** con geolocalización.
- Colorear **favoritos** (requiere backend/cuenta).
- Comparar el rendimiento vs. globe.gl con muchos satélites.

## Archivos

- `src/app/mapbox/mapbox-map.ts` — el componente del mapa (usa `maplibre-gl`).
- Ruta `/map` en `src/app/app.routes.ts`; link en `src/app/app.html`.
- `maplibre-gl` (dep) + su CSS (`maplibre-gl.css`) en `angular.json`.
