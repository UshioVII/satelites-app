# Fase 6 — Backend (cuentas, CRUD, JWT) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el backend Node + Express + SQLite con auth JWT y el CRUD completo (perfil, favoritos, notas, avatar) que consumirá el frontend Angular.

**Architecture:** Server CommonJS sin build step. `db.js` abre SQLite (better-sqlite3) y crea el schema. `auth.js` provee hashing, firma/verificación de JWT y el middleware `requireAuth`. Cada recurso vive en su `routes.*.js` como factory `(db) => Router`. `index.js` expone `createApp(db)` (para tests) y arranca el server solo si se ejecuta directo.

**Tech Stack:** Node 24, Express 5, better-sqlite3, jsonwebtoken, bcryptjs, cors, multer. Tests con el runner nativo `node:test` + `node:assert/strict` (sin framework externo).

## Global Constraints

- Runtime: Node (sin Bun). `npm install && npm run server` debe funcionar sin toolchain nativo extra.
- Backend en **CommonJS** (`require`/`module.exports`), archivos `.js`. El `package.json` raíz NO debe declarar `"type": "module"` (rompería CommonJS y el tooling de Angular).
- Password nunca vuelve en ninguna respuesta (jamás seleccionar `password_hash` en payloads de salida).
- JWT HS256, secreto de `process.env.JWT_SECRET` con fallback de dev `'dev-secret-change-me'`, expira en `7d`.
- Validación en el borde: email con formato, password mínimo 8 chars, `display_name` no vacío.
- Upload de avatar: solo `image/*`, máximo 2 MB, nombre de archivo generado por el server (no confiar en el nombre del cliente).
- Status codes: 400 (validación), 401 (sin token / token inválido), 404 (no existe), 409 (conflicto), 204 (borrado ok).
- `norad_id` es entero, `sat_name` string. Clave estable del satélite = `norad_id`.
- Todo bajo `/api`. El server escucha en `:3000` (o `process.env.PORT`).

---

## File Structure

- `server/db.js` — `openDb(file)`: abre SQLite, activa `foreign_keys`, crea schema. Una responsabilidad: la base.
- `server/auth.js` — `hashPassword`, `verifyPassword`, `signToken`, `verifyToken`, `requireAuth(db)`, `publicUser(row)`. Toda la lógica de credenciales/sesión.
- `server/validate.js` — helpers de validación puros (`isEmail`, `validRegister`, etc.). Separado para testear sin HTTP.
- `server/routes.auth.js` — `(db) => Router` con `/register`, `/login`, `GET/PATCH /me`.
- `server/routes.favorites.js` — `(db) => Router` con `GET/POST/PATCH/DELETE` de favoritos.
- `server/routes.notes.js` — `(db) => Router` con `GET/PUT/DELETE /:norad_id`.
- `server/routes.avatar.js` — `(db) => Router` con `POST /` (multipart).
- `server/index.js` — `createApp(db)` arma Express; arranca `listen` solo si es el módulo principal.
- `server/*.test.js` — un archivo de test por módulo, corre con `node --test`.
- `server/test.js` — self-check end-to-end del flujo completo (spec), corre contra un app en puerto efímero.

---

## Task 1: Setup + módulo de base de datos

**Files:**
- Modify: `package.json` (deps + scripts)
- Modify: `.gitignore`
- Create: `server/db.js`
- Test: `server/db.test.js`

**Interfaces:**
- Produces: `openDb(file: string) => Database` (instancia better-sqlite3 con schema creado y `foreign_keys` ON). `file` puede ser `':memory:'`.

- [ ] **Step 1: Instalar dependencias del backend**

Run:
```bash
cd "D:/satelites-app" && npm install express better-sqlite3 jsonwebtoken bcryptjs cors multer
```
Expected: se agregan a `dependencies` sin errores de compilación (better-sqlite3 baja binario prebuilt).

- [ ] **Step 2: Agregar scripts al package.json**

En `package.json`, dentro de `"scripts"`, agregar:
```json
"server": "node server/index.js",
"server:test": "node --test server/*.test.js"
```
No agregar `"type"`. Dejar los scripts de Angular como están.

- [ ] **Step 3: Ignorar la base y los archivos subidos**

Al final de `.gitignore` agregar:
```
# Backend
/server/data.db
/server/data.db-*
/server/media/
.env
```

- [ ] **Step 4: Escribir el test que falla**

