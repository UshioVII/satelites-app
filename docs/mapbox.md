# Versión Mapbox del visualizador (rama `mapbox`)

Réplica del globo de satélites usando **Mapbox GL JS** (proyección de globo) en vez de globe.gl.
Vive en la ruta `/map` (link "Mapa (beta)" en el nav). Reusa el mismo `satellites.service` — no
duplica lógica de dominio, solo cambia la capa de render.

## Para verlo andar: poné tu token de Mapbox

1. Creá una cuenta gratis en https://account.mapbox.com/ (el free tier no pide tarjeta).
2. Copiá tu **Default public token** (empieza con `pk.`) desde *Access tokens*.
3. Pegalo en `src/app/mapbox/mapbox.config.ts`:
   ```ts
   export const MAPBOX_TOKEN = 'pk.tu_token_aca';
   ```
4. `npm start` → entrá a `/map`. (Sin token, la página muestra un aviso en vez del mapa.)

> Es un token **público** (se usa en el navegador). Conviene restringirlo por URL desde el panel
> de Mapbox para que no lo use cualquiera.

## Qué está implementado

- Mapa Mapbox con **proyección de globo** + atmósfera (`setFog`), estilo `dark-v11`.
- Los **satélites** como puntos, actualizados cada segundo (`positionsAt`).
- **Clic en un satélite** → popup con su telemetría (altitud, velocidad, período, inclinación) y
  se dibuja su **órbita** como línea. El seleccionado se resalta.
- **Clic en el vacío** → deselecciona (limpia órbita y resalte).
- Cursor `pointer` al pasar por encima de un satélite.

## Posibles próximos pasos

- Toggle **Puntos / Calor** (Mapbox tiene capa `heatmap` nativa).
- **"¿Qué tengo encima?"** con geolocalización.
- Colorear **favoritos** (requiere backend/cuenta).
- Comparar el rendimiento vs. globe.gl con muchos satélites.

## Archivos

- `src/app/mapbox/mapbox-map.ts` — el componente del mapa.
- `src/app/mapbox/mapbox.config.ts` — el token (vacío por defecto).
- Ruta `/map` en `src/app/app.routes.ts`; link en `src/app/app.html`.
- `mapbox-gl` (dep) + su CSS en `angular.json`.
