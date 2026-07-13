const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, signToken, verifyToken, publicUser } = require('./auth');
const { registerErrors, isEmail } = require('./validate');

test('hash y verify de password', () => {
  const h = hashPassword('secreto12');
  assert.notEqual(h, 'secreto12');
  assert.equal(verifyPassword('secreto12', h), true);
  assert.equal(verifyPassword('otra', h), false);
});

test('token round-trip', () => {
  const t = signToken({ id: 7 });
  assert.equal(verifyToken(t).uid, 7);
  assert.equal(verifyToken('basura'), null);
});

test('publicUser no filtra password_hash', () => {
  const pub = publicUser({ id: 1, email: 'a@b.com', password_hash: 'x', display_name: 'A', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' });
  assert.equal(pub.password_hash, undefined);
  assert.equal(pub.email, 'a@b.com');
});

test('validación de registro', () => {
  assert.equal(registerErrors({ email: 'a@b.com', password: '12345678', display_name: 'A' }), null);
  assert.match(registerErrors({ email: 'malito', password: '12345678', display_name: 'A' }), /email/i);
  assert.match(registerErrors({ email: 'a@b.com', password: '123', display_name: 'A' }), /password/i);
  assert.match(registerErrors({ email: 'a@b.com', password: '12345678', display_name: '' }), /nombre/i);
  assert.equal(isEmail('a@b.com'), true);
});