Crear `server/db.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('./db');

test('openDb crea las tablas y columnas esperadas', () => {
  const db = openDb(':memory:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  assert.ok(tables.includes('users'));
  assert.ok(tables.includes('favorites'));
  assert.ok(tables.includes('notes'));

  const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  for (const c of ['email', 'password_hash', 'display_name', 'home_lat', 'home_lng', 'viz_mode', 'avatar']) {
    assert.ok(userCols.includes(c), `falta columna users.${c}`);
  }
});

test('foreign_keys está activado', () => {
  const db = openDb(':memory:');
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
});
```

- [ ] **Step 5: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node --test server/db.test.js`
Expected: FAIL con `Cannot find module './db'`.

- [ ] **Step 6: Implementar db.js**

Crear `server/db.js`:
```js
const Database = require('better-sqlite3');

function openDb(file = process.env.DB_PATH || `${__dirname}/data.db`) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name  TEXT NOT NULL,
      home_lat      REAL,
      home_lng      REAL,
      viz_mode      TEXT NOT NULL DEFAULT 'points',
      avatar        TEXT NOT NULL DEFAULT 'preset:earth',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS favorites (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      norad_id   INTEGER NOT NULL,
      sat_name   TEXT NOT NULL,
      archived   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, norad_id)
    );
    CREATE TABLE IF NOT EXISTS notes (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      norad_id   INTEGER NOT NULL,
      body       TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, norad_id)
    );
  `);
}

module.exports = { openDb };
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node --test server/db.test.js`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
cd "D:/satelites-app" && git add package.json package-lock.json .gitignore server/db.js server/db.test.js
git commit -m "feat(backend): setup deps y schema SQLite"
```

---

## Task 2: Validación y auth (hash, JWT, requireAuth)

**Files:**
- Create: `server/validate.js`
- Create: `server/auth.js`
- Test: `server/auth.test.js`

**Interfaces:**
- Consumes: `openDb` (Task 1).
- Produces:
  - `validate.isEmail(s) => boolean`, `validate.registerErrors({email, password, display_name}) => string|null`.
  - `auth.hashPassword(pw) => string`, `auth.verifyPassword(pw, hash) => boolean`.
  - `auth.signToken(user) => string`, `auth.verifyToken(token) => {uid}|null`.
  - `auth.publicUser(row) => {id,email,display_name,home_lat,home_lng,viz_mode,avatar}` (sin `password_hash`).
  - `auth.requireAuth(db) => (req,res,next)` que setea `req.user = publicUser(...)` o responde 401.

- [ ] **Step 1: Escribir el test que falla**

Crear `server/auth.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, signToken, verifyToken, publicUser } = require('./auth');
const { registerErrors, isEmail } = require('./validate');

test('hash y verify de password', () => {
  const h = hashPassword('secreto12');
  assert.notEqual(h, 'secreto12');
  assert.equal(verifyPassword('secreto12', h), true);
  assert.equal(verifyPassword('otra', h), false);
});

test('token round-trip', () => {
  const t = signToken({ id: 7 });
  assert.equal(verifyToken(t).uid, 7);
  assert.equal(verifyToken('basura'), null);
});

