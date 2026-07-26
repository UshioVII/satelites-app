const express = require('express');
const { requireAuth } = require('./auth');
const { MAX } = require('./validate');

// Paleta para asignar un color automático a un favorito cuando el usuario no elige uno.
const PALETTE = [
  '#ff5252', '#ff9800', '#ffd600', '#00e676', '#00e5ff', '#2979ff',
  '#d500f9', '#ff4081', '#8bc34a', '#26a69a', '#b388ff', '#ff8a65',
];
const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Elige un color de la paleta que el usuario no esté usando; si ya usó todos, uno al azar.
function pickColor(used) {
  const free = PALETTE.filter((c) => !used.has(c));
  const pool = free.length ? free : PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = function routesFavorites(db) {
  const router = express.Router();
  router.use(requireAuth(db));

  const cols = 'id, norad_id, sat_name, color, archived, created_at';
  const list = db.prepare(`SELECT ${cols} FROM favorites WHERE user_id = ? ORDER BY created_at DESC`);
  const byId = db.prepare(`SELECT ${cols} FROM favorites WHERE id = ? AND user_id = ?`);
  const insert = db.prepare('INSERT INTO favorites (user_id, norad_id, sat_name, color) VALUES (?, ?, ?, ?)');
  const usedColors = db.prepare('SELECT color FROM favorites WHERE user_id = ? AND color IS NOT NULL');
  const del = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?');

  router.get('/', async (req, res) => res.json(await list.all(req.user.id)));

  router.post('/', async (req, res) => {
    const { norad_id, sat_name, color } = req.body || {};
    if (!Number.isInteger(norad_id) || !String(sat_name || '').trim()) {
      return res.status(400).json({ error: 'norad_id (entero) y sat_name requeridos' });
    }
    if (String(sat_name).trim().length > MAX.sat_name) {
      return res.status(400).json({ error: `sat_name máximo ${MAX.sat_name} caracteres` });
    }
    // Color elegido por el usuario, o uno automático no repetido si no mandó ninguno válido.
    const c = isHex(color) ? color.toLowerCase() : pickColor(new Set((await usedColors.all(req.user.id)).map((r) => r.color)));
    try {
      const info = await insert.run(req.user.id, norad_id, String(sat_name).trim(), c);
      res.status(201).json(await byId.get(info.lastInsertRowid, req.user.id));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'ya está en favoritos' });
      throw e;
    }
  });

  router.patch('/:id', async (req, res) => {
    const sets = [];
    const args = [];
    if (req.body?.archived !== undefined) {
      sets.push('archived = ?');
      args.push(req.body.archived ? 1 : 0);
    }
    if (req.body?.color !== undefined) {
      if (!isHex(req.body.color)) return res.status(400).json({ error: 'color inválido (hex #rrggbb)' });
      sets.push('color = ?');
      args.push(String(req.body.color).toLowerCase());
    }
    if (!sets.length) return res.status(400).json({ error: 'nada para actualizar' });
    args.push(req.params.id, req.user.id);
    const info = await db.prepare(`UPDATE favorites SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...args);
    if (!info.changes) return res.status(404).json({ error: 'no encontrado' });
    res.json(await byId.get(req.params.id, req.user.id));
  });

  router.delete('/:id', async (req, res) => {
    const info = await del.run(req.params.id, req.user.id);
    if (!info.changes) return res.status(404).json({ error: 'no encontrado' });
    res.status(204).end();
  });

  return router;
};
