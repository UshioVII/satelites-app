# Satélites App

Visualizador 3D de satélites en tiempo real. Renderiza un globo terráqueo interactivo y
propaga las órbitas de satélites desde datos TLE reales, calculando posiciones al segundo.

![Angular](https://img.shields.io/badge/Angular-22-dd0031) ![License](https://img.shields.io/badge/license-MIT-blue)

## Qué hace

- **Globo 3D en vivo**: satélites del grupo `visual` de CelesTrak posicionados en tiempo real
  sobre la Tierra nocturna, con auto-rotación.
- **Selección interactiva**: click en un satélite para congelar la escena, dibujar su órbita
  completa y ver su telemetría (posición, altitud, velocidad).
- **"¿Qué tengo encima?"**: con tu geolocalización, calcula qué satélites están sobre tu
  horizonte ahora mismo (elevación/azimut/compás).
- **Predicción de pases**: para el satélite seleccionado, los próximos pases visibles sobre
  tu ubicación.
- **Resiliencia**: si CelesTrak no responde, cae automáticamente a un snapshot TLE bundleado
  (`public/visual.tle`, 158 satélites) y avisa en la UI con opción de reintentar en vivo.

## Stack

- Angular 22 (standalone, signals, zoneless)
- [globe.gl](https://github.com/vasturiano/globe.gl) + three.js — render del globo
- [satellite.js](https://github.com/shashwatak/satellite-js) — propagación SGP4 de TLEs
- Vitest — tests unitarios

## Desarrollo

```bash
npm install
npm start          # ng serve -> http://localhost:4200
```

El dev server proxea `/celestrak` hacia CelesTrak (ver `proxy.conf.json`) para evitar CORS.

```bash
npm run build      # build de producción a dist/
npm test           # tests unitarios (Vitest)
```

## Fuente de datos

TLEs del grupo `visual` de [CelesTrak](https://celestrak.org). Si la fuente en vivo falla
(timeout de 12s o error), el servicio usa el snapshot bundleado en `public/visual.tle`.

## Roadmap

- [x] **Fase 1** — Scaffold Angular 22
- [x] **Fase 2** — MVP: globo 3D con satélites en tiempo real
- [x] **Fase 3** — Selección interactiva, órbita y panel de telemetría
- [x] **Fase 4** — Geolocalización, satélites sobre el observador y predicción de pases
- [x] **Fase 5** — Resiliencia con fallback TLE
- [ ] **Fase 6** — Autenticación JWT

## Licencia

MIT
