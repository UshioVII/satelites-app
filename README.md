# 🛰️ Satélites

Visualizador 3D de satélites en tiempo real. Renderiza un globo terráqueo interactivo,
propaga las órbitas desde datos TLE reales (CelesTrak) calculando posiciones al segundo, y
suma cuentas de usuario, favoritos, notas y estadísticas — con una capa de diseño cuidada.

![Angular](https://img.shields.io/badge/Angular-22-dd0031) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6) ![Node](https://img.shields.io/badge/Node-Express-339933) ![License](https://img.shields.io/badge/license-MIT-blue)

> Nació de un reto: *"hacé un CRUD que consuma APIs y use tokens para las cuentas"*. El CRUD
> son los favoritos y las notas, las APIs son CelesTrak y Wikipedia, los tokens (JWT) mantienen
> la sesión. La visualización 3D fue una decisión propia, por encima de lo que pedía el reto.

## Qué hace

- **Globo 3D en vivo** — satélites del grupo `visual` de CelesTrak posicionados en tiempo real
  sobre la Tierra nocturna. Vista de puntos o mapa de calor de densidad.
- **Ficha de cada satélite** — click y ves su telemetría (altitud, velocidad, período,
  inclinación), su órbita trazada y un resumen de Wikipedia.
- **"¿Qué tengo encima?"** — con tu geolocalización, qué satélites están sobre vos ahora y a
  qué elevación, con medidores verticales rojo/amarillo/verde.
- **Predicción de pases** — cuándo y por dónde cruza un satélite, con su perfil de elevación.
- **Cuentas + favoritos + notas** — registro/login (JWT), guardá satélites con color propio
  (se pintan en el globo), notas por satélite, y encontralos en el globo desde el perfil.
- **Perfil + estadísticas** — avatar (planetas reales animados), y gráficos (perfil de pase,
  comparación de favoritos en el tiempo).
- **Sistema de ventanas estilo SO** — ficha, "sobre mí", perfil y stats se abren desde un dock,
  se arrastran, redimensionan y cierran. Con toasts, sonidos sutiles y micro-animaciones.
- **Resiliencia** — si CelesTrak no responde, cae a un snapshot TLE bundleado y avisa en la UI.

## Stack

- **Frontend** — Angular 22 (standalone, signals), [globe.gl](https://github.com/vasturiano/globe.gl) + three.js,
  [satellite.js](https://github.com/shashwatak/satellite-js) (SGP4), [chart.js](https://www.chartjs.org/)
- **Backend** — Node + Express, SQLite (better-sqlite3), JWT + bcrypt
- **Datos** — CelesTrak (TLE) · Wikipedia REST
- **Tests** — Vitest (frontend) · `node:test` (backend)

## Desarrollo

Requiere Node ≥ 24.15 para el CLI de Angular. Si tu Node es más viejo, corré el CLI vía
`node node_modules/@angular/cli/bin/bootstrap.js <serve|build|test>` (o usá el `dev.cmd`).

```bash
npm install

# frontend (proxy /api -> :3000 y /celestrak -> CelesTrak, ver proxy.conf.json)
npm start            # http://localhost:4200

# backend (aparte)
npm run server       # API en http://localhost:3000
```

```bash
npm run build        # build de producción a dist/
npm test             # tests del frontend (Vitest)
npm run server:test  # tests del backend (node --test)
```

Variables de entorno (backend): `JWT_SECRET` (obligatoria en producción), `PORT`, `DB_PATH`,
`CORS_ORIGIN`.

## Estructura

```
src/app/
  globe/        el mundo 3D, el dock y las ventanas
  sat/          ficha del satélite (Wikipedia, notas), servicios
  profile/      perfil, avatar (planetas), favoritos
  stats/        estadísticas y gráficos
  auth/         guard, interceptor y servicio de sesión
  ui/           componentes reutilizables (ventana, fondo nebulosa, medidor, toasts, sonidos)
  satellites.service.ts   carga de TLEs + propagación orbital
server/         API Node/Express (auth, favorites, notes, avatar) + SQLite
docs/           specs de diseño y planes de implementación
```

## Fuente de datos

TLEs del grupo `visual` de [CelesTrak](https://celestrak.org). Si la fuente en vivo falla
(timeout de 12s o error), el servicio usa el snapshot bundleado en `public/visual.tle`.

## Roadmap

- [x] Globo 3D con satélites en tiempo real, selección, órbitas y telemetría
- [x] Geolocalización, satélites sobre el observador y predicción de pases
- [x] Resiliencia con fallback TLE
- [x] Backend: autenticación JWT, favoritos, notas, avatar
- [x] Frontend: perfil, favoritos, notas + Wikipedia, mapa de calor, estadísticas
- [x] Rediseño visual "Nebula" (sistema de diseño completo)
- [x] Ventanas estilo SO, responsive, toasts, sonidos, avatares de planetas
- [ ] Despliegue público

## Licencia

MIT
