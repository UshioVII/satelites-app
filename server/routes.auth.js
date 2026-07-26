const express = require('express');
const { hashPassword, verifyPassword, signToken, publicUser, requireAuth, PUBLIC_COLS } = require('./auth');
const { registerErrors, isEmail, MAX } = require('./validate');
const { rateLimit } = require('./ratelimit');

const VIZ_MODES = ['points', 'heatmap'];
const PRESETS = ['earth', 'mars', 'jupiter', 'saturn', 'neptune', 'moon'];

module.exports = function routesAuth(db) {
  const router = express.Router();
  const auth = requireAuth(db);

  const insertUser = db.prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)');
  const byEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const byId = db.prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`);

  // Freno anti fuerza-bruta y anti-enumeración en las rutas sensibles.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
  // Hash señuelo para nivelar el timing del login cuando el email no existe (evita oráculo de enumeración).
  const DUMMY_HASH = hashPassword('timing-equalizer');

  router.post('/register', authLimiter, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const { password, display_name } = req.body || {};
    const err = registerErrors({ email, password, display_name });
    if (err) return res.status(400).json({ error: err });
    if (await byEmail.get(email)) return res.status(409).json({ error: 'email ya registrado' });
    const info = await insertUser.run(email, hashPassword(password), display_name.trim());
    const user = await byId.get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user });
  });

  router.post('/login', authLimiter, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const { password } = req.body || {};
    if (!isEmail(email) || typeof password !== 'string') return res.status(400).json({ error: 'datos inválidos' });
    const row = await byEmail.get(email);
    // Corremos siempre un bcrypt (real o señuelo) para que el tiempo no revele si el email existe.
    const ok = row ? verifyPassword(password, row.password_hash) : (verifyPassword(password, DUMMY_HASH) && false);
    if (!ok) return res.status(401).json({ error: 'credenciales inválidas' });
    const user = publicUser(row);
    res.json({ token: signToken(user), user });
  });

  router.get('/me', auth, (req, res) => res.json(req.user));

  router.patch('/me', auth, async (req, res) => {
    const { display_name, home_lat, home_lng, viz_mode, avatar } = req.body || {};
    const sets = [];
    const args = [];
    if (display_name !== undefined) {
      const name = String(display_name).trim();
      if (!name) return res.status(400).json({ error: 'nombre requerido' });
      if (name.length > MAX.display_name) return res.status(400).json({ error: `nombre máximo ${MAX.display_name} caracteres` });
      sets.push('display_name = ?'); args.push(name);
    }
    if (home_lat !== undefined) {
      if (home_lat !== null && !Number.isFinite(Number(home_lat))) return res.status(400).json({ error: 'coordenada inválida' });
      sets.push('home_lat = ?'); args.push(home_lat === null ? null : Number(home_lat));
    }
    if (home_lng !== undefined) {
      if (home_lng !== null && !Number.isFinite(Number(home_lng))) return res.status(400).json({ error: 'coordenada inválida' });
      sets.push('home_lng = ?'); args.push(home_lng === null ? null : Number(home_lng));
    }
    if (viz_mode !== undefined) {
      if (!VIZ_MODES.includes(viz_mode)) return res.status(400).json({ error: 'viz_mode inválido' });
      sets.push('viz_mode = ?'); args.push(viz_mode);
    }
    if (avatar !== undefined) {
      const id = String(avatar).startsWith('preset:') ? String(avatar).slice(7) : null;
      if (!id || !PRESETS.includes(id)) return res.status(400).json({ error: 'avatar preset inválido' });
      sets.push('avatar = ?'); args.push(`preset:${id}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'nada para actualizar' });
    args.push(req.user.id);
    await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    res.json(await byId.get(req.user.id));
  });

  return router;
};
