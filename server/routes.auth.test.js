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

test('email se normaliza: registro con mayúsculas, login en minúsculas', async () => {
  const { base, close } = await boot();
  await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'Ana@B.com', password: '12345678', display_name: 'Ana' }) });
  const r = await fetch(`${base}/api/login`, { method: 'POST', ...json({ email: 'ana@b.com', password: '12345678' }) });
  assert.equal(r.status, 200);
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

test('PATCH /me con home_lat no numérico da 400', async () => {
  const { base, close } = await boot();
  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) })).json();
  const r = await fetch(`${base}/api/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${reg.token}` }, body: JSON.stringify({ home_lat: 'abc' }) });
  assert.equal(r.status, 400);
  close();
});

test('PATCH /me con viz_mode inválido da 400', async () => {
  const { base, close } = await boot();
  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) })).json();
  const r = await fetch(`${base}/api/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${reg.token}` }, body: JSON.stringify({ viz_mode: 'raro' }) });
  assert.equal(r.status, 400);
  close();
});

test('PATCH /me con avatar preset inexistente da 400', async () => {
  const { base, close } = await boot();
  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) })).json();
  const r = await fetch(`${base}/api/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${reg.token}` }, body: JSON.stringify({ avatar: 'preset:inexistente' }) });
  assert.equal(r.status, 400);
  close();
});

test('PATCH /me con home_lat null da 200 (permite limpiar valor)', async () => {
  const { base, close } = await boot();
  const reg = await (await fetch(`${base}/api/register`, { method: 'POST', ...json({ email: 'a@b.com', password: '12345678', display_name: 'Ana' }) })).json();
  const r = await fetch(`${base}/api/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${reg.token}` }, body: JSON.stringify({ home_lat: null }) });
  assert.equal(r.status, 200);
  close();
});
