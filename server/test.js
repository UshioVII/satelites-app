// Self-check end-to-end del flujo completo (spec). Corre con: node server/test.js
const assert = require('node:assert/strict');
const { openDb } = require('./db');
const { createApp } = require('./index');

(async () => {
  const db = await openDb(':memory:');
  const server = await new Promise((res) => { const s = createApp(db).listen(0, () => res(s)); });
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
