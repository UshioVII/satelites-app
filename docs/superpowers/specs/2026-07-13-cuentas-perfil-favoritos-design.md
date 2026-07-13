# Fase 6 — Cuentas, perfil y favoritos

Fecha: 2026-07-13
Estado: aprobado, pendiente de implementación

## Objetivo

Agregar cuentas de usuario a Satélites App. El corazón del proyecto es un **CRUD**
(favoritos + perfil) protegido por **sesión sostenida con token JWT**: al loguearse el
usuario recibe un token; mientras sea válido, la sesión se mantiene sin volver a loguear.

## Alcance

Incluye:
- Backend Node + Express con SQLite y JWT (nuevo, la app hoy es solo frontend).
- Registro, login y sesión por token.
- CRUD de favoritos (un favorito = un satélite).
- Perfil editable (nombre visible + ubicación de casa).
- Home informativa, rutas nuevas en el frontend y protección de ruta.

Fuera de alcance (se agregan solo si deja de ser learning/portfolio):
- Refresh tokens, verificación de email, reset de password, roles/permers.

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
```

`norad_id` sale de la línea 1 del TLE (o de `satrec.satnum` vía satellite.js). Se guarda
como clave estable porque los nombres pueden cambiar.

## API

Todas bajo `/api`. Las que requieren sesión validan `Authorization: Bearer <jwt>`.

| Método | Ruta | Auth | Cuerpo / respuesta |
|--------|------|------|--------------------|
| POST | `/register` | no | `{email, password, display_name}` → `{token, user}` |
| POST | `/login` | no | `{email, password}` → `{token, user}` |
| GET | `/me` | sí | → `{id, email, display_name, home_lat, home_lng}` |
| PATCH | `/me` | sí | `{display_name?, home_lat?, home_lng?}` → user actualizado |
| GET | `/favorites` | sí | → `[{id, norad_id, sat_name, created_at}]` |
| POST | `/favorites` | sí | `{norad_id, sat_name}` → favorito creado (409 si ya existe) |
| DELETE | `/favorites/:id` | sí | → 204 (solo si el favorito es del usuario) |

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
  `isLoggedIn` (signal) y el usuario actual.
- `auth.interceptor.ts` — agrega `Authorization: Bearer` a los requests a `/api`.
- `auth.guard.ts` — redirige a `/login` si no hay sesión al entrar a `/profile`.
- `favorites.service.ts` — CRUD de favoritos contra `/api/favorites`.

Integración con lo existente:
- En `/globe`, al seleccionar un satélite, botón **★ Favorito** visible solo si hay sesión;
  hace POST con `norad_id` + nombre. Si ya es favorito, permite quitarlo.
- La **ubicación de casa** guardada en el perfil se usa como observador por defecto para
  "satélites encima" y predicción de pases (sin pedir geolocalización cada vez); el botón
  de geolocalización sigue disponible para sobreescribir.

## Manejo de errores

- Backend: cada handler responde el status correcto (ver tabla). Errores no esperados → 500
  con log en consola, sin filtrar detalles internos al cliente.
- Frontend: los formularios muestran el mensaje del backend (email en uso, credenciales
  inválidas, etc.). Un 401 en cualquier request limpia el token y redirige a `/login`.

## Testing

- **Backend** — `server/test.js`, asserts nativos (sin framework): register → login → GET /me
  → POST favorito → GET favoritos → DELETE → verificar lista vacía. Cubre también rechazo sin
  token (401) y password mal (401). Usa una DB temporal.
- **Frontend** — specs de `auth.service` (guarda/limpia token) y `auth.guard` (bloquea sin
  sesión). Los 4 tests actuales del globo siguen verdes.

## Desarrollo

```bash
npm install
npm run server      # backend Express en :3000
npm start           # Angular en :4200 (proxy /api -> :3000, /celestrak -> CelesTrak)
```

`data.db` y `.env` van al `.gitignore`.
