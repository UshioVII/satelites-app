# Fase 6 — Cuentas, perfil y favoritos

Fecha: 2026-07-13
Estado: aprobado, pendiente de implementación

## Objetivo

Agregar cuentas de usuario a Satélites App. El corazón del proyecto es un **CRUD**
(favoritos + perfil + notas) protegido por **sesión sostenida con token JWT**: al loguearse el
usuario recibe un token; mientras sea válido, la sesión se mantiene sin volver a loguear.

Además se enriquece el visualizador: info tipo enciclopedia por satélite (Wikipedia +
imagen), notas personales del usuario, y un mapa de calor de densidad de satélites con
modo de visualización configurable y persistido por usuario.

## Alcance

Incluye:
- Backend Node + Express con SQLite y JWT (nuevo, la app hoy es solo frontend).
- Registro, login y sesión por token.
- CRUD de favoritos (un favorito = un satélite).
- CRUD de notas personales por satélite (una nota por usuario + satélite).
- Perfil editable (nombre visible + ubicación de casa + modo de visualización).
- Panel de info por satélite: resumen + imagen desde Wikipedia (read-only), con fallback.
- Mapa de calor de densidad de satélites, con toggle puntos / heatmap / hexbin.
- Home informativa, rutas nuevas en el frontend y protección de ruta.

Fuera de alcance (se agregan solo si deja de ser learning/portfolio):
- Refresh tokens, verificación de email, reset de password, roles/permisos.
- Cachear/persistir en base los datos de Wikipedia (se consultan en vivo desde el frontend).
- Fotos reales garantizadas por satélite: no existe fuente para todo el dataset; solo hay
  imagen cuando el satélite tiene página en Wikipedia, si no va un ícono genérico.

## Stack

- **Runtime:** Node (el que ya tiene cualquiera que clone el repo). Sin Bun para no forzar
  instalación de otro runtime.
- **Backend:** `express`, `better-sqlite3` (binarios prebuilt, no compila nativo),
  `jsonwebtoken`, `bcryptjs` (hash en JS puro, portable), `cors` (dev cross-port).
- **Frontend:** Angular 22 ya existente (standalone, signals).

Razón de cada elección: portabilidad. `npm install && npm run server` debe funcionar sin
toolchain nativo ni runtimes extra.

## Arquitectura

Mismo repo, se agrega `server/`. En desarrollo corren en paralelo: Angular en :4200 y el
backend en :3000. El proxy de Angular (`proxy.conf.json`) ya redirige `/celestrak`; se
agrega `/api → http://localhost:3000`.

```
satelites-app/
  src/                  Angular (existente)
  server/
    db.ts               conexión SQLite + creación de schema
    auth.ts             hashPassword/verify, signToken/verifyToken, middleware requireAuth
    routes.auth.ts      /api/register, /api/login, /api/me (GET/PATCH)
    routes.favorites.ts /api/favorites (GET/POST/DELETE)
    routes.notes.ts     /api/notes/:norad_id (GET/PUT/DELETE)
    index.ts            arma express, monta rutas, escucha :3000
    test.js             self-check del flujo completo (asserts, sin framework)
    data.db             base SQLite (gitignored)
  proxy.conf.json       + /api
  package.json          + deps y script "server"
```

Cada módulo tiene una responsabilidad y una interfaz clara: `db` expone la conexión,
`auth` expone hashing/token/guard, los `routes.*` solo arman handlers Express.

## Modelo de datos (SQLite)

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  home_lat      REAL,
  home_lng      REAL,
  viz_mode      TEXT NOT NULL DEFAULT 'points',  -- 'points' | 'heatmap' | 'hexbin'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  norad_id   INTEGER NOT NULL,     -- clave estable del satélite
  sat_name   TEXT NOT NULL,        -- nombre para mostrar
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, norad_id)        -- no duplicar el mismo satélite
);

