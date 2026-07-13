const express = require('express');
const multer = require('multer');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { requireAuth, PUBLIC_COLS } = require('./auth');

const MEDIA_DIR = path.join(__dirname, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' }[file.mimetype] || '.img';
    cb(null, crypto.randomUUID() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

module.exports = function routesAvatar(db) {
  const router = express.Router();
  const auth = requireAuth(db);
  const setAvatar = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
  const byId = db.prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`);

  router.post('/', auth, (req, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 400 : 400).json({ error: 'archivo inválido' });
      if (!req.file) return res.status(400).json({ error: 'no es una imagen' });
      const url = `/media/${req.file.filename}`;
      setAvatar.run(url, req.user.id);
      res.json({ avatar: url, user: byId.get(req.user.id) });
    });
  });

  return router;
};
