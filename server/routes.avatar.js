const express = require('express');
const multer = require('multer');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { requireAuth, PUBLIC_COLS } = require('./auth');

const MEDIA_DIR = path.join(__dirname, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Solo tipos raster concretos. SVG queda FUERA a propósito (puede contener scripts).
const ALLOWED = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED[file.mimetype]),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB (los GIFs animados pesan más que un png)
  // ponytail: confiamos en el mimetype declarado + whitelist. Si el uploader fuera no confiable,
  // sumar validación de magic bytes; para avatares de usuarios logueados alcanza.
  fileFilter: (req, file, cb) => cb(null, Boolean(ALLOWED[file.mimetype])),
});

module.exports = function routesAvatar(db) {
  const router = express.Router();
  const auth = requireAuth(db);
  const setAvatar = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
  const byId = db.prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`);

  router.post('/', auth, (req, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'imagen muy grande (máx 5 MB)' : 'archivo inválido' });
      if (!req.file) return res.status(400).json({ error: 'formato no soportado (png, jpg, gif o webp)' });
      // Borramos el avatar subido anterior para no acumular archivos huérfanos en /media.
      const prev = byId.get(req.user.id)?.avatar;
      if (prev && prev.startsWith('/media/')) {
        fs.unlink(path.join(MEDIA_DIR, path.basename(prev)), () => {}); // best-effort, ignora si no existe
      }
      const url = `/media/${req.file.filename}`;
      setAvatar.run(url, req.user.id);
      res.json({ avatar: url, user: byId.get(req.user.id) });
    });
  });

  return router;
};