test('publicUser no filtra password_hash', () => {
  const pub = publicUser({ id: 1, email: 'a@b.com', password_hash: 'x', display_name: 'A', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' });
  assert.equal(pub.password_hash, undefined);
  assert.equal(pub.email, 'a@b.com');
});

test('validación de registro', () => {
  assert.equal(registerErrors({ email: 'a@b.com', password: '12345678', display_name: 'A' }), null);
  assert.match(registerErrors({ email: 'malito', password: '12345678', display_name: 'A' }), /email/i);
  assert.match(registerErrors({ email: 'a@b.com', password: '123', display_name: 'A' }), /password/i);
  assert.match(registerErrors({ email: 'a@b.com', password: '12345678', display_name: '' }), /nombre/i);
  assert.equal(isEmail('a@b.com'), true);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node --test server/auth.test.js`
Expected: FAIL con `Cannot find module './auth'`.

- [ ] **Step 3: Implementar validate.js**

Crear `server/validate.js`:
```js
function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function registerErrors({ email, password, display_name }) {
  if (!isEmail(email)) return 'email inválido';
  if (typeof password !== 'string' || password.length < 8) return 'password mínimo 8 caracteres';
  if (typeof display_name !== 'string' || !display_name.trim()) return 'nombre requerido';
  return null;
}

module.exports = { isEmail, registerErrors };
```

- [ ] **Step 4: Implementar auth.js**

Crear `server/auth.js`:
```js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PUBLIC_COLS = 'id, email, display_name, home_lat, home_lng, viz_mode, avatar';

function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}
function verifyPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}
function signToken(user) {
  return jwt.sign({ uid: user.id }, SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
function publicUser(row) {
  if (!row) return null;
  const { id, email, display_name, home_lat, home_lng, viz_mode, avatar } = row;
  return { id, email, display_name, home_lat, home_lng, viz_mode, avatar };
}
function requireAuth(db) {
  const getUser = db.prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`);
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token && verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'no autorizado' });
    const user = getUser.get(payload.uid);
    if (!user) return res.status(401).json({ error: 'no autorizado' });
    req.user = user;
    next();
  };
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, publicUser, requireAuth, PUBLIC_COLS };
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node --test server/auth.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add server/validate.js server/auth.js server/auth.test.js
git commit -m "feat(backend): validación, hashing y JWT"
```

---

## Task 3: App Express + register/login/me

**Files:**
- Create: `server/routes.auth.js`
- Create: `server/index.js`
- Test: `server/routes.auth.test.js`

**Interfaces:**
- Consumes: `openDb` (Task 1); `auth.*`, `validate.*` (Task 2).
- Produces:
  - `createApp(db) => express.Application` (exportado desde `index.js`, sin `listen`).
  - `routesAuth(db) => Router`: `POST /register`, `POST /login`, `GET /me`, `PATCH /me`.
  - Contrato: register/login → `{ token, user }`. `/me` → `user`. `user` = `publicUser`.
  - `PATCH /me` acepta `{display_name?, home_lat?, home_lng?, viz_mode?, avatar?}`; `avatar` acá solo admite `preset:<id>`.

- [ ] **Step 1: Escribir el test que falla**

Crear `server/routes.auth.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('./db');
const { createApp } = require('./index');

// Levanta el app en un puerto efímero y devuelve base URL + close.
async function boot() {
  const app = createApp(openDb(':memory:'));
  const server = await new Promise((res) => {
    const s = app.listen(0, () => res(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => server.close() };
}
const json = (body) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('register devuelve token y user sin password', async () => {
  const { base, close } = await boot();
  const r = await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) });
  assert.equal(r.status, 201);
  const data = await r.json();
  assert.ok(data.token);
  assert.equal(data.user.email, 'a@b.com');
  assert.equal(data.user.password_hash, undefined);
  close();
});

test('email duplicado da 409', async () => {
  const { base, close } = await boot();
  const body = json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' });
  await fetch(`${base}/api/register`, { method: 'POST', ...body });
  const r = await fetch(`${base}/api/register`, { method: 'POST', ...body });
  assert.equal(r.status, 409);
  close();
});

test('login ok y /me con token', async () => {
  const { base, close } = await boot();
  await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) });
  const lr = await fetch(`${base}/api/login`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678' }) });
  assert.equal(lr.status, 200);
  const { token } = await lr.json();
  const me = await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).display_name, 'Ana');
  close();
});

test('/me sin token da 401', async () => {
  const { base, close } = await boot();
  const r = await fetch(`${base}/api/me`);
  assert.equal(r.status, 401);
  close();
});

test('login con password mal da 401', async () => {
  const { base, close } = await boot();
  await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) });
  const r = await fetch(`${base}/api/login`, { method: 'POST', ...json({ email: 'a@b.com', password: 'incorrecta' }) });
  assert.equal(r.status, 401);
  close();
});

test('PATCH /me actualiza viz_mode y preset de avatar', async () => {
  const { base, close } = await boot();
  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) })).json();
  const r = await fetch(`${base}/api/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${reg.token}` }, body: JSON.stringify({ viz_mode: 'heatmap', avatar: 'preset:mars' }) });
  assert.equal(r.status, 200);
  const u = await r.json();
  assert.equal(u.viz_mode, 'heatmap');
  assert.equal(u.avatar, 'preset:mars');
  close();
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node --test server/routes.auth.test.js`
Expected: FAIL con `Cannot find module './index'`.

- [ ] **Step 3: Implementar routes.auth.js**

Crear `server/routes.auth.js`:
```js
const express = require('express');
const { hashPassword, verifyPassword, signToken, publicUser, requireAuth, PUBLIC_COLS } = require('./auth');
const { registerErrors, isEmail } = require('./validate');

const VIZ_MODES = ['points', 'heatmap', 'hexbin'];
const PRESETS = ['earth', 'mars', 'jupiter', 'saturn', 'neptune', 'moon'];

module.exports = function routesAuth(db) {
  const router = express.Router();
  const auth = requireAuth(db);

  const insertUser = db.prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)');
  const byEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const byId = db.prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`);

  router.post('/register', (req, res) => {
    const { email, password, display_name } = req.body || {};
    const err = registerErrors({ email, password, display_name });
    if (err) return res.status(400).json({ error: err });
    if (byEmail.get(email)) return res.status(409).json({ error: 'email ya registrado' });
    const info = insertUser.run(email, hashPassword(password), display_name.trim());
    const user = byId.get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user });
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!isEmail(email) || typeof password !== 'string') return res.status(400).json({ error: 'datos inválidos' });
    const row = byEmail.get(email);
    if (!row || !verifyPassword(password, row.password_hash)) return res.status(401).json({ error: 'credenciales inválidas' });
    const user = publicUser(row);
    res.json({ token: signToken(user), user });
  });

  router.get('/me', auth, (req, res) => res.json(req.user));

  router.patch('/me', auth, (req, res) => {
    const { display_name, home_lat, home_lng, viz_mode, avatar } = req.body || {};
    const sets = [];
    const args = [];
    if (display_name !== undefined) {
      if (!String(display_name).trim()) return res.status(400).json({ error: 'nombre requerido' });
      sets.push('display_name = ?'); args.push(String(display_name).trim());
    }
    if (home_lat !== undefined) { sets.push('home_lat = ?'); args.push(home_lat === null ? null : Number(home_lat)); }
    if (home_lng !== undefined) { sets.push('home_lng = ?'); args.push(home_lng === null ? null : Number(home_lng)); }
    if (viz_mode !== undefined) {
      if (!VIZ_MODES.includes(viz_mode)) return res.status(400).json({ error: 'viz_mode inválido' });
      sets.push('viz_mode = ?'); args.push(viz_mode);
    }
    if (avatar !== undefined) {
      const id = String(avatar).startsWith('preset:') ? String(avatar).slice(7) : null;
      if (!id || !PRESETS.includes(id)) return res.status(400).json({ error: 'avatar preset inválido' });
      sets.push('avatar = ?'); args.push(`preset:${id}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'nada para actualizar' });
    args.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    res.json(byId.get(req.user.id));
  });

  return router;
};
```

- [ ] **Step 4: Implementar index.js (createApp + arranque)**

Crear `server/index.js`:
```js
const express = require('express');
const cors = require('cors');
const { openDb } = require('./db');
const routesAuth = require('./routes.auth');

function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', routesAuth(db));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'error interno' });
  });
  return app;
}

if (require.main === module) {
  const db = openDb();
  const port = process.env.PORT || 3000;
  createApp(db).listen(port, () => console.log(`API en http://localhost:${port}`));
}

module.exports = { createApp };
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node --test server/routes.auth.test.js`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add server/routes.auth.js server/index.js server/routes.auth.test.js
git commit -m "feat(backend): register, login y perfil (/me)"
```

---

## Task 4: Favoritos (CRUD + archivar)

**Files:**
- Create: `server/routes.favorites.js`
- Modify: `server/index.js` (montar el router)
- Test: `server/routes.favorites.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 2), `createApp` (Task 3).
- Produces: `routesFavorites(db) => Router` montado en `/api/favorites`, todo detrás de `requireAuth`.
  - `GET /` → `[{id, norad_id, sat_name, archived, created_at}]`.
  - `POST /` `{norad_id, sat_name}` → 201 favorito; 409 si ya existe para ese usuario.
  - `PATCH /:id` `{archived}` → favorito actualizado; 404 si no es del usuario.
  - `DELETE /:id` → 204; 404 si no es del usuario.

- [ ] **Step 1: Escribir el test que falla**

Crear `server/routes.favorites.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('./db');
const { createApp } = require('./index');

async function bootWithUser() {
  const app = createApp(openDb(':memory:'));
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) })).json();
  const h = { 'content-type': 'application/json', authorization: `Bearer ${reg.token}` };
  return { base, h, close: () => server.close() };
}

