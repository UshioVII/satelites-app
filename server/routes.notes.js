const express = require('express');
const { requireAuth } = require('./auth');

module.exports = function routesNotes(db) {
  const router = express.Router();
  router.use(requireAuth(db));

  const get = db.prepare('SELECT norad_id, body, updated_at FROM notes WHERE user_id = ? AND norad_id = ?');
  const upsert = db.prepare(`
    INSERT INTO notes (user_id, norad_id, body, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, norad_id) DO UPDATE SET body = excluded.body, updated_at = datetime('now')
  `);
  const del = db.prepare('DELETE FROM notes WHERE user_id = ? AND norad_id = ?');

  router.get('/:norad_id', (req, res) => {
    const note = get.get(req.user.id, Number(req.params.norad_id));
    if (!note) return res.status(404).json({ error: 'sin nota' });
    res.json(note);
  });

  router.put('/:norad_id', (req, res) => {
    const body = String(req.body?.body ?? '').trim();
    if (!body) return res.status(400).json({ error: 'nota vacía' });
    upsert.run(req.user.id, Number(req.params.norad_id), body);
    res.json(get.get(req.user.id, Number(req.params.norad_id)));
  });

  router.delete('/:norad_id', (req, res) => {
    del.run(req.user.id, Number(req.params.norad_id));
    res.status(204).end();
  });

  return router;
};
