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