test('crear, listar, archivar y borrar favorito', async () => {
  const { base, h, close } = await bootWithUser();
  const c = await fetch(`${base}/api/favorites`, { method: 'POST', headers: h, body: JSON.stringify({ norad_id: 25544, sat_name: 'ISS (ZARYA)' }) });
  assert.equal(c.status, 201);
  const fav = await c.json();
  assert.equal(fav.norad_id, 25544);
  assert.equal(fav.archived, 0);

  const list = await (await fetch(`${base}/api/favorites`, { headers: h })).json();
  assert.equal(list.length, 1);

  const p = await fetch(`${base}/api/favorites/${fav.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ archived: 1 }) });
  assert.equal((await p.json()).archived, 1);

  const d = await fetch(`${base}/api/favorites/${fav.id}`, { method: 'DELETE', headers: h });
  assert.equal(d.status, 204);
  assert.equal((await (await fetch(`${base}/api/favorites`, { headers: h })).json()).length, 0);
  close();
});

test('favorito duplicado da 409', async () => {
  const { base, h, close } = await bootWithUser();
  const body = JSON.stringify({ norad_id: 25544, sat_name: 'ISS' });
  await fetch(`${base}/api/favorites`, { method: 'POST', headers: h, body });
  const r = await fetch(`${base}/api/favorites`, { method: 'POST', headers: h, body });
  assert.equal(r.status, 409);
  close();
});

test('no se puede borrar favorito ajeno (404)', async () => {
  const { base, h, close } = await bootWithUser();
  const r = await fetch(`${base}/api/favorites/9999`, { method: 'DELETE', headers: h });
  assert.equal(r.status, 404);
  close();
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node --test server/routes.favorites.test.js`
Expected: FAIL con `Cannot find module './routes.favorites'` (al cargar index.js modificado) o 404 en todas las rutas.

- [ ] **Step 3: Implementar routes.favorites.js**

Crear `server/routes.favorites.js`:
```js
const express = require('express');
const { requireAuth } = require('./auth');

module.exports = function routesFavorites(db) {
  const router = express.Router();
  router.use(requireAuth(db));

  const list = db.prepare('SELECT id, norad_id, sat_name, archived, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC');
  const byId = db.prepare('SELECT id, norad_id, sat_name, archived, created_at FROM favorites WHERE id = ? AND user_id = ?');
  const insert = db.prepare('INSERT INTO favorites (user_id, norad_id, sat_name) VALUES (?, ?, ?)');
  const setArchived = db.prepare('UPDATE favorites SET archived = ? WHERE id = ? AND user_id = ?');
  const del = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?');

  router.get('/', (req, res) => res.json(list.all(req.user.id)));

  router.post('/', (req, res) => {
    const { norad_id, sat_name } = req.body || {};
    if (!Number.isInteger(norad_id) || !String(sat_name || '').trim()) {
      return res.status(400).json({ error: 'norad_id (entero) y sat_name requeridos' });
    }
    try {
      const info = insert.run(req.user.id, norad_id, String(sat_name).trim());
      res.status(201).json(byId.get(info.lastInsertRowid, req.user.id));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'ya está en favoritos' });
      throw e;
    }
  });

  router.patch('/:id', (req, res) => {
    const archived = req.body?.archived ? 1 : 0;
    const info = setArchived.run(archived, req.params.id, req.user.id);
    if (!info.changes) return res.status(404).json({ error: 'no encontrado' });
    res.json(byId.get(req.params.id, req.user.id));
  });

  router.delete('/:id', (req, res) => {
    const info = del.run(req.params.id, req.user.id);
    if (!info.changes) return res.status(404).json({ error: 'no encontrado' });
    res.status(204).end();
  });

  return router;
};
```

- [ ] **Step 4: Montar el router en index.js**

En `server/index.js`, agregar el require arriba:
```js
const routesFavorites = require('./routes.favorites');
```
Y dentro de `createApp`, después de `app.use('/api', routesAuth(db));`:
```js
  app.use('/api/favorites', routesFavorites(db));
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node --test server/routes.favorites.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add server/routes.favorites.js server/index.js server/routes.favorites.test.js
git commit -m "feat(backend): CRUD de favoritos con archivar"
```

---

## Task 5: Notas por satélite (upsert)

**Files:**
- Create: `server/routes.notes.js`
- Modify: `server/index.js` (montar el router)
- Test: `server/routes.notes.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 2), `createApp` (Task 3).
- Produces: `routesNotes(db) => Router` montado en `/api/notes`, detrás de `requireAuth`.
  - `GET /:norad_id` → `{norad_id, body, updated_at}` o 404.
  - `PUT /:norad_id` `{body}` → upsert (crea o reemplaza), 200 con la nota.
  - `DELETE /:norad_id` → 204 (idempotente; 204 aunque no existiera).

- [ ] **Step 1: Escribir el test que falla**

Crear `server/routes.notes.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('./db');
const { createApp } = require('./index');

async function bootWithUser() {
  const app = createApp(openDb(':memory:'));
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) })).json();
  const h = { 'content-type': 'application/json', authorization: `Bearer ${reg.token}` };
  return { base, h, close: () => server.close() };
}

