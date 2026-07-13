const express = require('express');
const { requireAuth } = require('./auth');

module.exports = function routesFavorites(db) {
  const router = express.Router();
  router.use(requireAuth(db));

  const list = db.prepare('SELECT id, norad_id, sat_name, archived, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC');
  const byId = db.prepare('SELECT id, norad_id, sat_name, archived, created_at FROM favorites WHERE id = ? AND user_id = ?');
  const insert = db.prepare('INSERT INTO favorites (user_id, norad_id, sat_name) VALUES (?, ?, ?)');
  const setArchived = db.prepare('UPDATE favorites SET archived = ? WHERE id = ? AND user_id = ?');
  const del = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?');

  router.get('/', (req, res) => res.json(list.all(req.user.id)));

  router.post('/', (req, res) => {
    const { norad_id, sat_name } = req.body || {};
    if (!Number.isInteger(norad_id) || !String(sat_name || '').trim()) {
      return res.status(400).json({ error: 'norad_id (entero) y sat_name requeridos' });
    }
    try {
      const info = insert.run(req.user.id, norad_id, String(sat_name).trim());
      res.status(201).json(byId.get(info.lastInsertRowid, req.user.id));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'ya está en favoritos' });
      throw e;
    }
  });

  router.patch('/:id', (req, res) => {
    const archived = req.body?.archived ? 1 : 0;
    const info = setArchived.run(archived, req.params.id, req.user.id);
    if (!info.changes) return res.status(404).json({ error: 'no encontrado' });
    res.json(byId.get(req.params.id, req.user.id));
  });

  router.delete('/:id', (req, res) => {
    const info = del.run(req.params.id, req.user.id);
    if (!info.changes) return res.status(404).json({ error: 'no encontrado' });
    res.status(204).end();
  });

  return router;
};
