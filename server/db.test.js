const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('./db');

test('openDb crea las tablas y columnas esperadas', async () => {
  const db = await openDb(':memory:');
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).map(r => r.name);
  assert.ok(tables.includes('users'));
  assert.ok(tables.includes('favorites'));
  assert.ok(tables.includes('notes'));

  const userCols = (await db.prepare('PRAGMA table_info(users)').all()).map(c => c.name);
  for (const c of ['email', 'password_hash', 'display_name', 'home_lat', 'home_lng', 'viz_mode', 'avatar']) {
    assert.ok(userCols.includes(c), `falta columna users.${c}`);
  }
});

test('foreign_keys está activado', async () => {
  const db = await openDb(':memory:');
  // Antes se leía con db.pragma() de better-sqlite3; el adaptador de libsql no tiene ese
  // atajo, así que se consulta el pragma como cualquier otra query.
  const row = await db.prepare('PRAGMA foreign_keys').get();
  assert.equal(row.foreign_keys, 1);
});

test('un file explícito nunca usa las credenciales de Turso', async () => {
  // Guarda de seguridad: si esta precedencia se rompe, los tests escribirían sobre la base
  // real de usuarios en vez de una en memoria.
  const previo = process.env.TURSO_DATABASE_URL;
  process.env.TURSO_DATABASE_URL = 'libsql://no-deberia-usarse.turso.io';
  try {
    const db = await openDb(':memory:');
    const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).map(r => r.name);
    assert.ok(tables.includes('users'), 'abrió en memoria, no contra la URL remota');
  } finally {
    if (previo === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previo;
  }
});
