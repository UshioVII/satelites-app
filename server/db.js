const { createClient } = require('@libsql/client');

// Adaptador con la MISMA forma que better-sqlite3 (prepare().get/all/run) pero asíncrono.
// Se conserva esa forma a propósito: así las ~40 llamadas de las rutas solo necesitan `await`
// en vez de reescribirse a otra API. De paso desaparece la compilación nativa de
// better-sqlite3, que no tiene prebuild para Node 26 (ABI 147) y rompía el arranque en Linux.

// better-sqlite3 se llamaba variadic (.get(a, b)); libsql quiere un array.
// `undefined` no es un valor válido de bind, se mapea a NULL como hacía el driver anterior.
const toArgs = (args) => args.map((v) => (v === undefined ? null : v));

function wrap(client) {
  return {
    prepare(sql) {
      return {
        async get(...args) {
          return (await client.execute({ sql, args: toArgs(args) })).rows[0];
        },
        async all(...args) {
          return (await client.execute({ sql, args: toArgs(args) })).rows;
        },
        async run(...args) {
          const r = await client.execute({ sql, args: toArgs(args) });
          return {
            // libsql devuelve bigint. El código lo usa como número y lo re-bindea en otra
            // query (favorites), así que se normaliza acá y no en cada llamador.
            lastInsertRowid: r.lastInsertRowid === undefined ? undefined : Number(r.lastInsertRowid),
            changes: r.rowsAffected,
          };
        },
      };
    },
    exec: (sql) => client.executeMultiple(sql),
    close: () => client.close(),
  };
}

// Un `file` explícito SIEMPRE gana sobre las variables de entorno. Esto no es un detalle:
// los tests abren con ':memory:' y sin esta precedencia correrían contra la base de Turso
// de producción, escribiendo y borrando datos reales de usuarios.
function resolveTarget(file) {
  if (file) return { url: toFileUrl(file) };
  if (process.env.TURSO_DATABASE_URL) {
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  return { url: toFileUrl(process.env.DB_PATH || `${__dirname}/data.db`) };
}

function toFileUrl(file) {
  if (file === ':memory:' || file.startsWith('file:')) return file;
  return `file:${file}`;
}

async function openDb(file) {
  const client = createClient(resolveTarget(file));
  const db = wrap(client);
  // Pragmas: aplican a SQLite local. Turso los ignora o los rechaza (base remota, ya en WAL),
  // por eso son best-effort y no deben tumbar el arranque.
  for (const pragma of ['journal_mode = WAL', 'foreign_keys = ON']) {
    try {
      await client.execute(`PRAGMA ${pragma}`);
    } catch {
      /* remoto: no aplica */
    }
  }
  await migrate(db);
  return db;
}

async function migrate(db) {
  await db.exec(`
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
      color      TEXT,
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
    -- Los avatares subidos viven acá y no en el disco del contenedor, que en Render es
    -- efímero: cada redeploy o spin-down borraba la imagen y dejaba la foto rota.
    -- El id es un UUID, no el user_id, para que la URL no sea adivinable enumerando usuarios.
    CREATE TABLE IF NOT EXISTS avatars (
      id         TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      mime       TEXT NOT NULL,
      bytes      BLOB NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Migración para DBs viejas: agregar favorites.color si no existe.
  const favCols = (await db.prepare('PRAGMA table_info(favorites)').all()).map((c) => c.name);
  if (!favCols.includes('color')) await db.exec('ALTER TABLE favorites ADD COLUMN color TEXT');
  // Avatares del esquema viejo (/media/<uuid>.png): esos archivos ya no existen y apuntaban
  // al disco efímero. Se vuelven al preset por defecto en vez de dejar una imagen rota.
  await db.prepare("UPDATE users SET avatar = 'preset:earth' WHERE avatar LIKE '/media/%'").run();
}

module.exports = { openDb };
