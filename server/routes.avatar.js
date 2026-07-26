const express = require('express');
const multer = require('multer');
const crypto = require('node:crypto');
const { requireAuth, PUBLIC_COLS } = require('./auth');
const { rateLimit } = require('./ratelimit');

// Solo tipos raster concretos. SVG queda FUERA a propósito (puede contener scripts).
const ALLOWED = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

// En memoria, no en disco: la imagen termina en la base (tabla avatars). El disco del
// contenedor en Render es efímero y se llevaba puesto el avatar en cada redeploy.
const upload = multer({
  storage: multer.memoryStorage(),
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
  const dropPrevious = db.prepare('DELETE FROM avatars WHERE user_id = ?');
  const insertAvatar = db.prepare('INSERT INTO avatars (id, user_id, mime, bytes) VALUES (?, ?, ?, ?)');
  const getAvatar = db.prepare('SELECT mime, bytes FROM avatars WHERE id = ?');

  // Subir 5 MB no cuesta nada al cliente y sí a la base. El limitador cuenta fallos, así que
  // una subida buena no gasta presupuesto; frena el goteo de subidas rotas.
  const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'demasiadas subidas fallidas, esperá unos minutos' });

  router.post('/', uploadLimiter, auth, (req, res, next) => {
    // El trabajo pasa dentro del callback de multer, no en el handler: Express no ve esta
    // promesa, así que el rechazo se encadena a mano con next(e). Sin eso, un error de la
    // base dejaría la request colgada hasta el timeout del cliente en vez de dar un 500.
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'imagen muy grande (máx 5 MB)' : 'archivo inválido' });
      if (!req.file) return res.status(400).json({ error: 'formato no soportado (png, jpg, gif o webp)' });
      (async () => {
        // Un avatar por usuario: el anterior se borra, así la tabla no acumula huérfanos.
        await dropPrevious.run(req.user.id);
        const id = crypto.randomUUID();
        await insertAvatar.run(id, req.user.id, req.file.mimetype, req.file.buffer);
        const url = `/api/avatar/${id}`;
        await setAvatar.run(url, req.user.id);
        res.json({ avatar: url, user: await byId.get(req.user.id) });
      })().catch(next);
    });
  });

  // Público a propósito (un <img> no manda el header Authorization). El id es un UUID:
  // no se puede enumerar, hay que conocer la URL. Inmutable porque cada subida genera un id nuevo.
  router.get('/:id', async (req, res) => {
    const row = await getAvatar.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'no encontrado' });
    res.setHeader('Content-Type', row.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff'); // que el browser no adivine el tipo
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(row.bytes));
  });

  return router;
};
