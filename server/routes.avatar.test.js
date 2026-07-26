const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('./db');
const { createApp } = require('./index');

async function boot(dbFile) {
  const app = createApp(await openDb(dbFile || ':memory:'));
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

async function register(base, email = 'a@b.com') {
  const r = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: '12345678', display_name: 'Ana' }),
  });
  return (await r.json()).token;
}

async function bootWithUser() {
  const { base, close } = await boot();
  return { base, token: await register(base), close };
}

function postAvatar(base, token, bytes, type) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), 'foto' + type.replace('image/', '.'));
  return fetch(`${base}/api/avatar`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
}

// PNG 1x1 mínimo válido.
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMDAQAY3Z2VAAAAAElFTkSuQmCC', 'base64');

test('sube un png y setea avatar', async () => {
  const { base, token, close } = await bootWithUser();
  const r = await postAvatar(base, token, PNG_1x1, 'image/png');
  assert.equal(r.status, 200);
  const { avatar } = await r.json();
  assert.match(avatar, /^\/api\/avatar\/[0-9a-f-]{36}$/);
  close();
});

test('devuelve la imagen subida byte por byte, con el mime correcto', async () => {
  const { base, token, close } = await bootWithUser();
  const { avatar } = await (await postAvatar(base, token, PNG_1x1, 'image/png')).json();
  const img = await fetch(base + avatar);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG_1x1);
  close();
});

// La regresión que motivó todo: en Render el disco es efímero y el avatar desaparecía en
// cada redeploy. Al vivir en la base, tiene que sobrevivir a un proceso nuevo.
test('el avatar sobrevive a reiniciar el server (vive en la base, no en disco)', async () => {
  const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sat-')), 'data.db');
  const first = await boot(dbFile);
  const token = await register(first.base);
  const { avatar } = await (await postAvatar(first.base, token, PNG_1x1, 'image/png')).json();
  first.close();

  const second = await boot(dbFile); // proceso nuevo, misma base
  const img = await fetch(second.base + avatar);
  assert.equal(img.status, 200);
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG_1x1);
  second.close();
  fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
});

test('subir de nuevo reemplaza el anterior y no deja huérfanos', async () => {
  const { base, token, close } = await bootWithUser();
  const a = (await (await postAvatar(base, token, PNG_1x1, 'image/png')).json()).avatar;
  const b = (await (await postAvatar(base, token, PNG_1x1, 'image/png')).json()).avatar;
  assert.notEqual(a, b);
  assert.equal((await fetch(base + a)).status, 404); // el viejo ya no existe
  assert.equal((await fetch(base + b)).status, 200);
  close();
});

test('un id inexistente da 404, no 500', async () => {
  const { base, close } = await boot();
  assert.equal((await fetch(`${base}/api/avatar/no-existe`)).status, 404);
  close();
});

test('rechaza un archivo que no es imagen (400)', async () => {
  const { base, token, close } = await bootWithUser();
  const r = await postAvatar(base, token, Buffer.from('no soy imagen'), 'text/plain');
  assert.equal(r.status, 400);
  close();
});
