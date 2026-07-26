const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('./db');
const { createApp } = require('./index');

async function boot() {
  const app = createApp(await openDb(':memory:'));
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

async function tokenFor(base, email = 'sec@b.com', display_name = 'Ana') {
  const r = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: '12345678', display_name }),
  });
  return (await r.json()).token;
}

test('manda los headers de seguridad en toda respuesta', async () => {
  const { base, close } = await boot();
  const r = await fetch(`${base}/api/me`); // 401, pero los headers van igual
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /frame-ancestors 'none'/); // corta el clickjacking
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /default-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.match(r.headers.get('permissions-policy'), /geolocation=\(self\)/); // la app la usa
  assert.equal(r.headers.get('x-powered-by'), null); // no anunciamos Express
  close();
});

test('no manda HSTS fuera de producción (rompería localhost)', async () => {
  const { base, close } = await boot();
  const r = await fetch(`${base}/api/me`);
  assert.equal(r.headers.get('strict-transport-security'), null);
  close();
});

// El proxy reenviaba cualquier path a celestrak.org: era un relay abierto.
test('el proxy de CelesTrak solo acepta el endpoint y el GROUP esperados', async () => {
  const { base, close } = await boot();
  const rechazados = [
    '/celestrak/',                                    // raíz del sitio
    '/celestrak/NORAD/elements/../../robots.txt',     // salirse del endpoint
    '/celestrak/NORAD/elements/gp.php',               // sin GROUP
    '/celestrak/NORAD/elements/gp.php?GROUP=a b',     // GROUP con caracteres raros
    '/celestrak/NORAD/elements/gp.php?GROUP=visual&FORMAT=json', // formato no usado por la app
  ];
  for (const url of rechazados) {
    assert.equal((await fetch(base + url)).status, 400, `debería rechazar ${url}`);
  }
  close();
});

test('POST al proxy también se rechaza', async () => {
  const { base, close } = await boot();
  const r = await fetch(`${base}/celestrak/NORAD/elements/gp.php?GROUP=visual`, { method: 'POST' });
  assert.equal(r.status, 400);
  close();
});

test('corta el nombre, la nota y el sat_name largos', async () => {
  const { base, close } = await boot();
  const largo = 'x'.repeat(6000);

  const reg = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'largo@b.com', password: '12345678', display_name: largo }),
  });
  assert.equal(reg.status, 400);

  const token = await tokenFor(base);
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` };

  const nota = await fetch(`${base}/api/notes/25544`, { method: 'PUT', headers, body: JSON.stringify({ body: largo }) });
  assert.equal(nota.status, 400);

  const fav = await fetch(`${base}/api/favorites`, { method: 'POST', headers, body: JSON.stringify({ norad_id: 25544, sat_name: largo }) });
  assert.equal(fav.status, 400);

  const perfil = await fetch(`${base}/api/me`, { method: 'PATCH', headers, body: JSON.stringify({ display_name: largo }) });
  assert.equal(perfil.status, 400);
  close();
});
