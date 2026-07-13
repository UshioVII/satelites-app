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