CREATE TABLE notes (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  norad_id   INTEGER NOT NULL,     -- satélite al que aplica la nota
  body       TEXT NOT NULL,        -- texto de la nota (markdown plano)
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, norad_id)  -- una nota por usuario y satélite (upsert)
);
```

`norad_id` sale de la línea 1 del TLE (o de `satrec.satnum` vía satellite.js). Se guarda
como clave estable porque los nombres pueden cambiar. `viz_mode` guarda la preferencia de
visualización del globo por usuario.

## API

Todas bajo `/api`. Las que requieren sesión validan `Authorization: Bearer <jwt>`.

| Método | Ruta | Auth | Cuerpo / respuesta |
|--------|------|------|--------------------|
| POST | `/register` | no | `{email, password, display_name}` → `{token, user}` |
| POST | `/login` | no | `{email, password}` → `{token, user}` |
| GET | `/me` | sí | → `{id, email, display_name, home_lat, home_lng, viz_mode}` |
| PATCH | `/me` | sí | `{display_name?, home_lat?, home_lng?, viz_mode?}` → user actualizado |
| GET | `/favorites` | sí | → `[{id, norad_id, sat_name, created_at}]` |
| POST | `/favorites` | sí | `{norad_id, sat_name}` → favorito creado (409 si ya existe) |
| DELETE | `/favorites/:id` | sí | → 204 (solo si el favorito es del usuario) |
| GET | `/notes/:norad_id` | sí | → `{norad_id, body, updated_at}` o 404 si no hay |
| PUT | `/notes/:norad_id` | sí | `{body}` → upsert de la nota (crea o reemplaza) |
| DELETE | `/notes/:norad_id` | sí | → 204 |

Reglas:
- Password nunca vuelve en ninguna respuesta.
- JWT HS256, firmado con secreto de env (`JWT_SECRET`, con fallback de dev). Expira en 7 días.
- Validación en el borde: email con formato, password mínimo 8 chars, `display_name` no vacío.
- Errores con status correcto: 400 (validación), 401 (sin/token inválido), 404, 409 (conflicto).

## Frontend

Hoy `App` es un solo componente con el globo. Se refactoriza a un **shell** con navbar +
`<router-outlet>`, y el globo se mueve a su propio componente de ruta (sin cambiar su lógica).

Rutas:
- `/` — **Home**: qué es el proyecto, qué hace, stack, y CTA a login / ver globo.
- `/login`, `/register` — formularios.
- `/globe` — el visualizador actual.
- `/profile` — protegido por guard: editar nombre y ubicación de casa; listar y quitar favoritos.

Piezas nuevas:
- `auth.service.ts` — register/login/logout, guarda el JWT en `localStorage`, expone
  `isLoggedIn` (signal) y el usuario actual (incluye `viz_mode`).
- `auth.interceptor.ts` — agrega `Authorization: Bearer` a los requests a `/api`.
- `auth.guard.ts` — redirige a `/login` si no hay sesión al entrar a `/profile`.
- `favorites.service.ts` — CRUD de favoritos contra `/api/favorites`.
- `notes.service.ts` — GET/PUT/DELETE de la nota personal por `norad_id`.
- `wiki.service.ts` — consulta la API REST de Wikipedia por nombre de satélite; devuelve
  `{extract, thumbnail}` o `null` si no hay página. Cachea en memoria por sesión.

### Panel de info del satélite (en `/globe`)

Al seleccionar un satélite, además de la telemetría actual, el panel muestra:
- **Wikipedia** (siempre, con o sin sesión): resumen + imagen si `wiki.service` encontró
  página; si no, un ícono genérico de satélite y una nota de "sin datos de Wikipedia".
  El nombre del TLE se limpia (quita paréntesis, ej. `ISS (ZARYA)` → `ISS`) para la búsqueda.
- **Notas personales** (solo con sesión): textarea con la nota del usuario para ese satélite;
  guarda con PUT (upsert), permite borrar. Sin sesión, invita a loguearse.

### Mapa de calor (en `/globe`)

Toggle con tres modos sobre los mismos datos ya propagados:
- `points` — el render actual (puntos por satélite).
- `heatmap` — capa de densidad de globe.gl alimentada con las posiciones actuales; resalta
  las regiones con más satélites encima.
- `hexbin` — agregación hexagonal con altura/color por cantidad.

La API exacta de la capa (heatmap vs hexbin de globe.gl) se verifica leyendo globe.gl al
implementar; el diseño fija el comportamiento, no el nombre del método. El modo elegido se
persiste vía `PATCH /me { viz_mode }` cuando hay sesión; sin sesión, es solo un toggle local
que arranca en `points`.

Integración con lo existente:
- En `/globe`, al seleccionar un satélite, botón **★ Favorito** visible solo si hay sesión;
  hace POST con `norad_id` + nombre. Si ya es favorito, permite quitarlo.
- La **ubicación de casa** guardada en el perfil se usa como observador por defecto para
  "satélites encima" y predicción de pases (sin pedir geolocalización cada vez); el botón
  de geolocalización sigue disponible para sobreescribir.
- Al entrar a `/globe` con sesión, el globo arranca en el `viz_mode` guardado del usuario.

## Manejo de errores

- Backend: cada handler responde el status correcto (ver tabla). Errores no esperados → 500
  con log en consola, sin filtrar detalles internos al cliente.
- Frontend: los formularios muestran el mensaje del backend (email en uso, credenciales
  inválidas, etc.). Un 401 en cualquier request limpia el token y redirige a `/login`.

## Testing

- **Backend** — `server/test.js`, asserts nativos (sin framework): register → login → GET /me
  → PATCH /me (viz_mode) → POST favorito → GET favoritos → DELETE → PUT nota → GET nota →
  DELETE nota → verificar listas vacías. Cubre también rechazo sin token (401) y password mal
  (401). Usa una DB temporal.
- **Frontend** — specs de `auth.service` (guarda/limpia token) y `auth.guard` (bloquea sin
  sesión). Los 4 tests actuales del globo siguen verdes.

Nota de dependencia externa: `wiki.service` pega a Wikipedia en vivo; en tests se mockea la
respuesta HTTP, no se llama a la red real.

## Desarrollo

```bash
npm install
npm run server      # backend Express en :3000
npm start           # Angular en :4200 (proxy /api -> :3000, /celestrak -> CelesTrak)
```

`data.db` y `.env` van al `.gitignore`.