test('nota inexistente da 404', async () => {
  const { base, h, close } = await bootWithUser();
  const r = await fetch(`${base}/api/notes/25544`, { headers: h });
  assert.equal(r.status, 404);
  close();
});

test('upsert de nota: crea, reemplaza y borra', async () => {
  const { base, h, close } = await bootWithUser();
  const put1 = await fetch(`${base}/api/notes/25544`, { method: 'PUT', headers: h, body: JSON.stringify({ body: 'la vi anoche' }) });
  assert.equal(put1.status, 200);
  assert.equal((await put1.json()).body, 'la vi anoche');

  await fetch(`${base}/api/notes/25544`, { method: 'PUT', headers: h, body: JSON.stringify({ body: 'brilla mucho' }) });
  const g = await (await fetch(`${base}/api/notes/25544`, { headers: h })).json();
  assert.equal(g.body, 'brilla mucho');

  const d = await fetch(`${base}/api/notes/25544`, { method: 'DELETE', headers: h });
  assert.equal(d.status, 204);
  assert.equal((await fetch(`${base}/api/notes/25544`, { headers: h })).status, 404);
  close();
});

test('PUT con body vacío da 400', async () => {
  const { base, h, close } = await bootWithUser();
  const r = await fetch(`${base}/api/notes/25544`, { method: 'PUT', headers: h, body: JSON.stringify({ body: '   ' }) });
  assert.equal(r.status, 400);
  close();
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node --test server/routes.notes.test.js`
Expected: FAIL con `Cannot find module './routes.notes'` o 404 genérico de Express.

- [ ] **Step 3: Implementar routes.notes.js**

Crear `server/routes.notes.js`:
```js
const express = require('express');
const { requireAuth } = require('./auth');

module.exports = function routesNotes(db) {
  const router = express.Router();
  router.use(requireAuth(db));

  const get = db.prepare('SELECT norad_id, body, updated_at FROM notes WHERE user_id = ? AND norad_id = ?');
  const upsert = db.prepare(`
    INSERT INTO notes (user_id, norad_id, body, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, norad_id) DO UPDATE SET body = excluded.body, updated_at = datetime('now')
  `);
  const del = db.prepare('DELETE FROM notes WHERE user_id = ? AND norad_id = ?');

  router.get('/:norad_id', (req, res) => {
    const note = get.get(req.user.id, Number(req.params.norad_id));
    if (!note) return res.status(404).json({ error: 'sin nota' });
    res.json(note);
  });

  router.put('/:norad_id', (req, res) => {
    const body = String(req.body?.body ?? '').trim();
    if (!body) return res.status(400).json({ error: 'nota vacía' });
    upsert.run(req.user.id, Number(req.params.norad_id), body);
    res.json(get.get(req.user.id, Number(req.params.norad_id)));
  });

  router.delete('/:norad_id', (req, res) => {
    del.run(req.user.id, Number(req.params.norad_id));
    res.status(204).end();
  });

  return router;
};
```

- [ ] **Step 4: Montar el router en index.js**

En `server/index.js`, agregar arriba:
```js
const routesNotes = require('./routes.notes');
```
Y dentro de `createApp`, después del router de favoritos:
```js
  app.use('/api/notes', routesNotes(db));
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node --test server/routes.notes.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add server/routes.notes.js server/index.js server/routes.notes.test.js
git commit -m "feat(backend): notas por satélite (upsert)"
```

---

## Task 6: Subida de avatar

**Files:**
- Create: `server/routes.avatar.js`
- Modify: `server/index.js` (montar router + servir `/media`)
- Test: `server/routes.avatar.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 2), `createApp` (Task 3).
- Produces: `routesAvatar(db) => Router` montado en `/api/avatar`, detrás de `requireAuth`.
  - `POST /` multipart campo `file` → guarda en `server/media/<uuid>.<ext>`, setea `users.avatar = '/media/<archivo>'`, → `{avatar}`.
  - Rechaza no-imagen (400) y >2MB (413/400).
- `index.js` sirve `server/media/` como estático en `/media`.

- [ ] **Step 1: Escribir el test que falla**

Crear `server/routes.avatar.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('./db');
const { createApp } = require('./index');

async function bootWithUser() {
  const app = createApp(openDb(':memory:'));
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) })).json();
  return { base, token: reg.token, close: () => server.close() };
}

// PNG 1x1 mínimo válido.
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMDAQAY3Z2VAAAAAElFTkSuQmCC', 'base64');

test('sube un png y setea avatar', async () => {
  const { base, token, close } = await bootWithUser();
  const form = new FormData();
  form.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'foto.png');
  const r = await fetch(`${base}/api/avatar`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  assert.equal(r.status, 200);
  const { avatar } = await r.json();
  assert.match(avatar, /^\/media\/.+\.png$/);
  close();
});

test('rechaza un archivo que no es imagen (400)', async () => {
  const { base, token, close } = await bootWithUser();
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('no soy imagen')], { type: 'text/plain' }), 'x.txt');
  const r = await fetch(`${base}/api/avatar`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  assert.equal(r.status, 400);
  close();
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node --test server/routes.avatar.test.js`
Expected: FAIL con `Cannot find module './routes.avatar'`.

- [ ] **Step 3: Implementar routes.avatar.js**

Crear `server/routes.avatar.js`:
```js
const express = require('express');
const multer = require('multer');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { requireAuth, PUBLIC_COLS } = require('./auth');

const MEDIA_DIR = path.join(__dirname, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' }[file.mimetype] || '.img';
    cb(null, crypto.randomUUID() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

module.exports = function routesAvatar(db) {
  const router = express.Router();
  const auth = requireAuth(db);
  const setAvatar = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
  const byId = db.prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`);

  router.post('/', auth, (req, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 400 : 400).json({ error: 'archivo inválido' });
      if (!req.file) return res.status(400).json({ error: 'no es una imagen' });
      const url = `/media/${req.file.filename}`;
      setAvatar.run(url, req.user.id);
      res.json({ avatar: url, user: byId.get(req.user.id) });
    });
  });

  return router;
};
```

- [ ] **Step 4: Montar router + servir /media en index.js**

En `server/index.js`, agregar arriba:
```js
const path = require('node:path');
const routesAvatar = require('./routes.avatar');
```
Dentro de `createApp`, después del router de notas:
```js
  app.use('/api/avatar', routesAvatar(db));
  app.use('/media', express.static(path.join(__dirname, 'media')));
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node --test server/routes.avatar.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add server/routes.avatar.js server/index.js server/routes.avatar.test.js
git commit -m "feat(backend): subida de avatar con validación de tipo/tamaño"
```

---

## Task 7: Self-check end-to-end + proxy + docs

**Files:**
- Create: `server/test.js`
- Modify: `proxy.conf.json` (agregar `/api`)
- Modify: `README.md` (sección backend)

**Interfaces:**
- Consumes: todo lo anterior via `createApp`.
- Produces: `server/test.js` que corre el flujo completo del spec y sale con código 0 si todo pasa. `proxy.conf.json` redirige `/api` a `:3000`.

- [ ] **Step 1: Escribir el self-check end-to-end**

Crear `server/test.js`:
```js
// Self-check end-to-end del flujo completo (spec). Corre con: node server/test.js
const assert = require('node:assert/strict');
const { openDb } = require('./db');
const { createApp } = require('./index');

