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

test('un usuario no puede borrar el favorito de otro (404)', async () => {
  const app = createApp(openDb(':memory:'));
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const regA = await (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'usera@b.com', password: '12345678', display_name: 'A' }) })).json();
  const hA = { 'content-type': 'application/json', authorization: `Bearer ${regA.token}` };
  const regB = await (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'userb@b.com', password: '12345678', display_name: 'B' }) })).json();
  const hB = { 'content-type': 'application/json', authorization: `Bearer ${regB.token}` };

  const c = await fetch(`${base}/api/favorites`, { method: 'POST', headers: hA, body: JSON.stringify({ norad_id: 25544, sat_name: 'ISS' }) });
  const fav = await c.json();

  const r = await fetch(`${base}/api/favorites/${fav.id}`, { method: 'DELETE', headers: hB });
  assert.equal(r.status, 404);
  server.close();
});
