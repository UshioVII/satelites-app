const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('./db');
const { createApp } = require('./index');

async function bootWithUser() {
  const app = createApp(await openDb(':memory:'));
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