(async () => {
  const server = await new Promise((res) => { const s = createApp(openDb(':memory:')).listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const H = (t) => ({ 'content-type': 'application/json', authorization: `Bearer ${t}` });

  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'demo@sat.app', password: 'demo1234', display_name: 'Demo' }) })).json();
  assert.ok(reg.token, 'register da token');

  const login = await (await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'demo@sat.app', password: 'demo1234' }) })).json();
  const t = login.token;

  await fetch(`${base}/api/me`, { method: 'PATCH', headers: H(t), body: JSON.stringify({ viz_mode: 'heatmap', avatar: 'preset:mars', home_lat: -33.4, home_lng: -60.2 }) });
  const me = await (await fetch(`${base}/api/me`, { headers: H(t) })).json();
  assert.equal(me.viz_mode, 'heatmap');
  assert.equal(me.avatar, 'preset:mars');

  const fav = await (await fetch(`${base}/api/favorites`, { method: 'POST', headers: H(t), body: JSON.stringify({ norad_id: 25544, sat_name: 'ISS (ZARYA)' }) })).json();
  await fetch(`${base}/api/favorites/${fav.id}`, { method: 'PATCH', headers: H(t), body: JSON.stringify({ archived: 1 }) });
  assert.equal((await (await fetch(`${base}/api/favorites`, { headers: H(t) })).json())[0].archived, 1);
  await fetch(`${base}/api/favorites/${fav.id}`, { method: 'DELETE', headers: H(t) });
  assert.equal((await (await fetch(`${base}/api/favorites`, { headers: H(t) })).json()).length, 0);

  await fetch(`${base}/api/notes/25544`, { method: 'PUT', headers: H(t), body: JSON.stringify({ body: 'nota de prueba' }) });
  assert.equal((await (await fetch(`${base}/api/notes/25544`, { headers: H(t) })).json()).body, 'nota de prueba');
  await fetch(`${base}/api/notes/25544`, { method: 'DELETE', headers: H(t) });
  assert.equal((await fetch(`${base}/api/notes/25544`, { headers: H(t) })).status, 404);

  assert.equal((await fetch(`${base}/api/me`)).status, 401, 'sin token = 401');

  server.close();
  console.log('OK: flujo end-to-end verde');
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr el self-check y verificar que pasa**

