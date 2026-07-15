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
  `);
  // Migración para DBs viejas: agregar favorites.color si no existe.
  const favCols = db.prepare('PRAGMA table_info(favorites)').all().map((c) => c.name);
  if (!favCols.includes('color')) db.exec('ALTER TABLE favorites ADD COLUMN color TEXT');
}

module.exports = { openDb };