Run: `cd "D:/satelites-app" && node server/test.js`
Expected: imprime `OK: flujo end-to-end verde`, exit 0.

- [ ] **Step 3: Correr toda la suite de tests del backend**

Run: `cd "D:/satelites-app" && node --test server/*.test.js`
Expected: todos los archivos PASS, 0 fallos.

- [ ] **Step 4: Agregar el proxy /api**

Reemplazar el contenido de `proxy.conf.json` para incluir `/api` además de `/celestrak`. El archivo actual proxea `/celestrak`; agregar la entrada `/api → http://localhost:3000` sin romper la existente. Leer el archivo primero y agregar la clave nueva respetando su estructura.

Ejemplo del resultado esperado (ajustar a las claves reales del archivo):
```json
{
  "/celestrak": { "target": "https://celestrak.org", "secure": true, "changeOrigin": true, "pathRewrite": { "^/celestrak": "" } },
  "/api": { "target": "http://localhost:3000", "secure": false, "changeOrigin": true }
}
```

- [ ] **Step 5: Documentar el backend en el README**

En `README.md`, en la sección `## Desarrollo`, agregar:
```markdown
### Backend (API de cuentas)

El backend Node/Express vive en `server/` (JavaScript, sin build). Corre aparte del frontend:

\`\`\`bash
npm run server        # API en http://localhost:3000
npm start             # Angular en :4200 (proxy /api -> :3000)
node server/test.js   # self-check end-to-end del backend
npm run server:test   # suite de tests del backend (node --test)
\`\`\`

Variables de entorno (opcionales): `JWT_SECRET`, `PORT`, `DB_PATH`.
```

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add server/test.js proxy.conf.json README.md
git commit -m "feat(backend): self-check e2e, proxy /api y docs"
```

---

## Self-Review (completado al escribir el plan)

- **Cobertura del spec (backend):** schema users/favorites/notes ✓ (T1); JWT + hashing + requireAuth ✓ (T2); register/login/me + viz_mode + avatar preset ✓ (T3); favoritos CRUD + archivar ✓ (T4); notas upsert ✓ (T5); avatar upload con validación tipo/tamaño ✓ (T6); self-check e2e + proxy + docs ✓ (T7). Reglas de status codes y "password nunca vuelve" cubiertas por tests en T2/T3.
- **Fuera de este plan (van en planes de frontend):** Home, login/register UI, router shell, servicios Angular, panel Wikipedia, notas UI, heatmap/hexbin, dashboard chart.js, avatar picker UI, pulido del globo, pantallas de carga.
- **Consistencia de tipos:** `createApp(db)`, `openDb(file)`, `requireAuth(db)`, `publicUser(row)`, `PUBLIC_COLS` usados igual en todos los tasks. Contrato favoritos incluye `archived` en T4 y en el e2e de T7.
